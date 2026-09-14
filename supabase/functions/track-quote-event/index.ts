// Copied from QuoteMGR supabase/functions/track-quote-event (read-only reference).
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_EVENTS = ['viewed', 'report_opened', 'tier_selected', 'signing_started'] as const;
type TrackableEvent = (typeof VALID_EVENTS)[number];

const EVENT_MESSAGES: Record<TrackableEvent, (quoteNumber: string, meta?: string) => string> = {
  viewed:          (q)    => `Quote ${q} was opened by your customer`,
  // Fired when the shared inspection report actually renders — not when the
  // email carrying it is opened.
  report_opened:   (q)    => `Photo report for Quote ${q} was opened by your customer`,
  tier_selected:   (q, m) => `Quote ${q} — customer selected the ${m} option`,
  signing_started: (q)    => `Quote ${q} — customer started the signing process`,
};

// Push notification titles/bodies (brief — appear on lock screen)
const PUSH_ALERTS: Record<TrackableEvent, (quoteNumber: string, customerName?: string, meta?: string) => { title: string; body: string }> = {
  viewed:          (q, name)    => ({ title: '📬 Quote Opened', body: name ? `${name} just opened Quote ${q}` : `Quote ${q} was opened by your customer` }),
  report_opened:   (q, name)    => ({ title: '📷 Report Opened', body: name ? `${name} just opened the photo report for Quote ${q}` : `Photo report for Quote ${q} was opened` }),
  tier_selected:   (q, name, m) => ({ title: '🎯 Option Selected', body: `${name || 'Customer'} chose the ${m} option on Quote ${q}` }),
  signing_started: (q, name)    => ({ title: '✍️ Signing Started', body: `${name || 'Customer'} started signing Quote ${q}` }),
};

const getSupabaseAdmin = () =>
  createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { share_token, event_type, meta, actor_name, actor_email } = await req.json();

    if (!share_token || !event_type) {
      return new Response(JSON.stringify({ error: 'Missing share_token or event_type' }), { status: 400, headers: corsHeaders });
    }

    if (!VALID_EVENTS.includes(event_type)) {
      return new Response(JSON.stringify({ error: 'Invalid event_type' }), { status: 400, headers: corsHeaders });
    }

    const supabase = getSupabaseAdmin();

    // Validate share token and get company_id
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, company_id, quote_number')
      .eq('share_token', share_token)
      .single();

    if (quoteError || !quote) {
      return new Response(JSON.stringify({ error: 'Invalid share token' }), { status: 404, headers: corsHeaders });
    }

    // Deduplicate: for 'viewed', skip if the same quote was already logged within 60 min
    // (prevents double-fires from rapid page refreshes while still notifying on every real open)
    if (event_type === 'viewed' || event_type === 'report_opened') {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from('quote_notifications')
        .select('id')
        .eq('quote_id', quote.id)
        .eq('event_type', event_type)
        .gte('created_at', since)
        .limit(1)
        .single();
      if (recent) {
        return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200, headers: corsHeaders });
      }
    }

    const message = EVENT_MESSAGES[event_type as TrackableEvent](quote.quote_number, meta);

    // 1. Log to in-app notification feed
    await supabase.from('quote_notifications').insert({
      company_id: quote.company_id,
      quote_id: quote.id,
      event_type,
      message,
      actor_name: actor_name || null,
      actor_email: actor_email || null,
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 2. Send email alert to the quote creator / company (fire-and-forget)
    //    For 'viewed' and 'tier_selected' we call send-quote-alert which handles
    //    the email. For 'signing_started' we skip email (sign flow sends its own).
    if (event_type === 'viewed' || event_type === 'tier_selected') {
      fetch(`${supabaseUrl}/functions/v1/send-quote-alert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ share_token, event_type }),
      }).catch(err => console.warn('[track-quote-event] email alert failed:', err));
    }

    // 3. Send iOS push notification (fire-and-forget, no-op if APNS not configured)
    const pushAlert = PUSH_ALERTS[event_type as TrackableEvent](quote.quote_number, actor_name, meta);
    fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        company_id: quote.company_id,
        title: pushAlert.title,
        body: pushAlert.body,
        data: { quote_id: quote.id, quote_number: quote.quote_number, event_type },
      }),
    }).catch(err => console.warn('[track-quote-event] push failed:', err));

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('track-quote-event error:', message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});

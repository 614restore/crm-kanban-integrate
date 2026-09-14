// Copied from QuoteMGR supabase/functions/sign-cancel-notice (read-only reference).
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getSupabaseAdmin = () =>
  createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

// Signs the standalone digital "3-Day Right to Cancel" notice — a manager
// one-off tool, distinct from the paper/bundled cancel notice that's part of
// the normal quote/contingency signing flow. Only reachable when an owner or
// admin has explicitly turned standalone_cancel_share_enabled on for this
// quote (see DocumentsWizard's "Share Digital Copy" action); the share_token
// alone is not sufficient.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      share_token: string;
      signature_data: string;
      signer_name?: string;
      signer_email?: string;
    };

    const { share_token, signature_data, signer_name, signer_email } = body;

    if (!share_token || !signature_data) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: share_token, signature_data' }),
        { status: 400, headers: corsHeaders },
      );
    }

    const admin = getSupabaseAdmin();

    const { data: quote, error: quoteErr } = await admin
      .from('quotes')
      .select(`
        id, quote_number, company_id,
        standalone_cancel_share_enabled,
        standalone_cancel_signed_at,
        customer:customers(first_name, last_name, email)
      `)
      .eq('share_token', share_token)
      .maybeSingle();

    if (quoteErr || !quote) {
      return new Response(JSON.stringify({ error: 'Notice not found' }), { status: 404, headers: corsHeaders });
    }

    if (!quote.standalone_cancel_share_enabled) {
      return new Response(
        JSON.stringify({ error: 'This link is not active. Ask your contractor to share it again.' }),
        { status: 422, headers: corsHeaders },
      );
    }

    if (quote.standalone_cancel_signed_at) {
      return new Response(
        JSON.stringify({ error: 'This notice has already been signed', already_signed: true }),
        { status: 409, headers: corsHeaders },
      );
    }

    const signedAt = new Date().toISOString();
    const customer = quote.customer as Record<string, any> | null;
    const customerName =
      signer_name ||
      [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') ||
      'Customer';

    const { error: updateErr } = await admin
      .from('quotes')
      .update({
        standalone_cancel_signature_data: signature_data,
        standalone_cancel_signed_by: customerName,
        standalone_cancel_signed_at: signedAt,
      })
      .eq('id', quote.id);

    if (updateErr) throw updateErr;

    // In-app notification only — no automatic email per product decision.
    await admin.from('quote_notifications').insert({
      company_id: quote.company_id,
      quote_id: quote.id,
      event_type: 'cancel_notice_signed',
      message: `${customerName} digitally signed the 3-Day Right to Cancel notice for ${quote.quote_number}`,
    });

    return new Response(JSON.stringify({ ok: true, signed_at: signedAt }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('sign-cancel-notice error:', msg);
    return new Response(JSON.stringify({ error: 'Unexpected error', details: msg }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

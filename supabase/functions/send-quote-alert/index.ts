import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// Source of the deployed send-quote-alert (pulled from the project 2026-09-30), changed so
// the signed alert no longer depends on email being configured: the quote_notifications
// row (which the notify_quote_creator trigger turns into the salesperson's bell alert) is
// written first, and the email is a best-effort extra.

type AlertPayload = {
  share_token: string;
  event_type: 'viewed' | 'signed';
  signed_pdf_base64?: string;
  signed_pdf_filename?: string;
};

serve(async (req) => {
  try {
    const { share_token, event_type, signed_pdf_base64, signed_pdf_filename } =
      (await req.json()) as AlertPayload;

    if (!share_token || !event_type) {
      return new Response(JSON.stringify({ error: 'Missing share_token or event_type' }), { status: 400 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('ALERT_FROM_EMAIL') || 'alerts@example.com';

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { data: quote, error } = await admin
      .from('quotes')
      .select(
        `
        id,
        company_id,
        quote_number,
        signed_at,
        signed_by,
        customer:customers(first_name,last_name,email),
        creator:team_members(email,full_name),
        company:companies(name,email)
        `
      )
      .eq('share_token', share_token)
      .single();

    if (error || !quote) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), { status: 404 });
    }

    const customerName = [quote.customer?.first_name, quote.customer?.last_name].filter(Boolean).join(' ') || 'Customer';

    if (event_type === 'signed') {
      // The signing RPC may already have logged this signature; don't log it twice.
      const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: already } = await admin
        .from('quote_notifications')
        .select('id')
        .eq('quote_id', quote.id)
        .eq('event_type', 'signed')
        .gte('created_at', since)
        .limit(1)
        .maybeSingle();
      if (!already) {
        await admin.from('quote_notifications').insert({
          company_id: quote.company_id,
          quote_id: quote.id,
          event_type: 'signed',
          message: `${customerName} signed quote ${quote.quote_number}.`,
          actor_name: customerName,
          actor_email: quote.customer?.email || null,
        });
      }
    }

    const toEmails = Array.from(
      new Set([quote.creator?.email, quote.company?.email].filter(Boolean) as string[])
    );

    if (!resendKey || toEmails.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
    }

    const subject = event_type === 'signed'
      ? `Quote ${quote.quote_number} signed`
      : `Quote ${quote.quote_number} viewed`;

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>${subject}</h2>
        <p><strong>${customerName}</strong> has ${event_type === 'signed' ? 'signed' : 'viewed'} quote <strong>${quote.quote_number}</strong>.</p>
        <p>Company: ${quote.company?.name || 'Your Company'}</p>
        ${event_type === 'signed' && quote.signed_at ? `<p>Signed at: ${new Date(quote.signed_at).toLocaleString()}</p>` : ''}
        ${event_type === 'signed' && quote.signed_by ? `<p>Signed by: ${quote.signed_by}</p>` : ''}
        ${event_type === 'signed' ? '<p><strong>Next step:</strong> reach out to this customer to get the job started.</p>' : ''}
      </div>
    `;

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: toEmails,
        subject,
        html,
        attachments: signed_pdf_base64
          ? [
              {
                filename: signed_pdf_filename || `quote-${quote.quote_number}-signed.pdf`,
                content: signed_pdf_base64,
              },
            ]
          : undefined,
      }),
    });

    if (!resendResp.ok) {
      const text = await resendResp.text();
      return new Response(JSON.stringify({ error: 'Failed to send', details: text }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Unexpected error' }), { status: 500 });
  }
});

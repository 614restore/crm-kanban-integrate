// Copied from QuoteMGR supabase/functions/sign-certificate (read-only reference).
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';


// The verified platform sender every TrussCTR email goes out from (same one the quote emails use).
const platformFromEmail = (() => {
  const v = (Deno.env.get('ALERT_FROM_EMAIL') || '').trim();
  return v.match(/<([^>]+)>/)?.[1] || v || 'scopemgr@614restore.com';
})();
const APP_URL = (Deno.env.get('APP_URL') || 'https://trussctr.614restore.com').replace(/\/$/, '');

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      share_token: string;
      signature_data: string;
      cancel_signature_data: string;
      signer_name?: string;
      signer_email?: string;
    };

    const { share_token, signature_data, cancel_signature_data, signer_name, signer_email } = body;

    if (!share_token || !signature_data) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: share_token, signature_data' }),
        { status: 400, headers: corsHeaders },
      );
    }

    const admin = getSupabaseAdmin();

    // Look up quote by share_token (no auth required — token IS the secret)
    const { data: quote, error: quoteErr } = await admin
      .from('quotes')
      .select(`
        id, status, company_id,
        certificate_customer_signed_at,
        completion_certificate_enabled,
        contractor_signature_data,
        customer:customers(first_name, last_name, email),
        company:companies(name, email),
        creator:team_members!created_by(email, full_name)
      `)
      .eq('share_token', share_token)
      .maybeSingle();

    if (quoteErr || !quote) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), { status: 404, headers: corsHeaders });
    }

    // Allow signing when: already signed in-app, OR completion_certificate_enabled
    // (covers agreements signed outside the app in sent/viewed state).
    const signingAllowed = quote.status === 'signed' || quote.completion_certificate_enabled;
    if (!signingAllowed) {
      return new Response(
        JSON.stringify({ error: 'Certificate is only available for active quotes' }),
        { status: 422, headers: corsHeaders },
      );
    }

    if (quote.certificate_customer_signed_at) {
      return new Response(
        JSON.stringify({ error: 'Certificate has already been signed', already_signed: true }),
        { status: 409, headers: corsHeaders },
      );
    }

    const signedAt = new Date().toISOString();

    // Save ONLY the certificate signature.
    //
    // This deliberately does NOT set status='signed'/signed_at on the quote.
    // It used to, to cover an agreement signed on paper off-app — but the
    // Completion Certificate and the agreement are two separate documents
    // with separate signatures, and promoting the quote here meant a customer
    // who signed only the certificate left the quote marked as executed with
    // signature_data still null. The Signed Quote PDF then printed a blank
    // signature box above "Signed: <date>" and "Agreement Fully Executed",
    // and that document was emailed to the homeowner — asserting an execution
    // that never happened.
    //
    // Nothing needs the promotion: every consumer of the signed state in the
    // certificate flow already falls back to completion_certificate_enabled
    // (this function's own signingAllowed check above, CertificateSigningView's
    // canSign, and the dashboard's countersign affordance).
    const { error: updateErr } = await admin
      .from('quotes')
      .update({
        certificate_customer_signature_data: signature_data,
        certificate_cancel_signature_data: cancel_signature_data || null,
        certificate_customer_signed_at: signedAt,
      })
      .eq('id', quote.id);

    if (updateErr) throw updateErr;

    const customer = quote.customer as Record<string, any> | null;
    const customerName =
      signer_name ||
      [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') ||
      'Customer';

    // Insert notification so the contractor gets an in-app toast
    await admin.from('quote_notifications').insert({
      company_id: quote.company_id,
      quote_id: quote.id,
      event_type: 'certificate_signed',
      message: `${customerName} signed the completion certificate`,
    });

    // Send email notification to the contractor (non-fatal)
    try {
      const resendKey = Deno.env.get('RESEND_API_KEY');
      const fromEmail = platformFromEmail;
      const appUrl = APP_URL;

      const companyData = quote.company as Record<string, any> | null;
      const creatorData = quote.creator as Record<string, any> | null;

      const companyName = companyData?.name || 'your company';
      const companyEmail = companyData?.email;
      const creatorEmail = creatorData?.email;
      const creatorName = creatorData?.full_name || 'there';

      const alertEmails = Array.from(
        new Set([creatorEmail, companyEmail].filter(Boolean) as string[])
      );

      if (resendKey && alertEmails.length > 0) {
        const alertHtml = `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
            <div style="background:#1e3a5f;padding:24px 32px;border-radius:12px 12px 0 0">
              <h1 style="color:#fff;margin:0;font-size:20px">Completion Certificate Signed</h1>
            </div>
            <div style="background:#f9fafb;padding:24px 32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none">
              <p style="margin:0 0 16px">Hi ${creatorName},</p>
              <p style="margin:0 0 16px">
                <strong>${customerName}</strong> has signed the Completion Certificate for
                <strong>${companyName}</strong>.
              </p>
              <p style="margin:0 0 16px;color:#6b7280;font-size:13px">Signed at: ${new Date(signedAt).toLocaleString()}</p>
              <p style="margin:0 0 24px">Log in to view and download the fully-signed certificate.</p>
              <a href="${appUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
                Open TrussCTR →
              </a>
              <p style="margin:24px 0 0;font-size:12px;color:#6b7280">
                This is an automated notification from TrussCTR.
              </p>
            </div>
          </div>`;

        for (const alertEmail of alertEmails) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
            body: JSON.stringify({
              from: `TrussCTR <${fromEmail}>`,
              to: [alertEmail],
              subject: `${customerName} signed the Completion Certificate`,
              html: alertHtml,
            }),
          });
        }
      }
    } catch (emailErr) {
      console.warn('Contractor certificate notification email failed (non-fatal):', emailErr);
    }

    // Auto-send fully-signed certificate to homeowner when contractor sig is already present
    if ((quote as any).contractor_signature_data) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const appUrl = APP_URL;
        await fetch(`${supabaseUrl}/functions/v1/send-completion-certificate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
          },
          body: JSON.stringify({
            quote_id: quote.id,
            dashboard_url: appUrl,
            is_signed_copy: true,
          }),
        });
      } catch (autoSendErr) {
        console.warn('Auto-send signed certificate failed (non-fatal):', autoSendErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, signed_at: signedAt }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('sign-certificate error:', msg);
    return new Response(JSON.stringify({ error: 'Unexpected error', details: msg }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

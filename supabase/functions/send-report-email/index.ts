import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import nodemailer from 'npm:nodemailer@6.10.0';


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
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { share_token, pdf_base64, to_email, to_name, photo_count } = await req.json();

    if (!share_token || !pdf_base64) {
      return new Response(JSON.stringify({ error: 'Missing share_token or pdf_base64' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();

    const { data: quote } = await supabase
      .from('quotes')
      .select(`
        id, company_id, quote_number, share_token, contingency_enabled,
        customer:customers(first_name, last_name, email),
        company:companies(
          name, email, phone, logo_url,
          smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password,
          quote_sender_email, quote_sender_name, email_send_mode, connected_mail_provider
        )
      `)
      .eq('share_token', share_token)
      .single();

    if (!quote) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const company = quote.company as any;
    const customer = quote.customer as any;
    const recipientEmail = to_email || customer?.email;
    const recipientName = to_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') || 'Customer';

    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: 'No recipient email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build tracking pixel URL
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const pixelUrl = `${supabaseUrl}/functions/v1/track-report-view?t=${encodeURIComponent(share_token)}`;

    const companyName = company?.name || 'Your Contractor';
    // A report sent with a contingency agreement needs to say so and ask for a
    // signature. This template never looked at the flag, so the agreement was
    // attached to the quote but the customer was only invited to "view" — there
    // was nothing telling them anything needed signing.
    const hasContingency = Boolean((quote as any).contingency_enabled);
    const photoLine = photo_count ? `${photo_count} inspection photo${photo_count !== 1 ? 's' : ''}` : 'inspection photos';

    // Same shared-view URL the quote emails use. The report was attached as a
    // PDF and nothing else, and mail clients — phones especially — often bury
    // attachments behind a tap or hide them entirely, so the recipient had no
    // visible way to open their report.
    const reportUrl = `${APP_URL}/?token=${encodeURIComponent(share_token)}`;

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media print{@page{size:letter portrait;margin:0.5in}body{background:#fff!important}table{page-break-inside:auto}tr{page-break-inside:avoid}}</style></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;">

        <tr>
          <td style="background:#1e3a5f;padding:32px 40px;">
            ${company?.logo_url ? `<img src="${company.logo_url}" height="48" style="display:block;margin-bottom:14px;object-fit:contain;" alt="${companyName}" />` : ''}
            <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#ffffff;">${companyName}</p>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.65);">${hasContingency ? 'Inspection Report &amp; Contingency Agreement' : 'Photo Inspection Report'}</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 40px 24px;">
            <p style="margin:0 0 16px;font-size:16px;color:#111827;">Hello ${recipientName.split(' ')[0] || recipientName},</p>
            <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
              Please find attached your photo inspection report for quote <strong>${quote.quote_number}</strong>.
              The report contains ${photoLine} documenting your property.
            </p>
            ${hasContingency ? `
            <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
              This report also includes an <strong>Insurance Contingency Agreement</strong> for your
              signature. Signing authorizes ${companyName} to work directly with your insurance
              company on your behalf. You are not committing to any out-of-pocket cost — work only
              begins once your claim is approved, and your cost is limited to your deductible.
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Use the button below to review the report and sign the agreement.
            </p>` : `
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              If you have any questions, please don't hesitate to reach out.
            </p>`}

            <!-- Primary action. Table-based button so Outlook renders it. -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
              <tr>
                <td align="center">
                  <a href="${reportUrl}"
                     style="display:inline-block;background:#ff6b35;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 32px;border-radius:10px;">
                    ${hasContingency ? 'Review Report &amp; Sign Agreement →' : 'View Inspection Report'}
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-top:10px;">
                  <p style="margin:0;font-size:12px;color:#6b7280;">
                    Opens in your browser — no app or login needed.
                  </p>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#0284c7;text-transform:uppercase;letter-spacing:0.6px;">Also attached as a PDF</p>
                  <p style="margin:0 0 6px;font-size:14px;color:#0c4a6e;font-weight:600;">📷 Inspection Report — Quote ${quote.quote_number}</p>
                  <p style="margin:0;font-size:12px;color:#0c4a6e;">
                    Trouble with the button? Paste this into your browser:<br />
                    <span style="word-break:break-all;">${reportUrl}</span>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 40px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="border-top:1px solid #e5e7eb;padding-top:20px;font-size:12px;color:#9ca3af;text-align:center;">
                ${companyName}
                ${company?.phone ? ` · ${company.phone}` : ''}
                ${company?.email ? `<br>${company.email}` : ''}
              </td></tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
  <!-- tracking pixel -->
  <img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />
</body>
</html>`;

    const subject = hasContingency
      ? `Inspection Report & Contingency Agreement — Quote ${quote.quote_number} from ${companyName} (signature needed)`
      : `Inspection Report — Quote ${quote.quote_number} from ${companyName}`;
    const filename = `Inspection_Report_${quote.quote_number}.pdf`;

    const useSmtp =
      company?.email_send_mode === 'smtp' &&
      company?.smtp_host && company?.smtp_port &&
      company?.smtp_username && company?.smtp_password;

    let sent = false;
    let emailError: string | null = null;

    if (useSmtp) {
      const provider = company.connected_mail_provider;
      const smtpFromEmail = (provider === 'gmail' || provider === 'outlook')
        ? company.smtp_username
        : (company.quote_sender_email || company.smtp_username);

      const transporter = nodemailer.createTransport({
        host: company.smtp_host,
        port: company.smtp_port || 587,
        secure: company.smtp_secure === true,
        auth: { user: company.smtp_username, pass: company.smtp_password },
        requireTLS: company.smtp_secure !== true,
        tls: { rejectUnauthorized: true },
        connectionTimeout: 10000,
        greetingTimeout: 8000,
        socketTimeout: 15000,
      });

      await transporter.sendMail({
        from: `"${companyName}" <${smtpFromEmail}>`,
        to: recipientEmail,
        subject,
        html,
        attachments: [{ filename, content: pdf_base64, encoding: 'base64' }],
      });
      sent = true;
    } else {
      const resendKey = Deno.env.get('RESEND_API_KEY');
      if (!resendKey) {
        emailError = 'No email provider configured';
      } else {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: `${companyName} <${platformFromEmail}>`,
            reply_to: company?.email || undefined,
            to: [recipientEmail],
            subject,
            html,
            attachments: [{ filename, content: pdf_base64 }],
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (resp.ok) {
          sent = true;
        } else {
          emailError = `Email provider error (${resp.status}): ${await resp.text()}`;
        }
      }
    }

    if (sent) {
      // Record report_sent notification
      await supabase.from('quote_notifications').insert({
        company_id: quote.company_id,
        quote_id: quote.id,
        event_type: 'report_sent',
        message: `Photo report for Quote ${quote.quote_number} was sent to ${recipientName}`,
        actor_name: recipientName,
        actor_email: recipientEmail,
      });
    }

    return new Response(JSON.stringify({ success: sent, email_error: emailError }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-report-email error:', err);
    return new Response(JSON.stringify({ success: false, email_error: String(err) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

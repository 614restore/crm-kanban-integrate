import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import nodemailer from 'npm:nodemailer@6.10.0';


// The verified platform sender every TrussCTR email goes out from (same one the quote emails use).
const platformFromEmail = (() => {
  const v = (Deno.env.get('ALERT_FROM_EMAIL') || '').trim();
  return v.match(/<([^>]+)>/)?.[1] || v || 'scopemgr@614restore.com';
})();
const APP_URL = (Deno.env.get('APP_URL') || 'https://trussctr.614restore.com').replace(/\/$/, '');

// QuoteMGR's send-refund-notice, with ONE correction.
//
// Its company select asked for smtp_from_email and resend_api_key. Neither
// column exists on QuoteMGR's companies table either -- verified against its
// live schema -- so PostgREST errors, companyErr is set, and the function
// returns "Company not found" on every call. It is broken on MGR as it stands.
//
// Both are dropped from the select here. smtp_from_email is replaced by
// quote_sender_email, which is the column every other function in this
// codebase uses for the same purpose, and the Resend key now comes from the
// environment alone -- which is what the original fallback did anyway once the
// missing column resolved to undefined.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RefundPayload {
  company_id: string;
  to_email: string;
  to_name?: string;
  refund_amount: number;
  job_total?: number | null;
  total_paid?: number | null;
  quote_number?: string | null;
  note?: string | null;
}

const getSupabaseAdmin = () => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) throw new Error('Missing Supabase env vars');
  return createClient(url, serviceRoleKey);
};

const fmt = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

const buildRefundHtml = (data: {
  companyName: string;
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
  logoUrl?: string;
  customerName: string;
  customerEmail?: string;
  quoteNumber?: string | null;
  refundAmount: number;
  jobTotal?: number | null;
  totalPaid?: number | null;
  note?: string | null;
  date: string;
}): string => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="background:#312e81;padding:32px 40px;">
            ${data.logoUrl ? `<img src="${data.logoUrl}" height="48" style="display:block;margin-bottom:14px;object-fit:contain;" alt="${data.companyName}" />` : ''}
            <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#ffffff;">${data.companyName}</p>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.65);">Refund Notice &nbsp;·&nbsp; ${data.date}</p>
          </td>
        </tr>

        <!-- Customer row -->
        <tr>
          <td style="padding:28px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:top;">
                  <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.6px;">Issued To</p>
                  <p style="margin:0 0 2px;font-size:16px;font-weight:700;color:#111827;">${data.customerName}</p>
                  ${data.customerEmail ? `<p style="margin:0;font-size:13px;color:#6b7280;">${data.customerEmail}</p>` : ''}
                </td>
                ${data.quoteNumber ? `
                <td style="vertical-align:top;text-align:right;white-space:nowrap;padding-left:24px;">
                  <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.6px;">Quote</p>
                  <p style="margin:0;font-size:14px;color:#374151;font-weight:600;">${data.quoteNumber}</p>
                </td>` : ''}
              </tr>
            </table>
          </td>
        </tr>

        <!-- Refund amount (prominent) -->
        <tr>
          <td style="padding:28px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#ede9fe;border:2px solid #a78bfa;border-radius:14px;">
              <tr>
                <td style="padding:24px 28px;text-align:center;">
                  <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;">Refund Amount</p>
                  <p style="margin:0;font-size:48px;font-weight:900;color:#312e81;line-height:1;">${fmt(data.refundAmount)}</p>
                  <p style="margin:8px 0 0;font-size:13px;color:#6d28d9;">A refund of this amount has been issued to you.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Breakdown table -->
        ${(data.jobTotal != null || data.totalPaid != null) ? `
        <tr>
          <td style="padding:24px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
              ${data.jobTotal != null ? `
              <tr>
                <td style="padding:13px 16px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;">Job Total</td>
                <td style="padding:13px 16px;font-size:13px;color:#374151;text-align:right;white-space:nowrap;border-bottom:1px solid #f3f4f6;">${fmt(data.jobTotal)}</td>
              </tr>` : ''}
              ${data.totalPaid != null ? `
              <tr>
                <td style="padding:13px 16px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;">Total Paid</td>
                <td style="padding:13px 16px;font-size:13px;color:#059669;font-weight:600;text-align:right;white-space:nowrap;border-bottom:1px solid #f3f4f6;">${fmt(data.totalPaid)}</td>
              </tr>` : ''}
              <tr style="background:#f5f3ff;">
                <td style="padding:14px 16px;font-size:14px;font-weight:700;color:#312e81;">Refund Owed</td>
                <td style="padding:14px 16px;font-size:16px;font-weight:800;color:#312e81;text-align:right;white-space:nowrap;">${fmt(data.refundAmount)}</td>
              </tr>
            </table>
          </td>
        </tr>` : ''}

        <!-- Note -->
        ${data.note ? `
        <tr>
          <td style="padding:20px 40px 0;">
            <div style="background:#f9fafb;border-left:4px solid #a78bfa;border-radius:6px;padding:14px 16px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#6d28d9;text-transform:uppercase;letter-spacing:0.6px;">Note</p>
              <p style="margin:0;font-size:14px;color:#374151;line-height:1.5;">${data.note}</p>
            </div>
          </td>
        </tr>` : ''}

        <!-- Footer -->
        <tr>
          <td style="padding:32px 40px;border-top:1px solid #f3f4f6;margin-top:24px;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#374151;">${data.companyName}</p>
            ${data.companyPhone ? `<p style="margin:0 0 2px;font-size:12px;color:#6b7280;">${data.companyPhone}</p>` : ''}
            ${data.companyEmail ? `<p style="margin:0 0 2px;font-size:12px;color:#6b7280;">${data.companyEmail}</p>` : ''}
            ${data.companyAddress ? `<p style="margin:0;font-size:12px;color:#6b7280;">${data.companyAddress}</p>` : ''}
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload: RefundPayload = await req.json();
    const { company_id, to_email, to_name, refund_amount, job_total, total_paid, quote_number, note } = payload;

    if (!company_id || !to_email || !refund_amount) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();

    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .select('name, phone, email, address, logo_url, smtp_host, smtp_port, smtp_username, smtp_password, quote_sender_email, email_send_mode, connected_mail_provider')
      .eq('id', company_id)
      .single();

    if (companyErr || !company) throw new Error('Company not found');

    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const customerName = to_name ?? to_email;

    const html = buildRefundHtml({
      companyName: company.name,
      companyPhone: company.phone ?? undefined,
      companyEmail: company.email ?? undefined,
      companyAddress: company.address ?? undefined,
      logoUrl: company.logo_url ?? undefined,
      customerName,
      customerEmail: to_email,
      quoteNumber: quote_number ?? null,
      refundAmount: refund_amount,
      jobTotal: job_total ?? null,
      totalPaid: total_paid ?? null,
      note: note ?? null,
      date,
    });

    const subject = `Refund Notice — ${fmt(refund_amount)} from ${company.name}`;

    const useSmtp = company.email_send_mode === 'smtp'
      && company.smtp_host && company.smtp_port
      && company.smtp_username && company.smtp_password;

    if (useSmtp) {
      const provider = company.connected_mail_provider;
      const smtpFromEmail = (provider === 'gmail' || provider === 'outlook')
        ? company.smtp_username
        : (company.quote_sender_email || company.smtp_username);

      const transporter = nodemailer.createTransport({
        host: company.smtp_host,
        port: Number(company.smtp_port),
        secure: Number(company.smtp_port) === 465,
        requireTLS: Number(company.smtp_port) === 587,
        auth: { user: company.smtp_username, pass: company.smtp_password },
        tls: { rejectUnauthorized: true },
        connectionTimeout: 10000,
        greetingTimeout: 8000,
        socketTimeout: 15000,
      });

      await transporter.sendMail({
        from: `"${company.name}" <${smtpFromEmail}>`,
        to: to_email,
        subject,
        html,
        envelope: { from: smtpFromEmail, to: to_email },
      });
    } else {
      const resendKey = Deno.env.get('RESEND_API_KEY');
      if (!resendKey) throw new Error('No email provider configured');

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: platformFromEmail,
          to: [to_email],
          subject,
          html,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Resend error: ${errText}`);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('send-refund-notice error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

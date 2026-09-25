// Copied from QuoteMGR supabase/functions/send-invoice-email (read-only reference).
// TrussCTR changes:
//  - The caller must be signed in and belong to company_id. QuoteMGR's version sends
//    through whichever company's SMTP account the request names, and the public anon
//    key passes verify_jwt, so anyone could send mail as any company.
//  - is_receipt sends the same email worded as a paid-in-full receipt. QuoteMGR's
//    detail view already sends is_receipt, but its function ignored it.
//  - Payload text is HTML-escaped before it goes into the email, and header fields
//    are stripped of line breaks and angle brackets.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import nodemailer from 'npm:nodemailer@6.10.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LineItemPayload {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface SendInvoicePayload {
  to_email: string;
  to_name?: string;
  from_company?: string;
  invoice_number: string;
  invoice_total: number;
  due_date?: string;
  payment_instructions?: string;
  line_items?: LineItemPayload[];
  company_id?: string;
  is_receipt?: boolean;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const getSupabaseAdmin = () => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) throw new Error('Missing Supabase env vars');
  return createClient(url, serviceRoleKey);
};

const escapeHtml = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const headerSafe = (v: unknown) => String(v ?? '').replace(/[\r\n<>"]/g, ' ').trim();

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(val) || 0);

const buildInvoiceHtml = (payload: SendInvoicePayload): string => {
  const lineItemsHtml = (payload.line_items || []).map((item) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#374151;">${escapeHtml(item.description)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#374151;text-align:center;">${escapeHtml(item.quantity)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#374151;text-align:right;">${formatCurrency(item.unit_price)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#374151;font-weight:600;text-align:right;">${formatCurrency(item.total)}</td>
    </tr>
  `).join('');

  const dueDate = payload.due_date ? new Date(payload.due_date) : null;
  const dueLine = dueDate && !isNaN(dueDate.getTime())
    ? `Payment is due by <strong>${dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.`
    : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media print{@page{size:letter portrait;margin:0.5in}body{background:#fff!important}table{page-break-inside:auto}tr{page-break-inside:avoid}}</style></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e3a5f,#2d5a8e);padding:32px 40px;color:#fff;">
      <h1 style="margin:0 0 4px;font-size:26px;font-weight:700;">${escapeHtml(payload.from_company || 'Invoice')}</h1>
      <p style="margin:0;opacity:0.8;font-size:14px;">${payload.is_receipt ? 'Receipt' : 'Invoice'} #${escapeHtml(payload.invoice_number)}</p>
    </div>

    <div style="padding:32px 40px;">
      <p style="color:#374151;font-size:16px;margin:0 0 24px;">
        Hi ${escapeHtml(payload.to_name || 'there')},<br><br>
        ${payload.is_receipt ? 'Thank you — this invoice has been paid in full. Your receipt is below.' : `Please find your invoice details below. ${dueLine}`}
      </p>

      ${lineItemsHtml ? `
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Description</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Unit Price</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Total</th>
          </tr>
        </thead>
        <tbody>${lineItemsHtml}</tbody>
      </table>
      ` : ''}

      <div style="background:#1e3a5f;border-radius:12px;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <span style="color:#fff;font-weight:600;font-size:16px;">${payload.is_receipt ? 'Total Paid' : 'Total Amount Due'}</span>
        <span style="color:#fff;font-weight:700;font-size:24px;">${formatCurrency(payload.invoice_total)}</span>
      </div>

      ${payload.payment_instructions ? `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#15803d;">Payment Instructions</p>
        <p style="margin:0;font-size:14px;color:#166534;white-space:pre-line;">${escapeHtml(payload.payment_instructions)}</p>
      </div>
      ` : ''}

      <p style="color:#6b7280;font-size:14px;margin:0;">
        Thank you for your business. If you have any questions about this invoice, please don't hesitate to contact us.
      </p>
    </div>

    <div style="background:#f9fafb;border-top:1px solid #f0f0f0;padding:20px 40px;text-align:center;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">${escapeHtml(payload.from_company || '')}</p>
    </div>
  </div>
</body>
</html>`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json() as SendInvoicePayload;

    if (!payload.to_email || !payload.invoice_number || !payload.company_id) {
      return json({ error: 'Missing required fields' }, 400);
    }

    // The signed-in caller must belong to the company whose mail account is used.
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Not signed in' }, 401);

    const { data: ids } = await userClient.rpc('get_my_company_ids');
    const myCompanyIds = (Array.isArray(ids) ? ids : [ids])
      .map((r: any) => (r && typeof r === 'object' ? Object.values(r)[0] : r))
      .filter(Boolean);
    if (!myCompanyIds.includes(payload.company_id)) {
      return json({ error: 'You do not have access to this company' }, 403);
    }

    let fromEmail = 'noreply@quotemgr.app';
    let fromName = headerSafe(payload.from_company) || 'TrussCTR';
    let transporter: any;

    try {
      const { data: company } = await getSupabaseAdmin()
        .from('companies')
        .select('smtp_host,smtp_port,smtp_secure,smtp_username,smtp_password,quote_sender_email,quote_sender_name')
        .eq('id', payload.company_id)
        .maybeSingle();

      if (company?.smtp_host && company?.smtp_username && company?.smtp_password) {
        transporter = nodemailer.createTransport({
          host: company.smtp_host,
          port: company.smtp_port || 587,
          secure: company.smtp_secure || false,
          auth: { user: company.smtp_username, pass: company.smtp_password },
        });
        fromEmail = company.quote_sender_email || company.smtp_username;
        fromName = headerSafe(company.quote_sender_name) || fromName;
      }
    } catch {
      // Fall through to the shared sender
    }

    if (!transporter) {
      const smtpHost = Deno.env.get('SMTP_HOST');
      const smtpUser = Deno.env.get('SMTP_USER');
      const smtpPass = Deno.env.get('SMTP_PASS');

      if (!smtpHost || !smtpUser || !smtpPass) {
        return json({ error: 'Email service not configured. Add your SMTP settings in Settings, or set SMTP_HOST, SMTP_USER and SMTP_PASS for this project.' }, 500);
      }

      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(Deno.env.get('SMTP_PORT') || '587'),
        secure: Deno.env.get('SMTP_SECURE') === 'true',
        auth: { user: smtpUser, pass: smtpPass },
      });
      fromEmail = Deno.env.get('SMTP_FROM') || smtpUser;
    }

    const toName = headerSafe(payload.to_name);
    const toEmail = headerSafe(payload.to_email);
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: toName ? `"${toName}" <${toEmail}>` : toEmail,
      subject: `${payload.is_receipt ? 'Receipt' : 'Invoice'} #${headerSafe(payload.invoice_number)} from ${headerSafe(payload.from_company) || 'Your Contractor'}`,
      html: buildInvoiceHtml(payload),
      // Replies go to the signed-in person who sent it, not the delivery address.
      ...(user.email ? { replyTo: headerSafe(user.email) } : {}),
    });

    return json({ success: true });
  } catch (err: any) {
    console.error('send-invoice-email error:', err);
    return json({ error: err.message }, 500);
  }
});

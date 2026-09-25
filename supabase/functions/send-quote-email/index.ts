// Copied from QuoteMGR's send-quote-email (v60, read-only reference) for
// TrussCTR. Changes: dashboard link, fallback sender name and footer say
// TrussCTR instead of QuoteMGR.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import nodemailer from 'npm:nodemailer@6.10.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SendQuotePayload = {
  company_id?: string;
  to_email: string;
  to_name?: string;
  from_company?: string;
  from_name?: string;
  from_email?: string;
  reply_to_email?: string;
  bcc_email?: string;
  /** Customer-facing calls pass this instead of a JWT to prove the request
   *  is tied to a real quote (financing interest, service request notifications) */
  share_token?: string;
  bcc_customer_name?: string;  // customer name shown in the contractor's copy
  dashboard_url?: string;      // contractor's dashboard link (no share token)
  cc_emails?: string[];        // additional recipients — get the email but NOT signed/viewed alerts
  quote_number?: string;
  quote_url?: string;
  certificate_url?: string;    // when set, adds a "Sign Completion Certificate" button and suppresses the proposal button
  quote_type?: string;          // 'inspection_report' → contingency CTA label; completion cert handled via certificate_url
  quote_total?: number;
  project_description?: string;
  email_subject?: string;
  email_message?: string;
  /** Optional base64-encoded PDF to attach (e.g. signed contingency agreement). */
  pdf_base64?: string;
  pdf_filename?: string;
};

// Resend tags only allow ASCII letters, numbers, underscores, dashes
const sanitizeTagValue = (val: string) => val.replace(/[^A-Za-z0-9_-]/g, '_').substring(0, 256);

type CompanyMailSettings = {
  id: string;
  name: string;
  quote_sender_name?: string | null;
  quote_sender_email?: string | null;
  quote_reply_to_email?: string | null;
  email_send_mode?: 'shared' | 'smtp' | null;
  connected_mail_provider?: 'gmail' | 'outlook' | 'custom' | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_secure?: boolean | null;
  smtp_username?: string | null;
  smtp_password?: string | null;
};

const getEmailDomain = (email?: string | null) => {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return null;
  return normalized.split('@').pop() || null;
};

const parseAllowedDomains = (value?: string | null) =>
  (value || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

const buildFromHeader = (name: string, email: string) => {
  const trimmedName = name.trim();
  return trimmedName ? `${trimmedName} <${email}>` : email;
};

const normalizeEmail = (email?: string | null) => email?.trim().toLowerCase() || '';

const getSupabaseAdmin = () => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const loadCompanyMailSettings = async (companyId?: string): Promise<CompanyMailSettings | null> => {
  if (!companyId) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('companies')
    .select('id, name, quote_sender_name, quote_sender_email, quote_reply_to_email, email_send_mode, connected_mail_provider, smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password')
    .eq('id', companyId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as CompanyMailSettings;
};

function extractShareToken(quoteUrl?: string): string | null {
  if (!quoteUrl) return null;
  try {
    const url = new URL(quoteUrl);
    return url.searchParams.get('token');
  } catch {
    const match = quoteUrl.match(/token=([^&]+)/);
    return match ? match[1] : null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SendQuotePayload;

    if (!body.to_email) {
      return new Response(JSON.stringify({ error: 'Missing to_email' }), { status: 400, headers: corsHeaders });
    }

    // ── Auth gate ────────────────────────────────────────────────────────────
    // Accept either:
    //   (a) A valid Supabase session JWT in Authorization: Bearer <token>
    //       — used by authenticated staff when sending quotes from the dashboard
    //   (b) A valid share_token in the body that matches a real quote
    //       — used by customer-facing views (financing interest, service requests)
    //       where there is no auth session
    // Reject everything else so the function can't be abused for spam.
    const admin = getSupabaseAdmin();
    let authorized = false;
    // The signed-in staff member sending this, so replies come back to them and not to
    // the platform address the mail is delivered from.
    let senderUserEmail: string | undefined;

    const authHeader = req.headers.get('authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (bearerToken && admin) {
      // Try validating as a real Supabase user JWT (not just the anon key)
      const { data: { user } } = await admin.auth.getUser(bearerToken);
      if (user) {
        // Confirm caller is an active team member
        const { data: member } = await admin
          .from('team_members')
          .select('id, email')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();
        if (member) {
          authorized = true;
          senderUserEmail = normalizeEmail((member as { email?: string | null }).email) || normalizeEmail(user.email) || undefined;
        }
      }
    }

    const payloadShareToken = body.share_token || extractShareToken(body.quote_url || undefined);

    // Also used to decide whether this is an inspection report, and whether
    // it actually carries a contingency agreement / completion certificate —
    // see isInspection/hasContingency below. Selected here so the lookup is
    // not repeated and callers never need to pass these flags themselves.
    let resolvedProjectType: string | null = null;
    let resolvedContingencyEnabled = false;
    let resolvedQuoteId: string | null = null;

    if (payloadShareToken && admin) {
      const { data: quote } = await admin
        .from('quotes')
        .select('id, project_type, contingency_enabled')
        .eq('share_token', payloadShareToken)
        .maybeSingle();
      if (quote) {
        // Customer-facing path: a valid share_token authorises the send.
        authorized = true;
        const q = quote as { id?: string; project_type?: string | null; contingency_enabled?: boolean | null };
        resolvedQuoteId = q.id ?? null;
        resolvedProjectType = q.project_type ?? null;
        resolvedContingencyEnabled = q.contingency_enabled === true;
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    // ── End auth gate ────────────────────────────────────────────────────────

    const companyMailSettings = await loadCompanyMailSettings(body.company_id);
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const defaultFromEmail = Deno.env.get('ALERT_FROM_EMAIL');
    if (!defaultFromEmail) {
      return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY or ALERT_FROM_EMAIL' }), { status: 500, headers: corsHeaders });
    }

    const fallbackFromName = body.from_company?.trim() || companyMailSettings?.name?.trim() || 'TrussCTR';
    const senderName =
      body.from_name?.trim() ||
      companyMailSettings?.quote_sender_name?.trim() ||
      fallbackFromName;
    const requestedFromEmail =
      normalizeEmail(body.from_email) ||
      normalizeEmail(companyMailSettings?.quote_sender_email);
    // Replies go to whoever is signed in and sending. Only when there is no signed-in
    // sender (a customer-facing send authorised by a share link) does it fall back to
    // what the caller asked for, then the company's reply-to, then its sender address.
    const replyToEmail =
      senderUserEmail ||
      body.reply_to_email?.trim() ||
      companyMailSettings?.quote_reply_to_email?.trim() ||
      requestedFromEmail ||
      undefined;
    // When a reply domain is configured (INBOUND_REPLY_DOMAIN), a staff send sets the
    // Reply-To header to this quote's own reply address, so the customer's answer is
    // filed in their Notes by receive-email-reply, which also forwards a copy to the rep.
    // The footer and the rep's copy still show the rep's real email.
    const inboundDomain = (Deno.env.get('INBOUND_REPLY_DOMAIN') || '').trim().toLowerCase();
    const replyToHeader =
      inboundDomain && senderUserEmail && resolvedQuoteId
        ? `reply+${resolvedQuoteId}@${inboundDomain}`
        : replyToEmail;
    const bccEmail =
      body.bcc_email?.trim() ||
      replyToEmail ||
      requestedFromEmail ||
      undefined;
    // An inspection report is not a proposal, and calling it one in the subject,
    // the body and the footer left the customer being asked to review and sign
    // a proposal they were never sent.
    //
    // Derived from the quote rather than trusting body.quote_type: no caller
    // has ever sent that field — all twelve omit it — so the branch that
    // depended on it never once fired, including the CTA label written for it.
    // Looking it up here means the wording is right no matter who calls.
    const isInspection =
      body.quote_type === 'inspection_report' || resolvedProjectType === 'inspection_report';
    // Same reasoning as isInspection above: a plain inspection report (neither
    // a contingency agreement nor a completion certificate selected) was being
    // unconditionally labeled/CTA'd as "Contingency" just because it was an
    // inspection report, regardless of whether contingency was ever enabled.
    const hasContingency = resolvedContingencyEnabled;
    const docLabel = isInspection ? 'inspection report' : 'proposal';
    const docLabelTitle = isInspection ? 'Inspection Report' : 'Proposal';

    const subject = body.email_subject?.trim() || `Your ${docLabel} from ${fallbackFromName} — Quote #${body.quote_number || ''}`.trim();
    const token = extractShareToken(body.quote_url || undefined);

    // Plain-text version — improves deliverability and spam scoring
    const plainText = [
      subject,
      '',
      body.email_message?.trim() || `Please review your ${docLabel} from ${fallbackFromName}.`,
      '',
      body.quote_url ? `View your ${docLabel}: ${body.quote_url}` : '',
      '',
      body.certificate_url ? `Sign Completion Certificate: ${body.certificate_url}` : '',
      '',
      body.quote_total != null
        ? `Total: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(body.quote_total)}`
        : '',
      '',
      isInspection
        ? 'No account required — just click the link above to review your report.'
        : 'No account required — just click the link above to review and sign.',
      '',
      fallbackFromName,
    ].filter(line => line !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim();

    // CC recipients get a separate email with ?preview=1 appended so opening
    // their copy never flips the quote status to "viewed".
    const ccPreviewUrl = body.quote_url
      ? body.quote_url + (body.quote_url.includes('?') ? '&preview=1' : '?preview=1')
      : null;

    // Convert plain-text custom message lines to <p> tags
    const customMessageHtml = body.email_message?.trim()
      ? body.email_message.trim().split(/\n+/).map(line => `<p style="margin:0 0 10px">${line}</p>`).join('')
      : null;

    // The app's default message already opens with "Hi <first name>,". Only add the
    // template's own "Hello <name>," when the message does not greet the customer
    // itself, so they are not greeted twice.
    const messageHasGreeting = /^\s*(hi|hello|hey|dear|good\s+(morning|afternoon|evening))\b/i.test(body.email_message ?? '');

    const companyName = body.from_company || fallbackFromName;

    // Internal copy sent to the contractor — does NOT include the share token link
    // so that clicking it cannot accidentally flip the quote status to "viewed".
    const customerDisplayName = body.bcc_customer_name || body.to_name || body.to_email;
    const dashboardLink = body.dashboard_url || 'https://trussctr.614restore.com';
    const formattedTotal = body.quote_total != null
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(body.quote_total)
      : null;
    const bccHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#222;background:#f4f4f4;margin:0;padding:0">
  <table width="100%" bgcolor="#f4f4f4" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 20px 0">
        <table width="100%" style="max-width:600px" bgcolor="#ffffff" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:#1e3a5f; padding:24px 32px; border-radius:8px 8px 0 0">
              <p style="margin:0 0 4px;color:#93c5fd;font-size:12px;text-transform:uppercase;letter-spacing:1px">Sent Confirmation — Your Copy</p>
              <h2 style="margin:0;color:white;font-size:20px">${companyName}</h2>
            </td>
          </tr>
          <tr>
            <td style="background:#f9f9f9; padding:28px 32px; border-radius:0 0 8px 8px; border:1px solid #e5e7eb; border-top:none">
              <p style="margin:0 0 20px;font-size:15px">
                ✅ Quote <strong>#${body.quote_number || ''}</strong> was successfully sent to <strong>${customerDisplayName}</strong> (${body.to_email}).
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:20px">
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #f3f4f6">
                    <span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Customer</span><br>
                    <span style="font-size:15px;font-weight:600;color:#111">${customerDisplayName}</span>
                    <span style="font-size:13px;color:#6b7280"> · ${body.to_email}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #f3f4f6">
                    <span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Quote Number</span><br>
                    <span style="font-size:15px;font-weight:600;color:#111">${body.quote_number || '—'}</span>
                  </td>
                </tr>
                ${formattedTotal ? `<tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #f3f4f6">
                    <span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Quote Total</span><br>
                    <span style="font-size:15px;font-weight:600;color:#111">${formattedTotal}</span>
                  </td>
                </tr>` : ''}
                ${body.project_description ? `<tr>
                  <td style="padding:14px 18px">
                    <span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Project</span><br>
                    <span style="font-size:14px;color:#374151">${body.project_description}</span>
                  </td>
                </tr>` : ''}
              </table>

              <div style="margin:24px 0;text-align:center">
                <a href="${dashboardLink}" style="background:#1e3a5f;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">
                  View in Dashboard →
                </a>
              </div>

              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-align:center">
                This is your internal copy. The link above goes to your dashboard — it will not mark the quote as viewed by the customer.
              </p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
              <p style="margin:0;font-size:12px;color:#6b7280">${companyName} | Quote #${body.quote_number || ''}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const formattedQuoteTotal = body.quote_total != null
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(body.quote_total)
      : null;

    // CTA label for the primary quote button — changes based on document type.
    // "Sign Contingency" only belongs here when a contingency agreement is
    // actually part of this report; a plain inspection report (neither
    // contingency nor completion certificate selected) just reviews.
    const ctaLabel = isInspection
      ? (hasContingency ? 'Review Inspection &amp; Sign Contingency →' : 'Review Inspection Report →')
      : 'Review &amp; Sign Proposal →';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your ${docLabelTitle} from ${companyName}</title>
  <style>
    body { margin:0; padding:0; background:#f3f4f6; }
    @media (max-width: 600px) {
      .email-wrapper { padding: 12px !important; }
      .email-body { padding: 24px 20px !important; }
      .email-btn { display: block !important; text-align: center !important; width: 100% !important; box-sizing: border-box !important; }
      .detail-row td { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;background:#f3f4f6;margin:0;padding:0">
  <table width="100%" bgcolor="#f3f4f6" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td class="email-wrapper" align="center" style="padding:32px 16px">
        <table width="100%" style="max-width:600px" cellpadding="0" cellspacing="0" border="0">

          <!-- Header -->
          <tr>
            <td style="background:#1e3a5f;padding:28px 36px;border-radius:10px 10px 0 0">
              <h1 style="margin:0 0 4px;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px">${companyName}</h1>
              <p style="margin:0;color:#93c5fd;font-size:13px;text-transform:uppercase;letter-spacing:1px">${isInspection ? 'Inspection Report' : 'Project Proposal'}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="email-body" style="background:#ffffff;padding:32px 36px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">

              ${messageHasGreeting ? '' : `<p style="margin:0 0 20px;font-size:15px;color:#374151">Hello ${body.to_name || 'there'},</p>`}

              ${customMessageHtml
                ? `<div style="margin:0 0 20px;font-size:15px;color:#374151">${customMessageHtml}</div>`
                : `<p style="margin:0 0 20px;font-size:15px;color:#374151">
                    ${isInspection
                      ? 'Thank you for the opportunity to inspect your property. Your inspection report is ready — you can view the findings and photos using the button below.'
                      : 'Thank you for the opportunity to work with you. Your proposal is ready for review — you can view full pricing, scope details, and sign online using the button below.'}
                   </p>`
              }

              <!-- Quote detail card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:0 0 28px">
                ${body.quote_number ? `
                <tr>
                  <td style="padding:13px 18px;border-bottom:1px solid #f3f4f6">
                    <span style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:2px">Quote Number</span>
                    <span style="font-size:15px;font-weight:700;color:#111827">#${body.quote_number}</span>
                  </td>
                </tr>` : ''}
                ${body.project_description ? `
                <tr>
                  <td style="padding:13px 18px;border-bottom:1px solid #f3f4f6">
                    <span style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:2px">Project</span>
                    <span style="font-size:15px;color:#111827">${body.project_description}</span>
                  </td>
                </tr>` : ''}
                ${formattedQuoteTotal ? `
                <tr>
                  <td style="padding:13px 18px">
                    <span style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:2px">Estimated Total</span>
                    <span style="font-size:18px;font-weight:700;color:#1e3a5f">${formattedQuoteTotal}</span>
                  </td>
                </tr>` : ''}
              </table>

              <!-- CTA button — hidden when a certificate_url is present (cert gets its own button below) -->
              ${!body.certificate_url && body.quote_url ? `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px">
                <tr>
                  <td align="center">
                    <a class="email-btn" href="${body.quote_url}"
                       style="background:#ff6b35;color:#ffffff;padding:15px 36px;border-radius:7px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;letter-spacing:-0.2px">
                      ${ctaLabel}
                    </a>
                    <p style="margin:10px 0 0;font-size:12px;color:#9ca3af">
                      Secure link · No account required
                    </p>
                  </td>
                </tr>
              </table>` : ''}

              <!-- Secondary CTA: skip straight to signing the completion certificate -->
              ${body.certificate_url ? `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px">
                <tr>
                  <td align="center">
                    <a class="email-btn" href="${body.certificate_url}"
                       style="background:#d97706;color:#ffffff;padding:13px 32px;border-radius:7px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;letter-spacing:-0.2px">
                      Sign Completion Certificate →
                    </a>
                    <p style="margin:8px 0 0;font-size:12px;color:#9ca3af">
                      Don't need to review everything? Sign the certificate directly.
                    </p>
                  </td>
                </tr>
              </table>` : ''}

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px">

              <!-- Contact info -->
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;font-weight:600">Questions? Reach out directly:</p>
              <p style="margin:0;font-size:13px;color:#374151">
                <strong>${companyName}</strong><br>
                ${replyToEmail ? `<a href="mailto:${replyToEmail}" style="color:#1e3a5f;text-decoration:none">${replyToEmail}</a>` : ''}
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:16px 36px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px">
              <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;line-height:1.8">
                This ${docLabel} was sent by <strong>${companyName}</strong> via TrussCTR.<br>
                If you were not expecting this email, you can safely ignore it.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Build CC version of the email: same HTML but with ?preview=1 in the CTA link
    // so opening it never flips the quote status to "viewed".
    const ccHtml = (body.quote_url && ccPreviewUrl)
      ? html.replace(new RegExp(body.quote_url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ccPreviewUrl)
      : html;

    if (
      companyMailSettings?.email_send_mode === 'smtp' &&
      companyMailSettings.smtp_host &&
      companyMailSettings.smtp_port &&
      companyMailSettings.smtp_username &&
      companyMailSettings.smtp_password
    ) {
      const smtpUsername = normalizeEmail(companyMailSettings.smtp_username);
      const provider = companyMailSettings.connected_mail_provider;
      const smtpFromEmail =
        provider === 'gmail' || provider === 'outlook'
          ? smtpUsername
          : requestedFromEmail || smtpUsername;
      const effectiveReplyTo = replyToHeader || requestedFromEmail || smtpUsername || undefined;
      const transporter = nodemailer.createTransport({
        host: companyMailSettings.smtp_host,
        port: companyMailSettings.smtp_port,
        secure: companyMailSettings.smtp_secure === true,
        auth: {
          user: companyMailSettings.smtp_username,
          pass: companyMailSettings.smtp_password,
        },
        requireTLS: companyMailSettings.smtp_secure !== true,
        tls: {
          // Allow STARTTLS upgrade on port 587 (rejectUnauthorized true by default)
          rejectUnauthorized: true,
        },
      });

      // nodemailer attachment shape — reused for the customer send and the
      // rep's own "[Your copy]" BCC, which previously dropped the PDF
      // entirely even when one was supplied.
      const smtpAttachments = body.pdf_base64
        ? [{ filename: body.pdf_filename || 'contingency-agreement.pdf', content: body.pdf_base64, encoding: 'base64' as const }]
        : undefined;

      try {
        // Send customer email (no cc: field — CC recipients get their own email below)
        await transporter.sendMail({
          from: buildFromHeader(senderName, smtpFromEmail),
          to: body.to_email,
          replyTo: effectiveReplyTo,
          envelope: { from: smtpFromEmail, to: [body.to_email] },
          subject,
          text: plainText,
          html,
          attachments: smtpAttachments,
        });

        // Send each CC recipient their own copy with ?preview=1 in the link so
        // opening it never flips the quote status to "viewed".
        if (body.cc_emails?.length) {
          for (const ccAddr of body.cc_emails) {
            await transporter.sendMail({
              from: buildFromHeader(senderName, smtpFromEmail),
              to: ccAddr,
              replyTo: effectiveReplyTo,
              envelope: { from: smtpFromEmail, to: [ccAddr] },
              subject: `[CC] ${subject}`,
              html: ccHtml,
              attachments: smtpAttachments,
            });
          }
        }

        // Send separate internal BCC without the token link so opening it
        // cannot accidentally flip the quote status to "viewed".
        if (bccEmail) {
          await transporter.sendMail({
            from: buildFromHeader(senderName, smtpFromEmail),
            to: bccEmail,
            replyTo: effectiveReplyTo,
            envelope: { from: smtpFromEmail, to: [bccEmail] },
            subject: `[Your copy] ${subject}`,
            html: bccHtml,
            attachments: smtpAttachments,
          });
        }

        return new Response(JSON.stringify({ ok: true, provider: 'smtp' }), { status: 200, headers: corsHeaders });
      } catch (smtpErr) {
        const smtpMsg = smtpErr instanceof Error ? smtpErr.message : String(smtpErr);
        console.error('SMTP send failed:', smtpMsg);
        return new Response(
          JSON.stringify({ error: 'SMTP send failed', details: smtpMsg }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY' }), { status: 500, headers: corsHeaders });
    }

    const defaultFromDomain = getEmailDomain(defaultFromEmail);
    const configuredDomains = parseAllowedDomains(Deno.env.get('RESEND_FROM_DOMAINS'));
    const allowedFromDomains = configuredDomains.length
      ? configuredDomains
      : defaultFromDomain
        ? [defaultFromDomain]
        : [];
    const requestedFromDomain = getEmailDomain(requestedFromEmail);
    const canUseRequestedFrom =
      Boolean(requestedFromEmail) &&
      Boolean(requestedFromDomain) &&
      allowedFromDomains.includes(requestedFromDomain as string);
    const fromHeader = canUseRequestedFrom && requestedFromEmail
      ? buildFromHeader(senderName, requestedFromEmail)
      : buildFromHeader(senderName, defaultFromEmail);

    const tags = [
      token ? { name: 'quote_token', value: sanitizeTagValue(token) } : null,
      body.quote_number ? { name: 'quote_number', value: sanitizeTagValue(body.quote_number) } : null,
    ].filter(Boolean);

    // List-Unsubscribe header is required by Gmail and Yahoo for any
    // commercial/transactional email sent at scale (mandatory since Feb 2024).
    // The mailto: variant is the minimum — a one-click URL is ideal but
    // requires a dedicated unsubscribe endpoint.
    // Must use the sending domain address for List-Unsubscribe — using a gmail.com
    // address here causes a domain mismatch warning that triggers spam filters.
    const listUnsubscribeHeader = `<mailto:${defaultFromEmail}?subject=Unsubscribe>`;

    // Send the customer-facing email (no cc: field — CC recipients get their own email below).
    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromHeader,
        to: [body.to_email],
        reply_to: replyToHeader,
        subject,
        html,
        text: plainText,
        tags,
        headers: {
          'List-Unsubscribe': listUnsubscribeHeader,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'X-Entity-Ref-ID': token || body.quote_number || '',
        },
        ...(body.pdf_base64 ? {
          attachments: [{
            filename: body.pdf_filename || 'contingency-agreement.pdf',
            content: body.pdf_base64,
          }],
        } : {}),
      }),
    });

    // Reused below for the CC and "[Your copy]" BCC sends, which previously
    // dropped the PDF entirely even when one was supplied to the customer send.
    const resendAttachments = body.pdf_base64
      ? [{ filename: body.pdf_filename || 'contingency-agreement.pdf', content: body.pdf_base64 }]
      : undefined;

    if (!resendResp.ok) {
      const text = await resendResp.text();
      return new Response(JSON.stringify({ error: 'Failed to send', details: text }), { status: 500, headers: corsHeaders });
    }

    // Send each CC recipient their own copy with ?preview=1 in the link so
    // opening it never flips the quote status to "viewed".
    if (body.cc_emails?.length) {
      for (const ccAddr of body.cc_emails) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromHeader,
            to: [ccAddr],
            reply_to: replyToHeader,
            subject: `[CC] ${subject}`,
            html: ccHtml,
            ...(resendAttachments ? { attachments: resendAttachments } : {}),
          }),
        });
      }
    }

    // Send a separate internal confirmation copy to the sender WITHOUT the
    // customer token link.  Keeping BCC on the customer email would cause the
    // sender to accidentally flip the quote to "viewed" whenever they click the
    // preview link in their inbox.
    if (bccEmail) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromHeader,
          to: [bccEmail],
          subject: `[Your copy] ${subject}`,
          html: bccHtml,
          ...(resendAttachments ? { attachments: resendAttachments } : {}),
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('send-quote-email unexpected error:', message);
    return new Response(JSON.stringify({ error: 'Unexpected error', details: message }), { status: 500, headers: corsHeaders });
  }
});

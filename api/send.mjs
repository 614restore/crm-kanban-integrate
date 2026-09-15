// api/send.mjs
// Unified messaging endpoint — replaces send-email.mjs, send-sms.mjs, send-invite.mjs.
//
// Routes by `type` field in the request body:
//   type: 'email'  — send email via company SMTP → company SendGrid → platform Resend
//   type: 'sms'    — send SMS via company's own Twilio account (from company_integrations)
//   type: 'invite' — send team invite email via platform Resend (always platform-level)

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { requireAuth } from './_auth-middleware.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PLATFORM_RESEND_KEY = process.env.RESEND_API_KEY;
const PLATFORM_SENDER = '614 Restore <scopemgr@614restore.com>';

const svcDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── CORS ──────────────────────────────────────────────────────────────────────
function setCors(req, res) {
  const origin = req.headers.origin || '';
  const allowed =
    origin === 'https://crm-kanban-integrate.vercel.app' ||
    origin.endsWith('.vercel.app') ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1');
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : 'https://crm-kanban-integrate.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

// ── Helpers: company lookup ───────────────────────────────────────────────────
async function getCompanyId(userId) {
  const { data } = await svcDb.from('profiles').select('company_id').eq('id', userId).single();
  return data?.company_id || null;
}

async function getCompanyRow(companyId) {
  const { data } = await svcDb
    .from('companies')
    // The shared backend names these smtp_username/smtp_password/quote_sender_*; alias to the names used below.
    .select('smtp_host,smtp_port,smtp_user:smtp_username,smtp_pass:smtp_password,smtp_secure,from_name:quote_sender_name,from_email:quote_sender_email,name')
    .eq('id', companyId)
    .single();
  return data || null;
}

async function getCompanyIntegration(companyId, integrationId) {
  const { data } = await svcDb
    .from('company_integrations')
    .select('credentials')
    .eq('company_id', companyId)
    .eq('integration_id', integrationId)
    .single();
  if (!data?.credentials) return null;
  return typeof data.credentials === 'string' ? JSON.parse(data.credentials) : data.credentials;
}

// ── Email senders ─────────────────────────────────────────────────────────────
async function sendViaSmtp(company, to, subject, html) {
  const transporter = nodemailer.createTransport({
    host: company.smtp_host,
    port: Number(company.smtp_port) || 587,
    secure: Boolean(company.smtp_secure),
    auth: { user: company.smtp_user, pass: company.smtp_pass },
  });
  const fromName = company.from_name || company.name || company.smtp_user;
  const fromAddr = company.from_email || company.smtp_user;
  await transporter.sendMail({
    from: `${fromName} <${fromAddr}>`,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
  });
  return { provider: 'smtp' };
}

async function sendViaSendGrid(apiKey, fromEmail, fromName, to, subject, html) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: Array.isArray(to) ? to.map(e => ({ email: e })) : [{ email: to }] }],
      from: { email: fromEmail, name: fromName },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const err = new Error(body?.errors?.[0]?.message || `SendGrid error ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return { provider: 'sendgrid' };
}

async function sendViaResend(from, to, subject, html) {
  if (!PLATFORM_RESEND_KEY) throw new Error('No email provider configured and RESEND_API_KEY is not set');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PLATFORM_RESEND_KEY}` },
    body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.message || `Resend error ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return { provider: 'resend', ...data };
}

// ── SMS sender ────────────────────────────────────────────────────────────────
function normalisePhone(raw) {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

async function sendViaTwilio(accountSid, authToken, from, to, body) {
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const params = new URLSearchParams({ From: from, To: to, Body: body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || `Twilio error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const user = await requireAuth(req, res);
  if (!user) return;

  const { type = 'email', ...payload } = req.body || {};

  // ── EMAIL ──────────────────────────────────────────────────────────────────
  if (type === 'email') {
    const { to, subject, html } = payload;
    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
    }

    const companyId = await getCompanyId(user.id);
    const company   = companyId ? await getCompanyRow(companyId) : null;

    // 1. Company SMTP
    if (company?.smtp_host && company?.smtp_user && company?.smtp_pass) {
      try {
        const result = await sendViaSmtp(company, to, subject, html);
        return res.status(200).json(result);
      } catch (err) {
        console.warn('[send/email] SMTP failed, trying SendGrid:', err.message);
      }
    }

    // 2. Company SendGrid (from company_integrations)
    if (companyId) {
      const sg = await getCompanyIntegration(companyId, 'sendgrid');
      if (sg?.apiKey && sg?.fromEmail) {
        try {
          const result = await sendViaSendGrid(sg.apiKey, sg.fromEmail, sg.fromName || company?.name || '', to, subject, html);
          return res.status(200).json(result);
        } catch (err) {
          console.warn('[send/email] SendGrid failed, falling back to Resend:', err.message);
        }
      }
    }

    // 3. Platform Resend (fallback)
    const fromName = company?.from_name || company?.name || '614 Restore';
    const fromAddr = company?.from_email || 'scopemgr@614restore.com';
    try {
      const result = await sendViaResend(`${fromName} <${fromAddr}>`, to, subject, html);
      return res.status(200).json(result);
    } catch (error) {
      console.error('[send/email] All providers failed:', error.message);
      return res.status(error?.status || 500).json({ error: error.message });
    }
  }

  // ── SMS ────────────────────────────────────────────────────────────────────
  if (type === 'sms') {
    const { to, body: smsBody, contactId, contacts, message } = payload;

    // Support bulk send (contacts array) or single send (to + body)
    if (contacts && Array.isArray(contacts)) {
      const companyId = await getCompanyId(user.id);
      const twilio = companyId ? await getCompanyIntegration(companyId, 'twilio') : null;

      if (!twilio?.accountSid || !twilio?.authToken || !twilio?.fromNumber) {
        return res.status(503).json({
          error: 'Twilio not configured',
          message: 'Go to Settings → Integrations → Twilio and enter your Account SID, Auth Token, and phone number.',
        });
      }

      const from = normalisePhone(twilio.fromNumber);
      const results = [];

      for (const contact of contacts) {
        const toNum = normalisePhone(contact.phone);
        // Replace template variables
        const personalised = (message || '')
          .replace(/\{firstName\}/g, contact.firstName || '')
          .replace(/\{phone\}/g, twilio.fromNumber)
          .replace(/\{companyName\}/g, '');

        try {
          const result = await sendViaTwilio(twilio.accountSid, twilio.authToken, from, toNum, personalised);
          await svcDb.from('communications').insert({
            company_id: companyId,
            contact_id: contact.id || null,
            type: 'sms',
            direction: 'outbound',
            subject: `SMS to ${toNum}`,
            body: personalised,
            from_address: from,
            to_address: toNum,
            external_id: result.sid,
            status: 'sent',
            created_at: new Date().toISOString(),
          });
          results.push({ id: contact.id, status: 'sent', sid: result.sid });
        } catch (err) {
          results.push({ id: contact.id, status: 'failed', error: err.message });
        }
      }

      const sent = results.filter(r => r.status === 'sent').length;
      return res.status(200).json({ sent, failed: results.length - sent, results });
    }

    // Single send
    if (!to || !smsBody) {
      return res.status(400).json({ error: 'Missing required fields: to, body' });
    }

    const companyId = await getCompanyId(user.id);
    const twilio = companyId ? await getCompanyIntegration(companyId, 'twilio') : null;

    if (!twilio?.accountSid || !twilio?.authToken || !twilio?.fromNumber) {
      return res.status(503).json({
        error: 'Twilio not configured',
        message: 'Go to Settings → Integrations → Twilio and enter your Account SID, Auth Token, and phone number.',
      });
    }

    const toNorm   = normalisePhone(to);
    const fromNorm = normalisePhone(twilio.fromNumber);

    try {
      const result = await sendViaTwilio(twilio.accountSid, twilio.authToken, fromNorm, toNorm, smsBody);
      await svcDb.from('communications').insert({
        company_id: companyId,
        contact_id: contactId || null,
        type: 'sms',
        direction: 'outbound',
        subject: `SMS to ${toNorm}`,
        body: smsBody,
        from_address: fromNorm,
        to_address: toNorm,
        external_id: result.sid,
        status: 'sent',
        created_at: new Date().toISOString(),
      });
      return res.status(200).json({ sid: result.sid, status: result.status });
    } catch (error) {
      return res.status(error?.status || 500).json({ error: error.message });
    }
  }

  // ── INVITE ─────────────────────────────────────────────────────────────────
  if (type === 'invite') {
    const { email, role, inviteUrl, invitedByName, companyName } = payload;
    if (!email || !inviteUrl) {
      return res.status(400).json({ error: 'Missing required fields: email, inviteUrl' });
    }
    if (!PLATFORM_RESEND_KEY) {
      return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
    }

    const displayRole = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Team Member';
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 32px 40px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; }
    .header p { margin: 6px 0 0; color: #bbf7d0; font-size: 14px; }
    .body { padding: 36px 40px; }
    .body p { margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6; }
    .role-badge { display: inline-block; background: #f0fdf4; border: 1px solid #86efac; color: #15803d; border-radius: 6px; padding: 4px 12px; font-size: 13px; font-weight: 600; margin-bottom: 24px; }
    .btn { display: block; width: fit-content; margin: 28px auto; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: #ffffff !important; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: 600; text-align: center; }
    .footer { background: #f9fafb; padding: 20px 40px; text-align: center; }
    .footer p { margin: 0; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>${companyName || '614 Restore'}</h1>
      <p>Team Invitation</p>
    </div>
    <div class="body">
      <p>Hi there,</p>
      <p><strong>${invitedByName || 'Your team admin'}</strong> has invited you to join <strong>${companyName || '614 Restore'}</strong> on ScopeMGR.</p>
      <span class="role-badge">Role: ${displayRole}</span>
      <p>Click below to accept your invitation. This link expires in <strong>7 days</strong>.</p>
      <a href="${inviteUrl}" class="btn">Accept Invitation</a>
    </div>
    <div class="footer">
      <p>You received this because someone invited you to ScopeMGR. If this was a mistake, ignore this email.</p>
    </div>
  </div>
</body>
</html>`;

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PLATFORM_RESEND_KEY}` },
        body: JSON.stringify({
          from: PLATFORM_SENDER,
          to: [email],
          subject: `You're invited to join ${companyName || '614 Restore'} on ScopeMGR`,
          html,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return res.status(response.status).json(data);
      return res.status(200).json({ success: true, id: data.id });
    } catch (error) {
      return res.status(500).json({ error: error?.message || String(error) });
    }
  }

  return res.status(400).json({ error: `Unknown type: ${type}. Use 'email', 'sms', or 'invite'.` });
}

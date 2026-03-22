import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { requireAuth } from './_auth-middleware.mjs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const svcDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function setCors(res) {
  const allowedOrigin = process.env.APP_URL || '';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function getCompanyForUser(userId) {
  const { data: profile } = await svcDb.from('profiles').select('company_id').eq('id', userId).single();
  if (!profile?.company_id) return null;
  const { data } = await svcDb
    .from('companies')
    .select('smtp_host,smtp_port,smtp_user,smtp_pass,smtp_secure,from_name,from_email,name')
    .eq('id', profile.company_id)
    .single();
  return data || null;
}

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
}

async function sendViaResend(from, to, subject, html) {
  if (!RESEND_API_KEY) throw new Error('No SMTP configured and RESEND_API_KEY is not set');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.message || `Resend error ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return data;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // Require authentication — prevents open relay abuse
  const user = await requireAuth(req, res);
  if (!user) return;

  const { to, subject, html } = req.body || {};
  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
  }

  try {
    const company = await getCompanyForUser(user.id);

    if (company?.smtp_host && company?.smtp_user && company?.smtp_pass) {
      await sendViaSmtp(company, to, subject, html);
      return res.status(200).json({ provider: 'smtp' });
    }

    // Fall back to system Resend account
    const fromName = company?.from_name || company?.name || '614 Restore';
    const fromAddr = company?.from_email || 'scopemgr@614restore.com';
    const data = await sendViaResend(`${fromName} <${fromAddr}>`, to, subject, html);
    return res.status(200).json({ provider: 'resend', ...data });
  } catch (error) {
    console.error('[send-email] error:', error?.message || error);
    const status = error?.status || 500;
    return res.status(status).json({ error: error?.message || String(error) });
  }
}

import { requireAuth } from './_auth-middleware.mjs';

const SENDER = '614 Restore <scopemgr@614restore.com>';

function setCors(req, res) {
  const origin = req.headers.origin || '';
  // Allow localhost, any vercel.app subdomain, and the production domain
  const isAllowed =
    origin === 'https://crm-kanban-integrate.vercel.app' ||
    origin.endsWith('.vercel.app') ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1');

  const allowedOrigin = isAllowed ? origin : 'https://crm-kanban-integrate.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Require authentication — prevents open relay abuse
  const user = await requireAuth(req, res);
  if (!user) return;

  const { to, subject, html } = req.body || {};
  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: SENDER,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error?.message || String(error) });
  }
}

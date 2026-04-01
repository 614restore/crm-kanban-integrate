import { requireAuth } from './_auth-middleware.mjs';

const SENDER = '614 Restore <scopemgr@614restore.com>';

function setCors(req, res) {
  const origin = req.headers.origin || '';
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

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const user = await requireAuth(req, res);
  if (!user) return;

  const { email, role, inviteUrl, invitedByName, companyName, token } = req.body || {};

  if (!email || !inviteUrl) {
    return res.status(400).json({ error: 'Missing required fields: email, inviteUrl' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
  }

  const displayRole = role
    ? role.charAt(0).toUpperCase() + role.slice(1)
    : 'Team Member';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 32px 40px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .header p { margin: 6px 0 0; color: #bbf7d0; font-size: 14px; }
    .body { padding: 36px 40px; }
    .body p { margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6; }
    .role-badge { display: inline-block; background: #f0fdf4; border: 1px solid #86efac; color: #15803d; border-radius: 6px; padding: 4px 12px; font-size: 13px; font-weight: 600; margin-bottom: 24px; }
    .btn { display: block; width: fit-content; margin: 28px auto; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: #ffffff !important; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: 600; text-align: center; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 28px 0; }
    .link-fallback { font-size: 12px; color: #9ca3af; word-break: break-all; }
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
      <p><strong>${invitedByName || 'Your team admin'}</strong> has invited you to join <strong>${companyName || '614 Restore'}</strong> on ScopeMGR — the CRM built for restoration contractors.</p>
      <span class="role-badge">Role: ${displayRole}</span>
      <p>Click the button below to accept your invitation and set up your account. This link expires in <strong>7 days</strong>.</p>
      <a href="${inviteUrl}" class="btn">Accept Invitation</a>
      <hr class="divider" />
      <p class="link-fallback">If the button doesn't work, copy and paste this link into your browser:<br />${inviteUrl}</p>
    </div>
    <div class="footer">
      <p>You received this email because someone invited you to ScopeMGR. If this was a mistake, you can safely ignore it.</p>
    </div>
  </div>
</body>
</html>
`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: SENDER,
        to: [email],
        subject: `You're invited to join ${companyName || '614 Restore'} on ScopeMGR`,
        html,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[send-invite] Resend error:', data);
      return res.status(response.status).json(data);
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (error) {
    console.error('[send-invite] Exception:', error);
    return res.status(500).json({ error: error?.message || String(error) });
  }
}

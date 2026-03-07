// GET /api/quickbooks-auth?company_id=<uuid>
// Redirects user to Intuit OAuth consent screen
import OAuthClient from 'intuit-oauth';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { company_id } = req.query;
  if (!company_id) return res.status(400).json({ error: 'Missing company_id' });

  const environment = process.env.QBO_ENVIRONMENT || 'sandbox';

  const oauthClient = new OAuthClient({
    clientId: (process.env.QBO_CLIENT_ID || '').trim(),
    clientSecret: (process.env.QBO_CLIENT_SECRET || '').trim(),
    environment: environment === 'production' ? 'production' : 'sandbox',
    redirectUri: 'https://crm-kanban-integrate.vercel.app/api/quickbooks-callback',
  });

  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.Payment],
    state: company_id, // pass company_id through OAuth state param
  });

  return res.redirect(authUri);
}

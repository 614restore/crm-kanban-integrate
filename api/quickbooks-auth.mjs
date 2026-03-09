// GET /api/quickbooks-auth?company_id=<uuid>
// Redirects user to Intuit OAuth consent screen
import OAuthClient from 'intuit-oauth';
import { createOAuthState, setNoCacheHeaders } from './_crypto-utils.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res);
  setNoCacheHeaders(res);
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

  // Sign state with HMAC to prevent CSRF
  const signedState = createOAuthState(company_id);

  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.Payment],
    state: signedState,
  });

  return res.redirect(authUri);
}

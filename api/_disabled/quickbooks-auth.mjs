// POST /api/quickbooks-auth
// Returns { authUri } — caller must redirect to the URI client-side.
// Requires JWT auth so only the authenticated company owner can initiate the QB OAuth flow.
import OAuthClient from 'intuit-oauth';
import { createClient } from '@supabase/supabase-js';
import { createOAuthState, setNoCacheHeaders } from './_crypto-utils.mjs';
import { requireAuth } from './_auth-middleware.mjs';

const APP_URL = process.env.APP_URL || 'https://crm-kanban-integrate.vercel.app';

export default async function handler(req, res) {
  setNoCacheHeaders(res);
  res.setHeader('Access-Control-Allow-Origin', APP_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireAuth(req, res);
  if (!user) return;

  // Look up company_id from user profile — never trust caller-supplied company_id
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();

  if (!profile?.company_id) {
    return res.status(403).json({ error: 'No company associated with this account' });
  }

  const environment = process.env.QBO_ENVIRONMENT || 'sandbox';

  const oauthClient = new OAuthClient({
    clientId: (process.env.QBO_CLIENT_ID || '').trim(),
    clientSecret: (process.env.QBO_CLIENT_SECRET || '').trim(),
    environment: environment === 'production' ? 'production' : 'sandbox',
    redirectUri: `${APP_URL}/api/quickbooks-callback`,
  });

  const signedState = createOAuthState(profile.company_id);

  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.Payment],
    state: signedState,
  });

  return res.json({ authUri });
}

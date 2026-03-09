// GET /api/quickbooks-callback?code=...&state=<signed_state>&realmId=...
// Exchanges auth code for tokens, saves encrypted tokens to DB, redirects back to app
import OAuthClient from 'intuit-oauth';
import { createClient } from '@supabase/supabase-js';
import { encrypt, verifyOAuthState, setNoCacheHeaders } from './_crypto-utils.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const APP_URL = process.env.APP_URL || 'https://crm-kanban-integrate.vercel.app';

export default async function handler(req, res) {
  setNoCacheHeaders(res);
  const { code, state: signedState, realmId, error } = req.query;

  if (!SUPABASE_KEY) {
    return res.redirect(`${APP_URL}/settings?qb_error=${encodeURIComponent('Missing SUPABASE_SERVICE_ROLE_KEY on server')}`);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  if (error) {
    return res.redirect(`${APP_URL}/settings?qb_error=${encodeURIComponent(error)}`);
  }

  if (!code || !signedState || !realmId) {
    return res.status(400).send('Missing required OAuth params');
  }

  // Verify CSRF state — extract company_id from signed state
  let company_id;
  try {
    company_id = verifyOAuthState(signedState);
  } catch (stateErr) {
    console.error('OAuth state validation failed:', stateErr.message);
    return res.redirect(`${APP_URL}/settings?qb_error=${encodeURIComponent('Invalid OAuth state. Please try connecting again.')}`);
  }

  const environment = process.env.QBO_ENVIRONMENT || 'sandbox';
  const redirectUri = `${APP_URL}/api/quickbooks-callback`;

  const oauthClient = new OAuthClient({
    clientId: (process.env.QBO_CLIENT_ID || '').trim(),
    clientSecret: (process.env.QBO_CLIENT_SECRET || '').trim(),
    environment: environment === 'production' ? 'production' : 'sandbox',
    redirectUri,
  });

  try {
    // Exchange code for tokens (Vercel req.url is path-only, need full URL)
    const fullUrl = `${APP_URL}${req.url}`;
    const authResponse = await oauthClient.createToken(fullUrl);
    const token = authResponse.getJson();

    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

    // Save tokens to DB
    const { error: dbError } = await supabase
      .from('companies')
      .update({
        qb_access_token: null, // access tokens stored in volatile memory only (Intuit requirement)
        qb_refresh_token: encrypt(token.refresh_token),
        qb_realm_id: realmId,
        qb_token_expires_at: expiresAt,
        qb_connected_at: new Date().toISOString(),
        qb_environment: environment,
      })
      .eq('id', company_id);

    if (dbError) {
      console.error('DB error saving QB tokens:', dbError);
      return res.redirect(`${APP_URL}/settings?qb_error=db_save_failed`);
    }

    return res.redirect(`${APP_URL}/settings?qb_connected=1`);
  } catch (err) {
    console.error('QB OAuth error:', err);
    return res.redirect(`${APP_URL}/settings?qb_error=${encodeURIComponent(err.message)}`);
  }
}

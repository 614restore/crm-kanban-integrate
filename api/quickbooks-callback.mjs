// GET /api/quickbooks-callback?code=...&state=<company_id>&realmId=...
// Exchanges auth code for tokens, saves to DB, redirects back to app
import OAuthClient from 'intuit-oauth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { code, state: company_id, realmId, error } = req.query;

  const appBase = 'https://614restore.github.io/crm-kanban-integrate';

  if (error) {
    return res.redirect(`${appBase}/#/settings?qb_error=${encodeURIComponent(error)}`);
  }

  if (!code || !company_id || !realmId) {
    return res.status(400).send('Missing required OAuth params');
  }

  const environment = process.env.QBO_ENVIRONMENT || 'sandbox';
  const redirectUri = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://crm-kanban-integrate.vercel.app'}/api/quickbooks-callback`;

  const oauthClient = new OAuthClient({
    clientId: process.env.QBO_CLIENT_ID,
    clientSecret: process.env.QBO_CLIENT_SECRET,
    environment,
    redirectUri,
  });

  try {
    // Exchange code for tokens
    const authResponse = await oauthClient.createToken(req.url);
    const token = authResponse.getJson();

    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

    // Save tokens to DB
    const { error: dbError } = await supabase
      .from('companies')
      .update({
        qb_access_token: token.access_token,
        qb_refresh_token: token.refresh_token,
        qb_realm_id: realmId,
        qb_token_expires_at: expiresAt,
        qb_connected_at: new Date().toISOString(),
        qb_environment: environment,
      })
      .eq('id', company_id);

    if (dbError) {
      console.error('DB error saving QB tokens:', dbError);
      return res.redirect(`${appBase}/#/settings?qb_error=db_save_failed`);
    }

    return res.redirect(`${appBase}/#/settings?qb_connected=1`);
  } catch (err) {
    console.error('QB OAuth error:', err);
    return res.redirect(`${appBase}/#/settings?qb_error=${encodeURIComponent(err.message)}`);
  }
}

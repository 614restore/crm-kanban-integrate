// GET /api/eagleview-callback
// Handles the redirect back from EagleView after user login.
// Exchanges the auth code for an access token using PKCE code_verifier.
// Stores the user's EagleView tokens in company_integrations.
import { createClient } from '@supabase/supabase-js';
import { setNoCacheHeaders } from './_crypto-utils.mjs';

const APP_URL = process.env.APP_URL || 'https://crm-kanban-integrate.vercel.app';
const EV_ENV = process.env.EAGLEVIEW_ENV || 'sandbox';
const EV_TOKEN_URL = EV_ENV === 'production'
  ? 'https://id.eagleview.com/oauth2/v1/token'
  : 'https://id.sandbox.eagleview.com/oauth2/v1/token';
const EV_CLIENT_ID = process.env.EAGLEVIEW_CLIENT_ID || '0oa19zndpyiFYYMcG2p8';
const REDIRECT_URI = `${APP_URL}/api/eagleview-callback`;

export default async function handler(req, res) {
  setNoCacheHeaders(res);

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { code, state, error: evError } = req.query || {};

  if (evError) {
    console.error('EagleView auth error from provider:', evError);
    return res.redirect(302, `${APP_URL}/settings/integrations?eagleview=error&reason=${evError}`);
  }

  if (!code || !state) {
    return res.redirect(302, `${APP_URL}/settings/integrations?eagleview=error&reason=missing_params`);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Look up the stored PKCE state + code_verifier
  const { data: oauthState, error: stateError } = await supabase
    .from('oauth_states')
    .select('*')
    .eq('provider', 'eagleview')
    .eq('state', state)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (stateError || !oauthState) {
    console.error('Invalid or expired EagleView OAuth state');
    return res.redirect(302, `${APP_URL}/settings/integrations?eagleview=error&reason=invalid_state`);
  }

  try {
    // Exchange auth code for tokens using PKCE verifier (no client_secret needed)
    const tokenRes = await fetch(EV_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: EV_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_verifier: oauthState.code_verifier,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('EagleView token exchange failed:', tokenData);
      return res.redirect(302, `${APP_URL}/settings/integrations?eagleview=error&reason=token_exchange_failed`);
    }

    // Store tokens in company_integrations (your existing table)
    await supabase
      .from('company_integrations')
      .upsert({
        company_id: oauthState.company_id,
        integration_type: 'eagleview',
        is_active: true,
        user_id: oauthState.user_id,
        connected: true,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
        credentials: {},
        settings: { environment: EV_ENV },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,integration_type' });

    // Clean up the used OAuth state
    await supabase
      .from('oauth_states')
      .delete()
      .eq('user_id', oauthState.user_id)
      .eq('provider', 'eagleview');

    return res.redirect(302, `${APP_URL}/settings/integrations?eagleview=connected`);
  } catch (err) {
    console.error('EagleView callback error:', err);
    return res.redirect(302, `${APP_URL}/settings/integrations?eagleview=error&reason=server_error`);
  }
}

// GET /api/eagleview-auth
// Initiates EagleView PKCE OAuth flow — redirects the user to EagleView login.
// The user authenticates with their own EagleView account (they pay for their own reports).
// Uses Authorization Code with PKCE (TrussCTR app: 0oa19zndpyiFYYMcG2p8)
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { setNoCacheHeaders } from './_crypto-utils.mjs';
import { requireAuth } from './_auth-middleware.mjs';

const APP_URL = process.env.APP_URL || 'https://crm-kanban-integrate.vercel.app';
const EV_ENV = process.env.EAGLEVIEW_ENV || 'sandbox';
const EV_AUTH_URL = EV_ENV === 'production'
  ? 'https://id.eagleview.com/oauth2/v1/authorize'
  : 'https://id.sandbox.eagleview.com/oauth2/v1/authorize';
const EV_CLIENT_ID = process.env.EAGLEVIEW_CLIENT_ID || '0oa19zndpyiFYYMcG2p8';
const REDIRECT_URI = `${APP_URL}/api/eagleview-callback`;

function base64URLEncode(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export default async function handler(req, res) {
  setNoCacheHeaders(res);
  res.setHeader('Access-Control-Allow-Origin', APP_URL);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireAuth(req, res);
  if (!user) return;

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

  // Generate PKCE code_verifier and code_challenge
  const codeVerifier = base64URLEncode(crypto.randomBytes(32));
  const codeChallenge = base64URLEncode(
    crypto.createHash('sha256').update(codeVerifier).digest()
  );
  const state = base64URLEncode(crypto.randomBytes(16));

  // Store verifier + state in oauth_states (expires in 10 min)
  await supabase
    .from('oauth_states')
    .upsert({
      user_id: user.id,
      company_id: profile.company_id,
      provider: 'eagleview',
      state,
      code_verifier: codeVerifier,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }, { onConflict: 'user_id,provider' });

  const params = new URLSearchParams({
    client_id: EV_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email measurement_orders',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return res.redirect(302, `${EV_AUTH_URL}?${params}`);
}

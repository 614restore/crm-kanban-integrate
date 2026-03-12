// POST /api/eagleview-auth
// Initiates EagleView OAuth flow using Client Credentials (System Integration).
// Returns an access_token for use in subsequent EagleView API calls.
// Requires JWT auth so only authenticated company users can initiate the flow.
import { createClient } from '@supabase/supabase-js';
import { setNoCacheHeaders } from './_crypto-utils.mjs';
import { requireAuth } from './_auth-middleware.mjs';

const APP_URL = process.env.APP_URL || 'https://crm-kanban-integrate.vercel.app';
const EV_ENV = process.env.EAGLEVIEW_ENV || 'sandbox';
const EV_TOKEN_URL = EV_ENV === 'production'
  ? 'https://id.eagleview.com/oauth2/v1/token'
  : 'https://id.sandbox.eagleview.com/oauth2/v1/token';

export default async function handler(req, res) {
  setNoCacheHeaders(res);
  res.setHeader('Access-Control-Allow-Origin', APP_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

  const clientId = (process.env.EAGLEVIEW_CLIENT_ID || '').trim();
  const clientSecret = (process.env.EAGLEVIEW_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'EagleView credentials not configured' });
  }

  try {
    const tokenRes = await fetch(EV_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'measurement_orders',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('EagleView token error:', tokenData);
      return res.status(400).json({ error: 'Failed to authenticate with EagleView', details: tokenData });
    }

    // Store the token against the company in Supabase for reuse
    await supabase
      .from('integrations')
      .upsert({
        company_id: profile.company_id,
        provider: 'eagleview',
        access_token: tokenData.access_token,
        token_expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
        environment: EV_ENV,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,provider' });

    return res.json({ success: true, environment: EV_ENV });
  } catch (err) {
    console.error('EagleView auth error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

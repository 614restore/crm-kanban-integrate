// POST /api/eagleview-order
// Places a measurement order using the USER's EagleView access token.
// The order is billed to the user's own EagleView account, not 614 Restore.
// Body: { jobId, address, city, state, zip, reportType }
// Requires JWT auth.
import { createClient } from '@supabase/supabase-js';
import { setNoCacheHeaders } from './_crypto-utils.mjs';
import { requireAuth } from './_auth-middleware.mjs';

const APP_URL = process.env.APP_URL || 'https://crm-kanban-integrate.vercel.app';
const EV_ENV = process.env.EAGLEVIEW_ENV || 'sandbox';
const EV_API_URL = EV_ENV === 'production'
  ? 'https://apicenter.eagleview.com'
  : 'https://apicenter.sandbox.eagleview.com';
const EV_TOKEN_URL = EV_ENV === 'production'
  ? 'https://id.eagleview.com/oauth2/v1/token'
  : 'https://id.sandbox.eagleview.com/oauth2/v1/token';
const EV_CLIENT_ID = process.env.EAGLEVIEW_CLIENT_ID || '0oa19zndpyiFYYMcG2p8';

async function refreshAccessToken(refreshToken) {
  const res = await fetch(EV_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: EV_CLIENT_ID,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  return data;
}

export default async function handler(req, res) {
  setNoCacheHeaders(res);
  res.setHeader('Access-Control-Allow-Origin', APP_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireAuth(req, res);
  if (!user) return;

  const { jobId, address, city, state, zip, reportType = 'PremiumResidential' } = req.body || {};

  if (!jobId || !address || !city || !state || !zip) {
    return res.status(400).json({ error: 'Missing required fields: jobId, address, city, state, zip' });
  }

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

  // Get the user's stored EagleView tokens from company_integrations
  const { data: integration } = await supabase
    .from('company_integrations')
    .select('access_token, refresh_token, token_expires_at')
    .eq('company_id', profile.company_id)
    .eq('integration_type', 'eagleview')
    .single();

  if (!integration?.access_token) {
    return res.status(403).json({
      error: 'EagleView account not connected',
      action: 'connect_eagleview',
      connectUrl: `${APP_URL}/api/eagleview-auth`,
    });
  }

  let accessToken = integration.access_token;

  // Auto-refresh token if expired
  if (integration.refresh_token && new Date(integration.token_expires_at) < new Date()) {
    try {
      const refreshed = await refreshAccessToken(integration.refresh_token);
      accessToken = refreshed.access_token;
      await supabase
        .from('company_integrations')
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token || integration.refresh_token,
          token_expires_at: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', profile.company_id)
        .eq('integration_type', 'eagleview');
    } catch (err) {
      return res.status(403).json({
        error: 'EagleView token expired and refresh failed. Please reconnect.',
        action: 'reconnect_eagleview',
        connectUrl: `${APP_URL}/api/eagleview-auth`,
      });
    }
  }

  try {
    const orderRes = await fetch(`${EV_API_URL}/v1/measurement-orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: { street: address, city, state, zip },
        reportType,
        callbackUrl: `${APP_URL}/api/eagleview-webhook`,
      }),
    });

    const orderData = await orderRes.json();

    if (!orderRes.ok) {
      console.error('EagleView order error:', orderData);
      return res.status(400).json({ error: 'Failed to place EagleView order', details: orderData });
    }

    await supabase
      .from('eagleview_orders')
      .insert({
        company_id: profile.company_id,
        job_id: jobId,
        eagleview_order_id: orderData.orderId || orderData.id,
        status: 'pending',
        report_type: reportType,
        address: `${address}, ${city}, ${state} ${zip}`,
        environment: EV_ENV,
      });

    return res.json({
      success: true,
      orderId: orderData.orderId || orderData.id,
      status: 'pending',
      message: 'EagleView measurement order placed successfully',
    });
  } catch (err) {
    console.error('EagleView order error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

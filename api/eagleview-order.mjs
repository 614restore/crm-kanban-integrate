// POST /api/eagleview-order
// Places a measurement order with EagleView for a given job/project address.
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

async function getAccessToken() {
  const res = await fetch(EV_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: (process.env.EAGLEVIEW_CLIENT_ID || '').trim(),
      client_secret: (process.env.EAGLEVIEW_CLIENT_SECRET || '').trim(),
      scope: 'measurement_orders',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`EagleView token failed: ${JSON.stringify(data)}`);
  return data.access_token;
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

  try {
    const accessToken = await getAccessToken();

    const orderRes = await fetch(`${EV_API_URL}/v1/measurement-orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: {
          street: address,
          city,
          state,
          zip,
        },
        reportType,
        callbackUrl: `${APP_URL}/api/eagleview-webhook`,
      }),
    });

    const orderData = await orderRes.json();

    if (!orderRes.ok) {
      console.error('EagleView order error:', orderData);
      return res.status(400).json({ error: 'Failed to place EagleView order', details: orderData });
    }

    // Store the order reference against the job in Supabase
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
        created_at: new Date().toISOString(),
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

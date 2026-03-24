// api/eagleview.mjs
// EagleView roof measurement API — uses each company's own EagleView credentials
// stored in company_integrations (integration_id = 'eagleview').
//
// Action: 'weather' falls back to free NOAA data — no credentials needed.
// Actions: 'search', 'order' require the company to have EagleView configured.

import { createClient } from '@supabase/supabase-js';
import { requireAuth } from './_auth-middleware.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const svcDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function getCompanyEagleView(userId) {
  const { data: profile } = await svcDb
    .from('profiles').select('company_id').eq('id', userId).single();
  if (!profile?.company_id) return null;

  const { data: row } = await svcDb
    .from('company_integrations')
    .select('credentials')
    .eq('company_id', profile.company_id)
    .eq('integration_id', 'eagleview')
    .single();

  if (!row?.credentials) return null;
  const creds = typeof row.credentials === 'string' ? JSON.parse(row.credentials) : row.credentials;
  if (!creds.apiKey) return null;
  return creds;
}

function evHeaders(apiKey, apiSecret) {
  return {
    Authorization: `Bearer ${apiKey}`,
    ...(apiSecret ? { 'X-API-Secret': apiSecret } : {}),
    'Content-Type': 'application/json',
  };
}

const EV_BASE = 'https://api.eagleview.com/v1';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { action, address, zipCode } = req.body || {};

  // ── WEATHER — free NOAA, no EagleView account needed ─────────────────────
  if (action === 'weather') {
    if (!zipCode) return res.status(400).json({ error: 'zipCode is required' });
    return await noaaWeather(zipCode, res);
  }

  // ── SEARCH & ORDER — require company EagleView credentials ───────────────
  const creds = await getCompanyEagleView(user.id);
  if (!creds) {
    return res.status(503).json({
      error: 'EagleView not configured',
      message: 'Go to Settings → Integrations → EagleView and enter your API Key and Client ID.',
    });
  }

  const headers = evHeaders(creds.apiKey, creds.apiSecret);
  const baseUrl = creds.environment === 'sandbox'
    ? 'https://api-sandbox.eagleview.com/v1'
    : EV_BASE;

  if (action === 'search' || !action) {
    if (!address) return res.status(400).json({ error: 'address is required' });

    const searchRes = await fetch(`${baseUrl}/reports/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ address, productType: 'PremiumReport' }),
    });

    if (!searchRes.ok) {
      const errData = await searchRes.json().catch(() => ({}));
      return res.status(searchRes.status).json({ error: 'EagleView API error', details: errData });
    }

    const searchData = await searchRes.json();

    if (!searchData.reports?.length) {
      return res.status(404).json({
        error: 'No report found',
        message: 'No EagleView report exists for this address. You may need to order a new report.',
      });
    }

    const reportId = searchData.reports[0].id;
    const reportRes = await fetch(`${baseUrl}/reports/${reportId}`, { headers });

    if (!reportRes.ok) {
      return res.status(reportRes.status).json({ error: 'Failed to fetch report details' });
    }

    const r = await reportRes.json();
    return res.status(200).json({
      report: {
        reportId: r.id,
        address: r.address,
        reportDate: r.createdAt,
        measurements: {
          totalSquares: r.measurements?.totalSquares || 0,
          roofArea: r.measurements?.totalArea || 0,
          pitch: r.measurements?.primaryPitch || 'N/A',
          ridgeLength: r.measurements?.ridgeLength || 0,
          eaveLength: r.measurements?.eaveLength || 0,
          rakeLength: r.measurements?.rakeLength || 0,
          valleyLength: r.measurements?.valleyLength || 0,
          hipLength: r.measurements?.hipLength || 0,
          facets: r.measurements?.facets || [],
        },
        imageUrl: r.images?.diagram || null,
      },
    });
  }

  if (action === 'order') {
    if (!address) return res.status(400).json({ error: 'address is required' });

    const orderRes = await fetch(`${baseUrl}/reports/order`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ address, productType: 'PremiumReport', deliveryMethod: 'api' }),
    });

    if (!orderRes.ok) {
      const errData = await orderRes.json().catch(() => ({}));
      return res.status(orderRes.status).json({ error: 'Failed to order report', details: errData });
    }

    const orderData = await orderRes.json();
    return res.status(200).json({
      orderId: orderData.id,
      status: orderData.status,
      estimatedDelivery: orderData.estimatedDelivery,
      message: "Report ordered successfully. You will be notified when it's ready.",
    });
  }

  return res.status(400).json({ error: 'Invalid action. Use search, order, or weather.' });
}

// ── NOAA weather proxy (free, no credentials) ─────────────────────────────────
async function noaaWeather(zipCode, res) {
  try {
    const geoRes = await fetch(`https://api.weather.gov/points/${zipCode}`);
    if (!geoRes.ok) {
      return res.status(200).json({ alerts: [], hasActiveStorm: false });
    }

    const geoData = await geoRes.json();
    const alertsUrl = geoData.properties?.forecastZone?.replace('/zones/', '/alerts/active/zone/');
    if (!alertsUrl) return res.status(200).json({ alerts: [], hasActiveStorm: false });

    const alertsRes = await fetch(alertsUrl);
    if (!alertsRes.ok) return res.status(200).json({ alerts: [], hasActiveStorm: false });

    const alertsData = await alertsRes.json();
    const severe = (alertsData.features || []).filter(a => {
      const event = (a.properties?.event || '').toLowerCase();
      return event.includes('tornado') || event.includes('severe thunderstorm') ||
             event.includes('hail') || event.includes('wind');
    });

    return res.status(200).json({
      alerts: severe.map(a => ({
        type: a.properties.event,
        severity: a.properties.severity,
        description: a.properties.description,
        onset: a.properties.onset,
        expires: a.properties.expires,
      })),
      hasActiveStorm: severe.length > 0,
    });
  } catch {
    return res.status(200).json({ alerts: [], hasActiveStorm: false });
  }
}

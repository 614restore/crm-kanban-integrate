// api/eagleview.mjs
// EagleView roof measurement API — uses each company's own EagleView credentials
// stored in company_integrations (integration_type = 'eagleview').
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
    .eq('integration_type', 'eagleview')
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

  const { action, address, zipCode } = req.body || {};

  // ── WEATHER — free NOAA public data, no auth needed ──────────────────────
  // Checked BEFORE requireAuth so the client never needs a session token for
  // weather lookups. NOAA api.weather.gov is a free, unauthenticated public API.
  if (action === 'weather') {
    if (!zipCode) return res.status(400).json({ error: 'zipCode is required' });
    return await noaaWeather(zipCode, res);
  }

  // ── SEARCH & ORDER — require auth + company EagleView credentials ─────────
  const user = await requireAuth(req, res);
  if (!user) return;

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
// Flow: zip → lat/lon (zippopotam.us) → NOAA /points → forecast zone + county
//       → NOAA /alerts/active?zone=… → filter storm-damage events
const NOAA_HEADERS = {
  'User-Agent': 'TrussCTR-CRM/1.0 (support@trussctr.com)',
  Accept: 'application/geo+json',
};

const STORM_KEYWORDS = [
  'tornado', 'severe thunderstorm', 'hail', 'wind', 'hurricane',
  'tropical storm', 'winter storm', 'ice storm', 'flash flood', 'blizzard',
];

async function noaaWeather(zipCode, res) {
  try {
    // Step 1 — zip → lat/lon
    const geoRes = await fetch(
      `https://api.zippopotam.us/us/${encodeURIComponent(zipCode.trim())}`,
    );
    if (!geoRes.ok) {
      return res.status(200).json({ alerts: [], hasActiveStorm: false, error: 'Unknown zip code' });
    }
    const geoData = await geoRes.json();
    const place = geoData.places?.[0];
    if (!place) return res.status(200).json({ alerts: [], hasActiveStorm: false });

    const lat = parseFloat(place.latitude).toFixed(4);
    const lon = parseFloat(place.longitude).toFixed(4);
    const locationLabel = `${place['place name']}, ${place['state abbreviation']}`;

    // Step 2 — lat/lon → NOAA forecast zone + county
    const pointsRes = await fetch(
      `https://api.weather.gov/points/${lat},${lon}`,
      { headers: NOAA_HEADERS },
    );
    if (!pointsRes.ok) {
      return res.status(200).json({ alerts: [], hasActiveStorm: false, location: locationLabel });
    }
    const pointsData = await pointsRes.json();

    const forecastZoneUrl = pointsData.properties?.forecastZone || '';
    const countyUrl       = pointsData.properties?.county || '';
    const zoneId   = forecastZoneUrl.split('/').pop();
    const countyId = countyUrl.split('/').pop();
    const zones    = [zoneId, countyId].filter(Boolean);

    if (!zones.length) {
      return res.status(200).json({ alerts: [], hasActiveStorm: false, location: locationLabel });
    }

    // Step 3 — active alerts for forecast zone + county
    const alertsRes = await fetch(
      `https://api.weather.gov/alerts/active?zone=${zones.join(',')}`,
      { headers: NOAA_HEADERS },
    );
    if (!alertsRes.ok) {
      return res.status(200).json({ alerts: [], hasActiveStorm: false, location: locationLabel });
    }
    const alertsData = await alertsRes.json();

    // Step 4 — keep only storm-damage-relevant events
    const severe = (alertsData.features || []).filter(a => {
      const event = (a.properties?.event || '').toLowerCase();
      return STORM_KEYWORDS.some(kw => event.includes(kw));
    });

    return res.status(200).json({
      alerts: severe.map(a => ({
        type:        a.properties.event,
        severity:    a.properties.severity,
        urgency:     a.properties.urgency,
        certainty:   a.properties.certainty,
        headline:    a.properties.headline,
        description: a.properties.description,
        instruction: a.properties.instruction || null,
        areaDesc:    a.properties.areaDesc,
        onset:       a.properties.onset,
        expires:     a.properties.expires,
      })),
      hasActiveStorm: severe.length > 0,
      location: locationLabel,
    });
  } catch (err) {
    console.error('NOAA weather error:', err);
    return res.status(200).json({ alerts: [], hasActiveStorm: false });
  }
}

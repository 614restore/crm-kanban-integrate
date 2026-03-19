// EagleView API Integration
// Handles: 1) Roof measurement imports, 2) Weather/storm data

import { requireAuth } from './_auth-middleware.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { action, address, zipCode } = req.body;

  // EagleView API credentials from environment variables
  const EAGLEVIEW_API_KEY = process.env.EAGLEVIEW_API_KEY;
  const EAGLEVIEW_API_SECRET = process.env.EAGLEVIEW_API_SECRET;
  const EAGLEVIEW_BASE_URL = process.env.EAGLEVIEW_BASE_URL || 'https://api.eagleview.com/v1';

  if (!EAGLEVIEW_API_KEY || !EAGLEVIEW_API_SECRET) {
    return res.status(500).json({ 
      error: 'EagleView API credentials not configured',
      message: 'Please add EAGLEVIEW_API_KEY and EAGLEVIEW_API_SECRET to your environment variables'
    });
  }

  try {
    // Action 1: Search for roof measurement reports
    if (action === 'search' || !action) {
      if (!address) {
        return res.status(400).json({ error: 'Address is required' });
      }

      // Call EagleView API to search for reports
      const searchResponse = await fetch(`${EAGLEVIEW_BASE_URL}/reports/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${EAGLEVIEW_API_KEY}`,
          'X-API-Secret': EAGLEVIEW_API_SECRET,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: address,
          productType: 'PremiumReport', // or 'QuickSquares', 'Comprehensive'
        }),
      });

      if (!searchResponse.ok) {
        const errorData = await searchResponse.json().catch(() => ({}));
        return res.status(searchResponse.status).json({ 
          error: 'EagleView API error',
          details: errorData 
        });
      }

      const searchData = await searchResponse.json();

      // If report found, fetch full report details
      if (searchData.reports && searchData.reports.length > 0) {
        const reportId = searchData.reports[0].id;
        
        const reportResponse = await fetch(`${EAGLEVIEW_BASE_URL}/reports/${reportId}`, {
          headers: {
            'Authorization': `Bearer ${EAGLEVIEW_API_KEY}`,
            'X-API-Secret': EAGLEVIEW_API_SECRET,
          },
        });

        if (!reportResponse.ok) {
          return res.status(reportResponse.status).json({ error: 'Failed to fetch report details' });
        }

        const reportData = await reportResponse.json();

        // Transform EagleView data to our format
        const report = {
          reportId: reportData.id,
          address: reportData.address,
          reportDate: reportData.createdAt,
          measurements: {
            totalSquares: reportData.measurements.totalSquares || 0,
            roofArea: reportData.measurements.totalArea || 0,
            pitch: reportData.measurements.primaryPitch || 'N/A',
            ridgeLength: reportData.measurements.ridgeLength || 0,
            eaveLength: reportData.measurements.eaveLength || 0,
            rakeLength: reportData.measurements.rakeLength || 0,
            valleyLength: reportData.measurements.valleyLength || 0,
            hipLength: reportData.measurements.hipLength || 0,
            facets: reportData.measurements.facets || [],
          },
          imageUrl: reportData.images?.diagram || null,
        };

        return res.status(200).json({ report });
      } else {
        return res.status(404).json({ 
          error: 'No report found',
          message: 'No EagleView report exists for this address. You may need to order a new report.'
        });
      }
    }

    // Action 2: Get weather/storm data for zip code
    if (action === 'weather') {
      if (!zipCode) {
        return res.status(400).json({ error: 'Zip code is required' });
      }

      // EagleView also provides weather data through their API
      const weatherResponse = await fetch(`${EAGLEVIEW_BASE_URL}/weather/alerts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${EAGLEVIEW_API_KEY}`,
          'X-API-Secret': EAGLEVIEW_API_SECRET,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zipCode: zipCode,
          alertTypes: ['hail', 'wind', 'tornado', 'severe_thunderstorm'],
        }),
      });

      if (!weatherResponse.ok) {
        // Fallback to NOAA if EagleView weather not available
        return await getNoaaWeather(zipCode, res);
      }

      const weatherData = await weatherResponse.json();

      return res.status(200).json({
        alerts: weatherData.alerts || [],
        hasActiveStorm: weatherData.alerts && weatherData.alerts.length > 0,
      });
    }

    // Action 3: Order new report
    if (action === 'order') {
      if (!address) {
        return res.status(400).json({ error: 'Address is required' });
      }

      const orderResponse = await fetch(`${EAGLEVIEW_BASE_URL}/reports/order`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${EAGLEVIEW_API_KEY}`,
          'X-API-Secret': EAGLEVIEW_API_SECRET,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: address,
          productType: 'PremiumReport',
          deliveryMethod: 'api', // or 'email'
        }),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json().catch(() => ({}));
        return res.status(orderResponse.status).json({ 
          error: 'Failed to order report',
          details: errorData 
        });
      }

      const orderData = await orderResponse.json();

      return res.status(200).json({
        orderId: orderData.id,
        status: orderData.status,
        estimatedDelivery: orderData.estimatedDelivery,
        message: 'Report ordered successfully. You will be notified when it\'s ready.',
      });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('EagleView API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

// Fallback to NOAA weather API if EagleView weather not available
async function getNoaaWeather(zipCode, res) {
  try {
    // First, get coordinates from zip code
    const geoResponse = await fetch(`https://api.weather.gov/points/${zipCode}`);
    
    if (!geoResponse.ok) {
      return res.status(404).json({ error: 'Weather data not available for this zip code' });
    }

    const geoData = await geoResponse.json();
    const alertsUrl = geoData.properties.forecastZone.replace('/zones/', '/alerts/active/zone/');

    // Get active alerts
    const alertsResponse = await fetch(alertsUrl);
    const alertsData = await alertsResponse.json();

    const severeAlerts = alertsData.features.filter(alert => {
      const event = alert.properties.event.toLowerCase();
      return event.includes('tornado') || 
             event.includes('severe thunderstorm') || 
             event.includes('hail') ||
             event.includes('wind');
    });

    return res.status(200).json({
      alerts: severeAlerts.map(alert => ({
        type: alert.properties.event,
        severity: alert.properties.severity,
        description: alert.properties.description,
        onset: alert.properties.onset,
        expires: alert.properties.expires,
      })),
      hasActiveStorm: severeAlerts.length > 0,
    });
  } catch (error) {
    console.error('NOAA weather error:', error);
    return res.status(500).json({ error: 'Failed to fetch weather data' });
  }
}

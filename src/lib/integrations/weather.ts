// Weather API Integrations
import { IntegrationTestResult } from './apiTypes';
import { geocodeAddress as lookupAddress } from '@/lib/geocode';

/**
 * OpenWeather API Integration
 */
export class OpenWeatherIntegration {
  private apiKey: string;
  private baseUrl = 'https://api.openweathermap.org';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Test OpenWeather connection
   */
  async testConnection(): Promise<IntegrationTestResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/data/2.5/weather?q=New%20York&appid=${this.apiKey}&units=metric`,
        { method: 'GET' }
      );

      if (!response.ok) {
        return {
          success: false,
          message: `OpenWeather API error: ${response.statusText}`,
          timestamp: new Date().toISOString(),
        };
      }

      const data = await response.json();

      return {
        success: true,
        message: 'Connected to OpenWeather successfully',
        details: {
          location: `${data.name}, ${data.sys?.country}`,
          temperature: data.main?.temp,
          description: data.weather?.[0]?.description,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get current weather by coordinates
   */
  async getCurrentWeather(lat: number, lon: number, units: 'metric' | 'imperial' = 'metric'): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=${units}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to get weather: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Get weather error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current weather by city
   */
  async getWeatherByCity(city: string, units: 'metric' | 'imperial' = 'metric'): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${this.apiKey}&units=${units}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to get weather: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Get weather error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get weather forecast
   */
  async getForecast(lat: number, lon: number, units: 'metric' | 'imperial' = 'metric'): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=${units}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to get forecast: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Get forecast error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get air quality index
   */
  async getAirQuality(lat: number, lon: number): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${this.apiKey}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to get air quality: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Get air quality error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * HailTrace Integration for Hail Damage Tracking
 */
export class HailTraceIntegration {
  private apiKey: string;
  private environment: 'sandbox' | 'production';
  private baseUrl: string;

  constructor(apiKey: string, environment: 'sandbox' | 'production' = 'production') {
    this.apiKey = apiKey;
    this.environment = environment;
    this.baseUrl = environment === 'production' ? 'https://api.hailtrace.com' : 'https://sandbox-api.hailtrace.com';
  }

  /**
   * Test HailTrace connection
   */
  async testConnection(): Promise<IntegrationTestResult> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/account`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        return {
          success: false,
          message: `HailTrace API error: ${response.statusText}`,
          timestamp: new Date().toISOString(),
        };
      }

      const data = await response.json();

      return {
        success: true,
        message: 'Connected to HailTrace successfully',
        details: {
          accountName: data.name,
          status: data.status,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check for hail damage in area
   */
  async checkHailDamage(lat: number, lon: number, radiusMiles: number = 5): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v1/hail-events/check?lat=${lat}&lon=${lon}&radius=${radiusMiles}`,
        {
          method: 'GET',
          headers: this.buildHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to check hail damage: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Check hail damage error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get hail events
   */
  async getHailEvents(
    startDate: string,
    endDate: string,
    severity?: 'minor' | 'moderate' | 'severe'
  ): Promise<any> {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    if (severity) params.append('severity', severity);

    try {
      const response = await fetch(`${this.baseUrl}/v1/hail-events?${params.toString()}`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to get hail events: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Get hail events error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create hail alert
   */
  async createAlert(
    areaName: string,
    lat: number,
    lon: number,
    radiusMiles: number,
    severityThreshold: string
  ): Promise<any> {
    const payload = {
      area_name: areaName,
      latitude: lat,
      longitude: lon,
      radius_miles: radiusMiles,
      severity_threshold: severityThreshold,
    };

    try {
      const response = await fetch(`${this.baseUrl}/v1/alerts`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to create alert: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Create alert error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List active alerts
   */
  async listAlerts(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/alerts`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to list alerts: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`List alerts error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete alert
   */
  async deleteAlert(alertId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/alerts/${alertId}`, {
        method: 'DELETE',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete alert: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Delete alert error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }
}

/**
 * NOAA Storm History Integration
 *
 * Free, no API key or subscription required — unlike HailTrace, which needs
 * a paid account. Pulls from NOAA's public Severe Weather Data Inventory
 * (SWDI, hosted at ncei.noaa.gov), which is the same NEXRAD-radar-derived
 * severe-weather data NOAA itself publishes. Two live datasets used here:
 *   - nx3hail: radar-estimated hail cells (size in inches, timestamp, location)
 *   - nx3tvs:  tornado vortex signatures (radar-detected rotation)
 * SWDI has no bulk historical archive beyond ~13 months and caps each query
 * to a 31-day window, so a longer lookback is split into monthly chunks and
 * fetched in parallel. CORS is open (Access-Control-Allow-Origin: *), so
 * this runs directly from the browser — no serverless proxy needed.
 */
export interface NOAAStormEvent {
  date: string;          // YYYY-MM-DD
  time?: string;
  type: 'hail' | 'tornado';
  severity: 'minor' | 'moderate' | 'severe';
  hailSize?: number;     // inches, radar-estimated max in the cell
  distanceMiles: number; // from the queried point
  lat: number;
  lon: number;
  radarStation: string;
  source: 'noaa';
}

const EARTH_RADIUS_MILES = 3958.8;

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hailSeverity(inches: number): 'minor' | 'moderate' | 'severe' {
  if (inches >= 1.5) return 'severe';   // golf-ball+, roof-damage threshold
  if (inches >= 1.0) return 'moderate'; // quarter-size, typically claim-worthy
  return 'minor';
}

/** Parses SWDI's CSV format: an optional header + data rows, then a blank
 * line, then a "summary" footer (count, totalTimeInSeconds). Handles the
 * zero-results case, where the data header is absent entirely. */
function parseSwdiCsv(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n').map((l) => l.trim());
  const summaryIdx = lines.findIndex((l) => l === 'summary');
  const dataLines = summaryIdx >= 0 ? lines.slice(0, summaryIdx) : lines;
  if (dataLines.length < 2 || dataLines[0].startsWith('error') || dataLines[0].startsWith('count')) return [];
  const headers = dataLines[0].split(',');
  return dataLines
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const cells = line.split(',');
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = cells[i]; });
      return row;
    });
}

/** Splits [from, to] into <=31-day windows — SWDI's per-request cap. */
function chunkDateRange(from: Date, to: Date): Array<{ start: Date; end: Date }> {
  const chunks: Array<{ start: Date; end: Date }> = [];
  let cursor = new Date(from);
  while (cursor < to) {
    const end = new Date(cursor);
    end.setDate(end.getDate() + 30);
    chunks.push({ start: new Date(cursor), end: end > to ? new Date(to) : end });
    cursor = new Date(end);
    cursor.setDate(cursor.getDate() + 1);
  }
  return chunks;
}

const swdiDate = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

export class NOAAWeatherIntegration {
  private baseUrl = 'https://www.ncei.noaa.gov/swdiws';

  /**
   * Storm history within `radiusMiles` of a point over the last `months`.
   * Free, no key. Returns hail + tornado radar detections sorted by
   * distance from the point, nearest first.
   */
  async getStormHistory(
    lat: number,
    lon: number,
    months: number = 12,
    radiusMiles: number = 10
  ): Promise<NOAAStormEvent[]> {
    // ~1 degree latitude ≈ 69 miles; longitude shrinks with latitude, so
    // widen it a bit rather than doing a full cos(lat) correction — a
    // slightly generous bbox just means a few extra out-of-radius rows,
    // which the distance filter below drops anyway.
    const latDelta = radiusMiles / 69;
    const lonDelta = radiusMiles / 54;
    const bbox = `${lon - lonDelta},${lat - latDelta},${lon + lonDelta},${lat + latDelta}`;

    const to = new Date();
    const from = new Date(to);
    from.setMonth(from.getMonth() - months);
    const windows = chunkDateRange(from, to);

    const fetchProduct = async (product: 'nx3hail' | 'nx3tvs', win: { start: Date; end: Date }) => {
      const url = `${this.baseUrl}/csv/${product}/${swdiDate(win.start)}:${swdiDate(win.end)}?bbox=${bbox}`;
      try {
        const res = await fetch(url);
        if (!res.ok) return [];
        return parseSwdiCsv(await res.text());
      } catch {
        return [];
      }
    };

    const [hailRows, tvsRows] = await Promise.all([
      Promise.all(windows.map((w) => fetchProduct('nx3hail', w))).then((r) => r.flat()),
      Promise.all(windows.map((w) => fetchProduct('nx3tvs', w))).then((r) => r.flat()),
    ]);

    const hailEvents: NOAAStormEvent[] = hailRows
      .map((row) => {
        const evLat = parseFloat(row.LAT);
        const evLon = parseFloat(row.LON);
        const size = parseFloat(row.MAXSIZE);
        const dist = haversineMiles(lat, lon, evLat, evLon);
        return {
          date: (row.ZTIME || '').slice(0, 10),
          time: (row.ZTIME || '').slice(11, 16),
          type: 'hail' as const,
          severity: hailSeverity(size || 0),
          hailSize: size,
          distanceMiles: Math.round(dist * 10) / 10,
          lat: evLat,
          lon: evLon,
          radarStation: row.WSR_ID,
          source: 'noaa' as const,
        };
      })
      .filter((e) => e.distanceMiles <= radiusMiles && e.date);

    const tvsEvents: NOAAStormEvent[] = tvsRows
      .map((row) => {
        const evLat = parseFloat(row.LAT);
        const evLon = parseFloat(row.LON);
        const dist = haversineMiles(lat, lon, evLat, evLon);
        return {
          date: (row.ZTIME || '').slice(0, 10),
          time: (row.ZTIME || '').slice(11, 16),
          type: 'tornado' as const,
          severity: 'severe' as const,
          distanceMiles: Math.round(dist * 10) / 10,
          lat: evLat,
          lon: evLon,
          radarStation: row.WSR_ID,
          source: 'noaa' as const,
        };
      })
      .filter((e) => e.distanceMiles <= radiusMiles && e.date);

    return [...hailEvents, ...tvsEvents].sort((a, b) => a.distanceMiles - b.distanceMiles);
  }

  /** Geocodes through /api/geocode: the Census geocoder can't be called from the browser. */
  async geocodeAddress(address: string, city: string, state: string, zip: string): Promise<{ lat: number; lon: number } | null> {
    const found = await lookupAddress(`${address}, ${city}, ${state} ${zip}`);
    return found ? { lat: found.lat, lon: found.lon } : null;
  }
}

export default {
  OpenWeatherIntegration,
  HailTraceIntegration,
  NOAAWeatherIntegration,
};

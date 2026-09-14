// Live weather for Storm Search's live radar: the last hour of NOAA NEXRAD radar
// (Iowa Environmental Mesonet), active National Weather Service alerts
// (api.weather.gov) and the last day's NWS storm reports. All free, no key, and
// callable from the browser.
import { lsrFeaturesToReports, statesAround, type StormReport } from '@/lib/stormReports';

const IEM = 'https://mesonet.agron.iastate.edu';

/** Minutes before the latest frame, oldest first: the last hour of radar in 5-minute steps. */
export const LIVE_RADAR_OFFSETS = [55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0];

/** IEM's rolling radar layers; cacheKey forces fresh tiles on each refresh. */
export function liveRadarTileUrl(minutesAgo: number, cacheKey: string): string {
  const layer = minutesAgo === 0 ? 'nexrad-n0q-900913' : `nexrad-n0q-900913-m${String(minutesAgo).padStart(2, '0')}m`;
  return `${IEM}/cache/tile.py/1.0.0/${layer}/{z}/{x}/{y}.png?v=${encodeURIComponent(cacheKey)}`;
}

/** When the newest national radar frame was taken. */
export async function fetchLatestRadarTime(): Promise<Date | null> {
  try {
    const res = await fetch(`${IEM}/data/gis/images/4326/USCOMP/n0q_0.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    const valid = new Date((await res.json())?.meta?.valid);
    return Number.isNaN(valid.getTime()) ? null : valid;
  } catch {
    return null;
  }
}

// ── NWS alerts ────────────────────────────────────────────────────────────────

export interface LiveAlert {
  id: string;
  event: string;
  headline: string | null;
  nwsHeadline: string | null;
  severity: string | null;
  urgency: string | null;
  certainty: string | null;
  effective: string | null;
  expires: string | null;
  ends: string | null;
  areaDesc: string | null;
  description: string | null;
  instruction: string | null;
  senderName: string | null;
  maxWindGust: string | null;
  maxHailSize: string | null;
  tornadoDetection: string | null;
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: any } | null;
}

const firstParam = (v: unknown) => (Array.isArray(v) && v.length ? String(v[0]) : null);

function toLiveAlert(feature: any): LiveAlert | null {
  const p = feature?.properties ?? {};
  if (p.status && p.status !== 'Actual') return null;
  const g = feature?.geometry;
  return {
    id: String(p.id ?? feature?.id ?? `${p.event}-${p.sent}`),
    event: String(p.event ?? 'Alert'),
    headline: p.headline ?? null,
    nwsHeadline: firstParam(p.parameters?.NWSheadline),
    severity: p.severity ?? null,
    urgency: p.urgency ?? null,
    certainty: p.certainty ?? null,
    effective: p.effective ?? null,
    expires: p.expires ?? null,
    ends: p.ends ?? null,
    areaDesc: p.areaDesc ?? null,
    description: p.description ?? null,
    instruction: p.instruction ?? null,
    senderName: p.senderName ?? null,
    maxWindGust: firstParam(p.parameters?.maxWindGust),
    maxHailSize: firstParam(p.parameters?.maxHailSize),
    tornadoDetection: firstParam(p.parameters?.tornadoDetection),
    geometry: g && (g.type === 'Polygon' || g.type === 'MultiPolygon') ? g : null,
  };
}

const SEVERITY_RANK: Record<string, number> = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 };

async function fetchAlerts(query: string): Promise<LiveAlert[]> {
  const res = await fetch(`https://api.weather.gov/alerts/active?${query}`);
  if (!res.ok) throw new Error(`NWS alerts request failed (HTTP ${res.status})`);
  const body = await res.json();
  return ((body?.features ?? []).map(toLiveAlert).filter(Boolean) as LiveAlert[]).sort(
    (a, b) => (SEVERITY_RANK[a.severity ?? 'Unknown'] ?? 4) - (SEVERITY_RANK[b.severity ?? 'Unknown'] ?? 4),
  );
}

/** Every active alert covering a point, including watches and advisories without an outline. */
export const fetchAlertsForPoint = (lat: number, lon: number) =>
  fetchAlerts(`point=${lat.toFixed(4)},${lon.toFixed(4)}`);

/** Active alerts in a state and its neighbors, for the outlines on the map. */
export const fetchAlertsAroundState = (stateCode: string) => fetchAlerts(`area=${statesAround(stateCode).join(',')}`);

export function alertColor(event: string): string {
  const e = event.toLowerCase();
  if (e.includes('tornado')) return '#dc2626';
  if (e.includes('severe thunderstorm')) return '#f59e0b';
  if (e.includes('extreme wind') || e.includes('hurricane')) return '#c026d3';
  if (e.includes('flood')) return '#16a34a';
  if (e.includes('special weather')) return '#0ea5e9';
  if (e.includes('winter') || e.includes('blizzard') || e.includes('ice') || e.includes('snow')) return '#6366f1';
  return '#6b7280';
}

// ── Recent storm reports ──────────────────────────────────────────────────────

/** NWS Local Storm Reports from the last few hours within a radius, newest first. */
export async function fetchRecentStormReports(
  lat: number,
  lon: number,
  stateCode: string | null,
  radiusMiles: number,
  hours = 24,
): Promise<StormReport[]> {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 3600e3);
  const iso = (d: Date) => d.toISOString().slice(0, 16) + 'Z';
  const states = stateCode ? `&states=${statesAround(stateCode).join(',')}` : '';
  const res = await fetch(`${IEM}/geojson/lsr.geojson?sts=${iso(start)}&ets=${iso(end)}${states}`);
  if (!res.ok) throw new Error(`Storm reports request failed (HTTP ${res.status})`);
  const body = await res.json();
  return lsrFeaturesToReports(body?.features ?? [], lat, lon, radiusMiles).sort((a, b) =>
    b.validUtc.localeCompare(a.validUtc),
  );
}

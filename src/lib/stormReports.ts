// Storm reports around a point, for Storm Search and storm alert notifications.
//
// Two NOAA sources, both free and open to the browser:
//   - Ground reports: National Weather Service Local Storm Reports (spotters,
//     emergency managers, weather stations) through the Iowa Environmental
//     Mesonet archive: hail, wind gusts, wind damage, tornadoes, flooding and
//     more, with the exact spot, size or speed, who reported it and their notes.
//   - Radar estimates: NOAA SWDI radar hail and tornado signatures
//     (NOAAWeatherIntegration), which mark a storm cell rather than an impact.
import { NOAAWeatherIntegration } from '@/lib/integrations/weather';

export type StormCategory = 'hail' | 'wind' | 'damage' | 'tornado' | 'flood' | 'other';
export type StormSeverity = 'minor' | 'moderate' | 'severe';

export interface StormReport {
  id: string;
  source: 'ground' | 'radar';
  category: StormCategory;
  /** The NWS report type, e.g. HAIL or TSTM WND GST. */
  typeText: string;
  title: string;
  magnitude: number | null;
  unit: string | null;
  lat: number;
  lon: number;
  distanceMiles: number;
  /** Compass direction from the searched point, e.g. NE. */
  direction: string;
  validUtc: string;
  severity: StormSeverity;
  place?: string | null;
  county?: string | null;
  state?: string | null;
  reportedBy?: string | null;
  remark?: string | null;
  /** M measured, E estimated, U unknown. */
  qualifier?: string | null;
  wfo?: string | null;
  radarStation?: string | null;
  hailProbability?: number | null;
  severeProbability?: number | null;
}

export const STORM_CATEGORY_LABELS: Record<StormCategory, string> = {
  hail: 'Hail',
  wind: 'Wind',
  damage: 'Wind damage',
  tornado: 'Tornado',
  flood: 'Flooding',
  other: 'Other',
};

// ── Opening Storm Search from elsewhere (e.g. a storm alert) ──────────────────

export interface StormFocus {
  lat: number;
  lon: number;
  label?: string | null;
  state?: string | null;
  radiusMiles?: number | null;
  months?: number | null;
}

export const STORM_FOCUS_EVENT = 'trussctr:storm-focus';
let pendingFocus: StormFocus | null = null;

/** Storm Search picks this up when it opens, or right away if it is already open. */
export function focusStormSearch(focus: StormFocus) {
  pendingFocus = focus;
  window.dispatchEvent(new Event(STORM_FOCUS_EVENT));
}

export function takePendingStormFocus(): StormFocus | null {
  const focus = pendingFocus;
  pendingFocus = null;
  return focus;
}

// ── States ────────────────────────────────────────────────────────────────────

const STATE_CODES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY',
  louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
  'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};

const STATE_NEIGHBORS: Record<string, string[]> = {
  AL: ['FL', 'GA', 'MS', 'TN'], AK: [], AZ: ['CA', 'CO', 'NM', 'NV', 'UT'], AR: ['LA', 'MO', 'MS', 'OK', 'TN', 'TX'],
  CA: ['AZ', 'NV', 'OR'], CO: ['AZ', 'KS', 'NE', 'NM', 'OK', 'UT', 'WY'], CT: ['MA', 'NY', 'RI'],
  DE: ['MD', 'NJ', 'PA'], DC: ['MD', 'VA'], FL: ['AL', 'GA'], GA: ['AL', 'FL', 'NC', 'SC', 'TN'], HI: [],
  ID: ['MT', 'NV', 'OR', 'UT', 'WA', 'WY'], IL: ['IA', 'IN', 'KY', 'MO', 'WI'], IN: ['IL', 'KY', 'MI', 'OH'],
  IA: ['IL', 'MN', 'MO', 'NE', 'SD', 'WI'], KS: ['CO', 'MO', 'NE', 'OK'], KY: ['IL', 'IN', 'MO', 'OH', 'TN', 'VA', 'WV'],
  LA: ['AR', 'MS', 'TX'], ME: ['NH'], MD: ['DC', 'DE', 'PA', 'VA', 'WV'], MA: ['CT', 'NH', 'NY', 'RI', 'VT'],
  MI: ['IN', 'OH', 'WI'], MN: ['IA', 'ND', 'SD', 'WI'], MS: ['AL', 'AR', 'LA', 'TN'],
  MO: ['AR', 'IA', 'IL', 'KS', 'KY', 'NE', 'OK', 'TN'], MT: ['ID', 'ND', 'SD', 'WY'],
  NE: ['CO', 'IA', 'KS', 'MO', 'SD', 'WY'], NV: ['AZ', 'CA', 'ID', 'OR', 'UT'], NH: ['MA', 'ME', 'VT'],
  NJ: ['DE', 'NY', 'PA'], NM: ['AZ', 'CO', 'OK', 'TX', 'UT'], NY: ['CT', 'MA', 'NJ', 'PA', 'VT'],
  NC: ['GA', 'SC', 'TN', 'VA'], ND: ['MN', 'MT', 'SD'], OH: ['IN', 'KY', 'MI', 'PA', 'WV'],
  OK: ['AR', 'CO', 'KS', 'MO', 'NM', 'TX'], OR: ['CA', 'ID', 'NV', 'WA'], PA: ['DE', 'MD', 'NJ', 'NY', 'OH', 'WV'],
  RI: ['CT', 'MA'], SC: ['GA', 'NC'], SD: ['IA', 'MN', 'MT', 'ND', 'NE', 'WY'],
  TN: ['AL', 'AR', 'GA', 'KY', 'MO', 'MS', 'NC', 'VA'], TX: ['AR', 'LA', 'NM', 'OK'],
  UT: ['AZ', 'CO', 'ID', 'NM', 'NV', 'WY'], VT: ['MA', 'NH', 'NY'], VA: ['DC', 'KY', 'MD', 'NC', 'TN', 'WV'],
  WA: ['ID', 'OR'], WV: ['KY', 'MD', 'OH', 'PA', 'VA'], WI: ['IA', 'IL', 'MI', 'MN'],
  WY: ['CO', 'ID', 'MT', 'NE', 'SD', 'UT'],
};

/** "OH", "oh" or "Ohio" → "OH"; null when it isn't a US state. */
export function toStateCode(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (/^[A-Za-z]{2}$/.test(v)) {
    const code = v.toUpperCase();
    return STATE_NEIGHBORS[code] ? code : null;
  }
  return STATE_CODES[v.toLowerCase()] ?? null;
}

/** A state and its neighbors, for queries around an address near a state line. */
export function statesAround(stateCode: string): string[] {
  return [stateCode, ...(STATE_NEIGHBORS[stateCode] ?? [])];
}

// ── Geometry ──────────────────────────────────────────────────────────────────

const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function compassDirection(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return COMPASS[Math.round(deg / 22.5) % 16];
}

// ── Report types ──────────────────────────────────────────────────────────────

const TYPE_NAMES: Record<string, string> = {
  'HAIL': 'Hail',
  'MARINE HAIL': 'Marine hail',
  'TSTM WND GST': 'Thunderstorm wind gust',
  'NON-TSTM WND GST': 'Wind gust',
  'MARINE TSTM WIND': 'Marine thunderstorm wind',
  'HIGH SUST WINDS': 'Sustained high wind',
  'TSTM WND DMG': 'Thunderstorm wind damage',
  'NON-TSTM WND DMG': 'Wind damage',
  'TORNADO': 'Tornado',
  'FUNNEL CLOUD': 'Funnel cloud',
  'LANDSPOUT': 'Landspout',
  'WATERSPOUT': 'Waterspout',
  'FLOOD': 'Flood',
  'FLASH FLOOD': 'Flash flood',
  'COASTAL FLOOD': 'Coastal flood',
  'HEAVY RAIN': 'Heavy rain',
  'RAIN': 'Rain',
  'SNOW': 'Snow',
  'HEAVY SNOW': 'Heavy snow',
  'BLIZZARD': 'Blizzard',
  'ICE STORM': 'Ice storm',
  'FREEZING RAIN': 'Freezing rain',
  'LIGHTNING': 'Lightning',
  'WILDFIRE': 'Wildfire',
  'DEBRIS FLOW': 'Debris flow',
  'DUST STORM': 'Dust storm',
};

const typeName = (typeText: string) =>
  TYPE_NAMES[typeText] ?? typeText.charAt(0) + typeText.slice(1).toLowerCase();

function categorize(typeText: string): StormCategory {
  if (typeText === 'HAIL' || typeText === 'MARINE HAIL') return 'hail';
  if (['TSTM WND GST', 'NON-TSTM WND GST', 'MARINE TSTM WIND', 'HIGH SUST WINDS'].includes(typeText)) return 'wind';
  if (typeText === 'TSTM WND DMG' || typeText === 'NON-TSTM WND DMG') return 'damage';
  if (['TORNADO', 'FUNNEL CLOUD', 'LANDSPOUT', 'WATERSPOUT'].includes(typeText)) return 'tornado';
  if (typeText.includes('FLOOD') || typeText === 'HEAVY RAIN' || typeText === 'DEBRIS FLOW') return 'flood';
  return 'other';
}

function severityFor(category: StormCategory, typeText: string, magnitude: number | null): StormSeverity {
  switch (category) {
    case 'hail':
      if ((magnitude ?? 0) >= 1.5) return 'severe';
      return (magnitude ?? 0) >= 1 ? 'moderate' : 'minor';
    case 'wind':
      if ((magnitude ?? 0) >= 75) return 'severe';
      return (magnitude ?? 0) >= 58 ? 'moderate' : 'minor';
    case 'tornado':
      return typeText === 'FUNNEL CLOUD' ? 'moderate' : 'severe';
    case 'damage':
    case 'flood':
      return 'moderate';
    default:
      return 'minor';
  }
}

function titleFor(category: StormCategory, typeText: string, magnitude: number | null, unit: string | null): string {
  const name = typeName(typeText);
  if (magnitude == null) return name;
  if (category === 'hail') return `${name} — ${magnitude}"`;
  if (category === 'wind') return `${name} — ${magnitude} mph`;
  return unit ? `${name} — ${magnitude} ${unit.toLowerCase()}` : name;
}

// ── Fetching ──────────────────────────────────────────────────────────────────

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function monthWindows(months: number): Array<[Date, Date]> {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - months);
  const windows: Array<[Date, Date]> = [];
  for (let cursor = start; cursor < end; ) {
    const next = new Date(Math.min(cursor.getTime() + 31 * 86400e3, end.getTime()));
    windows.push([cursor, next]);
    cursor = next;
  }
  return windows;
}

async function fetchGroundReports(
  lat: number, lon: number, stateCode: string, months: number, radiusMiles: number,
): Promise<{ reports: StormReport[]; complete: boolean }> {
  const states = [stateCode, ...(STATE_NEIGHBORS[stateCode] ?? [])].join(',');
  const iso = (d: Date) => d.toISOString().slice(0, 16) + 'Z';
  let complete = true;

  const pages = await mapLimit(monthWindows(months), 3, async ([start, end]) => {
    try {
      const res = await fetch(
        `https://mesonet.agron.iastate.edu/geojson/lsr.geojson?sts=${iso(start)}&ets=${iso(end)}&states=${states}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return ((await res.json())?.features ?? []) as any[];
    } catch {
      complete = false;
      return [];
    }
  });

  return { reports: lsrFeaturesToReports(pages.flat(), lat, lon, radiusMiles), complete };
}

/** Turns IEM Local Storm Report GeoJSON features into reports within a radius of a point. */
export function lsrFeaturesToReports(features: any[], lat: number, lon: number, radiusMiles: number): StormReport[] {
  const latSlack = radiusMiles / 69 + 0.01;
  const byId = new Map<string, StormReport>();
  for (const feature of features) {
    const p = feature?.properties ?? {};
    const evLat = Number(p.lat);
    const evLon = Number(p.lon);
    if (!Number.isFinite(evLat) || !Number.isFinite(evLon) || Math.abs(evLat - lat) > latSlack) continue;
    const distance = haversineMiles(lat, lon, evLat, evLon);
    if (distance > radiusMiles) continue;

    const typeText = String(p.typetext ?? '').toUpperCase().trim();
    const category = categorize(typeText);
    const mag = p.magf === null || p.magf === undefined || p.magf === '' ? NaN : Number(p.magf);
    const magnitude = Number.isFinite(mag) ? mag : null;
    const unit = p.unit ? String(p.unit) : null;
    // No product id: corrected re-issues of the same report show once.
    const id = `lsr:${typeText}:${evLat}:${evLon}:${p.valid ?? ''}:${magnitude ?? ''}`;
    byId.set(id, {
      id,
      source: 'ground',
      category,
      typeText,
      title: titleFor(category, typeText, magnitude, unit),
      magnitude,
      unit,
      lat: evLat,
      lon: evLon,
      distanceMiles: Math.round(distance * 10) / 10,
      direction: compassDirection(lat, lon, evLat, evLon),
      validUtc: String(p.valid ?? ''),
      severity: severityFor(category, typeText, magnitude),
      place: p.city ?? null,
      county: p.county ?? null,
      state: p.state ?? p.st ?? null,
      reportedBy: p.source ?? null,
      remark: p.remark ? String(p.remark).trim() : null,
      qualifier: p.qualifier ?? null,
      wfo: p.wfo ?? null,
    });
  }
  return [...byId.values()];
}

async function fetchRadarReports(lat: number, lon: number, months: number, radiusMiles: number): Promise<StormReport[]> {
  const events = await new NOAAWeatherIntegration().getStormHistory(lat, lon, months, radiusMiles);
  return events.map((e, i) => {
    const validUtc = `${e.date}T${e.time || '00:00'}:00Z`;
    const isTornado = e.type === 'tornado';
    const magnitude = isTornado ? null : e.hailSize ?? null;
    return {
      id: `radar:${e.type}:${validUtc}:${e.radarStation}:${e.lat}:${e.lon}:${i}`,
      source: 'radar' as const,
      category: isTornado ? ('tornado' as const) : ('hail' as const),
      typeText: isTornado ? 'RADAR TVS' : 'RADAR HAIL',
      title: isTornado ? 'Tornado vortex signature' : magnitude != null ? `Radar hail — ${magnitude}"` : 'Radar hail',
      magnitude,
      unit: isTornado ? null : 'Inch',
      lat: e.lat,
      lon: e.lon,
      distanceMiles: e.distanceMiles,
      direction: compassDirection(lat, lon, e.lat, e.lon),
      validUtc,
      severity: e.severity,
      radarStation: e.radarStation,
      hailProbability: e.hailProbability ?? null,
      severeProbability: e.severeProbability ?? null,
    };
  });
}

export interface StormSearchResult {
  reports: StormReport[];
  /** False when NWS ground reports couldn't be loaded (or the state is unknown). */
  groundReportsAvailable: boolean;
}

export async function searchStormReports(opts: {
  lat: number;
  lon: number;
  state?: string | null;
  months: number;
  radiusMiles: number;
}): Promise<StormSearchResult> {
  const { lat, lon, months, radiusMiles } = opts;
  const stateCode = toStateCode(opts.state);
  const [ground, radar] = await Promise.all([
    stateCode
      ? fetchGroundReports(lat, lon, stateCode, months, radiusMiles)
      : Promise.resolve({ reports: [] as StormReport[], complete: false }),
    fetchRadarReports(lat, lon, months, radiusMiles).catch(() => [] as StormReport[]),
  ]);
  const reports = [...ground.reports, ...radar].sort((a, b) => a.distanceMiles - b.distanceMiles);
  return { reports, groundReportsAvailable: ground.complete };
}

// ── NWS warnings: the area a storm threatened ─────────────────────────────────

export interface StormWarning {
  id: string;
  /** e.g. "Severe Thunderstorm Warning". */
  title: string;
  /** NWS phenomena code: SV severe thunderstorm, TO tornado, EW extreme wind, SQ snow squall, FF flash flood. */
  phenomena: string;
  wfo: string | null;
  issued: string | null;
  polygonBegin: string | null;
  polygonEnd: string | null;
  windMph: number | null;
  hailInches: number | null;
  /** e.g. RADAR INDICATED or OBSERVED. */
  tornado: string | null;
  /** e.g. CONSIDERABLE or DESTRUCTIVE. */
  damage: string | null;
  windThreat: string | null;
  hailThreat: string | null;
  href: string | null;
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: any };
  containsReport: boolean;
  containsAddress: boolean;
}

const WARNING_PHENOMENA = new Set(['SV', 'TO', 'EW', 'SQ', 'FF']);

function pointInRing(lat: number, lon: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInGeometry(geometry: StormWarning['geometry'], lat: number, lon: number): boolean {
  const polygons: number[][][][] = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((polygon) => polygon.length > 0 && pointInRing(lat, lon, polygon[0]));
}

const numberOrNull = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * NWS storm-based warnings in effect around a report's time that covered the
 * report's spot or the searched address, from the Iowa Environmental Mesonet
 * archive. Report ground reports carry their NWS office, which narrows the query.
 */
export async function fetchStormWarnings(
  report: StormReport,
  address: { lat: number; lon: number },
): Promise<StormWarning[]> {
  const t = Date.parse(report.validUtc);
  if (Number.isNaN(t)) return [];
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 16) + 'Z';
  const params = new URLSearchParams({ sts: iso(t - 3 * 3600e3), ets: iso(t + 3600e3) });
  if (report.wfo) params.set('wfos', report.wfo);
  const res = await fetch(`https://mesonet.agron.iastate.edu/geojson/sbw.geojson?${params.toString()}`);
  if (!res.ok) throw new Error(`Warnings request failed (HTTP ${res.status})`);
  const body = await res.json();

  // A warning counts if it was in effect within half an hour of the report.
  const slack = 30 * 60000;
  const seen = new Set<string>();
  const warnings: StormWarning[] = [];
  for (const feature of body?.features ?? []) {
    const p = feature?.properties ?? {};
    const geometry = feature?.geometry;
    if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) continue;
    if (!WARNING_PHENOMENA.has(p.phenomena) || p.significance !== 'W') continue;
    const begin = Date.parse(p.polygon_begin ?? p.issue ?? '');
    const end = Date.parse(p.polygon_end ?? p.expire_utc ?? p.expire ?? '');
    if (Number.isFinite(begin) && begin > t + slack) continue;
    if (Number.isFinite(end) && end < t - slack) continue;

    const containsReport = pointInGeometry(geometry, report.lat, report.lon);
    const containsAddress = pointInGeometry(geometry, address.lat, address.lon);
    if (!containsReport && !containsAddress) continue;

    const id = String(feature.id ?? `${p.wfo}.${p.phenomena}.${p.eventid}.${p.polygon_begin}`);
    if (seen.has(id)) continue;
    seen.add(id);
    warnings.push({
      id,
      title: String(p.ps ?? 'Warning'),
      phenomena: String(p.phenomena),
      wfo: p.wfo ?? null,
      issued: p.issue ?? null,
      polygonBegin: p.polygon_begin ?? null,
      polygonEnd: p.polygon_end ?? p.expire_utc ?? null,
      windMph: numberOrNull(p.max_windtag ?? p.windtag),
      hailInches: numberOrNull(p.max_hailtag ?? p.hailtag),
      tornado: p.tornadotag ?? null,
      damage: p.damagetag ?? null,
      windThreat: p.windthreat ?? null,
      hailThreat: p.hailthreat ?? null,
      href: typeof p.href === 'string' && p.href.startsWith('https://') ? p.href : null,
      geometry,
      containsReport,
      containsAddress,
    });
  }
  return warnings.sort((a, b) => Number(b.containsReport) - Number(a.containsReport));
}

/** Other reports from the same storm: within 25 miles and 90 minutes of the report. */
export function reportsFromSameStorm(report: StormReport, reports: StormReport[]): StormReport[] {
  const t = Date.parse(report.validUtc);
  if (Number.isNaN(t)) return [];
  return reports.filter((r) => {
    if (r.id === report.id) return false;
    const rt = Date.parse(r.validUtc);
    return Math.abs(rt - t) <= 90 * 60000 && haversineMiles(report.lat, report.lon, r.lat, r.lon) <= 25;
  });
}

// ── Which Storm Search tab opens ──────────────────────────────────────────────

export type StormSearchMode = 'live' | 'history';

/** A place to center the live radar on: coordinates, or an address to look up. */
export interface LiveRadarFocus {
  address?: string | null;
  label?: string | null;
  lat?: number | null;
  lon?: number | null;
  state?: string | null;
}

/** Fired when the open Storm Search tab changes, so the sidebar can highlight it. */
export const STORM_MODE_EVENT = 'trussctr:storm-mode';

let pendingLiveFocus: LiveRadarFocus | null = null;
let pendingHistory = false;
let currentMode: StormSearchMode = 'live';

/** Opens (or switches Storm Search to) the live radar, optionally centered on a place. */
export function focusLiveRadar(focus: LiveRadarFocus = {}) {
  pendingLiveFocus = focus;
  pendingHistory = false;
  window.dispatchEvent(new Event(STORM_FOCUS_EVENT));
}

/** Opens (or switches Storm Search to) the storm history tab. */
export function focusStormHistory() {
  pendingHistory = true;
  pendingLiveFocus = null;
  window.dispatchEvent(new Event(STORM_FOCUS_EVENT));
}

export function takePendingLiveRadarFocus(): LiveRadarFocus | null {
  const focus = pendingLiveFocus;
  pendingLiveFocus = null;
  return focus;
}

export function takePendingStormHistory(): boolean {
  const pending = pendingHistory;
  pendingHistory = false;
  return pending;
}

/** The tab a pending request will open, without taking it. */
export function peekPendingStormMode(): StormSearchMode | null {
  if (pendingFocus || pendingHistory) return 'history';
  if (pendingLiveFocus) return 'live';
  return null;
}

export const getStormSearchMode = () => currentMode;

export function reportStormSearchMode(mode: StormSearchMode) {
  if (currentMode === mode) return;
  currentMode = mode;
  window.dispatchEvent(new Event(STORM_MODE_EVENT));
}

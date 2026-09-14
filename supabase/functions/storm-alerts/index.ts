// storm-alerts: run every 15 minutes by pg_cron (migration 20260914120000_storm_alerts.sql).
//
// Checks the last day of National Weather Service Local Storm Reports (hail,
// wind gusts, wind damage, tornadoes) and the last hours of NOAA radar hail
// against each company's office and contacts, then alerts the team:
//   - office area (companies.storm_area_radius_miles): everyone on the team
//   - a contact's address (companies.storm_contact_radius_miles): the rep
//     assigned to the contact, plus roles listed in storm_contact_alert_roles;
//     owners and admins when nobody is assigned
// Each report alerts once per office or contact (storm_alert_log). Alerts go to
// the notifications table (web and mobile bells) and by email through Resend.
//
// Deploy with --no-verify-jwt: the cron job sends x-storm-alerts-secret, checked
// against the Vault secret, instead of a user token.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'TrussCTR CRM <scopemgr@614restore.com>';
const APP_URL = (Deno.env.get('APP_URL') || 'https://trussctr.614restore.com').replace(/\/$/, '');
const USER_AGENT = 'TrussCTR/1.0 (https://trussctr.614restore.com)';

const GROUND_LOOKBACK_HOURS = 24;
const RADAR_LOOKBACK_HOURS = 6;
const RADAR_MIN_HAIL_INCHES = 1;
const GEOCODE_BUDGET_PER_RUN = 40;
const LOG_LOOKBACK_DAYS = 3;
const LOG_RETENTION_DAYS = 45;
const GEOCODE_RETRY_DAYS = 7;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = 'hail' | 'wind' | 'damage' | 'tornado';

interface StormEvent {
  key: string;
  source: 'ground' | 'radar';
  category: Category;
  typeText: string;
  magnitude: number | null;
  lat: number;
  lon: number;
  validUtc: string;
  localTime: string | null;
  place: string | null;
  county: string | null;
  state: string | null;
  reportedBy: string | null;
  remark: string | null;
  radarStation?: string;
}

interface Hit {
  event: StormEvent;
  distance: number;
  direction: string;
}

interface Company {
  id: string;
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  geocode_attempted_at: string | null;
  storm_area_radius_miles: number | null;
  storm_contact_radius_miles: number | string | null;
  storm_min_wind_mph: number | null;
  storm_contact_alert_roles: string[] | null;
  storm_email_enabled: boolean | null;
}

interface Customer {
  id: string;
  first_name: string | null;
  last_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number;
  longitude: number;
  assigned_to: string | null;
}

interface Member {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
}

interface PendingAlert {
  scope: 'area' | 'contact';
  customer: Customer | null;
  center: { lat: number; lon: number };
  hits: Hit[];
}

const COMPANY_COLUMNS =
  'id, name, address, city, state, zip, latitude, longitude, geocode_attempted_at, storm_area_radius_miles, storm_contact_radius_miles, storm_min_wind_mph, storm_contact_alert_roles, storm_email_enabled';

// ── Geometry ──────────────────────────────────────────────────────────────────

const toRad = (d: number) => (d * Math.PI) / 180;

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

/** Compass direction from the first point to the second. */
function direction(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return COMPASS[Math.round(deg / 22.5) % 16];
}

function nearby(events: StormEvent[], lat: number, lon: number, radius: number): Hit[] {
  const latSlack = radius / 69 + 0.01;
  const hits: Hit[] = [];
  for (const event of events) {
    if (Math.abs(event.lat - lat) > latSlack) continue;
    const distance = haversineMiles(lat, lon, event.lat, event.lon);
    if (distance <= radius) hits.push({ event, distance, direction: direction(lat, lon, event.lat, event.lon) });
  }
  return hits.sort((a, b) => a.distance - b.distance);
}

type Box = [minLon: number, minLat: number, maxLon: number, maxLat: number];

function boundingBox(points: Array<{ latitude: number; longitude: number }>, radius: number): Box {
  let [minLon, minLat, maxLon, maxLat] = [180, 90, -180, -90];
  for (const p of points) {
    minLon = Math.min(minLon, p.longitude);
    maxLon = Math.max(maxLon, p.longitude);
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
  }
  const latPad = radius / 69 + 0.01;
  const lonPad = radius / 45 + 0.01;
  return [minLon - lonPad, minLat - latPad, maxLon + lonPad, maxLat + latPad];
}

const inBox = (box: Box, e: StormEvent) => e.lon >= box[0] && e.lat >= box[1] && e.lon <= box[2] && e.lat <= box[3];

// ── Storm data ────────────────────────────────────────────────────────────────

const HAIL_TYPES = new Set(['HAIL', 'MARINE HAIL']);
const GUST_TYPES = new Set(['TSTM WND GST', 'NON-TSTM WND GST', 'MARINE TSTM WIND', 'HIGH SUST WINDS']);
const DAMAGE_TYPES = new Set(['TSTM WND DMG', 'NON-TSTM WND DMG']);
const TORNADO_TYPES = new Set(['TORNADO', 'FUNNEL CLOUD', 'LANDSPOUT', 'WATERSPOUT']);

function categorize(typeText: string): Category | null {
  if (HAIL_TYPES.has(typeText)) return 'hail';
  if (GUST_TYPES.has(typeText)) return 'wind';
  if (DAMAGE_TYPES.has(typeText)) return 'damage';
  if (TORNADO_TYPES.has(typeText)) return 'tornado';
  return null;
}

/** Hail of any size, wind damage and tornadoes always count; gusts from the company's minimum. */
const qualifies = (e: StormEvent, minWind: number) =>
  e.category !== 'wind' || (e.magnitude != null && e.magnitude >= minWind);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The report's local time, from the raw row IEM includes ("2026-04-22 17:26:00-05"). */
function localTimeFromLsr(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = /^\("(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):\d{2}([+-]\d{2})/.exec(raw);
  if (!m) return null;
  const [, year, month, day, hour, minute, offset] = m;
  const h = Number(hour);
  const off = Number(offset);
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year} ${h % 12 || 12}:${minute} ${h >= 12 ? 'PM' : 'AM'} (UTC${off >= 0 ? '+' : '-'}${Math.abs(off)})`;
}

function formatUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const h = d.getUTCHours();
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} ${h % 12 || 12}:${mm} ${h >= 12 ? 'PM' : 'AM'} UTC`;
}

async function fetchGroundReports(): Promise<StormEvent[]> {
  const end = new Date();
  const start = new Date(end.getTime() - GROUND_LOOKBACK_HOURS * 3600e3);
  const iso = (d: Date) => d.toISOString().slice(0, 16) + 'Z';
  const res = await fetch(
    `https://mesonet.agron.iastate.edu/geojson/lsr.geojson?sts=${iso(start)}&ets=${iso(end)}`,
    { headers: { 'User-Agent': USER_AGENT } },
  );
  if (!res.ok) throw new Error(`Storm reports request failed (HTTP ${res.status})`);
  const body = await res.json();
  const events: StormEvent[] = [];
  for (const feature of body?.features ?? []) {
    const p = feature?.properties ?? {};
    const typeText = String(p.typetext ?? '').toUpperCase().trim();
    const category = categorize(typeText);
    const lat = Number(p.lat);
    const lon = Number(p.lon);
    if (!category || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const mag = p.magf === null || p.magf === undefined || p.magf === '' ? NaN : Number(p.magf);
    const magnitude = Number.isFinite(mag) ? mag : null;
    events.push({
      // No product id: a corrected re-issue of the same report shouldn't alert twice.
      key: `lsr:${typeText}:${lat}:${lon}:${p.valid ?? ''}:${magnitude ?? ''}`,
      source: 'ground',
      category,
      typeText,
      magnitude,
      lat,
      lon,
      validUtc: String(p.valid ?? ''),
      localTime: localTimeFromLsr(p.l),
      place: p.city ?? null,
      county: p.county ?? null,
      state: p.state ?? p.st ?? null,
      reportedBy: p.source ?? null,
      remark: p.remark ? String(p.remark).trim() : null,
    });
  }
  return events;
}

async function fetchRadarHail(box: Box): Promise<StormEvent[]> {
  // Very large areas return too many radar cells; ground reports still cover them.
  if ((box[2] - box[0]) * (box[3] - box[1]) > 100) return [];
  const end = new Date();
  const start = new Date(end.getTime() - RADAR_LOOKBACK_HOURS * 3600e3);
  const day = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const bbox = box.map((n) => n.toFixed(3)).join(',');
  const res = await fetch(
    `https://www.ncei.noaa.gov/swdiws/csv/nx3hail/${day(start)}:${day(new Date(end.getTime() + 86400e3))}?bbox=${bbox}`,
  );
  if (!res.ok) return [];
  const lines = (await res.text()).trim().split('\n').map((l) => l.trim());
  const summaryIdx = lines.findIndex((l) => l === 'summary');
  const data = summaryIdx >= 0 ? lines.slice(0, summaryIdx) : lines;
  if (data.length < 2 || !data[0].startsWith('ZTIME')) return [];
  const headers = data[0].split(',');
  const events: StormEvent[] = [];
  for (const line of data.slice(1)) {
    if (!line) continue;
    const cells = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i]; });
    const size = Number(row.MAXSIZE);
    const lat = Number(row.LAT);
    const lon = Number(row.LON);
    const when = new Date(row.ZTIME);
    if (!(size >= RADAR_MIN_HAIL_INCHES) || !Number.isFinite(lat) || !Number.isFinite(lon) || !(when >= start)) continue;
    events.push({
      key: `swdi:${row.ZTIME}:${row.WSR_ID}:${row.CELL_ID}`,
      source: 'radar',
      category: 'hail',
      typeText: 'RADAR HAIL',
      magnitude: size,
      lat,
      lon,
      validUtc: row.ZTIME,
      localTime: null,
      place: null,
      county: null,
      state: null,
      reportedBy: null,
      remark: null,
      radarStation: row.WSR_ID,
    });
  }
  return events;
}

// ── Geocoding ─────────────────────────────────────────────────────────────────

const fullAddress = (r: { address: string | null; city: string | null; state: string | null; zip: string | null }) =>
  [r.address, r.city, [r.state, r.zip].filter((v) => v && String(v).trim()).join(' ')]
    .filter((v) => v && String(v).trim())
    .join(', ');

// Nominatim allows one request a second, so its calls queue behind each other.
let nominatimQueue: Promise<unknown> = Promise.resolve();

async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(query)}&benchmark=Public_AR_Current&format=json`,
    );
    if (res.ok) {
      const match = (await res.json())?.result?.addressMatches?.[0];
      if (match?.coordinates) return { lat: match.coordinates.y, lon: match.coordinates.x };
    }
  } catch (err) {
    console.warn('[storm-alerts] census geocode', err);
  }

  const lookup = nominatimQueue.then(async () => {
    await new Promise((r) => setTimeout(r, 1100));
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`,
      { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  });
  nominatimQueue = lookup.catch(() => null);
  try {
    return await lookup;
  } catch {
    return null;
  }
}

const retryCutoff = () => new Date(Date.now() - GEOCODE_RETRY_DAYS * 86400e3).toISOString();

async function locateCompany(company: Company, budget: { left: number; used: number }) {
  if (company.latitude != null && company.longitude != null) return { lat: company.latitude, lon: company.longitude };
  const address = fullAddress(company);
  if (!company.address || !address || budget.left <= 0) return null;
  if (company.geocode_attempted_at && company.geocode_attempted_at > retryCutoff()) return null;
  budget.left--;
  budget.used++;
  const found = await geocode(address);
  await admin
    .from('companies')
    .update({
      latitude: found?.lat ?? null,
      longitude: found?.lon ?? null,
      geocoded_address: found ? address : null,
      geocode_attempted_at: new Date().toISOString(),
    })
    .eq('id', company.id);
  return found;
}

async function locateCustomers(companyId: string, budget: { left: number; used: number }) {
  if (budget.left <= 0) return;
  const { data, error } = await admin
    .from('customers')
    .select('id, address, city, state, zip')
    .eq('company_id', companyId)
    .is('latitude', null)
    .not('address', 'is', null)
    .neq('address', '')
    .or(`geocode_attempted_at.is.null,geocode_attempted_at.lt."${retryCutoff()}"`)
    .limit(budget.left);
  if (error) throw error;
  const queue = [...(data ?? [])];
  budget.left -= queue.length;
  budget.used += queue.length;

  const worker = async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      const address = fullAddress(row);
      const found = address ? await geocode(address) : null;
      await admin
        .from('customers')
        .update({
          latitude: found?.lat ?? null,
          longitude: found?.lon ?? null,
          geocoded_address: found ? address : null,
          geocode_attempted_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}

async function loadLocatedCustomers(companyId: string): Promise<Customer[]> {
  const rows: Customer[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await admin
      .from('customers')
      .select('id, first_name, last_name, address, city, state, zip, latitude, longitude, assigned_to')
      .eq('company_id', companyId)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('id')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as Customer[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

// ── Alerts ────────────────────────────────────────────────────────────────────

const logId = (scope: string, customerId: string | null, key: string) => `${scope}|${customerId ?? ''}|${key}`;

async function loadRecentLog(companyId: string): Promise<Set<string>> {
  const seen = new Set<string>();
  const since = new Date(Date.now() - LOG_LOOKBACK_DAYS * 86400e3).toISOString();
  for (let from = 0; from < 200000; from += 1000) {
    const { data, error } = await admin
      .from('storm_alert_log')
      .select('scope, customer_id, event_key')
      .eq('company_id', companyId)
      .gte('created_at', since)
      .order('created_at')
      .range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) seen.add(logId(r.scope, r.customer_id, r.event_key));
    if (!data || data.length < 1000) break;
  }
  return seen;
}

function describe(e: StormEvent): string {
  switch (e.category) {
    case 'hail':
      return e.magnitude != null ? `${e.magnitude}" hail` : 'Hail';
    case 'wind': {
      const label = e.typeText === 'HIGH SUST WINDS' ? 'sustained wind' : 'wind gust';
      return e.magnitude != null ? `${e.magnitude} mph ${label}` : label[0].toUpperCase() + label.slice(1);
    }
    case 'damage':
      return 'Wind damage';
    case 'tornado':
      return e.typeText.charAt(0) + e.typeText.slice(1).toLowerCase();
  }
}

function groundLine(hit: Hit, ref: string): string {
  const e = hit.event;
  const where = [e.place, e.county ? `${e.county} County` : null, e.state].filter(Boolean).join(', ');
  let line = `${describe(e)}, ${hit.distance.toFixed(1)} mi ${hit.direction} of ${ref}`;
  if (where) line += ` (${where})`;
  line += ` · ${e.localTime ?? formatUtc(e.validUtc)}`;
  if (e.reportedBy) line += ` · Reported by ${e.reportedBy}`;
  if (e.remark) line += `\n   "${e.remark}"`;
  return line;
}

function radarLine(hits: Hit[], ref: string): string {
  const largest = Math.max(...hits.map((h) => h.event.magnitude ?? 0));
  const nearest = hits[0];
  const stations = [...new Set(hits.map((h) => h.event.radarStation).filter(Boolean))].join(', ');
  return `NOAA radar estimated hail up to ${largest}" in ${hits.length} scan${hits.length === 1 ? '' : 's'}, nearest ${nearest.distance.toFixed(1)} mi ${nearest.direction} of ${ref} at ${formatUtc(nearest.event.validUtc)}${stations ? ` (radar ${stations})` : ''}`;
}

function buildContent(company: Company, alert: PendingAlert, areaRadius: number, contactRadius: number) {
  const ground = alert.hits.filter((h) => h.event.source === 'ground');
  const radar = alert.hits.filter((h) => h.event.source === 'radar');
  const isContact = alert.scope === 'contact';
  const customer = alert.customer;
  const ref = isContact ? 'the property' : 'the office';
  const placeLabel = isContact ? fullAddress(customer!) : fullAddress(company);
  const name = customer ? [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'a contact' : '';

  const lines: string[] = [];
  ground.slice(0, 12).forEach((h) => lines.push(`• ${groundLine(h, ref)}`));
  if (ground.length > 12) lines.push(`• …and ${ground.length - 12} more storm reports`);
  if (radar.length) lines.push(`• ${radarLine(radar, ref)}`);

  const title = isContact ? `Storm reported near ${name}` : `Storm activity within ${areaRadius} mi of the office`;
  const message = [placeLabel, ...lines].filter(Boolean).join('\n');
  const data = {
    scope: alert.scope,
    center: {
      lat: alert.center.lat,
      lon: alert.center.lon,
      label: placeLabel || null,
      state: (isContact ? customer?.state : company.state) ?? null,
    },
    radiusMiles: isContact ? Math.max(contactRadius, 5) : areaRadius,
    months: 1,
    events: alert.hits.slice(0, 40).map((h) => ({
      source: h.event.source,
      category: h.event.category,
      type: h.event.typeText,
      magnitude: h.event.magnitude,
      lat: h.event.lat,
      lon: h.event.lon,
      valid: h.event.validUtc,
      distance_miles: Math.round(h.distance * 10) / 10,
      direction: h.direction,
    })),
  };

  return {
    type: isContact ? 'storm_alert' : 'storm_area_alert',
    title,
    message,
    related_type: isContact ? 'contact' : 'storm',
    related_id: isContact ? customer!.id : null,
    data,
  };
}

function contactRecipients(company: Company, customer: Customer, members: Member[]): Member[] {
  const recipients = new Map<string, Member>();
  const rep = members.find((m) => m.id === customer.assigned_to || m.user_id === customer.assigned_to);
  if (rep) recipients.set(rep.user_id, rep);
  const extraRoles = company.storm_contact_alert_roles ?? [];
  for (const m of members) if (m.role && extraRoles.includes(m.role)) recipients.set(m.user_id, m);
  if (recipients.size === 0) {
    for (const m of members) if (m.role === 'owner' || m.role === 'admin') recipients.set(m.user_id, m);
  }
  return [...recipients.values()];
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

async function sendEmail(to: string, companyName: string, sections: Array<{ title: string; message: string }>) {
  if (!RESEND_API_KEY) return false;
  const subject = sections.length === 1 ? sections[0].title : `${sections.length} storm alerts`;
  const body = sections
    .map(
      (s) =>
        `<h2 style="font-size:16px;margin:24px 0 8px;color:#111827">${escapeHtml(s.title)}</h2>` +
        `<div style="white-space:pre-wrap;font-size:14px;line-height:1.55;color:#374151">${escapeHtml(s.message)}</div>`,
    )
    .join('');
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:16px">` +
    body +
    `<p style="margin-top:24px"><a href="${escapeHtml(APP_URL)}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Open TrussCTR</a></p>` +
    `<p style="font-size:12px;color:#6b7280;margin-top:24px">Storm reports from the National Weather Service and NOAA radar. You get these because storm alerts are on for ${escapeHtml(companyName)}.</p>` +
    `</div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!res.ok) console.error('[storm-alerts] email failed', res.status, await res.text());
  return res.ok;
}

async function processCompany(company: Company, ground: StormEvent[], budget: { left: number; used: number }) {
  const office = await locateCompany(company, budget);
  await locateCustomers(company.id, budget);
  const customers = await loadLocatedCustomers(company.id);
  if (!office && customers.length === 0) return { notifications: 0, emails: 0 };

  const minWind = company.storm_min_wind_mph ?? 35;
  const areaRadius = company.storm_area_radius_miles ?? 50;
  const contactRadius = Number(company.storm_contact_radius_miles ?? 3);
  const qualifying = ground.filter((e) => qualifies(e, minWind));
  const seen = await loadRecentLog(company.id);
  const pending: PendingAlert[] = [];

  if (office) {
    const hits = nearby(qualifying, office.lat, office.lon, areaRadius).filter(
      (h) => !seen.has(logId('area', null, h.event.key)),
    );
    if (hits.length) pending.push({ scope: 'area', customer: null, center: office, hits });
  }

  if (customers.length) {
    const box = boundingBox(customers, contactRadius);
    let radar: StormEvent[] = [];
    try {
      radar = await fetchRadarHail(box);
    } catch (err) {
      console.warn('[storm-alerts] radar hail', err);
    }
    const candidates = [...qualifying.filter((e) => inBox(box, e)), ...radar];
    if (candidates.length) {
      for (const c of customers) {
        const hits = nearby(candidates, c.latitude, c.longitude, contactRadius).filter(
          (h) => !seen.has(logId('contact', c.id, h.event.key)),
        );
        if (hits.length) pending.push({ scope: 'contact', customer: c, center: { lat: c.latitude, lon: c.longitude }, hits });
      }
    }
  }
  if (!pending.length) return { notifications: 0, emails: 0 };

  const { data: memberRows, error: membersError } = await admin
    .from('team_members')
    .select('id, user_id, email, full_name, role')
    .eq('company_id', company.id)
    .eq('is_active', true)
    .not('user_id', 'is', null);
  if (membersError) throw membersError;
  const members = (memberRows ?? []) as Member[];

  const notifications: Record<string, unknown>[] = [];
  const logs: Record<string, unknown>[] = [];
  const emails = new Map<string, Array<{ title: string; message: string }>>();

  for (const alert of pending) {
    const recipients = alert.scope === 'area' ? members : contactRecipients(company, alert.customer!, members);
    const content = buildContent(company, alert, areaRadius, contactRadius);
    for (const m of recipients) {
      notifications.push({ company_id: company.id, user_id: m.user_id, read: false, ...content });
      if (company.storm_email_enabled !== false && m.email) {
        const list = emails.get(m.email) ?? [];
        list.push({ title: content.title, message: content.message });
        emails.set(m.email, list);
      }
    }
    for (const h of alert.hits) {
      logs.push({ company_id: company.id, customer_id: alert.customer?.id ?? null, scope: alert.scope, event_key: h.event.key });
    }
  }

  for (let i = 0; i < notifications.length; i += 200) {
    const { error } = await admin.from('notifications').insert(notifications.slice(i, i + 200));
    if (error) throw error;
  }
  for (let i = 0; i < logs.length; i += 500) {
    const { error } = await admin
      .from('storm_alert_log')
      .upsert(logs.slice(i, i + 500), { onConflict: 'company_id,scope,customer_id,event_key', ignoreDuplicates: true });
    if (error) throw error;
  }

  let sent = 0;
  if (!RESEND_API_KEY && emails.size) console.warn('[storm-alerts] RESEND_API_KEY is not set; skipping storm alert emails');
  for (const [to, sections] of emails) {
    if (await sendEmail(to, company.name ?? 'your company', sections)) sent++;
  }
  return { notifications: notifications.length, emails: sent };
}

async function runStormAlerts() {
  const { data: companies, error } = await admin
    .from('companies')
    .select(COMPANY_COLUMNS)
    .eq('storm_alerts_enabled', true);
  if (error) throw error;

  const summary = { companies: companies?.length ?? 0, notifications: 0, emails: 0, geocoded: 0, errors: [] as string[] };
  if (!companies?.length) return summary;

  const ground = await fetchGroundReports();
  const budget = { left: GEOCODE_BUDGET_PER_RUN, used: 0 };
  for (const company of companies as Company[]) {
    try {
      const result = await processCompany(company, ground, budget);
      summary.notifications += result.notifications;
      summary.emails += result.emails;
    } catch (err) {
      console.error('[storm-alerts] company', company.id, err);
      summary.errors.push(`${company.id}: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    }
  }
  summary.geocoded = budget.used;

  await admin
    .from('storm_alert_log')
    .delete()
    .lt('created_at', new Date(Date.now() - LOG_RETENTION_DAYS * 86400e3).toISOString());
  return summary;
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = req.headers.get('x-storm-alerts-secret') ?? '';
  if (!secret) return json({ error: 'Unauthorized' }, 401);
  const { data: ok, error } = await admin.rpc('storm_alerts_secret_matches', { p_secret: secret });
  if (error || ok !== true) return json({ error: 'Unauthorized' }, 401);

  try {
    return json(await runStormAlerts());
  } catch (err) {
    console.error('[storm-alerts]', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

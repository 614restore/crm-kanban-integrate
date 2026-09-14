/**
 * Vercel Edge Function — address lookup for Storm Search and the hail lookup.
 *
 * The browser can't geocode directly: the US Census geocoder sends no CORS
 * headers, and Nominatim refuses requests that don't identify the app. This
 * runs server-side, tries the Census geocoder first (precise for US street
 * addresses), then Nominatim.
 *
 * GET /api/geocode?q=<address>   Authorization: Bearer <Supabase access token>
 * Returns { lat, lon, displayName } or 404 when the address isn't found.
 */
import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=3600' },
  });

async function isSignedIn(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ') || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return false;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error } = await admin.auth.getUser(authHeader.slice(7));
  return !error && !!user;
}

async function censusLookup(q: string) {
  const res = await fetch(
    `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(q)}&benchmark=Public_AR_Current&format=json`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  const match = data?.result?.addressMatches?.[0];
  if (!match?.coordinates) return null;
  return {
    lat: match.coordinates.y,
    lon: match.coordinates.x,
    displayName: match.matchedAddress as string,
    state: (match.addressComponents?.state as string | undefined) ?? null,
  };
}

async function nominatimLookup(q: string) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=us&addressdetails=1`,
    { headers: { 'User-Agent': 'TrussCTR/1.0 (https://trussctr.614restore.com)', 'Accept-Language': 'en' } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  // ISO3166-2-lvl4 is e.g. "US-OH".
  const iso = data[0].address?.['ISO3166-2-lvl4'];
  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
    displayName: data[0].display_name as string,
    state: typeof iso === 'string' && iso.startsWith('US-') ? iso.slice(3) : null,
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  if (!q || q.length > 300) return json({ error: 'Enter an address to search.' }, 400);

  if (!(await isSignedIn(req))) return json({ error: 'Unauthorized' }, 401);

  for (const lookup of [censusLookup, nominatimLookup]) {
    try {
      const found = await lookup(q);
      if (found && Number.isFinite(found.lat) && Number.isFinite(found.lon)) return json(found);
    } catch (err) {
      console.warn('[geocode]', lookup.name, err);
    }
  }
  return json({ error: 'Address not found' }, 404);
}

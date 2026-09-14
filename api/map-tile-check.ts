/**
 * Vercel Edge Function — checks a map or radar provider for Settings → Map Provider
 * and the Storm Search maps.
 *
 * A browser can't tell a rejected map key from a working one: providers such as
 * MapTiler answer with an "Invalid key" picture, and an <img> never exposes the
 * HTTP status. This fetches one sample tile server-side, sending this app's
 * address as Origin and Referer (what the provider checks against the key's
 * allowed origins), and reports what the provider really said.
 *
 * GET /api/map-tile-check?url=<https tile url>   Authorization: Bearer <Supabase access token>
 * Returns { ok, status, detail }: ok when the provider returned an image with HTTP 2xx.
 */
import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CHECK_TIMEOUT_MS = 8000;

// Public https hosts only: no IP addresses, localhost or internal names.
const BLOCKED_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.internal|\d{1,3}(\.\d{1,3}){3}|\[.*\])$/i;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  if (!(await isSignedIn(req))) return json({ error: 'Unauthorized' }, 401);

  const raw = new URL(req.url).searchParams.get('url') ?? '';
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return json({ ok: false, status: 0, detail: 'That is not a valid address.' });
  }
  if (target.protocol !== 'https:' || BLOCKED_HOST.test(target.hostname) || raw.length > 2000) {
    return json({ ok: false, status: 0, detail: 'Map addresses must be public https addresses.' });
  }

  const appOrigin = new URL(req.url).origin;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(target.toString(), {
      headers: { Origin: appOrigin, Referer: `${appOrigin}/`, Accept: 'image/*' },
      redirect: 'follow',
      signal: controller.signal,
    });
    const type = res.headers.get('content-type') ?? '';
    const isImage = type.startsWith('image/');
    const ok = res.ok && isImage;
    let detail = '';
    if (!ok && !isImage) {
      try {
        detail = (await res.text()).replace(/\s+/g, ' ').trim().slice(0, 160);
      } catch {
        detail = '';
      }
      if (!detail) detail = `The provider did not return an image (${type || 'unknown type'}).`;
    }
    return json({ ok, status: res.status, detail });
  } catch {
    return json({ ok: false, status: 0, detail: 'Could not reach the provider.' });
  } finally {
    clearTimeout(timer);
  }
}

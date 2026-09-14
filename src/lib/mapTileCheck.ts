// Checks that a map or radar provider really serves tiles, through
// /api/map-tile-check. A browser alone can't: rejected keys come back as an
// "Invalid key" picture, and images don't expose their HTTP status.
import { supabase } from '@/lib/supabase';

export interface TileCheckResult {
  ok: boolean;
  /** False when the check itself couldn't run (offline, local dev), so the result says nothing about the provider. */
  conclusive: boolean;
  status: number;
  message: string;
  /** The sample tile that was checked, for a preview. */
  sampleUrl: string;
}

/** One tile over central Ohio at zoom 10. */
export function sampleTileUrl(template: string, subdomains = 'abc'): string {
  return template
    .replace(/\{s\}/g, subdomains.charAt(0) || 'a')
    .replace(/\{r\}/g, '')
    .replace(/\{z\}/g, '10')
    .replace(/\{x\}/g, '275')
    .replace(/\{y\}/g, '387');
}

function describeFailure(status: number, detail: string): string {
  const host = typeof window !== 'undefined' ? window.location.host : 'this web address';
  if (status === 401 || status === 403) {
    return `The provider rejected the key (HTTP ${status}). Check that the key is copied exactly and that its allowed origins include ${host}.`;
  }
  if (status === 404) return 'The provider has no map at that address (HTTP 404). Check the map style or tile address.';
  if (status === 429) return 'The provider says the key is over its usage limit (HTTP 429).';
  if (status === 0) return detail || 'Could not reach the provider.';
  return `The provider returned HTTP ${status}${detail ? `: ${detail}` : ''}.`;
}

const cache = new Map<string, Promise<TileCheckResult>>();

/** Forget earlier results, e.g. after the key's settings change. */
export function clearTileCheckCache() {
  cache.clear();
}

async function runCheck(sampleUrl: string): Promise<TileCheckResult> {
  const inconclusive = (status = 0): TileCheckResult => ({
    ok: false,
    conclusive: false,
    status,
    message: 'The map provider could not be checked right now. Try again in a moment.',
    sampleUrl,
  });
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/map-tile-check?url=${encodeURIComponent(sampleUrl)}`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || typeof body.ok !== 'boolean') return inconclusive(res.status);
    if (body.ok) return { ok: true, conclusive: true, status: body.status, message: 'Works', sampleUrl };
    return {
      ok: false,
      conclusive: true,
      status: Number(body.status) || 0,
      message: describeFailure(Number(body.status) || 0, typeof body.detail === 'string' ? body.detail : ''),
      sampleUrl,
    };
  } catch {
    return inconclusive();
  }
}

/** Checks a tile address; results are remembered for the page unless fresh is set. */
export function checkTileUrl(template: string, subdomains = 'abc', fresh = false): Promise<TileCheckResult> {
  const sampleUrl = sampleTileUrl(template, subdomains);
  const cached = cache.get(sampleUrl);
  if (cached && !fresh) return cached;
  const pending = runCheck(sampleUrl);
  cache.set(sampleUrl, pending);
  return pending;
}

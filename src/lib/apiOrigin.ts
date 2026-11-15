// Where the app's own server functions (/api/...) live.
//
// The website calls /api on the site it is served from. TrussCTR's iPhone app runs from
// capacitor://localhost, which has no /api, so in the app those calls go to the live site.
// installNativeApiFetch() does this for every fetch, so no call site has to know.
import { IS_NATIVE_APP } from './inAppMode';

export const API_ORIGIN: string = (
  (import.meta.env.VITE_API_ORIGIN as string | undefined)?.trim() || 'https://trussctr.614restore.com'
).replace(/\/$/, '');

/** The live-site address for an /api/... request made from the app; anything else unchanged. */
export function rewriteApiUrl(url: string, pageOrigin: string, apiOrigin: string = API_ORIGIN): string {
  if (url.startsWith('/api/')) return apiOrigin + url;
  if (url.startsWith(`${pageOrigin}/api/`)) return apiOrigin + url.slice(pageOrigin.length);
  return url;
}

/** In the iPhone app, send /api/... requests to the live site. Does nothing on the website. */
export function installNativeApiFetch(): void {
  if (!IS_NATIVE_APP || typeof window === 'undefined') return;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const target = rewriteApiUrl(url, window.location.origin);
    if (target === url) return original(input, init);
    return original(input instanceof Request ? new Request(target, input) : target, init);
  };
}

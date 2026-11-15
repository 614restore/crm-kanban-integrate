// Cross-origin access for the API, for the callers that are not the website itself:
// TrussCTR's iPhone app (pages served from capacitor://localhost), Vercel previews and
// local development. The website calls /api on its own origin and needs none of this.

const FIXED = new Set(['https://trussctr.614restore.com', 'capacitor://localhost', 'ionic://localhost']);

/** The origin to allow for this request, or null when it is not one of ours. */
export function allowedOrigin(origin) {
  if (!origin) return null;
  if (FIXED.has(origin)) return origin;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}

export function corsHeaders(origin, methods = 'GET, POST, OPTIONS') {
  const allowed = allowedOrigin(origin);
  if (!allowed) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

/**
 * Node-style handlers (req, res): sets the headers, and answers a preflight.
 * Returns true when the request was a preflight and has been answered.
 */
export function applyCors(req, res, methods) {
  for (const [k, v] of Object.entries(corsHeaders(req.headers.origin, methods))) res.setHeader(k, v);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

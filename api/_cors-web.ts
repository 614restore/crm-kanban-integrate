// Cross-origin access for Web-style handlers (Request => Response). Same rules as
// _cors.mjs, which the Node-style handlers use: the iPhone app (capacitor://localhost),
// Vercel previews and local development may call the API from another origin.

const FIXED = new Set(['https://trussctr.614restore.com', 'capacitor://localhost', 'ionic://localhost']);

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (FIXED.has(origin)) return origin;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}

/** Wraps a handler: answers preflights and adds the headers to every response. */
export function withCors(
  handler: (req: Request) => Promise<Response>,
  methods = 'GET, POST, OPTIONS',
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const allowed = allowedOrigin(req.headers.get('origin'));
    const headers: Record<string, string> = { Vary: 'Origin' };
    if (allowed) {
      headers['Access-Control-Allow-Origin'] = allowed;
      headers['Access-Control-Allow-Methods'] = methods;
      headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
      headers['Access-Control-Max-Age'] = '600';
    }
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const res = await handler(req);
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
    return out;
  };
}

// Copied from QuoteMGR api/ai-proxy.ts (read-only reference).
// TrussCTR change: CORS preflight origin is TrussCTR's domain. Keys still
// resolve server-side from the caller's personal key, then their company's.
/**
 * Vercel Edge Function — AI provider proxy
 *
 * All AI provider calls (Anthropic, OpenAI, Google Gemini, Groq) are routed
 * through this endpoint instead of being called directly from the browser.
 * Direct browser→provider calls fail with CORS preflight errors because AI
 * providers do not allow cross-origin requests from web pages.
 *
 * Security model:
 *  - Caller must supply a valid Supabase JWT in Authorization: Bearer <token>
 *  - Provider API keys are NEVER accepted from the client — they are resolved
 *    server-side from the company's ai_configurations row
 *  - Only the provider that matches the company's stored config is forwarded
 *
 * Request body:
 *   provider  — "openai" | "anthropic" | "google" | "groq"
 *   model     — model identifier (used in Google URL construction)
 *   body      — full provider-specific request body
 *   image_url — (optional) for Google Gemini vision: image is downloaded
 *               server-side here and injected as inline_data, since Gemini
 *               requires base64 and the browser can't fetch cross-origin images.
 *               Anthropic/OpenAI handle image URLs natively server-side.
 *
 * Environment variables required (server-only — no VITE_ prefix):
 *   SUPABASE_URL              — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key (never sent to browser)
 */
import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface AIConfiguration {
  provider: 'openai' | 'anthropic' | 'google' | 'groq';
  api_key: string;
  model: string;
  enabled: boolean;
  vision_provider?: 'openai' | 'anthropic' | 'google' | null;
  vision_api_key?: string | null;
  vision_model?: string | null;
}

/**
 * Verify the bearer token and return the AI configuration to use.
 * Resolution order:
 *   1. user_ai_configs row for the authenticated user (personal key)
 *   2. ai_configurations row for the user's company (team default)
 * Returns null if the token is invalid or no config exists at either level.
 */
async function resolveAIConfig(token: string): Promise<AIConfiguration | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[ai-proxy] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
    return null;
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify JWT and resolve the Supabase Auth user
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return null;

  // 1. Check for a personal API key set by this user
  const { data: userConfig } = await admin
    .from('user_ai_configs')
    .select('provider, api_key, model, enabled, vision_provider, vision_api_key, vision_model')
    .eq('user_id', user.id)
    .maybeSingle();

  if (userConfig) return userConfig as AIConfiguration;

  // 2. Fall back to the company-wide config
  const { data: member } = await admin
    .from('team_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!member?.company_id) return null;

  const { data: companyConfig } = await admin
    .from('ai_configurations')
    .select('provider, api_key, model, enabled, vision_provider, vision_api_key, vision_model')
    .eq('company_id', member.company_id)
    .maybeSingle();

  return companyConfig as AIConfiguration | null;
}

export default async function handler(req: Request): Promise<Response> {
  const jsonHeaders = { 'Content-Type': 'application/json' };

  // Handle CORS preflight (same-origin calls don't trigger this, but belt-and-suspenders)
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': 'https://trussctr.614restore.com',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  // ── Auth gate ─────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: jsonHeaders,
    });
  }
  const token = authHeader.slice(7);

  const aiConfig = await resolveAIConfig(token);
  if (!aiConfig) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: jsonHeaders,
    });
  }
  if (!aiConfig.enabled) {
    return new Response(JSON.stringify({ error: 'AI features are not enabled for this account' }), {
      status: 403,
      headers: jsonHeaders,
    });
  }

  // ── Parse request — no api_key accepted from client ───────────────────────
  let provider: string;
  let model: string;
  let body: Record<string, unknown>;
  let image_url: string | undefined;

  try {
    ({ provider, model, body, image_url } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  if (!provider || !body) {
    return new Response(JSON.stringify({ error: 'Missing required fields: provider, body' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  // ── Resolve API key server-side ───────────────────────────────────────────
  // A request may use either the primary provider or the vision provider.
  let resolvedApiKey: string;
  if (provider === aiConfig.provider) {
    resolvedApiKey = aiConfig.api_key;
  } else if (provider === aiConfig.vision_provider && aiConfig.vision_api_key) {
    resolvedApiKey = aiConfig.vision_api_key;
  } else {
    return new Response(
      JSON.stringify({ error: `Provider '${provider}' is not configured for this account` }),
      { status: 400, headers: jsonHeaders }
    );
  }

  // ── Google Gemini: inline base64 images ──────────────────────────────────
  // Gemini requires base64 inline_data. Download server-side so the browser
  // never needs to fetch the cross-origin image URL.
  if (provider === 'google' && image_url) {
    try {
      const imgRes = await fetch(image_url);
      if (!imgRes.ok) {
        return new Response(
          JSON.stringify({ error: { message: `Could not load image for analysis (HTTP ${imgRes.status}). Check that the photo URL is accessible.` } }),
          { status: 400, headers: jsonHeaders }
        );
      }
      const imgBuf = await imgRes.arrayBuffer();
      const bytes = new Uint8Array(imgBuf);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';

      const contents = (body as any).contents;
      if (Array.isArray(contents) && contents[0]?.parts) {
        contents[0].parts.push({ inline_data: { mime_type: mimeType, data: base64 } });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return new Response(
        JSON.stringify({ error: { message: `Image download failed: ${message}` } }),
        { status: 400, headers: jsonHeaders }
      );
    }
  }

  // ── Build provider URL and auth headers ───────────────────────────────────
  let url: string;
  const providerHeaders: Record<string, string> = { 'Content-Type': 'application/json' };

  switch (provider) {
    case 'openai':
      url = 'https://api.openai.com/v1/chat/completions';
      providerHeaders['Authorization'] = `Bearer ${resolvedApiKey}`;
      break;
    case 'anthropic':
      url = 'https://api.anthropic.com/v1/messages';
      providerHeaders['x-api-key'] = resolvedApiKey;
      providerHeaders['anthropic-version'] = '2023-06-01';
      break;
    case 'google':
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${resolvedApiKey}`;
      break;
    case 'groq':
      url = 'https://api.groq.com/openai/v1/chat/completions';
      providerHeaders['Authorization'] = `Bearer ${resolvedApiKey}`;
      break;
    default:
      return new Response(JSON.stringify({ error: `Unsupported provider: ${provider}` }), {
        status: 400,
        headers: jsonHeaders,
      });
  }

  // ── Forward to provider ───────────────────────────────────────────────────
  const providerRes = await fetch(url, {
    method: 'POST',
    headers: providerHeaders,
    body: JSON.stringify(body),
  });

  const data = await providerRes.json();
  return new Response(JSON.stringify(data), {
    status: providerRes.status,
    headers: jsonHeaders,
  });
}

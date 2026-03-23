/**
 * eagleview-proxy — Supabase Edge Function
 *
 * Why this exists:
 * - EagleView's API blocks cross-origin (CORS) requests from browsers.
 * - The API credentials (apiKey / clientId / OAuth tokens) must never be
 *   exposed to the frontend JS bundle.
 *
 * Routes (passed via ?action=... query param):
 *   test          — verify credentials & return account info
 *   order         — place a new measurement order
 *   status        — get order status
 *   download      — get signed download URL for completed report
 *   list          — list recent orders for this company
 *   credits       — get remaining credit balance
 *
 * Auth:
 * - EagleView supports two auth styles depending on partner tier:
 *   1. Simple API Key  → Authorization: Bearer {apiKey}
 *   2. OAuth 2.0       → POST /connect/token → get access_token → use as Bearer
 * - This function auto-detects which style to use based on stored credentials.
 * - If oauth client_secret is present → use client_credentials OAuth flow.
 * - Otherwise → use apiKey directly as Bearer token.
 *
 * Credential storage:
 * - Reads from company_integrations table (server-side, never exposed to client).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const EV_PROD_BASE = 'https://api.eagleview.com';
const EV_SAND_BASE = 'https://sandbox-api.eagleview.com';
const EV_IAM_PROD  = 'https://iam.eagleview.com';
const EV_IAM_SAND  = 'https://iam.eagleview.com'; // same IAM for sandbox

// ─── Token cache (per invocation — functions are stateless but this avoids
//     double-fetching within a single request chain) ──────────────────────────
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getOAuthToken(
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
  companyId: string
): Promise<string> {
  const cached = tokenCache.get(companyId);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'eagleview',
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`EagleView OAuth failed (${res.status}): ${txt}`);
  }

  const json = await res.json();
  const token = json.access_token;
  const expiresIn = json.expires_in ?? 3600;
  tokenCache.set(companyId, { token, expiresAt: Date.now() + expiresIn * 1000 });
  return token;
}

async function getCredentials(supabase: any, companyId: string) {
  const { data, error } = await supabase
    .from('company_integrations')
    .select('credentials, settings')
    .eq('company_id', companyId)
    .eq('integration_type', 'eagleview')
    .single();

  if (error || !data) throw new Error('EagleView not configured for this company');
  return data.credentials as Record<string, string>;
}

async function buildEvHeaders(
  creds: Record<string, string>,
  companyId: string,
  environment: string
): Promise<{ headers: HeadersInit; baseUrl: string }> {
  const baseUrl = environment === 'production' ? EV_PROD_BASE : EV_SAND_BASE;

  if (creds.clientSecret) {
    // OAuth 2.0 client credentials flow
    const iamBase = environment === 'production' ? EV_IAM_PROD : EV_IAM_SAND;
    const tokenUrl = `${iamBase}/connect/token`;
    const token = await getOAuthToken(tokenUrl, creds.clientId, creds.clientSecret, companyId);
    return {
      baseUrl,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };
  }

  // Simple API key mode (some EagleView partner tiers)
  return {
    baseUrl,
    headers: {
      Authorization: `Bearer ${creds.apiKey}`,
      'X-Client-ID': creds.clientId || '',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth: verify caller is authenticated ──────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Get company ID ────────────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: 'No company found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const companyId = profile.company_id;
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'test';
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

    // Use service-role client to read credentials securely
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const creds = await getCredentials(serviceSupabase, companyId);
    const environment = creds.environment || 'production';
    const { headers: evHeaders, baseUrl } = await buildEvHeaders(creds, companyId, environment);

    // ── Route to EagleView API ────────────────────────────────────────────────
    let evResponse: Response;

    switch (action) {
      case 'test': {
        // Try /v1/account first; fall back to /v2/account if that fails
        evResponse = await fetch(`${baseUrl}/v1/account`, {
          method: 'GET',
          headers: evHeaders,
        });

        if (evResponse.status === 404) {
          evResponse = await fetch(`${baseUrl}/v2/account`, {
            method: 'GET',
            headers: evHeaders,
          });
        }
        break;
      }

      case 'credits': {
        evResponse = await fetch(`${baseUrl}/v1/account/credits`, {
          method: 'GET',
          headers: evHeaders,
        });
        break;
      }

      case 'order': {
        // POST /v1/orders — place a new measurement order
        const { address, reportType, contactId, customerName } = body;
        if (!address) {
          return new Response(JSON.stringify({ error: 'address is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const orderPayload: Record<string, any> = {
          address,
          report_type: reportType || 'standard',
        };
        if (customerName) orderPayload.customer_name = customerName;
        if (contactId)    orderPayload.metadata = { contact_id: contactId };

        evResponse = await fetch(`${baseUrl}/v1/orders`, {
          method: 'POST',
          headers: evHeaders,
          body: JSON.stringify(orderPayload),
        });

        // On success: store the order in eagleview_orders table
        if (evResponse.ok) {
          const orderData = await evResponse.clone().json();
          await serviceSupabase.from('eagleview_orders').upsert({
            company_id: companyId,
            eagleview_order_id: orderData.order_id ?? orderData.id,
            status: orderData.status ?? 'pending',
            report_type: reportType,
            address,
            environment,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'eagleview_order_id' });
        }
        break;
      }

      case 'status': {
        const orderId = url.searchParams.get('orderId') || body.orderId;
        if (!orderId) {
          return new Response(JSON.stringify({ error: 'orderId is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        evResponse = await fetch(`${baseUrl}/v1/orders/${encodeURIComponent(orderId)}`, {
          method: 'GET',
          headers: evHeaders,
        });

        // Update local record
        if (evResponse.ok) {
          const statusData = await evResponse.clone().json();
          await serviceSupabase
            .from('eagleview_orders')
            .update({
              status: statusData.status ?? 'unknown',
              report_url: statusData.report_url ?? statusData.download_url ?? null,
              completed_at: statusData.status?.toLowerCase().includes('complete')
                ? new Date().toISOString()
                : null,
              updated_at: new Date().toISOString(),
            })
            .eq('eagleview_order_id', orderId);
        }
        break;
      }

      case 'list': {
        const limit  = url.searchParams.get('limit')  || '20';
        const offset = url.searchParams.get('offset') || '0';
        evResponse = await fetch(
          `${baseUrl}/v1/orders?limit=${limit}&offset=${offset}`,
          { method: 'GET', headers: evHeaders }
        );
        break;
      }

      case 'download': {
        const orderId = url.searchParams.get('orderId') || body.orderId;
        const format  = url.searchParams.get('format')  || 'pdf';
        if (!orderId) {
          return new Response(JSON.stringify({ error: 'orderId is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        evResponse = await fetch(
          `${baseUrl}/v1/orders/${encodeURIComponent(orderId)}/download?format=${format}`,
          { method: 'GET', headers: evHeaders }
        );
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // ── Relay EagleView response back to frontend ──────────────────────────────
    const evBody = await evResponse.text();
    const contentType = evResponse.headers.get('content-type') || 'application/json';

    return new Response(evBody, {
      status: evResponse.status,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'X-EV-Status': evResponse.status.toString(),
      },
    });

  } catch (err: any) {
    console.error('[eagleview-proxy] Error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

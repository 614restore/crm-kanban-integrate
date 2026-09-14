// Copied unchanged from QuoteMGR supabase/functions/validate-lender-credentials (read-only reference).
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-lender validation rules
// ─────────────────────────────────────────────────────────────────────────────

interface FieldRule {
  label: string;
  minLength: number;
  pattern?: RegExp;
  patternHint?: string;
}

interface LenderConfig {
  name: string;
  fields: Record<string, FieldRule>;
  /** Known HTTPS endpoint to ping for reachability check */
  pingUrl: string;
  /** Expected status codes that confirm the server is live (401/403 = up but needs auth = good) */
  liveStatusCodes: number[];
  /** Optional: real auth endpoint + how to build the request */
  authCheck?: (creds: Record<string, string>) => Request | null;
}

const LENDER_CONFIGS: Record<string, LenderConfig> = {
  hearth: {
    name: 'Hearth',
    fields: {
      api_key: { label: 'API Key', minLength: 20 },
      api_secret: { label: 'API Secret', minLength: 20 },
      merchant_id: { label: 'Contractor ID', minLength: 4 },
    },
    // api.hearth.com does not resolve (verified 2026-08-19) — no confirmed
    // API subdomain to replace it with, so pinging the main site instead of
    // a guessed endpoint. No authCheck for the same reason.
    pingUrl: 'https://www.hearth.com',
    liveStatusCodes: [200, 301, 302, 400, 401, 403, 404, 405],
  },
  greensky: {
    name: 'GreenSky',
    fields: {
      api_key: { label: 'Merchant ID', minLength: 4 },
      api_secret: { label: 'API Key', minLength: 10 },
      merchant_id: { label: 'Plan ID', minLength: 2 },
    },
    // api.greenskyonline.com does not resolve (verified 2026-08-19) — pinging
    // the confirmed-live main domain instead.
    pingUrl: 'https://www.greenskyonline.com',
    liveStatusCodes: [200, 301, 302, 400, 401, 403, 404, 405],
  },
  service_finance: {
    name: 'Service Finance',
    fields: {
      api_key: { label: 'Dealer ID', minLength: 3 },
      api_secret: { label: 'API Token', minLength: 10 },
      merchant_id: { label: 'Program Code', minLength: 2 },
    },
    pingUrl: 'https://www.servicefinanceco.com',
    liveStatusCodes: [200, 301, 302, 400, 401, 403, 404, 405],
  },
  synchrony: {
    name: 'Synchrony',
    fields: {
      api_key: { label: 'Merchant Number', minLength: 6 },
      api_secret: { label: 'Security Code', minLength: 4 },
      merchant_id: { label: 'Store Number', minLength: 2 },
    },
    // digitalbuying.synchrony.com does not resolve (verified 2026-08-19) —
    // pinging the same domain this app's own signup link already uses.
    pingUrl: 'https://www.synchronybusiness.com',
    liveStatusCodes: [200, 301, 302, 400, 401, 403, 404, 405],
  },
  foundation: {
    name: 'Foundation Finance',
    fields: {
      api_key: { label: 'Dealer Number', minLength: 4 },
      api_secret: { label: 'API Key', minLength: 10 },
      merchant_id: { label: 'Region Code', minLength: 2 },
    },
    pingUrl: 'https://www.foundationfinanceco.com',
    liveStatusCodes: [200, 301, 302, 400, 401, 403, 404, 405],
  },
  sunlight: {
    name: 'Sunlight Financial',
    fields: {
      api_key: { label: 'Contractor ID', minLength: 8 },
      api_secret: { label: 'API Secret', minLength: 16 },
      merchant_id: { label: 'Product Type', minLength: 2 },
    },
    pingUrl: 'https://www.sunlightfinancial.com',
    liveStatusCodes: [200, 301, 302, 400, 401, 403, 404, 405],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────────────────────

interface FieldResult {
  field: string;
  label: string;
  ok: boolean;
  message: string;
}

function validateFields(
  config: LenderConfig,
  creds: Record<string, string>,
): FieldResult[] {
  return Object.entries(config.fields).map(([field, rule]) => {
    const value = (creds[field] ?? '').trim();

    if (!value) {
      return { field, label: rule.label, ok: false, message: `${rule.label} is required` };
    }

    if (value.length < rule.minLength) {
      return {
        field,
        label: rule.label,
        ok: false,
        message: `${rule.label} is too short (minimum ${rule.minLength} characters)`,
      };
    }

    if (rule.pattern && !rule.pattern.test(value)) {
      return {
        field,
        label: rule.label,
        ok: false,
        message: `${rule.label} format is invalid${rule.patternHint ? ` — ${rule.patternHint}` : ''}`,
      };
    }

    return { field, label: rule.label, ok: true, message: `${rule.label} looks good` };
  });
}

async function pingDomain(
  pingUrl: string,
  liveStatusCodes: number[],
): Promise<{ reachable: boolean; status: number | null; error: string | null }> {
  try {
    const res = await fetch(pingUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    });
    const reachable = liveStatusCodes.includes(res.status);
    return { reachable, status: res.status, error: null };
  } catch (err) {
    return { reachable: false, status: null, error: (err as Error).message };
  }
}

async function tryAuthCheck(
  config: LenderConfig,
  creds: Record<string, string>,
): Promise<{ attempted: boolean; status: number | null; credentialsValid: boolean | null; message: string }> {
  if (!config.authCheck) {
    return { attempted: false, status: null, credentialsValid: null, message: 'No auth check available for this lender' };
  }

  const req = config.authCheck(creds);
  if (!req) {
    return { attempted: false, status: null, credentialsValid: null, message: 'Credentials incomplete for auth check' };
  }

  try {
    const res = await fetch(req, { signal: AbortSignal.timeout(8000) });

    if (res.status === 200 || res.status === 204) {
      return { attempted: true, status: res.status, credentialsValid: true, message: 'Credentials verified successfully' };
    }

    if (res.status === 401) {
      return { attempted: true, status: 401, credentialsValid: false, message: 'Credentials rejected — double-check your API key' };
    }

    if (res.status === 403) {
      return { attempted: true, status: 403, credentialsValid: false, message: 'Access denied — your account may not be fully activated yet' };
    }

    // 4xx or 5xx that still proves server is reachable — treat as inconclusive
    return {
      attempted: true,
      status: res.status,
      credentialsValid: null,
      message: `Server responded with ${res.status} — credentials format is accepted, but full verification requires lender activation`,
    };
  } catch (err) {
    return { attempted: true, status: null, credentialsValid: null, message: `Auth check failed: ${(err as Error).message}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { lender_key, credentials, company_id } = await req.json() as {
      lender_key: string;
      credentials: Record<string, string>;
      company_id: string;
    };

    if (!lender_key || !credentials || !company_id) {
      return new Response(JSON.stringify({ error: 'Missing lender_key, credentials, or company_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const config = LENDER_CONFIGS[lender_key];
    if (!config) {
      return new Response(JSON.stringify({ error: `Unknown lender: ${lender_key}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Field-level validation
    const fieldResults = validateFields(config, credentials);
    const allFieldsOk = fieldResults.every(f => f.ok);

    // 2. Connectivity ping (run even if fields fail, so we can report server status)
    const [pingResult, authResult] = await Promise.all([
      pingDomain(config.pingUrl, config.liveStatusCodes),
      allFieldsOk ? tryAuthCheck(config, credentials) : Promise.resolve({
        attempted: false,
        status: null,
        credentialsValid: null,
        message: 'Fix field errors before attempting auth check',
      }),
    ]);

    // 3. Build overall verdict
    const overallOk =
      allFieldsOk &&
      pingResult.reachable &&
      (authResult.credentialsValid !== false); // null = inconclusive (still ok to save)

    const summary = !allFieldsOk
      ? `Fix the highlighted fields before saving`
      : !pingResult.reachable
      ? `${config.name} servers appear unreachable — check your network or try again later`
      : authResult.credentialsValid === false
      ? authResult.message
      : authResult.credentialsValid === true
      ? `All checks passed — credentials verified with ${config.name}`
      : `Credentials look valid. The final confirmation comes when ${config.name} sends your first webhook.`;

    return new Response(JSON.stringify({
      ok: overallOk,
      lender: config.name,
      summary,
      fields: fieldResults,
      connectivity: {
        reachable: pingResult.reachable,
        status: pingResult.status,
        error: pingResult.error,
      },
      auth: authResult,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('validate-lender-credentials error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

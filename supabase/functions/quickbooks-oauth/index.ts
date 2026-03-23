/**
 * quickbooks-oauth — Supabase Edge Function
 *
 * Handles QuickBooks Online OAuth 2.0 flow server-side so that:
 * - client_id / client_secret are never exposed to the browser
 * - Tokens are stored securely in company_integrations per company
 *
 * Actions (POST body { action, ... }):
 *   initiate  — generate state, return Intuit auth URL for redirect
 *   callback  — exchange authorization code for tokens, store in DB
 *   refresh   — refresh an expired access token
 *   test      — verify stored token works, return company name
 *   disconnect — revoke tokens and remove integration
 *
 * Required Edge Function secrets (set via `supabase secrets set`):
 *   QUICKBOOKS_CLIENT_ID
 *   QUICKBOOKS_CLIENT_SECRET
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const QB_AUTH_URL   = 'https://appcenter.intuit.com/connect/oauth2';
const QB_TOKEN_URL  = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QB_REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';
const QB_API_PROD   = 'https://quickbooks.api.intuit.com/v3/company';
const QB_API_SAND   = 'https://sandbox-quickbooks.api.intuit.com/v3/company';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Exchange or refresh tokens with Intuit's token endpoint */
async function fetchIntuitToken(
  clientId: string,
  clientSecret: string,
  params: Record<string, string>
): Promise<{ ok: boolean; data: any }> {
  const res = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      Accept: 'application/json',
    },
    body: new URLSearchParams(params).toString(),
  });

  const data = await res.json().catch(() => ({ error: 'non-json response' }));
  return { ok: res.ok, data };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ───────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!profile?.company_id) return json({ error: 'No company found' }, 400);

    const companyId = profile.company_id;

    // Service-role client for DB writes
    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── Parse request body ─────────────────────────────────────────────────────
    const body: Record<string, any> = req.method === 'POST'
      ? await req.json().catch(() => ({}))
      : {};
    const urlAction = new URL(req.url).searchParams.get('action');
    const action = body.action || urlAction || 'initiate';

    // ── QuickBooks app credentials ─────────────────────────────────────────────
    const clientId     = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      return json({ error: 'QuickBooks integration is not configured on this server. Contact your administrator.' }, 500);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ACTION: initiate
    // ──────────────────────────────────────────────────────────────────────────
    if (action === 'initiate') {
      const { redirectUri } = body;
      if (!redirectUri) return json({ error: 'redirectUri is required' }, 400);

      const state = crypto.randomUUID();

      // Upsert into oauth_states — one pending state per user+provider
      await db.from('oauth_states').upsert({
        user_id:       user.id,
        company_id:    companyId,
        provider:      'quickbooks',
        state,
        code_verifier: 'n/a',            // QB does not use PKCE; field is NOT NULL so use placeholder
        expires_at:    new Date(Date.now() + 10 * 60_000).toISOString(),
      }, { onConflict: 'user_id,provider' });

      const authUrl = new URL(QB_AUTH_URL);
      authUrl.searchParams.set('client_id',     clientId);
      authUrl.searchParams.set('scope',          'com.intuit.quickbooks.accounting');
      authUrl.searchParams.set('redirect_uri',   redirectUri);
      authUrl.searchParams.set('response_type',  'code');
      authUrl.searchParams.set('access_type',    'offline');
      authUrl.searchParams.set('state',          state);

      return json({ authUri: authUrl.toString(), state });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ACTION: callback
    // ──────────────────────────────────────────────────────────────────────────
    if (action === 'callback') {
      const { code, realmId, state, redirectUri } = body;
      if (!code || !realmId || !state) {
        return json({ error: 'code, realmId, and state are required' }, 400);
      }
      if (!redirectUri) {
        return json({ error: 'redirectUri is required' }, 400);
      }

      // Verify state
      const { data: stateRow } = await db
        .from('oauth_states')
        .select('id, expires_at')
        .eq('state', state)
        .eq('company_id', companyId)
        .eq('provider', 'quickbooks')
        .single();

      if (!stateRow) {
        return json({ error: 'Invalid OAuth state — the flow may have expired. Please try again.' }, 400);
      }
      if (new Date(stateRow.expires_at) < new Date()) {
        return json({ error: 'OAuth state expired. Please try again.' }, 400);
      }

      // Exchange code for tokens
      const { ok, data: tokens } = await fetchIntuitToken(clientId, clientSecret, {
        grant_type:   'authorization_code',
        code,
        redirect_uri: redirectUri,
      });

      if (!ok) {
        return json({ error: `Intuit token exchange failed: ${tokens?.error_description || JSON.stringify(tokens)}` }, 400);
      }

      const { access_token, refresh_token, expires_in, x_refresh_token_expires_in } = tokens;

      const tokenExpiresAt   = new Date(Date.now() + (expires_in           || 3_600)       * 1000).toISOString();
      const refreshExpiresAt = new Date(Date.now() + (x_refresh_token_expires_in || 8_726_400) * 1000).toISOString();

      // Store in company_integrations
      await db.from('company_integrations').upsert({
        company_id:                companyId,
        integration_type:          'quickbooks',
        credentials:               { realmId, environment: 'production' },
        access_token,
        refresh_token,
        token_expires_at:          tokenExpiresAt,
        refresh_token_expires_at:  refreshExpiresAt,
        connected:                 true,
        is_enabled:                true,
        updated_at:                new Date().toISOString(),
      }, { onConflict: 'company_id,integration_type' });

      // Clean up the state row
      await db.from('oauth_states').delete().eq('state', state);

      return json({ success: true, realmId });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ACTION: refresh
    // ──────────────────────────────────────────────────────────────────────────
    if (action === 'refresh') {
      const { data: integration } = await db
        .from('company_integrations')
        .select('refresh_token')
        .eq('company_id', companyId)
        .eq('integration_type', 'quickbooks')
        .single();

      if (!integration?.refresh_token) {
        return json({ error: 'No refresh token. Please reconnect QuickBooks.' }, 400);
      }

      const { ok, data: tokens } = await fetchIntuitToken(clientId, clientSecret, {
        grant_type:    'refresh_token',
        refresh_token: integration.refresh_token,
      });

      if (!ok) {
        return json({ error: `Token refresh failed: ${tokens?.error_description || JSON.stringify(tokens)}` }, 400);
      }

      const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in || 3_600) * 1000).toISOString();

      await db.from('company_integrations').update({
        access_token:     tokens.access_token,
        refresh_token:    tokens.refresh_token || integration.refresh_token,
        token_expires_at: tokenExpiresAt,
        updated_at:       new Date().toISOString(),
      }).eq('company_id', companyId).eq('integration_type', 'quickbooks');

      return json({ success: true });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ACTION: test
    // ──────────────────────────────────────────────────────────────────────────
    if (action === 'test') {
      const { data: integration } = await db
        .from('company_integrations')
        .select('access_token, token_expires_at, credentials')
        .eq('company_id', companyId)
        .eq('integration_type', 'quickbooks')
        .single();

      if (!integration?.access_token) {
        return json({ success: false, error: 'QuickBooks is not connected. Click "Connect QuickBooks" to authorize.' });
      }

      const realmId     = integration.credentials?.realmId;
      const environment = integration.credentials?.environment || 'production';
      const baseUrl     = environment === 'production' ? QB_API_PROD : QB_API_SAND;

      const qbRes = await fetch(`${baseUrl}/${realmId}/companyinfo/${realmId}?minorversion=65`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${integration.access_token}`,
          Accept: 'application/json',
        },
      });

      if (!qbRes.ok) {
        const txt = await qbRes.text();
        return json({ success: false, error: `QuickBooks API ${qbRes.status}: ${txt}` });
      }

      const data = await qbRes.json();
      const company = data.CompanyInfo;

      return json({
        success: true,
        companyName: company?.CompanyName,
        country:     company?.Country,
        realmId,
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ACTION: disconnect
    // ──────────────────────────────────────────────────────────────────────────
    if (action === 'disconnect') {
      const { data: integration } = await db
        .from('company_integrations')
        .select('refresh_token')
        .eq('company_id', companyId)
        .eq('integration_type', 'quickbooks')
        .single();

      // Best-effort revoke
      if (integration?.refresh_token) {
        await fetch(QB_REVOKE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
            Accept: 'application/json',
          },
          body: new URLSearchParams({ token: integration.refresh_token }).toString(),
        }).catch(() => {});
      }

      await db.from('company_integrations').update({
        access_token:     null,
        refresh_token:    null,
        token_expires_at: null,
        connected:        false,
        is_enabled:       false,
        updated_at:       new Date().toISOString(),
      }).eq('company_id', companyId).eq('integration_type', 'quickbooks');

      return json({ success: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err: any) {
    console.error('[quickbooks-oauth] Error:', err);
    return json({ error: err?.message || 'Internal server error' }, 500);
  }
});

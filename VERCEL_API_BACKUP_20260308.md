# TrussCTR Vercel API Backup — 2026-03-08

Total files: 12


## api/crypto-utils.mjs

```javascript
// AES-256-GCM encryption for QB tokens + HMAC CSRF state validation
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const key = process.env.QB_ENCRYPT_KEY || '';
  if (!key || key.length < 32) throw new Error('QB_ENCRYPT_KEY must be at least 32 characters');
  return Buffer.from(key.slice(0, 32));
}

/**
 * Encrypt a plaintext string. Returns "enc:<iv>:<tag>:<ciphertext>" (all hex).
 */
export function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a value previously encrypted by encrypt(). Passes through unencrypted values.
 */
export function decrypt(value) {
  if (!value || !value.startsWith('enc:')) return value;
  const [, ivHex, tagHex, ciphertextHex] = value.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Generate a signed OAuth state parameter: "<company_id>.<timestamp>.<hmac>"
 */
export function createOAuthState(companyId) {
  const secret = process.env.QB_STATE_SECRET || process.env.QB_ENCRYPT_KEY || '';
  if (!secret) throw new Error('QB_STATE_SECRET env var not set');
  const ts = Date.now();
  const payload = `${companyId}.${ts}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

/**
 * Validate a signed state and return company_id, or throw on invalid/expired.
 * Default TTL: 10 minutes.
 */
export function verifyOAuthState(state, ttlMs = 10 * 60 * 1000) {
  const secret = process.env.QB_STATE_SECRET || process.env.QB_ENCRYPT_KEY || '';
  if (!secret) throw new Error('QB_STATE_SECRET env var not set');
  const parts = state.split('.');
  if (parts.length !== 3) throw new Error('Invalid state format');
  const [companyId, ts, sig] = parts;
  const payload = `${companyId}.${ts}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
    throw new Error('Invalid state signature');
  }
  if (Date.now() - Number(ts) > ttlMs) throw new Error('State expired');
  return companyId;
}

/** Add no-cache headers to a response. */
export function setNoCacheHeaders(res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

```

## api/debug-env.mjs

```javascript
export default function handler(req, res) {
  res.json({
    has_supabase_service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    has_supabase_anon_key: !!(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY),
    has_qbo_client_id: !!process.env.QBO_CLIENT_ID,
    has_qbo_client_secret: !!process.env.QBO_CLIENT_SECRET,
    qbo_env: process.env.QBO_ENVIRONMENT || '(not set)',
    has_resend: !!process.env.RESEND_API_KEY,
    has_vite_supabase_url: !!process.env.VITE_SUPABASE_URL,
    has_vite_anon_key: !!process.env.VITE_SUPABASE_ANON_KEY,
  });
}

```

## api/quickbooks-auth.mjs

```javascript
// GET /api/quickbooks-auth?company_id=<uuid>
// Redirects user to Intuit OAuth consent screen
import OAuthClient from 'intuit-oauth';
import { createOAuthState, setNoCacheHeaders } from './crypto-utils.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res);
  setNoCacheHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { company_id } = req.query;
  if (!company_id) return res.status(400).json({ error: 'Missing company_id' });

  const environment = process.env.QBO_ENVIRONMENT || 'sandbox';

  const oauthClient = new OAuthClient({
    clientId: (process.env.QBO_CLIENT_ID || '').trim(),
    clientSecret: (process.env.QBO_CLIENT_SECRET || '').trim(),
    environment: environment === 'production' ? 'production' : 'sandbox',
    redirectUri: 'https://crm-kanban-integrate.vercel.app/api/quickbooks-callback',
  });

  // Sign state with HMAC to prevent CSRF
  const signedState = createOAuthState(company_id);

  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.Payment],
    state: signedState,
  });

  return res.redirect(authUri);
}

```

## api/quickbooks-callback.mjs

```javascript
// GET /api/quickbooks-callback?code=...&state=<signed_state>&realmId=...
// Exchanges auth code for tokens, saves encrypted tokens to DB, redirects back to app
import OAuthClient from 'intuit-oauth';
import { createClient } from '@supabase/supabase-js';
import { encrypt, verifyOAuthState, setNoCacheHeaders } from './crypto-utils.mjs';

const SUPABASE_URL = 'https://qgvuzrvpyyrrulhwlzma.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req, res) {
  setNoCacheHeaders(res);
  const { code, state: signedState, realmId, error } = req.query;

  const appBase = 'https://614restore.github.io/crm-kanban-integrate';

  if (!SUPABASE_KEY) {
    return res.redirect(`${appBase}/#/settings?qb_error=${encodeURIComponent('Missing SUPABASE_SERVICE_ROLE_KEY on server')}`);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  if (error) {
    return res.redirect(`${appBase}/#/settings?qb_error=${encodeURIComponent(error)}`);
  }

  if (!code || !signedState || !realmId) {
    return res.status(400).send('Missing required OAuth params');
  }

  // Verify CSRF state — extract company_id from signed state
  let company_id;
  try {
    company_id = verifyOAuthState(signedState);
  } catch (stateErr) {
    console.error('OAuth state validation failed:', stateErr.message);
    return res.redirect(`${appBase}/#/settings?qb_error=${encodeURIComponent('Invalid OAuth state. Please try connecting again.')}`);
  }

  const environment = process.env.QBO_ENVIRONMENT || 'sandbox';
  const redirectUri = 'https://crm-kanban-integrate.vercel.app/api/quickbooks-callback';

  const oauthClient = new OAuthClient({
    clientId: (process.env.QBO_CLIENT_ID || '').trim(),
    clientSecret: (process.env.QBO_CLIENT_SECRET || '').trim(),
    environment: environment === 'production' ? 'production' : 'sandbox',
    redirectUri,
  });

  try {
    // Exchange code for tokens (Vercel req.url is path-only, need full URL)
    const fullUrl = `https://crm-kanban-integrate.vercel.app${req.url}`;
    const authResponse = await oauthClient.createToken(fullUrl);
    const token = authResponse.getJson();

    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

    // Save tokens to DB
    const { error: dbError } = await supabase
      .from('companies')
      .update({
        qb_access_token: null, // access tokens stored in volatile memory only (Intuit requirement)
        qb_refresh_token: encrypt(token.refresh_token),
        qb_realm_id: realmId,
        qb_token_expires_at: expiresAt,
        qb_connected_at: new Date().toISOString(),
        qb_environment: environment,
      })
      .eq('id', company_id);

    if (dbError) {
      console.error('DB error saving QB tokens:', dbError);
      return res.redirect(`${appBase}/#/settings?qb_error=db_save_failed`);
    }

    return res.redirect(`${appBase}/#/settings?qb_connected=1`);
  } catch (err) {
    console.error('QB OAuth error:', err);
    return res.redirect(`${appBase}/#/settings?qb_error=${encodeURIComponent(err.message)}`);
  }
}

```

## api/quickbooks-sync.mjs

```javascript
// POST /api/quickbooks-sync
// Body: { company_id, sync_type: 'invoices' | 'customers' | 'all' }
// Pushes data from Supabase → QuickBooks
import OAuthClient from 'intuit-oauth';
import QuickBooks from 'node-quickbooks';
import { createClient } from '@supabase/supabase-js';
import { encrypt, decrypt, setNoCacheHeaders } from './crypto-utils.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://qgvuzrvpyyrrulhwlzma.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function getAccessToken(company) {
  // Access tokens are never stored in DB (volatile memory only per Intuit requirement).
  // Always generate a fresh access token from the encrypted refresh token.
  const refreshToken = decrypt(company.qb_refresh_token);
  if (!refreshToken) throw new Error('No refresh token — please reconnect QuickBooks.');

  const environment = company.qb_environment || 'sandbox';
  const oauthClient = new OAuthClient({
    clientId: process.env.QBO_CLIENT_ID,
    clientSecret: process.env.QBO_CLIENT_SECRET,
    environment,
    redirectUri: 'https://crm-kanban-integrate.vercel.app/api/quickbooks-callback',
  });

  oauthClient.setToken({
    token_type: 'bearer',
    access_token: '',
    refresh_token: refreshToken,
    expires_in: 0,
  });

  const refreshed = await oauthClient.refresh();
  const token = refreshed.getJson();
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  // Save the new encrypted refresh token back to DB; access token stays in memory only
  await supabase.from('companies').update({
    qb_access_token: null,
    qb_refresh_token: encrypt(token.refresh_token || refreshToken),
    qb_token_expires_at: expiresAt,
  }).eq('id', company.id);

  return token.access_token; // returned in memory, never persisted
}

function getQBClient(accessToken, realmId, environment) {
  const useSandbox = environment === 'sandbox';
  return new QuickBooks(
    process.env.QBO_CLIENT_ID,
    process.env.QBO_CLIENT_SECRET,
    accessToken,
    false, // no token secret for OAuth2
    realmId,
    useSandbox,
    false, // debug
    null,  // minor version
    '2.0', // oauth version
    null   // refresh token (handled separately)
  );
}

export default async function handler(req, res) {
  setCors(res);
  setNoCacheHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' });
  }

  const { company_id, sync_type = 'all' } = req.body || {};
  if (!company_id) return res.status(400).json({ error: 'Missing company_id' });

  // Load company QB tokens
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, name, qb_access_token, qb_refresh_token, qb_realm_id, qb_token_expires_at, qb_environment')
    .eq('id', company_id)
    .single();

  if (companyError || !company?.qb_refresh_token) {
    return res.status(400).json({ error: 'QuickBooks not connected. Please connect first.' });
  }

  const results = { customers: 0, invoices: 0, errors: [] };

  try {
    const accessToken = await getAccessToken(company);
    const qb = getQBClient(accessToken, company.qb_realm_id, company.qb_environment);

    // Load contacts (customers)
    if (sync_type === 'customers' || sync_type === 'all') {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone1, address, city, state, zip')
        .eq('company_id', company_id)
        .is('qb_customer_id', null) // only unsynced
        .limit(50);

      for (const contact of contacts || []) {
        try {
          await new Promise((resolve, reject) => {
            qb.createCustomer({
              DisplayName: `${contact.first_name} ${contact.last_name}`.trim(),
              PrimaryEmailAddr: contact.email ? { Address: contact.email } : undefined,
              PrimaryPhone: contact.phone1 ? { FreeFormNumber: contact.phone1 } : undefined,
              BillAddr: contact.address ? {
                Line1: contact.address,
                City: contact.city,
                CountrySubDivisionCode: contact.state,
                PostalCode: contact.zip,
                Country: 'US',
              } : undefined,
            }, async (err, customer) => {
              if (err) { reject(err); return; }
              // Save QB customer ID back to contact
              await supabase.from('contacts').update({ qb_customer_id: customer.Id }).eq('id', contact.id);
              results.customers++;
              resolve(customer);
            });
          });
        } catch (err) {
          results.errors.push(`Customer ${contact.first_name} ${contact.last_name}: ${err.message}`);
        }
      }
    }

    // Sync invoices
    if (sync_type === 'invoices' || sync_type === 'all') {
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, contact_id, amount, due_date, status, items, notes, contacts(first_name, last_name, qb_customer_id)')
        .eq('company_id', company_id)
        .is('qb_invoice_id', null) // only unsynced
        .in('status', ['sent', 'paid', 'overdue'])
        .limit(50);

      for (const invoice of invoices || []) {
        try {
          const contact = invoice.contacts;
          let customerId = contact?.qb_customer_id;

          // If no QB customer yet, create one
          if (!customerId && contact) {
            customerId = await new Promise((resolve, reject) => {
              qb.createCustomer({
                DisplayName: `${contact.first_name} ${contact.last_name}`.trim(),
              }, async (err, customer) => {
                if (err) { reject(err); return; }
                await supabase.from('contacts').update({ qb_customer_id: customer.Id }).eq('id', invoice.contact_id);
                resolve(customer.Id);
              });
            });
          }

          if (!customerId) {
            results.errors.push(`Invoice ${invoice.invoice_number}: no customer found`);
            continue;
          }

          const lineItems = (invoice.items || []).map((item, i) => ({
            Id: String(i + 1),
            LineNum: i + 1,
            Description: item.description || 'Service',
            Amount: Number(item.total || item.unit_price || 0),
            DetailType: 'SalesItemLineDetail',
            SalesItemLineDetail: {
              UnitPrice: Number(item.unit_price || item.unitPrice || 0),
              Qty: Number(item.quantity || 1),
            },
          }));

          if (lineItems.length === 0) {
            lineItems.push({
              Id: '1', LineNum: 1,
              Description: 'Services',
              Amount: Number(invoice.amount || 0),
              DetailType: 'SalesItemLineDetail',
              SalesItemLineDetail: { UnitPrice: Number(invoice.amount || 0), Qty: 1 },
            });
          }

          await new Promise((resolve, reject) => {
            qb.createInvoice({
              DocNumber: invoice.invoice_number,
              CustomerRef: { value: customerId },
              DueDate: invoice.due_date,
              Line: lineItems,
              PrivateNote: invoice.notes || '',
            }, async (err, qbInvoice) => {
              if (err) { reject(err); return; }
              await supabase.from('invoices').update({ qb_invoice_id: qbInvoice.Id }).eq('id', invoice.id);
              results.invoices++;
              resolve(qbInvoice);
            });
          });
        } catch (err) {
          results.errors.push(`Invoice ${invoice.invoice_number}: ${err.message}`);
        }
      }
    }

    return res.status(200).json({
      success: true,
      synced: results,
      message: `Synced ${results.customers} customers + ${results.invoices} invoices to QuickBooks`,
    });
  } catch (err) {
    console.error('QB sync error:', err);
    return res.status(500).json({ error: err.message });
  }
}

```

## api/send-email.mjs

```javascript
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { to, subject, html, from } = req.body || {};
  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: from || '614 Restore <scopemgr@614restore.com>',
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error?.message || String(error) });
  }
}

```

## api/send-invite.mjs

```javascript
export { default } from './send-email.mjs';

```

## api/sign-change-order.mjs

```javascript
// Public endpoint: GET /api/sign-change-order?token=<sign_token>
// POST /api/sign-change-order  { token, signedBy, signatureData }
import { createClient } from '@supabase/supabase-js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://qgvuzrvpyyrrulhwlzma.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || serviceKey;

const db = createClient(supabaseUrl, serviceKey || anonKey);

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: load change order by sign_token ──
  if (req.method === 'GET') {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const { data: co, error } = await db
      .from('change_orders')
      .select(`
        id, change_order_number, title, description, total, subtotal, tax,
        notes, items, status, signed_by_name, signed_at, sign_token,
        companies (name, from_email, phone, address, city, state, zip)
      `)
      .eq('sign_token', token)
      .single();

    if (error || !co) return res.status(404).json({ error: 'Change order not found or link is invalid.' });

    return res.status(200).json({
      changeOrder: co,
      alreadySigned: co.status === 'signed',
    });
  }

  // ── POST: record signature ──
  if (req.method === 'POST') {
    const { token, signedBy, signatureData } = req.body || {};
    if (!token || !signedBy) return res.status(400).json({ error: 'Missing required fields' });

    // Verify it exists and isn't already signed
    const { data: existing } = await db
      .from('change_orders')
      .select('id, status')
      .eq('sign_token', token)
      .single();

    if (!existing) return res.status(404).json({ error: 'Change order not found' });
    if (existing.status === 'signed') return res.status(409).json({ error: 'Already signed' });

    // Get requester IP for audit trail
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;

    const { data, error } = await db
      .from('change_orders')
      .update({
        status: 'signed',
        signed_by_name: signedBy,
        signature_data: signatureData || null,
        signed_at: new Date().toISOString(),
        signed_ip: ip,
      })
      .eq('sign_token', token)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, changeOrder: data });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

```

## api/sign-document.mjs

```javascript
// Public endpoint for customer-facing estimate signing
// Called via a unique token link sent to the customer

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { estimateId, signedBy, signatureData, token } = req.body || {};

  if (!estimateId || !signedBy || !signatureData) {
    return res.status(400).json({ error: 'Missing required fields: estimateId, signedBy, signatureData' });
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  try {
    // Verify estimate exists and is in a signable state
    const fetchRes = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${estimateId}&select=id,status,sign_token`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    const [estimate] = await fetchRes.json();

    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    // Validate token if present on the estimate
    if (estimate.sign_token && token !== estimate.sign_token) {
      return res.status(403).json({ error: 'Invalid signing token' });
    }

    if (!['sent', 'viewed'].includes(estimate.status)) {
      return res.status(400).json({ error: `Estimate cannot be signed in status: ${estimate.status}` });
    }

    // Save signature
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${estimateId}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        signed_by: signedBy,
        signature_data: signatureData,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!updateRes.ok) {
      const err = await updateRes.json().catch(() => ({}));
      return res.status(updateRes.status).json({ error: err.message || 'Failed to save signature' });
    }

    const [updated] = await updateRes.json();
    return res.status(200).json({ success: true, estimate: updated });
  } catch (error) {
    return res.status(500).json({ error: error?.message || String(error) });
  }
}

```

## api/stripe-checkout.mjs

```javascript
// api/stripe-checkout.mjs
// Creates a Stripe Checkout session for a given price ID
// Environment variables required:
//   STRIPE_SECRET_KEY  — your Stripe secret key (sk_live_... or sk_test_...)
//   APP_URL            — your app's base URL (e.g. https://614restore.github.io/crm-kanban-integrate)

import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(500).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

  const { priceId, planId } = req.body;

  if (!priceId) {
    return res.status(400).json({ error: 'priceId is required' });
  }

  const appUrl = process.env.APP_URL || 'https://614restore.github.io/crm-kanban-integrate';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { planId: planId || '' },
      },
      allow_promotion_codes: true,
      phone_number_collection: { enabled: true },
      tax_id_collection: { enabled: true },
      success_url: `${appUrl}/?checkout=success&plan=${planId}`,
      cancel_url: `${appUrl}/?checkout=cancelled`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: err.message });
  }
}

```

## api/stripe-portal.mjs

```javascript
// api/stripe-portal.mjs
// Creates a Stripe Customer Portal session so users can manage their subscription
// Environment variables required:
//   STRIPE_SECRET_KEY  — your Stripe secret key
//   APP_URL            — your app's base URL

import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(500).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

  // The customer ID should be passed from the authenticated session
  // For now, accept it from the request body or a session/auth token lookup
  const { customerId } = req.body || {};

  if (!customerId) {
    return res.status(400).json({ error: 'customerId is required. Pass the Stripe customer ID from your auth session.' });
  }

  const appUrl = process.env.APP_URL || 'https://614restore.github.io/crm-kanban-integrate';

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/settings?tab=billing`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe portal error:', err);
    return res.status(500).json({ error: err.message });
  }
}

```

## api/stripe-webhook.mjs

```javascript
// api/stripe-webhook.mjs
// Handles Stripe webhook events to activate/deactivate subscriptions
// Environment variables required:
//   STRIPE_SECRET_KEY         — your Stripe secret key
//   STRIPE_WEBHOOK_SECRET     — webhook signing secret from Stripe Dashboard
//   SUPABASE_URL              — your Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key (for admin writes)
//
// Webhook endpoint to register in Stripe Dashboard:
//   https://your-vercel-app.vercel.app/api/stripe-webhook
//
// Events to enable in Stripe Dashboard:
//   checkout.session.completed
//   customer.subscription.updated
//   customer.subscription.deleted
//   invoice.payment_failed

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return res.status(500).json({ error: 'Stripe webhook not configured' });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

  let event;
  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Set up Supabase admin client for updating subscription records
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        const planId = session.metadata?.planId || '';

        // Store subscription info against the user (look up by Stripe customer email)
        if (session.customer_details?.email) {
          await supabase
            .from('subscriptions')
            .upsert({
              email: session.customer_details.email,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan: planId,
              status: 'active',
              trial_end: session.subscription ? null : null,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'email' });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        await supabase
          .from('subscriptions')
          .update({
            status: sub.status,
            plan: sub.metadata?.planId || sub.items?.data?.[0]?.price?.metadata?.planId || '',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await supabase
          .from('subscriptions')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', invoice.subscription);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          await supabase
            .from('subscriptions')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', invoice.subscription);
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object;
        // Mark trial ending soon — front-end can show a banner
        await supabase
          .from('subscriptions')
          .update({ trial_ending_soon: true, updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      default:
        // Ignore unhandled events
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

```

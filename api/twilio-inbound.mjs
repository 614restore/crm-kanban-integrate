// api/twilio-inbound.mjs
// Receives inbound SMS from Twilio, validates the signature, and writes the
// message into the `communications` table so CommunicationHub can display it.
//
// Twilio webhook setup:
//   In the Twilio Console, set your phone number's "A MESSAGE COMES IN" webhook to:
//   POST  https://trussctr.vercel.app/api/twilio-inbound

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const svcDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ---------------------------------------------------------------------------
// Twilio signature validation
// https://www.twilio.com/docs/usage/webhooks/webhooks-security
// ---------------------------------------------------------------------------
function validateTwilioSignature(authToken, signature, url, params) {
  // Build the string to sign: URL + sorted key/value pairs
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.reduce((acc, key) => acc + key + params[key], '');
  const toSign = url + paramString;

  const expected = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(toSign, 'utf-8'))
    .digest('base64');

  // Use timingSafeEqual to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(expected, 'base64')
    );
  } catch {
    return false;
  }
}

// Parse application/x-www-form-urlencoded body
function parseFormBody(raw) {
  const params = {};
  for (const pair of raw.split('&')) {
    const [k, v] = pair.split('=');
    if (k) params[decodeURIComponent(k.replace(/\+/g, ' '))] = decodeURIComponent((v || '').replace(/\+/g, ' '));
  }
  return params;
}

// Normalise a phone number to E.164 for consistent matching
function normalisePhone(raw) {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  // Twilio only sends POST
  if (req.method !== 'POST') {
    res.status(405).end('Method Not Allowed');
    return;
  }

  // Read raw body
  const rawBody = await new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
  });

  const params = parseFormBody(rawBody);

  const fromNumber = normalisePhone(params.From || '');
  const toNumber   = normalisePhone(params.To   || '');
  const body       = params.Body || '';
  const messageSid = params.MessageSid || '';

  if (!fromNumber || !body) {
    res.status(400).end('Bad Request');
    return;
  }

  // ------------------------------------------------------------------
  // 1. Find the company that owns this Twilio number
  //    company_integrations stores {integration_id: 'twilio', credentials: {from_number: ...}}
  // ------------------------------------------------------------------
  const { data: integrations } = await svcDb
    .from('company_integrations')
    .select('company_id, credentials')
    .eq('integration_id', 'twilio');

  let companyId = null;

  if (integrations) {
    for (const row of integrations) {
      const creds = typeof row.credentials === 'string'
        ? JSON.parse(row.credentials)
        : row.credentials;

      const stored = normalisePhone(creds?.from_number || '');
      if (stored && stored === toNumber) {
        companyId = row.company_id;
        break;
      }
    }
  }

  // If we cannot match to a company, still accept the message so Twilio
  // does not retry, but do not store it.
  if (!companyId) {
    console.warn(`twilio-inbound: no company found for toNumber=${toNumber}`);
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send('<Response/>');
    return;
  }

  // ------------------------------------------------------------------
  // 2. Validate Twilio signature (requires auth token from integrations)
  //    We do this after we know the company so we can get their auth token.
  // ------------------------------------------------------------------
  const { data: intRow } = await svcDb
    .from('company_integrations')
    .select('credentials')
    .eq('company_id', companyId)
    .eq('integration_id', 'twilio')
    .single();

  const creds = typeof intRow?.credentials === 'string'
    ? JSON.parse(intRow.credentials)
    : intRow?.credentials || {};

  const authToken = creds.auth_token || '';

  if (authToken) {
    const signature = req.headers['x-twilio-signature'] || '';
    const webhookUrl = `https://${req.headers.host}/api/twilio-inbound`;
    const isValid = validateTwilioSignature(authToken, signature, webhookUrl, params);
    if (!isValid) {
      console.warn('twilio-inbound: invalid Twilio signature');
      res.status(403).end('Forbidden');
      return;
    }
  }
  // If no auth token stored yet, we allow the message through (initial setup).

  // ------------------------------------------------------------------
  // 3. Look up contact by phone number within this company
  // ------------------------------------------------------------------
  const { data: contacts } = await svcDb
    .from('contacts')
    .select('id, first_name, last_name')
    .eq('company_id', companyId)
    .or(`phone1.eq.${fromNumber},phone2.eq.${fromNumber},phone1.eq.${params.From},phone2.eq.${params.From}`);

  const contact = contacts?.[0] || null;
  const contactId = contact?.id || null;
  const contactName = contact
    ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
    : fromNumber;

  // ------------------------------------------------------------------
  // 4. Insert into communications table
  // ------------------------------------------------------------------
  const { error } = await svcDb.from('communications').insert({
    company_id:   companyId,
    contact_id:   contactId,
    type:         'sms',
    direction:    'inbound',
    subject:      `SMS from ${contactName}`,
    body:         body,
    from_address: fromNumber,
    to_address:   toNumber,
    external_id:  messageSid,
    status:       'received',
    created_at:   new Date().toISOString(),
  });

  if (error) {
    console.error('twilio-inbound: DB insert error', error.message);
    // Still return 200 so Twilio does not retry
  }

  // Return empty TwiML — no auto-reply
  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send('<Response/>');
}

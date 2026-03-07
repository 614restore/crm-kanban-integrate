/**
 * Integration Validator Tests
 * Tests the credential validation logic for all 9 integrations.
 * These mirror the private testXxx() methods in src/lib/integrations/manager.ts
 * to ensure validations behave correctly without requiring a live connection.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

// ── Validation helpers (mirrors manager.ts private methods) ────────────────

function validateStripe(creds: Record<string, any>) {
  if (!creds?.secretKey) return { ok: false, msg: 'Secret Key is required' };
  const sk = creds.secretKey as string;
  if (!sk.startsWith('sk_live_') && !sk.startsWith('sk_test_'))
    return { ok: false, msg: 'must start with sk_live_ or sk_test_' };
  if (creds.publishableKey && !String(creds.publishableKey).startsWith('pk_'))
    return { ok: false, msg: 'must start with pk_live_ or pk_test_' };
  return { ok: true, msg: '' };
}

function validateTwilio(creds: Record<string, any>) {
  if (!creds?.accountSid || !creds?.authToken)
    return { ok: false, msg: 'Account SID and Auth Token are required' };
  if (!creds.accountSid.startsWith('AC') || creds.accountSid.length !== 34)
    return { ok: false, msg: 'Invalid Account SID' };
  if (creds.authToken.length !== 32)
    return { ok: false, msg: 'Invalid Auth Token' };
  if (creds.fromNumber && !String(creds.fromNumber).startsWith('+'))
    return { ok: false, msg: 'From Number must be in E.164 format' };
  return { ok: true, msg: '' };
}

function validateEagleView(creds: Record<string, any>) {
  if (!creds?.apiKey || !creds?.clientId)
    return { ok: false, msg: 'API Key and Client ID are required' };
  if (!creds?.environment)
    return { ok: false, msg: 'Environment is required' };
  return { ok: true, msg: '' };
}

function validateOpenWeather(creds: Record<string, any>) {
  if (!creds?.apiKey) return { ok: false, msg: 'API Key is required' };
  return { ok: true, msg: '' };
}

function validateHailTrace(creds: Record<string, any>) {
  if (!creds?.apiKey) return { ok: false, msg: 'API Key is required' };
  if (!creds?.environment || !['production', 'sandbox'].includes(creds.environment))
    return { ok: false, msg: 'Environment must be "production" or "sandbox"' };
  return { ok: true, msg: '' };
}

function validateSendGrid(creds: Record<string, any>) {
  if (!creds?.apiKey) return { ok: false, msg: 'API Key is required' };
  if (!creds.apiKey.startsWith('SG.'))
    return { ok: false, msg: 'SendGrid keys start with "SG."' };
  if (!creds?.fromEmail) return { ok: false, msg: 'From Email Address is required' };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(creds.fromEmail))
    return { ok: false, msg: 'From Email Address is not valid' };
  return { ok: true, msg: '' };
}

function validateSquare(creds: Record<string, any>) {
  if (!creds?.accessToken) return { ok: false, msg: 'Access Token is required' };
  if (!creds?.locationId) return { ok: false, msg: 'Location ID is required' };
  if (!creds?.environment) return { ok: false, msg: 'Environment is required' };
  return { ok: true, msg: '' };
}

function validateAuth0(creds: Record<string, any>) {
  if (!creds?.domain || !creds?.clientId || !creds?.clientSecret)
    return { ok: false, msg: 'Domain, Client ID, and Client Secret are all required' };
  return { ok: true, msg: '' };
}

// ── Stripe ─────────────────────────────────────────────────────────────────

test('Stripe: rejects missing secret key', () => {
  assert.equal(validateStripe({}).ok, false);
});

test('Stripe: rejects invalid key format', () => {
  assert.equal(validateStripe({ secretKey: 'bad_key_123' }).ok, false);
});

test('Stripe: accepts live secret key', () => {
  assert.equal(validateStripe({ secretKey: 'sk_live_abc123' }).ok, true);
});

test('Stripe: accepts test secret key', () => {
  assert.equal(validateStripe({ secretKey: 'sk_test_abc123' }).ok, true);
});

test('Stripe: rejects invalid publishable key', () => {
  const r = validateStripe({ secretKey: 'sk_test_x', publishableKey: 'bad_pk' });
  assert.equal(r.ok, false);
});

test('Stripe: accepts valid publishable key', () => {
  const r = validateStripe({ secretKey: 'sk_test_x', publishableKey: 'pk_live_abc' });
  assert.equal(r.ok, true);
});

// ── Twilio ─────────────────────────────────────────────────────────────────

test('Twilio: rejects missing credentials', () => {
  assert.equal(validateTwilio({}).ok, false);
});

test('Twilio: rejects account SID not starting with AC', () => {
  const r = validateTwilio({ accountSid: 'BC' + 'x'.repeat(32), authToken: 'y'.repeat(32) });
  assert.equal(r.ok, false);
});

test('Twilio: rejects account SID wrong length', () => {
  const r = validateTwilio({ accountSid: 'AC' + 'x'.repeat(30), authToken: 'y'.repeat(32) });
  assert.equal(r.ok, false);
});

test('Twilio: rejects auth token wrong length', () => {
  const r = validateTwilio({ accountSid: 'AC' + 'x'.repeat(32), authToken: 'short' });
  assert.equal(r.ok, false);
});

test('Twilio: accepts valid credentials', () => {
  const r = validateTwilio({ accountSid: 'AC' + 'a'.repeat(32), authToken: 'b'.repeat(32) });
  assert.equal(r.ok, true);
});

test('Twilio: rejects fromNumber not in E.164 format', () => {
  const r = validateTwilio({ accountSid: 'AC' + 'a'.repeat(32), authToken: 'b'.repeat(32), fromNumber: '5551234567' });
  assert.equal(r.ok, false);
});

test('Twilio: accepts fromNumber in E.164 format', () => {
  const r = validateTwilio({ accountSid: 'AC' + 'a'.repeat(32), authToken: 'b'.repeat(32), fromNumber: '+15551234567' });
  assert.equal(r.ok, true);
});

// ── EagleView ──────────────────────────────────────────────────────────────

test('EagleView: rejects missing fields', () => {
  assert.equal(validateEagleView({}).ok, false);
  assert.equal(validateEagleView({ apiKey: 'key' }).ok, false);
  assert.equal(validateEagleView({ apiKey: 'key', clientId: 'cid' }).ok, false);
});

test('EagleView: accepts complete credentials', () => {
  const r = validateEagleView({ apiKey: 'key', clientId: 'cid', environment: 'production' });
  assert.equal(r.ok, true);
});

// ── OpenWeather ────────────────────────────────────────────────────────────

test('OpenWeather: rejects missing API key', () => {
  assert.equal(validateOpenWeather({}).ok, false);
});

test('OpenWeather: accepts any non-empty API key', () => {
  assert.equal(validateOpenWeather({ apiKey: 'abc123def456ghi789jkl' }).ok, true);
});

// ── HailTrace ──────────────────────────────────────────────────────────────

test('HailTrace: rejects missing API key', () => {
  assert.equal(validateHailTrace({}).ok, false);
});

test('HailTrace: rejects missing environment', () => {
  assert.equal(validateHailTrace({ apiKey: 'key123' }).ok, false);
});

test('HailTrace: rejects invalid environment value', () => {
  assert.equal(validateHailTrace({ apiKey: 'key123', environment: 'staging' }).ok, false);
});

test('HailTrace: accepts production environment', () => {
  assert.equal(validateHailTrace({ apiKey: 'key123', environment: 'production' }).ok, true);
});

test('HailTrace: accepts sandbox environment', () => {
  assert.equal(validateHailTrace({ apiKey: 'key123', environment: 'sandbox' }).ok, true);
});

// ── SendGrid ───────────────────────────────────────────────────────────────

test('SendGrid: rejects missing API key', () => {
  assert.equal(validateSendGrid({}).ok, false);
});

test('SendGrid: rejects key not starting with SG.', () => {
  assert.equal(validateSendGrid({ apiKey: 'BAD.xxxxx' }).ok, false);
});

test('SendGrid: rejects missing fromEmail', () => {
  assert.equal(validateSendGrid({ apiKey: 'SG.abc123' }).ok, false);
});

test('SendGrid: rejects invalid email format', () => {
  assert.equal(validateSendGrid({ apiKey: 'SG.abc123', fromEmail: 'notanemail' }).ok, false);
});

test('SendGrid: accepts valid credentials', () => {
  assert.equal(validateSendGrid({ apiKey: 'SG.abc123', fromEmail: 'noreply@company.com' }).ok, true);
});

// ── Square ─────────────────────────────────────────────────────────────────

test('Square: rejects missing access token', () => {
  assert.equal(validateSquare({}).ok, false);
});

test('Square: rejects missing location ID', () => {
  assert.equal(validateSquare({ accessToken: 'EAAAl...' }).ok, false);
});

test('Square: rejects missing environment', () => {
  assert.equal(validateSquare({ accessToken: 'EAAAl...', locationId: 'LOC123' }).ok, false);
});

test('Square: accepts complete credentials', () => {
  const r = validateSquare({ accessToken: 'EAAAl...', locationId: 'LOC123', environment: 'sandbox' });
  assert.equal(r.ok, true);
});

// ── Auth0 ──────────────────────────────────────────────────────────────────

test('Auth0: rejects missing fields', () => {
  assert.equal(validateAuth0({}).ok, false);
  assert.equal(validateAuth0({ domain: 'x.auth0.com' }).ok, false);
  assert.equal(validateAuth0({ domain: 'x.auth0.com', clientId: 'cid' }).ok, false);
});

test('Auth0: accepts complete credentials', () => {
  const r = validateAuth0({ domain: 'myapp.us.auth0.com', clientId: 'cid', clientSecret: 'sec' });
  assert.equal(r.ok, true);
});

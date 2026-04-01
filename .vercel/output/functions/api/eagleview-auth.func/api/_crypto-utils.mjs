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

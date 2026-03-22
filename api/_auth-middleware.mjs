// api/auth-middleware.mjs
// Verifies the Supabase JWT from the Authorization header.
// Usage:
//   import { requireAuth, optionalAuth } from './auth-middleware.mjs';
//   const user = await requireAuth(req, res);
//   if (!user) return; // response already sent as 401
//
//   // Or for endpoints where auth is optional:
//   const user = await optionalAuth(req); // returns null if no/invalid token, never sends a response

import { createClient } from '@supabase/supabase-js';

function getToken(req) {
  const authHeader = req.headers.authorization;
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

async function verifyToken(token) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error ? null : user;
}

export async function requireAuth(req, res) {
  const token = getToken(req);

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  const user = await verifyToken(token);

  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    return null;
  }

  return user;
}

/** Returns the user if a valid token is present, or null — never sends a 401 response. */
export async function optionalAuth(req) {
  const token = getToken(req);
  if (!token) return null;
  return verifyToken(token);
}

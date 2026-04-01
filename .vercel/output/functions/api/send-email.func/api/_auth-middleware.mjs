// api/auth-middleware.mjs
// Verifies the Supabase JWT from the Authorization header.
// Usage:
//   import { requireAuth } from './auth-middleware.mjs';
//   const user = await requireAuth(req, res);
//   if (!user) return; // response already sent as 401

import { createClient } from '@supabase/supabase-js';

export async function requireAuth(req, res) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    return null;
  }

  return user;
}

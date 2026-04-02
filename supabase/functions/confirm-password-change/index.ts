// confirm-password-change edge function
//
// Called after a user signs in with a temporary password and wants to set a
// permanent one.  Uses the Supabase Admin API so the change works even when
// "Secure password change" is enabled on the project (which blocks the
// browser-side supabase.auth.updateUser() unless you're in a PASSWORD_RECOVERY
// session — which temp-password sign-ins are not).
//
// Request:
//   POST /functions/v1/confirm-password-change
//   Authorization: Bearer <user-jwt>
//   Content-Type: application/json
//   Body: { "password": "<new-password>" }
//
// Response (200): { "ok": true }
// Response (4xx/5xx): { "error": "<message>" }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration: missing env vars.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the caller is authenticated by validating their JWT
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const userJwt = authHeader.replace('Bearer ', '')

    // Use the anon client to verify the JWT and extract the user id
    const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
    })
    const { data: { user }, error: userErr } = await anonClient.auth.getUser()
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session. Please sign in again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse and validate the new password
    const { password } = await req.json()
    if (!password || typeof password !== 'string' || password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use admin client to update the password (bypasses "Secure password change")
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(user.id, {
      password,
    })
    if (updateErr) {
      console.error('Admin updateUserById error:', updateErr)
      return new Response(
        JSON.stringify({ error: updateErr.message || 'Failed to update password.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Clear the forced-change flag
    const { error: profileUpdateErr } = await adminClient
      .from('profiles')
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (profileUpdateErr) {
      // Log but don't fail the request — password was already changed successfully.
      // The client-side clearPasswordReset() handles in-memory cleanup.
      console.error('confirm-password-change: failed to clear must_change_password:', profileUpdateErr)
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('confirm-password-change error:', err)
    return new Response(
      JSON.stringify({ error: 'Unexpected server error.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// temp-password-reset edge function
//
// Public endpoint (no auth required) — called when a user clicks "Forgot Password".
// Generates a short random temporary password, sets it on the user's account via
// the Admin API, flags must_change_password = true in their profile, and emails
// the temp password to them using Resend.
//
// No redirect link is sent, so this works from any device or email client without
// PKCE / cross-context issues that plague magic-link / OTP flows on mobile.
//
// Always returns 200 so we don't leak whether an email is registered.
//
// Request:
//   POST /functions/v1/temp-password-reset
//   Content-Type: application/json
//   Body: { "email": "user@example.com" }
//
// Response (200): { "ok": true }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars (0/O, 1/I)
  let pass = 'TC-' // TrussCTR prefix — easy to read in email
  for (let i = 0; i < 8; i++) {
    pass += chars[Math.floor(Math.random() * chars.length)]
  }
  return pass
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const ok = new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error('temp-password-reset: missing env vars')
      return ok // don't expose misconfiguration
    }

    const body = await req.json().catch(() => ({}))
    const email: string = (body?.email || '').trim().toLowerCase()
    if (!email) return ok // no email → silently succeed

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Look up the user by email
    const { data: { users }, error: listErr } = await admin.auth.admin.listUsers()
    if (listErr) {
      console.error('temp-password-reset: listUsers error', listErr)
      return ok
    }
    const user = users?.find(u => u.email?.toLowerCase() === email)
    if (!user) {
      // Don't reveal that the email is not registered
      console.log('temp-password-reset: no user for email', email)
      return ok
    }

    // Generate and set the temporary password
    const tempPassword = generateTempPassword()
    const { error: pwErr } = await admin.auth.admin.updateUserById(user.id, {
      password: tempPassword,
    })
    if (pwErr) {
      console.error('temp-password-reset: updateUserById error', pwErr)
      return ok
    }

    // Flag must_change_password in their profile
    await admin
      .from('profiles')
      .update({ must_change_password: true, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    // Get company name for the email (nice-to-have)
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, company_id')
      .eq('id', user.id)
      .single()

    let companyName = 'TrussCTR'
    if (profile?.company_id) {
      const { data: company } = await admin
        .from('companies')
        .select('name')
        .eq('id', profile.company_id)
        .single()
      if (company?.name) companyName = company.name
    }

    const firstName = profile?.full_name?.split(' ')[0] || 'there'

    // Send email with temp password via Resend
    if (RESEND_API_KEY) {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'TrussCTR CRM <scopemgr@614restore.com>',
          to: [email],
          subject: `Your temporary password — ${companyName}`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
              <div style="background:#1e3a5f;padding:28px 32px">
                <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.3px">${companyName}</h1>
                <p style="margin:6px 0 0;color:#93c5fd;font-size:13px">Powered by TrussCTR</p>
              </div>
              <div style="padding:32px">
                <p style="margin:0 0 16px;color:#374151;font-size:15px">Hi ${firstName},</p>
                <p style="margin:0 0 24px;color:#374151;font-size:15px">
                  We received a request to reset your password. Use the temporary password below
                  to sign in — you'll be prompted to set a new password immediately after.
                </p>

                <div style="background:#f0f9ff;border:2px dashed #3b82f6;border-radius:10px;padding:20px;text-align:center;margin:0 0 24px">
                  <p style="margin:0 0 6px;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Temporary Password</p>
                  <p style="margin:0;color:#1e3a5f;font-size:28px;font-weight:800;letter-spacing:3px;font-family:monospace">${tempPassword}</p>
                </div>

                <p style="margin:0 0 8px;color:#374151;font-size:14px">
                  <strong>Steps:</strong>
                </p>
                <ol style="margin:0 0 24px;padding-left:20px;color:#374151;font-size:14px;line-height:1.8">
                  <li>Open the TrussCTR app</li>
                  <li>Enter your email and the temporary password above</li>
                  <li>You'll be taken directly to the "Set New Password" screen</li>
                  <li>Choose a permanent password (min. 8 characters)</li>
                </ol>

                <div style="background:#fef3c7;border-radius:8px;padding:14px 16px">
                  <p style="margin:0;color:#92400e;font-size:13px">
                    ⚠️ This temporary password is valid for one sign-in only. If you didn't
                    request this, you can safely ignore this email — your account remains secure.
                  </p>
                </div>
              </div>
              <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center">
                <p style="margin:0;color:#9ca3af;font-size:12px">${companyName} · Powered by TrussCTR</p>
              </div>
            </div>
          `,
        }),
      })
      if (!emailRes.ok) {
        console.error('temp-password-reset: resend error', await emailRes.text().catch(() => ''))
      }
    } else {
      console.warn('temp-password-reset: RESEND_API_KEY not set — temp password not emailed')
    }

    return ok
  } catch (err) {
    console.error('temp-password-reset: unexpected error', err)
    return ok // always return ok to avoid leaking info
  }
})

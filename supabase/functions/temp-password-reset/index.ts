import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildTempPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const numbers = '23456789'
  const symbols = '!@#$%'
  const all = upper + lower + numbers + symbols

  let out = ''
  out += upper[Math.floor(Math.random() * upper.length)]
  out += lower[Math.floor(Math.random() * lower.length)]
  out += numbers[Math.floor(Math.random() * numbers.length)]
  out += symbols[Math.floor(Math.random() * symbols.length)]
  for (let i = 0; i < 8; i++) out += all[Math.floor(Math.random() * all.length)]

  return out
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}

async function findUserIdByEmail(adminClient: ReturnType<typeof createClient>, email: string) {
  const normalized = email.trim().toLowerCase()
  let page = 1
  const perPage = 1000

  while (page <= 20) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const users = data?.users || []
    const match = users.find((u) => String(u.email || '').toLowerCase() === normalized)
    if (match) return match.id
    if (users.length < perPage) break
    page += 1
  }

  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'TrussCTR CRM <scopemgr@614restore.com>'

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration: missing Supabase credentials.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Email service not configured. Missing RESEND_API_KEY.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { email } = await req.json().catch(() => ({}))
    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Email is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const userId = await findUserIdByEmail(adminClient, email)

    // Security: do not reveal whether the user exists
    if (!userId) {
      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tempPassword = buildTempPassword()

    const { error: updateErr } = await adminClient.auth.admin.updateUserById(userId, {
      password: tempPassword,
    })
    if (updateErr) {
      return new Response(
        JSON.stringify({ error: updateErr.message || 'Failed to set temporary password.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    await adminClient
      .from('profiles')
      .update({ must_change_password: true, updated_at: new Date().toISOString() })
      .eq('id', userId)

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: 'Your TrussCTR temporary password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto;">
            <h2 style="color: #1e40af; margin-bottom: 8px;">Password reset requested</h2>
            <p style="margin: 0 0 12px;">Use this temporary password to sign in:</p>
            <div style="font-family: Menlo, monospace; font-size: 20px; font-weight: 700; letter-spacing: 1px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; display: inline-block;">
              ${tempPassword}
            </div>
            <p style="margin: 14px 0 0;">After signing in, you will be required to set a new permanent password.</p>
            <p style="color: #64748b; font-size: 12px; margin-top: 20px;">If you did not request this, contact your administrator.</p>
          </div>
        `,
      }),
    })

    if (!emailResponse.ok) {
      const details = await emailResponse.json().catch(() => ({}))
      return new Response(
        JSON.stringify({ error: 'Failed to send temporary password email.', details }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error)?.message || 'Unexpected server error.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

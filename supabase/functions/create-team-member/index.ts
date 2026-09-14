// Copied from the shared backend's create-team-member (TrussCENTER line).
// TrussCTR changes, both optional so the mobile app's calls behave as before:
//  - app_name brands the invite email (default QuoteMGR).
//  - redirect_to sends the set-password link back to the calling app. Supabase
//    only honours it if the URL is in Auth > URL Configuration > Redirect URLs;
//    otherwise the link falls back to the project's Site URL.
//  - Company name and role are HTML-escaped in the email.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

interface CreateTeamMemberPayload {
  company_id: string;
  full_name: string;
  email: string;
  password: string;
  role: string;
  phone?: string;
  app_name?: string;
  redirect_to?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify caller has a valid session
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user: callerUser } } = await callerClient.auth.getUser();
    if (!callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const payload = (await req.json()) as CreateTeamMemberPayload;
    const { company_id, full_name, email, password, role, phone, app_name, redirect_to } = payload;

    if (!company_id || !full_name || !email || !password || !role) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // Verify caller is owner or admin of this company
    const { data: callerMember } = await admin
      .from('team_members')
      .select('role')
      .eq('user_id', callerUser.id)
      .eq('company_id', company_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!callerMember || !['owner', 'admin', 'manager'].includes(callerMember.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden: only owners, admins, and managers can add members' }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // ── Seat limits ──────────────────────────────────────────────────────────
    //
    // Checked here as well as in both apps, because the clients are a guard
    // rail rather than a lock — anyone calling this endpoint directly skipped
    // them entirely. Enforced before an auth user is created, so a refusal
    // leaves nothing behind to roll back.
    //
    // Mirrors src/lib/planLimits.ts in the iOS app and PLAN_LIMITS in the web
    // app. Canvasser seats are 5 on every tier, as the billing page advertises.
    const PLAN_LIMITS: Record<string, { teamMembers: number; canvassers: number }> = {
      starter: { teamMembers: 3, canvassers: 5 },
      professional: { teamMembers: 10, canvassers: 5 },
      business: { teamMembers: 25, canvassers: 5 },
    };

    // The plan lives in two columns. The web app reads subscription_plan (it is
    // what the billing page shows, and the only one carrying 'enterprise');
    // the iOS app reads subscription_tier. Reading one alone means enforcing
    // against a field that may be empty for half the customers, so prefer
    // subscription_plan and fall back.
    const { data: companyRow } = await admin
      .from('companies')
      .select('subscription_plan, subscription_tier')
      .eq('id', company_id)
      .maybeSingle();

    // Billing writes plan names from two vocabularies: RevenueCat (Apple) puts
    // starter/professional/business in subscription_tier, while Stripe's
    // price-id fallback writes 'pro' — not 'professional' — into
    // subscription_plan. Matching raw values meant a Stripe Professional
    // customer matched nothing here and got no enforcement at all.
    const TIER_ALIASES: Record<string, string> = {
      // 'standard' is the legacy name for Starter, still present in
      // subscription_tier on older accounts.
      standard: 'starter',
      pro: 'professional',
      professional: 'professional',
      starter: 'starter',
      business: 'business',
      enterprise: 'enterprise',
    };
    const rawPlan = (companyRow?.subscription_plan ?? companyRow?.subscription_tier ?? '')
      .toString()
      .trim()
      .toLowerCase();
    // 'standard' is legacy data and is deliberately unmapped — guessing which
    // plan it meant would either cap someone who paid for more or hand out
    // seats nobody bought. Unmapped means unlimited, same as Enterprise.
    const resolvedPlan = TIER_ALIASES[rawPlan] ?? '';
    const limits = PLAN_LIMITS[resolvedPlan];

    // No limits for a tier we do not publish allowances for — Enterprise, a
    // trial, or anything added later. Failing open beats locking a paying
    // Enterprise account, whose plan advertises unlimited members, out at three.
    if (limits) {
      const { data: activeMembers } = await admin
        .from('team_members')
        .select('role')
        .eq('company_id', company_id)
        .eq('is_active', true);

      const memberCount = activeMembers?.length ?? 0;
      const canvasserCount = activeMembers?.filter((m) => m.role === 'canvasser').length ?? 0;
      const planName = resolvedPlan || 'Your plan';

      if (memberCount >= limits.teamMembers) {
        return new Response(
          JSON.stringify({
            error: `Seat limit reached: the ${planName} plan includes ${limits.teamMembers} team members and all ${limits.teamMembers} are in use. Remove a member, or upgrade for more seats.`,
          }),
          { status: 409, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
        );
      }

      if (role === 'canvasser' && canvasserCount >= limits.canvassers) {
        return new Response(
          JSON.stringify({
            error: `Seat limit reached: the ${planName} plan includes ${limits.canvassers} canvasser seats and all ${limits.canvassers} are in use. Remove a canvasser, or upgrade for more seats.`,
          }),
          { status: 409, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
        );
      }
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check duplicate in team_members
    const { data: existingMember } = await admin
      .from('team_members')
      .select('id')
      .eq('company_id', company_id)
      .ilike('email', normalizedEmail)
      .limit(1);

    if (existingMember && existingMember.length > 0) {
      return new Response(JSON.stringify({ error: 'A team member with this email already exists.' }), {
        status: 409, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Create Supabase Auth user — auto-confirmed so they can log in immediately
    const { data: newAuthUser, error: createError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
    });

    let authUserId: string;

    if (createError) {
      // If auth user already exists (e.g. from a previous invite), find them and update password
      const isAlreadyExists =
        createError.message.toLowerCase().includes('already') ||
        createError.message.toLowerCase().includes('registered') ||
        createError.message.toLowerCase().includes('exists');

      if (!isAlreadyExists) {
        return new Response(JSON.stringify({ error: 'Failed to create auth user: ' + createError.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      // Find the existing auth user by email
      const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const existingAuthUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);

      if (listError || !existingAuthUser) {
        return new Response(JSON.stringify({ error: 'Auth user exists but could not be retrieved.' }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      // Update their password so it matches what the admin just set
      await admin.auth.admin.updateUserById(existingAuthUser.id, { password });
      authUserId = existingAuthUser.id;
    } else {
      if (!newAuthUser?.user) {
        return new Response(JSON.stringify({ error: 'Auth user creation returned no user.' }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
      authUserId = newAuthUser.user.id;
    }

    // Insert team_members row — password_hash set via DB RPC after insert
    const { data: newMember, error: insertError } = await admin
      .from('team_members')
      .insert({
        company_id,
        full_name: full_name.trim(),
        email: normalizedEmail,
        user_id: authUserId,
        role,
        phone: phone?.trim() || null,
        is_active: true,
      })
      .select()
      .single();

    if (insertError || !newMember) {
      // Rollback auth user only if we just created it (not an existing one)
      if (!createError) {
        await admin.auth.admin.deleteUser(authUserId).catch(() => {});
      }
      return new Response(JSON.stringify({ error: 'Failed to create team member record: ' + (insertError?.message ?? 'unknown') }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Send invite email with a set-password link so the invitee can log in
    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        // Generate a password-reset link (valid 24h) the invitee uses to set their password
        // redirectTo comes from SITE_URL so the invitee lands on THIS project's
        // app. When it is unset we omit the option entirely rather than send
        // them to an unrelated deployment — Supabase then falls back to the
        // project's own configured Site URL.
        const requestedRedirect = typeof redirect_to === 'string' && /^https:\/\/[^\s]+$/.test(redirect_to) ? redirect_to : undefined;
        const inviteRedirect = (requestedRedirect ?? Deno.env.get('SITE_URL'))?.trim().replace(/\/+$/, '');
        const { data: linkData } = await admin.auth.admin.generateLink({
          type: 'recovery',
          email: normalizedEmail,
          ...(inviteRedirect ? { options: { redirectTo: inviteRedirect } } : {}),
        });

        const setPasswordUrl = linkData?.properties?.action_link ?? null;

        if (setPasswordUrl) {
          const companyName = newMember.company_id; // fallback; fetch if needed
          // Fetch company name for the email
          const { data: companyRow } = await admin
            .from('companies')
            .select('name')
            .eq('id', company_id)
            .maybeSingle();
          const displayCompanyName = companyRow?.name ?? 'your team';
          const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
          const appName = (typeof app_name === 'string' ? app_name.replace(/[<>&"\r\n]/g, '').trim().slice(0, 40) : '') || 'QuoteMGR';

          const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#1e3a5f;padding:32px 40px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">${appName}</h1>
          <p style="color:#93c5fd;margin:8px 0 0;font-size:14px;">You've been invited!</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="color:#111827;margin:0 0 16px;font-size:20px;">Join ${esc(displayCompanyName)} on ${appName}</h2>
          <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 24px;">
            You've been added to <strong>${esc(displayCompanyName)}</strong> as a <strong>${esc(role)}</strong>.
            Click the button below to set your password and start using ${appName}.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${setPasswordUrl}" style="background:#10b981;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;display:inline-block;">
              Set My Password &amp; Join
            </a>
          </div>
          <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0;">
            This link expires in 24 hours. If you weren't expecting this invitation, you can ignore this email.
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">${appName}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `${appName} <noreply@quotemgr.614restore.com>`,
              to: [normalizedEmail],
              subject: `You've been invited to join ${displayCompanyName.replace(/[\r\n]/g, ' ')} on ${appName}`,
              html: emailHtml,
            }),
          });
        }
      }
    } catch (_emailErr) {
      // Email failure is non-fatal — member was created successfully
    }

    return new Response(JSON.stringify({ ok: true, member: newMember }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
});

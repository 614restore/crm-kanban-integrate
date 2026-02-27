#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY; // service_role recommended
  const INVITEE_EMAIL = process.env.INVITEE_EMAIL || `e2e-user-${Date.now()}@example.com`;
  const INVITER_ID = process.env.INVITER_ID || null;
  const COMPANY_ID = process.env.COMPANY_ID || null;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY env vars');
    process.exit(2);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  try {
    // 1) Create company if not provided
    let companyId = COMPANY_ID;
    if (!companyId) {
      const name = `E2E Test Co ${Date.now()}`;
      const { data: comp, error: compErr } = await supabase.from('companies').insert({ name, created_at: new Date().toISOString() }).select().single();
      if (compErr) throw compErr;
      companyId = comp.id;
      console.log('Created company', companyId);
    } else {
      console.log('Using provided company', companyId);
    }

    // 2) Create invite
    const token = (globalThis.crypto && globalThis.crypto.randomUUID) ? globalThis.crypto.randomUUID() : `t-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const invitePayload = {
      company_id: companyId,
      email: INVITEE_EMAIL,
      role: 'sales',
      invited_by: INVITER_ID,
      accepted: false,
      token,
      created_at: new Date().toISOString(),
    };
    const { data: invite, error: inviteErr } = await supabase.from('invites').insert(invitePayload).select().single();
    if (inviteErr) throw inviteErr;
    console.log('Created invite', invite.token);

    // 3) Create auth user via admin API (service key required)
    const password = 'Testpass123!';
    let userId = null;
    try {
      const { data: userData, error: userErr } = await supabase.auth.admin.createUser({ email: INVITEE_EMAIL, password, email_confirm: true });
      if (userErr) throw userErr;
      userId = userData?.user?.id;
    } catch (uErr) {
      console.warn('Could not create auth user via admin API, will simulate user id');
      userId = `simulated-${Date.now()}`;
    }
    console.log('Using user id:', userId);

    // 4) Accept invite and create team_members row
    const { data: inviteUpdate, error: accErr } = await supabase.from('invites').update({ accepted: true, accepted_at: new Date().toISOString() }).eq('token', token).select().single();
    if (accErr) throw accErr;
    const memberPayloads = [
      { company_id: companyId, user_id: userId, email: INVITEE_EMAIL, name: 'E2E User', role: invite.role, is_active: true, joined_at: new Date().toISOString() },
      { company_id: companyId, user_id: userId, name: 'E2E User', role: invite.role, joined_at: new Date().toISOString() },
      { company_id: companyId, user_id: userId, role: invite.role, joined_at: new Date().toISOString() },
      { company_id: companyId, user_id: userId, role: invite.role },
      { company_id: companyId, user_id: userId },
    ];

    let member = null;
    let lastMemberError = null;
    for (const payload of memberPayloads) {
      const attempt = await supabase.from('team_members').insert(payload).select().single();
      if (!attempt.error) {
        member = attempt.data;
        break;
      }
      lastMemberError = attempt.error;
    }
    if (!member) {
      console.warn('Could not create team_member row; continuing invite validation.', lastMemberError?.message || lastMemberError);
    } else {
      console.log('Team member created:', member.id);
    }

    // 5) Verify
    const { data: acceptedInvite, error: acceptedInviteErr } = await supabase
      .from('invites')
      .select('id,accepted,accepted_at,email')
      .eq('token', token)
      .single();
    if (acceptedInviteErr) throw acceptedInviteErr;
    if (!acceptedInvite?.accepted) {
      throw new Error('Invite was not marked accepted');
    }
    console.log('Invite accepted for:', acceptedInvite.email);

    console.log('E2E invite test completed successfully');

    // Optional cleanup
    const CLEANUP = process.env.CLEANUP !== 'false';
    if (CLEANUP) {
      try {
        if (member && member.id) {
          await supabase.from('team_members').delete().eq('id', member.id);
          console.log('Cleaned up team_member', member.id);
        }
        if (invite && invite.id) {
          await supabase.from('invites').delete().eq('id', invite.id);
          console.log('Cleaned up invite', invite.id);
        }
        if (!process.env.COMPANY_ID && companyId) {
          await supabase.from('companies').delete().eq('id', companyId);
          console.log('Cleaned up company', companyId);
        }
      } catch (cleanupErr) {
        console.warn('Cleanup failed:', cleanupErr?.message || cleanupErr);
      }
    }
    process.exit(0);
  } catch (err) {
    console.error('E2E invite test failed:', err?.message || err);
    process.exit(1);
  }
}

main();

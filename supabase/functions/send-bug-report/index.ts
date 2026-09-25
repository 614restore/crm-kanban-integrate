// Bug reports from web and iOS. Adapted from QuoteMGR's send-bug-report for TrussCTR:
//  - reports go to TrussCTR's own address, not QuoteMGR's;
//  - the sender must be a signed-in, active team member, and the company, email and role
//    come from their own record rather than from the request;
//  - everything a person typed is escaped before it goes into the email.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const escapeHtml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

interface BugReportPayload {
  platform?: string;
  category: string;
  description?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload: BugReportPayload = await req.json();
    const category = String(payload.category ?? '').trim().slice(0, 120);
    if (!category) return json({ error: 'category is required' }, 400);
    const description = payload.description?.trim().slice(0, 500) || null;
    const platform = payload.platform === 'ios' ? 'ios' : 'web';

    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) return json({ error: 'Server not configured' }, 500);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // Only a signed-in, active team member can file a report, and it is filed as them.
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const { data: { user } } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { data: member } = await admin
      .from('team_members')
      .select('email, role, company_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (!member) return json({ error: 'Unauthorized' }, 401);

    const { data: company } = await admin.from('companies').select('name').eq('id', member.company_id).maybeSingle();
    const companyName: string | null = company?.name ?? null;
    const userEmail: string | null = member.email ?? user.email ?? null;

    const { error: dbError } = await admin.from('bug_reports').insert({
      company_id: member.company_id,
      company_name: companyName,
      user_email: userEmail,
      user_role: member.role ?? null,
      platform,
      category,
      description,
    });
    if (dbError) console.error('DB insert error:', dbError);

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('ALERT_FROM_EMAIL');
    const toEmail = Deno.env.get('BUG_REPORT_TO') || '614restorellc@gmail.com';

    if (resendKey && fromEmail) {
      const platformLabel = platform === 'ios' ? '📱 iOS' : '🌐 Web';
      const row = (label: string, value: string) =>
        `<tr><td style="padding:8px 0;color:#6b7280;width:130px;vertical-align:top">${label}</td><td style="padding:8px 0;color:#111827">${value}</td></tr>`;
      const descBlock = description
        ? `<p style="margin:0 0 8px"><strong>Details:</strong></p><blockquote style="margin:0;padding:12px 16px;background:#f9fafb;border-left:3px solid #e5e7eb;border-radius:4px;font-size:14px;color:#374151">${escapeHtml(description).replace(/\n/g, '<br>')}</blockquote>`
        : `<p style="color:#9ca3af;font-style:italic">No additional details provided.</p>`;
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;background:#f3f4f6">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#1e3a5f;padding:24px 32px"><h1 style="margin:0;color:#fff;font-size:20px;font-weight:700">🐞 Bug Report — TrussCTR</h1></div>
    <div style="padding:28px 32px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px">
        ${row('Platform', `<strong>${platformLabel}</strong>`)}
        ${row('Category', `<strong>${escapeHtml(category)}</strong>`)}
        ${row('Reported by', `${escapeHtml(userEmail ?? '—')} <span style="color:#9ca3af">(${escapeHtml(member.role ?? '—')})</span>`)}
        ${row('Company', `${escapeHtml(companyName ?? '—')} <span style="color:#9ca3af;font-size:12px">${escapeHtml(member.company_id ?? '')}</span>`)}
        ${row('Submitted', `${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} UTC`)}
      </table>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 20px">
      ${descBlock}
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f3f4f6"><p style="margin:0;font-size:12px;color:#9ca3af">Submitted from within the TrussCTR app. Reply to this email to follow up with the user.</p></div>
  </div></body></html>`;

      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `TrussCTR Bug Reports <${fromEmail}>`,
          to: [toEmail],
          reply_to: userEmail || undefined,
          subject: `[Bug Report] ${category} — ${companyName || 'Unknown Company'}`,
          html,
        }),
      });
      if (!resp.ok) console.error('Resend error:', resp.status, await resp.text());
    } else {
      console.warn('No RESEND_API_KEY / ALERT_FROM_EMAIL set — email not sent, report stored in DB only.');
    }

    return json({ ok: true });
  } catch (err) {
    console.error('send-bug-report error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});

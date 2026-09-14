import { requireAuth } from './_auth-middleware.mjs';
import { createClient } from '@supabase/supabase-js';

// Each company brings its own Groq key; there is no shared platform key, which
// would split one free-tier quota across every company. The caller's personal
// key (user_ai_configs) wins, then their company's key (ai_configurations).
async function resolveGroqKey(userId) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: personal } = await admin
    .from('user_ai_configs')
    .select('provider, api_key, enabled')
    .eq('user_id', userId)
    .maybeSingle();
  if (personal?.enabled && personal.provider === 'groq' && personal.api_key) return personal.api_key;

  const { data: member } = await admin
    .from('team_members')
    .select('company_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (!member?.company_id) return null;

  const { data: company } = await admin
    .from('ai_configurations')
    .select('provider, api_key, enabled')
    .eq('company_id', member.company_id)
    .maybeSingle();
  if (company?.enabled && company.provider === 'groq' && company.api_key) return company.api_key;

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require authentication — prevents unauthenticated OpenAI cost abuse
  const user = await requireAuth(req, res);
  if (!user) return;

  const apiKey = await resolveGroqKey(user.id).catch(() => null);
  if (!apiKey) {
    return res.status(503).json({
      error: 'AI not configured',
      message: 'Add a Groq API key in Settings → AI Assistant: your own, or ask an owner to add the team key.',
    });
  }

  const { contactName, projectType, context, tone } = req.body || {};

  if (!contactName) {
    return res.status(400).json({ error: 'contactName is required' });
  }

  // Sanitize user-supplied fields — strip newlines and cap length to prevent prompt injection
  const safeName    = String(contactName).replace(/[\n\r]/g, ' ').slice(0, 100);
  const safeType    = String(projectType  || 'roofing/restoration').replace(/[\n\r]/g, ' ').slice(0, 100);
  const safeTone    = String(tone         || 'professional and helpful').replace(/[\n\r]/g, ' ').slice(0, 50);
  const safeContext = context ? String(context).replace(/[\n\r]/g, ' ').slice(0, 500) : '';

  const systemPrompt = `You are a professional assistant for a roofing/restoration contractor.
Write concise, professional customer emails. Keep them warm but businesslike.
Always respond with valid JSON only: { "subject": "...", "body": "..." }`;

  const userPrompt = `Write a professional email to <contact_name>${safeName}</contact_name>.
<project_type>${safeType}</project_type>
<tone>${safeTone}</tone>
${safeContext ? `<context>${safeContext}</context>` : ''}
Reply ONLY with JSON: { "subject": "...", "body": "..." }`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(502).json({
        error: 'Groq error',
        message: err.error?.message || 'Unknown error from Groq',
      });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';

    // Strip ```json fences if present
    const json = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');

    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch {
      // Fallback: return raw as body
      return res.json({ subject: 'Your Estimate', body: raw });
    }

    return res.json({ subject: parsed.subject || '', body: parsed.body || '' });
  } catch (err) {
    console.error('ai-draft error:', err);
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
}

import { requireAuth } from './_auth-middleware.mjs';
import { createClient } from '@supabase/supabase-js';

// Each company brings its own AI key; there is no shared platform key, which
// would split one free-tier quota across every company. The caller's personal
// key (user_ai_configs) wins, then their company's key (ai_configurations).
// Any provider the AI settings offer works: Groq, OpenAI, Anthropic or Google.
async function resolveAIConfig(userId) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: personal } = await admin
    .from('user_ai_configs')
    .select('provider, api_key, model, enabled')
    .eq('user_id', userId)
    .maybeSingle();
  if (personal?.enabled && personal.api_key) return personal;

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
    .select('provider, api_key, model, enabled')
    .eq('company_id', member.company_id)
    .maybeSingle();
  if (company?.enabled && company.api_key) return company;

  return null;
}

// Sends one system + user prompt to the configured provider and returns the text.
async function callProvider(config, systemPrompt, userPrompt) {
  const { provider, api_key: key } = config;
  const model = config.model || (provider === 'groq' ? 'llama-3.3-70b-versatile' : null);
  if (!model) {
    throw Object.assign(new Error('Choose a model for your AI key in Settings → AI Assistant.'), { status: 400 });
  }

  let response;
  if (provider === 'groq' || provider === 'openai') {
    const url = provider === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
    response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });
  } else if (provider === 'anthropic') {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
  } else if (provider === 'google') {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
      }),
    });
  } else {
    throw Object.assign(new Error(`Unsupported AI provider: ${provider}`), { status: 400 });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data.error?.message || `Error from ${provider}`), { status: 502 });
  }
  if (provider === 'anthropic') return (data.content?.[0]?.text || '').trim();
  if (provider === 'google') {
    return (data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '').trim();
  }
  return (data.choices?.[0]?.message?.content || '').trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require authentication — prevents unauthenticated OpenAI cost abuse
  const user = await requireAuth(req, res);
  if (!user) return;

  const aiConfig = await resolveAIConfig(user.id).catch(() => null);
  if (!aiConfig) {
    return res.status(503).json({
      error: 'AI not configured',
      message: 'Add an AI key in Settings → AI Assistant: your own (Groq, OpenAI, Anthropic or Google), or ask an owner to add the team key.',
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
    let raw;
    try {
      raw = await callProvider(aiConfig, systemPrompt, userPrompt);
    } catch (providerErr) {
      return res.status(providerErr.status || 502).json({
        error: 'AI provider error',
        message: providerErr.message || 'Unknown error from the AI provider',
      });
    }

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

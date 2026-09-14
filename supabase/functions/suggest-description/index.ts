// Copied from QuoteMGR supabase/functions/suggest-description (read-only reference).
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SuggestDescriptionPayload {
  itemName: string;
  category?: string;
  goodProduct?: string | null;
  betterProduct?: string | null;
  bestProduct?: string | null;
  existingDescription?: string | null;
}

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')             || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

/**
 * Resolve the Groq key for the signed-in caller. Every company brings its own key:
 *  1. The caller's personal key (user_ai_configs), so their usage stays separate.
 *  2. Their company's key (ai_configurations), set by an owner or admin for the team.
 * TrussCTR change from QuoteMGR: no platform-wide GROQ_API_KEY fallback. A shared
 * key would split one free-tier quota across every company using the app.
 */
async function resolveGroqKey(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return null;

    const { data: personal } = await admin
      .from('user_ai_configs')
      .select('provider, api_key, enabled')
      .eq('user_id', user.id)
      .maybeSingle();
    if (personal?.enabled && personal.provider === 'groq' && personal.api_key) {
      return personal.api_key as string;
    }

    const { data: member } = await admin
      .from('team_members')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (!member?.company_id) return null;

    const { data: aiConfig } = await admin
      .from('ai_configurations')
      .select('provider, api_key, enabled')
      .eq('company_id', member.company_id)
      .maybeSingle();
    if (aiConfig?.enabled && aiConfig.provider === 'groq' && aiConfig.api_key) {
      return aiConfig.api_key as string;
    }
  } catch (err) {
    console.warn('[suggest-description] Could not resolve Groq key:', err);
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const groqKey = await resolveGroqKey(req.headers.get('authorization'));
    if (!groqKey) {
      return new Response(
        JSON.stringify({ error: 'No Groq API key set. Add your own in Settings → AI Assistant, or ask an owner to add the team key.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const payload: SuggestDescriptionPayload = await req.json();
    if (!payload.itemName) {
      return new Response(
        JSON.stringify({ error: 'itemName is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const products = [payload.goodProduct, payload.betterProduct, payload.bestProduct]
      .filter((p): p is string => !!p && p.trim().length > 0)
      .filter((p, i, arr) => arr.indexOf(p) === i);

    const productLine = products.length
      ? `\nAssociated products/materials: ${products.join(', ')}`
      : '';

    const existingLine = payload.existingDescription?.trim()
      ? `\nExisting description (improve/rewrite this): "${payload.existingDescription.trim()}"`
      : '';

    const prompt = `Write a concise, professional, customer-facing description for a single line item on a home improvement / roofing quote.

Line item: ${payload.itemName}
Category: ${payload.category || 'General'}${productLine}${existingLine}

Requirements:
- 1-2 sentences maximum.
- Written for a homeowner — explain what the work involves and why it matters (quality, protection, longevity).
- If specific product names are listed above, mention them naturally.
- Plain text only, no bullets, no heading.
- Do NOT start with "This item" or "This line item".`;

    const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!groqResp.ok) {
      const errText = await groqResp.text();
      console.error('[suggest-description] Groq API error:', groqResp.status, errText);
      return new Response(
        JSON.stringify({ error: `Groq API error: ${groqResp.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const groqData = await groqResp.json();
    const description = groqData.choices?.[0]?.message?.content?.trim() || '';

    if (!description) {
      return new Response(
        JSON.stringify({ error: 'Empty response from Groq' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ description }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('[suggest-description] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

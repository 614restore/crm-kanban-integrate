// Copied from QuoteMGR supabase/functions/suggest-price (read-only reference).
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SuggestPricePayload {
  itemName: string;
  quantity?: number;
  unit?: string;
}

const SUPABASE_URL            = Deno.env.get('SUPABASE_URL')            || '';
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
    console.warn('[suggest-price] Could not resolve Groq key:', err);
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

    const payload: SuggestPricePayload = await req.json();

    if (!payload.itemName?.trim()) {
      return new Response(
        JSON.stringify({ error: 'itemName is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const itemName = payload.itemName.trim();
    const unit = payload.unit?.trim() || 'unit';

    const prompt = `You are a US building materials pricing expert who knows contractor distributor costs.

A contractor needs MATERIAL-ONLY cost estimates (what they pay at the supply house or distributor —
NO labor, NO overhead, NO profit margin) for this line item:
- Item: "${itemName}"
- Unit of measure: ${unit}

The contractor will add their own labor and profit margin separately using a markup slider.

════════════════════════════════════════════════════════
⚠️  MATERIAL COST ONLY — do NOT include labor or markup
Return what a contractor pays their supplier/distributor, NOT what they charge a homeowner.
════════════════════════════════════════════════════════

CRITICAL UNIT DEFINITIONS:
- "sq" or "square" = ROOFING SQUARE = 100 sq ft. One square requires ~3 shingle bundles.
  Price per square = cost of all 3 bundles needed to cover 100 sq ft. NO labor.
- "gal" = one US gallon.
- "roll" = one roll as sold (synthetic underlayment ≈ 1,000 sq ft; ice & water ≈ 200 sq ft).
- "sheet" = one 4×8 sheet (32 sq ft) — OSB, ISO board, DensDeck.
- "lf" = one linear foot.
- "each" = one individual unit.
- "lot" = lump sum material allowance.

MATERIAL COST ANCHORS (contractor distributor prices, US market ${new Date().getFullYear()}):

ROOFING MATERIALS — per square (100 sq ft = 3 bundles) material only:
- 3-tab shingles: low $55, mid $70, high $85
- Architectural/dimensional shingles (GAF HDZ, Atlas Pinnacle Pristine, OC Duration,
  CertainTeed Landmark, TAMKO Heritage, IKO Cambridge): low $85, mid $100, high $120
- Impact-resistant / Class 4 shingles (GAF Timberline ArmorShield II, Atlas StormMaster,
  Malarkey Vista, OC Duration FLEX): low $130, mid $165, high $210
- Standing seam metal panels: low $150, mid $220, high $350
- Corrugated/exposed fastener metal panels: low $80, mid $120, high $180
- Synthetic underlayment: low $12, mid $18, high $28 (per sq)
- Felt underlayment (15#/30#): low $6, mid $10, high $16 (per sq)
- Ice & water shield: low $28, mid $40, high $58 (per sq)
- Ridge cap shingles: low $1.50, mid $2.25, high $3.50 (per lf)
- TruRidge continuous ridge vent (Air Vent): low $1.75, mid $2.25, high $3.00 (per lf)
- TruRidge EZ ridge vent (Air Vent): low $2.00, mid $2.75, high $3.50 (per lf)
- Cor-A-Vent ridge vent: low $1.50, mid $2.00, high $2.75 (per lf)
- GAF Cobra ridge vent: low $1.75, mid $2.25, high $3.00 (per lf)
- Drip edge (aluminum): low $0.60, mid $0.80, high $1.20 (per lf); per 10-ft stick: low $6, mid $8, high $12
- Step flashing: low $0.60, mid $0.90, high $1.50 (per lf)
- Pipe boot / penetration flashing: low $8, mid $14, high $25 (each)
- OSB decking (7/16" 4×8 sheet): low $32, mid $42, high $58 (per sheet)
- Roofing nails / fasteners: low $3, mid $5, high $8 (per sq)

SIDING MATERIALS:
- Vinyl siding: low $1.20, mid $2.00, high $3.50 (per sq ft)
- LP SmartSide (engineered wood): low $1.80, mid $2.50, high $3.50 (per sq ft)
- James Hardie fiber cement: low $2.20, mid $3.00, high $4.50 (per sq ft)
- Wood siding (cedar): low $3.50, mid $5.50, high $8.50 (per sq ft)
- House wrap / WRB: low $0.08, mid $0.14, high $0.22 (per sq ft)
- J-channel / trim accessories: low $0.50, mid $0.80, high $1.40 (per lf)
- Outside corner posts (vinyl, priced per lf): low $1.20, mid $2.00, high $3.25
- Inside corner posts (vinyl, priced per lf): low $1.00, mid $1.75, high $2.75
- Outside corner posts (LP SmartSide, priced per lf): low $2.00, mid $3.00, high $4.50
- Inside corner posts (LP SmartSide, priced per lf): low $1.75, mid $2.50, high $4.00
- Outside corner posts (fiber cement / Hardie, priced per lf): low $3.00, mid $4.25, high $6.00
- Inside corner posts (fiber cement / Hardie, priced per lf): low $2.50, mid $3.75, high $5.50
- Outside corner posts (vinyl, priced per STICK — 1 stick = 12.5 ft): low $15, mid $25, high $41
- Inside corner posts (vinyl, priced per STICK — 1 stick = 12.5 ft): low $13, mid $22, high $34
- Outside corner posts (LP SmartSide, priced per STICK — 1 stick = 12.5 ft): low $25, mid $38, high $56
- Inside corner posts (LP SmartSide, priced per STICK — 1 stick = 12.5 ft): low $22, mid $31, high $50
- J-channel (vinyl, priced per STICK — 1 stick = 10 ft): low $4, mid $7, high $11
- Drip edge / trim piece (priced per PC — 1 pc = 10 ft): low $5, mid $9, high $15
- Hip & ridge cap shingles (priced per BUNDLE — 1 bdl = 25 lf): low $50, mid $65, high $85
- Starter strip shingles (priced per BUNDLE — 1 bdl ≈ 105 lf): low $55, mid $70, high $90

GUTTERS & DRAINAGE MATERIALS:
- Aluminum gutter coil / pre-fab 5": low $1.50, mid $2.50, high $3.80 (per lf)
- Aluminum gutter 6": low $2.20, mid $3.20, high $5.00 (per lf)
- Copper gutter: low $8, mid $12, high $18 (per lf)
- Gutter guard material: low $1.50, mid $3.50, high $7.00 (per lf)
- Downspout (aluminum): low $1.00, mid $1.60, high $2.50 (per lf)

GENERAL MATERIALS:
- Lumber (2×4 stud, 8 ft): low $4, mid $6, high $9 (each)
- OSB sheathing (4×8): low $30, mid $42, high $58 (per sheet)
- Drywall (4×8, 1/2"): low $12, mid $16, high $22 (per sheet)
- Windows (standard double-hung, material only): low $150, mid $280, high $550 (each)
- Fascia board (1×6 pine): low $0.80, mid $1.30, high $2.20 (per lf)
- Paint (exterior latex, 1 gal): low $35, mid $55, high $85 (per gal)
- Caulk / sealant: low $4, mid $7, high $14 (each)

Use the anchors above as your primary reference. For items not listed, use your training knowledge of US distributor/supply house pricing.
Do NOT add labor. Do NOT add markup. Return raw material cost only.

Respond ONLY with valid JSON — no markdown, no explanation outside the JSON:
{
  "low": <number>,
  "mid": <number>,
  "high": <number>,
  "reasoning": "<1-2 sentence explanation covering what grade of material each price reflects>"
}

Rules:
- All prices are USD, per ${unit}, MATERIAL COST ONLY (no labor, no markup)
- low = economy/builder-grade  |  mid = standard quality  |  high = premium brand
- low < mid < high
- Values are plain numbers (no $ signs, no commas)
- If unable to find data: {"low":0,"mid":0,"high":0,"reasoning":"Unable to find pricing data for this item."}`;

    const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 512,
      }),
    });

    if (!groqResp.ok) {
      const errText = await groqResp.text();
      console.error('[suggest-price] Groq API error:', groqResp.status, errText);
      return new Response(
        JSON.stringify({ error: `Groq API error: ${groqResp.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const groqData = await groqResp.json();
    const rawContent: string = groqData?.choices?.[0]?.message?.content ?? '';

    // Strip any markdown code fences the model might add despite instructions
    const jsonStr = rawContent
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();

    let parsed: { low: number; mid: number; high: number; reasoning: string };
    try {
      parsed = JSON.parse(jsonStr);
    } catch (_parseErr) {
      console.error('[suggest-price] Failed to parse Groq response as JSON:', rawContent);
      return new Response(
        JSON.stringify({ error: 'Failed to parse pricing response', raw: rawContent }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const low      = Number(parsed.low)  || 0;
    const mid      = Number(parsed.mid)  || 0;
    const high     = Number(parsed.high) || 0;
    const reasoning = String(parsed.reasoning || '').slice(0, 500);

    if (low === 0 && mid === 0 && high === 0) {
      return new Response(
        JSON.stringify({ error: 'No pricing data found', reasoning }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ low, mid, high, reasoning, source: 'web_search' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('[suggest-price] Unhandled error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

// Copied from QuoteMGR src/lib/aiHelper.ts (read-only reference).
import { supabase } from './supabase';

interface AIConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'groq';
  // api_key and vision_api_key are intentionally omitted from this client-side
  // interface. Keys are stored in ai_configurations on the server and resolved
  // by the /api/ai-proxy edge function — they never travel through the browser.
  model: string;
  enabled: boolean;
  // Optional separate vision provider (photo analysis)
  vision_provider?: 'openai' | 'anthropic' | 'google' | null;
  vision_model?: string | null;
}

export interface AIQuotePhotoSuggestedLineItem {
  category: string;
  item_name: string;
  description: string;
  unit: string;
  quantity: number;
}

export interface AIQuotePhotoAnalysis {
  caption: string;
  damage_type: string;
  notes: string;
  suggested_line_items: AIQuotePhotoSuggestedLineItem[];
}

export interface AIQuoteEmailDraft {
  subject: string;
  body: string;
}

// Normalize deprecated/renamed model identifiers to their current equivalents.
// Google shut down all Gemini 1.x and 2.0 models (2.0 Flash/Flash-Lite on
// 2026-06-01; 1.5/1.0 earlier) — every gemini-1.x/2.0 alias below points to a
// live Gemini 3.x/2.5 model. Anthropic and OpenAI entries cover older
// snapshot IDs that predate this app's currently-offered models.
const MODEL_ALIASES: Record<string, string> = {
  // Google Gemini — 2.0 and 1.x are fully shut down
  'gemini-2.0-flash-exp': 'gemini-3.6-flash',
  'gemini-2.0-flash': 'gemini-3.6-flash',
  'gemini-2.0-flash-lite': 'gemini-2.5-flash',
  'gemini-2.5-pro-preview-05-06': 'gemini-3.1-pro',
  'gemini-pro-vision': 'gemini-3.1-pro',
  'gemini-pro': 'gemini-3.1-pro',
  'gemini-1.5-pro': 'gemini-3.1-pro',
  'gemini-1.5-flash': 'gemini-2.5-flash',
  'gemini-1.5-flash-8b': 'gemini-2.5-flash',
  // OpenAI
  'gpt-4-vision-preview': 'gpt-4o',
  'gpt-4-turbo-preview': 'gpt-4o',
  'gpt-4-turbo': 'gpt-5.4',
  // Anthropic — Claude 3.x dated snapshots
  'claude-3-5-sonnet-20241022': 'claude-sonnet-5',
  'claude-3-opus-20240229': 'claude-opus-5',
  'claude-3-haiku-20240307': 'claude-haiku-4-5',
};

export const getAIConfig = async (companyId: string): Promise<AIConfig | null> => {
  try {
    // Use the SECURITY DEFINER RPC — bypasses the RLS timing issue where
    // auth.uid() can transiently return NULL on the direct table read,
    // causing a 406 from .single() even though the row exists.
    const { data, error } = await supabase
      .rpc('get_my_ai_config', { p_company_id: companyId });

    if (error) {
      console.warn('[AI] getAIConfig RPC error:', error.message, error.code);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    // Normalize stale model names transparently
    if (row.model && MODEL_ALIASES[row.model]) {
      row.model = MODEL_ALIASES[row.model];
    }
    if (row.vision_model && MODEL_ALIASES[row.vision_model]) {
      row.vision_model = MODEL_ALIASES[row.vision_model];
    }
    return row as AIConfig;
  } catch (err) {
    console.warn('[AI] getAIConfig failed:', err);
    return null;
  }
};

/**
 * Route ALL AI provider calls through the /api/ai-proxy Vercel Edge Function.
 * Direct browser→provider calls fail with CORS preflight errors — browsers are
 * not allowed to call AI provider APIs cross-origin. The proxy runs server-side
 * where CORS doesn't apply.
 *
 * The caller's Supabase session JWT is forwarded as a Bearer token so the
 * proxy can verify identity and resolve the provider API key server-side.
 * Provider keys are NEVER sent from this function — they live in the database.
 */
const callProxy = async (
  provider: string,
  model: string,
  body: object,
  image_url?: string,
): Promise<Response> => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  return fetch('/api/ai-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ provider, model, body, image_url }),
  });
};

// Returns the vision-capable config to use for photo analysis.
// If a separate vision provider is configured, uses that — otherwise falls back to primary.
// Note: api keys are NOT in AIConfig — they are resolved server-side by the proxy.
const getVisionConfig = (config: AIConfig): AIConfig => {
  if (config.vision_provider && config.vision_model) {
    return {
      provider: config.vision_provider,
      model: MODEL_ALIASES[config.vision_model] || config.vision_model,
      enabled: true,
    };
  }
  return config;
};

export const analyzePhoto = async (
  companyId: string,
  imageUrl: string,
  prompt: string = 'Analyze this property damage photo and suggest repair items with descriptions and estimated quantities.'
): Promise<string> => {
  const config = await getAIConfig(companyId);
  if (!config) throw new Error('AI not configured');

  const visionConfig = getVisionConfig(config);

  switch (visionConfig.provider) {
    case 'openai':
      return analyzePhotoOpenAI(visionConfig, imageUrl, prompt);
    case 'anthropic':
      return analyzePhotoAnthropic(visionConfig, imageUrl, prompt);
    case 'google':
      return analyzePhotoGoogle(visionConfig, imageUrl, prompt);
    case 'groq':
      throw new Error('Groq does not support photo analysis. Please configure a Vision AI provider (Google Gemini, OpenAI, or Anthropic) in your AI Settings.');
    default:
      throw new Error('Photo analysis is not supported by the selected provider. Please configure a Vision AI provider.');
  }
};

const analyzePhotoOpenAI = async (config: AIConfig, imageUrl: string, prompt: string): Promise<string> => {
  return withRetry(async () => {
    const body = {
      model: config.model,
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    };
    const response = await callProxy('openai', config.model, body);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'OpenAI API error');
    return data.choices[0].message.content;
  }, 'OpenAI');
};

const analyzePhotoAnthropic = async (config: AIConfig, imageUrl: string, prompt: string): Promise<string> => {
  return withRetry(async () => {
    const body = {
      model: config.model,
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', source: { type: 'url', url: imageUrl } },
          ],
        },
      ],
    };
    const response = await callProxy('anthropic', config.model, body);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Anthropic API error');
    return data.content[0].text;
  }, 'Anthropic');
};

const analyzePhotoGoogle = async (config: AIConfig, imageUrl: string, prompt: string): Promise<string> => {
  // Pass image_url to the proxy — it downloads and base64-encodes the image
  // server-side (Edge Function), avoiding any client-side CORS/network issues.
  return withRetry(async () => {
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
    };
    const response = await callProxy('google', config.model, body, imageUrl);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Google API error');
    return data.candidates[0].content.parts[0].text;
  }, 'Google Gemini');
};

export const generateProjectDescription = async (
  companyId: string,
  projectType: string,
  lineItems: string[]
): Promise<string> => {
  const config = await getAIConfig(companyId);
  if (!config) throw new Error('AI not configured');

  const prompt = `Generate a professional project description for a ${projectType} project that includes the following work items:\n${lineItems.join('\n')}\n\nWrite a clear, professional description suitable for a customer-facing quote.`;

  return generateText(config, prompt);
};

export const generateQuoteProjectDescription = async (
  companyId: string,
  context: {
    projectType: string;
    coverPageTitle?: string;
    notes?: string;
    customerName?: string;
    propertyAddress?: string;
    lineItems: Array<{
      item_name: string;
      description?: string;
      category?: string;
      good_product?: string;
      better_product?: string;
      best_product?: string;
      tiers_applicable?: string[];
    }>;
    photoNotes?: string[];
    measurementSummary?: string;
    existingDescription?: string;
    /** Template names loaded per tier, e.g. { good: 'Dimensional Shingles', better: 'Corrugated Metal', best: 'Standing Seam' } */
    perTierLabels?: { good?: string; better?: string; best?: string };
  }
): Promise<string> => {
  const config = await getAIConfig(companyId);
  if (!config) throw new Error('AI not configured');

  // Use the user's cover page title as the primary anchor for the description.
  // This is the most important signal — it tells us exactly what the job is
  // (e.g. "Roof Repair" should stay focused on roofing, not bleed into siding).
  const titleAnchor = context.coverPageTitle?.trim() || context.projectType;

  // Extract product names from branded tier products only — never from item_name,
  // which would mix generic scope descriptions ("Gutters", "Siding") into the
  // product list and cause the AI to hallucinate off-scope materials.
  const primaryProducts = context.lineItems
    .map(item => item.better_product || item.good_product || item.best_product)
    .filter((name): name is string => !!name && name.trim().length > 0)
    .filter((name, i, arr) => arr.indexOf(name) === i)
    .slice(0, 3); // Show top 3 key products — accessories line appended in prompt

  // Detect when a template has been loaded into all three tiers:
  // 2+ line items each have products in Good, Better, AND Best simultaneously.
  const multiTierCount = context.lineItems.filter(
    item => item.good_product?.trim() && item.better_product?.trim() && item.best_product?.trim()
  ).length;
  const isMultiTierTemplate = multiTierCount >= 2;

  // Detect when DIFFERENT templates were loaded per tier (items are split by tiers_applicable).
  // E.g. Good = dimensional shingles items, Better = corrugated metal items, Best = standing seam items.
  const goodOnlyItems = context.lineItems.filter(
    item => item.tiers_applicable?.length === 1 && item.tiers_applicable[0] === 'good'
  );
  const betterOnlyItems = context.lineItems.filter(
    item => item.tiers_applicable?.length === 1 && item.tiers_applicable[0] === 'better'
  );
  const bestOnlyItems = context.lineItems.filter(
    item => item.tiers_applicable?.length === 1 && item.tiers_applicable[0] === 'best'
  );
  const isSeparateTierTemplates = goodOnlyItems.length >= 2 && betterOnlyItems.length >= 2 && bestOnlyItems.length >= 2;

  // Brand detection — enforce brand consistency so the AI never mixes Atlas
  // products with Owens Corning, GAF, etc. in the same description.
  const KNOWN_BRANDS = [
    'Atlas', 'GAF', 'Owens Corning', 'CertainTeed', 'IKO', 'TAMKO',
    'James Hardie', 'LP SmartSide', 'ProVia', 'KayCAN', 'Allura', 'Royal',
  ];
  const userText = `${context.coverPageTitle || ''} ${context.notes || ''}`.toLowerCase();
  const brandFromText = KNOWN_BRANDS.find(b => userText.includes(b.toLowerCase()));
  const brandFromProducts = KNOWN_BRANDS.find(
    b => primaryProducts.filter(p => p.toLowerCase().includes(b.toLowerCase())).length >= 2,
  );
  const constraintBrand = brandFromProducts || brandFromText;
  const brandConstraint = constraintBrand
    ? `\nMANDATORY BRAND RULE: Every product named in this description MUST be a ${constraintBrand} product. Do NOT mention any other manufacturer — no mixing of brands whatsoever.`
    : '';

  // Build a concise scope summary. Show only the single chosen product per line
  // item (better > good > best) to keep the list clean and brand-consistent.
  const lineItemSummary = context.lineItems.length
    ? context.lineItems
        .slice(0, 20)
        .map((item) => {
          const chosenProduct = item.better_product || item.good_product || item.best_product;
          return `- ${item.category || 'General'}: ${item.item_name}${chosenProduct ? ` [${chosenProduct}]` : item.description ? ` (${item.description})` : ''}`;
        })
        .join('\n')
    : '- No line items have been added yet.';

  const photoSummary = context.photoNotes?.filter(Boolean).length
    ? context.photoNotes.filter(Boolean).map((note) => `- ${note}`).join('\n')
    : null;

  const productLine = primaryProducts.length
    ? `\nKey materials: ${primaryProducts.join(', ')}, along with all other accessories, fasteners, and components to complete the roofing system`
    : '';

  const seedSection = context.existingDescription?.trim()
    ? `\nEstimator's draft / notes (expand on this — preserve all specific details, materials, and intent):\n"${context.existingDescription.trim()}"\n`
    : '';

  // Build per-tier context for the separate-template scenario
  let separateTierSection = '';
  if (isSeparateTierTemplates) {
    const goodLabel = context.perTierLabels?.good || 'Good';
    const betterLabel = context.perTierLabels?.better || 'Better';
    const bestLabel = context.perTierLabels?.best || 'Best';
    separateTierSection = `\nTier material options:
- Good (${goodLabel}): ${goodOnlyItems.slice(0, 3).map(i => i.item_name).join(', ')}
- Better (${betterLabel}): ${betterOnlyItems.slice(0, 3).map(i => i.item_name).join(', ')}
- Best (${bestLabel}): ${bestOnlyItems.slice(0, 3).map(i => i.item_name).join(', ')}`;
  }

  const multiTierInstruction = (isMultiTierTemplate || isSeparateTierTemplates)
    ? '\n- MULTIPLE MATERIAL OPTIONS AVAILABLE: This proposal offers three different product options across Good, Better, and Best tiers. The description should acknowledge that multiple material options are available to fit different needs and budgets, that the customer is welcome to choose the option that best suits them, and that their sales representative is available to help guide them in the right direction and answer any questions.'
    : '';

  const prompt = `Write a professional, customer-facing project description for a QuoteMGR proposal.

Project title (user-defined — this is the primary subject of the description): ${titleAnchor}
Project type: ${context.projectType}
Customer: ${context.customerName || 'Unknown customer'}
Property: ${context.propertyAddress || 'Unknown property'}
Measurement summary: ${context.measurementSummary || 'No measurement summary provided'}${productLine}${separateTierSection}
${seedSection}
Scope items:
${lineItemSummary}
${photoSummary ? `\nPhoto observations:\n${photoSummary}` : ''}
Requirements:
- CRITICAL: Base the description on the "Project title" above. If the title says "Roof Repair", describe a roof repair — do NOT reference siding, gutters, drywall, or any work that is not indicated by the title and scope.
- Keep it concise and professional (2–4 sentences).
- Name only the top 2–3 key branded materials (e.g. shingles, underlayment, ridge cap). Do NOT list every product. End the materials reference with "along with all other accessories, fasteners, and components to complete the roofing system."
- Only reference branded products that appear in the scope above; do not invent product names.
- Describe the job scope naturally — what is being replaced, repaired, or installed.
- Make it appropriate for a customer-facing construction/restoration quote.
- Return plain text only, no bullet list, no heading.${context.existingDescription?.trim() ? '\n- The estimator\'s draft above is the PRIMARY source of truth — expand and polish it, do not contradict or omit anything they wrote.' : ''}${multiTierInstruction}${brandConstraint}`;

  return generateText(config, prompt);
};

export const suggestTierDescriptions = async (
  companyId: string,
  context: {
    projectType: string;
    goodTierName: string;
    betterTierName: string;
    bestTierName: string;
    goodTotal: number;
    betterTotal: number;
    bestTotal: number;
    lineItemSample: string[];
    goodHint?: string;
    betterHint?: string;
    bestHint?: string;
  }
): Promise<{ good: string; better: string; best: string }> => {
  const config = await getAIConfig(companyId);
  if (!config) throw new Error('AI not configured');

  // Build per-tier hint lines — only include if the user typed something
  const hintLine = (name: string, hint?: string) =>
    hint?.trim()
      ? `- ${name}: user note — "${hint.trim()}"`
      : `- ${name}: (no note provided — infer from project type and line items)`;

  const prompt = `You are a roofing/exterior contractor helping a salesperson write 1-2 sentence descriptions for each tier of a Good/Better/Best proposal.

Project: ${context.projectType}
Sample line items: ${context.lineItemSample.slice(0, 8).join(', ')}
Totals: ${context.goodTierName} $${context.goodTotal.toFixed(0)} | ${context.betterTierName} $${context.betterTotal.toFixed(0)} | ${context.bestTierName} $${context.bestTotal.toFixed(0)}

The salesperson has provided notes describing what each tier covers. Use these notes as the PRIMARY basis for each description — write about what the note describes (e.g. if the note says "full replacement", write a description about a full replacement; if it says "repair only", write about a repair option).

${hintLine(context.goodTierName, context.goodHint)}
${hintLine(context.betterTierName, context.betterHint)}
${hintLine(context.bestTierName, context.bestHint)}

Write a concise, compelling 1-2 sentence value proposition for EACH tier. Focus on WHY a homeowner would choose that tier — the quality, longevity, and protection it provides. Do NOT mention the price.

Respond ONLY with valid JSON, no markdown:
{"good": "...", "better": "...", "best": "..."}`;

  const rawResponse = await generateText(config, prompt);
  const cleaned = rawResponse.replace(/\`\`\`(?:json)?\s*/gi, '').replace(/\`\`\`\s*/g, '').trim();
  return JSON.parse(cleaned);
};

export type PriceSuggestionSource = 'historical' | 'ai_estimate' | 'web_search';

export interface PriceSuggestion {
  low: number;
  mid: number;
  high: number;
  reasoning: string;
  source: PriceSuggestionSource;
  sampleCount?: number; // number of past quotes used (historical only)
  oldestDate?: string;  // ISO date of oldest sample (historical only)
}

// ── Historical pricing engine ─────────────────────────────────────────────────
// Queries past quote_line_items for this company and finds items whose names
// are similar enough to use as a price anchor. Returns null if not enough data.
const getHistoricalPricing = async (
  companyId: string,
  itemName: string,
): Promise<{ low: number; mid: number; high: number; sampleCount: number; oldestDate: string } | null> => {
  // Normalise for fuzzy matching — lowercase, strip punctuation
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const needle = norm(itemName);
  const words = needle.split(/\s+/).filter(w => w.length > 2);

  // Fetch the last 200 non-zero line items from SENT/VIEWED/SIGNED/EXPIRED quotes only.
  // Drafts are excluded — they often contain test data, $0 placeholders, or incorrect
  // FastLane-assembled values that would skew the historical average.
  const { data, error } = await supabase
    .from('quote_line_items')
    .select('item_name, good_price, better_price, best_price, quotes!inner(company_id, created_at, status)')
    .eq('quotes.company_id', companyId)
    .in('quotes.status', ['sent', 'viewed', 'signed', 'expired', 'declined'])
    .gt('good_price', 0)
    .order('quotes(created_at)', { ascending: false })
    .limit(200);

  if (error || !data || data.length === 0) return null;

  // Score each row by word overlap with the target item name
  const scored = data
    .map((row: any) => {
      const rowNorm = norm(row.item_name || '');
      const rowWords = rowNorm.split(/\s+/);
      const matches = words.filter(w => rowWords.some(rw => rw.includes(w) || w.includes(rw)));
      return { row, score: matches.length };
    })
    .filter(({ score }) => score >= Math.max(1, Math.floor(words.length * 0.5)))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20); // top 20 matches

  if (scored.length < 3) return null; // need at least 3 samples to be meaningful

  const goodPrices   = scored.map(({ row }) => row.good_price).filter((p: number) => p > 0);
  const betterPrices = scored.map(({ row }) => row.better_price).filter((p: number) => p > 0);
  const bestPrices   = scored.map(({ row }) => row.best_price).filter((p: number) => p > 0);

  // Remove outliers using IQR method before averaging so a handful of bad test-quote
  // values don't drag the result far from the real market price.
  const withoutOutliers = (arr: number[]): number[] => {
    if (arr.length < 4) return arr;
    const sorted = [...arr].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    // Use 2.5×IQR fence so we only drop genuine outliers, not just spread
    return sorted.filter(v => v >= q1 - 2.5 * iqr && v <= q3 + 2.5 * iqr);
  };

  const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  const low  = Math.round(avg(withoutOutliers(goodPrices))   * 100) / 100;
  const mid  = Math.round(avg(withoutOutliers(betterPrices)) * 100) / 100;
  const high = Math.round(avg(withoutOutliers(bestPrices))   * 100) / 100;

  if (low === 0 && mid === 0 && high === 0) return null;

  const dates = scored
    .map(({ row }) => row.quotes?.created_at)
    .filter(Boolean)
    .sort();
  const oldestDate = dates[0] ? new Date(dates[0]).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';

  return { low, mid, high, sampleCount: scored.length, oldestDate };
};

export const suggestPricing = async (
  companyId: string,
  itemDescription: string,
  quantity: number,
  unit: string
): Promise<PriceSuggestion> => {
  // ── 1. Try historical data first ───────────────────────────────────────────
  const itemName = itemDescription.split(':')[0].trim();
  const historical = await getHistoricalPricing(companyId, itemName);

  if (historical) {
    return {
      low:         historical.low,
      mid:         historical.mid  || historical.low,
      high:        historical.high || historical.mid || historical.low,
      reasoning:   `Averaged from ${historical.sampleCount} similar line items in your past quotes.`,
      source:      'historical',
      sampleCount: historical.sampleCount,
      oldestDate:  historical.oldestDate,
    };
  }

  // ── 2. Web-search pricing via Supabase Edge Function (Perplexity sonar-pro) ──
  try {
    const { data: webData, error: webError } = await supabase.functions.invoke('suggest-price', {
      body: { itemName, quantity, unit },
    });
    if (!webError && webData?.low != null && webData?.mid != null && webData?.high != null) {
      return {
        low:       webData.low,
        mid:       webData.mid,
        high:      webData.high,
        reasoning: webData.reasoning ?? '',
        source:    'web_search',
      };
    }
    // Edge function unavailable or returned an error — fall through to AI fallback
    if (webError) console.warn('suggest-price edge function error:', webError);
  } catch (edgeFnErr) {
    console.warn('suggest-price edge function threw:', edgeFnErr);
  }

  // ── 3. Static AI fallback ──────────────────────────────────────────────────
  const config = await getAIConfig(companyId);
  if (!config) throw new Error('AI not configured and no historical data found');

  const prompt = `You are a US building materials cost expert. Suggest MATERIAL-ONLY prices for this line item — what a contractor pays their supplier or distributor, with NO labor and NO markup included.

Item: ${itemDescription}
Quantity: ${quantity} ${unit}

IMPORTANT RULES:
- Prices are MATERIAL COST ONLY — what the contractor pays at the supply house
- Do NOT include labor, installation, overhead, or profit margin
- The contractor will add their own markup separately
- Prices must be PER UNIT (per ${unit}), NOT total project cost
- Low = economy/builder-grade material | Mid = standard quality | High = premium brand
- Base prices on current US distributor/supply house rates (${new Date().getFullYear()})

MATERIAL COST ANCHORS (contractor supply-house pricing, NO labor):
- 3-tab shingles: $55-85/sq (3 bundles per square)
- Architectural shingles (GAF HDZ, Atlas Pinnacle Pristine, OC Duration, CertainTeed Landmark): $85-120/sq
- Class 4 / impact-resistant shingles (ArmorShield II, StormMaster, Malarkey Vista): $130-210/sq
- Standing seam metal panels: $150-350/sq
- Synthetic underlayment: $12-28/sq
- Ice & water shield: $28-58/sq
- Ridge cap shingles: $1.50-3.50/lf
- Drip edge: $0.40-1.10/lf
- Step flashing: $0.60-1.50/lf
- Pipe boots: $8-25/each
- OSB decking (7/16" 4×8 sheet): $32-58/sheet
- Vinyl siding: $1.20-3.50/sq ft
- LP SmartSide / fiber cement: $1.80-4.50/sq ft
- House wrap: $0.08-0.22/sq ft
- Aluminum gutters (5"): $1.50-3.80/lf | Copper: $8-18/lf
- Gutter guards: $1.50-7.00/lf
- Downspouts: $1.00-2.50/lf
- Drywall (4×8 sheet): $12-22/sheet
- Lumber (2×4×8): $4-9/each
- Paint (exterior, 1 gal): $35-85/gal

If the item is pure labor (tear-off, cleanup, etc.) with no material component, return low=0, mid=0, high=0.

Respond ONLY with valid JSON, no markdown, no explanation outside the JSON:
{"low": number, "mid": number, "high": number, "reasoning": "one sentence describing what grade of material each price reflects"}`;

  const rawResponse = await generateText(config, prompt);
  const cleaned = rawResponse.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return { ...parsed, source: 'ai_estimate' };
};

/**
 * Generate a short, customer-facing description for a single line item.
 * Takes the item name, category, and any known product/material names and
 * returns 1-2 polished sentences suitable for the customer proposal.
 */
export const generateLineItemDescription = async (
  companyId: string,
  item: {
    item_name: string;
    category?: string;
    good_product?: string | null;
    better_product?: string | null;
    best_product?: string | null;
    existing_description?: string | null;
  }
): Promise<string> => {
  // ── 1. Try the Supabase edge function first (uses company's own Groq key,
  //       avoids the Vercel ai-proxy entirely) ───────────────────────────────
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const { data: edgeResult, error: edgeError } = await supabase.functions.invoke('suggest-description', {
      body: {
        itemName: item.item_name,
        category: item.category,
        goodProduct: item.good_product || null,
        betterProduct: item.better_product || null,
        bestProduct: item.best_product || null,
        existingDescription: item.existing_description || null,
      },
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined,
    });

    if (!edgeError && edgeResult?.description) {
      return edgeResult.description as string;
    }
    if (edgeError) console.warn('[generateLineItemDescription] edge function error:', edgeError);
  } catch (edgeFnErr) {
    console.warn('[generateLineItemDescription] edge function threw:', edgeFnErr);
  }

  // ── 2. Fall back to ai-proxy (OpenAI / Anthropic / Google / non-Groq configs) ──
  const config = await getAIConfig(companyId);
  if (!config) throw new Error('AI not configured');

  const products = [item.good_product, item.better_product, item.best_product]
    .filter((p): p is string => !!p && p.trim().length > 0)
    .filter((p, i, arr) => arr.indexOf(p) === i);

  const productLine = products.length
    ? `\nAssociated products/materials: ${products.join(', ')}`
    : '';

  const existingLine = item.existing_description?.trim()
    ? `\nExisting description (improve/rewrite this): "${item.existing_description.trim()}"`
    : '';

  const prompt = `Write a concise, professional, customer-facing description for a single line item on a home improvement / roofing quote.

Line item: ${item.item_name}
Category: ${item.category || 'General'}${productLine}${existingLine}

Requirements:
- 1-2 sentences maximum.
- Written for a homeowner — explain what the work involves and why it matters (quality, protection, longevity).
- If specific product names are listed above, mention them naturally.
- Plain text only, no bullets, no heading.
- Do NOT start with "This item" or "This line item".`;

  return generateText(config, prompt);
};

export const generateEmailDraft = async (
  companyId: string,
  customerName: string,
  quoteNumber: string,
  projectDescription: string,
  totalAmount: number
): Promise<string> => {
  const config = await getAIConfig(companyId);
  if (!config) throw new Error('AI not configured');

  const prompt = `Write a professional email to send a quote to a customer:
Customer: ${customerName}
Quote #: ${quoteNumber}
Project: ${projectDescription}
Total: $${totalAmount.toLocaleString()}

Write a friendly, professional email that introduces the quote and encourages them to review it.`;

  return generateText(config, prompt);
};


/**
 * Replaces whatever the model signed off with by the real sender's details.
 *
 * Models close an email whether or not you ask them to, and with nobody to
 * name they invent one — "[Your Name]", "Senior Project Manager", a 555 phone
 * number. Anything from the last closing onwards is dropped, along with any
 * bracketed placeholder, and the account's own details are appended.
 */
const CLOSING_LINE = /^\s*(kind regards|best regards|warm regards|regards|sincerely|thanks again|thank you|thanks|cheers|respectfully|yours truly|yours sincerely)[,.!]?\s*$/i;

const appendQuoteEmailSignature = (
  body: string,
  context: {
    companyName: string;
    senderName?: string;
    senderTitle?: string;
    senderPhone?: string;
    senderEmail?: string;
  },
): string => {
  const lines = body.replace(/\r\n/g, '\n').split('\n');

  let cutAt = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (CLOSING_LINE.test(lines[i])) { cutAt = i; break; }
  }

  const kept = lines
    .slice(0, cutAt)
    // A placeholder the model slipped into the body itself.
    .filter(line => !/\[(your|company|rep|sender)[^\]]*\]/i.test(line));

  while (kept.length > 0 && !kept[kept.length - 1].trim()) kept.pop();

  const signature = ['Best regards,', '', context.senderName?.trim() || context.companyName]
    .concat(context.senderTitle?.trim() ? [context.senderTitle.trim()] : [])
    .concat(context.senderName?.trim() ? [context.companyName] : [])
    .concat(context.senderPhone?.trim() ? [context.senderPhone.trim()] : [])
    .concat(context.senderEmail?.trim() ? [context.senderEmail.trim()] : []);

  return [...kept, '', ...signature].join('\n');
};

export const generateQuoteEmailDraft = async (
  companyId: string,
  context: {
    customerName: string;
    quoteNumber: string;
    companyName: string;
    projectDescription: string;
    totalAmount: number;
    /**
     * The tier the total belongs to, and how many the quote actually offers.
     * The prompt used to state "Better-tier total" no matter what, so a quote
     * with only a Good option went out describing "this better-tier solution".
     */
    tierName?: string;
    tierCount?: number;
    /**
     * Who is sending this. Without them the model signs off with "[Your Name]"
     * and an invented phone number.
     */
    senderName?: string;
    senderTitle?: string;
    senderPhone?: string;
    senderEmail?: string;
  }
): Promise<AIQuoteEmailDraft> => {
  const config = await getAIConfig(companyId);
  if (!config) throw new Error('AI not configured');

  const prompt = `Write a professional email draft for sending a quote to a customer.

Return valid JSON only in this exact shape:
{
  "subject": "string",
  "body": "string"
}

Context:
- Customer name: ${context.customerName}
- Quote number: ${context.quoteNumber}
- Company name: ${context.companyName}
- Project description: ${context.projectDescription}
- Quote total: $${context.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
${(context.tierCount ?? 1) > 1
  ? `- The quote presents ${context.tierCount} options; the total above is the ${context.tierName || 'first'} option, so describe it as a starting price`
  : '- The quote presents a single option, so describe the total plainly'}

Requirements:
- Friendly and professional tone
- Mention the quote number
- Encourage the customer to review the quote
- Body should be plain text with paragraph breaks
- Do not include markdown
- Never describe the price as a "good", "better" or "best" tier unless a tier
  name is given above — most quotes have a single option and inventing a tier
  makes the email describe work the customer was never offered
- End after the closing paragraph. Do NOT write a sign-off, closing line,
  signature, or contact details — those are appended afterwards from real
  account data. Never output bracketed placeholders such as [Your Name].`;

  const response = await generateText(config, prompt);
  const parsed = parseJsonFromText<AIQuoteEmailDraft>(response);

  if (!parsed.subject?.trim() || !parsed.body?.trim()) {
    throw new Error('AI returned an invalid email draft.');
  }

  return { ...parsed, body: appendQuoteEmailSignature(parsed.body, context) };
};

export const analyzeQuotePhoto = async (
  companyId: string,
  imageUrl: string,
  context: {
    projectType: string;
    existingLineItemNames?: string[];
  }
): Promise<AIQuotePhotoAnalysis> => {
  const config = await getAIConfig(companyId);
  if (!config) throw new Error('AI not configured');
  const visionCfg = getVisionConfig(config);
  if (visionCfg.provider === 'groq') {
    throw new Error('Groq does not support photo analysis. Please configure a Vision AI provider (Google Gemini, OpenAI, or Anthropic) in your AI Settings.');
  }

  const prompt = `Analyze this property damage / construction photo for a quote builder.

Return valid JSON only in this exact shape:
{
  "caption": "short caption",
  "damage_type": "one of: Hail Damage, Wind Damage, Water Damage, Storm Damage, Wear & Tear, Rot/Decay, Mold/Mildew, Cracking, Missing Material, Structural Damage, Impact Damage, UV Damage, Other",
  "notes": "2-4 sentence professional field note",
  "suggested_line_items": [
    {
      "category": "Roofing|Siding|Windows|Doors|Paint - Exterior|Paint - Interior|Drywall|Flooring|Insulation|Fencing|Decking|General Labor|Permits & Fees|Other",
      "item_name": "short line item name",
      "description": "what needs to be repaired or replaced",
      "unit": "ea|lf|sq|sf|lot|hr",
      "quantity": 1
    }
  ]
}

Project type: ${context.projectType}
Existing line items:
${context.existingLineItemNames?.length ? context.existingLineItemNames.map((item) => `- ${item}`).join('\n') : '- None yet'}

Requirements:
- Be conservative and practical
- Only include line items that are visually justified
- Avoid duplicates of existing line items when possible
- Keep caption short and clear`;

  const response = await analyzePhotoWithPrompt(visionCfg, imageUrl, prompt);
  const parsed = parseJsonFromText<AIQuotePhotoAnalysis>(response);

  return {
    caption: parsed.caption?.trim() || 'AI analyzed photo',
    damage_type: parsed.damage_type?.trim() || 'Other',
    notes: parsed.notes?.trim() || '',
    suggested_line_items: Array.isArray(parsed.suggested_line_items)
      ? parsed.suggested_line_items
          .filter((item) => item?.item_name && item?.category)
          .map((item) => ({
            category: item.category,
            item_name: item.item_name,
            description: item.description || '',
            unit: item.unit || 'ea',
            quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
          }))
      : [],
  };
};

const generateTextGroq = async (config: AIConfig, prompt: string): Promise<string> => {
  return withRetry(async () => {
    const body = { model: config.model, messages: [{ role: 'user', content: prompt }], max_tokens: 1024, temperature: 0.7 };
    const response = await callProxy('groq', config.model, body);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Groq API error');
    return data.choices[0].message.content;
  }, 'Groq');
};

const generateText = async (config: AIConfig, prompt: string): Promise<string> => {
  switch (config.provider) {
    case 'openai':
      return generateTextOpenAI(config, prompt);
    case 'anthropic':
      return generateTextAnthropic(config, prompt);
    case 'google':
      return generateTextGoogle(config, prompt);
    case 'groq':
      return generateTextGroq(config, prompt);
    default:
      throw new Error('Unsupported provider');
  }
};

const analyzePhotoWithPrompt = async (config: AIConfig, imageUrl: string, prompt: string): Promise<string> => {
  switch (config.provider) {
    case 'openai':
      return analyzePhotoOpenAI(config, imageUrl, prompt);
    case 'anthropic':
      return analyzePhotoAnthropic(config, imageUrl, prompt);
    case 'google':
      return analyzePhotoGoogle(config, imageUrl, prompt);
    case 'groq':
      // Groq doesn't support vision — fall back to text-only analysis
      throw new Error('Photo analysis is not supported with Groq. Switch to OpenAI, Anthropic, or Google Gemini for photo analysis.');
    default:
      throw new Error('Unsupported provider');
  }
};

const generateTextOpenAI = async (config: AIConfig, prompt: string): Promise<string> => {
  return withRetry(async () => {
    const body = { model: config.model, messages: [{ role: 'user', content: prompt }], max_tokens: 500 };
    const response = await callProxy('openai', config.model, body);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'OpenAI API error');
    return data.choices[0].message.content;
  }, 'OpenAI');
};

const generateTextAnthropic = async (config: AIConfig, prompt: string): Promise<string> => {
  return withRetry(async () => {
    const body = { model: config.model, max_tokens: 500, messages: [{ role: 'user', content: prompt }] };
    const response = await callProxy('anthropic', config.model, body);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Anthropic API error');
    return data.content[0].text;
  }, 'Anthropic');
};

const generateTextGoogle = async (config: AIConfig, prompt: string): Promise<string> => {
  return withRetry(async () => {
    const body = { contents: [{ parts: [{ text: prompt }] }] };
    const response = await callProxy('google', config.model, body);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Google API error');
    return data.candidates[0].content.parts[0].text;
  }, 'Google Gemini');
};

// ── Error classification ──────────────────────────────────────────────────────

export interface AIError extends Error {
  retryAfterMs?: number;   // milliseconds to wait before retrying
  isQuotaError?: boolean;  // free-tier quota exhausted (needs billing)
  isBillingError?: boolean;
  isAuthError?: boolean;
}

/**
 * Parses raw API error messages (all providers) into a friendly AIError.
 * Extracts retry-after timing from Gemini's "Please retry in X.Xs" format.
 */
function parseAIError(message: string, provider: string): AIError {
  const err = new Error(message) as AIError;

  // Gemini / Google: "Please retry in 44.107548652s"
  const retryMatch = message.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (retryMatch) {
    err.retryAfterMs = Math.ceil(parseFloat(retryMatch[1]) * 1000);
  }

  // Free-tier quota exhausted (limit: 0)
  if (message.includes('free_tier') || (message.includes('limit: 0') && message.includes('Quota exceeded'))) {
    err.isQuotaError = true;
    err.message = `Gemini free tier quota exhausted. Please enable billing at https://aistudio.google.com or switch to Groq (free) in AI Settings.\n\nOriginal: ${message}`;
  } else if (message.includes('Quota exceeded') || message.includes('RESOURCE_EXHAUSTED') || message.toLowerCase().includes('rate limit') || message.includes('429')) {
    err.isQuotaError = true;
    if (err.retryAfterMs) {
      const secs = Math.ceil(err.retryAfterMs / 1000);
      err.message = `${provider} rate limited — retrying in ${secs}s…`;
    }
  } else if (message.toLowerCase().includes('invalid') && message.toLowerCase().includes('key') ||
             message.toLowerCase().includes('unauthorized') ||
             message.toLowerCase().includes('authentication') ||
             message.includes('401')) {
    err.isAuthError = true;
    err.message = `Invalid API key for ${provider}. Please update it in Settings → AI Estimating.`;
  } else if (message.includes('billing') || message.includes('payment') || message.includes('402')) {
    err.isBillingError = true;
    err.message = `${provider} billing issue. Please check your account and add a payment method.`;
  }

  return err;
}

/**
 * Wraps an async call with up to `maxRetries` attempts.
 * On rate limit errors, waits the retry-after duration before retrying.
 * On free-tier quota exhaustion, throws immediately (waiting won't help).
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  provider: string,
  maxRetries = 2
): Promise<T> {
  let lastErr: AIError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (raw: any) {
      const err = parseAIError(raw?.message || String(raw), provider);
      lastErr = err;

      // Don't retry billing/auth/quota exhaustion errors — they won't resolve by waiting
      if (err.isBillingError || err.isAuthError || err.isQuotaError && !err.retryAfterMs) {
        throw err;
      }

      // If we have a retry-after time and attempts remain, wait then retry
      if (err.retryAfterMs && attempt < maxRetries) {
        const waitMs = err.retryAfterMs + 1000; // add 1s buffer
        console.warn(`[AI] ${provider} rate limited. Retrying in ${Math.ceil(waitMs / 1000)}s (attempt ${attempt + 1}/${maxRetries})…`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      // No retry info or out of retries
      throw err;
    }
  }

  throw lastErr!;
}

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const parseJsonFromText = <T>(response: string): T => {
  const trimmed = response.trim();

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      return JSON.parse(fencedMatch[1].trim()) as T;
    }

    const objectStart = trimmed.indexOf('{');
    const objectEnd = trimmed.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) {
      return JSON.parse(trimmed.slice(objectStart, objectEnd + 1)) as T;
    }

    throw new Error('AI returned invalid JSON.');
  }
};

export const logAIUsage = async (
  companyId: string,
  userId: string,
  feature: string,
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  quoteId?: string
) => {
  const costPerMillion = {
    'gpt-5.4': { input: 1.25, output: 10 },
    'gpt-4o': { input: 5, output: 15 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'claude-sonnet-5': { input: 3, output: 15 },
    'claude-opus-5': { input: 5, output: 25 },
    'claude-haiku-4-5': { input: 1, output: 5 },
    'gemini-3.6-flash': { input: 0.3, output: 2.5 },
    'gemini-3.1-pro': { input: 2, output: 18 },
    'gemini-2.5-flash': { input: 0.3, output: 2.5 },
    'openai/gpt-oss-120b': { input: 0.59, output: 0.79 },
    'openai/gpt-oss-20b': { input: 0.05, output: 0.08 },
  };

  const costs = costPerMillion[model as keyof typeof costPerMillion] || { input: 0, output: 0 };
  const estimatedCost = (inputTokens / 1000000 * costs.input) + (outputTokens / 1000000 * costs.output);

  await supabase.from('ai_usage_log').insert({
    company_id: companyId,
    user_id: userId,
    feature,
    provider,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost: estimatedCost,
    quote_id: quoteId,
  });
};

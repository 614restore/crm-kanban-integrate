// Copied from QuoteMGR src/data/tierLadders.ts (read-only reference).
/**
 * Tier ladders — how Good / Better / Best pick *different products* from the
 * material list.
 *
 * Every row in the price list carries one price across all three tiers. A tier
 * is not a price adjustment; it is a different item. A quote that needs
 * flashing takes aluminum for Good, galvanized steel for Better, and copper for
 * Best, and each of those is charged at its own preset price. Nothing
 * fluctuates, and it is always clear which tier gets which product.
 *
 * Each rung must name a real item in the price list and every rung in a ladder
 * must share one unit, or the ladder is skipped rather than producing a line
 * priced in mixed units.
 */

export interface TierLadder {
  /** Human label, used in logs and the apply summary. */
  family: string;
  /** Matches the line item this ladder serves. */
  match: RegExp;
  /** Item names as they appear in the price list. */
  good: string;
  better: string;
  best: string;
}

export const TIER_LADDERS: TierLadder[] = [
  {
    // Resolves through the colorway rows in the price list. Skipped entirely
    // until every rung exists, so shingles keep their current pricing rather
    // than half-laddering.
    // GAF's own three tiers: 3-tab, architectural (Timberline), designer.
    // Prices are contractor cost from the material list, not retail.
    family: 'Field shingles',
    match: /architectural shingle|field shingle|^shingles?$/i,
    good: '3-Tab Shingle (Standard)',
    better: 'GAF Timberline HDZ',
    best: 'GAF Camelot II',
  },
  {
    family: 'Drip edge',
    match: /drip\s*edge/i,
    good: 'Aluminum Drip Edge – 10ft',
    better: 'Galvanized Steel Drip Edge – 10ft',
    best: 'Copper Drip Edge – 10ft',
  },
  {
    family: 'Step flashing',
    match: /step\s*flashing/i,
    good: 'Step Flashing – Aluminum',
    better: 'Step Flashing – Galvanized Steel',
    best: 'Step Flashing – Copper',
  },
  {
    family: 'Valley metal',
    match: /valley/i,
    good: 'Valley Metal – Galvanized 10ft',
    better: 'Valley Metal – Aluminum 10ft',
    best: 'Valley Metal – Copper 10ft',
  },
  {
    family: 'Chimney cap',
    match: /chimney\s*cap/i,
    good: 'Chimney Cap – Galvanized',
    better: 'Chimney Cap – Stainless Steel',
    best: 'Chimney Cap – Copper (16 oz)',
  },
  {
    family: 'Underlayment',
    match: /underlayment|felt|synthetic/i,
    // Good and Better are the same underlayment — Jeff installs one synthetic
    // on both, and only steps up at Best. Web previously laddered
    // Felt -> Summit 60 -> Deck-Armor, which priced Better at $184/roll against
    // mobile's $80 and was the largest remaining gap between the two apps.
    good: 'Atlas Summit® 60',
    better: 'Atlas Summit® 60',
    best: 'Atlas Summit® 180',
  },
  {
    family: 'Ice & water shield',
    match: /ice\s*&?\s*water|water\s*shield|i&w|iws/i,
    good: 'Atlas GlasBase Plus',
    better: 'Atlas Ice & Water Shield',
    best: 'Atlas StormSeal',
  },
];

export interface LadderRung {
  item_name: string;
  unit: string;
  good_price: number;
  better_price: number;
  best_price: number;
}

/**
 * Builds a rung lookup over a price list.
 *
 * Matches the exact name first, then falls back to a prefix match so a ladder
 * can name a product line — "Atlas Pinnacle Pristine" — and resolve to whichever
 * colorway rows exist, which is how shingles and siding are actually stocked.
 * The cheapest matching colorway wins, since colour shouldn't change the price
 * and a difference means one of them is mispriced.
 */
export const makeRungLookup = <T extends LadderRung>(rows: T[]) => (name: string): LadderRung | undefined => {
  const exact = rows.find(r => r.item_name === name);
  if (exact) return exact;
  const prefixed = rows.filter(r => r.item_name.startsWith(name + ' –') || r.item_name.startsWith(name + ' -'));
  if (prefixed.length === 0) return undefined;
  return prefixed.reduce((cheapest, row) => (row.good_price < cheapest.good_price ? row : cheapest));
};

export interface LadderResult {
  good_product: string;
  better_product: string;
  best_product: string;
  good_price: number;
  better_price: number;
  best_price: number;
  unit: string;
}

/**
 * Resolves a line item to its three per-tier products and their preset prices.
 *
 * `lookup` should search the company's own price library first so a contractor
 * who has repriced copper flashing gets their number, not the seeded one.
 * Returns null when no ladder matches, when a rung is missing from the library,
 * or when the rungs disagree on unit — in every one of those cases the caller
 * keeps the line exactly as it is rather than guessing.
 */
export const resolveTierLadder = (
  itemName: string,
  lookup: (name: string) => LadderRung | undefined,
): LadderResult | null => {
  const ladder = TIER_LADDERS.find(l => l.match.test(itemName));
  if (!ladder) return null;

  const good = lookup(ladder.good);
  const better = lookup(ladder.better);
  const best = lookup(ladder.best);
  if (!good || !better || !best) return null;

  // A ladder priced in mixed units would silently misprice the line.
  if (good.unit !== better.unit || good.unit !== best.unit) return null;

  return {
    good_product: good.item_name,
    better_product: better.item_name,
    best_product: best.item_name,
    // Each row is flat, so any of its three columns is that product's price.
    good_price: good.good_price,
    better_price: better.good_price,
    best_price: best.good_price,
    unit: good.unit,
  };
};

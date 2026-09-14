// Copied from QuoteMGR src/lib/laborGuard.ts (read-only reference).
/**
 * Labor guard.
 *
 * A quote that goes out with no labor on it is priced below cost — the crew
 * still has to be paid. Worse, the price-to-target solver treats missing labor
 * as zero and loads the entire target onto materials, so the number looks
 * plausible while the margin is gone. Sending is blocked until labor is
 * priced.
 */

export interface LaborCheckItem {
  item_name?: string | null;
  category?: string | null;
  quantity?: number | null;
  good_price?: number | null;
  better_price?: number | null;
  best_price?: number | null;
  is_divider?: boolean | null;
}

/** Labor lines are identified by name or category — same rule the markup uses. */
export const isLaborItem = (item: LaborCheckItem): boolean => {
  if (item.is_divider) return false;
  return /labor/i.test(item.item_name ?? '') || /labor/i.test(item.category ?? '');
};

/** True when at least one labor line carries a real amount. */
export const hasPricedLabor = (items: LaborCheckItem[]): boolean =>
  items.some(i => {
    if (!isLaborItem(i)) return false;
    const qty = i.quantity ?? 0;
    if (qty <= 0) return false;
    return (i.good_price ?? 0) > 0 || (i.better_price ?? 0) > 0 || (i.best_price ?? 0) > 0;
  });

/**
 * Quotes created before this date predate the labor requirement and are never
 * blocked. A quote that already exists — draft, sent, or signed — keeps the
 * terms it was written under; rule changes apply to new work only.
 */
export const LABOR_RULE_EFFECTIVE_FROM = '2026-08-10T00:00:00Z';

/**
 * Document types that price labor. Inspection reports and completion
 * certificates carry no labor by design and are never blocked, and neither is
 * anything written before the rule existed.
 */
export const quoteNeedsLabor = (
  quote: {
    project_type?: string | null;
    completion_certificate_enabled?: boolean | null;
    created_at?: string | null;
  } | null | undefined,
): boolean => {
  if (!quote) return false;
  if (quote.completion_certificate_enabled) return false;
  if (quote.project_type === 'inspection_report') return false;
  if (quote.created_at && new Date(quote.created_at) < new Date(LABOR_RULE_EFFECTIVE_FROM)) return false;
  return true;
};

export const LABOR_MISSING_MESSAGE =
  'This quote has no labor priced. Add your labor lines before sending — without them the quote is below cost and any target price loads onto materials.';

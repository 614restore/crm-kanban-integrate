import { supabase } from '@/lib/supabase';

export type QuoteNumberPrefix = 'QT' | 'IC' | 'IN';

/** The old clock-based number: <prefix>-<year>-<last 4 digits of Date.now()>. */
export function legacyQuoteNumber(prefix: QuoteNumberPrefix = 'QT', now: Date = new Date()): string {
  return `${prefix}-${now.getFullYear()}-${String(now.getTime()).slice(-4)}`;
}

/**
 * The company's next quote number (QT-2026-0001, -0002, ...), handed out by the
 * database so every app on the shared backend draws from the same per-company
 * sequence. Falls back to the old clock-based number if the function isn't
 * deployed or the call fails, so creating a quote never gets blocked by it.
 */
export async function nextQuoteNumber(companyId: string, prefix: QuoteNumberPrefix = 'QT'): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('next_quote_number', { p_company_id: companyId, p_prefix: prefix });
    if (!error && typeof data === 'string' && data) return data;
    if (error) console.warn('next_quote_number failed, using a clock-based number:', error.message);
  } catch (err) {
    console.warn('next_quote_number failed, using a clock-based number:', err);
  }
  return legacyQuoteNumber(prefix);
}

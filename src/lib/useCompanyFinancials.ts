import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * The company's financial totals as the database works them out (company_financial_summary), the same
 * numbers the mobile app shows. "Collected" counts receipts (the `payments` table), which this page's own
 * calculation never read, plus older deposit / final-payment fields and invoices marked paid by hand where
 * no receipt covers them, without counting any of them twice. "Outstanding" is what is still owed on
 * invoices that have gone out. Returns null until loaded (or if it cannot be), so the page falls back to
 * its own figures.
 */

export interface CompanyFinancials {
  totalCollected: number;
  totalOutstanding: number;
  receiptsTotal: number;
  receiptsCount: number;
  invoicesPaid: number;
  invoicesSentBalance: number;
  invoicesOverdueBalance: number;
  invoicesDraft: number;
}

export function useCompanyFinancials(companyId?: string | null): CompanyFinancials | null {
  const [summary, setSummary] = useState<CompanyFinancials | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('company_financial_summary', { p_company_id: companyId });
      if (cancelled || error || !data) return;
      const d = data as Record<string, unknown>;
      const n = (v: unknown) => Number(v ?? 0);
      setSummary({
        totalCollected: n(d.total_collected),
        totalOutstanding: n(d.total_outstanding),
        receiptsTotal: n(d.receipts_total),
        receiptsCount: n(d.receipts_count),
        invoicesPaid: n(d.invoices_paid),
        invoicesSentBalance: n(d.invoices_sent_balance),
        invoicesOverdueBalance: n(d.invoices_overdue_balance),
        invoicesDraft: n(d.invoices_draft),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return summary;
}

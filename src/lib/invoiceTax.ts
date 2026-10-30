import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** The company's invoice sales tax (Settings → Company). Off unless the company turns it on. */
export interface InvoiceTaxSetting {
  enabled: boolean;
  /** Percent, e.g. 7.25 */
  rate: number;
}

export const NO_INVOICE_TAX: InvoiceTaxSetting = { enabled: false, rate: 0 };

/** The rate to charge: 0 when tax is off. */
export const effectiveTaxRate = (s: InvoiceTaxSetting) => (s.enabled && s.rate > 0 ? s.rate : 0);

export function useInvoiceTax(companyId: string | null | undefined): InvoiceTaxSetting {
  const [setting, setSetting] = useState<InvoiceTaxSetting>(NO_INVOICE_TAX);
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    supabase
      .from('companies')
      .select('invoice_tax_enabled, invoice_tax_rate')
      .eq('id', companyId)
      .maybeSingle()
      .then(({ data, error }) => {
        // Before the columns exist (migration not run yet) this errors: treat as no tax.
        if (cancelled || error || !data) return;
        const row = data as { invoice_tax_enabled?: boolean | null; invoice_tax_rate?: number | string | null };
        setSetting({ enabled: !!row.invoice_tax_enabled, rate: Number(row.invoice_tax_rate) || 0 });
      });
    return () => { cancelled = true; };
  }, [companyId]);
  return setting;
}

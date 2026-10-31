import { describe, it, expect, vi } from 'vitest';

// crmStore creates the Supabase client on import; the matching rule needs none of it.
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import { buildRevenueCoverage } from '@/lib/revenueCoverage';
import { contactMatchesSearch } from '@/lib/crmStore';

describe('buildRevenueCoverage', () => {
  it('a receipt on the quote covers the invoice made from it, even with no customer on the receipt', () => {
    const { invoiceCoveredByReceipt } = buildRevenueCoverage(
      [{ customer_id: null, quote_id: 'q1' }],
      [{ contactId: 'c1', quoteId: 'q1' }],
    );
    expect(invoiceCoveredByReceipt({ contactId: 'c1', quoteId: 'q1' })).toBe(true);
  });

  it("a receipt on one job does not hide the customer's paid invoice for another job", () => {
    const { invoiceCoveredByReceipt } = buildRevenueCoverage(
      [{ customer_id: 'c1', quote_id: 'q1' }],
      [{ contactId: 'c1', quoteId: 'q1' }, { contactId: 'c1', quoteId: 'q2' }],
    );
    expect(invoiceCoveredByReceipt({ contactId: 'c1', quoteId: 'q2' })).toBe(false);
  });

  it('an invoice with no quote is covered by a quoteless receipt on its customer only', () => {
    const { invoiceCoveredByReceipt } = buildRevenueCoverage(
      [{ customer_id: 'c1', quote_id: null }, { customer_id: 'c2', quote_id: 'q9' }],
      [],
    );
    expect(invoiceCoveredByReceipt({ contactId: 'c1' })).toBe(true);
    expect(invoiceCoveredByReceipt({ contactId: 'c2' })).toBe(false);
  });

  it("a customer's deposit / final-payment fields are skipped when a receipt or invoice already counts them", () => {
    const { customerCoveredElsewhere } = buildRevenueCoverage(
      [{ customer_id: 'c1', quote_id: null }],
      [{ contactId: 'c2' }],
    );
    expect(customerCoveredElsewhere('c1')).toBe(true);
    expect(customerCoveredElsewhere('c2')).toBe(true);
    expect(customerCoveredElsewhere('c3')).toBe(false);
  });
});

describe('contactMatchesSearch', () => {
  const contact = {
    firstName: 'Jo', lastName: 'Li', email: 'jo.li@example.com', phone1: '(614) 555-0113',
    address: '1203 North Hamilton Road',
  } as any;

  it('matches first, last and full name, email, address and phone', () => {
    for (const q of ['jo', 'LI', 'jo li', 'example.com', 'hamilton', '555-0113', '6145550113']) {
      expect(contactMatchesSearch(contact, q)).toBe(true);
    }
    expect(contactMatchesSearch(contact, 'smith')).toBe(false);
  });

  it('copes with contacts missing email, phone or address', () => {
    const sparse = { firstName: 'Ann', lastName: '', email: undefined, phone1: undefined, address: undefined } as any;
    expect(contactMatchesSearch(sparse, 'ann')).toBe(true);
    expect(contactMatchesSearch(sparse, '614')).toBe(false);
  });
});

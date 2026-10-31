// Which money is already counted by a receipt, so revenue is never counted twice.
// The same rules as the shared company_financial_summary() the Dashboard reads:
//  - receipts (the payments table) always count;
//  - a paid invoice counts unless a receipt is on its quote, or — when the invoice has no
//    quote — a receipt with no quote is on its customer;
//  - a customer's deposit / final-payment fields count only when that customer has no
//    receipt and no invoice.

export interface ReceiptRef {
  customer_id: string | null;
  quote_id: string | null;
}

export interface InvoiceRef {
  contactId: string;
  quoteId?: string;
}

export function buildRevenueCoverage(receipts: ReceiptRef[], invoices: InvoiceRef[]) {
  const receiptQuotes = new Set<string>();
  const quotelessReceiptCustomers = new Set<string>();
  const customersWithReceipts = new Set<string>();
  for (const r of receipts) {
    if (r.customer_id) customersWithReceipts.add(r.customer_id);
    if (r.quote_id) receiptQuotes.add(r.quote_id);
    else if (r.customer_id) quotelessReceiptCustomers.add(r.customer_id);
  }
  const customersWithInvoices = new Set(invoices.map((inv) => inv.contactId).filter(Boolean));

  return {
    /** A paid invoice whose money a receipt already counts. */
    invoiceCoveredByReceipt: (inv: InvoiceRef) =>
      inv.quoteId ? receiptQuotes.has(inv.quoteId) : quotelessReceiptCustomers.has(inv.contactId),
    /** A customer whose deposit / final-payment fields a receipt or invoice already counts. */
    customerCoveredElsewhere: (customerId: string) =>
      customersWithReceipts.has(customerId) || customersWithInvoices.has(customerId),
  };
}

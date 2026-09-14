// The Invoices screen: QuoteMGR's invoice list and invoice detail, for the
// signed-in company. QuoteMGR switches between the two in its AppLayout; here the
// switch lives in this page so TrussCTR's view router needs a single entry.
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import type { InvoiceCompany } from '@/lib/invoicePdfGenerator';
import InvoicesView from './InvoicesView';
import InvoiceDetailView from './InvoiceDetailView';

export default function InvoicesPage() {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const [company, setCompany] = useState<InvoiceCompany | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoadFailed(false);
    db.getCompany(companyId)
      .then((c: any) => {
        if (cancelled) return;
        if (c) setCompany(c as InvoiceCompany);
        else setLoadFailed(true);
      })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, [companyId]);

  if (!companyId || !profile?.id) return null;

  if (loadFailed) {
    return <div className="p-8 text-sm text-gray-600">Could not load your company details for invoices.</div>;
  }

  if (!company) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-[#1e3a5f] rounded-full animate-spin" />
      </div>
    );
  }

  return selectedInvoiceId ? (
    <InvoiceDetailView
      invoiceId={selectedInvoiceId}
      company={company}
      companyId={companyId}
      onBack={() => setSelectedInvoiceId(null)}
    />
  ) : (
    <InvoicesView
      companyId={companyId}
      userId={profile.id}
      company={company}
      onViewInvoice={(id) => setSelectedInvoiceId(id)}
    />
  );
}

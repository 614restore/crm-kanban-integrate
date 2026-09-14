// Copied from QuoteMGR src/components/InvoiceDetailView.tsx (read-only reference).
// TrussCTR changes:
//  - Declares the change-order state the overpayment panel uses; QuoteMGR's copy
//    references it without declaring it, so that panel throws when it renders.
//  - Drops the duplicate payment_records field.
//  - Removes Copy Share Link: neither app has a page that opens /invoice/<token>.
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Download, Eye, Mail, CheckCircle2, MoreVertical, Trash2, Receipt } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { generateInvoicePdf } from '@/lib/invoicePdfGenerator';
import type { InvoiceCompany as Company } from '@/lib/invoicePdfGenerator';
import { buildInvoicePDF, loadLogoAsBase64, type InvoiceLineItemPDF, type PaymentRecordPDF } from '@/lib/buildInvoicePDF';

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issued_date: string;
  due_date: string;
  paid_at: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  deposit_required: number | null;
  deposit_paid: number | null;
  project_description: string | null;
  notes: string | null;
  payment_instructions: string | null;
  share_token: string | null;
  selected_tier: 'good' | 'better' | 'best' | 'all' | null;
  payment_records: PaymentRecordPDF[] | null;
  created_at: string;
  updated_at: string;
  customer?: {
    first_name: string;
    last_name: string;
    email: string;
    address: string;
  };
}

interface InvoiceDetailViewProps {
  invoiceId: string;
  company: Company;
  companyId: string;
  onBack: () => void;
}

const InvoiceDetailView: React.FC<InvoiceDetailViewProps> = ({
  invoiceId,
  company,
  companyId,
  onBack,
}) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItemPDF[]>([]);
  const [additionalItems, setAdditionalItems] = useState<InvoiceLineItemPDF[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showAddChangeOrder, setShowAddChangeOrder] = useState(false);
  const [changeOrderDesc, setChangeOrderDesc] = useState('');
  const [changeOrderAmount, setChangeOrderAmount] = useState('');
  const [savingChangeOrder, setSavingChangeOrder] = useState(false);

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showMenu]);

  const loadInvoice = async () => {
    try {
      const [{ data, error }, { data: items, error: itemErr }] = await Promise.all([
        supabase
          .from('invoices')
          .select(`*, customer:customers(first_name, last_name, email, address)`)
          .eq('id', invoiceId)
          .single(),
        supabase
          .from('invoice_line_items')
          .select('description, quantity, unit_price, total, display_only, is_additional, sort_order')
          .eq('invoice_id', invoiceId)
          .order('sort_order', { ascending: true }),
      ]);

      if (error) throw error;
      if (itemErr) throw itemErr;

      // Supabase returns numeric columns as strings — coerce to numbers
      const coercedInvoice = data ? {
        ...data,
        subtotal: Number(data.subtotal),
        tax_rate: Number(data.tax_rate),
        tax_amount: Number(data.tax_amount),
        total: Number(data.total),
        deposit_paid: data.deposit_paid != null ? Number(data.deposit_paid) : null,
        deposit_required: data.deposit_required != null ? Number(data.deposit_required) : null,
      } : null;
      setInvoice(coercedInvoice);
      const allItems = (items || []).map(item => ({
        ...item,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        total: Number(item.total),
      })) as (InvoiceLineItemPDF & { is_additional: boolean })[];
      setLineItems(allItems.filter(i => !i.is_additional));
      setAdditionalItems(allItems.filter(i => i.is_additional));
    } catch (error) {
      console.error('[InvoiceDetailView] Error loading invoice:', error);
      toast.error('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const getStatusBadge = (status: Invoice['status']) => {
    const styles: Record<Invoice['status'], { bg: string; text: string; dot: string; label: string }> = {
      draft:     { bg: 'bg-gray-100',   text: 'text-gray-700',   dot: 'bg-gray-500',  label: 'Draft' },
      sent:      { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-600',  label: 'Sent' },
      paid:      { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-600', label: 'Paid' },
      overdue:   { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-600',   label: 'Overdue' },
      cancelled: { bg: 'bg-gray-300',   text: 'text-gray-700',   dot: 'bg-gray-500',  label: 'Cancelled' },
    };
    const s = styles[status];
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${s.bg} ${s.text}`}>
        <span className={`w-2 h-2 rounded-full ${s.dot}`} />
        {s.label}
      </span>
    );
  };

  // Approved change orders (additional items included in the total)
  const approvedChangeOrderTotal = additionalItems
    .filter(i => !i.display_only)
    .reduce((sum, i) => sum + i.total, 0);
  const effectiveTotal = (invoice?.total ?? 0) + approvedChangeOrderTotal;

  // Use payment_records when available; deposit_paid as fallback
  const totalFromRecords = (invoice?.payment_records ?? [])
    .filter((r: PaymentRecordPDF) => r.type === 'received' || r.type === 'credit')
    .reduce((s: number, r: PaymentRecordPDF) => s + Number(r.amount), 0);
  const effectivePaid = Math.max(totalFromRecords, invoice?.deposit_paid ?? 0);
  const overpayment = Math.max(0, effectivePaid - effectiveTotal);

  const getBalanceDue = () => Math.max(0, effectiveTotal - effectivePaid);

  const handleSaveChangeOrder = async () => {
    const amount = parseFloat(changeOrderAmount);
    if (!amount || !changeOrderDesc.trim() || !invoice) return;
    setSavingChangeOrder(true);
    try {
      const { error } = await supabase.from('invoice_line_items').insert({
        invoice_id: invoice.id,
        description: changeOrderDesc.trim(),
        quantity: 1,
        unit_price: amount,
        total: amount,
        display_only: false,
        is_additional: true,
        sort_order: lineItems.length + additionalItems.length,
      });
      if (error) throw error;
      setChangeOrderDesc('');
      setChangeOrderAmount('');
      setShowAddChangeOrder(false);
      await loadInvoice();
      toast.success('Change order applied');
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message);
    } finally {
      setSavingChangeOrder(false);
    }
  };

  const fetchLineItems = async (id: string) => {
    const { data } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', id)
      .order('sort_order');
    return data || [];
  };

  const handleDownloadPdf = async () => {
    if (!invoice || generatingPdf) return;
    setGeneratingPdf(true);
    setShowMenu(false);
    try {
      const lineItems = await fetchLineItems(invoice.id);
      await generateInvoicePdf(invoice, company, lineItems, 'invoice');
      toast.success('PDF downloaded');
    } catch (err) {
      console.error('[InvoiceDetailView] PDF error:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!invoice || generatingPdf) return;
    setGeneratingPdf(true);
    setShowMenu(false);
    try {
      const lineItems = await fetchLineItems(invoice.id);
      await generateInvoicePdf(invoice, company, lineItems, 'receipt');
      toast.success('Receipt downloaded');
    } catch (err) {
      console.error('[InvoiceDetailView] Receipt error:', err);
      toast.error('Failed to generate receipt');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handlePreviewPdf = async () => {
    if (!invoice || generatingPdf) return;
    setGeneratingPdf(true);
    setShowMenu(false);
    try {
      const lineItems = await fetchLineItems(invoice.id);
      await generateInvoicePdf(invoice, company, lineItems, 'invoice', 'preview');
    } catch (err) {
      console.error('[InvoiceDetailView] Preview error:', err);
      toast.error('Failed to preview invoice');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSendEmail = async () => {
    if (!invoice || sendingEmail) return;
    if (!invoice.customer?.email) {
      toast.error('No customer email address found');
      return;
    }
    setSendingEmail(true);
    setShowMenu(false);
    try {
      const lineItems = await fetchLineItems(invoice.id);
      const { error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          to_email: invoice.customer.email,
          to_name: `${invoice.customer.first_name} ${invoice.customer.last_name}`,
          from_company: (company as any).name,
          invoice_number: invoice.invoice_number,
          invoice_total: invoice.total,
          due_date: invoice.due_date,
          payment_instructions: invoice.payment_instructions,
          line_items: lineItems.map((item: any) => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
          })),
          company_id: companyId,
        },
      });

      if (error) throw error;

      if (invoice.status === 'draft') {
        await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoice.id);
        setInvoice(prev => prev ? { ...prev, status: 'sent' } : null);
      }

      toast.success(`Invoice emailed to ${invoice.customer.email}`);
    } catch (err) {
      console.error('[InvoiceDetailView] Email error:', err);
      toast.error('Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendReceiptEmail = async () => {
    if (!invoice || sendingEmail) return;
    if (!invoice.customer?.email) {
      toast.error('No customer email address found');
      return;
    }
    setSendingEmail(true);
    setShowMenu(false);
    try {
      const lineItems = await fetchLineItems(invoice.id);
      const { error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          to_email: invoice.customer.email,
          to_name: `${invoice.customer.first_name} ${invoice.customer.last_name}`,
          from_company: (company as any).name,
          invoice_number: invoice.invoice_number,
          invoice_total: invoice.total,
          due_date: invoice.due_date,
          payment_instructions: invoice.payment_instructions,
          is_receipt: true,
          line_items: lineItems.map((item: any) => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
          })),
          company_id: companyId,
        },
      });
      if (error) throw error;
      toast.success(`Receipt emailed to ${invoice.customer.email}`);
    } catch (err) {
      console.error('[InvoiceDetailView] Receipt email error:', err);
      toast.error('Failed to send receipt email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!invoice) return;
    setMarking(true);
    setShowMenu(false);
    try {
      const paidAt = new Date().toISOString();
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'paid', deposit_paid: invoice.total, paid_at: paidAt })
        .eq('id', invoice.id);
      if (error) throw error;

      const updated = { ...invoice, status: 'paid' as const, deposit_paid: invoice.total, paid_at: paidAt };
      setInvoice(updated);

      // Auto-download receipt
      const lineItems = await fetchLineItems(invoice.id);
      await generateInvoicePdf(updated, company, lineItems, 'receipt');
      toast.success('Invoice marked as paid — receipt downloaded');
    } catch (error) {
      console.error('[InvoiceDetailView] Error marking as paid:', error);
      toast.error('Failed to mark invoice as paid');
    } finally {
      setMarking(false);
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;
    setShowMenu(false);
    if (!window.confirm(`Delete invoice ${invoice.invoice_number}? This cannot be undone.`)) return;
    try {
      await supabase.from('invoices').delete().eq('id', invoice.id);
      toast.success('Invoice deleted');
      onBack();
    } catch {
      toast.error('Failed to delete invoice');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
        <div className="max-w-4xl mx-auto flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-[#1e3a5f] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-[#1e3a5f] hover:bg-gray-100 rounded-lg transition-colors mb-8">
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-600">Invoice not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Invoice #{invoice.invoice_number}</h1>
              <div className="flex items-center gap-3 mt-2">
                {getStatusBadge(invoice.status)}
                {invoice.selected_tier && (
                  <span className="text-sm text-gray-600">
                    · {invoice.selected_tier === 'all' ? 'All Tiers' : invoice.selected_tier.charAt(0).toUpperCase() + invoice.selected_tier.slice(1) + ' Tier'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Three-dots menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(v => !v)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="More options"
            >
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-200 z-20 py-1">
                <button
                  onClick={handlePreviewPdf}
                  disabled={generatingPdf}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                >
                  <Eye className="w-4 h-4" />
                  View Invoice
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={generatingPdf}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
                {invoice.status === 'paid' && (
                  <>
                    <button
                      onClick={handleDownloadReceipt}
                      disabled={generatingPdf}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                    >
                      <Receipt className="w-4 h-4" />
                      Download Receipt
                    </button>
                    <button
                      onClick={handleSendReceiptEmail}
                      disabled={sendingEmail}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                    >
                      <Mail className="w-4 h-4 text-green-600" />
                      Email Receipt
                    </button>
                  </>
                )}
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" />
                  Email Invoice
                </button>
                {invoice.status !== 'paid' && (
                  <button
                    onClick={handleMarkAsPaid}
                    disabled={marking}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Mark as Paid
                  </button>
                )}
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={handleDelete}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Invoice
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Summary Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <div className="grid grid-cols-3 gap-8 mb-8">
                <div>
                  <p className="text-sm text-gray-600 uppercase font-semibold mb-1">Project Total</p>
                  <p className="text-3xl font-bold text-[#1e3a5f]">{formatCurrency(effectiveTotal)}</p>
                  {approvedChangeOrderTotal > 0 && (
                    <p className="text-xs text-gray-500 mt-1">incl. {formatCurrency(approvedChangeOrderTotal)} change orders</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-600 uppercase font-semibold mb-1">Amount Paid</p>
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(effectivePaid)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 uppercase font-semibold mb-1">Balance Due</p>
                  <p className={`text-3xl font-bold ${getBalanceDue() > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {getBalanceDue() === 0 ? 'PAID' : formatCurrency(getBalanceDue())}
                  </p>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Original Scope</span>
                  <span className="font-medium text-gray-900">{formatCurrency(invoice.subtotal)}</span>
                </div>
                {approvedChangeOrderTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Approved Change Orders</span>
                    <span className="font-medium text-green-700">+{formatCurrency(approvedChangeOrderTotal)}</span>
                  </div>
                )}
                {invoice.tax_rate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax ({invoice.tax_rate}%)</span>
                    <span className="font-medium text-gray-900">{formatCurrency(invoice.tax_amount)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Approved Change Orders */}
            {additionalItems.filter(i => !i.display_only).length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                <h3 className="font-semibold text-green-900 mb-3">Approved Change Orders</h3>
                <div className="space-y-2">
                  {additionalItems.filter(i => !i.display_only).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-green-800">{item.description}</span>
                      <span className="font-medium text-green-900">{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-green-200 mt-3 pt-3 flex justify-between text-sm font-semibold text-green-900">
                  <span>Revised Project Total</span>
                  <span>{formatCurrency(effectiveTotal)}</span>
                </div>
              </div>
            )}

            {/* Overpayment alert */}
            {overpayment > 0.01 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                <div className="mb-3">
                  <p className="font-semibold text-amber-900">Apparent Overpayment: {formatCurrency(overpayment)}</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Payments received exceed the recorded project total. If this extra amount was for approved additional work, apply it to a change order to clear the balance.
                  </p>
                </div>
                {!showAddChangeOrder ? (
                  <button
                    onClick={() => { setShowAddChangeOrder(true); setChangeOrderAmount(overpayment.toFixed(2)); }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Apply Overpayment to Change Order
                  </button>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder='Description (e.g. "6" Gutter Upgrade")'
                      value={changeOrderDesc}
                      onChange={e => setChangeOrderDesc(e.target.value)}
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Amount"
                        value={changeOrderAmount}
                        onChange={e => setChangeOrderAmount(e.target.value)}
                        className="flex-1 px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <button
                        onClick={handleSaveChangeOrder}
                        disabled={savingChangeOrder || !changeOrderDesc.trim() || !changeOrderAmount}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {savingChangeOrder ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => setShowAddChangeOrder(false)}
                        className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Details */}
            <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Invoice Details</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Issued Date</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(invoice.issued_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Due Date</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(invoice.due_date)}</p>
                  </div>
                  {invoice.paid_at && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Paid On</p>
                      <p className="text-sm font-medium text-green-700">{formatDate(invoice.paid_at)}</p>
                    </div>
                  )}
                </div>
              </div>

              {invoice.customer && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Bill To</h3>
                  <p className="text-sm font-medium text-gray-900">{invoice.customer.first_name} {invoice.customer.last_name}</p>
                  <p className="text-sm text-gray-600">{invoice.customer.email}</p>
                  {invoice.customer.address && (
                    <p className="text-sm text-gray-600">{invoice.customer.address}</p>
                  )}
                </div>
              )}

              {invoice.notes && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
                  <p className="text-sm text-gray-700">{invoice.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column — Actions */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
              <button
                onClick={handlePreviewPdf}
                disabled={generatingPdf}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1e3a5f] hover:bg-[#162d4a] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {generatingPdf ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                {generatingPdf ? 'Loading...' : 'View Invoice'}
              </button>

              <button
                onClick={handleDownloadPdf}
                disabled={generatingPdf}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors disabled:opacity-50"
              >
                {generatingPdf ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {generatingPdf ? 'Generating...' : 'Download PDF'}
              </button>

              {invoice.status === 'paid' && (
                <>
                  <button
                    onClick={handleDownloadReceipt}
                    disabled={generatingPdf}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors disabled:opacity-50"
                  >
                    {generatingPdf ? (
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Receipt className="w-4 h-4" />
                    )}
                    {generatingPdf ? 'Generating...' : 'Download Receipt'}
                  </button>
                  <button
                    onClick={handleSendReceiptEmail}
                    disabled={sendingEmail}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 border border-green-200 rounded-lg text-sm font-medium text-green-700 transition-colors disabled:opacity-50"
                  >
                    {sendingEmail ? (
                      <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4" />
                    )}
                    {sendingEmail ? 'Sending...' : 'Email Receipt'}
                  </button>
                </>
              )}

              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors disabled:opacity-50"
              >
                {sendingEmail ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                {sendingEmail ? 'Sending...' : 'Email Invoice'}
              </button>

              {invoice.status !== 'paid' ? (
                <button
                  onClick={handleMarkAsPaid}
                  disabled={marking}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {marking ? 'Processing...' : 'Mark as Paid'}
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  Paid in Full
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <p className="text-sm text-blue-900">
                <span className="font-semibold">Tip:</span> Email the invoice to your customer, or download the PDF to send it yourself.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetailView;

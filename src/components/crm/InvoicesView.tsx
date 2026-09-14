// Copied from QuoteMGR src/components/InvoicesView.tsx (read-only reference).
// TrussCTR changes: company type comes from invoicePdfGenerator; search tolerates
// customers without an email.
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { generateInvoicePdf } from '@/lib/invoicePdfGenerator';
import {
  Search, Download, Mail, CheckCircle2, MoreVertical,
  Eye, Trash2, Calendar, DollarSign, TrendingUp
} from 'lucide-react';
import type { InvoiceCompany as Company, PaymentRecord } from '@/lib/invoicePdfGenerator';

interface Invoice {
  id: string;
  company_id: string;
  quote_id: string | null;
  customer_id: string | null;
  invoice_number: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issued_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  deposit_required: number | null;
  deposit_paid: number | null;
  paid_at: string | null;
  project_description: string | null;
  payment_records: PaymentRecord[] | null;
  notes: string | null;
  payment_instructions: string | null;
  share_token: string | null;
  selected_tier: 'good' | 'better' | 'best' | 'all' | null;
  created_at: string;
  updated_at: string;
  customer?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface InvoicesViewProps {
  companyId: string;
  userId: string;
  company: Company;
  onViewInvoice: (invoiceId: string) => void;
}

const InvoicesView: React.FC<InvoicesViewProps> = ({
  companyId,
  userId,
  company,
  onViewInvoice,
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Invoice['status']>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount' | 'status'>('newest');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!activeMenuId) return;
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-invoice-menu]')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [activeMenuId]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(id, first_name, last_name, email)
        `)
        .eq('company_id', companyId);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (dateFromFilter) {
        query = query.gte('issued_date', dateFromFilter);
      }
      if (dateToFilter) {
        query = query.lte('issued_date', dateToFilter);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      let filtered = ((data || []) as any[]).map(inv => ({
        ...inv,
        total: Number(inv.total ?? 0),
        subtotal: Number(inv.subtotal ?? 0),
        tax_amount: Number(inv.tax_amount ?? 0),
        deposit_paid: inv.deposit_paid != null ? Number(inv.deposit_paid) : null,
        deposit_required: inv.deposit_required != null ? Number(inv.deposit_required) : null,
      })) as Invoice[];

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(inv =>
          inv.invoice_number.toLowerCase().includes(term) ||
          `${inv.customer?.first_name} ${inv.customer?.last_name}`.toLowerCase().includes(term) ||
          (inv.customer?.email || '').toLowerCase().includes(term)
        );
      }

      switch (sortBy) {
        case 'newest':
          filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          break;
        case 'oldest':
          filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          break;
        case 'amount':
          filtered.sort((a, b) => b.total - a.total);
          break;
        case 'status': {
          const statusOrder = { draft: 0, sent: 1, paid: 2, overdue: 3, cancelled: 4 };
          filtered.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
          break;
        }
      }

      setInvoices(filtered);
    } catch (error) {
      console.error('[InvoicesView] Error loading invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [companyId, statusFilter, dateFromFilter, dateToFilter, searchTerm, sortBy]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const getStatusBadge = (status: Invoice['status']) => {
    const styles: Record<Invoice['status'], { bg: string; text: string; dot: string; label: string }> = {
      draft:     { bg: 'bg-gray-100',  text: 'text-gray-700',  dot: 'bg-gray-500',   label: 'Draft' },
      sent:      { bg: 'bg-blue-100',  text: 'text-blue-700',  dot: 'bg-blue-600',   label: 'Sent' },
      paid:      { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-600',  label: 'Paid' },
      overdue:   { bg: 'bg-red-100',   text: 'text-red-700',   dot: 'bg-red-600',    label: 'Overdue' },
      cancelled: { bg: 'bg-gray-300',  text: 'text-gray-700',  dot: 'bg-gray-500',   label: 'Cancelled' },
    };
    const s = styles[status];
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
        {s.label}
      </span>
    );
  };

  const getBalanceDue = (invoice: Invoice) =>
    Math.max(0, invoice.total - (invoice.deposit_paid || 0));

  const handleDownloadPdf = async (invoice: Invoice) => {
    if (generatingPdf) return;
    setGeneratingPdf(invoice.id);
    setActiveMenuId(null);
    try {
      const { data: lineItemsData } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('sort_order');
      await generateInvoicePdf(invoice, company, lineItemsData || [], 'invoice');
      toast.success('PDF downloaded');
    } catch (err) {
      console.error('[InvoicesView] PDF error:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleSendEmail = async (invoice: Invoice) => {
    if (!invoice.customer?.email) {
      toast.error('No customer email address found');
      return;
    }
    setSendingEmail(invoice.id);
    setActiveMenuId(null);
    try {
      const { data: lineItemsData } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('sort_order');

      const { error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          to_email: invoice.customer.email,
          to_name: `${invoice.customer.first_name} ${invoice.customer.last_name}`,
          from_company: (company as any).name,
          invoice_number: invoice.invoice_number,
          invoice_total: invoice.total,
          due_date: invoice.due_date,
          payment_instructions: invoice.payment_instructions,
          line_items: (lineItemsData || []).map((item: any) => ({
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
        setInvoices(prev => prev.map(inv =>
          inv.id === invoice.id ? { ...inv, status: 'sent' } : inv
        ));
      }

      toast.success(`Invoice emailed to ${invoice.customer.email}`);
    } catch (err) {
      console.error('[InvoicesView] Email error:', err);
      toast.error('Failed to send email');
    } finally {
      setSendingEmail(null);
    }
  };

  const handleMarkAsPaid = async (invoice: Invoice) => {
    setActiveMenuId(null);
    try {
      const paidAt = new Date().toISOString();
      await supabase.from('invoices').update({
        status: 'paid',
        deposit_paid: invoice.total,
        paid_at: paidAt,
      }).eq('id', invoice.id);
      const updated = { ...invoice, status: 'paid' as const, deposit_paid: invoice.total, paid_at: paidAt };
      setInvoices(prev => prev.map(inv => inv.id === invoice.id ? updated : inv));

      // Auto-download receipt
      const { data: lineItemsData } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('sort_order');
      await generateInvoicePdf(updated, company, lineItemsData || [], 'receipt');
      toast.success('Invoice marked as paid — receipt downloaded');
    } catch {
      toast.error('Failed to update invoice');
    }
  };

  const handleDelete = async (invoice: Invoice) => {
    setActiveMenuId(null);
    if (!window.confirm(`Delete invoice ${invoice.invoice_number}? This cannot be undone.`)) return;
    try {
      await supabase.from('invoices').delete().eq('id', invoice.id);
      setInvoices(prev => prev.filter(inv => inv.id !== invoice.id));
      toast.success('Invoice deleted');
    } catch {
      toast.error('Failed to delete invoice');
    }
  };

  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.deposit_paid || 0), 0);
  const totalOutstanding = invoices.reduce((sum, inv) => sum + getBalanceDue(inv), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Invoices</h1>
          <p className="text-gray-600">Create and manage invoices from your quotes</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Invoiced</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalInvoiced)}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Amount Paid</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Outstanding Balance</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalOutstanding)}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Invoice #, customer name, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="amount">Amount (High to Low)</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  value={dateFromFilter}
                  onChange={(e) => setDateFromFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  value={dateToFilter}
                  onChange={(e) => setDateToFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Invoices List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-[#1e3a5f] rounded-full animate-spin" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <Mail className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-lg font-semibold text-gray-700 mb-2">No invoices yet</p>
              <p className="text-sm text-gray-500 text-center">
                {searchTerm || statusFilter !== 'all' || dateFromFilter || dateToFilter
                  ? 'No invoices match your filters. Try adjusting your search criteria.'
                  : 'Create your first invoice from a quote to get started.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Invoice</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Customer</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Amount</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Paid</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Balance</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => onViewInvoice(invoice.id)}
                    >
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <p
                          className="font-semibold text-[#1e3a5f] cursor-pointer hover:underline"
                          onClick={() => onViewInvoice(invoice.id)}
                        >
                          {invoice.invoice_number}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">
                            {invoice.customer
                              ? `${invoice.customer.first_name} ${invoice.customer.last_name}`
                              : 'Unknown'}
                          </p>
                          <p className="text-sm text-gray-500">{invoice.customer?.email || ''}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{formatCurrency(invoice.total)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-700">{formatCurrency(invoice.deposit_paid || 0)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{formatCurrency(getBalanceDue(invoice))}</p>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(invoice.status)}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">{formatDate(invoice.issued_date)}</p>
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onViewInvoice(invoice.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(invoice)}
                            disabled={!!generatingPdf}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                            title="Download PDF"
                          >
                            {generatingPdf === invoice.id ? (
                              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Download className="w-4 h-4 text-gray-600" />
                            )}
                          </button>
                          <button
                            onClick={() => handleSendEmail(invoice)}
                            disabled={!!sendingEmail}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                            title="Email invoice"
                          >
                            {sendingEmail === invoice.id ? (
                              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Mail className="w-4 h-4 text-gray-600" />
                            )}
                          </button>
                          <div className="relative" data-invoice-menu>
                            <button
                              onClick={() => setActiveMenuId(activeMenuId === invoice.id ? null : invoice.id)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                              title="More options"
                            >
                              <MoreVertical className="w-4 h-4 text-gray-600" />
                            </button>
                            {activeMenuId === invoice.id && (
                              <div
                                data-invoice-menu
                                className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 z-20 py-1"
                              >
                                <button
                                  onClick={() => { onViewInvoice(invoice.id); setActiveMenuId(null); }}
                                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Eye className="w-4 h-4" />
                                  View Details
                                </button>
                                <button
                                  onClick={() => handleDownloadPdf(invoice)}
                                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Download className="w-4 h-4" />
                                  Download PDF
                                </button>
                                <button
                                  onClick={() => handleSendEmail(invoice)}
                                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Mail className="w-4 h-4" />
                                  Email Invoice
                                </button>
                                {invoice.status !== 'paid' && (
                                  <button
                                    onClick={() => handleMarkAsPaid(invoice)}
                                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    Mark as Paid
                                  </button>
                                )}
                                <div className="border-t border-gray-100 my-1" />
                                <button
                                  onClick={() => handleDelete(invoice)}
                                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoicesView;

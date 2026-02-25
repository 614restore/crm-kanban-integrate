import React, { useState } from 'react';
import { useCRM, useFinancialStats } from '@/lib/crmStore';
import { db } from '@/lib/database';
import { exportToExcel } from '@/lib/exportUtils';
import { toast } from 'sonner';
import {
  formatCurrency,
  formatDate,
  getContactFullName,
  Invoice,
} from '@/lib/crmData';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  Download,
  Filter,
  Search,
  ExternalLink,
  MoreVertical,
  Send,
  Eye,
  Printer,
} from 'lucide-react';

type InvoiceFilter = 'all' | 'draft' | 'sent' | 'paid' | 'overdue';

export default function FinancialDashboard() {
  const { state, dispatch } = useCRM();
  const financialStats = useFinancialStats();
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleExport = () => {
    if (allInvoices.length === 0) {
      toast.error('No invoices available to export');
      return;
    }

    exportToExcel(allInvoices);
    toast.success('Invoice export started');
  };

  const handleConnectQuickBooks = () => {
    dispatch({ type: 'SET_VIEW', payload: 'settings' });
    window.dispatchEvent(
      new CustomEvent('crm-open-settings-tab', {
        detail: { tab: 'integrations' },
      })
    );
  };

  const handleViewInvoiceContact = (contactId: string) => {
    dispatch({ type: 'SELECT_CONTACT', payload: contactId });
  };

  const handleSendInvoice = async (invoiceId: string) => {
    const existingInvoice = state.invoices.find((inv) => inv.id === invoiceId);
    if (!existingInvoice) {
      toast.error('Invoice not found');
      return;
    }

    const updated = await db.updateInvoice(invoiceId, { status: 'sent' });
    if (!updated) {
      toast.error('Failed to mark invoice as sent');
      return;
    }

    dispatch({
      type: 'UPDATE_INVOICE',
      payload: {
        ...existingInvoice,
        status: 'sent',
      },
    });

    toast.success('Invoice marked as sent');
  };

  const allInvoices = [...state.invoices];

  // Filter invoices
  const filteredInvoices = allInvoices.filter((inv) => {
    const matchesFilter = invoiceFilter === 'all' || inv.status === invoiceFilter;
    const matchesSearch =
      searchQuery === '' ||
      inv.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-500';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return <CheckCircle size={14} />;
      case 'sent':
        return <Send size={14} />;
      case 'draft':
        return <FileText size={14} />;
      case 'overdue':
        return <AlertCircle size={14} />;
      default:
        return <Clock size={14} />;
    }
  };

  // Calculate totals by status
  const invoiceTotals = {
    draft: allInvoices.filter((i) => i.status === 'draft').reduce((sum, i) => sum + i.amount, 0),
    sent: allInvoices.filter((i) => i.status === 'sent').reduce((sum, i) => sum + i.amount, 0),
    paid: allInvoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0),
    overdue: allInvoices.filter((i) => i.status === 'overdue').reduce((sum, i) => sum + i.amount, 0),
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Financial Dashboard</h2>
          <p className="text-gray-500 mt-1">Track revenue, invoices, and payments</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={18} />
            <span className="font-medium">Export</span>
          </button>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_INVOICE_MODAL' })}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            <span className="font-medium">Create Invoice</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <DollarSign className="text-green-600" size={24} />
            </div>
            <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
              <TrendingUp size={16} />
              12%
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-4">
            {formatCurrency(financialStats.totalRevenue)}
          </p>
          <p className="text-gray-500 text-sm mt-1">Total Revenue</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <CreditCard className="text-blue-600" size={24} />
            </div>
            <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
              <TrendingUp size={16} />
              8%
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-4">
            {formatCurrency(financialStats.depositsCollected)}
          </p>
          <p className="text-gray-500 text-sm mt-1">Deposits Collected</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Clock className="text-amber-600" size={24} />
            </div>
            <span className="flex items-center gap-1 text-amber-600 text-sm font-medium">
              <TrendingDown size={16} />
              3%
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-4">
            {formatCurrency(financialStats.pendingPayments)}
          </p>
          <p className="text-gray-500 text-sm mt-1">Pending Payments</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertCircle className="text-red-600" size={24} />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-4">
            {formatCurrency(invoiceTotals.overdue)}
          </p>
          <p className="text-gray-500 text-sm mt-1">Overdue Invoices</p>
        </div>
      </div>

      {/* Invoice Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Draft', value: invoiceTotals.draft, color: 'bg-gray-500' },
          { label: 'Sent', value: invoiceTotals.sent, color: 'bg-blue-500' },
          { label: 'Paid', value: invoiceTotals.paid, color: 'bg-green-500' },
          { label: 'Overdue', value: invoiceTotals.overdue, color: 'bg-red-500' },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() =>
              setInvoiceFilter(item.label.toLowerCase() as InvoiceFilter)
            }
            className={`p-4 rounded-xl border transition-all ${
              invoiceFilter === item.label.toLowerCase()
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${item.color}`} />
              <span className="font-medium text-gray-700">{item.label}</span>
            </div>
            <p className="text-xl font-bold text-gray-900 mt-2">{formatCurrency(item.value)}</p>
          </button>
        ))}
      </div>

      {/* QuickBooks Integration Banner */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold">QuickBooks Integration</h3>
              <p className="text-green-100 text-sm mt-1">
                Connect your QuickBooks account to sync invoices and payments automatically
              </p>
            </div>
          </div>
          <button
            onClick={handleConnectQuickBooks}
            className="px-6 py-3 bg-white text-green-600 rounded-lg font-semibold hover:bg-green-50 transition-colors"
          >
            Connect QuickBooks
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Invoices</h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none w-64"
                />
              </div>
              <select
                value={invoiceFilter}
                onChange={(e) => setInvoiceFilter(e.target.value as InvoiceFilter)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Invoice
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Customer
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Amount
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Due Date
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900">{invoice.id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-700">{invoice.contactName}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(invoice.amount)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        invoice.status
                      )}`}
                    >
                      {getStatusIcon(invoice.status)}
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600">{formatDate(invoice.dueDate)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleViewInvoiceContact(invoice.contactId)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="View"
                      >
                        <Eye size={16} className="text-gray-500" />
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Print"
                      >
                        <Printer size={16} className="text-gray-500" />
                      </button>
                      {invoice.status === 'draft' && (
                        <button
                          onClick={() => handleSendInvoice(invoice.id)}
                          className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Send"
                        >
                          <Send size={16} className="text-blue-500" />
                        </button>
                      )}
                      <button
                        onClick={() => toast.info('More actions coming soon')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="More"
                      >
                        <MoreVertical size={16} className="text-gray-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredInvoices.length === 0 && (
          <div className="p-12 text-center">
            <FileText size={32} className="mx-auto mb-2 text-gray-400" />
            <p className="text-gray-500">No invoices found</p>
          </div>
        )}
      </div>

      {/* Recent Payments */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Payments</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {allInvoices
            .filter((inv) => inv.status === 'paid' && inv.paidAt)
            .sort((a, b) => new Date(b.paidAt!).getTime() - new Date(a.paidAt!).getTime())
            .slice(0, 5)
            .map((invoice) => (
              <div key={invoice.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="text-green-600" size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{invoice.contactName}</p>
                    <p className="text-sm text-gray-500">
                      Paid on {formatDate(invoice.paidAt!)}
                    </p>
                  </div>
                </div>
                <span className="font-semibold text-green-600">
                  +{formatCurrency(invoice.amount)}
                </span>
              </div>
            ))}
          {allInvoices.filter((inv) => inv.status === 'paid').length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <DollarSign size={32} className="mx-auto mb-2 opacity-50" />
              <p>No recent payments</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

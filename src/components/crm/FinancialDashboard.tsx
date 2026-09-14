import React, { useState, useEffect } from 'react';
import { useCRM, useFinancialStats } from '@/lib/crmStore';
import { db, DbCompany } from '@/lib/database';
import { sendEmail } from '@/lib/emailApi';
import { fireAutomationEvent } from '@/lib/automationEngine';
import { exportToExcel, printDataAsPDF } from '@/lib/exportUtils';
import { useAuth } from '@/lib/authContext';
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
  Users,
  XCircle,
} from 'lucide-react';

type InvoiceFilter = 'all' | 'draft' | 'sent' | 'paid' | 'overdue';
type FinancialView = 'all' | 'sales' | 'projects';

export default function FinancialDashboard() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const financialStats = useFinancialStats();
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>('all');
  const [financialView, setFinancialView] = useState<FinancialView>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [companyProfile, setCompanyProfile] = useState<DbCompany | null>(null);
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null);

  // Load company profile for sender email
  useEffect(() => {
    const loadCompany = async () => {
      if (!profile?.company_id) return;
      try {
        const company = await db.getCompany(profile.company_id);
        if (company) setCompanyProfile(company);
      } catch { /* ignore */ }
    };
    loadCompany();
  }, [profile?.company_id]);

  const handleExport = () => {
    if (allInvoices.length === 0) {
      toast.error('No invoices available to export');
      return;
    }

    exportToExcel(allInvoices);
    toast.success('Invoice export started');
  };

  const handleExportPDF = () => {
    printDataAsPDF('Financial Dashboard Report', [
      {
        heading: 'Invoice Summary',
        rows: filteredInvoices.map(inv => ({
          Customer: inv.contactName,
          Amount: formatCurrency(inv.amount),
          Status: inv.status,
          Due_Date: inv.dueDate ? formatDate(inv.dueDate) : '—',
          Paid_Date: inv.paidAt ? formatDate(inv.paidAt) : '—',
        }))
      },
      {
        heading: 'Financial KPIs',
        rows: [
          { Metric: 'Total Collected', Value: formatCurrency(financialStats.totalCollected) },
          { Metric: 'Total Outstanding', Value: formatCurrency(financialStats.totalOutstanding) },
          { Metric: 'Total Revenue', Value: formatCurrency(financialStats.totalRevenue) },
          { Metric: 'Quotes Sent (count)', Value: String(financialStats.quotesSentCount) },
          { Metric: 'Quotes Sent (value)', Value: formatCurrency(financialStats.quotesSentTotal) },
          { Metric: 'Quotes Signed (count)', Value: String(financialStats.signedQuotesCount) },
          { Metric: 'Quotes Signed (value)', Value: formatCurrency(financialStats.signedQuotesTotal) },
          { Metric: 'Total Lost (value)', Value: formatCurrency(financialStats.lostSalesValue) },
          { Metric: 'Outstanding Invoices', Value: formatCurrency(financialStats.outstandingInvoices) },
          { Metric: 'Overdue Invoices', Value: formatCurrency(financialStats.overdueInvoices) },
          { Metric: 'Paid Invoices', Value: formatCurrency(financialStats.paidInvoices) },
          { Metric: 'Deposits Collected', Value: formatCurrency(financialStats.depositsCollected) },
          { Metric: 'Pending Payments', Value: formatCurrency(financialStats.pendingPayments) },
        ]
      }
    ]);
    toast.success('PDF print dialog opened');
  };

  const handleConnectQuickBooks = () => {
    dispatch({ type: 'SET_VIEW', payload: 'settings' });
    // Delay so SettingsView mounts and attaches its event listener before we fire
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('crm-open-settings-tab', {
          detail: { tab: 'integrations' },
        })
      );
    }, 150);
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

    const contact = state.contacts.find((c) => c.id === existingInvoice.contactId);
    if (!contact?.email) {
      toast.error('Customer email is missing');
      return;
    }

    try {
      const fromName = companyProfile?.from_name || companyProfile?.name || 'TrussCTR';
      await sendEmail({
        to: contact.email,
        subject: `Invoice ${existingInvoice.id} from ${companyProfile?.name || 'our company'}`,
        html: `
          <p>Hello ${contact.firstName},</p>
          <p>Your invoice is ready.</p>
          <p><strong>Invoice:</strong> ${existingInvoice.id}</p>
          <p><strong>Amount:</strong> ${formatCurrency(existingInvoice.amount)}</p>
          <p><strong>Due Date:</strong> ${formatDate(existingInvoice.dueDate)}</p>
          <p>Please reply to this email if you have any questions.</p>
          <p>Best regards,<br/>${fromName}</p>
        `,
      });

      const updated = await db.updateInvoice(invoiceId, { status: 'sent' });
      if (!updated) {
        toast.error('Invoice email sent, but failed to update status');
        return;
      }

      dispatch({
        type: 'UPDATE_INVOICE',
        payload: {
          ...existingInvoice,
          status: 'sent',
        },
      });

      toast.success(`Invoice emailed to ${contact.email}`);
    } catch (error: unknown) {
      console.error('Failed to send invoice email:', error);
      const message = error instanceof Error ? error.message : 'Failed to send invoice email';
      toast.error(message);
    }
  };

  const handleChangeInvoiceStatus = async (invoiceId: string, newStatus: Invoice['status']) => {
    setStatusMenuId(null);
    const invoice = state.invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;

    const updated = await db.updateInvoice(invoiceId, {
      status: newStatus,
      ...(newStatus === 'paid' ? { paid_at: new Date().toISOString() } : {}),
    });
    if (!updated) { toast.error('Failed to update invoice status'); return; }

    dispatch({
      type: 'UPDATE_INVOICE',
      payload: {
        ...invoice,
        status: newStatus,
        paidAt: newStatus === 'paid' ? new Date().toISOString() : invoice.paidAt,
      },
    });

    // Auto-advance contact through the pipeline when invoice milestones are hit
    if (invoice.contactId && profile?.company_id) {
      const contact = state.contacts.find((c) => c.id === invoice.contactId);
      if (contact) {
        let advanceTo: string | null = null;
        if (newStatus === 'sent' && contact.status === 'invoicing') {
          advanceTo = 'pending_payment';
        } else if (newStatus === 'paid' && (contact.status === 'pending_payment' || contact.status === 'invoicing')) {
          advanceTo = 'completed';
        }
        if (advanceTo) {
          // Use centralized status manager for consistent automation
          const { updateContactStatus } = await import('../../lib/statusManager');
          
          updateContactStatus({
            contactId: contact.id,
            newStatus: advanceTo,
            oldStatus: contact.status,
            contactName: invoice.contactName,
            contactEmail: contact.email,
            userId: user?.id || 'system',
            userEmail: user?.email || 'system@trussctr.com',
            companyId: profile.company_id,
            source: 'payment_processing',
            reason: `Invoice ${newStatus}: ${invoice.invoiceNumber}`,
          }).then(result => {
            if (result.success) {
              dispatch({
                type: 'UPDATE_CONTACT_STATUS',
                payload: { contactId: contact.id, status: advanceTo as any },
              });
            }
          }).catch(console.error);
        }
        // Fire event-specific automation rules
        const eventType = newStatus === 'paid' ? 'invoice_paid' : newStatus === 'sent' ? 'invoice_sent' : null;
        if (eventType) {
          fireAutomationEvent(eventType, profile.company_id, {
            contactId: contact.id,
            contactName: invoice.contactName,
            contactEmail: contact.email,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.amount,
          }).catch(() => {});
        }
      }
    }

    toast.success(`Invoice marked as ${newStatus}`);
  };

  const allInvoices = [...state.invoices];

  // Filter invoices by financial view + status + search
  const filteredInvoices = allInvoices.filter((inv) => {
    // Financial view filter
    if (financialView === 'sales' && inv.jobId && inv.jobId !== '') return false;
    if (financialView === 'projects' && (!inv.jobId || inv.jobId === '')) return false;

    const matchesFilter = invoiceFilter === 'all' || inv.status === invoiceFilter;
    const matchesSearch =
      searchQuery === '' ||
      (inv.contactName ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.id ?? '').toLowerCase().includes(searchQuery.toLowerCase());
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
          {/* View Filter */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            {[
              { id: 'all' as FinancialView, label: 'All' },
              { id: 'sales' as FinancialView, label: 'Sales' },
              { id: 'projects' as FinancialView, label: 'Projects' },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setFinancialView(v.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  financialView === v.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={18} />
            <span className="font-medium">Export CSV</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Printer size={18} />
            <span className="font-medium">Export PDF</span>
          </button>
          <button
            onClick={() => { toast.info('Invoices are created from signed quotes. Open a signed quote and choose Create invoice.'); dispatch({ type: 'SET_VIEW', payload: 'quotes' }); }}
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
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Collected</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-4">
            {formatCurrency(financialStats.totalCollected)}
          </p>
          <p className="text-gray-500 text-sm mt-1">Total Collected</p>
          <p className="text-xs text-gray-400 mt-0.5">Deposits + payments received</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Clock className="text-amber-600" size={24} />
            </div>
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Outstanding</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-4">
            {formatCurrency(financialStats.totalOutstanding)}
          </p>
          <p className="text-gray-500 text-sm mt-1">Total Outstanding</p>
          <p className="text-xs text-gray-400 mt-0.5">Pending + overdue invoices</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Send className="text-blue-600" size={24} />
            </div>
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{financialStats.quotesSentCount} sent</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-4">
            {formatCurrency(financialStats.quotesSentTotal)}
          </p>
          <p className="text-gray-500 text-sm mt-1">Quotes Sent</p>
          <p className="text-xs text-gray-400 mt-0.5">{financialStats.signedQuotesCount} signed · {financialStats.pendingQuotesCount} pending</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <XCircle className="text-red-600" size={24} />
            </div>
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">{financialStats.lostDealsCount} lost</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-4">
            {formatCurrency(financialStats.lostSalesValue)}
          </p>
          <p className="text-gray-500 text-sm mt-1">Total Lost</p>
          <p className="text-xs text-gray-400 mt-0.5">Value of lost deals</p>
        </div>
      </div>

      {/* Sales Performance Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users size={16} className="text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Active Leads</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{financialStats.leadsGenerated}</p>
          <p className="text-xs text-gray-400 mt-0.5">in pipeline</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle size={16} className="text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Deals Closed</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{financialStats.dealsClosedCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(financialStats.dealsClosed)} value</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle size={16} className="text-red-500" />
            </div>
            <span className="text-sm font-medium text-gray-600">Lost Sales</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{financialStats.lostDealsCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(financialStats.lostSalesValue)} lost</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp size={16} className="text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Close Rate</span>
          </div>
          {(() => {
            const total = financialStats.dealsClosedCount + financialStats.lostDealsCount;
            const rate = total > 0 ? ((financialStats.dealsClosedCount / total) * 100).toFixed(1) : '—';
            return (
              <>
                <p className="text-2xl font-bold text-gray-900">{rate}{rate !== '—' ? '%' : ''}</p>
                <p className="text-xs text-gray-400 mt-0.5">{total} total decisions</p>
              </>
            );
          })()}
        </div>
      </div>

      {/* Quotes Summary */}
      {financialStats.quotesSentCount > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Send className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Total Quotes Sent</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(financialStats.quotesSentTotal)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{financialStats.quotesSentCount} quote(s) sent</p>
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle className="text-emerald-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-emerald-700 font-medium">Total Signed</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(financialStats.signedQuotesTotal)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{financialStats.signedQuotesCount} quote(s) signed</p>
            </div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Clock className="text-yellow-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-yellow-700 font-medium">Awaiting Response</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(financialStats.pendingQuotesTotal)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{financialStats.pendingQuotesCount} quote(s) pending</p>
            </div>
          </div>
        </div>
      )}

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

      {/* Project Cost Breakdown — visible in Projects view */}
      {financialView === 'projects' && (() => {
        const activeStatuses = ['in_progress', 'build_phase', 'cleanup', 'completed'];
        const activeContactIds = new Set(
          state.contacts
            .filter((c) => activeStatuses.includes(c.status))
            .map((c) => c.id)
        );
        const materialCost = state.materialOrders
          .filter((o) => o.status !== 'cancelled' && (o.contactId ? activeContactIds.has(o.contactId) : true))
          .reduce((sum, o) => sum + o.total, 0);
        const subCost = state.projects
          .reduce((sum, p) => sum + (p.actualSubcontractorCost || 0), 0) +
          state.workOrders
            .filter((wo) => wo.status === 'completed' || wo.status === 'in_progress' || wo.status === 'ready_to_invoice')
            .reduce((sum, wo) => sum + (wo.subcontractorCost || 0), 0);
        const laborCost = state.workOrders
          .filter((wo) => (wo.status === 'completed' || wo.status === 'in_progress' || wo.status === 'ready_to_invoice') && !wo.isSubcontractor)
          .reduce((sum, wo) => sum + (wo.laborCost || 0), 0);
        const totalCosts = materialCost + subCost + laborCost;
        const margin = financialStats.totalRevenue > 0
          ? ((financialStats.totalRevenue - totalCosts) / financialStats.totalRevenue) * 100
          : 0;
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Cost Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-4 bg-blue-50 rounded-xl">
                <p className="text-sm text-blue-600 font-medium">Materials</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(materialCost)}</p>
                <p className="text-xs text-gray-500 mt-1">Lumber, shingles, underlayment, etc.</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-xl">
                <p className="text-sm text-orange-600 font-medium">Sub-Contractor Costs</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(subCost)}</p>
                <p className="text-xs text-gray-500 mt-1">All subcontractor labor costs</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl">
                <p className="text-sm text-purple-600 font-medium">In-House Labor</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(laborCost)}</p>
                <p className="text-xs text-gray-500 mt-1">Crew wages, overtime, benefits</p>
              </div>
              <div className="p-4 bg-green-50 rounded-xl">
                <p className="text-sm text-green-600 font-medium">Profit Margin</p>
                <p className={`text-2xl font-bold mt-1 ${margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {margin.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Revenue minus all project costs</p>
              </div>
            </div>
          </div>
        );
      })()}


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
                      {(invoice.status === 'draft' || invoice.status === 'sent') && (
                        <button
                          onClick={() => handleSendInvoice(invoice.id)}
                          className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Send via email"
                        >
                          <Send size={16} className="text-blue-500" />
                        </button>
                      )}
                      <div className="relative">
                        <button
                          onClick={() => setStatusMenuId(statusMenuId === invoice.id ? null : invoice.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Change status"
                        >
                          <MoreVertical size={16} className="text-gray-500" />
                        </button>
                        {statusMenuId === invoice.id && (
                          <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-40">
                            {(['draft', 'sent', 'paid', 'overdue', 'cancelled'] as Invoice['status'][])
                              .filter((s) => s !== invoice.status)
                              .map((s) => (
                                <button
                                  key={s}
                                  onClick={() => handleChangeInvoiceStatus(invoice.id, s)}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 capitalize"
                                >
                                  Mark as {s}
                                </button>
                              ))}
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

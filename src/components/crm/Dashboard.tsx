import React, { useMemo } from 'react';
import { useCRM, usePipelineStats, useFinancialStats, useUpcomingAppointments } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import {
  formatCurrency,
  formatDate,
  statusLabels,
  statusColors,
  getContactFullName,
} from '@/lib/crmData';
import {
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertTriangle,
  CheckCircle,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  Target,
  Zap,
} from 'lucide-react';

export default function Dashboard() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const pipelineStats = usePipelineStats();
  const financialStats = useFinancialStats();
  const upcomingAppointments = useUpcomingAppointments(7);

  // Calculate real trends by comparing contacts from last 30 days vs previous 30 days
  const trends = useMemo(() => {
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const recent = state.contacts.filter(c => now - new Date(c.createdAt).getTime() < thirtyDays);
    const previous = state.contacts.filter(c => {
      const age = now - new Date(c.createdAt).getTime();
      return age >= thirtyDays && age < thirtyDays * 2;
    });

    const contactGrowth = previous.length > 0
      ? Math.round(((recent.length - previous.length) / previous.length) * 100)
      : recent.length > 0 ? 100 : 0;

    const recentValue = recent.reduce((s, c) => s + (c.projectValue || 0), 0);
    const prevValue = previous.reduce((s, c) => s + (c.projectValue || 0), 0);
    const valueGrowth = prevValue > 0
      ? Math.round(((recentValue - prevValue) / prevValue) * 100)
      : recentValue > 0 ? 100 : 0;

    return { contactGrowth, valueGrowth };
  }, [state.contacts]);

  // Get recent activity (last 5 updated contacts)
  const recentActivity = [...state.contacts]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  // Get urgent items (pending payments, overdue, etc.)
  const urgentItems = state.contacts.filter(
    (c) => c.status === 'pending_payment' || (c.status === 'contingency' && c.insuranceCompany)
  );

  // Top performers
  const topPerformers = state.teamMembers
    .filter((tm) => tm.performance && tm.performance.revenue > 0)
    .sort((a, b) => (b.performance?.revenue || 0) - (a.performance?.revenue || 0))
    .slice(0, 3);

  const handleViewContact = (contactId: string) => {
    dispatch({ type: 'SELECT_CONTACT', payload: contactId });
  };

  // Get user's first name for greeting
  const firstName = profile?.first_name || state.currentUser?.name?.split(' ')[0] || 'there';

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome back, {firstName}!</h2>
          <p className="text-gray-500 mt-1">Here's what's happening with your business today.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'pipeline' })}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
          >
            View Pipeline
          </button>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_QUICK_ADD' })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg shadow-blue-600/30"
          >
            Add New Contact
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="text-blue-600" size={24} />
            </div>
            {trends.contactGrowth !== 0 && (
              <span className={`flex items-center gap-1 ${trends.contactGrowth >= 0 ? 'text-green-600' : 'text-red-600'} text-sm font-medium`}>
                {trends.contactGrowth >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                {Math.abs(trends.contactGrowth)}%
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-4">{pipelineStats.totalContacts}</p>
          <p className="text-gray-500 text-sm mt-1">Total Contacts</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <DollarSign className="text-green-600" size={24} />
            </div>
            {trends.valueGrowth !== 0 && (
              <span className={`flex items-center gap-1 ${trends.valueGrowth >= 0 ? 'text-green-600' : 'text-red-600'} text-sm font-medium`}>
                {trends.valueGrowth >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                {Math.abs(trends.valueGrowth)}%
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-4">
            {formatCurrency(pipelineStats.totalValue)}
          </p>
          <p className="text-gray-500 text-sm mt-1">Pipeline Value</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Target className="text-purple-600" size={24} />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-4">
            {pipelineStats.conversionRate.toFixed(1)}%
          </p>
          <p className="text-gray-500 text-sm mt-1">Conversion Rate</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="text-amber-600" size={24} />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-4">
            {formatCurrency(pipelineStats.avgDealSize)}
          </p>
          <p className="text-gray-500 text-sm mt-1">Avg Deal Size</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Overview */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Pipeline Overview</h3>
              <button
                onClick={() => dispatch({ type: 'SET_VIEW', payload: 'pipeline' })}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
              >
                View All <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {Object.entries(pipelineStats.byStatus)
                .filter(([status]) => !['completed', 'lost'].includes(status))
                .slice(0, 6)
                .map(([status, count]) => {
                  const percentage = (count / pipelineStats.totalContacts) * 100;
                  return (
                    <div key={status} className="flex items-center gap-4">
                      <div className="w-32 text-sm font-medium text-gray-700">
                        {statusLabels[status as keyof typeof statusLabels]}
                      </div>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-12 text-right text-sm font-semibold text-gray-900">
                        {count}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Upcoming Appointments */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Upcoming</h3>
              <button
                onClick={() => dispatch({ type: 'SET_VIEW', payload: 'calendar' })}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
              >
                View Calendar <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {upcomingAppointments.slice(0, 4).map((apt) => (
              <div key={apt.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="text-blue-600" size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{apt.title}</p>
                    <p className="text-sm text-gray-500">{apt.contactName}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <Clock size={12} />
                      <span>
                        {formatDate(apt.date)} at {apt.time}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {upcomingAppointments.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                <p>No upcoming appointments</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {recentActivity.map((contact) => {
              const assignee = state.teamMembers.find((tm) => tm.id === contact.assignedTo);
              return (
                <div
                  key={contact.id}
                  onClick={() => handleViewContact(contact.id)}
                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        {contact.firstName[0]}
                        {contact.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{getContactFullName(contact)}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <MapPin size={12} />
                          <span>
                            {contact.city}, {contact.state}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          statusColors[contact.status]
                        }`}
                      >
                        {statusLabels[contact.status]}
                      </span>
                      {assignee && (
                        <img
                          src={assignee.avatar}
                          alt={assignee.name}
                          className="w-8 h-8 rounded-full object-cover"
                          title={assignee.name}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alerts & Actions */}
        <div className="space-y-6">
          {/* Urgent Items */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={20} />
                <h3 className="text-lg font-semibold text-gray-900">Needs Attention</h3>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {urgentItems.slice(0, 3).map((contact) => (
                <div
                  key={contact.id}
                  onClick={() => handleViewContact(contact.id)}
                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <p className="font-medium text-gray-900">{getContactFullName(contact)}</p>
                  <p className="text-sm text-amber-600 mt-1">
                    {contact.status === 'pending_payment'
                      ? `Payment pending: ${formatCurrency(contact.finalPaymentAmount || 0)}`
                      : 'Waiting on insurance approval'}
                  </p>
                </div>
              ))}
              {urgentItems.length === 0 && (
                <div className="p-6 text-center text-gray-500">
                  <CheckCircle size={24} className="mx-auto mb-2 text-green-500" />
                  <p className="text-sm">All caught up!</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Performers */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Zap className="text-yellow-500" size={20} />
                <h3 className="text-lg font-semibold text-gray-900">Top Performers</h3>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {topPerformers.map((member, index) => (
                <div key={member.id} className="p-4 flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div
                      className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        index === 0
                          ? 'bg-yellow-500'
                          : index === 1
                          ? 'bg-gray-400'
                          : 'bg-amber-700'
                      }`}
                    >
                      {index + 1}
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{member.name}</p>
                    <p className="text-sm text-gray-500">
                      {member.performance?.dealsClosed} deals closed
                    </p>
                  </div>
                  <p className="font-semibold text-green-600">
                    {formatCurrency(member.performance?.revenue || 0)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Financial Summary</h3>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'financial' })}
            className="text-blue-400 hover:text-blue-300 text-sm font-medium flex items-center gap-1"
          >
            View Details <ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          <div>
            <p className="text-slate-400 text-sm">Total Revenue</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(financialStats.totalRevenue)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Deposits Collected</p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(financialStats.depositsCollected)}
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Pending Payments</p>
            <p className="text-2xl font-bold mt-1 text-amber-400">
              {formatCurrency(financialStats.pendingPayments)}
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Outstanding Invoices</p>
            <p className="text-2xl font-bold mt-1 text-orange-400">
              {formatCurrency(financialStats.outstandingInvoices)}
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Signed Estimates</p>
            <p className="text-2xl font-bold mt-1 text-emerald-400">
              {formatCurrency(financialStats.acceptedEstimatesTotal)}
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Material Costs</p>
            <p className="text-2xl font-bold mt-1 text-red-400">
              {formatCurrency(financialStats.deliveredMaterialCost + financialStats.pendingMaterialCost)}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}

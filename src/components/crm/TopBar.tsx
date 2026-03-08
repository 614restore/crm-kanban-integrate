import React, { useState, useEffect } from 'react';
import { useCRM } from '@/lib/crmStore';
import { db, DbNotification } from '@/lib/database';
import { useAuth } from '@/lib/authContext';
import {
  Search,
  Bell,
  Plus,
  Filter,
  ChevronDown,
  X,
  CheckCircle,
  AlertCircle,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { statusLabels, CustomerStatus } from '@/lib/crmData';

export default function TopBar() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [dbNotifications, setDbNotifications] = useState<DbNotification[]>([]);

  useEffect(() => {
    if (!state.companyId) return;
    db.getNotifications(state.companyId).then((rows) => {
      const userId = profile?.id;
      setDbNotifications(rows.filter((n) => !n.user_id || n.user_id === userId));
    });
  }, [state.companyId, profile?.id]);

  // Merge: DB is authoritative; include in-memory notifications not yet in DB (transient)
  const dbIds = new Set(dbNotifications.map((n) => n.id));
  const inMemoryOnly = state.notifications.filter((n) => !dbIds.has(n.id));
  const allNotifications = [
    ...inMemoryOnly.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      timestamp: n.timestamp,
      read: n.read,
      isDb: false,
    })),
    ...dbNotifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      timestamp: n.created_at,
      read: n.read,
      isDb: true,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const unreadCount = allNotifications.filter((n) => !n.read).length;

  const handleMarkRead = async (id: string, isDb: boolean) => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id });
    if (isDb) {
      await db.markNotificationRead(id);
      setDbNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-yellow-500" />;
      case 'error':
        return <AlertCircle size={16} className="text-red-500" />;
      default:
        return <Info size={16} className="text-blue-500" />;
    }
  };

  const viewTitles: Record<string, string> = {
    dashboard: 'Dashboard',
    pipeline: 'Sales Pipeline',
    contacts: 'Contacts',
    'contact-detail': 'Contact Details',
    communications: 'Communications Hub',
    calendar: 'Calendar & Scheduling',
    documents: 'Document Center',
    financial: 'Financial Dashboard',
    team: 'Team Management',
    automations: 'Workflow Automations',
    settings: 'Settings',
    'ai-assistant': 'AI Assistant',
    'crew-schedule': 'Crew Schedule',
    equipment: 'Equipment & Assets',
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Left: Title & Breadcrumb */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          {viewTitles[state.currentView] || 'Dashboard'}
        </h1>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-xl mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search contacts, jobs, documents..."
            value={state.searchQuery}
            onChange={(e) => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-transparent rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
          />
          {state.searchQuery && (
            <button
              onClick={() => dispatch({ type: 'SET_SEARCH', payload: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Filters */}
        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              state.filterStatus !== 'all' || state.filterAssignee !== 'all'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
          >
            <Filter size={18} />
            <span className="text-sm font-medium">Filters</span>
            <ChevronDown size={16} />
          </button>

          {showFilters && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Filters</h3>
                <button
                  onClick={() => {
                    dispatch({ type: 'SET_FILTER_STATUS', payload: 'all' });
                    dispatch({ type: 'SET_FILTER_ASSIGNEE', payload: 'all' });
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Clear all
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={state.filterStatus}
                    onChange={(e) =>
                      dispatch({
                        type: 'SET_FILTER_STATUS',
                        payload: e.target.value as CustomerStatus | 'all',
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    <option value="all">All Statuses</option>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                  <select
                    value={state.filterAssignee}
                    onChange={(e) =>
                      dispatch({ type: 'SET_FILTER_ASSIGNEE', payload: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    <option value="all">All Team Members</option>
                    {state.teamMembers.map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={() => setShowFilters(false)}
                className="w-full mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                Apply Filters
              </button>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Bell size={20} className="text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Notifications</h3>
                {allNotifications.length > 0 && (
                  <button
                    onClick={() => dispatch({ type: 'CLEAR_NOTIFICATIONS' })}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {allNotifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Bell size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No notifications</p>
                  </div>
                ) : (
                  allNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleMarkRead(notification.id, notification.isDb)}
                      className={`p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.read ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex gap-3">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                          <p className="text-sm text-gray-500 truncate">{notification.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(notification.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Add Button */}
        <button
          onClick={() => dispatch({ type: 'TOGGLE_QUICK_ADD' })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30"
        >
          <Plus size={18} />
          <span className="font-medium">Quick Add</span>
        </button>
      </div>

      {/* Click outside to close dropdowns */}
      {(showNotifications || showFilters) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowNotifications(false);
            setShowFilters(false);
          }}
        />
      )}
    </header>
  );
}

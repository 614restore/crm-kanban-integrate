import React, { useState, useEffect, useCallback } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { Automation } from '@/lib/crmData';
import { db } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Zap,
  Plus,
  Search,
  Play,
  Pause,
  Edit2,
  Trash2,
  Clock,
  Mail,
  MessageSquare,
  Bell,
  FileText,
  Users,
  DollarSign,
  Calendar,
  ArrowRight,
  CheckCircle,
  Settings,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AutomationLog {
  id: string;
  automation_id: string;
  triggered_at: string;
  contact_id?: string | null;
  contact_name?: string;
  details?: string | null;
  success: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getActionIcon(action: string) {
  if (action.toLowerCase().includes('email')) return <Mail size={16} className="text-blue-500" />;
  if (action.toLowerCase().includes('sms')) return <MessageSquare size={16} className="text-green-500" />;
  if (action.toLowerCase().includes('task')) return <CheckCircle size={16} className="text-purple-500" />;
  if (action.toLowerCase().includes('notify') || action.toLowerCase().includes('alert'))
    return <Bell size={16} className="text-amber-500" />;
  if (action.toLowerCase().includes('invoice') || action.toLowerCase().includes('payment'))
    return <DollarSign size={16} className="text-green-500" />;
  return <Zap size={16} className="text-gray-500" />;
}

function getTriggerIcon(trigger: string) {
  if (trigger.toLowerCase().includes('status')) return <Settings size={16} className="text-indigo-500" />;
  if (trigger.toLowerCase().includes('time') || trigger.toLowerCase().includes('days') || trigger.toLowerCase().includes('hours'))
    return <Clock size={16} className="text-orange-500" />;
  if (trigger.toLowerCase().includes('invoice') || trigger.toLowerCase().includes('payment'))
    return <DollarSign size={16} className="text-green-500" />;
  if (trigger.toLowerCase().includes('job')) return <FileText size={16} className="text-blue-500" />;
  if (trigger.toLowerCase().includes('lead') || trigger.toLowerCase().includes('canvas'))
    return <Users size={16} className="text-purple-500" />;
  return <Zap size={16} className="text-gray-500" />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AutomationsView() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [nameDialog, setNameDialog] = useState<{ type: 'create' | 'edit'; automation?: Automation } | null>(null);
  const [nameValue, setNameValue] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  // Automation run history
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  // ── Load run history from automation_logs table (graceful fallback if missing) ──
  const loadLogs = useCallback(async () => {
    if (!state.companyId) return;
    setLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from('automation_logs')
        .select('id, automation_id, triggered_at, contact_id, details, success')
        .eq('company_id', state.companyId)
        .order('triggered_at', { ascending: false })
        .limit(50);

      if (error) {
        if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
          // Table not migrated yet — silently ignore
          console.warn('automation_logs table not found');
        } else {
          console.error('Error loading automation logs:', error);
        }
        return;
      }
      setLogs(data ?? []);
    } finally {
      setLogsLoading(false);
    }
  }, [state.companyId]);

  useEffect(() => {
    if (showLogs) loadLogs();
  }, [showLogs, loadLogs]);

  // ── Filter automations ────────────────────────────────────────────────────
  const filteredAutomations = state.automations.filter((auto) => {
    const matchesSearch =
      searchQuery === '' ||
      auto.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      auto.trigger.toLowerCase().includes(searchQuery.toLowerCase()) ||
      auto.action.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterActive === 'all' ||
      (filterActive === 'active' && auto.isActive) ||
      (filterActive === 'inactive' && !auto.isActive);
    return matchesSearch && matchesFilter;
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleToggleAutomation = (id: string) => {
    const target = state.automations.find((auto) => auto.id === id);
    if (!target) return;
    const nextIsActive = !target.isActive;
    dispatch({ type: 'TOGGLE_AUTOMATION', payload: id });
    db.updateAutomation(id, { is_active: nextIsActive }).catch((error) => {
      console.error('Failed to persist automation toggle:', error);
      dispatch({ type: 'TOGGLE_AUTOMATION', payload: id });
      toast.error('Failed to save automation status');
    });
  };

  const handleCreateAutomation = () => {
    if (!state.companyId) { toast.error('No company selected'); return; }
    setNameValue('New Automation');
    setNameDialog({ type: 'create' });
  };

  const handleEditAutomation = (automation: Automation) => {
    setNameValue(automation.name);
    setNameDialog({ type: 'edit', automation });
  };

  const handleNameDialogSave = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed) return;
    setNameSaving(true);
    try {
      if (nameDialog?.type === 'create') {
        const created = await db.createAutomation({
          company_id: state.companyId!,
          name: trimmed,
          trigger_event: 'status change',
          action_type: 'send notification',
          is_active: false,
          created_by: state.currentUser?.id,
        });
        if (!created) { toast.error('Failed to create automation'); return; }
        dispatch({
          type: 'SET_AUTOMATIONS',
          payload: [...state.automations, {
            id: created.id,
            name: created.name,
            trigger: created.trigger_event,
            action: created.action_type,
            isActive: created.is_active,
            createdBy: created.created_by || '',
          }],
        });
        toast.success('Automation created');
      } else if (nameDialog?.automation) {
        const automation = nameDialog.automation;
        if (trimmed === automation.name) { setNameDialog(null); return; }
        const updated = await db.updateAutomation(automation.id, { name: trimmed });
        if (!updated) { toast.error('Failed to update automation'); return; }
        dispatch({
          type: 'SET_AUTOMATIONS',
          payload: state.automations.map((a) => a.id === automation.id ? { ...a, name: updated.name } : a),
        });
        toast.success('Automation updated');
      }
      setNameDialog(null);
    } finally {
      setNameSaving(false);
    }
  };

  const handleDeleteAutomation = (automation: Automation) => {
    toast.warning(`Delete "${automation.name}"? This cannot be undone.`, {
      action: {
        label: 'Delete',
        onClick: async () => {
          const ok = await db.deleteAutomation(automation.id);
          if (!ok) { toast.error('Failed to delete automation'); return; }
          dispatch({ type: 'SET_AUTOMATIONS', payload: state.automations.filter((a) => a.id !== automation.id) });
          toast.success('Automation deleted');
        },
      },
      cancel: { label: 'Cancel' },
      duration: 8000,
    });
  };

  // ── Stats (real counts, not hardcoded) ────────────────────────────────────
  const activeCount = state.automations.filter((a) => a.isActive).length;
  const inactiveCount = state.automations.filter((a) => !a.isActive).length;
  const thisMonthLogs = logs.filter((l) => {
    const d = new Date(l.triggered_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Workflow Automations</h2>
          <p className="text-gray-500 mt-1">
            {activeCount} active · {inactiveCount} inactive
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={15} />
            {showLogs ? 'Hide Log' : 'Run History'}
          </button>
          <button
            onClick={handleCreateAutomation}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            <span className="font-medium">Create Automation</span>
          </button>
        </div>
      </div>

      {/* Stats Cards — real data */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Play className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
              <p className="text-gray-500 text-sm">Active Automations</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <Pause className="text-gray-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{inactiveCount}</p>
              <p className="text-gray-500 text-sm">Paused Automations</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Zap className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{thisMonthLogs.length}</p>
              <p className="text-gray-500 text-sm">Actions This Month</p>
            </div>
          </div>
        </div>
      </div>

      {/* Run History panel */}
      {showLogs && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <RefreshCw size={16} className="text-blue-500" />
              Automation Run History
            </h3>
            <button onClick={loadLogs} disabled={logsLoading}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-50">
              {logsLoading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
          {logsLoading ? (
            <div className="p-6 text-center text-gray-400 text-sm">Loading run history…</div>
          ) : logs.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <AlertCircle size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No automations have run yet</p>
              <p className="text-xs mt-1">Automations fire when a contact's status changes to a matching trigger condition.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
              {logs.map((log) => {
                const auto = state.automations.find(a => a.id === log.automation_id);
                return (
                  <div key={log.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${log.success ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <p className="font-medium text-gray-800">{auto?.name ?? 'Unknown automation'}</p>
                        {log.details && <p className="text-xs text-gray-400">{log.details}</p>}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 shrink-0 ml-4">
                      {new Date(log.triggered_at).toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search automations..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
        </div>
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          {[{ id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'inactive', label: 'Inactive' }].map((filter) => (
            <button key={filter.id} onClick={() => setFilterActive(filter.id as any)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filterActive === filter.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}>
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Automations list */}
      <div className="space-y-4">
        {filteredAutomations.map((automation) => (
          <div key={automation.id}
            className={`bg-white rounded-xl border p-6 transition-all ${automation.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${automation.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <Zap size={24} className={automation.isActive ? 'text-green-600' : 'text-gray-400'} />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{automation.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      automation.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {automation.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                      {getTriggerIcon(automation.trigger)}
                      <span className="text-sm text-gray-700">{automation.trigger}</span>
                    </div>
                    <ArrowRight size={20} className="text-gray-400" />
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
                      {getActionIcon(automation.action)}
                      <span className="text-sm text-blue-700">{automation.action}</span>
                    </div>
                  </div>
                  {/* Last run time from logs */}
                  {(() => {
                    const lastLog = logs.find(l => l.automation_id === automation.id);
                    return lastLog ? (
                      <p className="text-xs text-gray-400 mt-2">
                        Last run: {new Date(lastLog.triggered_at).toLocaleString()}
                        {lastLog.success ? ' ✓' : ' ✗ failed'}
                      </p>
                    ) : null;
                  })()}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleAutomation(automation.id)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    automation.isActive ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    automation.isActive ? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
                <button onClick={() => handleEditAutomation(automation)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Edit2 size={16} className="text-gray-500" />
                </button>
                <button onClick={() => handleDeleteAutomation(automation)} className="p-2 hover:bg-red-100 rounded-lg transition-colors">
                  <Trash2 size={16} className="text-red-500" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredAutomations.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Zap size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No automations found</h3>
            <p className="text-gray-500">Create your first automation or adjust your filter</p>
          </div>
        )}
      </div>

      {/* Suggested Automations */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Suggested Automations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { name: 'Welcome Series', description: 'Send a series of welcome emails to new leads', icon: <Mail className="text-blue-500" size={20} /> },
            { name: 'Stale Lead Alert', description: 'Notify sales when a lead has been inactive for 7 days', icon: <Bell className="text-amber-500" size={20} /> },
            { name: 'Job Completion Survey', description: 'Automatically send satisfaction survey after job completion', icon: <FileText className="text-green-500" size={20} /> },
            { name: 'Payment Reminder', description: 'Send reminder 3 days before invoice due date', icon: <DollarSign className="text-purple-500" size={20} /> },
          ].map((suggestion, index) => (
            <div key={index}
              onClick={() => { setNameValue(suggestion.name); setNameDialog({ type: 'create' }); }}
              className="bg-white rounded-lg p-4 border border-gray-200 hover:border-blue-300 cursor-pointer transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">{suggestion.icon}</div>
                <div>
                  <h4 className="font-medium text-gray-900">{suggestion.name}</h4>
                  <p className="text-sm text-gray-500 mt-1">{suggestion.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Name dialog */}
      <Dialog open={!!nameDialog} onOpenChange={(open) => { if (!open) setNameDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{nameDialog?.type === 'create' ? 'Create Automation' : 'Rename Automation'}</DialogTitle>
          </DialogHeader>
          <input autoFocus type="text" value={nameValue} onChange={(e) => setNameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleNameDialogSave(); }}
            placeholder="Automation name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <DialogFooter>
            <button onClick={() => setNameDialog(null)}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
            <button onClick={handleNameDialogSave} disabled={!nameValue.trim() || nameSaving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
              {nameSaving ? 'Saving…' : nameDialog?.type === 'create' ? 'Create' : 'Save'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

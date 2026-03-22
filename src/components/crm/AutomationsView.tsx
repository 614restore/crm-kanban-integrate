import React, { useState, useEffect, useCallback } from 'react';
import { useCRM } from '@/lib/crmStore';
import { Automation } from '@/lib/crmData';
import { db } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/authContext';
import { toast } from 'sonner';
import { getStaleLeadThreshold, setStaleLeadThreshold, DEFAULT_STALE_HOURS } from '@/lib/staleLeadDetection';
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
  HardHat,
  UserCheck,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecipientOption {
  id: string;
  label: string;
  sub: string;
  type: 'contact' | 'team' | 'subcontractor';
  email?: string | null;
  phone?: string | null;
}

interface AutomationRecipient {
  recipientType: 'contact' | 'team' | 'subcontractor';
  recipientId: string;
  label: string;
}

// ─── Recipient Picker ─────────────────────────────────────────────────────────

interface RecipientPickerProps {
  companyId: string;
  contacts: { id: string; firstName: string; lastName: string; email?: string }[];
  selected: AutomationRecipient[];
  onChange: (recipients: AutomationRecipient[]) => void;
}

function RecipientPicker({ companyId, contacts, selected, onChange }: RecipientPickerProps) {
  const [tab, setTab] = useState<'contact' | 'team' | 'subcontractor'>('contact');
  const [teamMembers, setTeamMembers] = useState<RecipientOption[]>([]);
  const [subcontractors, setSubcontractors] = useState<RecipientOption[]>([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);

  const loadTeam = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, email')
      .eq('company_id', companyId)
      .order('full_name');
    setTeamMembers(
      (data ?? []).map(p => ({
        id: p.id,
        label: p.full_name,
        sub: p.role ?? 'Team Member',
        type: 'team',
        email: p.email,
      }))
    );
  }, [companyId]);

  const loadSubs = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('subcontractor_crews')
      .select('id, company_name, contact_name, email, phone, trade')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('company_name');
    setSubcontractors(
      (data ?? []).map(s => ({
        id: s.id,
        label: s.company_name,
        sub: [s.contact_name, s.trade].filter(Boolean).join(' · ') || 'Subcontractor',
        type: 'subcontractor',
        email: s.email,
        phone: s.phone,
      }))
    );
  }, [companyId]);

  useEffect(() => {
    if (expanded) {
      loadTeam();
      loadSubs();
    }
  }, [expanded, loadTeam, loadSubs]);

  const contactOptions: RecipientOption[] = contacts.map(c => ({
    id: c.id,
    label: `${c.firstName} ${c.lastName}`.trim(),
    sub: c.email ?? 'Customer',
    type: 'contact',
    email: c.email,
  }));

  const listByTab: Record<string, RecipientOption[]> = {
    contact: contactOptions,
    team: teamMembers,
    subcontractor: subcontractors,
  };

  const filtered = (listByTab[tab] ?? []).filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    o.sub.toLowerCase().includes(search.toLowerCase())
  );

  const isSelected = (id: string) => selected.some(s => s.recipientId === id);

  const toggle = (opt: RecipientOption) => {
    if (isSelected(opt.id)) {
      onChange(selected.filter(s => s.recipientId !== opt.id));
    } else {
      onChange([...selected, { recipientType: opt.type, recipientId: opt.id, label: opt.label }]);
    }
  };

  const removeChip = (id: string) => onChange(selected.filter(s => s.recipientId !== id));

  const tabDef = [
    { id: 'contact', label: 'Customers', icon: Users },
    { id: 'team', label: 'Team', icon: UserCheck },
    { id: 'subcontractor', label: 'Subcontractors', icon: HardHat },
  ] as const;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">Send To (Recipients)</label>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
        >
          {expanded ? <><ChevronUp size={12} /> Hide</> : <><ChevronDown size={12} /> Select recipients</>}
        </button>
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(r => (
            <span
              key={r.recipientId}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full font-medium"
            >
              {r.label}
              <button type="button" onClick={() => removeChip(r.recipientId)} className="hover:text-blue-600">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {selected.length === 0 && !expanded && (
        <p className="text-xs text-gray-400 italic">No recipients selected — automation will run without a specific recipient.</p>
      )}

      {expanded && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            {tabDef.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                  tab === t.id ? 'bg-white text-blue-700 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <t.icon size={12} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-gray-100">
            <input
              type="text"
              placeholder={`Search ${tab === 'contact' ? 'customers' : tab === 'team' ? 'team members' : 'subcontractors'}…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* List */}
          <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-400 text-center">
                {tab === 'subcontractor'
                  ? 'No subcontractors found. Add them in Crew Schedule → Manage Subcontractors.'
                  : 'No results found.'}
              </p>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggle(opt)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                    isSelected(opt.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                      isSelected(opt.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                    }`}
                  >
                    {isSelected(opt.id) && <CheckCircle size={12} className="text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{opt.label}</p>
                    <p className="text-xs text-gray-400 truncate">{opt.sub}</p>
                  </div>
                  {opt.type === 'subcontractor' && (
                    <span className="ml-auto shrink-0 px-1.5 py-0.5 bg-orange-100 text-orange-600 text-xs rounded-full">Sub</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

// Automations that support a custom message body
const MESSAGE_AUTOMATION_NAMES = ['Welcome Series', 'Job Completion Survey', 'Payment Reminder'];
// Automation names that drive stale-lead alerts
const STALE_LEAD_NAMES = ['Stale Lead Alert'];

const STALE_HOUR_PRESETS = [
  { label: '24 hours', value: 24 },
  { label: '48 hours', value: 48 },
  { label: '72 hours', value: 72 },
  { label: 'Custom', value: 0 },
];

export default function AutomationsView() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [nameDialog, setNameDialog] = useState<{ type: 'create' | 'edit'; automation?: Automation } | null>(null);
  const [nameValue, setNameValue] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [recipients, setRecipients] = useState<AutomationRecipient[]>([]);
  const [messageBody, setMessageBody] = useState('');
  const [triggerDelayHours, setTriggerDelayHours] = useState<number>(24);
  const [customHours, setCustomHours] = useState('');
  const [useCustomHours, setUseCustomHours] = useState(false);

  // Company-wide stale lead threshold (shown in the suggested automations section)
  const companyId = state.companyId ?? '';
  const [globalStaleHours, setGlobalStaleHours] = useState<number>(() =>
    companyId ? getStaleLeadThreshold(companyId) : DEFAULT_STALE_HOURS
  );
  const [globalCustomHours, setGlobalCustomHours] = useState('');
  const [globalUseCustom, setGlobalUseCustom] = useState(() => {
    const h = companyId ? getStaleLeadThreshold(companyId) : DEFAULT_STALE_HOURS;
    return ![24, 48, 72].includes(h);
  });

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

  const handleCreateAutomation = (suggestionName?: string) => {
    if (!state.companyId) { toast.error('No company selected'); return; }
    const name = suggestionName || 'New Automation';
    setNameValue(name);
    setRecipients([]);
    setMessageBody('');
    const isStale = STALE_LEAD_NAMES.some(n => name.includes(n));
    const defaultHours = isStale ? getStaleLeadThreshold(state.companyId) : 24;
    setTriggerDelayHours(defaultHours);
    setUseCustomHours(![24, 48, 72].includes(defaultHours));
    setCustomHours(![24, 48, 72].includes(defaultHours) ? String(defaultHours) : '');
    setNameDialog({ type: 'create' });
  };

  const handleEditAutomation = (automation: Automation) => {
    setNameValue(automation.name);
    setRecipients([]);
    setMessageBody(automation.messageBody || '');
    const hours = automation.triggerDelayHours ?? 24;
    setTriggerDelayHours(hours);
    setUseCustomHours(![24, 48, 72].includes(hours));
    setCustomHours(![24, 48, 72].includes(hours) ? String(hours) : '');
    setNameDialog({ type: 'edit', automation });
  };

  const handleNameDialogSave = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed) return;
    setNameSaving(true);

    const isStaleAlert = STALE_LEAD_NAMES.some(n => trimmed.includes(n));
    const effectiveHours = useCustomHours
      ? (parseInt(customHours, 10) || 24)
      : triggerDelayHours;

    // Persist stale-lead threshold to localStorage so detection picks it up immediately
    if (isStaleAlert && state.companyId) {
      setStaleLeadThreshold(state.companyId, effectiveHours);
    }

    try {
      if (nameDialog?.type === 'create') {
        const created = await db.createAutomation({
          company_id: state.companyId!,
          name: trimmed,
          trigger_event: isStaleAlert ? `inactive for ${effectiveHours} hours` : 'status change',
          action_type: 'send notification',
          is_active: false,
          created_by: state.currentUser?.id,
          recipients: recipients.length > 0 ? recipients : undefined,
          message_body: messageBody.trim() || undefined,
          trigger_delay_hours: effectiveHours,
        } as any);
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
            messageBody: (created as any).message_body || undefined,
            triggerDelayHours: (created as any).trigger_delay_hours || undefined,
          }],
        });
        toast.success('Automation created');
      } else if (nameDialog?.automation) {
        const automation = nameDialog.automation;
        const updated = await db.updateAutomation(automation.id, {
          name: trimmed,
          recipients: recipients.length > 0 ? recipients : undefined,
          message_body: messageBody.trim() || undefined,
          trigger_delay_hours: effectiveHours,
          trigger_event: isStaleAlert ? `inactive for ${effectiveHours} hours` : undefined,
        } as any);
        if (!updated) { toast.error('Failed to update automation'); return; }
        dispatch({
          type: 'SET_AUTOMATIONS',
          payload: state.automations.map((a) =>
            a.id === automation.id
              ? {
                  ...a,
                  name: updated.name,
                  messageBody: (updated as any).message_body || undefined,
                  triggerDelayHours: (updated as any).trigger_delay_hours || undefined,
                  trigger: isStaleAlert ? `inactive for ${effectiveHours} hours` : a.trigger,
                }
              : a
          ),
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

  const getActionIcon = (action: string) => {
    if (action.toLowerCase().includes('email')) return <Mail size={16} className="text-blue-500" />;
    if (action.toLowerCase().includes('sms')) return <MessageSquare size={16} className="text-green-500" />;
    if (action.toLowerCase().includes('task')) return <CheckCircle size={16} className="text-purple-500" />;
    if (action.toLowerCase().includes('notify') || action.toLowerCase().includes('alert'))
      return <Bell size={16} className="text-amber-500" />;
    if (action.toLowerCase().includes('invoice') || action.toLowerCase().includes('payment'))
      return <DollarSign size={16} className="text-green-500" />;
    return <Zap size={16} className="text-gray-500" />;
  };

  const getTriggerIcon = (trigger: string) => {
    if (trigger.toLowerCase().includes('status')) return <Settings size={16} className="text-indigo-500" />;
    if (trigger.toLowerCase().includes('time') || trigger.toLowerCase().includes('days') || trigger.toLowerCase().includes('hours'))
      return <Clock size={16} className="text-orange-500" />;
    if (trigger.toLowerCase().includes('invoice') || trigger.toLowerCase().includes('payment'))
      return <DollarSign size={16} className="text-green-500" />;
    if (trigger.toLowerCase().includes('job')) return <FileText size={16} className="text-blue-500" />;
    if (trigger.toLowerCase().includes('lead') || trigger.toLowerCase().includes('canvas'))
      return <Users size={16} className="text-purple-500" />;
    return <Zap size={16} className="text-gray-500" />;
  };

  const activeCount = state.automations.filter((a) => a.isActive).length;
  const inactiveCount = state.automations.filter((a) => !a.isActive).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Workflow Automations</h2>
          <p className="text-gray-500 mt-1">{activeCount} active, {inactiveCount} inactive automations</p>
        </div>
        <button
          onClick={handleCreateAutomation}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          <span className="font-medium">Create Automation</span>
        </button>
      </div>

      {/* Stats Cards */}
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
              <p className="text-2xl font-bold text-gray-900">1,247</p>
              <p className="text-gray-500 text-sm">Actions This Month</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search automations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterActive(f)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                filterActive === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Automations List */}
      <div className="space-y-4">
        {filteredAutomations.map((automation) => (
          <div
            key={automation.id}
            className={`bg-white rounded-xl border p-6 transition-all ${
              automation.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  automation.isActive ? 'bg-green-100' : 'bg-gray-100'
                }`}>
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

                  <div className="mt-4 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                      {getTriggerIcon(automation.trigger)}
                      <span className="text-sm text-gray-700">{automation.trigger}</span>
                    </div>
                    <ArrowRight size={20} className="text-gray-400" />
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
                      {getActionIcon(automation.action)}
                      <span className="text-sm text-blue-700">{automation.action}</span>
                    </div>
                    {automation.triggerDelayHours && (
                      <div className="flex items-center gap-1 px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg">
                        <Clock size={13} className="text-amber-500" />
                        <span className="text-xs text-amber-700">
                          {automation.triggerDelayHours}h threshold
                        </span>
                      </div>
                    )}
                  </div>
                  {automation.messageBody && (
                    <p className="mt-2 text-xs text-gray-500 italic line-clamp-2 max-w-lg">
                      "{automation.messageBody}"
                    </p>
                  )}
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
                <button onClick={() => handleEditAutomation(automation)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Edit2 size={16} className="text-gray-500" />
                </button>
                <button onClick={() => handleDeleteAutomation(automation)}
                  className="p-2 hover:bg-red-100 rounded-lg transition-colors">
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
            <p className="text-gray-500">Try adjusting your search or filter</p>
          </div>
        )}
      </div>

      {/* Suggested Automations */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Suggested Automations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { name: 'Welcome Series', description: 'Send a series of welcome emails to new leads', icon: <Mail className="text-blue-500" size={20} /> },
            { name: 'Stale Lead Alert', description: `Notify sales when a lead has been inactive — configure 24 h, 48 h, 72 h, or custom`, icon: <Bell className="text-amber-500" size={20} /> },
            { name: 'Job Completion Survey', description: 'Automatically send satisfaction survey after job completion', icon: <FileText className="text-green-500" size={20} /> },
            { name: 'Payment Reminder', description: 'Send reminder before invoice due date — customize the message', icon: <DollarSign className="text-purple-500" size={20} /> },
          ].map((suggestion, index) => (
            <div
              key={index}
              className="bg-white rounded-lg p-4 border border-gray-200 hover:border-blue-300 cursor-pointer transition-colors"
              onClick={() => handleCreateAutomation(suggestion.name)}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {suggestion.icon}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{suggestion.name}</h4>
                  <p className="text-sm text-gray-500 mt-1">{suggestion.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog
        open={!!nameDialog}
        onOpenChange={(open) => {
          if (!open) { setNameDialog(null); setRecipients([]); setMessageBody(''); }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{nameDialog?.type === 'create' ? 'Create Automation' : 'Edit Automation'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Automation Name</label>
              <input
                autoFocus
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNameDialogSave(); }}
                placeholder="Automation name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Stale Lead Threshold — shown when name contains "Stale Lead" */}
            {STALE_LEAD_NAMES.some(n => nameValue.includes(n)) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alert after inactivity of
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {STALE_HOUR_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        if (preset.value === 0) {
                          setUseCustomHours(true);
                        } else {
                          setUseCustomHours(false);
                          setTriggerDelayHours(preset.value);
                        }
                      }}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        preset.value === 0
                          ? useCustomHours
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 text-gray-600 hover:border-blue-400'
                          : !useCustomHours && triggerDelayHours === preset.value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 text-gray-600 hover:border-blue-400'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {useCustomHours && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={customHours}
                      onChange={(e) => setCustomHours(e.target.value)}
                      placeholder="Hours"
                      className="w-28 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-500">hours of inactivity</span>
                  </div>
                )}
              </div>
            )}

            {/* Custom Message — shown for message-capable automations */}
            {MESSAGE_AUTOMATION_NAMES.some(n => nameValue.includes(n)) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Message
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    (leave blank to use default)
                  </span>
                </label>
                <textarea
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder={
                    nameValue.includes('Welcome')
                      ? "Hi {name}, welcome! We're excited to work with you…"
                      : nameValue.includes('Survey')
                      ? "Hi {name}, we'd love your feedback on the recently completed job…"
                      : "Hi {name}, this is a friendly reminder that your invoice is due soon…"
                  }
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  You can use <code className="bg-gray-100 px-1 rounded">{'{name}'}</code>,{' '}
                  <code className="bg-gray-100 px-1 rounded">{'{company}'}</code>, and{' '}
                  <code className="bg-gray-100 px-1 rounded">{'{amount}'}</code> as placeholders.
                </p>
              </div>
            )}

            {/* Recipient Picker */}
            <RecipientPicker
              companyId={state.companyId ?? ''}
              contacts={state.contacts}
              selected={recipients}
              onChange={setRecipients}
            />
          </div>

          <DialogFooter>
            <button
              onClick={() => { setNameDialog(null); setRecipients([]); setMessageBody(''); }}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleNameDialogSave}
              disabled={!nameValue.trim() || nameSaving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {nameSaving ? 'Saving…' : nameDialog?.type === 'create' ? 'Create' : 'Save'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

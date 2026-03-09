import React, { useState, useEffect, useCallback } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  X,
  Plus,
  Loader2,
  CheckCircle,
  PlayCircle,
  XCircle,
  BarChart3,
  Edit3,
  Trash2,
  HardHat,
  Save,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────

type ScheduleStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

interface CrewSchedule {
  id: string;
  company_id: string;
  crew_member_id?: string | null;
  subcontractor_id?: string | null;
  job_id?: string | null;
  contact_id?: string | null;
  title: string;
  notes?: string | null;
  scheduled_date: string;
  start_time?: string | null;
  end_time?: string | null;
  status: ScheduleStatus;
  created_by?: string | null;
}

interface InternalCrewRow {
  type: 'internal';
  id: string;
  full_name: string;
  avatar_url?: string | null;
  role?: string | null;
}

interface SubcontractorCrewRow {
  type: 'subcontractor';
  id: string;
  full_name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  trade?: string | null;
}

type CrewRow = InternalCrewRow | SubcontractorCrewRow;

interface SubcontractorCrew {
  id: string;
  company_id: string;
  company_name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  trade?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekDates(anchorDate: Date): Date[] {
  const d = new Date(anchorDate);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
}

function toISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatHeaderDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function isToday(date: Date): boolean {
  return toISO(date) === toISO(new Date());
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ScheduleStatus }) {
  const config: Record<ScheduleStatus, { label: string; className: string; icon: React.ElementType }> = {
    scheduled: { label: 'Scheduled', className: 'bg-blue-100 text-blue-700', icon: Calendar },
    in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-700', icon: PlayCircle },
    completed: { label: 'Completed', className: 'bg-green-100 text-green-700', icon: CheckCircle },
    cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500', icon: XCircle },
  };
  const { label, className, icon: Icon } = config[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      <Icon size={11} />
      {label}
    </span>
  );
}

// ─── Subcontractor Form Modal ─────────────────────────────────────────────────

interface SubcontractorFormProps {
  existing?: SubcontractorCrew | null;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}

function SubcontractorFormModal({ existing, companyId, onClose, onSaved }: SubcontractorFormProps) {
  const [companyName, setCompanyName] = useState(existing?.company_name ?? '');
  const [contactName, setContactName] = useState(existing?.contact_name ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [trade, setTrade] = useState(existing?.trade ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!companyName.trim()) {
      toast.error('Company / crew name is required');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        company_id: companyId,
        company_name: companyName.trim(),
        contact_name: contactName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        trade: trade.trim() || null,
        notes: notes.trim() || null,
        is_active: true,
      };
      if (existing) {
        const { error } = await withTimeout(
          supabase.from('subcontractor_crews').update(payload).eq('id', existing.id),
          10000, 'updateSubcontractor'
        );
        if (error) throw error;
        toast.success('Subcontractor updated');
      } else {
        const { error } = await withTimeout(
          supabase.from('subcontractor_crews').insert(payload),
          10000, 'insertSubcontractor'
        );
        if (error) throw error;
        toast.success('Subcontractor added to crew');
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save subcontractor');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {existing ? 'Edit Subcontractor' : 'Add Subcontractor / Crew'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">No app login required — manual entry only</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company / Crew Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="e.g., Smith Roofing LLC"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
            <input
              type="text"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="e.g., John Smith"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(555) 000-0000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trade / Specialty</label>
            <input
              type="text"
              value={trade}
              onChange={e => setTrade(e.target.value)}
              placeholder="e.g., Roofing, Gutters, Siding"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional notes…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            <Save size={14} />
            {existing ? 'Save Changes' : 'Add to Crew'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Assignment Modal ─────────────────────────────────────────────────────────

interface AssignmentModalProps {
  crewMemberId: string;
  crewMemberName: string;
  date: string;
  existing?: CrewSchedule | null;
  contacts: { id: string; firstName: string; lastName: string }[];
  onClose: () => void;
  onSaved: () => void;
  companyId: string;
  userId: string;
  hasConflict: boolean;
}

function AssignmentModal({
  crewMemberId,
  crewMemberName,
  date,
  existing,
  contacts,
  onClose,
  onSaved,
  companyId,
  userId,
  hasConflict,
}: AssignmentModalProps) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [contactId, setContactId] = useState(existing?.contact_id ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [startTime, setStartTime] = useState(existing?.start_time ?? '');
  const [endTime, setEndTime] = useState(existing?.end_time ?? '');
  const [status, setStatus] = useState<ScheduleStatus>(existing?.status ?? 'scheduled');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title for this assignment');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        company_id: companyId,
        crew_member_id: crewMemberId,
        title: title.trim(),
        contact_id: contactId || null,
        notes: notes.trim() || null,
        scheduled_date: date,
        start_time: startTime || null,
        end_time: endTime || null,
        status,
        created_by: userId,
      };

      if (existing) {
        const { error } = await withTimeout(
          supabase.from('crew_schedules').update(payload).eq('id', existing.id),
          10000, 'updateCrewSchedule'
        );
        if (error) throw error;
        toast.success('Assignment updated');
      } else {
        const { error } = await withTimeout(
          supabase.from('crew_schedules').insert(payload),
          10000, 'createCrewSchedule'
        );
        if (error) throw error;
        toast.success('Assignment created');
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('Error saving assignment:', err);
      toast.error('Failed to save assignment');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    setIsSaving(true);
    try {
      const { error } = await withTimeout(
        supabase.from('crew_schedules').delete().eq('id', existing.id),
        10000, 'deleteCrewSchedule'
      );
      if (error) throw error;
      toast.success('Assignment removed');
      onSaved();
      onClose();
    } catch (err) {
      console.error('Error deleting assignment:', err);
      toast.error('Failed to remove assignment');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {existing ? 'Edit Assignment' : 'Add Assignment'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {crewMemberName} — {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {hasConflict && !existing && (
          <div className="mx-6 mt-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-700 text-sm">
            <AlertTriangle size={15} className="shrink-0" />
            This crew member already has an assignment on this day.
          </div>
        )}

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Roof installation – Phase 1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
            <select
              value={contactId}
              onChange={e => setContactId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">— None —</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as ScheduleStatus)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Any additional notes…" />
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
          <div>
            {existing && (
              <button onClick={handleDelete} disabled={isSaving}
                className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
                Remove
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
              {isSaving && <Loader2 size={14} className="animate-spin" />}
              {existing ? 'Save Changes' : 'Add Assignment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Subcontractor Manager Panel ──────────────────────────────────────────────

interface SubcontractorManagerProps {
  companyId: string;
  subcontractors: SubcontractorCrew[];
  onReload: () => void;
}

function SubcontractorManager({ companyId, subcontractors, onReload }: SubcontractorManagerProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SubcontractorCrew | null>(null);

  const handleDelete = (sub: SubcontractorCrew) => {
    toast.warning(`Remove "${sub.company_name}" from crew?`, {
      action: {
        label: 'Remove',
        onClick: async () => {
          const { error } = await supabase.from('subcontractor_crews').update({ is_active: false }).eq('id', sub.id);
          if (error) { toast.error('Failed to remove'); return; }
          toast.success('Subcontractor removed');
          onReload();
        },
      },
      cancel: { label: 'Cancel' },
      duration: 8000,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <HardHat size={18} className="text-orange-500" />
          <h3 className="text-sm font-semibold text-gray-800">Subcontractor Crews</h3>
          <span className="ml-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
            {subcontractors.length}
          </span>
        </div>
        <button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
        >
          <UserPlus size={13} />
          Add Subcontractor
        </button>
      </div>

      {subcontractors.length === 0 ? (
        <div className="px-5 py-8 text-center text-gray-400">
          <HardHat size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No subcontractors added yet.</p>
          <p className="text-xs mt-1">Add crews that don't have app access.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {subcontractors.map(sub => (
            <li key={sub.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-semibold uppercase shrink-0">
                  {sub.company_name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{sub.company_name}</p>
                  <p className="text-xs text-gray-500">
                    {[sub.contact_name, sub.trade, sub.phone].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setEditing(sub); setFormOpen(true); }}
                  className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
                >
                  <Edit3 size={13} />
                </button>
                <button
                  onClick={() => handleDelete(sub)}
                  className="p-1.5 rounded-lg hover:bg-red-100 text-red-500"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {formOpen && (
        <SubcontractorFormModal
          existing={editing}
          companyId={companyId}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={onReload}
        />
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CrewScheduleView({ contactFilterId }: { contactFilterId?: string }) {
  const { state } = useCRM();
  const { profile } = useAuth();

  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [crewMembers, setCrewMembers] = useState<CrewRow[]>([]);
  const [subcontractors, setSubcontractors] = useState<SubcontractorCrew[]>([]);
  const [schedules, setSchedules] = useState<CrewSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSubManager, setShowSubManager] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalCrewMember, setModalCrewMember] = useState<CrewRow | null>(null);
  const [modalDate, setModalDate] = useState<string>('');
  const [modalExisting, setModalExisting] = useState<CrewSchedule | null>(null);

  const weekDates = getWeekDates(anchorDate);
  const weekStart = toISO(weekDates[0]);
  const weekEnd = toISO(weekDates[6]);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadSubcontractors = useCallback(async () => {
    if (!profile?.company_id) return;
    const { data, error } = await supabase
      .from('subcontractor_crews')
      .select('*')
      .eq('company_id', profile.company_id)
      .eq('is_active', true)
      .order('company_name');
    if (error) {
      // Table may not exist yet — fail silently
      console.warn('subcontractor_crews query failed (table may need migration):', error.message);
      return;
    }
    setSubcontractors((data ?? []) as SubcontractorCrew[]);
  }, [profile?.company_id]);

  const loadCrewMembers = useCallback(async () => {
    if (!profile?.company_id) return;

    // Load internal team members from profiles
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .eq('company_id', profile.company_id)
      .order('full_name');
    if (profileError) {
      console.error('Error loading internal crew:', profileError);
      toast.error('Failed to load crew members');
      return;
    }

    // Load subcontractors
    const { data: subData, error: subError } = await supabase
      .from('subcontractor_crews')
      .select('id, company_name, contact_name, phone, email, trade')
      .eq('company_id', profile.company_id)
      .eq('is_active', true)
      .order('company_name');
    if (subError) {
      console.warn('subcontractor_crews not available:', subError.message);
    }

    const internal: InternalCrewRow[] = (profileData ?? []).map(p => ({
      type: 'internal',
      id: p.id,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      role: p.role,
    }));

    const subs: SubcontractorCrewRow[] = (subData ?? []).map(s => ({
      type: 'subcontractor',
      id: s.id,
      full_name: s.company_name,
      contact_name: s.contact_name,
      phone: s.phone,
      email: s.email,
      trade: s.trade,
    }));

    setCrewMembers([...internal, ...subs]);
  }, [profile?.company_id]);

  const loadSchedules = useCallback(async () => {
    if (!profile?.company_id) return;
    let query = supabase
      .from('crew_schedules')
      .select('*')
      .eq('company_id', profile.company_id)
      .gte('scheduled_date', weekStart)
      .lte('scheduled_date', weekEnd)
      .order('scheduled_date');
    if (contactFilterId) query = query.eq('contact_id', contactFilterId);
    const { data, error } = await query;
    if (error) {
      console.error('Error loading schedules:', error);
      toast.error('Failed to load crew schedules');
      return;
    }
    setSchedules((data ?? []) as CrewSchedule[]);
  }, [profile?.company_id, weekStart, weekEnd, contactFilterId]);

  const reloadAll = useCallback(() => {
    return Promise.all([loadCrewMembers(), loadSubcontractors(), loadSchedules()]);
  }, [loadCrewMembers, loadSubcontractors, loadSchedules]);

  useEffect(() => {
    setIsLoading(true);
    reloadAll().finally(() => setIsLoading(false));
  }, [reloadAll]);

  // ── Summary stats ─────────────────────────────────────────────────────────

  const totalAssignments = schedules.length;
  const scheduledMemberIds = new Set(schedules.map(s => s.crew_member_id));
  const crewScheduledCount = scheduledMemberIds.size;
  const totalSlots = crewMembers.length * 7;
  const openSlots = Math.max(0, totalSlots - totalAssignments);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getSchedulesFor = (crewMemberId: string, date: string): CrewSchedule[] =>
    schedules.filter(s => s.crew_member_id === crewMemberId && s.scheduled_date === date);

  const openModal = (member: CrewRow, date: string, existing?: CrewSchedule) => {
    setModalCrewMember(member);
    setModalDate(date);
    setModalExisting(existing ?? null);
    setModalOpen(true);
  };

  const prevWeek = () => { const d = new Date(anchorDate); d.setDate(d.getDate() - 7); setAnchorDate(d); };
  const nextWeek = () => { const d = new Date(anchorDate); d.setDate(d.getDate() + 7); setAnchorDate(d); };
  const goToday = () => setAnchorDate(new Date());

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Users size={20} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Crew Schedule</h1>
              <p className="text-sm text-gray-500">Weekly crew assignment calendar</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Manage Subcontractors toggle */}
            <button
              onClick={() => setShowSubManager(v => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                showSubManager
                  ? 'bg-orange-50 border-orange-300 text-orange-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <HardHat size={15} />
              Manage Subcontractors
            </button>

            {/* Week navigation */}
            <button onClick={prevWeek} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-600">
              <ChevronLeft size={16} />
            </button>
            <button onClick={goToday} className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
              Today
            </button>
            <button onClick={nextWeek} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-600">
              <ChevronRight size={16} />
            </button>
            <span className="text-sm font-medium text-gray-700 ml-1">
              {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' – '}
              {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 max-w-2xl">
          <div className="flex items-center gap-3 bg-blue-50 rounded-lg px-4 py-3">
            <BarChart3 size={18} className="text-blue-600 shrink-0" />
            <div>
              <p className="text-xs text-blue-600 font-medium">Total Assignments</p>
              <p className="text-xl font-bold text-blue-700">{totalAssignments}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-green-50 rounded-lg px-4 py-3">
            <Users size={18} className="text-green-600 shrink-0" />
            <div>
              <p className="text-xs text-green-600 font-medium">Crew Scheduled</p>
              <p className="text-xl font-bold text-green-700">{crewScheduledCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <Clock size={18} className="text-gray-500 shrink-0" />
            <div>
              <p className="text-xs text-gray-500 font-medium">Open Slots</p>
              <p className="text-xl font-bold text-gray-700">{openSlots}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Subcontractor manager panel (collapsible) */}
      {showSubManager && (
        <div className="px-6 pt-4">
          <SubcontractorManager
            companyId={profile?.company_id ?? ''}
            subcontractors={subcontractors}
            onReload={() => {
              loadSubcontractors();
              loadCrewMembers();
            }}
          />
        </div>
      )}

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={32} className="animate-spin text-blue-500" />
          </div>
        ) : crewMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
            <Users size={40} className="opacity-40" />
            <p className="text-sm">No crew members found.</p>
            <p className="text-xs">Add subcontractors using the button above, or invite team members.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Header row */}
            <div
              className="grid border-b border-gray-200 bg-gray-50"
              style={{ gridTemplateColumns: '200px repeat(7, minmax(120px, 1fr))' }}
            >
              <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">
                Crew Member
              </div>
              {weekDates.map(date => (
                <div
                  key={toISO(date)}
                  className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide border-r last:border-r-0 border-gray-200 ${
                    isToday(date) ? 'bg-blue-50 text-blue-700' : 'text-gray-500'
                  }`}
                >
                  {formatHeaderDate(date)}
                  {isToday(date) && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-blue-500 align-middle" />}
                </div>
              ))}
            </div>

            {/* Crew rows */}
            {crewMembers.map((member, memberIdx) => (
              <div
                key={member.id}
                className={`grid border-b last:border-b-0 border-gray-100 ${
                  memberIdx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'
                }`}
                style={{ gridTemplateColumns: '200px repeat(7, minmax(120px, 1fr))' }}
              >
                {/* Name cell */}
                <div className="px-4 py-3 flex items-center gap-2.5 border-r border-gray-200 min-h-[72px]">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 uppercase ${
                      member.type === 'subcontractor'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {member.full_name?.charAt(0) ?? '?'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-gray-900 truncate">{member.full_name}</p>
                      {member.type === 'subcontractor' && (
                        <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-100 text-orange-600 text-xs rounded-full font-medium">
                          <HardHat size={9} />
                          Sub
                        </span>
                      )}
                    </div>
                    {member.type === 'internal' && member.role && (
                      <p className="text-xs text-gray-400 capitalize truncate">{member.role}</p>
                    )}
                    {member.type === 'subcontractor' && member.trade && (
                      <p className="text-xs text-orange-400 truncate">{member.trade}</p>
                    )}
                  </div>
                </div>

                {/* Day cells */}
                {weekDates.map(date => {
                  const dateStr = toISO(date);
                  const daySchedules = getSchedulesFor(member.id, dateStr);
                  const hasConflict = daySchedules.length > 1;
                  const firstSchedule = daySchedules[0] ?? null;

                  return (
                    <div
                      key={dateStr}
                      onClick={() => openModal(member, dateStr, firstSchedule ?? undefined)}
                      className={`px-2 py-2 border-r last:border-r-0 border-gray-100 min-h-[72px] cursor-pointer group transition-colors ${
                        isToday(date) ? 'bg-blue-50/30' : 'hover:bg-gray-50'
                      } ${!firstSchedule ? 'hover:bg-blue-50/20' : ''}`}
                    >
                      {firstSchedule ? (
                        <div className="space-y-1">
                          {hasConflict && (
                            <div className="flex items-center gap-1 text-amber-600 text-xs font-medium mb-1">
                              <AlertTriangle size={11} />
                              <span>{daySchedules.length} assignments</span>
                            </div>
                          )}
                          <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">{firstSchedule.title}</p>
                          <StatusBadge status={firstSchedule.status} />
                          {(firstSchedule.start_time || firstSchedule.end_time) && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                              <Clock size={10} />
                              {firstSchedule.start_time ?? '—'}{firstSchedule.end_time ? ` – ${firstSchedule.end_time}` : ''}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus size={16} className="text-gray-400" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assignment modal */}
      {modalOpen && modalCrewMember && (
        <AssignmentModal
          crewMemberId={modalCrewMember.id}
          crewMemberName={modalCrewMember.full_name}
          date={modalDate}
          existing={modalExisting}
          contacts={state.contacts}
          onClose={() => setModalOpen(false)}
          onSaved={loadSchedules}
          companyId={profile?.company_id ?? ''}
          userId={profile?.id ?? ''}
          hasConflict={getSchedulesFor(modalCrewMember.id, modalDate).length > 0}
        />
      )}
    </div>
  );
}

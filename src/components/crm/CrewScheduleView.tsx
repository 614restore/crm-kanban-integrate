import React, { useState, useEffect, useCallback } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
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
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────

type ScheduleStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

interface CrewSchedule {
  id: string;
  company_id: string;
  crew_member_id: string;
  job_id?: string | null;
  contact_id?: string | null;
  title: string;
  notes?: string | null;
  scheduled_date: string; // YYYY-MM-DD
  start_time?: string | null;
  end_time?: string | null;
  status: ScheduleStatus;
  created_by?: string | null;
}

interface CrewMemberRow {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  role?: string | null;
  phone?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekDates(anchorDate: Date): Date[] {
  const d = new Date(anchorDate);
  const day = d.getDay(); // 0=Sun
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

// ─── Assignment Modal ─────────────────────────────────────────────────────────

interface AssignmentModalProps {
  crewMemberId: string;
  crewMemberName: string;
  date: string; // YYYY-MM-DD
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
        const { error } = await supabase
          .from('crew_schedules')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
        toast.success('Assignment updated');
      } else {
        const { error } = await supabase
          .from('crew_schedules')
          .insert(payload);
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
      const { error } = await supabase
        .from('crew_schedules')
        .delete()
        .eq('id', existing.id);
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
        {/* Header */}
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

        {/* Conflict warning */}
        {hasConflict && !existing && (
          <div className="mx-6 mt-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-700 text-sm">
            <AlertTriangle size={15} className="shrink-0" />
            This crew member already has an assignment on this day.
          </div>
        )}

        {/* Form */}
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
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as ScheduleStatus)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Any additional notes…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
          <div>
            {existing && (
              <button
                onClick={handleDelete}
                disabled={isSaving}
                className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving && <Loader2 size={14} className="animate-spin" />}
              {existing ? 'Save Changes' : 'Add Assignment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CrewScheduleView({ contactFilterId }: { contactFilterId?: string }) {
  const { state } = useCRM();
  const { profile } = useAuth();

  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [crewMembers, setCrewMembers] = useState<CrewMemberRow[]>([]);
  const [schedules, setSchedules] = useState<CrewSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usesCrewMembersTable, setUsesCrewMembersTable] = useState(true);

  // Add crew modal state
  const [showAddCrewModal, setShowAddCrewModal] = useState(false);
  const [newCrewName, setNewCrewName] = useState('');
  const [newCrewRole, setNewCrewRole] = useState('Crew');
  const [newCrewPhone, setNewCrewPhone] = useState('');
  const [isAddingCrew, setIsAddingCrew] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCrewMember, setModalCrewMember] = useState<CrewMemberRow | null>(null);
  const [modalDate, setModalDate] = useState<string>('');
  const [modalExisting, setModalExisting] = useState<CrewSchedule | null>(null);

  const weekDates = getWeekDates(anchorDate);
  const weekStart = toISO(weekDates[0]);
  const weekEnd = toISO(weekDates[6]);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadCrewMembers = useCallback(async () => {
    if (!profile?.company_id) return;
    const crewResult = await supabase
      .from('crew_members')
      .select('id, name, role, phone, is_active')
      .eq('company_id', profile.company_id)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (!crewResult.error) {
      const mapped = (crewResult.data ?? []).map((row: any) => ({
        id: row.id,
        full_name: row.name,
        role: row.role,
        phone: row.phone,
      })) as CrewMemberRow[];
      setUsesCrewMembersTable(true);
      setCrewMembers(mapped);
      return;
    }

    // Legacy fallback for older databases without crew_members table.
    const relationMissing = (crewResult.error as any)?.code === '42P01';
    if (!relationMissing) {
      console.error('Error loading crew members:', crewResult.error);
      toast.error('Failed to load crew members');
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('company_id', profile.company_id);

    if (error) {
      console.error('Error loading crew members (legacy):', error);
      toast.error('Failed to load crew members');
      return;
    }

    const mapped = (data ?? []).map((row: any) => {
      const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
      return {
        id: row.id,
        full_name: fullName || row.full_name || row.email || 'Crew Member',
        avatar_url: row.avatar_url ?? null,
        role: row.role ?? null,
        phone: row.phone ?? null,
      } as CrewMemberRow;
    }).sort((a, b) => a.full_name.localeCompare(b.full_name));

    setUsesCrewMembersTable(false);
    setCrewMembers(mapped);
  }, [profile?.company_id]);

  const handleAddCrewMember = async () => {
    if (!profile?.company_id) {
      toast.error('No company context available. Please refresh and try again.');
      return;
    }

    if (!usesCrewMembersTable) {
      toast.error('Please run the latest crew_members migration before adding non-app crews.');
      return;
    }

    const name = newCrewName.trim();
    if (!name) {
      toast.error('Crew name is required');
      return;
    }

    setIsAddingCrew(true);
    try {
      const { error } = await supabase
        .from('crew_members')
        .insert({
          company_id: profile.company_id,
          name,
          role: newCrewRole.trim() || 'Crew',
          phone: newCrewPhone.trim() || null,
          is_active: true,
          created_by: profile.id || null,
        });

      if (error) throw error;

      toast.success('Crew member added');
      setShowAddCrewModal(false);
      setNewCrewName('');
      setNewCrewRole('Crew');
      setNewCrewPhone('');
      await loadCrewMembers();
    } catch (err) {
      console.error('Error adding crew member:', err);
      toast.error('Failed to add crew member');
    } finally {
      setIsAddingCrew(false);
    }
  };

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

  useEffect(() => {
    setIsLoading(true);
    Promise.all([loadCrewMembers(), loadSchedules()]).finally(() => setIsLoading(false));
  }, [loadCrewMembers, loadSchedules]);

  // ── Summary stats ─────────────────────────────────────────────────────────

  const totalAssignments = schedules.length;
  const scheduledMemberIds = new Set(schedules.map(s => s.crew_member_id));
  const crewScheduledCount = scheduledMemberIds.size;
  const totalSlots = crewMembers.length * 7;
  const openSlots = totalSlots - totalAssignments;

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getSchedulesFor = (crewMemberId: string, date: string): CrewSchedule[] =>
    schedules.filter(s => s.crew_member_id === crewMemberId && s.scheduled_date === date);

  const openModal = (member: CrewMemberRow, date: string, existing?: CrewSchedule) => {
    setModalCrewMember(member);
    setModalDate(date);
    setModalExisting(existing ?? null);
    setModalOpen(true);
  };

  // ── Navigation ────────────────────────────────────────────────────────────

  const prevWeek = () => {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() - 7);
    setAnchorDate(d);
  };

  const nextWeek = () => {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() + 7);
    setAnchorDate(d);
  };

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

          {/* Week navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddCrewModal(true)}
              className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
              <Plus size={14} />
              Add Crew
            </button>
            <button
              onClick={prevWeek}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-gray-600"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={goToday}
              className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
            >
              Today
            </button>
            <button
              onClick={nextWeek}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-gray-600"
            >
              <ChevronRight size={16} />
            </button>
            <span className="text-sm font-medium text-gray-700 ml-1">
              {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' – '}
              {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* This Week summary */}
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
              <p className="text-xl font-bold text-gray-700">{openSlots < 0 ? 0 : openSlots}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={32} className="animate-spin text-blue-500" />
          </div>
        ) : crewMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
            <Users size={40} className="opacity-40" />
            <p className="text-sm">No crew members found for your company.</p>
            <button
              onClick={() => setShowAddCrewModal(true)}
              className="px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Crew Member
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Header row */}
            <div
              className="grid border-b border-gray-200 bg-gray-50"
              style={{ gridTemplateColumns: '180px repeat(7, minmax(120px, 1fr))' }}
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
                  {isToday(date) && (
                    <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-blue-500 align-middle" />
                  )}
                </div>
              ))}
            </div>

            {/* Crew rows */}
            {crewMembers.map((member, memberIdx) => (
              <div
                key={member.id}
                className={`grid border-b last:border-b-0 border-gray-100 ${memberIdx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}`}
                style={{ gridTemplateColumns: '180px repeat(7, minmax(120px, 1fr))' }}
              >
                {/* Crew member name cell */}
                <div className="px-4 py-3 flex items-center gap-2.5 border-r border-gray-200 min-h-[72px]">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold shrink-0 uppercase">
                    {member.full_name?.charAt(0) ?? '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{member.full_name}</p>
                    {member.role && (
                      <p className="text-xs text-gray-400 capitalize truncate">{member.role}</p>
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
                          {/* Conflict badge */}
                          {hasConflict && (
                            <div className="flex items-center gap-1 text-amber-600 text-xs font-medium mb-1">
                              <AlertTriangle size={11} />
                              <span>{daySchedules.length} assignments</span>
                            </div>
                          )}
                          <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">
                            {firstSchedule.title}
                          </p>
                          <StatusBadge status={firstSchedule.status} />
                          {(firstSchedule.start_time || firstSchedule.end_time) && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                              <Clock size={10} />
                              {firstSchedule.start_time ?? '—'}
                              {firstSchedule.end_time ? ` – ${firstSchedule.end_time}` : ''}
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

      {/* Add crew modal */}
      {showAddCrewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Add Crew Member</h2>
              <button
                onClick={() => setShowAddCrewModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {!usesCrewMembersTable && (
                <div className="text-sm bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-3 py-2">
                  Database upgrade required: run the latest `crew_members` migration to add non-app crews.
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Crew Name</label>
                <input
                  type="text"
                  value={newCrewName}
                  onChange={e => setNewCrewName(e.target.value)}
                  placeholder="e.g., Luis Roofing Crew"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <input
                    type="text"
                    value={newCrewRole}
                    onChange={e => setNewCrewRole(e.target.value)}
                    placeholder="Crew"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newCrewPhone}
                    onChange={e => setNewCrewPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowAddCrewModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCrewMember}
                disabled={isAddingCrew || !usesCrewMembersTable}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isAddingCrew && <Loader2 size={14} className="animate-spin" />}
                Save Crew
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

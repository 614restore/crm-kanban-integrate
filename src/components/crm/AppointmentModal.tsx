import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { Appointment, Contact } from '@/lib/crmData';
import { db } from '@/lib/database';
import {
  getMentionTargets,
  getMentionSuggestions,
  findActiveMentionQuery,
  applyMention,
  validateMentions,
  extractMentionHandles,
} from '@/lib/mentions';
import { toast } from 'sonner';
import {
  X,
  Calendar,
  Clock,
  User,
  MapPin,
  FileText,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: Date;
  preselectedContactId?: string;
  editingAppointment?: Appointment | null;
}

const appointmentTypeOptions = [
  { value: 'inspection', label: 'Inspection' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'installation', label: 'Installation' },
  { value: 'final_walkthrough', label: 'Final Walkthrough' },
];

const durationOptions = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
  { value: 180, label: '3 hours' },
  { value: 240, label: '4 hours' },
];

const timeSlots: string[] = [];
for (let h = 6; h <= 20; h++) {
  for (let m = 0; m < 60; m += 15) {
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    timeSlots.push(`${hh}:${mm}`);
  }
}

function formatTimeLabel(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${minutes} ${ampm}`;
}

export default function AppointmentModal({
  isOpen,
  onClose,
  selectedDate,
  preselectedContactId,
  editingAppointment,
}: AppointmentModalProps) {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const effectiveCompanyId = state.companyId || profile?.company_id;
  const mentionTargets = useMemo(
    () => getMentionTargets(state.teamMembers),
    [state.teamMembers]
  );

  const defaultDate = selectedDate
    ? selectedDate.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const [title, setTitle] = useState(editingAppointment?.title || '');
  const [type, setType] = useState(editingAppointment?.type || 'inspection');
  const [date, setDate] = useState(editingAppointment?.date || defaultDate);
  const [time, setTime] = useState(editingAppointment?.time || '09:00');
  const [duration, setDuration] = useState(editingAppointment?.duration || 60);
  const [contactId, setContactId] = useState(
    editingAppointment?.contactId || preselectedContactId || ''
  );
  const [assignedTo, setAssignedTo] = useState(editingAppointment?.assignedTo || '');
  const [location, setLocation] = useState(editingAppointment?.location || '');
  const [notes, setNotes] = useState(editingAppointment?.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  // Mention state
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<{ start: number; query: string } | null>(null);
  const [mentionSuggestions, setMentionSuggestionsState] = useState<
    ReturnType<typeof getMentionTargets>
  >([]);
  const [mentionIndex, setMentionIndex] = useState(0);

  // Prefill location from contact address
  useEffect(() => {
    if (contactId && !location) {
      const contact = state.contacts.find((c) => c.id === contactId);
      if (contact?.address) {
        const addr = [contact.address, contact.city, contact.state, contact.zip]
          .filter(Boolean)
          .join(', ');
        setLocation(addr);
      }
    }
  }, [contactId]);

  // Reset form when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      if (editingAppointment) {
        setTitle(editingAppointment.title);
        setType(editingAppointment.type);
        setDate(editingAppointment.date);
        setTime(editingAppointment.time);
        setDuration(editingAppointment.duration);
        setContactId(editingAppointment.contactId);
        setAssignedTo(editingAppointment.assignedTo);
        setLocation(editingAppointment.location || '');
        setNotes(editingAppointment.notes || '');
      } else {
        setTitle('');
        setType('inspection');
        setDate(selectedDate ? selectedDate.toISOString().split('T')[0] : defaultDate);
        setTime('09:00');
        setDuration(60);
        setContactId(preselectedContactId || '');
        setAssignedTo('');
        setLocation('');
        setNotes('');
      }
    }
  }, [isOpen, editingAppointment, selectedDate, preselectedContactId]);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotes(val);

    const caret = e.target.selectionStart || 0;
    const active = findActiveMentionQuery(val, caret);
    if (active) {
      setMentionQuery(active);
      const suggestions = getMentionSuggestions(mentionTargets, active.query);
      setMentionSuggestionsState(suggestions);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
      setMentionSuggestionsState([]);
    }
  };

  const handleNotesKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mentionQuery || mentionSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % mentionSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex((i) => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      applySelectedMention(mentionSuggestions[mentionIndex]);
    } else if (e.key === 'Escape') {
      setMentionQuery(null);
      setMentionSuggestionsState([]);
    }
  };

  const applySelectedMention = (target: (typeof mentionTargets)[0]) => {
    if (!mentionQuery || !notesRef.current) return;
    const result = applyMention(notes, mentionQuery.start, notesRef.current?.selectionStart ?? notes.length, target.handle);
    setNotes(result.text);
    setMentionQuery(null);
    setMentionSuggestionsState([]);

    // Restore focus and caret
    setTimeout(() => {
      if (notesRef.current) {
        notesRef.current.focus();
        notesRef.current.selectionStart = result.caret;
        notesRef.current.selectionEnd = result.caret;
      }
    }, 0);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Please enter an appointment title');
      return;
    }
    if (!contactId) {
      toast.error('Please select a customer');
      return;
    }
    if (!date) {
      toast.error('Please select a date');
      return;
    }
    if (!time) {
      toast.error('Please select a time');
      return;
    }

    // Validate mentions
    const { invalid } = validateMentions(notes, mentionTargets);
    if (invalid.length > 0) {
      toast.error(`Unknown mention(s): ${invalid.map((h) => `@${h}`).join(', ')}`);
      return;
    }

    if (!effectiveCompanyId) {
      toast.error('No company selected. Please refresh and sign in again.');
      return;
    }

    setIsSaving(true);

    try {
      const contact = state.contacts.find((c) => c.id === contactId);
      const contactName = contact
        ? `${contact.firstName} ${contact.lastName}`
        : 'Unknown';

      if (editingAppointment) {
        // Update existing
        const updated = await db.updateAppointment(editingAppointment.id, {
          title: title.trim(),
          type,
          date,
          time,
          duration,
          contact_id: contactId,
          assigned_to: assignedTo || undefined,
          location: location || undefined,
          notes: notes.trim() || undefined,
          status: editingAppointment.status,
        });

        if (!updated) {
          toast.error('Failed to update appointment');
          return;
        }

        const updatedApp: Appointment = {
          ...editingAppointment,
          title: title.trim(),
          type: type as Appointment['type'],
          date,
          time,
          duration,
          contactId,
          contactName,
          assignedTo: assignedTo || '',
          location: location || '',
          notes: notes.trim() || undefined,
        };

        dispatch({ type: 'UPDATE_APPOINTMENT', payload: updatedApp });
        toast.success('Appointment updated');

        // Fire mention notifications for anyone @tagged in the notes
        if (notes.trim()) {
          const handles = extractMentionHandles(notes);
          for (const handle of handles) {
            const target = mentionTargets.find(
              (t) => t.handle.toLowerCase() === handle.toLowerCase()
            );
            if (target) {
              await db.createNotification({
                company_id: effectiveCompanyId,
                user_id: target.id,
                type: 'mention',
                title: 'You were tagged in an appointment',
                message: `You were mentioned in appointment "${title.trim()}" with ${contactName} on ${date}.`,
                related_id: editingAppointment.id,
                related_type: 'appointment',
                read: false,
              });
            }
          }
        }
      } else {
        // Create new
        const created = await db.createAppointment({
          company_id: effectiveCompanyId,
          contact_id: contactId,
          title: title.trim(),
          type,
          date,
          time,
          duration,
          assigned_to: assignedTo || undefined,
          location: location || undefined,
          notes: notes.trim() || undefined,
          status: 'scheduled',
        });

        if (!created) {
          toast.error('A booking already exists at that date and time. Please choose a different time slot.');
          return;
        }

        const newAppointment: Appointment = {
          id: created.id,
          contactId,
          contactName,
          title: title.trim(),
          type: type as Appointment['type'],
          date,
          time,
          duration,
          assignedTo: assignedTo || '',
          location: location || '',
          notes: notes.trim() || undefined,
          status: 'scheduled',
        };

        dispatch({ type: 'ADD_APPOINTMENT', payload: newAppointment });

        // When any appointment is created for a prospect or lead, advance them to appt_set
        // so the contact card moves to the Appt Set column on the board automatically
        if (contact) {
          const shouldAdvanceStatus =
            contact.status === 'prospect' || contact.status === 'lead';
          if (shouldAdvanceStatus) {
            db.updateContact(contactId, { status: 'appt_set', status_changed_at: new Date().toISOString() }).catch(
              (err) => console.error('Failed to update contact status:', err)
            );
            dispatch({
              type: 'UPDATE_CONTACT_STATUS',
              payload: { contactId, status: 'appt_set' },
            });
          }
        }

        // If no assignee, create unassigned notification
        if (!assignedTo) {
          const notification = await db.createNotification({
            company_id: effectiveCompanyId,
            type: 'unassigned_appointment',
            title: 'Unassigned Appointment',
            message: `"${title.trim()}" with ${contactName} on ${date} at ${formatTimeLabel(time)} has no team member assigned.`,
            related_id: created.id,
            related_type: 'appointment',
            read: false,
          });

          if (notification) {
            dispatch({
              type: 'ADD_NOTIFICATION',
              payload: {
                id: notification.id,
                type: 'warning',
                title: 'Unassigned Appointment',
                message: `"${title.trim()}" with ${contactName} needs to be assigned to a team member.`,
                timestamp: notification.created_at,
                read: false,
                kind: 'unassigned_appointment',
                relatedType: 'appointment',
                relatedId: created.id,
              },
            });
          }
        }

        // If notes have @mentions, create mention notifications
        if (notes.trim()) {
          const handles = extractMentionHandles(notes);
          for (const handle of handles) {
            const target = mentionTargets.find(
              (t) => t.handle.toLowerCase() === handle.toLowerCase()
            );
            if (target) {
              await db.createNotification({
                company_id: effectiveCompanyId,
                user_id: target.id,
                type: 'mention',
                title: 'You were tagged in an appointment',
                message: `You were mentioned in appointment "${title.trim()}" with ${contactName} on ${date}.`,
                related_id: created.id,
                related_type: 'appointment',
                read: false,
              });
            }
          }
        }

        toast.success('Appointment scheduled');
      }

      onClose();
    } catch (err) {
      console.error('Error saving appointment:', err);
      const msg = err instanceof Error ? err.message : 'Failed to save appointment';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {editingAppointment ? 'Edit Appointment' : 'Schedule Appointment'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {date
                ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Select a date'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Initial Inspection, Estimate Review"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              {appointmentTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Customer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer <span className="text-red-500">*</span>
            </label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="">Select a customer...</option>
              {state.contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                  {c.phone1 ? ` — ${c.phone1}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar size={14} className="inline mr-1" />
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Clock size={14} className="inline mr-1" />
                Time <span className="text-red-500">*</span>
              </label>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              >
                {timeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {formatTimeLabel(slot)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              {durationOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Assign to team member */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User size={14} className="inline mr-1" />
              Assign To
            </label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="">Unassigned</option>
              {state.teamMembers.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name} ({tm.role})
                </option>
              ))}
            </select>
            {!assignedTo && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle size={12} />
                Leaving unassigned will create an alert notification
              </p>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin size={14} className="inline mr-1" />
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Address or meeting location"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Notes with @mention support */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FileText size={14} className="inline mr-1" />
              Notes
              <span className="text-xs text-gray-400 ml-2">
                Type @ to tag team members
              </span>
            </label>
            <textarea
              ref={notesRef}
              value={notes}
              onChange={handleNotesChange}
              onKeyDown={handleNotesKeyDown}
              rows={3}
              placeholder="Add notes... Use @name to tag team members"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
            />

            {/* Mention suggestions dropdown */}
            {mentionQuery && mentionSuggestions.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                {mentionSuggestions.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => applySelectedMention(s)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                      i === mentionIndex
                        ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="font-medium">@{s.handle}</span>
                    <span className="text-gray-400 text-xs">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving
              ? 'Saving...'
              : editingAppointment
              ? 'Update Appointment'
              : 'Schedule Appointment'}
          </button>
        </div>
      </div>
    </div>
  );
}

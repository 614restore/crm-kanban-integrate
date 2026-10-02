// The customer's next appointment, at the top of their page so it is the first thing seen. It takes the
// same color as their name; a missed one is red and says what to do about it.
import React from 'react';
import { CalendarClock, CalendarPlus, ExternalLink, MapPin, User } from 'lucide-react';
import { useCRM } from '@/lib/crmStore';
import { useContactSchedule } from '@/hooks/useScheduleMap';
import {
  ORANGE_WITHIN_HOURS,
  URGENCY_STYLE,
  YELLOW_WITHIN_HOURS,
  describeTimeUntil,
} from '@/lib/appointmentUrgency';

const TYPE_LABEL: Record<string, string> = {
  inspection: 'Inspection',
  estimate: 'Estimate',
  follow_up: 'Follow-up',
  installation: 'Installation',
  final_walkthrough: 'Final walkthrough',
};

export default function NextAppointmentCard({ contactId }: { contactId: string }) {
  const { state, dispatch } = useCRM();
  const schedule = useContactSchedule(contactId);

  const openCalendar = (appointmentId: string | null) => {
    if (appointmentId) dispatch({ type: 'SET_PENDING_APPOINTMENT_ID', payload: appointmentId });
    else dispatch({ type: 'SET_PENDING_APPOINTMENT_CONTACT', payload: contactId });
    dispatch({ type: 'SET_VIEW', payload: 'calendar' });
  };

  if (!schedule) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3">
        <p className="flex items-center gap-2 text-sm text-gray-600">
          <CalendarClock size={16} className="text-gray-400" /> No appointment scheduled for this customer.
        </p>
        <button
          type="button"
          onClick={() => openCalendar(null)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          <CalendarPlus size={15} /> Schedule one
        </button>
      </div>
    );
  }

  const { appointment: apt, start, urgency, missed, missedCount, msUntilStart } = schedule;
  const style = URGENCY_STYLE[urgency];
  const rep = state.teamMembers.find((tm) => tm.id === apt.assignedTo);
  const when = start.toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <div className={`mb-4 rounded-xl border p-4 ${style.bg} ${style.border}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${style.text}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
            {missed ? 'Missed appointment' : 'Next appointment'} · {describeTimeUntil(msUntilStart)}
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {apt.title || TYPE_LABEL[apt.type] || 'Appointment'}
            {apt.title && TYPE_LABEL[apt.type] && !apt.title.toLowerCase().includes(TYPE_LABEL[apt.type].toLowerCase())
              ? <span className="ml-2 text-sm font-normal text-gray-500">{TYPE_LABEL[apt.type]}</span>
              : null}
          </p>
          <p className="text-sm text-gray-700">{when}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
            {rep && <span className="inline-flex items-center gap-1"><User size={13} /> {rep.name}</span>}
            {apt.location && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {apt.location}</span>}
          </div>
          {missed && (
            <p className="mt-2 text-sm text-red-700">
              This appointment's time passed and it was never marked complete, cancelled or rescheduled
              {missedCount > 1 ? ` (${missedCount} appointments are in this state)` : ''}. Open it in the calendar to move the job forward.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => openCalendar(apt.id)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white ${missed ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          <ExternalLink size={14} /> {missed ? 'Fix in calendar' : 'Open in calendar'}
        </button>
      </div>
      <p className="mt-3 text-[11px] text-gray-500">
        Name colors across the app:{' '}
        <span className="text-emerald-700 font-medium">green</span> more than {YELLOW_WITHIN_HOURS / 24} days away ·{' '}
        <span className="text-yellow-700 font-medium">yellow</span> within {YELLOW_WITHIN_HOURS / 24} days ·{' '}
        <span className="text-orange-600 font-medium">orange</span> within {ORANGE_WITHIN_HOURS} hours ·{' '}
        <span className="text-red-600 font-medium">red</span> time passed, not completed.
      </p>
    </div>
  );
}

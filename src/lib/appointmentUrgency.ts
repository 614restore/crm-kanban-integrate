// How close a customer is to their next appointment, as a color.
//
//   green   more than two days away
//   yellow  within two days
//   orange  within 12 hours
//   red     the time has passed and the appointment was never completed, cancelled or rescheduled
//
// "Missed" matches the calendar's own definition: still `scheduled`, and its start time is in the past.
// Only appointments still `scheduled` count; once one is completed, cancelled or rescheduled it is no
// longer waiting on anyone. Customers whose job is finished or lost are not colored at all, so old
// appointments that were never tidied up cannot leave a closed customer red forever.
import type { Appointment, Contact } from '@/lib/crmData';

export type Urgency = 'green' | 'yellow' | 'orange' | 'red';

/** Where the colors change. Hours before the appointment's start. */
export const YELLOW_WITHIN_HOURS = 48;
export const ORANGE_WITHIN_HOURS = 12;

const HOUR = 3600e3;

/** Customer statuses for which appointment colors are not shown. */
const FINISHED_STATUSES = new Set(['completed', 'paid', 'lost', 'cancelled', 'closed']);

export function appointmentStart(appointment: Appointment): Date | null {
  const raw = appointment.date?.trim();
  if (!raw) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T${appointment.time?.trim() || '00:00'}`)
    : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function urgencyForMs(msUntilStart: number): Urgency {
  if (msUntilStart <= 0) return 'red';
  if (msUntilStart <= ORANGE_WITHIN_HOURS * HOUR) return 'orange';
  if (msUntilStart <= YELLOW_WITHIN_HOURS * HOUR) return 'yellow';
  return 'green';
}

export interface ContactSchedule {
  urgency: Urgency;
  /** The appointment that sets the color: the longest-overdue missed one, else the soonest coming one. */
  appointment: Appointment;
  start: Date;
  missed: boolean;
  /** How many scheduled appointments have passed without being completed. */
  missedCount: number;
  msUntilStart: number;
}

/** The schedule state for one customer, from that customer's appointments. Null when nothing is waiting. */
export function scheduleFor(appointments: Appointment[], now: Date = new Date()): ContactSchedule | null {
  const waiting = appointments
    .filter((a) => a.status === 'scheduled')
    .map((appointment) => ({ appointment, start: appointmentStart(appointment) }))
    .filter((x): x is { appointment: Appointment; start: Date } => x.start !== null)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  if (waiting.length === 0) return null;

  const missed = waiting.filter((x) => x.start.getTime() <= now.getTime());
  const chosen = missed.length > 0
    ? missed[0] // earliest first: the one that has been outstanding longest
    : waiting[0];
  const msUntilStart = chosen.start.getTime() - now.getTime();
  return {
    urgency: urgencyForMs(msUntilStart),
    appointment: chosen.appointment,
    start: chosen.start,
    missed: missed.length > 0,
    missedCount: missed.length,
    msUntilStart,
  };
}

/** The schedule state for every customer that has one, keyed by customer id. */
export function buildScheduleMap(
  appointments: Appointment[],
  contacts: Pick<Contact, 'id' | 'status'>[],
  now: Date = new Date(),
): Map<string, ContactSchedule> {
  const finished = new Set(contacts.filter((c) => FINISHED_STATUSES.has(String(c.status))).map((c) => c.id));
  const byContact = new Map<string, Appointment[]>();
  for (const a of appointments) {
    if (!a.contactId || finished.has(a.contactId)) continue;
    const list = byContact.get(a.contactId);
    if (list) list.push(a); else byContact.set(a.contactId, [a]);
  }
  const out = new Map<string, ContactSchedule>();
  byContact.forEach((list, id) => {
    const s = scheduleFor(list, now);
    if (s) out.set(id, s);
  });
  return out;
}

export const URGENCY_STYLE: Record<Urgency, { text: string; bg: string; border: string; dot: string; label: string }> = {
  green:  { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'More than 2 days away' },
  yellow: { text: 'text-yellow-700',  bg: 'bg-yellow-50',  border: 'border-yellow-300',  dot: 'bg-yellow-500',  label: 'Within 2 days' },
  orange: { text: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-300',  dot: 'bg-orange-500',  label: 'Within 12 hours' },
  red:    { text: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-300',     dot: 'bg-red-500',     label: 'Missed' },
};

/** "in 5 hours", "in 2 days", "3 hours ago" -- coarse on purpose. */
export function describeTimeUntil(ms: number): string {
  const abs = Math.abs(ms);
  const mins = Math.round(abs / 60000);
  let amount: string;
  if (mins < 1) amount = 'less than a minute';
  else if (mins < 60) amount = `${mins} minute${mins === 1 ? '' : 's'}`;
  else if (mins < 48 * 60) { const h = Math.round(mins / 60); amount = `${h} hour${h === 1 ? '' : 's'}`; }
  else { const d = Math.round(mins / 1440); amount = `${d} day${d === 1 ? '' : 's'}`; }
  if (mins < 1) return ms >= 0 ? 'starting now' : 'just passed';
  return ms >= 0 ? `in ${amount}` : `${amount} ago`;
}

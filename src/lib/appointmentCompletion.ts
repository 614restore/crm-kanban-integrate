import type { Dispatch } from 'react';
import { db } from '@/lib/database';
import { fireAutomationEvent } from '@/lib/automationEngine';
import type { Appointment, Contact } from '@/lib/crmData';

/**
 * Notes added to an appointment when its status or time is changed after the fact, so the history of what
 * happened (and why) stays on the appointment. The same wording is used by the calendar's quick "complete"
 * button and by the Edit Appointment form.
 */

const TYPE_LABELS: Record<Appointment['type'], string> = {
  inspection: 'Inspection',
  estimate: 'Estimate',
  follow_up: 'Follow-up',
  installation: 'Installation',
  final_walkthrough: 'Final walkthrough',
};

export const appointmentTypeLabel = (type: Appointment['type']) => TYPE_LABELS[type] ?? 'Appointment';

const today = () =>
  new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** "Sat, Nov 7 at 2:00 PM" from a YYYY-MM-DD date and HH:MM time. */
export function describeSlot(date: string, time: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, m] = time.split(':').map(Number);
  const day = new Date(y, mo - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const hour = h % 12 || 12;
  return `${day} at ${hour}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export const completedNote = (type: Appointment['type']) => `${appointmentTypeLabel(type)} completed on ${today()}`;
export const cancelledNote = (type: Appointment['type']) => `${appointmentTypeLabel(type)} cancelled on ${today()}`;
export const reopenedNote = (type: Appointment['type']) => `${appointmentTypeLabel(type)} set back to scheduled on ${today()}`;

export function rescheduledNote(
  from: { date: string; time: string },
  to: { date: string; time: string },
  reason: string,
): string {
  return `Date changed on ${today()}: from ${describeSlot(from.date, from.time)} to ${describeSlot(to.date, to.time)}. Reason: ${reason.trim()}`;
}

/** Add lines to existing notes, separated by a blank line. */
export const appendNotes = (existing: string | undefined, ...lines: string[]) =>
  [existing?.trim(), ...lines.filter(Boolean)].filter(Boolean).join('\n\n');

/**
 * When an inspection is completed for a customer who was waiting on it, move them forward the same way
 * every other completion does. Safe to call for any appointment: it only acts on inspections.
 */
export function advanceAfterInspection(
  appointment: Appointment,
  contacts: Contact[],
  companyId: string | null | undefined,
  dispatch: Dispatch<any>,
) {
  if (appointment.type !== 'inspection' || !appointment.contactId) return;
  const contact = contacts.find((c) => c.id === appointment.contactId);
  if (!contact || contact.status !== 'appt_set') return;

  db.updateContact(appointment.contactId, {
    status: 'estimating',
    status_changed_at: new Date().toISOString(),
  }).catch((err) => console.error('Failed to advance contact status:', err));
  dispatch({
    type: 'UPDATE_CONTACT_STATUS',
    payload: { contactId: appointment.contactId, status: 'inspection_completed' },
  });
  if (companyId) {
    const base = {
      contactId: contact.id,
      contactName: `${contact.firstName} ${contact.lastName}`.trim(),
      contactEmail: contact.email,
      oldStatus: 'appt_set',
      newStatus: 'estimating',
    };
    fireAutomationEvent('appointment_completed', companyId, base).catch(() => {});
    fireAutomationEvent('contact_status_changed', companyId, base).catch(() => {});
  }
}

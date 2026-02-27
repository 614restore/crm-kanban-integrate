import assert from 'node:assert/strict';
import test from 'node:test';
import type { Appointment } from '../src/lib/crmData';
import { getUpcomingAppointments } from '../src/lib/crmStore';

function makeAppointment(overrides: Partial<Appointment>): Appointment {
  return {
    id: overrides.id || 'apt-1',
    contactId: overrides.contactId || 'c-1',
    contactName: overrides.contactName || 'Test Contact',
    title: overrides.title || 'Test',
    type: overrides.type || 'inspection',
    date: overrides.date || '2026-01-01',
    time: overrides.time || '09:00',
    duration: overrides.duration || 60,
    assignedTo: overrides.assignedTo || 'tm-1',
    location: overrides.location || 'HQ',
    notes: overrides.notes,
    status: overrides.status || 'scheduled',
  };
}

test('includes same-day scheduled appointments for date-only values', () => {
  const now = new Date('2026-02-01T15:30:00.000Z');
  const appointments: Appointment[] = [
    makeAppointment({ id: 'today', date: '2026-02-01', status: 'scheduled' }),
    makeAppointment({ id: 'tomorrow', date: '2026-02-02', status: 'scheduled' }),
    makeAppointment({ id: 'cancelled', date: '2026-02-01', status: 'cancelled' }),
  ];

  const result = getUpcomingAppointments(appointments, now, 2);
  assert.deepEqual(result.map((a) => a.id), ['today', 'tomorrow']);
});

test('excludes appointments outside the requested window', () => {
  const now = new Date('2026-02-01T10:00:00.000Z');
  const appointments: Appointment[] = [
    makeAppointment({ id: 'in-range', date: '2026-02-05', status: 'scheduled' }),
    makeAppointment({ id: 'out-of-range', date: '2026-02-20', status: 'scheduled' }),
  ];

  const result = getUpcomingAppointments(appointments, now, 7);
  assert.deepEqual(result.map((a) => a.id), ['in-range']);
});

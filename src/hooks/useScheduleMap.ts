// Every customer's appointment color, kept current as time passes.
//
// The colors depend on the clock (a yellow appointment turns orange, then red), so this re-renders its
// users about every minute, from one shared timer. The map is built once per change and shared by every
// component that asks, so a list of hundreds of customers does not recompute it per row.
import { useMemo, useSyncExternalStore } from 'react';
import { useCRM } from '@/lib/crmStore';
import { buildScheduleMap, type ContactSchedule } from '@/lib/appointmentUrgency';

const listeners = new Set<() => void>();
let minute = Math.floor(Date.now() / 60000);
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(() => {
      const next = Math.floor(Date.now() / 60000);
      if (next !== minute) {
        minute = next;
        listeners.forEach((l) => l());
      }
    }, 15000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
const getMinute = () => minute;

let last: { a: unknown; c: unknown; m: number; value: Map<string, ContactSchedule> } | null = null;

export function useScheduleMap(): Map<string, ContactSchedule> {
  const { state } = useCRM();
  const m = useSyncExternalStore(subscribe, getMinute, getMinute);
  return useMemo(() => {
    if (last && last.a === state.appointments && last.c === state.contacts && last.m === m) return last.value;
    const value = buildScheduleMap(state.appointments, state.contacts, new Date(m * 60000));
    last = { a: state.appointments, c: state.contacts, m, value };
    return value;
  }, [state.appointments, state.contacts, m]);
}

export function useContactSchedule(contactId: string | null | undefined): ContactSchedule | null {
  const map = useScheduleMap();
  return (contactId && map.get(contactId)) || null;
}

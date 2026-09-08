// Guards against a real bug: click Delete, the row is removed from local
// state immediately, but a background refresh that was ALREADY in flight
// (tab focus, visibility change, the 30s poll, a realtime reconnect) can
// finish moments later with a pre-delete snapshot and dispatch
// INITIALIZE_DATA, which replaces the whole entity array wholesale — silently
// undoing the delete. From the user's side this looks like "I selected
// contacts and clicked delete, but they never leave the list."
//
// Fix: remember an id was just deleted for a short grace window, and have
// loadData's payload construction drop any id still in that window before
// it ever reaches state. A real, later re-fetch (after the window expires)
// correctly reflects reality either way, since the row is genuinely gone
// from the database by then.

const TTL_MS = 60_000;
const tombstones = new Map<string, number>();

export function markDeleted(entity: string, id: string) {
  tombstones.set(`${entity}:${id}`, Date.now() + TTL_MS);
}

export function isRecentlyDeleted(entity: string, id: string): boolean {
  const expiresAt = tombstones.get(`${entity}:${id}`);
  if (expiresAt === undefined) return false;
  if (Date.now() > expiresAt) {
    tombstones.delete(`${entity}:${id}`);
    return false;
  }
  return true;
}

export function filterRecentlyDeleted<T extends {id: string}>(entity: string, rows: T[]): T[] {
  if (tombstones.size === 0) return rows;
  return rows.filter((row) => !isRecentlyDeleted(entity, row.id));
}

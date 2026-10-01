// A storm picked from the storm history, on its way to an insurance claim.
//
// The storm history and the claims live side by side on the Insurance tab but are separate
// components, so the history hands the chosen storm across with a window event (the same
// pattern Storm Search uses for alert links). Whichever claims view is mounted picks it up.

export interface ClaimStorm {
  /** The date of loss, YYYY-MM-DD, in this browser's local time. */
  lossDate: string;
  /** One line describing the storm, kept with the claim for the adjuster. */
  summary: string;
}

export const CLAIM_STORM_EVENT = 'trussctr:claim-storm';
let pending: ClaimStorm | null = null;

export function addStormToClaim(storm: ClaimStorm) {
  pending = storm;
  window.dispatchEvent(new Event(CLAIM_STORM_EVENT));
}

export function takePendingClaimStorm(): ClaimStorm | null {
  const storm = pending;
  pending = null;
  return storm;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The date a storm happened on, as the customer lived it. Radar times are UTC, so an evening
 * storm can already be "tomorrow" in UTC; convert to local time before taking the date.
 * A date with no time (some sources give only a day) is used as given.
 */
export function stormLossDate(date: string, utcTime?: string | null): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  if (!utcTime || !/^\d{2}:\d{2}$/.test(utcTime)) return date;
  const d = new Date(`${date}T${utcTime}:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "May 14, 2026" from YYYY-MM-DD, without the timezone shift new Date('YYYY-MM-DD') would apply. */
export function formatLossDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return ymd;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

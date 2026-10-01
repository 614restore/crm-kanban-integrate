// Opening Storm Search on a tab from anywhere: the sidebar, the top bar, a contact.
import type { Dispatch } from 'react';
import type { CRMAction } from '@/lib/crmStore';
import { focusLiveRadar, focusStormHistory, focusStormSearch, type LiveRadarFocus } from '@/lib/stormReports';
import { geocodeAddress } from '@/lib/geocode';
import { toast } from 'sonner';

/** Live radar, centered on the office unless a place is given. */
export function openLiveRadar(dispatch: Dispatch<CRMAction>, focus: LiveRadarFocus = {}) {
  focusLiveRadar(focus);
  dispatch({ type: 'SET_VIEW', payload: 'storm-search' });
}

export function openStormHistory(dispatch: Dispatch<CRMAction>) {
  focusStormHistory();
  dispatch({ type: 'SET_VIEW', payload: 'storm-search' });
}

// ── Weather for the customer you have open ────────────────────────────────────
// Opening a different screen closes the customer's page, so the address is gone by the time the
// radar or storm data opens. The sidebar and top bar hand the open customer's address across.

type WithAddress = { address?: string | null; city?: string | null; state?: string | null; zip?: string | null };

/** The open customer's property as one line, or null when there is no street address. */
export function propertyOf(contact: WithAddress | null | undefined): { address: string; state: string | null } | null {
  if (!contact?.address?.trim()) return null;
  const address = [contact.address, contact.city, [contact.state, contact.zip].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  return { address, state: contact.state || null };
}

/** Live radar: centered on the customer's address when one is open, otherwise on the office. */
export function openLiveRadarFor(dispatch: Dispatch<CRMAction>, contact?: WithAddress | null) {
  const property = propertyOf(contact);
  openLiveRadar(dispatch, property ? { address: property.address, label: property.address, state: property.state } : {});
}

/** Storm Data: searched around the customer's address when one is open, otherwise left blank. */
export async function openStormHistoryFor(dispatch: Dispatch<CRMAction>, contact?: WithAddress | null) {
  const property = propertyOf(contact);
  if (!property) return openStormHistory(dispatch);
  const found = await geocodeAddress(property.address).catch(() => null);
  if (!found) {
    // Could not place the address: still open Storm Data, and say why it is empty.
    toast.error("Couldn't locate this customer's address, so Storm Data opened blank. Type the address to search.");
    return openStormHistory(dispatch);
  }
  focusStormSearch({ lat: found.lat, lon: found.lon, label: property.address, state: property.state, radiusMiles: 10, months: 12 });
  dispatch({ type: 'SET_VIEW', payload: 'storm-search' });
}

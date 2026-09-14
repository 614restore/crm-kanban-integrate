// Opening Storm Search on a tab from anywhere: the sidebar, the top bar, a contact.
import type { Dispatch } from 'react';
import type { CRMAction } from '@/lib/crmStore';
import { focusLiveRadar, focusStormHistory, type LiveRadarFocus } from '@/lib/stormReports';

/** Live radar, centered on the office unless a place is given. */
export function openLiveRadar(dispatch: Dispatch<CRMAction>, focus: LiveRadarFocus = {}) {
  focusLiveRadar(focus);
  dispatch({ type: 'SET_VIEW', payload: 'storm-search' });
}

export function openStormHistory(dispatch: Dispatch<CRMAction>) {
  focusStormHistory();
  dispatch({ type: 'SET_VIEW', payload: 'storm-search' });
}

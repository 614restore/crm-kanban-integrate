// Where clicking a notification takes you. Notifications record what they are
// about (related_type / related_id); this maps that to the screen for it.
import type { Dispatch } from 'react';
import type { CRMAction } from '@/lib/crmStore';
import { setPendingContactTab } from '@/lib/nextStepActions';
import { focusStormSearch } from '@/lib/stormReports';

export interface NotificationTarget {
  /** The notification's own kind, e.g. hail_event or roofr_report_ready. */
  kind?: string;
  relatedType?: string;
  relatedId?: string;
  /** Extra details saved with the notification, e.g. a storm alert's location. */
  data?: Record<string, any> | null;
}

// Contact notifications open the tab their content lives on.
const CONTACT_TAB_BY_KIND: Record<string, string> = {
  roofr_report_ready: 'documents',
  eagleview_report_ready: 'documents',
  document_viewed: 'documents',
  document_signed: 'documents',
  change_order_signed: 'projects',
  hail_event: 'insurance',
  storm_alert: 'insurance',
};

/** Opens Storm Search on a storm alert's location. Returns false without one. */
export function openStormMap(data: Record<string, any> | null | undefined, dispatch: Dispatch<CRMAction>): boolean {
  const center = data?.center;
  if (typeof center?.lat !== 'number' || typeof center?.lon !== 'number') return false;
  focusStormSearch({
    lat: center.lat,
    lon: center.lon,
    label: center.label ?? null,
    state: center.state ?? null,
    radiusMiles: typeof data?.radiusMiles === 'number' ? data.radiusMiles : null,
    months: typeof data?.months === 'number' ? data.months : 1,
  });
  dispatch({ type: 'SET_VIEW', payload: 'storm-search' });
  return true;
}

/** Opens what the notification is about. Returns false when it has nowhere to go. */
const QUOTE_ALERT_KINDS = new Set(['quote_signed', 'quote_viewed', 'quote_activity', 'quote_executed']);

/** The quote a quote alert is about, from what the alert recorded. */
function quoteAlertTarget(target: NotificationTarget): { quoteId: string; contactId: string } | null {
  if (!target.kind || !QUOTE_ALERT_KINDS.has(target.kind)) return null;
  const quoteId = typeof target.data?.quote_id === 'string' ? target.data.quote_id : null;
  return quoteId && target.relatedId ? { quoteId, contactId: target.relatedId } : null;
}

export function openNotificationTarget(target: NotificationTarget, dispatch: Dispatch<CRMAction>): boolean {
  const { kind, relatedType, relatedId } = target;
  // "Customer signed": open that quote with the countersign window ready. Other quote alerts open the quote.
  const quoteAlert = quoteAlertTarget(target);
  if (quoteAlert) {
    dispatch({
      type: 'SET_PENDING_QUOTE_ACTION',
      payload: { contactId: quoteAlert.contactId, quoteId: quoteAlert.quoteId, action: kind === 'quote_signed' ? 'countersign' : 'preview' },
    });
    dispatch({ type: 'SET_VIEW', payload: 'quotes' });
    return true;
  }
  switch (relatedType) {
    case 'contact':
    case 'customer':
      if (!relatedId) return false;
      setPendingContactTab(CONTACT_TAB_BY_KIND[kind ?? ''] ?? 'overview');
      dispatch({ type: 'SELECT_CONTACT', payload: relatedId });
      return true;
    case 'appointment':
      if (!relatedId) return false;
      dispatch({ type: 'SET_PENDING_APPOINTMENT_ID', payload: relatedId });
      dispatch({ type: 'SET_VIEW', payload: 'calendar' });
      return true;
    case 'stale_leads':
    case 'stale_leads_user':
      dispatch({ type: 'SET_VIEW', payload: 'contacts' });
      return true;
    case 'team':
      dispatch({ type: 'SET_VIEW', payload: 'team' });
      return true;
    case 'storm':
      return openStormMap(target.data, dispatch);
    default:
      return false;
  }
}

/** Label for the button that goes where a notification leads, or null if it leads nowhere. */
export function describeNotificationTarget(target: NotificationTarget): string | null {
  if (quoteAlertTarget(target)) return target.kind === 'quote_signed' ? 'Countersign this quote' : 'Open quote';
  switch (target.relatedType) {
    case 'contact':
    case 'customer':
      return target.relatedId ? 'Open contact' : null;
    case 'appointment':
      return target.relatedId ? 'Open appointment' : null;
    case 'stale_leads':
    case 'stale_leads_user':
      return 'View contacts';
    case 'team':
      return 'Open team';
    case 'storm':
      return target.data?.center ? 'View on storm map' : null;
    default:
      return null;
  }
}

// Where clicking a notification takes you. Notifications record what they are
// about (related_type / related_id); this maps that to the screen for it.
import type { Dispatch } from 'react';
import type { CRMAction } from '@/lib/crmStore';
import { setPendingContactTab } from '@/lib/nextStepActions';

export interface NotificationTarget {
  /** The notification's own kind, e.g. hail_event or roofr_report_ready. */
  kind?: string;
  relatedType?: string;
  relatedId?: string;
}

// Contact notifications open the tab their content lives on.
const CONTACT_TAB_BY_KIND: Record<string, string> = {
  roofr_report_ready: 'documents',
  eagleview_report_ready: 'documents',
  hail_event: 'insurance',
};

/** Opens what the notification is about. Returns false when it has nowhere to go. */
export function openNotificationTarget(target: NotificationTarget, dispatch: Dispatch<CRMAction>): boolean {
  const { kind, relatedType, relatedId } = target;
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
    default:
      return false;
  }
}

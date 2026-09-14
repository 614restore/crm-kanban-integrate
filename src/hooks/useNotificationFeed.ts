// The bell's notification list, shared by the sidebar and the top bar so both
// show the same thing: notifications saved in the database, plus ones raised in
// this session that were never saved.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import type { NotificationTarget } from '@/lib/notificationNavigation';

export interface FeedNotification extends NotificationTarget {
  id: string;
  /** Severity, for the icon. */
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  isDb: boolean;
  /** For note @mentions: the note, whose full text the notification does not keep. */
  noteId?: string;
}

const SEVERITY_BY_KIND: Record<string, FeedNotification['type']> = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  unassigned_appointment: 'warning',
  storm_alert: 'warning',
  storm_area_alert: 'warning',
};

export function useNotificationFeed() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const companyId = state.companyId;
  const userId = profile?.id;
  const [dbRows, setDbRows] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!companyId) return;
    // The company's notifications, plus ones addressed to this user without a
    // company: the notify_note_mentions trigger saves @mentions that way.
    let query = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
    query = userId
      ? query.or(`company_id.eq.${companyId},and(company_id.is.null,user_id.eq.${userId})`)
      : query.eq('company_id', companyId);
    const { data, error } = await query;
    if (error) {
      console.error('[notifications] load failed:', error.message);
      return;
    }
    setDbRows((data || []).filter((n: any) => !n.user_id || n.user_id === userId));
  }, [companyId, userId]);

  useEffect(() => { load(); }, [load]);

  const items = useMemo<FeedNotification[]>(() => {
    const dbIds = new Set(dbRows.map((n) => n.id));
    const fromDb: FeedNotification[] = dbRows.map((n) => {
      // Note @mentions carry their target in data rather than related_type/related_id.
      const data = n.data && typeof n.data === 'object' ? n.data : null;
      const mentionOnCustomer = n.type === 'note_mention' && data?.entity_type === 'customer' && data?.entity_id;
      return {
        id: n.id,
        type: SEVERITY_BY_KIND[n.type] ?? 'info',
        kind: n.type,
        title: n.title,
        message: n.message,
        timestamp: n.created_at,
        read: !!n.read,
        isDb: true,
        relatedType: mentionOnCustomer ? 'contact' : (n.related_type ?? undefined),
        relatedId: mentionOnCustomer ? data.entity_id : (n.related_id ?? undefined),
        noteId: n.type === 'note_mention' && data?.note_id ? data.note_id : undefined,
        data,
      };
    });
    const sessionOnly: FeedNotification[] = state.notifications
      .filter((n) => !dbIds.has(n.id))
      .map((n) => ({
        id: n.id,
        type: n.type,
        kind: n.kind,
        title: n.title,
        message: n.message,
        timestamp: n.timestamp,
        read: n.read,
        isDb: false,
        relatedType: n.relatedType,
        relatedId: n.relatedId,
      }));
    return [...sessionOnly, ...fromDb].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [dbRows, state.notifications]);

  const unreadCount = items.filter((n) => !n.read).length;

  const markRead = useCallback(async (item: FeedNotification) => {
    if (item.read) return;
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: item.id });
    if (!item.isDb) return;
    setDbRows((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    // Only `read`: the table has no updated_at column, so writing one made every
    // mark-as-read fail and notifications came back unread on reload.
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', item.id);
    if (error) console.error('[notifications] mark read failed:', error.message);
  }, [dispatch]);

  const markAllRead = useCallback(async () => {
    const unreadDbIds = items.filter((n) => n.isDb && !n.read).map((n) => n.id);
    items.filter((n) => !n.isDb && !n.read).forEach((n) => dispatch({ type: 'MARK_NOTIFICATION_READ', payload: n.id }));
    if (unreadDbIds.length === 0) return;
    setDbRows((prev) => prev.map((n) => (unreadDbIds.includes(n.id) ? { ...n, read: true } : n)));
    const { error } = await supabase.from('notifications').update({ read: true }).in('id', unreadDbIds);
    if (error) console.error('[notifications] mark all read failed:', error.message);
  }, [items, dispatch]);

  return { items, unreadCount, markRead, markAllRead, reload: load };
}

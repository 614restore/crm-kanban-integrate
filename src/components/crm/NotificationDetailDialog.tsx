// The full notification, opened from either bell: the bell list cuts long
// messages off. A button goes to what the notification is about.
import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import type { FeedNotification } from '@/hooks/useNotificationFeed';
import { describeNotificationTarget } from '@/lib/notificationNavigation';

interface NotificationDetailDialogProps {
  notification: FeedNotification | null;
  onClose: () => void;
  onOpenTarget: (notification: FeedNotification) => void;
}

export default function NotificationDetailDialog({ notification, onClose, onOpenTarget }: NotificationDetailDialogProps) {
  const [fullNote, setFullNote] = useState<{ body: string; author: string | null } | null>(null);

  useEffect(() => {
    setFullNote(null);
    const noteId = notification?.noteId;
    if (!noteId) return;
    let cancelled = false;
    // A note @mention notification keeps only the first 140 characters of the note.
    supabase
      .from('notes')
      .select('body, author:team_members(full_name)')
      .eq('id', noteId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const row = data as any;
        setFullNote({ body: row.body ?? '', author: row.author?.full_name ?? null });
      });
    return () => { cancelled = true; };
  }, [notification?.noteId]);

  const targetLabel = notification ? describeNotificationTarget(notification) : null;

  return (
    <Dialog open={!!notification} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        {notification && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6">{notification.title}</DialogTitle>
              <DialogDescription>
                {new Date(notification.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </DialogDescription>
            </DialogHeader>
            <div className="text-sm text-gray-700 whitespace-pre-wrap break-words max-h-80 overflow-y-auto">
              {fullNote ? fullNote.body : notification.message}
            </div>
            {fullNote?.author && <p className="text-xs text-gray-500">Note by {fullNote.author}</p>}
            <DialogFooter className="gap-2 sm:gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
              {targetLabel && (
                <button
                  type="button"
                  onClick={() => onOpenTarget(notification)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {targetLabel}
                </button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';

/**
 * The Email and SMS notification choices on Settings → Notifications.
 *
 * These used to be plain checkboxes with no memory and no Save button: unchecking one only changed what
 * was on screen until the page was reopened, and nothing read the choice. They are now saved on the
 * person's own notification-preferences row (the `preferences` column), with a Save button, and the
 * mobile app's Notification Preferences screen reads and writes the same choices.
 *
 * The app only sends alerts for the events it notifies about today; the saved choice is what each
 * alert will check as more of them are added.
 */

export const EMAIL_EVENTS: { key: string; label: string }[] = [
  { key: 'new_leads', label: 'New leads assigned to me' },
  { key: 'estimate_status', label: 'Estimate status changes' },
  { key: 'invoice_payments', label: 'Invoice payments received' },
  { key: 'appointment_reminders', label: 'Appointment reminders' },
  { key: 'team_updates', label: 'Team updates' },
];

export const SMS_EVENTS: { key: string; label: string }[] = [
  { key: 'urgent_inquiries', label: 'Urgent inquiries' },
  { key: 'job_completion', label: 'Job completion' },
  { key: 'payment_reminders', label: 'Payment reminders' },
];

type Choices = { email: Record<string, boolean>; sms: Record<string, boolean> };

const defaults = (): Choices => ({
  email: Object.fromEntries(EMAIL_EVENTS.map((e) => [e.key, true])),
  sms: Object.fromEntries(SMS_EVENTS.map((e) => [e.key, false])),
});

export default function NotificationToggles() {
  const { profile, user } = useAuth();
  const [choices, setChoices] = useState<Choices>(defaults());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile?.company_id || !user?.id) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('preferences')
        .eq('company_id', profile.company_id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data?.preferences) {
        const saved = data.preferences as Partial<Choices>;
        const base = defaults();
        setChoices({
          email: { ...base.email, ...(saved.email ?? {}) },
          sms: { ...base.sms, ...(saved.sms ?? {}) },
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.company_id, user?.id]);

  const set = (channel: 'email' | 'sms', key: string, value: boolean) => {
    setChoices((c) => ({ ...c, [channel]: { ...c[channel], [key]: value } }));
    setDirty(true);
  };

  const save = async () => {
    if (!profile?.company_id || !user?.id) return;
    setSaving(true);
    const { error } = await supabase.from('notification_preferences').upsert(
      {
        company_id: profile.company_id,
        user_id: user.id,
        preferences: choices,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,user_id' }
    );
    setSaving(false);
    if (error) {
      toast.error('Could not save: ' + error.message);
    } else {
      setDirty(false);
      toast.success('Notification settings saved');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const card = (title: string, channel: 'email' | 'sms', events: { key: string; label: string }[]) => (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <h4 className="text-base font-semibold text-gray-900">{title}</h4>
      <div className="space-y-3">
        {events.map((e) => (
          <label key={e.key} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!choices[channel][e.key]}
              onChange={(ev) => set(channel, e.key, ev.target.checked)}
              className="rounded"
            />
            <span className="text-sm">{e.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {card('Email Notifications', 'email', EMAIL_EVENTS)}
      {card('SMS Notifications', 'sms', SMS_EVENTS)}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          Save notification settings
        </button>
        {dirty && <span className="text-sm text-amber-600">You have unsaved changes</span>}
      </div>
    </div>
  );
}

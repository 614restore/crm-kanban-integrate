import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Bell, Clock, MapPin, Wind, Loader2 } from 'lucide-react';

interface NotificationPrefs {
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  hail_alerts_enabled: boolean;
  wind_alerts_enabled: boolean;
  appointment_alerts_enabled: boolean;
  lead_assignment_alerts_enabled: boolean;
  mention_alerts_enabled: boolean;
  min_hail_size_inches: number;
  min_wind_speed_mph: number;
  min_severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  service_area_zip_codes: string[];
}

export function NotificationPreferences() {
  const { profile, user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, [profile]);

  const loadPreferences = async () => {
    if (!profile?.company_id || !user?.id) return;
    
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('company_id', profile.company_id)
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (error) {
      console.error('Failed to load preferences:', error);
      setLoading(false);
      return;
    }
    
    setPrefs(data || getDefaultPreferences());
    setLoading(false);
  };

  const getDefaultPreferences = (): NotificationPrefs => ({
    email_enabled: true,
    sms_enabled: true,
    push_enabled: true,
    hail_alerts_enabled: true,
    wind_alerts_enabled: true,
    appointment_alerts_enabled: true,
    lead_assignment_alerts_enabled: true,
    mention_alerts_enabled: true,
    min_hail_size_inches: 0.75,
    min_wind_speed_mph: 40,
    min_severity: 'moderate',
    quiet_hours_start: null,
    quiet_hours_end: null,
    service_area_zip_codes: [],
  });

  const savePreferences = async () => {
    if (!profile?.company_id || !user?.id || !prefs) return;
    
    setSaving(true);
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        company_id: profile.company_id,
        user_id: user.id,
        ...prefs,
      });
    
    if (error) {
      toast.error('Failed to save preferences');
      console.error(error);
    } else {
      toast.success('Preferences saved successfully');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!prefs) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Failed to load preferences</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold">Notification Preferences</h2>
        <p className="text-muted-foreground mt-1">Configure how and when you receive alerts</p>
      </div>

      {/* Channel Toggles */}
      <section className="space-y-4 bg-card p-6 rounded-lg border">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Channels
        </h3>
        <p className="text-sm text-muted-foreground">Choose how you want to receive notifications</p>
        
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.email_enabled}
              onChange={(e) => setPrefs({ ...prefs, email_enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="font-medium">Email Notifications</span>
          </label>
          
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.sms_enabled}
              onChange={(e) => setPrefs({ ...prefs, sms_enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="font-medium">SMS Notifications</span>
          </label>
          
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.push_enabled}
              onChange={(e) => setPrefs({ ...prefs, push_enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="font-medium">Push Notifications (Mobile)</span>
          </label>
        </div>
      </section>

      {/* Alert Types */}
      <section className="space-y-4 bg-card p-6 rounded-lg border">
        <h3 className="text-lg font-semibold">Alert Types</h3>
        <p className="text-sm text-muted-foreground">Choose which types of alerts you want to receive</p>
        
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.hail_alerts_enabled}
              onChange={(e) => setPrefs({ ...prefs, hail_alerts_enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="font-medium">Hail Event Alerts</span>
          </label>
          
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.wind_alerts_enabled}
              onChange={(e) => setPrefs({ ...prefs, wind_alerts_enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="font-medium">High Wind Alerts</span>
          </label>
          
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.appointment_alerts_enabled}
              onChange={(e) => setPrefs({ ...prefs, appointment_alerts_enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="font-medium">Appointment Reminders</span>
          </label>
          
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.lead_assignment_alerts_enabled}
              onChange={(e) => setPrefs({ ...prefs, lead_assignment_alerts_enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="font-medium">Lead Assignment Notifications</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.mention_alerts_enabled}
              onChange={(e) => setPrefs({ ...prefs, mention_alerts_enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="font-medium">@Mention Notifications</span>
          </label>
        </div>
      </section>

      {/* Weather Thresholds */}
      <section className="space-y-4 bg-card p-6 rounded-lg border">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Wind className="h-5 w-5" />
          Weather Alert Thresholds
        </h3>
        <p className="text-sm text-muted-foreground">Only alert when weather exceeds these thresholds</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Minimum Hail Size: {prefs.min_hail_size_inches}" inches
            </label>
            <input
              type="range"
              step="0.25"
              min="0"
              max="3"
              value={prefs.min_hail_size_inches}
              onChange={(e) => setPrefs({ ...prefs, min_hail_size_inches: parseFloat(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0"</span>
              <span>3"</span>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Minimum Wind Speed: {prefs.min_wind_speed_mph} mph
            </label>
            <input
              type="range"
              step="5"
              min="0"
              max="100"
              value={prefs.min_wind_speed_mph}
              onChange={(e) => setPrefs({ ...prefs, min_wind_speed_mph: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0 mph</span>
              <span>100 mph</span>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Minimum Severity Level
            </label>
            <select
              value={prefs.min_severity}
              onChange={(e) => setPrefs({ ...prefs, min_severity: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              <option value="minor">Minor</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
              <option value="extreme">Extreme</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Only receive alerts at this severity level or higher
            </p>
          </div>
        </div>
      </section>

      {/* Quiet Hours */}
      <section className="space-y-4 bg-card p-6 rounded-lg border">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Quiet Hours
        </h3>
        <p className="text-sm text-muted-foreground">Suppress non-urgent notifications during these hours</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Start Time</label>
            <input
              type="time"
              value={prefs.quiet_hours_start || ''}
              onChange={(e) => setPrefs({ ...prefs, quiet_hours_start: e.target.value || null })}
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">End Time</label>
            <input
              type="time"
              value={prefs.quiet_hours_end || ''}
              onChange={(e) => setPrefs({ ...prefs, quiet_hours_end: e.target.value || null })}
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Leave blank to receive notifications 24/7. Severe weather alerts will always come through.
        </p>
      </section>

      {/* Service Area */}
      <section className="space-y-4 bg-card p-6 rounded-lg border">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Service Area
        </h3>
        <p className="text-sm text-muted-foreground">Define which areas to monitor for weather alerts</p>
        
        <div>
          <label className="block text-sm font-medium mb-2">
            Zip Codes (comma-separated)
          </label>
          <input
            type="text"
            value={prefs.service_area_zip_codes.join(', ')}
            onChange={(e) => setPrefs({ 
              ...prefs, 
              service_area_zip_codes: e.target.value.split(',').map(z => z.trim()).filter(Boolean) 
            })}
            placeholder="80206, 80207, 80209"
            className="w-full px-3 py-2 border rounded-md bg-background"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Leave blank to monitor all contact locations. Add specific zip codes to focus on your service area.
          </p>
        </div>
      </section>

      {/* Save Button */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          onClick={() => setPrefs(getDefaultPreferences())}
          className="px-6 py-2 border rounded-md hover:bg-accent"
        >
          Reset to Defaults
        </button>
        <button
          onClick={savePreferences}
          disabled={saving}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}

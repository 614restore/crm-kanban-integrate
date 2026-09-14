// Storm alert settings for the company: the office-area radius (alerts everyone),
// the contact radius (alerts the assigned rep), the wind threshold, email, and
// which roles also get contact alerts. The storm-alerts edge function reads
// these every 15 minutes. Owners, admins and managers can change them.
import React, { useEffect, useState } from 'react';
import { CloudLightning, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const ROLE_OPTIONS: Array<[string, string]> = [
  ['owner', 'Owners'],
  ['admin', 'Admins'],
  ['manager', 'Managers'],
  ['salesperson', 'Salespeople'],
  ['sales', 'Sales'],
  ['canvasser', 'Canvassers'],
  ['member', 'Members'],
];
const EDITOR_ROLES = ['owner', 'admin', 'manager'];
const CONTACT_RADIUS_OPTIONS = [1, 2, 3, 5, 10];
const MIN_WIND_OPTIONS = [35, 40, 45, 50, 58];

interface Settings {
  enabled: boolean;
  areaRadius: number;
  contactRadius: number;
  minWind: number;
  emailEnabled: boolean;
  contactRoles: string[];
}

const DEFAULTS: Settings = {
  enabled: true,
  areaRadius: 50,
  contactRadius: 3,
  minWind: 35,
  emailEnabled: true,
  contactRoles: [],
};

interface StormAlertSettingsProps {
  companyId: string;
  userRole?: string | null;
}

export default function StormAlertSettings({ companyId, userRole }: StormAlertSettingsProps) {
  const canEdit = EDITOR_ROLES.includes(String(userRole ?? '').toLowerCase());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [office, setOffice] = useState<{ address: string; located: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('companies')
        .select('address, city, state, zip, latitude, storm_alerts_enabled, storm_area_radius_miles, storm_contact_radius_miles, storm_min_wind_mph, storm_contact_alert_roles, storm_email_enabled')
        .eq('id', companyId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setNeedsSetup(/storm_|latitude|column/i.test(error.message));
        setLoading(false);
        return;
      }
      const row = data as any;
      if (row) {
        setSettings({
          enabled: row.storm_alerts_enabled ?? DEFAULTS.enabled,
          areaRadius: row.storm_area_radius_miles ?? DEFAULTS.areaRadius,
          contactRadius: Number(row.storm_contact_radius_miles ?? DEFAULTS.contactRadius),
          minWind: row.storm_min_wind_mph ?? DEFAULTS.minWind,
          emailEnabled: row.storm_email_enabled ?? DEFAULTS.emailEnabled,
          contactRoles: Array.isArray(row.storm_contact_alert_roles) ? row.storm_contact_alert_roles : [],
        });
        const address = [row.address, row.city, [row.state, row.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
        setOffice({ address, located: row.latitude != null });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  const update = (patch: Partial<Settings>) => setSettings((prev) => ({ ...prev, ...patch }));

  const toggleRole = (role: string) =>
    update({
      contactRoles: settings.contactRoles.includes(role)
        ? settings.contactRoles.filter((r) => r !== role)
        : [...settings.contactRoles, role],
    });

  const save = async () => {
    setSaving(true);
    const areaRadius = Math.min(250, Math.max(1, Math.round(settings.areaRadius || DEFAULTS.areaRadius)));
    const { error } = await supabase.rpc('update_my_storm_alert_settings', {
      p_company_id: companyId,
      p_enabled: settings.enabled,
      p_area_radius_miles: areaRadius,
      p_contact_radius_miles: settings.contactRadius,
      p_min_wind_mph: settings.minWind,
      p_contact_alert_roles: settings.contactRoles,
      p_email_enabled: settings.emailEnabled,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || 'Could not save storm alert settings');
      return;
    }
    update({ areaRadius });
    toast.success('Storm alert settings saved');
  };

  const disabled = !canEdit || needsSetup || saving;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <CloudLightning size={18} className="text-blue-600" /> Storm Alerts
          </h4>
          <p className="text-sm text-gray-500 mt-1">
            Every 15 minutes, checks National Weather Service storm reports and NOAA radar hail, and alerts your team in the
            notification bell (web and mobile) and by email.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 shrink-0">
          <input
            type="checkbox"
            className="rounded"
            checked={settings.enabled}
            disabled={disabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          On
        </label>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={14} className="animate-spin" /> Loading storm alert settings…
        </div>
      ) : (
        <>
          {needsSetup && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Storm alerts need a database update before they can be set up.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Office alert radius (miles)</label>
              <input
                type="number"
                min={1}
                max={250}
                value={settings.areaRadius}
                disabled={disabled}
                onChange={(e) => update({ areaRadius: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                Hail, high wind and tornado reports this close to your company address go to everyone on the team.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Contact alert radius</label>
              <select
                value={settings.contactRadius}
                disabled={disabled}
                onChange={(e) => update({ contactRadius: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50"
              >
                {[...new Set([...CONTACT_RADIUS_OPTIONS, settings.contactRadius])].sort((a, b) => a - b).map((r) => (
                  <option key={r} value={r}>{r} {r === 1 ? 'mile' : 'miles'}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Reports this close to a contact's address go to the rep assigned to that contact.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Minimum wind speed</label>
              <select
                value={settings.minWind}
                disabled={disabled}
                onChange={(e) => update({ minWind: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50"
              >
                {[...new Set([...MIN_WIND_OPTIONS, settings.minWind])].sort((a, b) => a - b).map((w) => (
                  <option key={w} value={w}>{w} mph</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Hail of any size, wind damage and tornadoes always alert.</p>
            </div>
            <label className="flex items-start gap-3 pt-6">
              <input
                type="checkbox"
                className="rounded mt-0.5"
                checked={settings.emailEnabled}
                disabled={disabled}
                onChange={(e) => update({ emailEnabled: e.target.checked })}
              />
              <span className="text-sm text-gray-700">Also send storm alerts by email</span>
            </label>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-900">Contact alerts also go to</p>
            <p className="text-xs text-gray-500 mb-2">
              The assigned rep always gets alerts for their contacts. Contacts with no assigned rep alert owners and admins.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {ROLE_OPTIONS.map(([role, label]) => (
                <label key={role} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={settings.contactRoles.includes(role)}
                    disabled={disabled}
                    onChange={() => toggleRole(role)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {office && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <MapPin size={12} />
              {office.address
                ? `Office: ${office.address}${office.located ? '' : ' (located on the next check)'}`
                : 'Add your company address under Company to get office-area alerts.'}
            </div>
          )}

          {canEdit ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={save}
                disabled={saving || needsSetup}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Save storm alerts
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Only owners, admins and managers can change storm alert settings.</p>
          )}
        </>
      )}
    </div>
  );
}

// Company settings for a customer's storm history (the Storm swipe action on the
// phone app's Customers list): how far back, how far around the address, and the
// smallest wind and hail worth showing. Owners, admins and managers edit them; the
// phone app reads the same saved values.
import React, { useEffect, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const EDITOR_ROLES = ['owner', 'admin', 'manager'];
// The same choices the phone app's Storm History offers.
const MONTH_OPTIONS = [1, 3, 6, 12, 24, 36];
const RADIUS_OPTIONS = [1, 3, 5, 10, 15, 25, 50];
const WIND_OPTIONS = [0, 30, 35, 40, 50, 58, 65, 75];
const HAIL_OPTIONS = [0, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

interface Settings {
  months: number;
  radiusMiles: number;
  minWindMph: number;
  minHailInches: number;
}

const DEFAULTS: Settings = { months: 12, radiusMiles: 10, minWindMph: 0, minHailInches: 0 };

const monthLabel = (m: number) => (m === 1 ? '1 month' : m < 12 ? `${m} months` : m === 12 ? '1 year' : `${m / 12} years`);
const num = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

interface StormHistorySettingsProps {
  companyId: string;
  userRole?: string | null;
}

export default function StormHistorySettings({ companyId, userRole }: StormHistorySettingsProps) {
  const canEdit = EDITOR_ROLES.includes(String(userRole ?? '').toLowerCase());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('storm_history_months, storm_history_radius_miles, storm_history_min_wind_mph, storm_history_min_hail_in')
        .eq('id', companyId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setNeedsSetup(/storm_history|column/i.test(error.message));
      } else if (data) {
        const row = data as Record<string, unknown>;
        setSettings({
          months: num(row.storm_history_months, DEFAULTS.months),
          radiusMiles: num(row.storm_history_radius_miles, DEFAULTS.radiusMiles),
          minWindMph: num(row.storm_history_min_wind_mph, DEFAULTS.minWindMph),
          minHailInches: num(row.storm_history_min_hail_in, DEFAULTS.minHailInches),
        });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  const update = (patch: Partial<Settings>) => setSettings((prev) => ({ ...prev, ...patch }));
  const disabled = !canEdit || needsSetup || saving;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.rpc('update_my_storm_history_settings', {
      p_company_id: companyId,
      p_months: settings.months,
      p_radius_miles: settings.radiusMiles,
      p_min_wind_mph: settings.minWindMph,
      p_min_hail_in: settings.minHailInches,
    });
    setSaving(false);
    if (error) {
      toast.error(`Could not save storm history settings: ${error.message}`);
      return;
    }
    toast.success('Storm history settings saved');
  };

  const select = (
    label: string,
    value: number,
    options: number[],
    format: (v: number) => string,
    onChange: (v: number) => void,
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-1">{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50"
      >
        {[...new Set([...options, value])].sort((a, b) => a - b).map((o) => (
          <option key={o} value={o}>{format(o)}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div>
        <h4 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <History size={18} className="text-blue-600" /> Customer Storm History
        </h4>
        <p className="text-sm text-gray-500 mt-1">
          In the phone app, swipe left on a customer and tap Storm to see the storms recorded around their address. These
          settings decide what it shows for every customer.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={14} className="animate-spin" /> Loading storm history settings…
        </div>
      ) : (
        <>
          {needsSetup && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Storm history settings need a database update before they can be changed. Until then the phone app uses
              1 year, 10 miles, any wind and any hail.
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {select('Look back', settings.months, MONTH_OPTIONS, monthLabel, (v) => update({ months: v }))}
            {select('Within this distance of the address', settings.radiusMiles, RADIUS_OPTIONS, (v) => `${v} ${v === 1 ? 'mile' : 'miles'}`, (v) => update({ radiusMiles: v }))}
            {select('Wind at least', settings.minWindMph, WIND_OPTIONS, (v) => (v === 0 ? 'Any wind' : `${v} mph`), (v) => update({ minWindMph: v }))}
            {select('Hail at least', settings.minHailInches, HAIL_OPTIONS, (v) => (v === 0 ? 'Any hail' : `${v}"`), (v) => update({ minHailInches: v }))}
          </div>

          {canEdit ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={save}
                disabled={saving || needsSetup}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Save storm history
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Only owners, admins and managers can change storm history settings.</p>
          )}
        </>
      )}
    </div>
  );
}

// Company settings for the storm history a rep opens from a customer: how far
// around the property to look, how far back, and the wind and hail thresholds —
// plus a switch to take the action off the contact list entirely.
//
// Storm alert settings (the 15-minute office/contact alerts) live next to these
// on the companies row and are edited on the same Settings screen.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface StormHistorySettings {
  enabled: boolean;
  radiusMiles: number;
  months: number;
  minWind: number;
  minHail: number;
}

export const STORM_HISTORY_DEFAULTS: StormHistorySettings = {
  enabled: true,
  radiusMiles: 10,
  months: 12,
  minWind: 0,
  minHail: 0,
};

const COLUMNS =
  'storm_history_enabled, storm_history_radius_miles, storm_history_months, storm_history_min_wind_mph, storm_history_min_hail_in';

/** Reads the company's settings, falling back to the defaults for anything unset. */
export async function loadStormHistorySettings(companyId?: string | null): Promise<StormHistorySettings> {
  if (!companyId) return STORM_HISTORY_DEFAULTS;
  const { data, error } = await supabase.from('companies').select(COLUMNS).eq('id', companyId).maybeSingle();
  // Before the migration runs the columns do not exist; the defaults keep the
  // action working rather than failing the click.
  if (error || !data) return STORM_HISTORY_DEFAULTS;
  const row = data as Record<string, unknown>;
  return {
    enabled: (row.storm_history_enabled as boolean) ?? STORM_HISTORY_DEFAULTS.enabled,
    radiusMiles: Number(row.storm_history_radius_miles ?? STORM_HISTORY_DEFAULTS.radiusMiles),
    months: Number(row.storm_history_months ?? STORM_HISTORY_DEFAULTS.months),
    minWind: Number(row.storm_history_min_wind_mph ?? STORM_HISTORY_DEFAULTS.minWind),
    minHail: Number(row.storm_history_min_hail_in ?? STORM_HISTORY_DEFAULTS.minHail),
  };
}

/** The same settings for screens that only need to know whether to show the action. */
export function useStormHistorySettings(companyId?: string | null): StormHistorySettings {
  const [settings, setSettings] = useState<StormHistorySettings>(STORM_HISTORY_DEFAULTS);
  useEffect(() => {
    let cancelled = false;
    loadStormHistorySettings(companyId).then((loaded) => {
      if (!cancelled) setSettings(loaded);
    });
    return () => { cancelled = true; };
  }, [companyId]);
  return settings;
}

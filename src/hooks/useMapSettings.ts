// Which map and radar the signed-in person sees: their own provider first, then
// their team's, then the free OpenStreetMap map and NOAA radar.
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useCRM } from '@/lib/crmStore';
import { supabase } from '@/lib/supabase';
import {
  buildTileConfig,
  DEFAULT_RADAR_URL,
  FREE_TILES,
  getMapProvider,
  isValidRadarUrl,
  MAP_SETTINGS_COLUMNS,
  type MapSettingsRow,
  type TileConfig,
} from '@/lib/mapProviders';

export const MAP_SETTINGS_CHANGED_EVENT = 'trussctr:map-settings-changed';

export interface ResolvedMapSettings {
  tiles: TileConfig;
  tilesSource: 'personal' | 'team' | 'free';
  providerName: string;
  radarTemplate: string;
  radarSource: 'personal' | 'team' | 'default';
  loading: boolean;
}

export function useMapSettings(): ResolvedMapSettings {
  const { state } = useCRM();
  const { user } = useAuth();
  const companyId = state.companyId ?? null;
  const userId = user?.id ?? null;
  const [rows, setRows] = useState<{ personal: MapSettingsRow | null; team: MapSettingsRow | null }>({ personal: null, team: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [personal, team] = await Promise.all([
        userId
          ? supabase.from('user_map_settings').select(MAP_SETTINGS_COLUMNS).eq('user_id', userId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        companyId
          ? supabase.from('company_map_settings').select(MAP_SETTINGS_COLUMNS).eq('company_id', companyId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (cancelled) return;
      // Missing tables (settings not set up yet) just mean the free map.
      setRows({
        personal: personal.error ? null : ((personal.data as MapSettingsRow | null) ?? null),
        team: team.error ? null : ((team.data as MapSettingsRow | null) ?? null),
      });
      setLoading(false);
    };
    load();
    window.addEventListener(MAP_SETTINGS_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(MAP_SETTINGS_CHANGED_EVENT, load);
    };
  }, [companyId, userId]);

  return useMemo(() => {
    const pick = (row: MapSettingsRow | null) =>
      row && row.provider !== 'openstreetmap' ? buildTileConfig(row) : null;
    const personalTiles = pick(rows.personal);
    const teamTiles = personalTiles ? null : pick(rows.team);

    let radarTemplate = DEFAULT_RADAR_URL;
    let radarSource: ResolvedMapSettings['radarSource'] = 'default';
    if (isValidRadarUrl(rows.personal?.radar_url)) {
      radarTemplate = rows.personal!.radar_url!.trim();
      radarSource = 'personal';
    } else if (isValidRadarUrl(rows.team?.radar_url)) {
      radarTemplate = rows.team!.radar_url!.trim();
      radarSource = 'team';
    }

    if (personalTiles) {
      return {
        tiles: personalTiles,
        tilesSource: 'personal' as const,
        providerName: getMapProvider(rows.personal?.provider)?.name ?? 'Your map provider',
        radarTemplate,
        radarSource,
        loading,
      };
    }
    if (teamTiles) {
      return {
        tiles: teamTiles,
        tilesSource: 'team' as const,
        providerName: getMapProvider(rows.team?.provider)?.name ?? 'Team map provider',
        radarTemplate,
        radarSource,
        loading,
      };
    }
    return { tiles: FREE_TILES, tilesSource: 'free' as const, providerName: 'OpenStreetMap', radarTemplate, radarSource, loading };
  }, [rows, loading]);
}

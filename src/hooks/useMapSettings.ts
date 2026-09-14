// Which map and radar the signed-in person sees: their own provider first, then
// their team's, then the free OpenStreetMap map and NOAA radar. A provider is
// used only after /api/map-tile-check confirms it serves tiles; a rejected key
// falls through to the next choice and is reported in providerProblem.
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
import { checkTileUrl, clearTileCheckCache, type TileCheckResult } from '@/lib/mapTileCheck';

export const MAP_SETTINGS_CHANGED_EVENT = 'trussctr:map-settings-changed';

export interface ResolvedMapSettings {
  tiles: TileConfig;
  tilesSource: 'personal' | 'team' | 'free';
  providerName: string;
  /** Why a saved provider isn't being used, e.g. the key was rejected. */
  providerProblem: string | null;
  radarTemplate: string;
  radarSource: 'personal' | 'team' | 'default';
  loading: boolean;
}

interface Candidate {
  source: 'personal' | 'team';
  tiles: TileConfig;
  name: string;
}

export function useMapSettings(): ResolvedMapSettings {
  const { state } = useCRM();
  const { user } = useAuth();
  const companyId = state.companyId ?? null;
  const userId = user?.id ?? null;
  const [rows, setRows] = useState<{ personal: MapSettingsRow | null; team: MapSettingsRow | null }>({ personal: null, team: null });
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<Record<string, TileCheckResult>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async (event?: Event) => {
      if (event) {
        // Saved settings changed: check providers again.
        clearTileCheckCache();
        setChecks({});
      }
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

  const candidates = useMemo<Candidate[]>(() => {
    const list: Candidate[] = [];
    const add = (source: Candidate['source'], row: MapSettingsRow | null) => {
      if (!row || row.provider === 'openstreetmap') return;
      const tiles = buildTileConfig(row);
      if (tiles) list.push({ source, tiles, name: getMapProvider(row.provider)?.name ?? 'Your map provider' });
    };
    add('personal', rows.personal);
    add('team', rows.team);
    return list;
  }, [rows]);

  useEffect(() => {
    let cancelled = false;
    for (const c of candidates) {
      if (checks[c.tiles.url]) continue;
      checkTileUrl(c.tiles.url, c.tiles.subdomains).then((result) => {
        if (!cancelled) setChecks((prev) => ({ ...prev, [c.tiles.url]: result }));
      });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates]);

  return useMemo(() => {
    let radarTemplate = DEFAULT_RADAR_URL;
    let radarSource: ResolvedMapSettings['radarSource'] = 'default';
    if (isValidRadarUrl(rows.personal?.radar_url)) {
      radarTemplate = rows.personal!.radar_url!.trim();
      radarSource = 'personal';
    } else if (isValidRadarUrl(rows.team?.radar_url)) {
      radarTemplate = rows.team!.radar_url!.trim();
      radarSource = 'team';
    }
    const free = { tiles: FREE_TILES, tilesSource: 'free' as const, providerName: 'OpenStreetMap', radarTemplate, radarSource };

    let problem: string | null = null;
    for (const c of candidates) {
      const result = checks[c.tiles.url];
      // Show the free map while a provider is still being checked, not its error tiles.
      if (!result) return { ...free, providerProblem: null, loading: true };
      if (result.ok || !result.conclusive) {
        return { tiles: c.tiles, tilesSource: c.source, providerName: c.name, providerProblem: null, radarTemplate, radarSource, loading };
      }
      problem ??= `${c.name} (${c.source === 'personal' ? 'your map' : 'team map'}): ${result.message}`;
    }
    return { ...free, providerProblem: problem, loading };
  }, [rows, loading, candidates, checks]);
}

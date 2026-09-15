// Map providers for Storm Search's map. The free OpenStreetMap street map and
// NOAA radar (Iowa Environmental Mesonet) are the defaults; a person or their
// team can add a provider with their own key for satellite imagery or more
// detailed maps, or a tile address for a paid radar service. Settings live in
// user_map_settings and company_map_settings (personal first, then team).

export type MapProviderId = 'openstreetmap' | 'maptiler' | 'stadia' | 'mapbox' | 'thunderforest' | 'custom';

export interface MapProviderInfo {
  id: MapProviderId;
  name: string;
  description: string;
  key: 'none' | 'required' | 'optional';
  keyLabel?: string;
  signupUrl?: string;
  styles: Array<{ id: string; name: string }>;
}

export const MAP_PROVIDERS: MapProviderInfo[] = [
  {
    id: 'openstreetmap',
    name: 'OpenStreetMap (free)',
    description: 'Street map with no account. Fine for light use; busy apps can be limited.',
    key: 'none',
    styles: [],
  },
  {
    id: 'maptiler',
    name: 'MapTiler',
    description: 'Streets, outdoor and satellite imagery. Free tier for small teams.',
    key: 'required',
    keyLabel: 'API key',
    signupUrl: 'https://cloud.maptiler.com/account/keys/',
    styles: [
      { id: 'hybrid', name: 'Satellite with labels' },
      { id: 'satellite', name: 'Satellite' },
      { id: 'streets-v2', name: 'Streets' },
      { id: 'outdoor-v2', name: 'Outdoor' },
    ],
  },
  {
    id: 'stadia',
    name: 'Stadia Maps',
    description: 'Clean street maps and satellite imagery. Free tier for small teams.',
    key: 'optional',
    keyLabel: 'API key (optional if you use domain authentication)',
    signupUrl: 'https://client.stadiamaps.com/',
    styles: [
      { id: 'alidade_satellite', name: 'Satellite' },
      { id: 'alidade_smooth', name: 'Smooth' },
      { id: 'osm_bright', name: 'OSM Bright' },
      { id: 'outdoors', name: 'Outdoors' },
      { id: 'alidade_smooth_dark', name: 'Dark' },
    ],
  },
  {
    id: 'mapbox',
    name: 'Mapbox',
    description: 'Detailed streets and high-resolution satellite imagery.',
    key: 'required',
    keyLabel: 'Public access token (starts with pk.)',
    signupUrl: 'https://account.mapbox.com/access-tokens/',
    styles: [
      { id: 'satellite-streets-v12', name: 'Satellite with streets' },
      { id: 'streets-v12', name: 'Streets' },
      { id: 'outdoors-v12', name: 'Outdoors' },
      { id: 'light-v11', name: 'Light' },
    ],
  },
  {
    id: 'thunderforest',
    name: 'Thunderforest',
    description: 'Detailed street, transport and terrain maps.',
    key: 'required',
    keyLabel: 'API key',
    signupUrl: 'https://manage.thunderforest.com/',
    styles: [
      { id: 'atlas', name: 'Atlas' },
      { id: 'outdoors', name: 'Outdoors' },
      { id: 'transport', name: 'Transport' },
      { id: 'landscape', name: 'Landscape' },
    ],
  },
  {
    id: 'custom',
    name: 'Another provider (tile address)',
    description: 'Any provider with a map tile address containing {z}, {x} and {y}.',
    key: 'optional',
    keyLabel: 'API key (fills {key} in the address)',
    styles: [],
  },
];

export interface MapSettingsRow {
  provider: string;
  style: string | null;
  api_key: string | null;
  custom_url: string | null;
  custom_attribution: string | null;
  radar_url: string | null;
}

export const MAP_SETTINGS_COLUMNS = 'provider, style, api_key, custom_url, custom_attribution, radar_url';

export interface TileConfig {
  url: string;
  /** Rendered as HTML by Leaflet: only built from trusted text or escaped. */
  attribution: string;
  subdomains: string;
  maxZoom: number;
}

const OSM_CREDIT = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const FREE_TILES: TileConfig = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: OSM_CREDIT,
  subdomains: 'abc',
  maxZoom: 19,
};

export const DEFAULT_RADAR_URL =
  'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::USCOMP-N0Q-{time}/{z}/{x}/{y}.png';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const getMapProvider = (id: string | null | undefined) => MAP_PROVIDERS.find((p) => p.id === id) ?? null;

/** Where the provider's dashboard lets a key be limited to certain websites. */
export const ORIGIN_SETTING_NAMES: Partial<Record<MapProviderId, string>> = {
  maptiler: 'Allowed HTTP origins',
  mapbox: 'URL restrictions',
  stadia: 'Authentication Configuration (domains)',
  custom: 'allowed websites, domains or referrers',
};

const PRODUCTION_APP_HOST = 'trussctr.614restore.com';

/**
 * The web addresses a map key has to allow: where TrussCTR runs for every
 * company, plus the address this page is open on (e.g. a preview).
 */
export function allowedMapHosts(): string[] {
  const hosts: string[] = [];
  const envUrl = import.meta.env.VITE_APP_URL as string | undefined;
  if (envUrl) {
    try {
      hosts.push(new URL(envUrl).host);
    } catch {
      // Not a full URL; the production host below still applies.
    }
  }
  hosts.push(PRODUCTION_APP_HOST);
  if (typeof window !== 'undefined' && window.location.host) hosts.push(window.location.host);
  return [...new Set(hosts)];
}

export function isValidTileUrl(url: string | null | undefined): boolean {
  const u = (url ?? '').trim();
  return /^https:\/\/\S+$/i.test(u) && ['{z}', '{x}', '{y}'].every((t) => u.includes(t));
}

export function isValidRadarUrl(url: string | null | undefined): boolean {
  return isValidTileUrl(url) && /\{(time|unix|iso)\}/.test(url ?? '');
}

/** The tile layer for saved settings, or null when they're incomplete (e.g. no key). */
export function buildTileConfig(row: Pick<MapSettingsRow, 'provider' | 'style' | 'api_key' | 'custom_url' | 'custom_attribution'> | null): TileConfig | null {
  if (!row) return null;
  const provider = getMapProvider(row.provider);
  if (!provider) return null;
  const key = (row.api_key ?? '').trim();
  const k = encodeURIComponent(key);
  const style = provider.styles.some((s) => s.id === row.style) ? (row.style as string) : provider.styles[0]?.id;

  switch (provider.id) {
    case 'openstreetmap':
      return FREE_TILES;
    case 'maptiler': {
      if (!key) return null;
      const ext = style === 'satellite' || style === 'hybrid' ? 'jpg' : 'png';
      return {
        url: `https://api.maptiler.com/maps/${style}/256/{z}/{x}/{y}.${ext}?key=${k}`,
        attribution: `&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> ${OSM_CREDIT}`,
        subdomains: 'abc',
        maxZoom: 20,
      };
    }
    case 'stadia': {
      const ext = style === 'alidade_satellite' ? 'jpg' : 'png';
      return {
        url: `https://tiles.stadiamaps.com/tiles/${style}/{z}/{x}/{y}{r}.${ext}${key ? `?api_key=${k}` : ''}`,
        attribution: `&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> ${OSM_CREDIT}`,
        subdomains: 'abc',
        maxZoom: 20,
      };
    }
    case 'mapbox':
      if (!key) return null;
      return {
        url: `https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/256/{z}/{x}/{y}@2x?access_token=${k}`,
        attribution: `&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> ${OSM_CREDIT}`,
        subdomains: 'abc',
        maxZoom: 22,
      };
    case 'thunderforest':
      if (!key) return null;
      return {
        url: `https://{s}.tile.thunderforest.com/${style}/{z}/{x}/{y}.png?apikey=${k}`,
        attribution: `Maps &copy; <a href="https://www.thunderforest.com/">Thunderforest</a>, data ${OSM_CREDIT}`,
        subdomains: 'abc',
        maxZoom: 22,
      };
    case 'custom': {
      const template = (row.custom_url ?? '').trim();
      if (!isValidTileUrl(template)) return null;
      return {
        url: template.replace(/\{(key|apikey|api_key|token)\}/g, k),
        attribution: escapeHtml((row.custom_attribution ?? '').trim() || 'Map tiles from your provider'),
        subdomains: 'abc',
        maxZoom: 20,
      };
    }
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Fills a radar tile address's time: {time} YYYYMMDDHHmm UTC, {unix} seconds, {iso} ISO 8601. */
export function radarTileUrl(template: string, time: Date): string {
  const stamp = `${time.getUTCFullYear()}${pad(time.getUTCMonth() + 1)}${pad(time.getUTCDate())}${pad(time.getUTCHours())}${pad(time.getUTCMinutes())}`;
  return template
    .replace(/\{time\}/g, stamp)
    .replace(/\{unix\}/g, String(Math.floor(time.getTime() / 1000)))
    .replace(/\{iso\}/g, `${time.toISOString().slice(0, 19)}Z`);
}

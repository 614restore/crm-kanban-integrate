// Map for Storm Search: the searched address, the search radius, and each storm
// report where it happened. Ground reports are solid dots; radar estimates are
// faded. Selecting a report shows the area the storm hit: the NWS warning
// outlines that covered it, the other reports from the same storm (the rest
// fade), and the radar picture from that moment with a time slider.
//
// The base map and radar come from the person's or team's map provider
// (Settings → Map Provider), else the free OpenStreetMap map and NOAA NEXRAD
// radar (Iowa Environmental Mesonet's archived national composite, 5-minute steps).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, Layers, Pause, Play, X } from 'lucide-react';
import { Circle, CircleMarker, GeoJSON, MapContainer, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { StormCategory, StormReport, StormWarning } from '@/lib/stormReports';
import { useMapSettings } from '@/hooks/useMapSettings';
import { FREE_TILES, radarTileUrl } from '@/lib/mapProviders';
import { useCRM } from '@/lib/crmStore';

export const STORM_CATEGORY_COLORS: Record<StormCategory, string> = {
  hail: '#2563eb',
  wind: '#0d9488',
  damage: '#ea580c',
  tornado: '#dc2626',
  flood: '#0891b2',
  other: '#6b7280',
};

export const WARNING_COLORS: Record<string, string> = {
  SV: '#f59e0b',
  TO: '#dc2626',
  EW: '#c026d3',
  SQ: '#6366f1',
  FF: '#16a34a',
};

const METERS_PER_MILE = 1609.34;
const RADAR_STEP_MINUTES = 5;
const RADAR_RANGE_MINUTES = 60;
const RADAR_PLAY_FROM = -30;
const RADAR_PLAY_TO = 30;
const RADAR_PLAY_INTERVAL_MS = 900;
/** Failed tiles before a saved map provider is treated as broken. */
const PROVIDER_FAILURE_LIMIT = 4;
const NOTE_DISMISSED_KEY = 'storm-map-provider-note-dismissed';

/** The radar frame time (UTC, 5-minute steps) for a report time plus an offset. */
function radarFrameTime(iso: string, offsetMinutes: number): Date | null {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const step = RADAR_STEP_MINUTES * 60000;
  return new Date(Math.floor((t + offsetMinutes * 60000) / step) * step);
}

const formatWhen = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

function readNoteDismissed(): boolean {
  try {
    return window.localStorage.getItem(NOTE_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

interface StormMapProps {
  center: { lat: number; lon: number; label: string };
  radiusMiles: number;
  reports: StormReport[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  renderPopup: (report: StormReport) => React.ReactNode;
  /** NWS warnings that covered the selected report. */
  warnings?: StormWarning[];
  /** Reports from the same storm as the selected one; the others fade. */
  relatedIds?: Set<string> | null;
}

function FitToSearch({ lat, lon, radiusMiles }: { lat: number; lon: number; radiusMiles: number }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(L.latLng(lat, lon).toBounds(radiusMiles * METERS_PER_MILE * 2), { padding: [16, 16] });
  }, [map, lat, lon, radiusMiles]);
  return null;
}

function FocusSelected({ report, markers }: { report: StormReport | null; markers: React.MutableRefObject<Map<string, L.CircleMarker>> }) {
  const map = useMap();
  useEffect(() => {
    if (!report) return;
    map.panTo([report.lat, report.lon]);
    markers.current.get(report.id)?.openPopup();
  }, [map, report, markers]);
  return null;
}

/** Once a report's warnings load, zoom out enough to show their outlines. */
function FitWarnings({ report, warnings }: { report: StormReport | null; warnings: StormWarning[] }) {
  const map = useMap();
  const key = warnings.map((w) => w.id).join('|');
  useEffect(() => {
    if (!report || warnings.length === 0) return;
    const bounds = L.latLngBounds([[report.lat, report.lon]]);
    for (const w of warnings) {
      bounds.extend(L.geoJSON({ type: 'Feature', properties: {}, geometry: w.geometry } as any).getBounds());
    }
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 11 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, report?.id, key]);
  return null;
}

export default function StormMap({
  center, radiusMiles, reports, selectedId, onSelect, renderPopup, warnings = [], relatedIds = null,
}: StormMapProps) {
  const { dispatch } = useCRM();
  const mapSettings = useMapSettings();
  const markers = useRef(new Map<string, L.CircleMarker>());
  const selected = useMemo(() => reports.find((r) => r.id === selectedId) ?? null, [reports, selectedId]);
  // Radar first so ground reports draw on top of them.
  const ordered = useMemo(
    () => [...reports].sort((a, b) => (a.source === b.source ? 0 : a.source === 'radar' ? -1 : 1)),
    [reports],
  );

  // A saved provider that keeps failing (bad key, blocked address) falls back to the free map.
  const [providerFailed, setProviderFailed] = useState(false);
  const tileFailures = useRef(0);
  useEffect(() => {
    setProviderFailed(false);
    tileFailures.current = 0;
  }, [mapSettings.tiles.url]);
  const baseTiles = providerFailed ? FREE_TILES : mapSettings.tiles;

  const [noteDismissed, setNoteDismissed] = useState(readNoteDismissed);
  const dismissNote = () => {
    setNoteDismissed(true);
    try {
      window.localStorage.setItem(NOTE_DISMISSED_KEY, '1');
    } catch {
      // Private browsing: the note just comes back next time.
    }
  };
  const openMapSettings = () => {
    dispatch({ type: 'SET_VIEW', payload: 'settings' });
    // Delay so SettingsView mounts and attaches its listener before the event fires.
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('crm-open-settings-tab', { detail: { tab: 'maps' } }));
    }, 150);
  };

  const [showRadar, setShowRadar] = useState(true);
  const [radarOffset, setRadarOffset] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [radarFailed, setRadarFailed] = useState(false);

  // Each newly selected report starts at its own moment.
  useEffect(() => {
    setRadarOffset(0);
    setPlaying(false);
  }, [selectedId]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setRadarOffset((prev) => (prev + RADAR_STEP_MINUTES > RADAR_PLAY_TO ? RADAR_PLAY_FROM : prev + RADAR_STEP_MINUTES));
    }, RADAR_PLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playing]);

  const frameTime = selected ? radarFrameTime(selected.validUtc, radarOffset) : null;
  const radarUrl = frameTime ? radarTileUrl(mapSettings.radarTemplate, frameTime) : null;
  const radarVisible = !!radarUrl && showRadar;
  const usingDefaultRadar = mapSettings.radarSource === 'default';

  useEffect(() => {
    setRadarFailed(false);
  }, [radarUrl]);

  const togglePlay = () => {
    if (!playing && (radarOffset < RADAR_PLAY_FROM || radarOffset >= RADAR_PLAY_TO)) setRadarOffset(RADAR_PLAY_FROM);
    setShowRadar(true);
    setPlaying((p) => !p);
  };

  const showProviderNote = !mapSettings.loading && mapSettings.tilesSource === 'free' && usingDefaultRadar && !noteDismissed;

  return (
    <div className="relative isolate h-[520px] w-full overflow-hidden rounded-xl border border-gray-200">
      <MapContainer center={[center.lat, center.lon]} zoom={10} scrollWheelZoom className="h-full w-full">
        <TileLayer
          key={baseTiles.url}
          url={baseTiles.url}
          attribution={baseTiles.attribution}
          subdomains={baseTiles.subdomains}
          maxZoom={baseTiles.maxZoom}
          eventHandlers={{
            tileerror: () => {
              if (providerFailed || mapSettings.tilesSource === 'free') return;
              tileFailures.current += 1;
              if (tileFailures.current >= PROVIDER_FAILURE_LIMIT) setProviderFailed(true);
            },
          }}
        />
        {radarVisible && radarUrl && (
          <TileLayer
            key="radar"
            url={radarUrl}
            attribution={
              usingDefaultRadar
                ? 'Radar and warnings: NOAA/NWS via <a href="https://mesonet.agron.iastate.edu/">Iowa Environmental Mesonet</a>'
                : 'Radar: your radar provider · Warnings: NWS via Iowa Environmental Mesonet'
            }
            opacity={0.65}
            maxNativeZoom={usingDefaultRadar ? 10 : undefined}
            zIndex={10}
            eventHandlers={{ tileerror: () => setRadarFailed(true) }}
          />
        )}
        <FitToSearch lat={center.lat} lon={center.lon} radiusMiles={radiusMiles} />
        <Circle
          center={[center.lat, center.lon]}
          radius={radiusMiles * METERS_PER_MILE}
          pathOptions={{ color: '#1e3a5f', weight: 1, fillOpacity: 0.04, dashArray: '4 4' }}
        />
        {warnings.map((w) => (
          <GeoJSON
            key={w.id}
            data={{ type: 'Feature', properties: {}, geometry: w.geometry } as any}
            style={{ color: WARNING_COLORS[w.phenomena] ?? '#f59e0b', weight: 2.5, fillOpacity: 0.1 }}
          >
            <Popup>
              <div className="text-xs space-y-1 min-w-[200px]">
                <div className="font-semibold text-sm text-gray-900">{w.title}</div>
                <div className="text-gray-600">{formatWhen(w.polygonBegin ?? w.issued)} to {formatWhen(w.polygonEnd)}</div>
                {(w.windMph != null || w.hailInches != null) && (
                  <div className="text-gray-600">
                    {[w.windMph != null ? `Wind up to ${w.windMph} mph` : null, w.hailInches != null ? `hail up to ${w.hailInches}"` : null].filter(Boolean).join(', ')}
                  </div>
                )}
                {w.tornado && <div className="text-gray-600">Tornado: {w.tornado.toLowerCase()}</div>}
              </div>
            </Popup>
          </GeoJSON>
        ))}
        {ordered.map((r) => {
          const color = STORM_CATEGORY_COLORS[r.category];
          const isSelected = r.id === selectedId;
          const isRadar = r.source === 'radar';
          const faded = !!selectedId && !isSelected && !!relatedIds && !relatedIds.has(r.id);
          return (
            <CircleMarker
              key={r.id}
              center={[r.lat, r.lon]}
              radius={isSelected ? 10 : isRadar ? 5 : 7}
              ref={(marker) => {
                if (marker) markers.current.set(r.id, marker);
                else markers.current.delete(r.id);
              }}
              pathOptions={{
                color: isSelected ? '#111827' : color,
                weight: isSelected ? 3 : isRadar ? 1 : 2,
                opacity: faded ? 0.2 : 1,
                fillColor: color,
                fillOpacity: faded ? 0.08 : isRadar ? 0.25 : 0.85,
              }}
              eventHandlers={{ click: () => onSelect(r.id) }}
            >
              <Popup>{renderPopup(r)}</Popup>
            </CircleMarker>
          );
        })}
        <CircleMarker
          center={[center.lat, center.lon]}
          radius={8}
          pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#111827', fillOpacity: 1 }}
        >
          <Tooltip direction="top" offset={[0, -8]}>{center.label}</Tooltip>
        </CircleMarker>
        <FocusSelected report={selected} markers={markers} />
        <FitWarnings report={selected} warnings={warnings} />
      </MapContainer>

      {/* Map provider notes, top right. */}
      <div className="absolute right-3 top-3 z-[1000] flex max-w-[min(340px,calc(100%-72px))] flex-col items-end gap-2">
        {providerFailed && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/95 p-2.5 text-xs text-amber-800 shadow-md">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              {mapSettings.providerName} didn't load, so the free map is showing. Check the key in{' '}
              <button type="button" onClick={openMapSettings} className="font-semibold underline">Settings → Map Provider</button>.
            </span>
          </div>
        )}
        {showProviderNote && (
          <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white/95 p-2.5 text-xs text-gray-700 shadow-md">
            <Layers size={14} className="mt-0.5 shrink-0 text-blue-600" />
            <span>
              This is the free map and NOAA radar. For satellite views, more detailed maps or a more in-depth radar service, your
              team can add a map provider's API key in{' '}
              <button type="button" onClick={openMapSettings} className="font-semibold text-blue-600 hover:underline">
                Settings → Map Provider
              </button>
              .
            </span>
            <button type="button" onClick={dismissNote} aria-label="Dismiss" className="shrink-0 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          </div>
        )}
        {!mapSettings.loading && !providerFailed && mapSettings.tilesSource !== 'free' && (
          <div className="rounded-full border border-gray-200 bg-white/90 px-2.5 py-1 text-[11px] text-gray-600 shadow-sm">
            Map: {mapSettings.providerName} ({mapSettings.tilesSource === 'personal' ? 'yours' : 'team'})
          </div>
        )}
      </div>

      {/* Radar controls and legend, bottom left. */}
      <div className="absolute left-3 bottom-3 z-[1000] w-[min(380px,calc(100%-24px))] rounded-lg bg-white/95 shadow-md border border-gray-200 p-3 text-xs">
        {frameTime ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 font-semibold text-gray-900">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={showRadar}
                  onChange={(e) => {
                    setShowRadar(e.target.checked);
                    if (!e.target.checked) setPlaying(false);
                  }}
                />
                Radar{!usingDefaultRadar && <span className="font-normal text-gray-500">({mapSettings.radarSource === 'personal' ? 'your service' : 'team service'})</span>}
              </label>
              <span className="text-gray-600 tabular-nums">
                {frameTime.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                {radarOffset === 0 ? ' · report time' : ` · ${radarOffset > 0 ? '+' : ''}${radarOffset} min`}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700"
                aria-label={playing ? 'Pause radar' : 'Play radar'}
              >
                {playing ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <input
                type="range"
                min={-RADAR_RANGE_MINUTES}
                max={RADAR_RANGE_MINUTES}
                step={RADAR_STEP_MINUTES}
                value={radarOffset}
                onChange={(e) => {
                  setPlaying(false);
                  setShowRadar(true);
                  setRadarOffset(Number(e.target.value));
                }}
                className="flex-1 accent-blue-600"
                aria-label="Radar time"
              />
            </div>
            {radarFailed && showRadar ? (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-700">
                <AlertTriangle size={12} /> Radar images didn't load for this time. Move the slider to try a nearby frame.
              </div>
            ) : (
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-gray-500">
                <span className="h-2 w-10 rounded-sm" style={{ background: 'linear-gradient(90deg,#04e9e7,#019ff4,#02fd02,#fdf802,#fd9500,#fd0000,#bc0000,#f800fd)' }} />
                Light rain → heavy rain and hail. Drag to see the storm before and after.
              </div>
            )}
            {warnings.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500">
                {warnings
                  .filter((w, i, all) => all.findIndex((x) => x.phenomena === w.phenomena) === i)
                  .map((w) => (
                    <span key={w.phenomena} className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm border-2" style={{ borderColor: WARNING_COLORS[w.phenomena] ?? '#f59e0b' }} />
                      {w.title} area
                    </span>
                  ))}
              </div>
            )}
          </>
        ) : (
          <span className="text-gray-600">Select a report to see the radar, the warning area and the rest of that storm.</span>
        )}
      </div>
    </div>
  );
}

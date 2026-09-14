// Live radar map: the last hour of NOAA radar (5-minute frames, animated), the
// active NWS warning outlines, and the last day's storm reports. The base map
// and radar follow the person's or team's map provider (Settings → Map Provider).
import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, Pause, Play } from 'lucide-react';
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { useMapSettings } from '@/hooks/useMapSettings';
import { FREE_TILES, radarTileUrl } from '@/lib/mapProviders';
import { STORM_CATEGORY_COLORS } from '@/components/crm/StormMap';
import { alertColor, LIVE_RADAR_OFFSETS, liveRadarTileUrl, type LiveAlert } from '@/lib/liveWeather';
import type { StormReport } from '@/lib/stormReports';

const PLAY_INTERVAL_MS = 700;
const PROVIDER_FAILURE_LIMIT = 4;

interface LiveRadarMapProps {
  center: { lat: number; lon: number; label: string };
  zoom: number;
  latestRadarTime: Date | null;
  radarCacheKey: string;
  alerts: LiveAlert[];
  reports: StormReport[];
  renderAlertPopup: (alert: LiveAlert) => React.ReactNode;
  renderReportPopup: (report: StormReport) => React.ReactNode;
}

function Recenter({ lat, lon, zoom }: { lat: number; lon: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], zoom);
  }, [map, lat, lon, zoom]);
  return null;
}

export default function LiveRadarMap({
  center, zoom, latestRadarTime, radarCacheKey, alerts, reports, renderAlertPopup, renderReportPopup,
}: LiveRadarMapProps) {
  const mapSettings = useMapSettings();

  const [providerFailed, setProviderFailed] = useState(false);
  const tileFailures = useRef(0);
  useEffect(() => {
    setProviderFailed(false);
    tileFailures.current = 0;
  }, [mapSettings.tiles.url]);
  const baseTiles = providerFailed ? FREE_TILES : mapSettings.tiles;

  const lastFrame = LIVE_RADAR_OFFSETS.length - 1;
  const [frameIndex, setFrameIndex] = useState(lastFrame);
  const [playing, setPlaying] = useState(false);
  const [showRadar, setShowRadar] = useState(true);
  const [radarFailed, setRadarFailed] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setFrameIndex((i) => (i >= lastFrame ? 0 : i + 1)), PLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playing, lastFrame]);

  useEffect(() => {
    setRadarFailed(false);
  }, [frameIndex, radarCacheKey]);

  const usingDefaultRadar = mapSettings.radarSource === 'default';
  // A custom radar service needs real times; fall back to ten minutes ago if the latest frame time is unknown.
  const baseTime = latestRadarTime ?? new Date(Math.floor((Date.now() - 10 * 60000) / 300000) * 300000);
  const frameUrl = (minutesAgo: number) =>
    usingDefaultRadar
      ? liveRadarTileUrl(minutesAgo, radarCacheKey)
      : radarTileUrl(mapSettings.radarTemplate, new Date(baseTime.getTime() - minutesAgo * 60000));

  const minutesAgo = LIVE_RADAR_OFFSETS[frameIndex];
  const frameTime = latestRadarTime ? new Date(latestRadarTime.getTime() - minutesAgo * 60000) : null;

  const outlined = alerts.filter((a) => a.geometry);
  const legend = outlined.filter((a, i, all) => all.findIndex((x) => x.event === a.event) === i).slice(0, 5);

  return (
    <div className="relative isolate h-[560px] w-full overflow-hidden rounded-xl border border-gray-200">
      <MapContainer center={[center.lat, center.lon]} zoom={zoom} scrollWheelZoom className="h-full w-full">
        <Recenter lat={center.lat} lon={center.lon} zoom={zoom} />
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
        {/* Every frame stays loaded (hidden) so the animation doesn't flicker. */}
        {showRadar &&
          LIVE_RADAR_OFFSETS.map((m, i) => (
            <TileLayer
              key={`${radarCacheKey}-${usingDefaultRadar ? 'iem' : 'custom'}-${m}`}
              url={frameUrl(m)}
              opacity={i === frameIndex ? 0.65 : 0}
              maxNativeZoom={usingDefaultRadar ? 10 : undefined}
              zIndex={10}
              attribution={
                i === lastFrame
                  ? usingDefaultRadar
                    ? 'Radar: NOAA NEXRAD via <a href="https://mesonet.agron.iastate.edu/">Iowa Environmental Mesonet</a> · Alerts: <a href="https://www.weather.gov/">National Weather Service</a>'
                    : 'Radar: your radar provider · Alerts: <a href="https://www.weather.gov/">National Weather Service</a>'
                  : undefined
              }
              eventHandlers={{ tileerror: () => { if (i === frameIndex) setRadarFailed(true); } }}
            />
          ))}
        {outlined.map((a) => (
          <GeoJSON
            key={a.id}
            data={{ type: 'Feature', properties: {}, geometry: a.geometry } as any}
            style={{ color: alertColor(a.event), weight: 2.5, fillOpacity: 0.08 }}
          >
            <Popup>{renderAlertPopup(a)}</Popup>
          </GeoJSON>
        ))}
        {reports.map((r) => (
          <CircleMarker
            key={r.id}
            center={[r.lat, r.lon]}
            radius={6}
            pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: STORM_CATEGORY_COLORS[r.category], fillOpacity: 0.95 }}
          >
            <Popup>{renderReportPopup(r)}</Popup>
          </CircleMarker>
        ))}
        <CircleMarker
          center={[center.lat, center.lon]}
          radius={8}
          pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#111827', fillOpacity: 1 }}
        >
          <Tooltip direction="top" offset={[0, -8]}>{center.label}</Tooltip>
        </CircleMarker>
      </MapContainer>

      <div className="absolute right-3 top-3 z-[1000] flex max-w-[min(340px,calc(100%-72px))] flex-col items-end gap-2">
        {providerFailed && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/95 p-2.5 text-xs text-amber-800 shadow-md">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {mapSettings.providerName} didn't load, so the free map is showing. Check the key in Settings → Map Provider.
          </div>
        )}
        {mapSettings.providerProblem && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/95 p-2.5 text-xs text-amber-800 shadow-md">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{mapSettings.providerProblem} Showing the free map until it's fixed in Settings → Map Provider.</span>
          </div>
        )}
        {!mapSettings.loading && !providerFailed && mapSettings.tilesSource !== 'free' && (
          <div className="rounded-full border border-gray-200 bg-white/90 px-2.5 py-1 text-[11px] text-gray-600 shadow-sm">
            Map: {mapSettings.providerName} ({mapSettings.tilesSource === 'personal' ? 'yours' : 'team'})
          </div>
        )}
      </div>

      <div className="absolute left-3 bottom-3 z-[1000] w-[min(380px,calc(100%-24px))] rounded-lg bg-white/95 shadow-md border border-gray-200 p-3 text-xs">
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
            Live radar
            {!usingDefaultRadar && <span className="font-normal text-gray-500">({mapSettings.radarSource === 'personal' ? 'your service' : 'team service'})</span>}
          </label>
          <span className="text-gray-600 tabular-nums">
            {frameTime ? frameTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
            {minutesAgo === 0 ? ' · latest' : ` · ${minutesAgo} min earlier`}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowRadar(true);
              setPlaying((p) => !p);
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700"
            aria-label={playing ? 'Pause radar' : 'Play the last hour of radar'}
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <input
            type="range"
            min={0}
            max={lastFrame}
            step={1}
            value={frameIndex}
            onChange={(e) => {
              setPlaying(false);
              setShowRadar(true);
              setFrameIndex(Number(e.target.value));
            }}
            className="flex-1 accent-blue-600"
            aria-label="Radar frame"
          />
        </div>
        {radarFailed && showRadar ? (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-700">
            <AlertTriangle size={12} /> This radar frame didn't load. Try another frame or refresh.
          </div>
        ) : (
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-gray-500">
            <span className="h-2 w-10 rounded-sm" style={{ background: 'linear-gradient(90deg,#04e9e7,#019ff4,#02fd02,#fdf802,#fd9500,#fd0000,#bc0000,#f800fd)' }} />
            Light rain → heavy rain and hail. Press play to loop the last hour.
          </div>
        )}
        {legend.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500">
            {legend.map((a) => (
              <span key={a.event} className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm border-2" style={{ borderColor: alertColor(a.event) }} />
                {a.event}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Map for Storm Search: the searched address, the search radius, and each storm
// report where it happened. Ground reports are solid dots; radar estimates are
// faded. Selecting a report overlays the NOAA NEXRAD radar picture from that
// moment (Iowa Environmental Mesonet's archived national composite, 5-minute
// steps), with a time slider to watch the storm cross the area.
// OpenStreetMap tiles, no API key.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Pause, Play } from 'lucide-react';
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { StormCategory, StormReport } from '@/lib/stormReports';

export const STORM_CATEGORY_COLORS: Record<StormCategory, string> = {
  hail: '#2563eb',
  wind: '#0d9488',
  damage: '#ea580c',
  tornado: '#dc2626',
  flood: '#0891b2',
  other: '#6b7280',
};

const METERS_PER_MILE = 1609.34;
const RADAR_STEP_MINUTES = 5;
const RADAR_RANGE_MINUTES = 60;
const RADAR_PLAY_FROM = -30;
const RADAR_PLAY_TO = 30;
const RADAR_PLAY_INTERVAL_MS = 900;

const pad = (n: number) => String(n).padStart(2, '0');

/** The radar frame (UTC, 5-minute steps) for a report time plus an offset, as YYYYMMDDHHMM. */
function radarFrame(iso: string, offsetMinutes: number): { stamp: string; time: Date } | null {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const step = RADAR_STEP_MINUTES * 60000;
  const time = new Date(Math.floor((t + offsetMinutes * 60000) / step) * step);
  const stamp = `${time.getUTCFullYear()}${pad(time.getUTCMonth() + 1)}${pad(time.getUTCDate())}${pad(time.getUTCHours())}${pad(time.getUTCMinutes())}`;
  return { stamp, time };
}

interface StormMapProps {
  center: { lat: number; lon: number; label: string };
  radiusMiles: number;
  reports: StormReport[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  renderPopup: (report: StormReport) => React.ReactNode;
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

export default function StormMap({ center, radiusMiles, reports, selectedId, onSelect, renderPopup }: StormMapProps) {
  const markers = useRef(new Map<string, L.CircleMarker>());
  const selected = useMemo(() => reports.find((r) => r.id === selectedId) ?? null, [reports, selectedId]);
  // Radar first so ground reports draw on top of them.
  const ordered = useMemo(
    () => [...reports].sort((a, b) => (a.source === b.source ? 0 : a.source === 'radar' ? -1 : 1)),
    [reports],
  );

  const [showRadar, setShowRadar] = useState(true);
  const [radarOffset, setRadarOffset] = useState(0);
  const [playing, setPlaying] = useState(false);

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

  const frame = selected ? radarFrame(selected.validUtc, radarOffset) : null;
  const radarVisible = !!frame && showRadar;

  const togglePlay = () => {
    if (!playing && (radarOffset < RADAR_PLAY_FROM || radarOffset >= RADAR_PLAY_TO)) setRadarOffset(RADAR_PLAY_FROM);
    setShowRadar(true);
    setPlaying((p) => !p);
  };

  return (
    <div className="relative isolate h-[480px] w-full overflow-hidden rounded-xl border border-gray-200">
      <MapContainer center={[center.lat, center.lon]} zoom={10} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {radarVisible && frame && (
          <TileLayer
            key="radar"
            url={`https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::USCOMP-N0Q-${frame.stamp}/{z}/{x}/{y}.png`}
            attribution='Radar: NOAA NEXRAD via <a href="https://mesonet.agron.iastate.edu/">Iowa Environmental Mesonet</a>'
            opacity={0.65}
            maxNativeZoom={10}
            zIndex={10}
          />
        )}
        <FitToSearch lat={center.lat} lon={center.lon} radiusMiles={radiusMiles} />
        <Circle
          center={[center.lat, center.lon]}
          radius={radiusMiles * METERS_PER_MILE}
          pathOptions={{ color: '#1e3a5f', weight: 1, fillOpacity: 0.04, dashArray: '4 4' }}
        />
        {ordered.map((r) => {
          const color = STORM_CATEGORY_COLORS[r.category];
          const isSelected = r.id === selectedId;
          const isRadar = r.source === 'radar';
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
                fillColor: color,
                fillOpacity: isRadar ? 0.25 : 0.85,
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
      </MapContainer>

      {/* Radar controls sit above the map panes. */}
      <div className="absolute left-3 bottom-3 z-[1000] w-[min(360px,calc(100%-24px))] rounded-lg bg-white/95 shadow-md border border-gray-200 p-3 text-xs">
        {frame ? (
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
                Radar
              </label>
              <span className="text-gray-600 tabular-nums">
                {frame.time.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
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
            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="h-2 w-10 rounded-sm" style={{ background: 'linear-gradient(90deg,#04e9e7,#019ff4,#02fd02,#fdf802,#fd9500,#fd0000,#bc0000,#f800fd)' }} />
              Light rain → heavy rain and hail. Drag to see the storm before and after.
            </div>
          </>
        ) : (
          <span className="text-gray-600">Select a report to see the radar picture from that moment.</span>
        )}
      </div>
    </div>
  );
}

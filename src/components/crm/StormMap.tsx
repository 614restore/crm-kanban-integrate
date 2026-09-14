// Map for Storm Search: the searched address, the search radius, and each storm
// report where it happened. Ground reports are solid dots; radar estimates are
// faded. OpenStreetMap tiles, no API key.
import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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

  return (
    <div className="relative isolate h-[440px] w-full overflow-hidden rounded-xl border border-gray-200">
      <MapContainer center={[center.lat, center.lon]} zoom={10} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
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
    </div>
  );
}

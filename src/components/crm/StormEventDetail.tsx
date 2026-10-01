// What a storm event on the weather check really covered, and whether this address was in it.
//
// Opens from an event in the weather check (HailTracePanel). It draws the address, the storm's
// radar spot and the National Weather Service warning areas in effect around that time, and says
// plainly whether the address was inside one. Built on the same map and warning lookup as Storm Search.
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Loader2, MapPin, X, XCircle } from 'lucide-react';
import StormMap from '@/components/crm/StormMap';
import {
  compassDirection,
  fetchStormWarnings,
  haversineMiles,
  type StormReport,
  type StormWarning,
} from '@/lib/stormReports';

export interface StormEventForDetail {
  /** YYYY-MM-DD (UTC). */
  date: string;
  /** HH:MM (UTC). */
  time: string;
  kind: 'hail' | 'tornado';
  severity: 'minor' | 'moderate' | 'severe';
  hailSize?: number;
  lat: number;
  lon: number;
  radarStation?: string;
  hailProbability?: number;
  severeProbability?: number;
}

interface Props {
  event: StormEventForDetail;
  property: { lat: number; lon: number; label: string };
  /** The distance the weather check searched within. */
  radiusMiles: number;
  onClose: () => void;
}

const whenLocal = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';

const threatText = (w: StormWarning) =>
  [w.windMph != null ? `wind up to ${w.windMph} mph` : null, w.hailInches != null ? `hail up to ${w.hailInches}"` : null]
    .filter(Boolean)
    .join(', ');

export default function StormEventDetail({ event, property, radiusMiles, onClose }: Props) {
  const report = useMemo<StormReport>(() => {
    const distanceMiles = Math.round(haversineMiles(property.lat, property.lon, event.lat, event.lon) * 10) / 10;
    return {
      id: 'event',
      source: 'radar',
      category: event.kind === 'tornado' ? 'tornado' : 'hail',
      typeText: event.kind === 'tornado' ? 'TORNADO VORTEX SIGNATURE' : 'RADAR HAIL SIGNATURE',
      title: event.kind === 'tornado' ? 'Tornado signature (radar)' : 'Hail signature (radar)',
      magnitude: event.hailSize ?? null,
      unit: event.hailSize != null ? 'in' : null,
      lat: event.lat,
      lon: event.lon,
      distanceMiles,
      direction: compassDirection(property.lat, property.lon, event.lat, event.lon),
      validUtc: `${event.date}T${event.time}:00Z`,
      severity: event.severity,
      radarStation: event.radarStation ?? null,
      hailProbability: event.hailProbability ?? null,
      severeProbability: event.severeProbability ?? null,
    };
  }, [event, property.lat, property.lon]);

  const [warnings, setWarnings] = useState<StormWarning[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setWarnings(null);
    setFailed(false);
    fetchStormWarnings(report, { lat: property.lat, lon: property.lon })
      .then((w) => { if (!cancelled) setWarnings(w); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [report, property.lat, property.lon]);

  const inside = warnings?.filter((w) => w.containsAddress) ?? [];
  const nearOnly = warnings?.filter((w) => !w.containsAddress && w.containsReport) ?? [];

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-3"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {report.title}
              {report.magnitude != null ? ` · ${report.magnitude}" hail` : ''}
            </h3>
            <p className="mt-0.5 text-sm text-gray-500">
              {whenLocal(report.validUtc)} · {report.distanceMiles} mi {report.direction} of this address
              {report.radarStation ? ` · radar ${report.radarStation}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          {/* The answer */}
          {warnings === null && !failed && (
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
              <Loader2 size={16} className="animate-spin" /> Checking National Weather Service warning areas for this time…
            </div>
          )}
          {failed && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              The warning areas could not be loaded just now. The map below still shows the storm and this address. Close this and try again.
            </div>
          )}
          {warnings !== null && inside.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-600" />
              <div>
                <p className="font-semibold">Yes — this address was inside a warning area.</p>
                {inside.map((w) => (
                  <p key={w.id} className="mt-1">
                    {w.title}, {whenLocal(w.polygonBegin ?? w.issued)} to {whenLocal(w.polygonEnd)}
                    {threatText(w) ? ` (${threatText(w)})` : ''}.
                  </p>
                ))}
              </div>
            </div>
          )}
          {warnings !== null && inside.length === 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
              <XCircle size={18} className="mt-0.5 shrink-0 text-gray-500" />
              <div>
                <p className="font-semibold">No — this address was outside the warning areas around this time.</p>
                <p className="mt-1">
                  {nearOnly.length > 0
                    ? `A warning covered the storm itself (${nearOnly.map((w) => w.title).join(', ')}) but its area did not include this address.`
                    : 'No National Weather Service warning area covered this address or the storm’s radar spot.'}{' '}
                  The radar signature was {report.distanceMiles} miles {report.direction} of the address, inside the {radiusMiles}-mile search.
                </p>
              </div>
            </div>
          )}

          <StormMap
            center={property}
            radiusMiles={radiusMiles}
            reports={[report]}
            selectedId={report.id}
            onSelect={() => undefined}
            renderPopup={(r) => (
              <div className="min-w-[180px] text-xs">
                <div className="text-sm font-semibold text-gray-900">{r.title}</div>
                <div className="text-gray-600">{r.distanceMiles} mi {r.direction} of the address</div>
                {r.magnitude != null && <div className="text-gray-600">Up to {r.magnitude}" hail (radar estimate)</div>}
              </div>
            )}
            warnings={warnings ?? []}
          />

          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-gray-500">
            <MapPin size={13} className="mt-0.5 shrink-0" />
            A warning area is where the National Weather Service said severe weather was threatening. It is not a measurement of damage,
            and a radar hail signature is an estimate for one storm cell. Use both as supporting evidence, not proof either way.
            Drag the radar slider on the map to watch the storm move.
          </p>
        </div>
      </div>
    </div>
  );
}

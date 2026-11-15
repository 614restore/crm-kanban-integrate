// Quote Builder section: find the storms recorded near the customer's address and attach the
// chosen ones to the quote or inspection report as a Storm Report page. Uses the company's
// storm history settings (how far back, how far around, smallest wind and hail).
import React, { useState } from 'react';
import { CloudLightning, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { geocodeAddress } from '@/lib/geocode';
import { searchStormReports, type StormReport } from '@/lib/stormReports';
import {
  describeStormEntry,
  formatStormDate,
  hasStormReport,
  toStormReportEntry,
  type QuoteStormReport,
} from '@/lib/stormReportDoc';

// Hail, wind, tornadoes and damage reports belong in a roofing storm report; floods and the rest don't.
const RELEVANT = new Set(['hail', 'wind', 'tornado', 'damage']);
const DEFAULTS = { months: 12, radiusMiles: 10, minWindMph: 0, minHailInches: 0 };

interface StormReportSectionProps {
  companyId: string;
  /** The property address, as one line. */
  address: string;
  value: QuoteStormReport | null;
  onChange: (next: QuoteStormReport | null) => void;
}

export default function StormReportSection({ companyId, address, value, onChange }: StormReportSectionProps) {
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<StormReport[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState(DEFAULTS);

  const search = async () => {
    if (!address.trim()) {
      toast.error('Add the customer\'s address first.');
      return;
    }
    setSearching(true);
    try {
      const { data } = await supabase
        .from('companies')
        .select('storm_history_months, storm_history_radius_miles, storm_history_min_wind_mph, storm_history_min_hail_in')
        .eq('id', companyId)
        .maybeSingle();
      const row = (data ?? {}) as Record<string, unknown>;
      const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) && v != null ? Number(v) : d);
      const s = {
        months: num(row.storm_history_months, DEFAULTS.months),
        radiusMiles: num(row.storm_history_radius_miles, DEFAULTS.radiusMiles),
        minWindMph: num(row.storm_history_min_wind_mph, DEFAULTS.minWindMph),
        minHailInches: num(row.storm_history_min_hail_in, DEFAULTS.minHailInches),
      };
      setSettings(s);

      const place = await geocodeAddress(address);
      if (!place) {
        toast.error('That address could not be found on the map.');
        return;
      }
      const { reports } = await searchStormReports({
        lat: place.lat, lon: place.lon, state: place.state, months: s.months, radiusMiles: s.radiusMiles,
      });
      const relevant = reports
        .filter((r) => RELEVANT.has(r.category))
        .filter((r) => !(r.category === 'wind' && r.magnitude != null && r.magnitude < s.minWindMph))
        .filter((r) => !(r.category === 'hail' && r.magnitude != null && r.magnitude < s.minHailInches))
        .sort((a, b) => new Date(b.validUtc).getTime() - new Date(a.validUtc).getTime());
      setFound(relevant);
      // Start with the ten closest picked; the rest are a tick away.
      setPicked(new Set([...relevant].sort((a, b) => a.distanceMiles - b.distanceMiles).slice(0, 10).map((r) => r.id)));
      if (relevant.length === 0) toast.info('No hail, wind or tornado reports found for this address in that period.');
    } catch (err) {
      console.error('[StormReport] search failed:', err);
      toast.error('Storm history could not be loaded. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const attach = () => {
    if (!found) return;
    const chosen = found.filter((r) => picked.has(r.id));
    if (chosen.length === 0) {
      toast.error('Pick at least one storm.');
      return;
    }
    onChange({
      address,
      radiusMiles: settings.radiusMiles,
      months: settings.months,
      generatedAt: new Date().toISOString(),
      entries: chosen.map(toStormReportEntry),
    });
    setFound(null);
    toast.success(`Storm report with ${chosen.length} ${chosen.length === 1 ? 'storm' : 'storms'} attached.`);
  };

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <CloudLightning className="w-5 h-5 text-blue-600" /> Storm Report
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Hail, wind and tornado reports near this property, added as a page the customer and adjuster can see.
          </p>
        </div>
        {!found && (
          <button
            type="button"
            onClick={search}
            disabled={searching}
            className="whitespace-nowrap inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-[#1e3a5f] text-white hover:bg-[#162d4a] disabled:opacity-60"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : hasStormReport(value) ? <RefreshCw className="w-4 h-4" /> : <CloudLightning className="w-4 h-4" />}
            {hasStormReport(value) ? 'Search again' : 'Find storms'}
          </button>
        )}
      </div>

      {found && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Within {settings.radiusMiles} miles over the last {settings.months} {settings.months === 1 ? 'month' : 'months'} (your storm history settings). Tick the storms to include.
          </p>
          {found.length > 0 && (
            <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
              {found.map((r) => (
                <li key={r.id}>
                  <label className="flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" className="mt-1" checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
                    <span className="min-w-0 text-sm">
                      <span className="font-medium text-gray-900">{describeStormEntry(r)}</span>
                      <span className="text-gray-500"> · {formatStormDate(r.validUtc)} · {r.distanceMiles.toFixed(1)} mi {r.direction}</span>
                      {r.place && <span className="block text-xs text-gray-400 truncate">{[r.place, r.state].filter(Boolean).join(', ')}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            {found.length > 0 && (
              <button type="button" onClick={attach} className="px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                Attach {picked.size} {picked.size === 1 ? 'storm' : 'storms'}
              </button>
            )}
            <button type="button" onClick={() => setFound(null)} className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {!found && hasStormReport(value) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
          <p className="text-sm text-blue-900">
            {value.entries.length} {value.entries.length === 1 ? 'storm' : 'storms'} attached
            {' · '}latest {formatStormDate(value.entries.map((e) => e.date).sort().reverse()[0])}
          </p>
          <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700">
            <Trash2 className="w-4 h-4" /> Remove
          </button>
        </div>
      )}
    </div>
  );
}

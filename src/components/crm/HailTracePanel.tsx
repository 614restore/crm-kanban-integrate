import React, { useState } from 'react';
import { geocodeAddress } from '@/lib/geocode';
import { CloudRain, Loader2, AlertTriangle, CheckCircle, Wind, Copy, Check, FileText } from 'lucide-react';
import { HailTraceIntegration, NOAAWeatherIntegration, NOAAStormEvent } from '@/lib/integrations/weather';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/database';
import { toast } from 'sonner';

interface HailTracePanelProps {
  address: string;
  city: string;
  state: string;
  zip: string;
  companyId: string;
  contactId?: string;
  contactName?: string;
  /** Called when moderate/severe events are found so parent can act (e.g. switch to insurance tab) */
  onEventsFound?: (count: number, severities: string[]) => void;
  /** Called when user wants to start a new insurance claim from this hail event */
  onStartClaim?: () => void;
}

interface HailEvent {
  date: string;
  time?: string;
  severity: 'minor' | 'moderate' | 'severe';
  hailSize?: number;       // inches
  windSpeed?: number;      // mph
  windGust?: number;       // mph
  stormId?: string;
  distanceMiles?: number;
  location?: string;
}

const severityConfig = {
  minor:    { label: 'Minor',    className: 'bg-yellow-100 text-yellow-800 border border-yellow-200' },
  moderate: { label: 'Moderate', className: 'bg-orange-100 text-orange-800 border border-orange-200' },
  severe:   { label: 'Severe',   className: 'bg-red-100 text-red-800 border border-red-200' },
};

function getDateRange(months: number) {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - months);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

function formatClaimText(events: HailEvent[], address: string, city: string, state: string, zip: string): string {
  const fullAddress = [address, city, state, zip].filter(Boolean).join(', ');
  const lines = [
    `HAIL & WIND EVENT REPORT`,
    `Property: ${fullAddress}`,
    `Report Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    `Events Found: ${events.length}`,
    ``,
    `─────────────────────────────────────`,
  ];
  events.forEach((e, i) => {
    lines.push(`Event ${i + 1}`);
    lines.push(`  Date:       ${e.date}${e.time ? ' at ' + e.time : ''}`);
    lines.push(`  Severity:   ${severityConfig[e.severity]?.label ?? e.severity}`);
    if (e.hailSize != null)    lines.push(`  Hail Size:  ${e.hailSize}" diameter`);
    if (e.windSpeed != null)   lines.push(`  Wind Speed: ${e.windSpeed} mph`);
    if (e.windGust != null)    lines.push(`  Wind Gust:  ${e.windGust} mph`);
    if (e.distanceMiles != null) lines.push(`  Distance:   ${e.distanceMiles} miles from property`);
    if (e.stormId)             lines.push(`  Storm ID:   ${e.stormId}`);
    lines.push(`─────────────────────────────────────`);
  });
  lines.push(`Source: HailTrace — hailtrace.com`);
  return lines.join('\n');
}

export default function HailTracePanel({ address, city, state, zip, companyId, contactId, contactName, onEventsFound, onStartClaim }: HailTracePanelProps) {
  const [months, setMonths] = useState(12);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<HailEvent[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'no-events' | 'events'>('idle');
  const [source, setSource] = useState<'hailtrace' | 'noaa' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function normalizeNoaaEvents(noaaEvents: NOAAStormEvent[]): HailEvent[] {
    return noaaEvents.map((e) => ({
      date: e.date,
      time: e.time,
      severity: e.severity,
      hailSize: e.hailSize,
      distanceMiles: e.distanceMiles,
      stormId: e.radarStation,
      location: e.type === 'tornado' ? 'Tornado vortex signature (radar)' : undefined,
    }));
  }

  async function geocode(): Promise<{ lat: number; lon: number } | null> {
    const found = await geocodeAddress(`${address}, ${city}, ${state} ${zip}`);
    return found ? { lat: found.lat, lon: found.lon } : null;
  }

  async function notifyActionableEvents(normalized: HailEvent[], eventSource: 'hailtrace' | 'noaa') {
    const actionable = normalized.filter(e => e.severity === 'moderate' || e.severity === 'severe');
    if (actionable.length === 0) return;
    const severities = [...new Set(actionable.map(e => e.severity))];
    const sourceLabel = eventSource === 'noaa' ? ' (NOAA)' : '';
    const maxHail = Math.max(...actionable.map(e => e.hailSize ?? 0));
    const maxWind = Math.max(...actionable.map(e => e.windSpeed ?? 0));
    try {
      await db.createNotification({
        company_id: companyId,
        type: 'hail_event',
        title: `⚡ Hail Event Detected${sourceLabel}${contactName ? ` — ${contactName}` : ''}`,
        message: `${actionable.length} actionable storm event${actionable.length > 1 ? 's' : ''} found at ${[address, city, state].filter(Boolean).join(', ')}.${maxHail ? ` Largest hail: ${maxHail}"` : ''}${maxWind ? ` • Max wind: ${maxWind} mph` : ''}. Consider opening an insurance claim.`,
        related_id: contactId,
        related_type: 'contact',
        read: false,
      });
    } catch { /* non-critical */ }
    toast.warning(`${actionable.length} storm event${actionable.length > 1 ? 's' : ''} found! Check insurance tab to open a claim.`, { duration: 6000 });
    onEventsFound?.(actionable.length, severities);
  }

  /** Free, no-key fallback/default — real NOAA radar data, not a demo. */
  async function checkViaNOAA(coords: { lat: number; lon: number } | null) {
    if (!coords) {
      setError('Could not locate this address. Check that it is complete and try again.');
      setStatus('idle');
      return;
    }
    const noaa = new NOAAWeatherIntegration();
    const noaaEvents = await noaa.getStormHistory(coords.lat, coords.lon, months, 10);
    const normalized = normalizeNoaaEvents(noaaEvents);
    setEvents(normalized);
    setSource('noaa');
    setStatus(normalized.length > 0 ? 'events' : 'no-events');
    if (normalized.length > 0) await notifyActionableEvents(normalized, 'noaa');
  }

  async function handleCheck() {
    setLoading(true);
    setError(null);
    setStatus('idle');
    setEvents(null);
    setSource(null);
    setCopied(false);

    try {
      // Refresh the session before querying — guards against dormancy and
      // private-browser scenarios where the in-memory token may be stale.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Your session has expired. Please sign in again to use HailTrace.');
        setStatus('idle');
        return;
      }

      const { data: integrationData, error: dbError } = await supabase
        .from('company_integrations')
        .select('credentials')
        .eq('company_id', companyId)
        .eq('integration_id', 'hailtrace')
        .single();

      const coords = await geocode();

      if (dbError && dbError.code !== 'PGRST116') {
        // PGRST116 = no rows found, which is normal (no HailTrace configured).
        // Any other error is unexpected, but NOAA doesn't depend on this
        // table at all — fall back to it rather than dead-ending the user
        // on a config-lookup failure that has nothing to do with NOAA.
        await checkViaNOAA(coords);
        return;
      }

      const apiKey = integrationData?.credentials?.apiKey;

      // No paid HailTrace key configured — NOAA is the free default, not a
      // gate. Real radar data, no subscription required.
      if (!apiKey) {
        await checkViaNOAA(coords);
        return;
      }

      try {
        const ht = new HailTraceIntegration(apiKey);
        let result: any;

        if (coords) {
          result = await ht.checkHailDamage(coords.lat, coords.lon, 5);
        } else {
          const range = getDateRange(months);
          result = await ht.getHailEvents(range.from, range.to);
        }

        const rawEvents: any[] = Array.isArray(result) ? result : (result?.events ?? []);
        const normalized: HailEvent[] = rawEvents.map((e: any) => ({
          date:          e.date ?? e.event_date ?? '',
          time:          e.time ?? e.event_time,
          severity:      e.severity ?? 'minor',
          hailSize:      e.hail_size ?? e.hailSize ?? e.max_hail_size,
          windSpeed:     e.wind_speed ?? e.windSpeed,
          windGust:      e.wind_gust ?? e.windGust,
          stormId:       e.storm_id ?? e.stormId ?? e.id,
          distanceMiles: e.distance_miles ?? e.distanceMiles ?? e.distance,
          location:      e.location,
        }));

        setEvents(normalized);
        setSource('hailtrace');
        setStatus(normalized.length > 0 ? 'events' : 'no-events');
        if (normalized.length > 0) await notifyActionableEvents(normalized, 'hailtrace');
      } catch {
        // HailTrace call failed (bad key, outage, etc.) — fall back to real
        // NOAA data instead of fabricated demo events.
        await checkViaNOAA(coords);
      }
    } catch {
      setError('Unexpected error checking storm events.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!events) return;
    const text = formatClaimText(events, address, city, state, zip);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const showResults = !loading && status === 'events' && events && events.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CloudRain className="text-blue-600" size={20} />
          <h3 className="text-lg font-semibold text-gray-900">Hail &amp; Wind Event Lookup</h3>
        </div>
        {showResults && (
          <div className="flex items-center gap-2">
            {onStartClaim && (
              <button
                onClick={onStartClaim}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <FileText size={13} />
                Start Insurance Claim
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
            >
              {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy for Claim'}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Look back</label>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m} {m === 1 ? 'month' : 'months'}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleCheck}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <CloudRain size={16} />}
          Check Events
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
          <Loader2 size={16} className="animate-spin" />
          Checking hail &amp; wind events…
        </div>
      )}

      {/* No events */}
      {!loading && status === 'no-events' && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          <CheckCircle size={16} className="mt-0.5 shrink-0" />
          No hail or wind events found for this address in the selected period.
        </div>
      )}

      {/* Source badge — which data source produced these results */}
      {showResults && source === 'noaa' && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700 mb-3">
          <CloudRain size={14} className="mt-0.5 shrink-0" />
          <span>
            Source: NOAA (free, radar-derived). For polygon-verified hail swaths and wind speed data,
            connect HailTrace in Settings → Integrations.
          </span>
        </div>
      )}
      {showResults && source === 'hailtrace' && (
        <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-500 mb-3">
          <CheckCircle size={14} className="mt-0.5 shrink-0" />
          Source: HailTrace
        </div>
      )}

      {/* Event cards */}
      {showResults && (
        <div className="space-y-3">
          {events!.map((event, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              {/* Header row */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-semibold text-gray-900 text-sm">
                    {new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  {event.time && <span className="text-gray-500 text-sm ml-2">at {event.time}</span>}
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${severityConfig[event.severity]?.className ?? 'bg-gray-100 text-gray-600'}`}>
                  {severityConfig[event.severity]?.label ?? event.severity}
                </span>
              </div>

              {/* Detail grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {event.hailSize != null && (
                  <div className="bg-white rounded-lg p-2.5 border border-gray-100 text-center">
                    <div className="text-lg font-bold text-blue-700">{event.hailSize}"</div>
                    <div className="text-xs text-gray-500 mt-0.5">Hail Size</div>
                  </div>
                )}
                {event.windSpeed != null && (
                  <div className="bg-white rounded-lg p-2.5 border border-gray-100 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Wind size={14} className="text-blue-500" />
                      <span className="text-lg font-bold text-blue-700">{event.windSpeed}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">Wind mph</div>
                  </div>
                )}
                {event.windGust != null && (
                  <div className="bg-white rounded-lg p-2.5 border border-gray-100 text-center">
                    <div className="text-lg font-bold text-orange-600">{event.windGust}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Gust mph</div>
                  </div>
                )}
                {event.distanceMiles != null && (
                  <div className="bg-white rounded-lg p-2.5 border border-gray-100 text-center">
                    <div className="text-lg font-bold text-gray-700">{event.distanceMiles}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Miles away</div>
                  </div>
                )}
              </div>

              {/* Footer row */}
              <div className="flex items-center gap-4 mt-2.5 text-xs text-gray-400">
                {event.stormId && <span>Storm ID: {event.stormId}</span>}
                {event.location && <span>{event.location}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}


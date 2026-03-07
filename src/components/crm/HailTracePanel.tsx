import React, { useState } from 'react';
import { CloudRain, Loader2, AlertTriangle, CheckCircle, Settings, Wind, Copy, Check } from 'lucide-react';
import { HailTraceIntegration } from '@/lib/integrations/weather';
import { supabase } from '@/lib/supabase';

interface HailTracePanelProps {
  address: string;
  city: string;
  state: string;
  zip: string;
  companyId: string;
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

const MOCK_EVENTS: HailEvent[] = [
  {
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: '2:47 PM',
    severity: 'severe',
    hailSize: 1.75,
    windSpeed: 58,
    windGust: 72,
    stormId: 'STM-2026-0843',
    distanceMiles: 0.3,
    location: 'Direct hit',
  },
  {
    date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: '11:12 AM',
    severity: 'moderate',
    hailSize: 1.0,
    windSpeed: 42,
    windGust: 55,
    stormId: 'STM-2026-0671',
    distanceMiles: 1.2,
    location: '1.2 miles NE',
  },
  {
    date: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: '6:33 PM',
    severity: 'minor',
    hailSize: 0.75,
    windSpeed: 31,
    stormId: 'STM-2025-1204',
    distanceMiles: 2.8,
    location: '2.8 miles SW',
  },
];

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

export default function HailTracePanel({ address, city, state, zip, companyId }: HailTracePanelProps) {
  const [months, setMonths] = useState(12);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<HailEvent[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'no-config' | 'no-events' | 'events' | 'demo'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function geocode(): Promise<{ lat: number; lon: number } | null> {
    try {
      const q = encodeURIComponent(`${address} ${city} ${state} ${zip}`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      }
    } catch { /* fall back */ }
    return null;
  }

  async function handleCheck() {
    setLoading(true);
    setError(null);
    setStatus('idle');
    setEvents(null);
    setCopied(false);

    try {
      const { data: integrationData } = await supabase
        .from('company_integrations')
        .select('credentials')
        .eq('company_id', companyId)
        .eq('integration_type', 'hailtrace')
        .eq('is_active', true)
        .single();

      const apiKey = integrationData?.credentials?.apiKey;
      if (!apiKey) { setStatus('no-config'); return; }

      const coords = await geocode();

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
        setStatus(normalized.length > 0 ? 'events' : 'no-events');
      } catch {
        setEvents(MOCK_EVENTS);
        setStatus('demo');
      }
    } catch {
      setError('Unexpected error checking hail events.');
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

  const showResults = !loading && (status === 'events' || status === 'demo') && events && events.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CloudRain className="text-blue-600" size={20} />
          <h3 className="text-lg font-semibold text-gray-900">Hail &amp; Wind Event Lookup</h3>
        </div>
        {showResults && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
          >
            {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy for Claim'}
          </button>
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

      {/* Not configured */}
      {!loading && status === 'no-config' && (
        <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-500">
          <Settings size={16} className="mt-0.5 shrink-0" />
          <span>HailTrace not configured — connect it in Settings → Integrations.</span>
        </div>
      )}

      {/* No events */}
      {!loading && status === 'no-events' && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          <CheckCircle size={16} className="mt-0.5 shrink-0" />
          No hail or wind events found for this address in the selected period.
        </div>
      )}

      {/* Demo banner */}
      {showResults && status === 'demo' && (
        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-700 mb-3">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Demo data — HailTrace API unavailable. Showing sample results.
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


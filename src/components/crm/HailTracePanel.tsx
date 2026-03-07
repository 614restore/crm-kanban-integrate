import React, { useState } from 'react';
import { CloudRain, Loader2, AlertTriangle, CheckCircle, Settings } from 'lucide-react';
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
  severity: 'minor' | 'moderate' | 'severe';
  hailSize?: number;
  location?: string;
}

const MOCK_EVENTS: HailEvent[] = [
  { date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], severity: 'moderate', hailSize: 1.25 },
  { date: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], severity: 'minor', hailSize: 0.75 },
];

const severityConfig = {
  minor: { label: 'Minor', className: 'bg-yellow-100 text-yellow-800 border border-yellow-200' },
  moderate: { label: 'Moderate', className: 'bg-orange-100 text-orange-800 border border-orange-200' },
  severe: { label: 'Severe', className: 'bg-red-100 text-red-800 border border-red-200' },
};

function formatDateRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

export default function HailTracePanel({ address, city, state, zip, companyId }: HailTracePanelProps) {
  const defaults = formatDateRange();
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<HailEvent[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'no-config' | 'no-events' | 'events' | 'demo'>('idle');
  const [error, setError] = useState<string | null>(null);

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
    } catch {
      // ignore geocoding errors, fall back to mock
    }
    return null;
  }

  async function handleCheck() {
    setLoading(true);
    setError(null);
    setStatus('idle');
    setEvents(null);

    try {
      // Fetch API key from company_integrations
      const { data: integrationData } = await supabase
        .from('company_integrations')
        .select('credentials')
        .eq('company_id', companyId)
        .eq('integration_type', 'hailtrace')
        .eq('is_active', true)
        .single();

      const apiKey = integrationData?.credentials?.apiKey;

      if (!apiKey) {
        setStatus('no-config');
        return;
      }

      const coords = await geocode();

      try {
        const ht = new HailTraceIntegration(apiKey);
        let result: any;

        if (coords) {
          result = await ht.checkHailDamage(coords.lat, coords.lon, 5);
        } else {
          result = await ht.getHailEvents(fromDate, toDate);
        }

        // Normalize response — HailTrace may return { events: [...] } or an array
        const rawEvents: any[] = Array.isArray(result) ? result : (result?.events ?? []);
        const normalized: HailEvent[] = rawEvents.map((e: any) => ({
          date: e.date ?? e.event_date ?? '',
          severity: e.severity ?? 'minor',
          hailSize: e.hail_size ?? e.hailSize,
          location: e.location,
        }));

        setEvents(normalized);
        setStatus(normalized.length > 0 ? 'events' : 'no-events');
      } catch {
        // API call failed — show demo results
        setEvents(MOCK_EVENTS);
        setStatus('demo');
      }
    } catch (err) {
      setError('Unexpected error checking hail events.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <CloudRain className="text-blue-600" size={20} />
        <h3 className="text-lg font-semibold text-gray-900">Hail Event Lookup</h3>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          />
        </div>
        <button
          onClick={handleCheck}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <CloudRain size={16} />}
          Check Hail Events
        </button>
      </div>

      {/* Results */}
      {loading && (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
          <Loader2 size={16} className="animate-spin" />
          Checking hail events…
        </div>
      )}

      {!loading && status === 'no-config' && (
        <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-500">
          <Settings size={16} className="mt-0.5 shrink-0" />
          <span>
            HailTrace not configured — connect it in{' '}
            <a href="/settings/integrations" className="text-blue-600 hover:underline">
              Settings → Integrations
            </a>
            .
          </span>
        </div>
      )}

      {!loading && status === 'no-events' && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          <CheckCircle size={16} className="mt-0.5 shrink-0" />
          No hail events found for this address in the selected date range.
        </div>
      )}

      {!loading && (status === 'events' || status === 'demo') && events && events.length > 0 && (
        <div className="space-y-2">
          {status === 'demo' && (
            <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-700 mb-3">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              Demo data — HailTrace API unavailable. Showing sample results.
            </div>
          )}
          {events.map((event, i) => (
            <div key={i} className="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-3 bg-gray-50">
              <div className="text-sm text-gray-700">{event.date}</div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${severityConfig[event.severity]?.className ?? 'bg-gray-100 text-gray-600'}`}>
                {severityConfig[event.severity]?.label ?? event.severity}
              </span>
              {event.hailSize != null && (
                <div className="text-sm text-gray-500">{event.hailSize}&quot; hail</div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

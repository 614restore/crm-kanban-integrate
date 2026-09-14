import React, { useState } from 'react';
import { CloudRain, Search, Loader2, AlertTriangle, CheckCircle, Wind, MapPin } from 'lucide-react';
import { NOAAWeatherIntegration, NOAAStormEvent } from '@/lib/integrations/weather';
import { geocodeAddress } from '@/lib/geocode';

// Standalone NOAA storm-history search — the "any address, no contact
// required" counterpart to the per-contact Hail & Wind Event Lookup panel
// (Insurance & Supplements tab). Same free NOAA data source and search
// logic, just not tied to a saved contact — useful for canvassing or
// checking a lead's property before they're in the CRM.

const severityConfig = {
  minor:    { label: 'Minor',    className: 'bg-yellow-100 text-yellow-800 border border-yellow-200' },
  moderate: { label: 'Moderate', className: 'bg-orange-100 text-orange-800 border border-orange-200' },
  severe:   { label: 'Severe',   className: 'bg-red-100 text-red-800 border border-red-200' },
};

export default function StormSearchView() {
  const [address, setAddress] = useState('');
  const [months, setMonths] = useState(12);
  const [radius, setRadius] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [events, setEvents] = useState<NOAAStormEvent[] | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!address.trim()) { setError('Enter an address to search.'); return; }
    setLoading(true);
    setError(null);
    setEvents(null);
    setSearched(false);
    try {
      const coords = await geocodeAddress(address);
      if (!coords) {
        setError('Could not locate that address. Check that it is complete (street, city, state) and try again.');
        return;
      }
      setResolvedAddress(coords.displayName);
      const noaa = new NOAAWeatherIntegration();
      const results = await noaa.getStormHistory(coords.lat, coords.lon, months, radius);
      setEvents(results);
      setSearched(true);
    } catch {
      setError('Failed to search storm history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CloudRain className="text-blue-600" size={26} /> Storm Search
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Look up hail and tornado history for any address — free, powered by NOAA radar data. No contact required.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="123 Main St, Columbus, OH 43215"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Search
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-4 mt-4">
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
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Radius</label>
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              {[5, 10, 15, 25].map((r) => (
                <option key={r} value={r}>{r} miles</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-6 justify-center">
          <Loader2 size={16} className="animate-spin" />
          Searching NOAA storm history…
        </div>
      )}

      {!loading && resolvedAddress && (
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
          <MapPin size={13} />
          {resolvedAddress}
        </div>
      )}

      {!loading && searched && events && events.length === 0 && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
          <CheckCircle size={16} className="mt-0.5 shrink-0" />
          No hail or tornado events found within {radius} miles in the last {months} {months === 1 ? 'month' : 'months'}.
        </div>
      )}

      {!loading && events && events.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-400 px-1">
            <span>{events.length} event{events.length === 1 ? '' : 's'} found · Source: NOAA (free, radar-derived)</span>
          </div>
          {events.map((event, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {event.type === 'tornado'
                    ? <Wind size={16} className="text-red-600" />
                    : <CloudRain size={16} className="text-blue-600" />}
                  <span className="font-semibold text-gray-900">
                    {event.type === 'tornado' ? 'Tornado Vortex Signature' : 'Hail'}
                    {event.hailSize ? ` — ${event.hailSize}"` : ''}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityConfig[event.severity].className}`}>
                    {severityConfig[event.severity].label}
                  </span>
                </div>
                <span className="text-xs text-gray-400">{event.distanceMiles} mi away</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>{event.date}{event.time ? ` at ${event.time} UTC` : ''}</span>
                <span>Radar: {event.radarStation}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

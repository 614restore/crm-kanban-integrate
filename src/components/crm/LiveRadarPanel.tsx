// Storm Search → Live radar. Opens on the company's office (or any address),
// shows the last hour of radar, active NWS warnings and today's storm reports,
// and keeps them current: alerts and reports every 2 minutes, radar every 5.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Building2, ChevronDown, ChevronUp, Loader2, MapPin, RefreshCw, Search } from 'lucide-react';
import LiveRadarMap from '@/components/crm/LiveRadarMap';
import { STORM_CATEGORY_COLORS } from '@/components/crm/StormMap';
import { geocodeAddress } from '@/lib/geocode';
import { useCRM } from '@/lib/crmStore';
import { supabase } from '@/lib/supabase';
import {
  alertColor,
  fetchAlertsAroundState,
  fetchAlertsForPoint,
  fetchLatestRadarTime,
  fetchRecentStormReports,
  type LiveAlert,
} from '@/lib/liveWeather';
import { toStateCode, type LiveRadarFocus, type StormReport } from '@/lib/stormReports';

const ALERT_REFRESH_MS = 2 * 60000;
const RADAR_REFRESH_MS = 5 * 60000;
const RADIUS_OPTIONS = [25, 50, 100, 150];
const US_VIEW = { lat: 39.5, lon: -98.35, label: 'United States', state: null, zoom: 4 };

interface LiveCenter {
  lat: number;
  lon: number;
  label: string;
  state: string | null;
  zoom: number;
}

const formatWhen = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

const formatTime = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const SEVERITY_STYLES: Record<string, string> = {
  Extreme: 'bg-red-700 text-white',
  Severe: 'bg-red-100 text-red-800 border border-red-200',
  Moderate: 'bg-orange-100 text-orange-800 border border-orange-200',
  Minor: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
};

function alertThreats(a: LiveAlert): string {
  return [
    a.maxWindGust ? `Wind gusts ${a.maxWindGust.toLowerCase()}` : null,
    a.maxHailSize && Number(a.maxHailSize) > 0 ? `hail ${a.maxHailSize}"` : null,
    a.tornadoDetection ? `tornado ${a.tornadoDetection.toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

interface LiveRadarPanelProps {
  /** A place to center on (e.g. a contact's address); a new key re-centers. */
  focus?: (LiveRadarFocus & { key: number }) | null;
}

export default function LiveRadarPanel({ focus = null }: LiveRadarPanelProps) {
  const { state } = useCRM();
  const companyId = state.companyId;

  const [office, setOffice] = useState<LiveCenter | null>(null);
  const [center, setCenter] = useState<LiveCenter | null>(null);
  const [address, setAddress] = useState('');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [radius, setRadius] = useState(50);

  const [latestRadarTime, setLatestRadarTime] = useState<Date | null>(null);
  const [radarCacheKey, setRadarCacheKey] = useState(() => String(Date.now()));
  const [areaAlerts, setAreaAlerts] = useState<LiveAlert[]>([]);
  const [pointAlerts, setPointAlerts] = useState<LiveAlert[] | null>(null);
  const [reports, setReports] = useState<StormReport[] | null>(null);
  const [alertsFailed, setAlertsFailed] = useState(false);
  const [reportsFailed, setReportsFailed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const requestId = useRef(0);

  // Start on the office: the storm alert job saves its location on the company.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let where: LiveCenter = US_VIEW;
      if (companyId) {
        const { data } = await supabase
          .from('companies')
          .select('name, address, city, state, zip, latitude, longitude')
          .eq('id', companyId)
          .maybeSingle();
        const row = data as any;
        const label = row
          ? [row.address, row.city, [row.state, row.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
          : '';
        if (row?.latitude != null && row?.longitude != null) {
          where = { lat: row.latitude, lon: row.longitude, label: label || row.name || 'Office', state: toStateCode(row.state), zoom: 8 };
        } else if (label) {
          const found = await geocodeAddress(label);
          if (found) where = { lat: found.lat, lon: found.lon, label, state: toStateCode(found.state ?? row?.state), zoom: 8 };
        }
      }
      if (cancelled) return;
      setOffice(where.zoom > 4 ? where : null);
      setCenter((prev) => prev ?? where);
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  // Opened for a specific place, e.g. from a contact.
  useEffect(() => {
    if (!focus) return;
    let cancelled = false;
    if (focus.lat != null && focus.lon != null) {
      setAddress(focus.label ?? '');
      setPointAlerts(null);
      setReports(null);
      setCenter({ lat: focus.lat, lon: focus.lon, label: focus.label || 'Selected location', state: toStateCode(focus.state), zoom: 9 });
      return;
    }
    const query = (focus.address ?? '').trim();
    if (!query) return;
    setAddress(query);
    setLocating(true);
    setError(null);
    geocodeAddress(query).then((found) => {
      if (cancelled) return;
      setLocating(false);
      if (!found) {
        setError(`Could not locate ${query}. Check that the address is complete (street, city, state).`);
        return;
      }
      setPointAlerts(null);
      setReports(null);
      setCenter({
        lat: found.lat,
        lon: found.lon,
        label: focus.label || found.displayName,
        state: toStateCode(found.state ?? focus.state),
        zoom: 9,
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);

  const refresh = useCallback(async (where: LiveCenter, radarToo: boolean) => {
    const id = ++requestId.current;
    setRefreshing(true);
    const isLocal = where.zoom > 4;
    const [radarTime, area, point, recent] = await Promise.allSettled([
      radarToo ? fetchLatestRadarTime() : Promise.resolve(null),
      where.state ? fetchAlertsAroundState(where.state) : Promise.resolve([] as LiveAlert[]),
      isLocal ? fetchAlertsForPoint(where.lat, where.lon) : Promise.resolve([] as LiveAlert[]),
      isLocal ? fetchRecentStormReports(where.lat, where.lon, where.state, radius, 24) : Promise.resolve([] as StormReport[]),
    ]);
    if (id !== requestId.current) return;
    if (radarToo) {
      if (radarTime.status === 'fulfilled' && radarTime.value) setLatestRadarTime(radarTime.value);
      setRadarCacheKey(String(Date.now()));
    }
    if (area.status === 'fulfilled') setAreaAlerts(area.value);
    if (point.status === 'fulfilled') setPointAlerts(point.value);
    setAlertsFailed(area.status === 'rejected' || point.status === 'rejected');
    if (recent.status === 'fulfilled') setReports(recent.value);
    setReportsFailed(recent.status === 'rejected');
    setLastUpdated(new Date());
    setRefreshing(false);
  }, [radius]);

  useEffect(() => {
    if (!center) return;
    refresh(center, true);
    const alertTimer = window.setInterval(() => refresh(center, false), ALERT_REFRESH_MS);
    const radarTimer = window.setInterval(() => refresh(center, true), RADAR_REFRESH_MS);
    return () => {
      window.clearInterval(alertTimer);
      window.clearInterval(radarTimer);
    };
  }, [center, refresh]);

  const locate = async () => {
    if (!address.trim()) {
      setError('Enter an address to center the live radar on.');
      return;
    }
    setLocating(true);
    setError(null);
    const found = await geocodeAddress(address);
    setLocating(false);
    if (!found) {
      setError('Could not locate that address. Check that it is complete (street, city, state) and try again.');
      return;
    }
    setPointAlerts(null);
    setReports(null);
    setCenter({ lat: found.lat, lon: found.lon, label: found.displayName, state: toStateCode(found.state), zoom: 9 });
  };

  const renderAlertPopup = (a: LiveAlert) => (
    <div className="text-xs space-y-1 min-w-[200px] max-w-[260px]">
      <div className="font-semibold text-sm text-gray-900">{a.event}</div>
      {a.ends || a.expires ? <div className="text-gray-600">Until {formatWhen(a.ends ?? a.expires)}</div> : null}
      {alertThreats(a) && <div className="text-gray-600">{alertThreats(a)}</div>}
      {a.nwsHeadline && <div className="text-gray-700">{a.nwsHeadline}</div>}
      {a.senderName && <div className="text-gray-500">{a.senderName}</div>}
    </div>
  );

  const renderReportPopup = (r: StormReport) => (
    <div className="text-xs space-y-1 min-w-[200px] max-w-[260px]">
      <div className="font-semibold text-sm text-gray-900">{r.title}</div>
      <div className="text-gray-600">{formatWhen(r.validUtc)}</div>
      <div className="text-gray-600">{r.distanceMiles} mi {r.direction} of the map center</div>
      {[r.place, r.county ? `${r.county} County` : null, r.state].filter(Boolean).length > 0 && (
        <div className="text-gray-600">{[r.place, r.county ? `${r.county} County` : null, r.state].filter(Boolean).join(', ')}</div>
      )}
      {r.reportedBy && <div className="text-gray-600">Reported by {r.reportedBy}</div>}
      {r.remark && <div className="italic text-gray-700">"{r.remark}"</div>}
    </div>
  );

  const isLocal = !!center && center.zoom > 4;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[240px] flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Center the live radar on</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && locate()}
              placeholder="123 Main St, Columbus, OH 43215"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {locating ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Go
          </button>
          {office && (
            <button
              type="button"
              onClick={() => { setAddress(''); setCenter(office); }}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              <Building2 size={15} /> Office
            </button>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Reports within</label>
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              {RADIUS_OPTIONS.map((r) => (
                <option key={r} value={r}>{r} miles</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => center && refresh(center, true)}
            disabled={!center || refreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          {center && (
            <span className="flex items-center gap-1"><MapPin size={12} /> {center.label}</span>
          )}
          {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · refreshes automatically</span>}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {center ? (
        <LiveRadarMap
          center={center}
          zoom={center.zoom}
          latestRadarTime={latestRadarTime}
          radarCacheKey={radarCacheKey}
          alerts={areaAlerts}
          reports={reports ?? []}
          renderAlertPopup={renderAlertPopup}
          renderReportPopup={renderReportPopup}
        />
      ) : (
        <div className="flex h-[560px] items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-500">
          <Loader2 size={16} className="mr-2 animate-spin" /> Loading live radar…
        </div>
      )}

      <p className="text-xs text-gray-400">
        Radar: NOAA NEXRAD national composite, new frames every 5 minutes (continental US). Warnings and alerts: National Weather Service,
        refreshed every 2 minutes. Storm reports: NWS Local Storm Reports from the last 24 hours. These are free public services with no
        uptime guarantee; for official warnings always follow the National Weather Service.
      </p>

      {!isLocal ? (
        <p className="text-sm text-gray-500">Enter an address, or add your company address in Settings, to see alerts and storm reports for a location.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900">Active alerts for this location</h3>
            {alertsFailed && (
              <p className="mt-1 text-xs text-amber-700">The National Weather Service didn't respond. Trying again shortly.</p>
            )}
            {pointAlerts === null ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-500"><Loader2 size={14} className="animate-spin" /> Checking…</div>
            ) : pointAlerts.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No active watches, warnings or advisories here right now.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {pointAlerts.map((a) => {
                  const expanded = expandedAlertId === a.id;
                  return (
                    <li key={a.id} className="rounded-lg border border-gray-200 p-3">
                      <button
                        type="button"
                        onClick={() => setExpandedAlertId(expanded ? null : a.id)}
                        className="flex w-full items-start justify-between gap-2 text-left"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: alertColor(a.event) }} />
                            <span className="text-sm font-semibold text-gray-900">{a.event}</span>
                            {a.severity && SEVERITY_STYLES[a.severity] && (
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${SEVERITY_STYLES[a.severity]}`}>{a.severity}</span>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs text-gray-500">
                            {a.ends || a.expires ? `Until ${formatWhen(a.ends ?? a.expires)}` : ''}
                            {a.senderName ? ` · ${a.senderName}` : ''}
                          </div>
                          {alertThreats(a) && <div className="mt-0.5 text-xs text-gray-700">{alertThreats(a)}</div>}
                        </div>
                        {expanded ? <ChevronUp size={16} className="shrink-0 text-gray-400" /> : <ChevronDown size={16} className="shrink-0 text-gray-400" />}
                      </button>
                      {expanded && (
                        <div className="mt-2 space-y-2 text-xs text-gray-700">
                          {a.headline && <p className="font-medium">{a.headline}</p>}
                          {a.description && <p className="whitespace-pre-wrap">{a.description}</p>}
                          {a.instruction && (
                            <p className="whitespace-pre-wrap rounded bg-amber-50 p-2 text-amber-900">{a.instruction}</p>
                          )}
                          {a.areaDesc && <p className="text-gray-500">Areas: {a.areaDesc}</p>}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900">Storm reports in the last 24 hours within {radius} miles</h3>
            {reportsFailed && <p className="mt-1 text-xs text-amber-700">Storm reports didn't load. Trying again shortly.</p>}
            {reports === null ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-500"><Loader2 size={14} className="animate-spin" /> Checking…</div>
            ) : reports.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No hail, wind, tornado or flood reports nearby in the last 24 hours.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {reports.slice(0, 25).map((r) => (
                  <li key={r.id} className="rounded-lg border border-gray-200 p-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STORM_CATEGORY_COLORS[r.category] }} />
                        <span className="text-sm font-semibold text-gray-900">{r.title}</span>
                      </div>
                      <span className="shrink-0 font-medium text-gray-600">{r.distanceMiles} mi {r.direction}</span>
                    </div>
                    <div className="mt-0.5 text-gray-500">
                      {[formatTime(r.validUtc), r.place, r.county ? `${r.county} County` : null, r.reportedBy ? `Reported by ${r.reportedBy}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                    {r.remark && <p className="mt-1 italic text-gray-700">"{r.remark}"</p>}
                  </li>
                ))}
                {reports.length > 25 && <li className="text-xs text-gray-500">…and {reports.length - 25} more on the map</li>}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

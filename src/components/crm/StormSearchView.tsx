import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Check, CheckCircle, CloudHail, CloudRain, ExternalLink, History, Loader2, MapPin, Radio, Search, Tornado, Waves, Wind,
  type LucideIcon,
} from 'lucide-react';
import StormMap, { STORM_CATEGORY_COLORS, WARNING_COLORS } from '@/components/crm/StormMap';
import LiveRadarPanel from '@/components/crm/LiveRadarPanel';
import { geocodeAddress } from '@/lib/geocode';
import {
  fetchStormWarnings,
  reportsFromSameStorm,
  searchStormReports,
  takePendingStormFocus,
  toStateCode,
  STORM_CATEGORY_LABELS,
  STORM_FOCUS_EVENT,
  type StormCategory,
  type StormReport,
  type StormSeverity,
  type StormWarning,
} from '@/lib/stormReports';

// Storm history for any address, no contact required: useful for canvassing or
// checking a lead's property before they're in the CRM. Shows every National
// Weather Service storm report (hail, wind, tornado, flooding…) and NOAA radar
// hail and tornado signatures on a map, with where each happened relative to
// the address and everything the report says. Selecting a report shows the
// area the storm hit. Storm alerts open here too.

const severityConfig: Record<StormSeverity, { label: string; className: string }> = {
  minor:    { label: 'Minor',    className: 'bg-yellow-100 text-yellow-800 border border-yellow-200' },
  moderate: { label: 'Moderate', className: 'bg-orange-100 text-orange-800 border border-orange-200' },
  severe:   { label: 'Severe',   className: 'bg-red-100 text-red-800 border border-red-200' },
};

const CATEGORY_ICONS: Record<StormCategory, LucideIcon> = {
  hail: CloudHail,
  wind: Wind,
  damage: AlertTriangle,
  tornado: Tornado,
  flood: Waves,
  other: CloudRain,
};

const CATEGORY_ORDER: StormCategory[] = ['hail', 'wind', 'damage', 'tornado', 'flood', 'other'];
const RADIUS_OPTIONS = [5, 10, 15, 25, 50, 100];
const WIND_OPTIONS = [0, 30, 35, 40, 50, 58, 65, 75];
const HAIL_OPTIONS = [0, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const PAGE_SIZE = 150;
const QUALIFIER_LABELS: Record<string, string> = { M: 'Measured', E: 'Estimated', U: 'Unknown' };

type SourceFilter = 'all' | 'ground' | 'radar';

interface SearchCenter {
  lat: number;
  lon: number;
  label: string;
  state: string | null;
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

const placeText = (r: StormReport) =>
  [r.place, r.county ? `${r.county} County` : null, r.state].filter(Boolean).join(', ');

function reportDetails(r: StormReport): Array<[string, React.ReactNode]> {
  const rows: Array<[string, React.ReactNode]> = [
    ['When', formatWhen(r.validUtc)],
    ['Where', `${r.distanceMiles} mi ${r.direction} of the searched address`],
  ];
  const place = placeText(r);
  if (place) rows.push(['Location', place]);
  if (r.magnitude != null) rows.push(['Size / speed', r.unit ? `${r.magnitude} ${r.unit.toLowerCase()}` : String(r.magnitude)]);
  if (r.reportedBy) rows.push(['Reported by', r.reportedBy]);
  if (r.qualifier && QUALIFIER_LABELS[r.qualifier]) rows.push(['Measurement', QUALIFIER_LABELS[r.qualifier]]);
  if (r.wfo) rows.push(['NWS office', r.wfo]);
  if (r.radarStation) rows.push(['Radar', r.radarStation]);
  if (r.hailProbability != null) rows.push(['Chance of hail', `${r.hailProbability}%`]);
  if (r.severeProbability != null) rows.push(['Chance of severe hail', `${r.severeProbability}%`]);
  rows.push([
    'Coordinates',
    <a
      href={`https://www.google.com/maps?q=${r.lat},${r.lon}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-blue-600 hover:underline"
    >
      {r.lat.toFixed(4)}, {r.lon.toFixed(4)} <ExternalLink size={11} />
    </a>,
  ]);
  return rows;
}

function warningSummary(w: StormWarning): string {
  return [
    w.windMph != null ? `Wind up to ${w.windMph} mph${w.windThreat ? ` (${w.windThreat.toLowerCase()})` : ''}` : null,
    w.hailInches != null ? `hail up to ${w.hailInches}"${w.hailThreat ? ` (${w.hailThreat.toLowerCase()})` : ''}` : null,
    w.tornado ? `tornado ${w.tornado.toLowerCase()}` : null,
    w.damage ? `${w.damage.toLowerCase()} damage threat` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export default function StormSearchView() {
  const [mode, setMode] = useState<'live' | 'history'>('live');
  const [address, setAddress] = useState('');
  const [months, setMonths] = useState(12);
  const [radius, setRadius] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [center, setCenter] = useState<SearchCenter | null>(null);
  const [searchedRadius, setSearchedRadius] = useState(10);
  const [searchedMonths, setSearchedMonths] = useState(12);
  const [reports, setReports] = useState<StormReport[] | null>(null);
  const [groundAvailable, setGroundAvailable] = useState(true);

  // Filters
  const [hiddenCategories, setHiddenCategories] = useState<Set<StormCategory>>(() => new Set<StormCategory>());
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [minWind, setMinWind] = useState(0);
  const [minHail, setMinHail] = useState(0);
  const [sortBy, setSortBy] = useState<'distance' | 'newest'>('distance');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [warningState, setWarningState] = useState<{
    reportId: string;
    loading: boolean;
    failed: boolean;
    warnings: StormWarning[];
  } | null>(null);
  const mapWrapRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(async (where: SearchCenter, lookbackMonths: number, radiusMiles: number) => {
    setLoading(true);
    setError(null);
    setReports(null);
    setSelectedId(null);
    setVisibleCount(PAGE_SIZE);
    setCenter(where);
    setSearchedRadius(radiusMiles);
    setSearchedMonths(lookbackMonths);
    try {
      const result = await searchStormReports({
        lat: where.lat,
        lon: where.lon,
        state: where.state,
        months: lookbackMonths,
        radiusMiles,
      });
      setReports(result.reports);
      setGroundAvailable(result.groundReportsAvailable);
    } catch {
      setError('Failed to search storm history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = async () => {
    if (!address.trim()) { setError('Enter an address to search.'); return; }
    setLoading(true);
    setError(null);
    const coords = await geocodeAddress(address);
    if (!coords) {
      setLoading(false);
      setError('Could not locate that address. Check that it is complete (street, city, state) and try again.');
      return;
    }
    await runSearch(
      { lat: coords.lat, lon: coords.lon, label: coords.displayName, state: toStateCode(coords.state) },
      months,
      radius,
    );
  };

  // A storm alert can open this view centered on its location.
  useEffect(() => {
    const applyFocus = () => {
      const focus = takePendingStormFocus();
      if (!focus) return;
      setMode('history');
      const focusMonths = focus.months ?? 1;
      const focusRadius = focus.radiusMiles ?? 10;
      setAddress(focus.label ?? '');
      setMonths(focusMonths);
      setRadius(focusRadius);
      runSearch(
        { lat: focus.lat, lon: focus.lon, label: focus.label || 'Alert location', state: toStateCode(focus.state) },
        focusMonths,
        focusRadius,
      );
    };
    applyFocus();
    window.addEventListener(STORM_FOCUS_EVENT, applyFocus);
    return () => window.removeEventListener(STORM_FOCUS_EVENT, applyFocus);
  }, [runSearch]);

  // Everything except the category switches, so each chip can say how many it would show.
  const passesSourceAndThresholds = useCallback(
    (r: StormReport) => {
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      if (r.category === 'wind' && minWind > 0 && !(r.magnitude != null && r.magnitude >= minWind)) return false;
      if (r.category === 'hail' && minHail > 0 && !(r.magnitude != null && r.magnitude >= minHail)) return false;
      return true;
    },
    [sourceFilter, minWind, minHail],
  );

  const counts = useMemo(() => {
    const total = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, 0])) as Record<StormCategory, number>;
    const matching = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, 0])) as Record<StormCategory, number>;
    let ground = 0;
    let radar = 0;
    for (const r of reports ?? []) {
      total[r.category]++;
      if (passesSourceAndThresholds(r)) matching[r.category]++;
      if (r.source === 'ground') ground++;
      else radar++;
    }
    return { total, matching, ground, radar };
  }, [reports, passesSourceAndThresholds]);

  const visible = useMemo(() => {
    const list = (reports ?? []).filter((r) => !hiddenCategories.has(r.category) && passesSourceAndThresholds(r));
    return sortBy === 'newest' ? [...list].sort((a, b) => b.validUtc.localeCompare(a.validUtc)) : list;
  }, [reports, hiddenCategories, passesSourceAndThresholds, sortBy]);

  const filtersChanged = hiddenCategories.size > 0 || sourceFilter !== 'all' || minWind > 0 || minHail > 0;
  const resetFilters = () => {
    setHiddenCategories(new Set());
    setSourceFilter('all');
    setMinWind(0);
    setMinHail(0);
  };

  /** Why the current filters hide every report, in plain words. */
  const emptyReasons = useMemo(() => {
    const reasons: string[] = [];
    const hidden = CATEGORY_ORDER.filter((c) => hiddenCategories.has(c) && counts.total[c] > 0);
    if (hidden.length) reasons.push(`${hidden.map((c) => STORM_CATEGORY_LABELS[c]).join(', ')} ${hidden.length === 1 ? 'is' : 'are'} switched off`);
    if (sourceFilter === 'radar') reasons.push('only radar estimates are shown, and radar only detects hail and tornadoes, so wind, wind damage and flooding reports are hidden');
    if (sourceFilter === 'ground') reasons.push('only ground reports are shown, so radar estimates are hidden');
    if (minWind > 0) reasons.push(`wind reports under ${minWind} mph are hidden`);
    if (minHail > 0) reasons.push(`hail under ${minHail}" is hidden`);
    return reasons;
  }, [hiddenCategories, sourceFilter, minWind, minHail, counts]);

  const toggleCategory = (category: StormCategory) =>
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

  const showOnly = (category: StormCategory) =>
    setHiddenCategories(new Set(CATEGORY_ORDER.filter((c) => c !== category)));

  const selectFromList = (id: string) => {
    setSelectedId(id);
    mapWrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const selectedReport = useMemo(() => (reports ?? []).find((r) => r.id === selectedId) ?? null, [reports, selectedId]);
  const sameStorm = useMemo(
    () => (selectedReport ? reportsFromSameStorm(selectedReport, visible) : []),
    [selectedReport, visible],
  );
  const relatedIds = useMemo(() => (selectedReport ? new Set(sameStorm.map((r) => r.id)) : null), [selectedReport, sameStorm]);

  // The NWS warnings that covered the selected report.
  useEffect(() => {
    if (!selectedReport || !center) {
      setWarningState(null);
      return;
    }
    let cancelled = false;
    const reportId = selectedReport.id;
    setWarningState({ reportId, loading: true, failed: false, warnings: [] });
    fetchStormWarnings(selectedReport, center)
      .then((warnings) => { if (!cancelled) setWarningState({ reportId, loading: false, failed: false, warnings }); })
      .catch(() => { if (!cancelled) setWarningState({ reportId, loading: false, failed: true, warnings: [] }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport?.id, center?.lat, center?.lon]);

  const currentWarnings = warningState && warningState.reportId === selectedId ? warningState.warnings : [];

  const radiusOptions = RADIUS_OPTIONS.includes(radius) ? RADIUS_OPTIONS : [...RADIUS_OPTIONS, radius].sort((a, b) => a - b);

  const renderPopup = (r: StormReport) => (
    <div className="text-xs space-y-1 min-w-[200px] max-w-[260px]">
      <div className="font-semibold text-sm text-gray-900">{r.title}</div>
      <div className="text-gray-600">{formatWhen(r.validUtc)}</div>
      <div className="text-gray-600">{r.distanceMiles} mi {r.direction} of the searched address</div>
      {placeText(r) && <div className="text-gray-600">{placeText(r)}</div>}
      {r.reportedBy && <div className="text-gray-600">Reported by {r.reportedBy}</div>}
      {r.radarStation && <div className="text-gray-600">Radar {r.radarStation}</div>}
      {r.remark && <div className="italic text-gray-700">"{r.remark}"</div>}
    </div>
  );

  const selectClass = 'px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CloudRain className="text-blue-600" size={26} /> Storm Search
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Live radar and active warnings, or the storm history of any address: hail, wind, tornadoes and more from the National
          Weather Service and NOAA.
        </p>
      </div>

      <div className="mb-5 inline-flex rounded-lg bg-gray-100 p-1">
        {([
          ['live', 'Live radar', Radio],
          ['history', 'Storm history', History],
        ] as const).map(([id, label, TabIcon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            aria-pressed={mode === id}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              mode === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <TabIcon size={15} /> {label}
          </button>
        ))}
      </div>

      {mode === 'live' ? (
        <LiveRadarPanel />
      ) : (
      <>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
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
            <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className={selectClass}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m} {m === 1 ? 'month' : 'months'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Radius</label>
            <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} className={selectClass}>
              {radiusOptions.map((r) => (
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
          Searching storm reports…
        </div>
      )}

      {!loading && center && reports && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <MapPin size={13} />
            {center.label}
          </div>

          {!groundAvailable && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {center.state
                ? 'Some National Weather Service storm reports could not be loaded, so the list may be incomplete. Try the search again.'
                : 'The state for this address could not be determined, so only NOAA radar estimates are shown. Include the state in the address.'}
            </div>
          )}

          {reports.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-500 mr-1">Show</span>
                {CATEGORY_ORDER.filter((c) => counts.total[c] > 0).map((c) => {
                  const Icon = CATEGORY_ICONS[c];
                  const on = !hiddenCategories.has(c);
                  return (
                    <span
                      key={c}
                      className={`inline-flex items-center rounded-full border text-xs font-medium transition-colors ${
                        on ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-100 border-gray-100 text-gray-400'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleCategory(c)}
                        aria-pressed={on}
                        title={on ? `Hide ${STORM_CATEGORY_LABELS[c]}` : `Show ${STORM_CATEGORY_LABELS[c]}`}
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1.5"
                      >
                        <span
                          className="flex h-3.5 w-3.5 items-center justify-center rounded-sm"
                          style={{ backgroundColor: on ? STORM_CATEGORY_COLORS[c] : '#d1d5db' }}
                        >
                          {on && <Check size={10} className="text-white" strokeWidth={3} />}
                        </span>
                        <Icon size={13} />
                        {STORM_CATEGORY_LABELS[c]} ({counts.matching[c]})
                      </button>
                      <button
                        type="button"
                        onClick={() => showOnly(c)}
                        title={`Show only ${STORM_CATEGORY_LABELS[c]}`}
                        className="border-l border-gray-200 px-2 py-1.5 text-[11px] text-gray-500 hover:text-blue-600"
                      >
                        only
                      </button>
                    </span>
                  );
                })}
                {hiddenCategories.size > 0 && (
                  <button type="button" onClick={() => setHiddenCategories(new Set())} className="text-xs font-medium text-blue-600 hover:underline">
                    Show all types
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Source</label>
                  <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as SourceFilter)} className={selectClass}>
                    <option value="all">Ground reports and radar ({counts.ground + counts.radar})</option>
                    <option value="ground">Ground reports only ({counts.ground})</option>
                    <option value="radar">Radar estimates only ({counts.radar})</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Minimum wind</label>
                  <select value={minWind} onChange={(e) => setMinWind(Number(e.target.value))} className={selectClass}>
                    {WIND_OPTIONS.map((w) => (
                      <option key={w} value={w}>{w === 0 ? 'Any speed' : `${w}+ mph`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Minimum hail</label>
                  <select value={minHail} onChange={(e) => setMinHail(Number(e.target.value))} className={selectClass}>
                    {HAIL_OPTIONS.map((h) => (
                      <option key={h} value={h}>{h === 0 ? 'Any size' : `${h}"+`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Sort</label>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'distance' | 'newest')} className={selectClass}>
                    <option value="distance">Nearest first</option>
                    <option value="newest">Newest first</option>
                  </select>
                </div>
                {filtersChanged && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            </div>
          )}

          {reports.length > 0 && visible.length === 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                No reports match the filters: {emptyReasons.join('; ') || 'the filters hide every report'}.{' '}
                <button type="button" onClick={resetFilters} className="font-semibold underline">
                  Reset filters
                </button>
              </div>
            </div>
          )}

          <div ref={mapWrapRef}>
            <StormMap
              center={center}
              radiusMiles={searchedRadius}
              reports={visible}
              selectedId={selectedId}
              onSelect={setSelectedId}
              renderPopup={renderPopup}
              warnings={currentWarnings}
              relatedIds={relatedIds}
            />
          </div>
          <p className="text-xs text-gray-400">
            The dark dot is the searched address. Solid dots are ground reports from the National Weather Service (trained spotters,
            emergency managers, weather stations). Faded dots are NOAA radar estimates, which mark the storm cell overhead rather than a
            confirmed impact. Select a report to see the radar at that moment, the NWS warning area, and the rest of that storm.
          </p>

          {reports.length === 0 ? (
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
              <CheckCircle size={16} className="mt-0.5 shrink-0" />
              No storm reports found within {searchedRadius} miles in the last {searchedMonths} {searchedMonths === 1 ? 'month' : 'months'}.
            </div>
          ) : (
            <>
              <div className="text-xs text-gray-500 px-1">
                {visible.length} of {reports.length} report{reports.length === 1 ? '' : 's'} shown · within {searchedRadius} mi · last{' '}
                {searchedMonths} {searchedMonths === 1 ? 'month' : 'months'}
              </div>

              <div className="space-y-3">
                {visible.slice(0, visibleCount).map((r) => {
                  const Icon = CATEGORY_ICONS[r.category];
                  const selected = r.id === selectedId;
                  const place = placeText(r);
                  return (
                    <div
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectFromList(r.id)}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          selectFromList(r.id);
                        }
                      }}
                      className={`border rounded-xl p-4 cursor-pointer transition-colors ${
                        selected ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500' : 'border-gray-200 bg-gray-50 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Icon size={16} style={{ color: STORM_CATEGORY_COLORS[r.category] }} />
                          <span className="font-semibold text-gray-900">{r.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityConfig[r.severity].className}`}>
                            {severityConfig[r.severity].label}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                            {r.source === 'ground' ? 'Ground report' : 'Radar estimate'}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold text-gray-700">{r.distanceMiles} mi {r.direction}</div>
                          <div className="text-xs text-gray-400">{formatWhen(r.validUtc)}</div>
                        </div>
                      </div>

                      {!selected && (place || r.reportedBy || r.radarStation) && (
                        <div className="mt-1 text-xs text-gray-500">
                          {[place, r.reportedBy ? `Reported by ${r.reportedBy}` : null, r.radarStation ? `Radar ${r.radarStation}` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      )}
                      {r.remark && <p className="mt-2 text-sm text-gray-700 italic">"{r.remark}"</p>}

                      {selected ? (
                        <div className="cursor-default" onClick={(e) => e.stopPropagation()}>
                          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                            {reportDetails(r).map(([label, value], i) => (
                              <div key={i} className="flex gap-2">
                                <dt className="text-gray-400 w-32 shrink-0">{label}</dt>
                                <dd className="text-gray-700">{value}</dd>
                              </div>
                            ))}
                          </dl>

                          <div className="mt-4 border-t border-blue-200 pt-3 space-y-2">
                            <div className="text-xs font-semibold text-gray-900">National Weather Service warnings for this storm</div>
                            {!warningState || warningState.reportId !== r.id || warningState.loading ? (
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Loader2 size={12} className="animate-spin" /> Checking warnings…
                              </div>
                            ) : warningState.failed ? (
                              <p className="text-xs text-gray-500">The warning archive could not be reached. Select the report again to retry.</p>
                            ) : warningState.warnings.length === 0 ? (
                              <p className="text-xs text-gray-500">
                                No severe thunderstorm, tornado or flash flood warning covered this spot or the searched address at the time.
                              </p>
                            ) : (
                              warningState.warnings.map((w) => (
                                <div key={w.id} className="rounded-lg border border-gray-200 bg-white p-2.5 text-xs space-y-0.5">
                                  <div className="flex items-center gap-2 font-semibold text-gray-900">
                                    <span className="h-2.5 w-2.5 rounded-sm border-2" style={{ borderColor: WARNING_COLORS[w.phenomena] ?? '#f59e0b' }} />
                                    {w.title}
                                    {w.wfo && <span className="font-normal text-gray-500">· NWS {w.wfo}</span>}
                                  </div>
                                  <div className="text-gray-600">
                                    {formatWhen(w.polygonBegin ?? w.issued)} to {formatTime(w.polygonEnd)}
                                  </div>
                                  {warningSummary(w) && <div className="text-gray-600">{warningSummary(w)}</div>}
                                  <div className="text-gray-500">
                                    {[w.containsReport ? 'Covered this report' : null, w.containsAddress ? 'Covered the searched address' : null]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </div>
                                  {w.href && (
                                    <a
                                      href={w.href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                                    >
                                      Warning details and text <ExternalLink size={11} />
                                    </a>
                                  )}
                                </div>
                              ))
                            )}

                            <div className="text-xs font-semibold text-gray-900 pt-2">Other reports from this storm ({sameStorm.length})</div>
                            {sameStorm.length === 0 ? (
                              <p className="text-xs text-gray-500">No other reports within 25 miles and 90 minutes with the current filters.</p>
                            ) : (
                              <ul className="space-y-1 text-xs">
                                {sameStorm.slice(0, 15).map((o) => (
                                  <li key={o.id} className="flex flex-wrap items-center gap-x-2">
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STORM_CATEGORY_COLORS[o.category] }} />
                                    <button type="button" onClick={() => selectFromList(o.id)} className="font-medium text-blue-600 hover:underline">
                                      {o.title}
                                    </button>
                                    <span className="text-gray-500">
                                      {o.distanceMiles} mi {o.direction} of the address · {formatTime(o.validUtc)}
                                      {o.source === 'radar' ? ' · radar' : o.place ? ` · ${o.place}` : ''}
                                    </span>
                                  </li>
                                ))}
                                {sameStorm.length > 15 && <li className="text-gray-500">…and {sameStorm.length - 15} more on the map</li>}
                              </ul>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-blue-600">Show the storm on the map and all details</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {visible.length > visibleCount && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="w-full py-2 text-sm font-medium text-blue-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Show more ({visible.length - visibleCount} more)
                </button>
              )}
            </>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
}

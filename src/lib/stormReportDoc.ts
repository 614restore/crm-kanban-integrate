// A storm report attached to a quote or inspection report: the storms recorded near the
// property, picked from the storm history and saved with the quote (quotes.storm_report),
// so the document shows the same storms however long after it is opened.
import type { StormReport } from './stormReports';

export interface StormReportEntry {
  /** When the storm hit, ISO UTC. */
  date: string;
  category: StormReport['category'];
  /** The NWS report type, e.g. HAIL or TSTM WND GST. */
  typeText: string;
  magnitude: number | null;
  unit: string | null;
  distanceMiles: number;
  direction: string;
  place: string | null;
  source: StormReport['source'];
  remark: string | null;
}

export interface QuoteStormReport {
  /** The property the storms were measured from. */
  address: string;
  radiusMiles: number;
  months: number;
  generatedAt: string;
  entries: StormReportEntry[];
}

export function toStormReportEntry(r: StormReport): StormReportEntry {
  return {
    date: r.validUtc,
    category: r.category,
    typeText: r.typeText,
    magnitude: r.magnitude,
    unit: r.unit,
    distanceMiles: Math.round(r.distanceMiles * 10) / 10,
    direction: r.direction,
    place: [r.place, r.state].filter(Boolean).join(', ') || null,
    source: r.source,
    remark: r.remark ?? null,
  };
}

/** "1.75 in hail", "62 mph wind", or the report type when it has no size. */
export function describeStormEntry(e: Pick<StormReportEntry, 'category' | 'typeText' | 'magnitude' | 'unit'>): string {
  const kind = e.category === 'hail' ? 'hail' : e.category === 'wind' ? 'wind' : e.category === 'tornado' ? 'tornado' : null;
  if (e.magnitude != null && kind) return `${e.magnitude}${e.unit ? ` ${e.unit.toLowerCase()}` : ''} ${kind}`;
  return kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : e.typeText;
}

export function formatStormDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** A saved storm report worth showing: it has at least one storm in it. */
export function hasStormReport(value: unknown): value is QuoteStormReport {
  const v = value as QuoteStormReport | null;
  return !!v && Array.isArray(v.entries) && v.entries.length > 0;
}

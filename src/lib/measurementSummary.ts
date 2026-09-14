// Copied from QuoteMGR src/lib/measurementSummary.ts (read-only reference).
export interface MeasurementSummary {
  providerLabel: string;
  sourceName: string | null;
  roofAreaSqft: number;
  facets: number;
  pitch: string;
  structures: number;
}

const PROVIDER_LABELS: Record<string, string> = {
  manual: 'Manual Entry',
  roofr: 'Roofr',
  eagleview: 'EagleView',
  hover: 'HOVER',
  roofsnap: 'RoofSnap',
  gaf_quickmeasure: 'GAF QuickMeasure',
};

const asRecord = (value: unknown): Record<string, any> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : null;

export const getMeasurementProviderLabel = (provider?: string | null) => {
  if (!provider) return 'Measurements';
  return PROVIDER_LABELS[provider] || provider.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
};

export const getMeasurementSummary = (
  provider?: string | null,
  sourceName?: string | null,
  data?: Record<string, unknown> | null,
): MeasurementSummary | null => {
  const root = asRecord(data);
  if (!root) return null;

  // Manual entry stores { squares, eaves, rakes, ridge, hips, valleys, pipeBoots, waste }
  // — completely different shape from third-party API reports.
  if (provider === 'manual') {
    const squares = Number(root.squares ?? 0);
    return {
      providerLabel: getMeasurementProviderLabel(provider),
      sourceName: sourceName || null,
      roofAreaSqft: Math.round(squares * 100), // 1 square = 100 ft²
      facets: 0,                                // not captured in manual entry
      pitch: 'N/A',                             // not captured in manual entry
      structures: 1,
    };
  }

  const reportSummary = asRecord(root.reportSummary);
  const structures = Array.isArray(root.structures) ? root.structures.length : 0;

  return {
    providerLabel: getMeasurementProviderLabel(provider),
    sourceName: sourceName || null,
    roofAreaSqft: Number(reportSummary?.totalRoofAreaSqft ?? root.totalRoofAreaSqft ?? 0),
    facets: Number(reportSummary?.totalRoofFacets ?? root.totalRoofFacets ?? 0),
    pitch: String(reportSummary?.predominantPitch ?? root.predominantPitch ?? '') || 'N/A',
    structures: structures || 1,
  };
};

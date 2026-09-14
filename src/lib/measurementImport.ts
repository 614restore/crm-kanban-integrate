// Copied from QuoteMGR src/lib/measurementImport.ts (read-only reference).
import type { CompanyPricing, LineItem } from '@/data/quoteData';
import {
  buildRoofrLineItems,
  buildEagleViewSolarLineItems,
  type RoofrParsedReport,
  type EagleViewSolarReport,
  type JobConditions,
  DEFAULT_JOB_CONDITIONS,
} from '@/lib/roofrReport';

export const buildMeasurementLineItems = (
  provider: string | null | undefined,
  measurementData: Record<string, unknown> | null | undefined,
  companyPricing: CompanyPricing[],
  wastePercent: number = 10,
  conditions: JobConditions = DEFAULT_JOB_CONDITIONS,
): LineItem[] => {
  if ((provider === 'roofr' || provider === 'eagleview') && measurementData) {
    return buildRoofrLineItems(measurementData as RoofrParsedReport, companyPricing, wastePercent, conditions);
  }

  if (provider === 'eagleview-solar' && measurementData) {
    return buildEagleViewSolarLineItems(measurementData as EagleViewSolarReport, companyPricing);
  }

  return [];
};

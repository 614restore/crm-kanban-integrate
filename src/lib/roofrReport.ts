// Copied from QuoteMGR (quotes-customize-manage/src/lib/roofrReport.ts): the per-structure
// summary shape stored in quotes.measurement_data, for WorkOrderPanel.

export interface RoofrStructureSummary {
  structureNumber: number;
  totalRoofAreaSqft: number;
  totalPitchedAreaSqft: number;
  totalFlatAreaSqft: number;
  totalRoofFacets: number;
  predominantPitch: string;
  totalEavesFt: number;
  totalValleysFt: number;
  totalHipsFt: number;
  totalRidgesFt: number;
  totalRakesFt: number;
  totalWallFlashingFt: number;
  totalStepFlashingFt: number;
  hipsAndRidgesFt: number;
  eavesAndRakesFt: number;
}

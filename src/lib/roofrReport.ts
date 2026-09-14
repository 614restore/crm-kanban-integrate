// Copied from QuoteMGR src/lib/roofrReport.ts (read-only reference).
/**
 * Roofr PDF Parser — multi-structure aware
 *
 * Ported from TrussCTR's proven roofrParser.ts and extended with material
 * calculations, per-structure scope selection, and line-item generation.
 *
 * Key format facts (calibrated against real Roofr Roof Reports, 2026 format):
 *  - Cover page (p1):   "1411 sqft", "7 facets", "Predominant pitch 6/12"
 *  - Diagram (p2):      no measurements
 *  - Length page (p3):  "Eaves: 143ft 3in" — combined across all structures
 *  - Area page (p4):    "Total roof area: 1411 sqft"
 *  - Pitch page (p5):   no measurements
 *  - Structure #1 (p6): "Structure #1 summary … Total eaves 101ft 11in …"
 *  - Structure #2 (p7): "Structure #2 summary …"
 *  - Report summary(p8):"Report summary … Total roof area 1411 sqft …"
 *  - Material calcs(p9): product table
 */

import * as pdfjsLib from 'pdfjs-dist';
// ?url lets Vite emit the worker file with the correct content-hashed path at
// build time, avoiding the "Importing a module script failed" fake-worker error
// that happens when a bare /pdf.worker.min.mjs path can't be resolved as an
// ES module in a Worker context on some production hosts.
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
}

import { defaultLineItems } from '@/data/quoteData';
import { DEFAULT_PRICE_LIST } from '@/data/defaultPricing';
import { resolveTierLadder, makeRungLookup } from '@/data/tierLadders';
import type { CompanyPricing, LineItem } from '@/data/quoteData';

// ── Types ─────────────────────────────────────────────────────────────────────

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

export interface RoofrMaterialCalculation {
  product: string;
  unit: string;
  waste0: number;
  waste10: number;
  waste12: number;
  waste15: number;
}

/** One row of the report's pitch breakdown table. */
export interface RoofrPitchArea {
  /** As printed, e.g. "7/12". */
  pitch: string;
  /** The rise, for band comparisons. */
  pitchNum: number;
  areaSqft: number;
  squares: number;
}

export interface RoofrParsedReport {
  address: string;
  totalRoofAreaSqft: number;
  totalRoofFacets: number;
  predominantPitch: string;
  structures: RoofrStructureSummary[];
  reportSummary: RoofrStructureSummary | null;
  materialCalculations: RoofrMaterialCalculation[];
  importMode?: RoofrImportMode;
  source?: 'roofr' | 'eagleview';
  /** Waste % suggested by the measurement provider (e.g. EagleView 24%, Roofr varies) */
  suggestedWastePercent?: number;
  /**
   * Area per pitch, when the report prints the breakdown and it reconciles
   * against the total. Steep labor is charged on the squares that are actually
   * steep; without this it was all-or-nothing on the predominant pitch, so a
   * roof of 8 sq at 5/12 and 7 sq at 7/12 was charged for no steep work at all.
   */
  pitchAreas?: RoofrPitchArea[];
}

export type RoofrImportMode = 'combined' | 'separate' | 'separate-and-combined';

// ── Low-level helpers ─────────────────────────────────────────────────────────

/** "143ft 3in" → 143.25,  "47ft 0in" → 47,  "128ft" → 128 */
function parseFtIn(raw: string | undefined): number {
  if (!raw) return 0;
  const withIn = raw.match(/(\d+)\s*ft\s*(\d+)\s*in/i);
  if (withIn) {
    return Math.round((parseInt(withIn[1], 10) + parseInt(withIn[2], 10) / 12) * 10) / 10;
  }
  const ftOnly = raw.match(/(\d+(?:\.\d+)?)\s*ft/i);
  if (ftOnly) return parseFloat(ftOnly[1]);
  return 0;
}

/** Token: "(Nft Nin|Nft)" for use inside RegExp strings */
const LF_TOKEN = '(\\d+ft\\s*\\d+in|\\d+ft)';

/** Extract a linear ft/in measurement using multiple pattern candidates */
function extractFtIn(text: string, patterns: RegExp[]): number {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return parseFtIn(m[1].trim());
  }
  return 0;
}

/** Extract a plain number using multiple pattern candidates */
function extractNum(text: string, patterns: RegExp[]): number {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const n = parseFloat(m[1].replace(/,/g, ''));
      return isNaN(n) ? 0 : n;
    }
  }
  return 0;
}

/** Extract a string value using multiple pattern candidates */
function extractStr(text: string, patterns: RegExp[]): string {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return '';
}

// Matches a US street address followed by "City, ST ZIP". Falls back to a
// second, stricter pattern (requiring a recognized street suffix) when the
// loose pattern doesn't find anything.
const ADDRESS_PATTERNS: RegExp[] = [
  /(\d+\s+[\w\s.]+,\s*[\w\s.]+,\s*[A-Z]{2}\s+\d{5})/,
  /(\d+\s+[\w\s]+(?:St|Ave|Blvd|Dr|Rd|Ln|Way|Ct|Pl)\.?,\s*[\w\s]+,\s*[A-Z]{2}\s+\d{5})/i,
];

/**
 * Extracts a property address from report text. Some PDFs have a stray
 * number (a page number, report ID, or map marker) sitting on the same line
 * immediately before the real street number — e.g. "12 71 North Kellner
 * Road, Columbus, OH 43209" instead of "71 North Kellner Road, ...". A real
 * street address never starts with two separate number tokens, so any
 * leading one immediately followed by another is dropped.
 */
function extractAddress(text: string, extraPatterns: RegExp[] = []): string {
  const raw = extractStr(text, [...extraPatterns, ...ADDRESS_PATTERNS]);
  return raw.replace(/^\d+\s+(?=\d+\s)/, '');
}

// ── Per-block measurement extractor ──────────────────────────────────────────
// Used for both individual structure blocks and the combined summary/full text.

function extractMeasurements(block: string, structureNumber: number): RoofrStructureSummary {
  // Total area — "Total roof area: 1411 sqft" or "Total roof area 1066 sqft"
  const totalRoofAreaSqft = extractNum(block, [
    /Total\s+roof\s+area\s*:?\s*([\d,]+)\s*sqft/i,
    /Total\s+roof\s+area\s*:?\s*([\d,]+)\s+sq\s*ft/i,
    /Total\s+roof\s+area\s*:?\s*([\d,]+)/i,
  ]);

  const totalPitchedAreaSqft = extractNum(block, [
    /(?:Total\s+)?[Pp]itched\s+roof\s+area\s*:?\s*([\d,]+)/i,
  ]);

  const totalFlatAreaSqft = extractNum(block, [
    /(?:Total\s+)?[Ff]lat\s+roof\s+area\s*:?\s*([\d,]+)/i,
  ]);

  const totalRoofFacets = extractNum(block, [
    /Total\s+roof\s+facets\s*:?\s*([\d,]+)/i,
    /([\d,]+)\s+facets?/i,
  ]);

  const predominantPitch = extractStr(block, [
    /Predominant\s+pitch\s*:?\s*(\d+\/\d+)/i,
    /Pitch\s*:?\s*(\d+\/\d+)/i,
  ]);

  // Linear measurements — structure pages use "Total eaves XXft YYin"
  // combined pages use "Eaves: XXft YYin"
  const totalEavesFt = extractFtIn(block, [
    new RegExp(`Eaves\\s*:\\s*${LF_TOKEN}`, 'i'),
    new RegExp(`Total\\s+eaves\\s+${LF_TOKEN}`, 'i'),
  ]);

  const totalValleysFt = extractFtIn(block, [
    new RegExp(`Valleys\\s*:\\s*${LF_TOKEN}`, 'i'),
    new RegExp(`Total\\s+valleys\\s+${LF_TOKEN}`, 'i'),
  ]);

  const totalHipsFt = extractFtIn(block, [
    new RegExp(`Hips\\s*:\\s*${LF_TOKEN}`, 'i'),
    new RegExp(`Total\\s+hips\\s+${LF_TOKEN}`, 'i'),
  ]);

  const totalRidgesFt = extractFtIn(block, [
    new RegExp(`Ridges\\s*:\\s*${LF_TOKEN}`, 'i'),
    new RegExp(`Total\\s+ridges\\s+${LF_TOKEN}`, 'i'),
  ]);

  const totalRakesFt = extractFtIn(block, [
    new RegExp(`Rakes\\s*:\\s*${LF_TOKEN}`, 'i'),
    new RegExp(`Total\\s+rakes\\s+${LF_TOKEN}`, 'i'),
  ]);

  const totalWallFlashingFt = extractFtIn(block, [
    new RegExp(`Wall\\s+flashing\\s*:\\s*${LF_TOKEN}`, 'i'),
    new RegExp(`Total\\s+wall\\s+flashing\\s+${LF_TOKEN}`, 'i'),
  ]);

  const totalStepFlashingFt = extractFtIn(block, [
    new RegExp(`Step\\s+flashing\\s*:\\s*${LF_TOKEN}`, 'i'),
    new RegExp(`Total\\s+step\\s+flashing\\s+${LF_TOKEN}`, 'i'),
  ]);

  // "Hips + ridges" / "Eaves + rakes" combined lines (structure summary pages)
  const hipsAndRidgesFt =
    extractFtIn(block, [new RegExp(`Hips\\s*\\+\\s*ridges\\s+${LF_TOKEN}`, 'i')]) ||
    (totalHipsFt + totalRidgesFt);

  const eavesAndRakesFt =
    extractFtIn(block, [new RegExp(`Eaves\\s*\\+\\s*rakes\\s+${LF_TOKEN}`, 'i')]) ||
    (totalEavesFt + totalRakesFt);

  return {
    structureNumber,
    totalRoofAreaSqft,
    totalPitchedAreaSqft,
    totalFlatAreaSqft,
    totalRoofFacets,
    predominantPitch,
    totalEavesFt,
    totalValleysFt,
    totalHipsFt,
    totalRidgesFt,
    totalRakesFt,
    totalWallFlashingFt,
    totalStepFlashingFt,
    hipsAndRidgesFt,
    eavesAndRakesFt,
  };
}

// ── Material calculations ─────────────────────────────────────────────────────

const MATERIAL_PRODUCTS: Array<{ name: string; unit: string }> = [
  { name: 'Shingle (total sqft)', unit: 'sqft' },
  { name: 'Starter (eaves + rakes)', unit: 'ft' },
  { name: 'Ice and Water (eaves + valleys + flashings)', unit: 'ft' },
  { name: 'Synthetic (total sqft; no laps)', unit: 'sqft' },
  { name: 'Capping (hips + ridges)', unit: 'ft' },
  { name: "10' Drip Edge (eaves + rakes; no laps)", unit: 'sheet' },
];

// Roofr dynamically centers the Material Calculations table's waste columns on
// the report's recommended waste % (e.g. "Waste (10%) Waste (15%) Waste (17%)
// Waste (20%)") rather than always showing a fixed 0/10/12/15 set. Reading the
// header labels tells us which literal percent each column actually is.
/**
 * The pitch breakdown table:
 *
 *   Pitch         5/12   7/12
 *   Area (sqft)    795    691
 *   Squares        8.0    7.0
 *
 * Anchored on "Area (sqft)" rather than "Pitch", because "Predominant pitch
 * 5/12" appears higher on the same page and would shift the columns.
 *
 * Returns [] unless the parsed squares reconcile with the report's own total —
 * a partial read must not become a charge.
 */
const parsePitchAreas = (text: string, totalRoofAreaSqft: number): RoofrPitchArea[] => {
  const areaIdx = text.search(/Area\s*\(\s*sqft\s*\)/i);
  if (areaIdx < 0) return [];
  const squaresOffset = text.slice(areaIdx).search(/\bSquares\b/i);
  if (squaresOffset < 0) return [];

  const header  = text.slice(Math.max(0, areaIdx - 300), areaIdx);
  const areasTx = text.slice(areaIdx, areaIdx + squaresOffset);
  const sqTx    = text.slice(areaIdx + squaresOffset);

  const pitches = [...header.matchAll(/(\d{1,2})\s*\/\s*12/g)].map((m) => Number(m[1]));
  const areas   = [...areasTx.matchAll(/([\d,]+(?:\.\d+)?)/g)].map((m) => Number(m[1].replace(/,/g, '')));
  const squares = [...sqTx.matchAll(/([\d,]+(?:\.\d+)?)/g)].map((m) => Number(m[1].replace(/,/g, '')));

  const n = Math.min(pitches.length, areas.length, squares.length);
  if (n === 0) return [];

  // Nearest the table wins, so a stray pitch mentioned above does not shift it.
  const rows = pitches.slice(-n).map((pitchNum, i) => ({
    pitch: `${pitchNum}/12`,
    pitchNum,
    areaSqft: areas[i],
    squares: squares[i],
  }));

  // Reconcile before trusting it: the rows must account for the whole roof.
  const summed = rows.reduce((acc, r) => acc + r.areaSqft, 0);
  if (totalRoofAreaSqft <= 0) return [];
  const drift = Math.abs(summed - totalRoofAreaSqft) / totalRoofAreaSqft;
  if (drift > 0.02) return [];

  return rows;
};

const parseWasteColumnPercents = (text: string): number[] => {
  const headingMatch = /Material\s+calculations?/i.exec(text);
  if (!headingMatch) return [];
  const header = text.slice(headingMatch.index, headingMatch.index + 400);
  return [...header.matchAll(/Waste\s*\(\s*(\d{1,2})\s*%\s*\)/gi)].map((m) => parseInt(m[1], 10));
};

const parseProductFromText = (
  text: string,
  productName: string,
  unit: string,
  columnPercents: number[],
): RoofrMaterialCalculation | null => {
  const escaped = productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const productMatch = text.match(new RegExp(escaped, 'i'));
  if (!productMatch || productMatch.index === undefined) return null;

  const afterProduct = text.slice(productMatch.index + productMatch[0].length);
  const columnCount = columnPercents.length || 4;
  const nums = [...afterProduct.matchAll(/([\d,]+)/g)]
    .slice(0, columnCount)
    .map((m) => Number(m[1].replace(/,/g, '')));

  if (nums.length < 1) return null;

  // Reconstruct the 0/10/12/15 buckets from whichever columns the report
  // actually has, instead of trusting fixed positions. Derive the implied
  // unwasted base quantity from the lowest available column (base = value /
  // (1 + pct/100)) and recompute every bucket from that — this is the same
  // math Roofr uses to generate the table, so it reproduces the real numbers
  // for any percent, including ones outside the four printed columns.
  const percents = columnPercents.length === nums.length ? columnPercents : [0, 10, 12, 15].slice(0, nums.length);
  let minIdx = 0;
  for (let i = 1; i < percents.length; i++) if (percents[i] < percents[minIdx]) minIdx = i;
  const base = percents[minIdx] > 0
    ? Math.round(nums[minIdx] / (1 + percents[minIdx] / 100))
    : nums[minIdx];

  return {
    product: productName,
    unit,
    waste0: base,
    waste10: Math.round(base * 1.10),
    waste12: Math.round(base * 1.12),
    waste15: Math.round(base * 1.15),
  };
};

const parseMaterialCalculations = (text: string): RoofrMaterialCalculation[] => {
  if (!/Material\s+calculations?/i.test(text)) return [];
  const columnPercents = parseWasteColumnPercents(text);
  return MATERIAL_PRODUCTS.map((p) => parseProductFromText(text, p.name, p.unit, columnPercents)).filter(
    Boolean,
  ) as RoofrMaterialCalculation[];
};

const sumStructures = (structures: RoofrStructureSummary[]): RoofrStructureSummary => ({
  structureNumber: 0,
  totalRoofAreaSqft: structures.reduce((sum, structure) => sum + structure.totalRoofAreaSqft, 0),
  totalPitchedAreaSqft: structures.reduce((sum, structure) => sum + structure.totalPitchedAreaSqft, 0),
  totalFlatAreaSqft: structures.reduce((sum, structure) => sum + structure.totalFlatAreaSqft, 0),
  totalRoofFacets: structures.reduce((sum, structure) => sum + structure.totalRoofFacets, 0),
  predominantPitch:
    structures.find((structure) => structure.predominantPitch)?.predominantPitch ?? '',
  totalEavesFt: structures.reduce((sum, structure) => sum + structure.totalEavesFt, 0),
  totalValleysFt: structures.reduce((sum, structure) => sum + structure.totalValleysFt, 0),
  totalHipsFt: structures.reduce((sum, structure) => sum + structure.totalHipsFt, 0),
  totalRidgesFt: structures.reduce((sum, structure) => sum + structure.totalRidgesFt, 0),
  totalRakesFt: structures.reduce((sum, structure) => sum + structure.totalRakesFt, 0),
  totalWallFlashingFt: structures.reduce(
    (sum, structure) => sum + structure.totalWallFlashingFt,
    0,
  ),
  totalStepFlashingFt: structures.reduce(
    (sum, structure) => sum + structure.totalStepFlashingFt,
    0,
  ),
  hipsAndRidgesFt: structures.reduce((sum, structure) => sum + structure.hipsAndRidgesFt, 0),
  eavesAndRakesFt: structures.reduce((sum, structure) => sum + structure.eavesAndRakesFt, 0),
});

const getReportSummary = (report: RoofrParsedReport): RoofrStructureSummary | null => {
  if (report.reportSummary) {
    return report.reportSummary;
  }

  if (report.structures.length > 0) {
    return sumStructures(report.structures);
  }

  if (report.totalRoofAreaSqft > 0) {
    return {
      structureNumber: 0,
      totalRoofAreaSqft: report.totalRoofAreaSqft,
      totalPitchedAreaSqft: report.totalRoofAreaSqft,
      totalFlatAreaSqft: 0,
      totalRoofFacets: report.totalRoofFacets,
      predominantPitch: report.predominantPitch,
      totalEavesFt: 0,
      totalValleysFt: 0,
      totalHipsFt: 0,
      totalRidgesFt: 0,
      totalRakesFt: 0,
      totalWallFlashingFt: 0,
      totalStepFlashingFt: 0,
      hipsAndRidgesFt: 0,
      eavesAndRakesFt: 0,
    };
  }

  return null;
};

// ── EagleView Walls report ─────────────────────────────────────────────────────
// EagleView "Walls" report format (siding estimates).
// We extract every measured field available and fall back to derived estimates
// only when the PDF does not contain a given value — all fallbacks are flagged
// in the generated line item descriptions so the estimator knows to verify.

export interface EagleViewWallsReport {
  address: string;
  source: 'eagleview-walls';
  // ── Area measurements ──────────────────────────────────────────────────────
  totalWallAreaSqft: number;    // Gross wall area (including windows & doors)
  totalSidingAreaSqft: number;  // Net siding/cladding area (windows/doors subtracted)
  totalMasonryAreaSqft: number; // Brick/stone area
  // ── Linear measurements (0 = not found in PDF) ────────────────────────────
  wallPerimeterFt: number;      // Total wall perimeter at grade — drives starter strip
  eaveLinearFt: number;         // Roof-to-wall intersection (eave/soffit edge) lf
  // ── Opening counts (0 = not found) ───────────────────────────────────────
  windowCount: number;          // Total window openings
  doorCount: number;            // Total door openings
  windowAreaSqft: number;       // Total window area (for perimeter cross-check)
  doorAreaSqft: number;         // Total door area
  // ── Corner counts (0 = not found) ────────────────────────────────────────
  insideCornerCount: number;
  outsideCornerCount: number;
  // ── Wall height (0 = not found, derived from area/perimeter if possible) ──
  wallHeightFt: number;
}

export const parseEagleViewWallsReportFromFile = async (file: File): Promise<EagleViewWallsReport> => {
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  const doc = await pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  let fullText = '';
  for (let p = 1; p <= doc.numPages; p++) {
    try {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      fullText += (tc.items as any[]).map((i: any) => i?.str ?? '').join(' ') + ' ';
    } catch { /* skip */ }
  }
  const text = fullText.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();

  if (!/eagle\s*view/i.test(text)) {
    throw new Error('This does not appear to be an EagleView report.');
  }
  if (!/Total\s+Siding\s+Area/i.test(text) && !/Wall\s+Area/i.test(text)) {
    throw new Error('This does not appear to be an EagleView Walls report. Please upload the EagleView Walls PDF.');
  }


  // ── Area fields ────────────────────────────────────────────────────────────
  const totalWallAreaSqft = extractNum(text, [
    /Wall\s+Area\s+including\s+Windows?\s+(?:&|and)\s+Doors?\s*=\s*([\d,.]+)/i,
    /Total\s+Wall\s+Area\s*=\s*([\d,.]+)/i,
    /Gross\s+Wall\s+Area\s*=\s*([\d,.]+)/i,
  ]);
  const totalSidingAreaSqft = extractNum(text, [
    /Total\s+Siding\s+Area\s*=\s*([\d,.]+)/i,
    /Net\s+Siding\s+Area\s*=\s*([\d,.]+)/i,
    /Siding\s+Area\s*=\s*([\d,.]+)/i,
  ]);
  const totalMasonryAreaSqft = extractNum(text, [
    /Total\s+Masonry\s+Area\s*=\s*([\d,.]+)/i,
    /Masonry\s+Area\s*=\s*([\d,.]+)/i,
  ]);
  const windowAreaSqft = extractNum(text, [
    /(?:Total\s+)?Window\s+Area\s*=\s*([\d,.]+)/i,
    /Windows?\s+Area\s*=\s*([\d,.]+)/i,
  ]);
  const doorAreaSqft = extractNum(text, [
    /(?:Total\s+)?Door\s+Area\s*=\s*([\d,.]+)/i,
    /Doors?\s+Area\s*=\s*([\d,.]+)/i,
  ]);

  // ── Linear fields ──────────────────────────────────────────────────────────
  const wallPerimeterFt = extractNum(text, [
    /Wall\s+Perimeter\s*=\s*([\d,.]+)\s*ft/i,
    /Total\s+Perimeter\s*=\s*([\d,.]+)\s*ft/i,
    /Perimeter\s*=\s*([\d,.]+)\s*ft/i,
    /Wall\s+Perimeter\s*:?\s*([\d,.]+)/i,
  ]);
  const eaveLinearFt = extractNum(text, [
    /Eave\s+(?:Length|Linear\s+(?:Ft|Feet))\s*=\s*([\d,.]+)/i,
    /Roof.to.Wall\s+(?:Length|Intersection)\s*=\s*([\d,.]+)/i,
    /Eave\/Soffit\s+Length\s*=\s*([\d,.]+)/i,
    /Soffit\s+Length\s*=\s*([\d,.]+)/i,
  ]);

  // ── Opening counts ─────────────────────────────────────────────────────────
  const windowCount = extractNum(text, [
    /(?:Number\s+of\s+)?Windows?\s*=\s*([\d,]+)(?!\s*(?:sq|ft|area))/i,
    /Window\s+Count\s*=?\s*([\d,]+)/i,
    /Windows?\s*:\s*([\d,]+)/i,
  ]);
  const doorCount = extractNum(text, [
    /(?:Number\s+of\s+)?Doors?\s*=\s*([\d,]+)(?!\s*(?:sq|ft|area))/i,
    /Door\s+Count\s*=?\s*([\d,]+)/i,
    /Doors?\s*:\s*([\d,]+)/i,
  ]);

  // ── Corner counts ──────────────────────────────────────────────────────────
  const insideCornerCount = extractNum(text, [
    /Inside\s+Corners?\s*=\s*([\d,]+)/i,
    /Number\s+of\s+Inside\s+Corners?\s*:?\s*([\d,]+)/i,
    /Inside\s+Corner\s+Count\s*:?\s*([\d,]+)/i,
  ]);
  const outsideCornerCount = extractNum(text, [
    /Outside\s+Corners?\s*=\s*([\d,]+)/i,
    /Number\s+of\s+Outside\s+Corners?\s*:?\s*([\d,]+)/i,
    /Outside\s+Corner\s+Count\s*:?\s*([\d,]+)/i,
  ]);

  // ── Wall height ────────────────────────────────────────────────────────────
  const wallHeightFt = extractNum(text, [
    /(?:Average\s+)?Wall\s+Height\s*=\s*([\d,.]+)\s*ft/i,
    /Story\s+Height\s*=\s*([\d,.]+)\s*ft/i,
    /Ceiling\s+Height\s*=\s*([\d,.]+)\s*ft/i,
  ]);

  if (totalSidingAreaSqft === 0 && totalWallAreaSqft === 0) {
    throw new Error('Could not read wall measurement data from this EagleView Walls report.');
  }

  return {
    address: extractAddress(text),
    source: 'eagleview-walls',
    totalWallAreaSqft,
    totalSidingAreaSqft,
    totalMasonryAreaSqft,
    windowAreaSqft,
    doorAreaSqft,
    wallPerimeterFt,
    eaveLinearFt,
    windowCount,
    doorCount,
    insideCornerCount,
    outsideCornerCount,
    wallHeightFt,
  };
};

export const buildEagleViewWallsLineItems = (
  report: EagleViewWallsReport,
  companyPricing: CompanyPricing[],
  wastePercent = 10,
  /** Override which area figure to use as the siding base (sqft). Defaults to Siding Area → Wall Area. */
  areaSourceSqft?: number,
): LineItem[] => {
  const sidingBase = areaSourceSqft ?? (report.totalSidingAreaSqft || report.totalWallAreaSqft);
  if (sidingBase === 0) return [];

  // ── Area/quantity calculations ─────────────────────────────────────────────
  const sidingWithWaste = Math.round(sidingBase * (1 + wastePercent / 100));
  const sidingSquares   = Math.round((sidingWithWaste / 100) * 100) / 100;
  const removalSquares  = Math.round((sidingBase / 100) * 100) / 100;

  // House wrap: 9×100 roll covers 900 sq ft; apply same waste factor
  const HOUSE_WRAP_ROLL_SQFT = 900;
  const houseWrapRolls = Math.ceil(sidingWithWaste / HOUSE_WRAP_ROLL_SQFT);

  // ── Derived wall height ────────────────────────────────────────────────────
  // Use reported value first; fall back to area ÷ perimeter; last resort = 9 ft.
  const wallHeightFt =
    report.wallHeightFt > 0
      ? report.wallHeightFt
      : report.wallPerimeterFt > 0
        ? Math.round((sidingBase / report.wallPerimeterFt) * 10) / 10
        : 9;

  // ── Opening area ───────────────────────────────────────────────────────────
  // Gross wall - net siding = total opening (window + door) area
  const openingAreaSqft =
    report.windowAreaSqft + report.doorAreaSqft > 0
      ? report.windowAreaSqft + report.doorAreaSqft
      : Math.max(0, report.totalWallAreaSqft - report.totalSidingAreaSqft);

  // ── Starter strip: full perimeter at base of walls ────────────────────────
  const starterMeasured = report.wallPerimeterFt > 0;
  const starterStripLf = starterMeasured
    ? Math.ceil(report.wallPerimeterFt * 1.05) // 5% overlap/cut waste
    : Math.ceil(sidingSquares * 10);            // ~10 lf/sq fallback

  // ── J-channel: around all openings + eave/roofline terminations ──────────
  // Opening perimeter: from counts if available (avg 14 lf/window, 20 lf/door),
  // otherwise derive from opening area or fall back to area-based ratio.
  let openingPerimLf = 0;
  const openingCountMeasured = report.windowCount > 0 || report.doorCount > 0;
  if (openingCountMeasured) {
    // Average residential window perimeter ~14 lf (3×4 window, all 4 sides);
    // average exterior door ~20 lf (3×6.8, 3 sides).
    openingPerimLf = Math.ceil(report.windowCount * 14 + report.doorCount * 20);
  } else if (openingAreaSqft > 0) {
    // Area-based estimate: assume avg opening ~12 sq ft, 4-sided × 4.4 lf/side
    const estimatedOpeningCount = Math.round(openingAreaSqft / 12);
    openingPerimLf = Math.ceil(estimatedOpeningCount * 14);
  } else {
    // Last resort: rough ratio — avg house ~7 lf of opening perimeter per sq (reduced from 12 which over-counted)
    openingPerimLf = Math.ceil(sidingSquares * 7);
  }
  // Always compute a positive total; eave termination is additive.
  const jChannelTotal = Math.ceil(openingPerimLf + (report.eaveLinearFt > 0 ? report.eaveLinearFt * 1.05 : 0));

  // ── Window & door trim: opening perimeter only (no eave) ──────────────────
  // Same perimeter as openings only — trim casing runs around window/door frames,
  // not along the roofline. If we had to fall back for J-channel, use the same
  // opening-only figure so trim and J-channel opening quantities match.
  const trimLf = openingPerimLf;

  // ── Corner posts: count × wall height → convert to lf ─────────────────────
  // Standard corner post = 12.5 ft stock; we sell by the piece (ea).
  // Qty = corner count × ceil(wallHeight / 12.5) pieces per corner.
  const piecesPerCorner = Math.ceil(wallHeightFt / 12.5);
  const insideCornerMeasured  = report.insideCornerCount > 0;
  const outsideCornerMeasured = report.outsideCornerCount > 0;
  const insideCornerPcs  = insideCornerMeasured
    ? report.insideCornerCount  * piecesPerCorner
    : Math.max(2, Math.ceil(sidingSquares * 0.35)) * piecesPerCorner; // fallback ~1 per 3 sq
  const outsideCornerPcs = outsideCornerMeasured
    ? report.outsideCornerCount * piecesPerCorner
    : Math.max(2, Math.ceil(sidingSquares * 0.5)) * piecesPerCorner;  // fallback ~1 per 2 sq



  // ── Flag labels for descriptions ──────────────────────────────────────────
  const measured = (name: string) => `EagleView measured ${name}.`;
  const estimated = (formula: string) =>
    `⚠ Estimated (${formula} — EV report did not include this value; verify on site).`;

  type SidingItem = { aliases: string[]; quantity: number; unit: string; description: string };
  const items: SidingItem[] = [
    // 1. Siding Removal — always area-based (pre-waste)
    {
      aliases: ['Siding Removal'],
      quantity: removalSquares,
      unit: 'sq',
      description: `${measured('siding area')} ${sidingBase.toFixed(0)} sq ft = ${removalSquares} sq existing siding removal and disposal.`,
    },
    // 2. House Wrap — area + waste → rolls
    {
      aliases: ['House Wrap', 'House Wrap / Weather Barrier', 'Building Wrap', 'Moisture Barrier'],
      quantity: houseWrapRolls,
      unit: 'roll',
      description: `${measured('siding area')} ${sidingBase.toFixed(0)} sq ft + ${wastePercent}% waste = ${sidingWithWaste} sq ft ÷ ${HOUSE_WRAP_ROLL_SQFT} sq ft/roll = ${houseWrapRolls} rolls (9×100 ft).`,
    },
    // 3. Primary siding material — area + waste
    {
      aliases: ['Vinyl Siding', 'Fiber Cement Siding', 'Siding Installation', 'Siding'],
      quantity: sidingSquares,
      unit: 'sq',
      description: `${measured('siding area')} ${sidingBase.toFixed(0)} sq ft + ${wastePercent}% waste = ${sidingSquares} squares.`,
    },
    // 4. Starter strip — perimeter-based if available
    {
      aliases: ['Starter Strip', 'Starter Strip & J-Channel', 'Starter'],
      quantity: starterStripLf,
      unit: 'lf',
      description: starterMeasured
        ? `${measured('wall perimeter')} ${report.wallPerimeterFt.toFixed(0)} lf × 1.05 overlap = ${starterStripLf} lf starter strip at base of walls.`
        : estimated(`${sidingSquares} sq × 10 lf/sq = ${starterStripLf} lf; replace with measured perimeter`),
    },
    // 5. J-Channel — opening perimeters + roofline → 10-ft sticks
    {
      aliases: ['J-Channel', 'J Channel', 'J-Trim'],
      quantity: Math.ceil(jChannelTotal / 10),
      unit: 'stick',
      description: openingCountMeasured
        ? `${measured('opening counts')} ${report.windowCount} windows × 14 lf + ${report.doorCount} doors × 20 lf = ${openingPerimLf} lf openings${report.eaveLinearFt > 0 ? ` + ${report.eaveLinearFt.toFixed(0)} lf eave/roofline` : ''} = ${jChannelTotal} lf ÷ 10 lf/stick = ${Math.ceil(jChannelTotal / 10)} sticks.`
        : estimated(`~${openingPerimLf} lf${report.eaveLinearFt > 0 ? ` + ${report.eaveLinearFt.toFixed(0)} lf eave` : ''} = ${jChannelTotal} lf ÷ 10 lf/stick = ${Math.ceil(jChannelTotal / 10)} sticks; replace with measured counts`),
    },
    // 6. Inside corners — count × wall height → total lf (priced per lf)
    {
      aliases: ['Inside Corners', 'Inside Corner', 'Interior Corner'],
      quantity: insideCornerMeasured
        ? Math.round(report.insideCornerCount * wallHeightFt)
        : Math.round(Math.max(2, Math.ceil(sidingSquares * 0.35)) * wallHeightFt),
      unit: 'lf',
      description: insideCornerMeasured
        ? `${measured('inside corner count')} ${report.insideCornerCount} corners × ${wallHeightFt.toFixed(0)} ft wall height = ${Math.round(report.insideCornerCount * wallHeightFt)} lf inside corner material.`
        : estimated(`~${Math.max(2, Math.ceil(sidingSquares * 0.35))} corners × ${wallHeightFt.toFixed(0)} ft = ${Math.round(Math.max(2, Math.ceil(sidingSquares * 0.35)) * wallHeightFt)} lf; replace with actual corner count`),
    },
    // 7. Outside corners — count × wall height → total lf (priced per lf)
    {
      aliases: ['Outside Corners', 'Outside Corner', 'Exterior Corner'],
      quantity: outsideCornerMeasured
        ? Math.round(report.outsideCornerCount * wallHeightFt)
        : Math.round(Math.max(2, Math.ceil(sidingSquares * 0.5)) * wallHeightFt),
      unit: 'lf',
      description: outsideCornerMeasured
        ? `${measured('outside corner count')} ${report.outsideCornerCount} corners × ${wallHeightFt.toFixed(0)} ft wall height = ${Math.round(report.outsideCornerCount * wallHeightFt)} lf outside corner material.`
        : estimated(`~${Math.max(2, Math.ceil(sidingSquares * 0.5))} corners × ${wallHeightFt.toFixed(0)} ft = ${Math.round(Math.max(2, Math.ceil(sidingSquares * 0.5)) * wallHeightFt)} lf; replace with actual corner count`),
    },
    // 8. Window & door trim — opening perimeter only (no roofline)
    {
      aliases: ['Window & Door Trim', 'Window Trim', 'Door Trim', 'Trim Casing'],
      quantity: trimLf,
      unit: 'lf',
      description: openingCountMeasured
        ? `${measured('opening counts')} ${report.windowCount} windows × 14 lf + ${report.doorCount} doors × 20 lf = ${trimLf} lf of window/door casing.`
        : estimated(`${trimLf} lf based on opening perimeter; replace with sum of individual opening perimeters`),
    },
    // 9. Fasteners — allowance lot
    {
      aliases: ['Siding Nails & Fasteners', 'Nails & Fasteners', 'Corrosion-Resistant Fasteners', 'Fasteners'],
      quantity: 1,
      unit: 'lot',
      description: 'Corrosion-resistant nails and fasteners for siding installation (budgetary allowance).',
    },
    // 10. Caulk / Sealant — allowance lot
    {
      aliases: ['Siding Caulk / Sealant', 'Caulk / Sealant', 'Caulk', 'Sealant'],
      quantity: 1,
      unit: 'lot',
      description: 'Exterior-grade caulk at penetrations, corners, and trim transitions (budgetary allowance).',
    },
  ];

  // 11. Masonry (conditional)
  if (report.totalMasonryAreaSqft > 0) {
    items.push({
      aliases: ['Masonry', 'Brick Work', 'Stone Work', 'Masonry Repair'],
      quantity: Math.round(report.totalMasonryAreaSqft),
      unit: 'sqft',
      description: `${measured('masonry area')} ${report.totalMasonryAreaSqft.toFixed(0)} sq ft.`,
    });
  }

  return items.map((item, index) => {
    // Pass 'Siding' as preferCategory so that items shared between Roofing and Siding
    // (e.g. 'Starter Strip') pick up Siding pricing ($0.85/lf) rather than Roofing pricing ($55/bdl).
    const pricing = resolvePricing(companyPricing, item.aliases, item.description, item.unit, 'Siding');
    return {
      id: `eagleview-walls-${Date.now()}-${index}`,
      quote_id: '',
      category: 'Siding',
      item_name: pricing.itemName,
      description: item.description,
      // Always use item.unit — quantity was calculated against it.
      // pricing.unit may differ and would produce wrong totals if overridden.
      unit: item.unit,
      quantity: item.quantity,
      good_price: pricing.goodPrice,
      better_price: pricing.betterPrice,
      best_price: pricing.bestPrice,
      fixed_price: pricing.fixedPrice,
      // Labor is internal — the customer sees one all-in price, not the crew rate.
      hidden_from_customer: (item as any).hidden ?? false,
      sort_order: index,
    };
  });
};

// ── Manual gutter line-item builder ───────────────────────────────────────────
export interface GutterManualInput {
  style: '5-inch' | '6-inch' | '7-inch' | 'box';
  gutterLf: number;
  downspoutCount: number;
  downspoutLf: number;   // total lf of all downspout runs
  stories: '1' | '2';
  gutterGuards: boolean;
}

export const buildGutterLineItems = (
  input: GutterManualInput,
  companyPricing: CompanyPricing[],
): LineItem[] => {
  const { style, gutterLf, downspoutCount, downspoutLf, stories, gutterGuards } = input;
  if (gutterLf <= 0) return [];

  // ── Derived quantities ──────────────────────────────────────────────────────
  const elbowCount   = downspoutCount * 2;                  // A + B elbow per run
  const hangerBoxes  = Math.max(1, Math.ceil(gutterLf / 200)); // 1 per 2 lf, 100/box
  const sealantTubes = Math.max(1, Math.ceil(gutterLf / 75));

  // ── Style-keyed alias lists ─────────────────────────────────────────────────
  const GUTTER_ALIASES: Record<string, string[]> = {
    '5-inch': ['5 Aluminum Gutter – Seamless (per LF)', '5 in Seamless Aluminum Coil', 'Seamless Aluminum Gutter', 'Aluminum Gutter', 'Gutter'],
    '6-inch': ['6 Aluminum Gutter – Seamless (per LF)', '6 in Seamless Aluminum Coil', 'Seamless Aluminum Gutter', 'Aluminum Gutter', 'Gutter'],
    '7-inch': ['7 Aluminum Gutter (per LF)', '7 in Aluminum Gutter', 'Seamless Aluminum Gutter', 'Aluminum Gutter', 'Gutter'],
    'box':    ['Box Gutter (per LF)', 'Box Gutter', 'Seamless Aluminum Gutter', 'Aluminum Gutter', 'Gutter'],
  };
  const DOWNSPOUT_ALIASES: Record<string, string[]> = {
    '5-inch': ['5 Aluminum Downspout – 2x3 (per LF)', '2x3 Aluminum Downspout', 'Aluminum Downspout', 'Downspout'],
    '6-inch': ['6 Aluminum Downspout – 3x4 (per LF)', '3x4 Aluminum Downspout', 'Aluminum Downspout', 'Downspout'],
    '7-inch': ['Aluminum Downspout', 'Downspout'],
    'box':    ['Aluminum Downspout', 'Downspout'],
  };
  const ELBOW_ALIASES: Record<string, string[]> = {
    '5-inch': ['2x3 A/B Elbow', 'Downspout Elbow (A or B Style)', 'Downspout Elbow – Aluminum', 'A/B Elbow'],
    '6-inch': ['3x4 A/B Elbow', 'Downspout Elbow (A or B Style)', 'Downspout Elbow – Aluminum', 'A/B Elbow'],
    '7-inch': ['Downspout Elbow (A or B Style)', 'Downspout Elbow – Aluminum', 'A/B Elbow'],
    'box':    ['Downspout Elbow (A or B Style)', 'Downspout Elbow – Aluminum', 'A/B Elbow'],
  };

  const storiesLabel = stories === '2' ? '2-story' : '1-story';

  type GItem = { aliases: string[]; quantity: number; unit: string; description: string };
  const items: GItem[] = [];

  // 1. Primary gutter material
  items.push({
    aliases: GUTTER_ALIASES[style],
    quantity: gutterLf,
    unit: 'lf',
    description: `${style} seamless aluminum K-style gutter — ${gutterLf} lf, ${storiesLabel}.`,
  });

  // 2. Downspout material (by lf if given, else by count)
  if (downspoutLf > 0) {
    items.push({
      aliases: DOWNSPOUT_ALIASES[style],
      quantity: downspoutLf,
      unit: 'lf',
      description: `${style} downspout — ${downspoutLf} lf total${downspoutCount > 0 ? ` (${downspoutCount} runs)` : ''}, ${storiesLabel}.`,
    });
  } else if (downspoutCount > 0) {
    items.push({
      aliases: DOWNSPOUT_ALIASES[style],
      quantity: downspoutCount,
      unit: 'ea',
      description: `${style} downspout — ${downspoutCount} run${downspoutCount !== 1 ? 's' : ''}, ${storiesLabel}.`,
    });
  }

  // 3. A/B Elbows (2 per downspout run)
  if (elbowCount > 0) {
    items.push({
      aliases: ELBOW_ALIASES[style],
      quantity: elbowCount,
      unit: 'ea',
      description: `A/B elbows — ${downspoutCount} downspout run${downspoutCount !== 1 ? 's' : ''} × 2 = ${elbowCount} ea.`,
    });
  }

  // 4. Hidden hangers (1 per 2 lf, sold in boxes of 100)
  items.push({
    aliases: ['Hidden Gutter Hangers w/ Screws', 'Gutter Spike/Hanger – Hidden', 'Gutter Hidden Hanger w/ Screw', 'Gutter Hangers'],
    quantity: hangerBoxes,
    unit: 'box',
    description: `Hidden hangers — 1 per 2 lf = ${Math.ceil(gutterLf / 2)} hangers; ${hangerBoxes} box(es) of 100.`,
  });

  // 5. Sealant
  items.push({
    aliases: ['Gutter Sealant (10oz)', 'Gutter Sealant', 'Sealant'],
    quantity: sealantTubes,
    unit: 'tube',
    description: `Tripolymer gutter sealant — ${sealantTubes} tube${sealantTubes !== 1 ? 's' : ''} (1 per 75 lf of seams/end caps).`,
  });

  // 6. Gutter guards (optional — matches gutter lf)
  if (gutterGuards) {
    items.push({
      aliases: ['Standard Aluminum Gutter Guard', 'Leaf Guard (Aluminum Mesh)', 'Premium Micro-Mesh Gutter Guard', 'Micro-Mesh Gutter Guard – Aluminum 4ft', 'Gutter Guard', 'Guards'],
      quantity: gutterLf,
      unit: 'lf',
      description: `Gutter guards — ${gutterLf} lf to match gutter run.`,
    });
  }

  return items.map((item, index) => {
    const pricing = resolvePricing(companyPricing, item.aliases, item.description, item.unit);
    return {
      id: `gutter-manual-${Date.now()}-${index}`,
      quote_id: '',
      category: 'Gutters',
      item_name: pricing.itemName,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      good_price: pricing.goodPrice,
      better_price: pricing.betterPrice,
      best_price: pricing.bestPrice,
      fixed_price: pricing.fixedPrice,
      sort_order: index,
    };
  });
};

// ── EagleView roof parser ──────────────────────────────────────────────────────
// EagleView Premium Report format:
//  - Cover (p1):  "Total Roof Area =3,841 sq ft", "Total Ridges/Hips =348 ft", etc.
//  - Diagrams:    no parseable measurements
//  - Report Summary (p8): "Ridges = 53 ft (11 Ridges)", "Eaves/Starter† = 335 ft", etc.
//                         + waste table: "Area (Sq ft) 3841 4187 4379 ..."
// No per-structure breakdown in the Premium Report — single combined roof.

/** Use x-coordinate matching to find which waste % column EagleView marked "Suggested" */
function findSuggestedWastePercent(allPageItems: any[][]): number | undefined {
  for (const pageItems of allPageItems) {
    // Older Roofr reports label this column "Suggested"; current reports say
    // "Recommended" — match either so the waste-% auto-select keeps working.
    const suggestedItem = pageItems.find(
      (item: any) => typeof item?.str === 'string' && /^(suggested|recommended)$/i.test(item.str.trim()),
    );
    if (!suggestedItem) continue;

    const suggestedX: number = suggestedItem.transform?.[4];
    if (typeof suggestedX !== 'number') continue;

    // Collect all "N%" tokens on this page
    const pctItems = pageItems.filter(
      (item: any) => typeof item?.str === 'string' && /^\d+%$/.test(item.str.trim()),
    );
    if (pctItems.length === 0) continue;

    // Find closest by x-coordinate (within 60 PDF units)
    let closest: { pct: number; dist: number } | null = null;
    for (const pctItem of pctItems) {
      const pctX: number = pctItem.transform?.[4];
      if (typeof pctX !== 'number') continue;
      const dist = Math.abs(pctX - suggestedX);
      const pct = parseInt(pctItem.str, 10);
      if (!isNaN(pct) && (!closest || dist < closest.dist)) {
        closest = { pct, dist };
      }
    }

    if (closest && closest.dist < 60) return closest.pct;
  }
  return undefined;
}

function extractFlashingFt(text: string): number {
  // Match "Flashing = N ft" but NOT "Step flashing = N ft"
  const matches = [...text.matchAll(/([\w\s]*)flashing\s*=\s*([\d,]+)\s*ft/gi)];
  for (const m of matches) {
    const prefix = (m[1] ?? '').trim().toLowerCase();
    if (!prefix.includes('step')) {
      return parseInt(m[2].replace(/,/g, ''), 10);
    }
  }
  return 0;
}

function parseEagleViewReport(text: string, allPageItems: any[][]): RoofrParsedReport {

  // Area — prefer detailed summary "Total Area (All Pitches) = 3,841 sq ft"
  const totalRoofAreaSqft = extractNum(text, [
    /Total\s+Area\s+\(All\s+Pitches\)\s*=\s*([\d,]+)\s*sq\s*ft/i,
    /Total\s+Area\s*=\s*([\d,]+)\s*sq\s*ft/i,
    /Total\s+Roof\s+Area\s*=\s*([\d,]+)\s*sq\s*ft/i,
  ]);

  const totalRoofFacets = extractNum(text, [
    /Total\s+Roof\s+Facets\s*=?\s*([\d,]+)/i,
    /with\s+([\d,]+)\s+facets/i,
  ]);

  const predominantPitch = extractStr(text, [
    /Predominant\s+Pitch\s*=\s*(\d+\/\d+)/i,
    /predominant\s+pitch\s+on\s+this\s+roof\s+is\s+(\d+\/\d+)/i,
  ]);

  // Linear ft — EagleView uses plain integers (no "ft in")
  // The "†" dagger after Rakes/Eaves is handled by [^\w=]* matching any non-word chars
  const totalRidgesFt = extractNum(text, [/\bRidges\s*=\s*([\d,]+)\s*ft/i]);
  // IMPORTANT: Do NOT use bare /\bHips\s*=\s*/ — it matches "Total Ridges/Hips =348 ft"
  // because "/" is a word boundary before "H". Require the per-type count "(N Hips)".
  const totalHipsFt = (() => {
    const withCount = extractNum(text, [/\bHips\s*=\s*([\d,]+)\s*ft\s*\(\d+/i]);
    if (withCount > 0) return withCount;
    // Fallback: combined "Total Ridges/Hips =348 ft" minus ridges
    const combined = extractNum(text, [/Total\s+Ridges\/Hips\s*=\s*([\d,]+)\s*ft/i]);
    return combined > 0 ? Math.max(0, combined - totalRidgesFt) : 0;
  })();
  const totalValleysFt = extractNum(text, [/\bValleys\s*=\s*([\d,]+)\s*ft/i]);
  const totalRakesFt  = extractNum(text, [
    /\bRakes[^\w=]*=\s*([\d,]+)\s*ft/i,
    /Total\s+Rakes\s*=\s*([\d,]+)\s*ft/i,
  ]);
  const totalEavesFt  = extractNum(text, [
    /Eaves\/Starter[^\w=]*=\s*([\d,]+)\s*ft/i,
    /Total\s+Eaves\s*=\s*([\d,]+)\s*ft/i,
    /\bEaves[^\w\/=]*=\s*([\d,]+)\s*ft/i,
  ]);

  // Flashing: "Flashing = 18 ft" (not Step flashing)
  const totalWallFlashingFt = extractFlashingFt(text);
  const totalStepFlashingFt = extractNum(text, [/Step\s+flashing\s*=\s*([\d,]+)\s*ft/i]);

  // Drip Edge = Eaves + Rakes combined
  const dripEdgeFt = extractNum(text, [/Drip\s+Edge[^=]*=\s*([\d,]+)\s*ft/i]);

  const hipsAndRidgesFt = totalHipsFt + totalRidgesFt;
  const eavesAndRakesFt = dripEdgeFt > 0 ? dripEdgeFt : totalEavesFt + totalRakesFt;

  // ── Waste table ───────────────────────────────────────────────────────────
  // EagleView waste % columns: 0, 9, 14, 19, 22, 24(Suggested), 26, 29, 34
  // We map the first four to our waste0/10/12/15 buckets (9%≈10%, 14%≈12%, 19%≈15%).
  // EagleView always marks 24% as "Suggested" — store that so the UI can default to it.
  let shingleCalc: RoofrMaterialCalculation | null = null;
  // Coordinate-match the "Suggested" label to its waste % column
  const suggestedWastePercent: number | undefined = findSuggestedWastePercent(allPageItems);

  const wasteMatch = text.match(/Area\s*\(Sq\s*ft\)\s*([\d,\s]+?)(?:Squares|$)/i);
  if (wasteMatch) {
    const nums = [...wasteMatch[1].matchAll(/([\d,]+)/g)]
      .map((m) => parseInt(m[1].replace(/,/g, ''), 10))
      .filter((n) => n > 500);
    if (nums.length >= 4) {
      shingleCalc = {
        product: 'Shingle (total sqft)',
        unit: 'sqft',
        waste0:  nums[0], // EV 0%  → our 0%
        waste10: nums[1], // EV 9%  → our 10%
        waste12: nums[2], // EV 14% → our 12%
        waste15: nums[3], // EV 19% → our 15%
      };
    }
  }
  // Fallback: compute waste manually from measured area
  if (!shingleCalc && totalRoofAreaSqft > 0) {
    shingleCalc = {
      product: 'Shingle (total sqft)',
      unit: 'sqft',
      waste0:  totalRoofAreaSqft,
      waste10: Math.round(totalRoofAreaSqft * 1.10),
      waste12: Math.round(totalRoofAreaSqft * 1.12),
      waste15: Math.round(totalRoofAreaSqft * 1.15),
    };
  }

  const reportSummary: RoofrStructureSummary = {
    structureNumber: 0,
    totalRoofAreaSqft,
    totalPitchedAreaSqft: totalRoofAreaSqft,
    totalFlatAreaSqft: 0,
    totalRoofFacets,
    predominantPitch,
    totalEavesFt,
    totalValleysFt,
    totalHipsFt,
    totalRidgesFt,
    totalRakesFt,
    totalWallFlashingFt,
    totalStepFlashingFt,
    hipsAndRidgesFt,
    eavesAndRakesFt,
  };

  return {
    address: extractAddress(text),
    totalRoofAreaSqft,
    totalRoofFacets,
    predominantPitch,
    structures: [],
    reportSummary: totalRoofAreaSqft > 0 ? reportSummary : null,
    materialCalculations: shingleCalc ? [shingleCalc] : [],
    source: 'eagleview',
    suggestedWastePercent,
  };
}

// ── Main PDF parser ───────────────────────────────────────────────────────────

export const parseRoofrPdfReport = async (file: File): Promise<RoofrParsedReport> => {
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  // pdfjsLib is statically imported at the top of this file; the worker is
  // served from /public/pdf.worker.min.mjs and workerSrc is set at module load.
  const document = await pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  // Extract text from each page using two strategies:
  // 1. hasEOL-aware concatenation
  // 2. newline-separated fallback when hasEOL is unreliable
  const normalizePageText = (raw: string) =>
    raw
      .replace(/\u0000/g, '')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .trim();

  const pages: string[] = [];
  const pagesAlt: string[] = [];
  const allPageItems: any[][] = []; // raw items for coordinate-based parsing
  // Counted so a PDF we could not read is reported as such, rather than as the
  // wrong kind of report.
  let failedPages = 0;

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    try {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const items = Array.isArray(textContent?.items) ? textContent.items : [];
      allPageItems.push(items);

      const textHasEOL = items.reduce((acc: string, item: any) => {
        if (!item || typeof item.str !== 'string') return acc;
        const eol = item.hasEOL ? '\n' : '';
        const needsSpace =
          !eol &&
          acc.length > 0 &&
          !acc.endsWith(' ') &&
          !acc.endsWith('\n') &&
          item.str.length > 0 &&
          !item.str.startsWith(' ');
        return acc + (needsSpace ? ' ' : '') + item.str + eol;
      }, '');

      const textNewline = items
        .map((item: any) => (item && typeof item.str === 'string' ? item.str : ''))
        .join('\n');

      pages.push(normalizePageText(textHasEOL));
      pagesAlt.push(normalizePageText(textNewline));
    } catch {
      failedPages += 1;
      pages.push('');
      pagesAlt.push('');
      allPageItems.push([]);
    }
  }

  const combinedText = pages.join('\n');
  const combinedAlt = pagesAlt.join('\n');
  const richCombined = combinedText.length >= combinedAlt.length ? combinedText : combinedAlt;
  const text = richCombined.replace(/\s+/g, ' ').trim();

  // ── Step 2: auto-detect source format ────────────────────────────────────
  if (/eagle\s*view/i.test(text)) {
    if (/Total\s+Siding\s+Area/i.test(text) || (/\bWalls\b/.test(text) && !/Premium\s+Report/i.test(text))) {
      throw new Error('This looks like an EagleView Walls (siding) report. Please use the Siding upload section below.');
    }
    if (/\bTSRF\b/.test(text) && /\bSAV\b/.test(text) && /\bInform\b/i.test(text)) {
      throw new Error('This looks like an EagleView Solar (Inform Advanced) report. Please use the Solar upload section to import solar measurements.');
    }
    if (/SunSite/i.test(text)) {
      throw new Error('This looks like an EagleView SunSite™ Report for Solar. Please use the Solar upload section to import solar measurements.');
    }
    return parseEagleViewReport(text, allPageItems);
  }

  // Distinguish "we could not read this PDF" from "this is the wrong PDF".
  // Both used to produce the same message, which sent people hunting for a
  // different file when the reader had simply failed to load.
  const readable = text.replace(/\s/g, '');
  if (failedPages > 0 && failedPages === document.numPages) {
    throw new Error(
      'Could not read this PDF. Reload the page and try again — if it still fails, the file may be damaged.',
    );
  }
  if (readable.length < 40) {
    throw new Error(
      'No text could be read from this PDF. It looks like a scan or an image export — ask for a PDF exported directly from Roofr or EagleView.',
    );
  }

  const looksLikeRoofr = /roofr|roof\s*report|measurement\s*report/i.test(text);
  if (text.length > 200 && !looksLikeRoofr) {
    throw new Error(
      'This does not appear to be a Roofr or EagleView measurement report. Please upload a PDF exported from Roofr or EagleView.',
    );
  }

  // ── Step 3: per-structure blocks ──────────────────────────────────────────
  // Find all "Structure #N summary" / "Structure N summary" positions in the
  // normalised full-text, then slice between them to get isolated blocks.
  const structureHeaderRe = /Structure\s+#?(\d+)\s+summary/gi;
  const structurePositions: Array<{ num: number; start: number }> = [];
  let headerMatch: RegExpExecArray | null;
  while ((headerMatch = structureHeaderRe.exec(text)) !== null) {
    structurePositions.push({ num: parseInt(headerMatch[1], 10), start: headerMatch.index });
  }

  let structures: RoofrStructureSummary[] = structurePositions
    .map((pos, i) => {
      const blockEnd = structurePositions[i + 1]?.start ?? text.length;
      const block = text.slice(pos.start, blockEnd);
      return extractMeasurements(block, pos.num);
    })
    .filter((structure) => structure.totalRoofAreaSqft > 0);

  if (structures.length === 0) {
    structures = [
      ...pages.map((pageText) => {
        const match = pageText.match(/Structure\s+#?(\d+)\s+summary/i);
        if (!match) return null;
        return extractMeasurements(pageText, parseInt(match[1], 10));
      }),
      ...pagesAlt.map((pageText) => {
        const match = pageText.match(/Structure\s+#?(\d+)\s+summary/i);
        if (!match) return null;
        return extractMeasurements(pageText, parseInt(match[1], 10));
      }),
    ].filter((structure): structure is RoofrStructureSummary => !!structure && structure.totalRoofAreaSqft > 0);
  }

  // ── Step 4: combined / report summary ─────────────────────────────────────
  // Prefer the dedicated "Report summary" block.  If not found, try well-known
  // heading variants.  Last resort: run against the full text.
  let reportSummary: RoofrStructureSummary | null = null;

  const summarySources = [text, ...pages, ...pagesAlt];
  for (const source of summarySources) {
    const reportSummaryRe = /\b(Report\s+summary|Combined\s+summary|Total\s+summary)\b/i;
    const rsmatch = reportSummaryRe.exec(source);
    if (!rsmatch) continue;
    const nextSection = /\b(?:Material\s+calc|Structure\s+#?\d+\s+summary|Shingle\s+\()/i;
    const after = source.slice(rsmatch.index);
    const nextMatch = nextSection.exec(after);
    const block = nextMatch ? after.slice(0, nextMatch.index) : after;
    const m = extractMeasurements(block, 0);
    if (m.totalRoofAreaSqft > 0) {
      reportSummary = m;
      break;
    }
  }

  // Fallback: derive combined from the "Area measurement report" + "Length measurement report"
  if (!reportSummary) {
    const areaMatcher = /Area\s+measurement\s+report/i;
    const lengthMatcher = /Length\s+measurement\s+report/i;
    const areaIdx = areaMatcher.exec(text)?.index ?? -1;
    if (areaIdx >= 0) {
      // Take a ~1 000-char window from the area heading
      const areaBlock = text.slice(areaIdx, areaIdx + 1000);
      const lengthIdx = lengthMatcher.exec(text)?.index ?? -1;
      const lengthBlock = lengthIdx >= 0 ? text.slice(lengthIdx, lengthIdx + 800) : '';
      const combined = areaBlock + ' ' + lengthBlock;
      const m = extractMeasurements(combined, 0);
      if (m.totalRoofAreaSqft > 0) {
        reportSummary = m;
      }
    }
  }

  // Ultimate fallback: extract from the full text
  if (!reportSummary && structures.length === 0) {
    const m = extractMeasurements(text, 0);
    if (m.totalRoofAreaSqft > 0) {
      reportSummary = m;
    }
  }

  // ── Step 5: top-level totals ───────────────────────────────────────────────
  const summaryText =
    pages.find((page) => /Roof\s+Report/i.test(page)) ??
    pagesAlt.find((page) => /Roof\s+Report/i.test(page)) ??
    text;

  const totalRoofAreaSqft =
    reportSummary?.totalRoofAreaSqft ||
    structures.reduce((s, x) => s + x.totalRoofAreaSqft, 0) ||
    extractNum(summaryText, [/([\d,]+)\s*sqft/i, /([\d,]+)\s+sq\s*ft/i]);

  const totalRoofFacets =
    reportSummary?.totalRoofFacets ||
    extractNum(summaryText, [/Total\s+roof\s+facets\s*:?\s*([\d,]+)/i, /([\d,]+)\s+facets?/i]);

  const predominantPitch =
    reportSummary?.predominantPitch ||
    extractStr(summaryText, [/Predominant\s+pitch\s*:?\s*(\d+\/\d+)/i]);

  if (looksLikeRoofr && totalRoofAreaSqft === 0) {
    throw new Error(
      'Could not read area data from this Roofr report. Make sure you are uploading a Roofr "Roof Report" PDF (not a photo or work order). If the problem persists, re-export from Roofr.',
    );
  }

  // ── Step 6: material calculations ─────────────────────────────────────────
  const allCalcs = parseMaterialCalculations(text);
  const seen = new Set<string>();
  const materialCalculations = allCalcs.filter((c) => {
    const key = c.product.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });


  return {
    address: extractAddress(text),
    totalRoofAreaSqft,
    totalRoofFacets,
    predominantPitch,
    structures,
    reportSummary,
    materialCalculations,
    pitchAreas: parsePitchAreas(text, totalRoofAreaSqft),
  };
};

// ── Line item builder ─────────────────────────────────────────────────────────

const findPricingTemplate = (aliases: string[], preferCategory?: string) => {
  // Search all categories (Roofing, Siding, Gutters, etc.) so that siding items
  // generated by buildEagleViewWallsLineItems also get default prices when no
  // company pricing is configured for those items.
  // When preferCategory is supplied, items from that category are checked first so
  // we never accidentally apply a Roofing price (e.g. Starter Strip $55/bdl) to a
  // Siding item that happens to share the same name.
  const allDefaults = Object.values(defaultLineItems).flat();
  const preferred = preferCategory
    ? allDefaults.filter((item) => item.category?.toLowerCase() === preferCategory.toLowerCase())
    : [];
  const pool = preferCategory ? [...preferred, ...allDefaults] : allDefaults;
  return (
    pool.find((item) =>
      aliases.some((alias) => item.item_name.toLowerCase() === alias.toLowerCase()),
    ) ?? null
  );
};

// Normalize common unit-name aliases so comparisons are consistent.
// E.g. 'ea' → 'each', 'piece' → 'pc', 'lin ft' → 'lf'.
const normalizeUnit = (u: string): string => {
  const s = u.toLowerCase().trim();
  if (s === 'ea') return 'each';
  if (s === 'piece') return 'pc';
  if (s === 'lin ft' || s === 'linear ft' || s === 'linear feet' || s === 'linft') return 'lf';
  return s;
};

// Units that represent a lump-sum price for the whole job, not a per-unit rate.
// A company_pricing item with one of these units must never be matched to a
// generated line item that has a measurable unit (lf, sq, roll, pc, etc.),
// because multiplying a per-job price by a measured quantity inflates the total
// by 10–100× (e.g. "Flashing Package" at $150/lot × 49 lf = $7,350 instead of $49).
const LOT_UNITS = new Set(['lot', 'job', 'allowance', 'lump sum', 'ls']);

const isMeasuredUnit = (unit: string) => {
  const u = normalizeUnit(unit);
  return u === 'lf' || u === 'sq' || u === 'roll' || u === 'pc'
      || u === 'sheet' || u === 'bdl' || u === 'box' || u === 'bag' || u === 'gal'
      || u === 'pail' || u === 'tube' || u === 'each';
};

const resolvePricing = (
  companyPricing: CompanyPricing[],
  aliases: string[],
  fallbackDescription: string,
  fallbackUnit: string,
  preferCategory?: string,
) => {
  const normalizedAliases = aliases.map((a) => a.toLowerCase());
  const normalizedFallbackUnit = normalizeUnit(fallbackUnit);

  // Never match a lot/job-priced company item against a measurable-unit generated
  // item — that would multiply a per-job rate by a measured quantity.
  const lotUnitGuard = (item: CompanyPricing) =>
    !(LOT_UNITS.has(normalizeUnit(item.unit)) && isMeasuredUnit(normalizedFallbackUnit));

  // When both units are measurable they must match — prevents e.g. a $/pc company
  // item (W-Valley Metal 10ft) from being applied to an /lf generated quantity,
  // or a $/lf ridge-vent item from being applied to a /box generated quantity.
  const unitCompatibilityGuard = (item: CompanyPricing) => {
    if (!item.unit) return true;
    const companyUnit = normalizeUnit(item.unit);
    if (isMeasuredUnit(companyUnit) && isMeasuredUnit(normalizedFallbackUnit)) {
      return companyUnit === normalizedFallbackUnit;
    }
    return true;
  };

  const matchedCompanyItem =
    companyPricing.find((item) =>
      normalizedAliases.includes(item.item_name.toLowerCase()) &&
      lotUnitGuard(item) && unitCompatibilityGuard(item)
    ) ??
    companyPricing.find((item) =>
      lotUnitGuard(item) && unitCompatibilityGuard(item) &&
      normalizedAliases.some((alias) => {
        const itemName = item.item_name.toLowerCase();
        // Require the company item name to be at least 10 chars before allowing
        // the reverse substring match — prevents short names like "Drip", "Vent",
        // "Box", or "Flashing" from accidentally matching long canonical aliases.
        return itemName.includes(alias) || (itemName.length >= 10 && alias.includes(itemName));
      }),
    );

  if (matchedCompanyItem) {
    // Fall back to default template pricing for any tier the company hasn't configured (price = 0)
    const fallbackDefault = findPricingTemplate(aliases, preferCategory);
    const goodPrice = matchedCompanyItem.good_price > 0
      ? matchedCompanyItem.good_price
      : (fallbackDefault?.good_price ?? 0);
    return {
      itemName: aliases[0], // use canonical name; company pricing is used for prices only
      description: matchedCompanyItem.description || fallbackDescription,
      unit: matchedCompanyItem.unit || fallbackUnit,
      goodPrice,
      betterPrice: matchedCompanyItem.better_price > 0
        ? matchedCompanyItem.better_price
        : (fallbackDefault?.better_price ?? goodPrice),
      bestPrice: matchedCompanyItem.best_price > 0
        ? matchedCompanyItem.best_price
        : (fallbackDefault?.best_price ?? goodPrice),
      fixedPrice: matchedCompanyItem.fixed_price ?? false,
    };
  }

  const matchedDefault = findPricingTemplate(aliases, preferCategory);
  if (matchedDefault) {
    return {
      itemName: matchedDefault.item_name,
      description: matchedDefault.description || fallbackDescription,
      unit: matchedDefault.unit || fallbackUnit,
      goodPrice: matchedDefault.good_price,
      betterPrice: matchedDefault.better_price,
      bestPrice: matchedDefault.best_price,
      fixedPrice: matchedDefault.fixed_price ?? false,
    };
  }

  return {
    itemName: aliases[0],
    description: fallbackDescription,
    unit: fallbackUnit,
    goodPrice: 0,
    betterPrice: 0,
    bestPrice: 0,
    fixedPrice: false,
  };
};

const getWasteValue = (
  calculations: RoofrMaterialCalculation[],
  productName: string,
  wastePercent: number,
) => {
  const matched = calculations.find(
    (item) => item.product.toLowerCase() === productName.toLowerCase(),
  );
  if (!matched) return 0;
  // Exact bucket matches
  if (wastePercent <= 0)  return matched.waste0;
  if (wastePercent <= 10) return matched.waste10;
  if (wastePercent <= 12) return matched.waste12;
  if (wastePercent <= 15) return matched.waste15;
  // For higher percentages (e.g. EagleView 24%), scale from the measured base
  const base = matched.waste0 || matched.waste10;
  return base > 0 ? Math.round(base * (1 + wastePercent / 100)) : matched.waste15;
};

const roundQuantity = (value: number, decimals: number) => Number(value.toFixed(decimals));

const getMetricScale = (value: number, total: number) => {
  if (value <= 0 || total <= 0) return 0;
  return value / total;
};

/**
 * Takeoff coverage rates and waste rules.
 *
 * Quantities are net measurements plus the stated waste — no safety buffers on
 * top. Every figure here is a product coverage rate, so change it when the
 * product changes rather than padding a quantity somewhere downstream.
 */
/** Money is stored to the cent — never as a repeating fraction. */
const roundToCents = (n: number) => Math.round(n * 100) / 100;

/** Conditions the measurement report can't report — entered per job. */
export interface JobConditions {
  /** Stories at the eave. 1 = ranch. */
  stories: number;
  /** Existing shingle layers to tear off. 1 = single layer. */
  layers: number;
}

export const DEFAULT_JOB_CONDITIONS: JobConditions = { stories: 1, layers: 1 };

/** Flag a cap order when the rounding leaves this little slack, in linear feet. */
export const CAP_TIGHT_MARGIN_LF = 5;

export const TAKEOFF = {
  /** Bundles per roofing square (standard asphalt shingle packaging). */
  bundlesPerSquare: 3,
  /**
   * Flat bundles added to the field shingle count on top of the waste
   * calculation, per contractor direction. Note this does not scale with roof
   * size — the same 3 bundles land on a 5-square garage and a 60-square house.
   * Set to 0 to price purely off measurements and waste.
   */
  fieldShingleBundleUplift: 3,
  /** LF of eaves + rakes covered by one starter bundle (Atlas Pro-Cut). */
  starterLfPerBundle: 140,
  /** LF of ridges + hips covered by one hip & ridge bundle (Atlas Pro-Cut). */
  hipRidgeLfPerBundle: 31,
  /** Sq ft per synthetic underlayment roll (10-square roll). */
  underlaymentSqftPerRoll: 1000,
  /** LF of eaves + valleys covered by one ice & water roll (2 sq / 66 lf). */
  iceWaterLfPerRoll: 66,
  /** Length of one drip edge stick. */
  dripEdgeStickFt: 10,
  /** Lap waste on drip edge, applied before rounding up to whole sticks. */
  dripEdgeLapWastePct: 5,
  /** Squares of field shingles covered by one box of coil nails. */
  squaresPerCoilNailBox: 15,
  /** Squares of underlayment covered by one box of plastic cap nails. */
  squaresPerCapNailBox: 20,
  /** LF of flashing covered by one tube of sealant (plus one per pipe boot). */
  flashingLfPerSealantTube: 50,
} as const;

const buildRoofrItemsForSummary = (
  summary: RoofrStructureSummary,
  report: RoofrParsedReport,
  companyPricing: CompanyPricing[],
  wastePercent: number,
  label?: string,
  conditions: JobConditions = DEFAULT_JOB_CONDITIONS,
): LineItem[] => {
  const jobStories = Math.max(1, Math.round(conditions.stories || 1));
  const jobLayers  = Math.max(1, Math.round(conditions.layers  || 1));

  /** Ladder rungs resolve from the company's own library first, then the seeded list. */
  const ownedLookup = makeRungLookup(companyPricing.map(p => ({
    item_name: p.item_name, unit: p.unit,
    good_price: p.good_price, better_price: p.better_price, best_price: p.best_price,
  })));
  const seededLookup = makeRungLookup(DEFAULT_PRICE_LIST);
  const ladderRung = (name: string) => ownedLookup(name) ?? seededLookup(name);
  const overallSummary = getReportSummary(report) ?? summary;
  const totalAreaSqft = summary.totalRoofAreaSqft;
  const totalSquares = totalAreaSqft / 100;
  const areaScale = getMetricScale(summary.totalRoofAreaSqft, overallSummary.totalRoofAreaSqft);
  const starterScale = getMetricScale(summary.eavesAndRakesFt, overallSummary.eavesAndRakesFt);
  const cappingScale = getMetricScale(summary.hipsAndRidgesFt, overallSummary.hipsAndRidgesFt);
  // Ice & water is eaves-only (valleys → Valley Metal, step/wall flashing → own line items)
  const iceMetric = summary.totalEavesFt;
  const overallIceMetric = overallSummary.totalEavesFt;
  const iceScale = getMetricScale(iceMetric, overallIceMetric);

  // Industry-standard waste levels per material type:
  //   · shingleWaste: full user-selected % (field shingles need 10–20% for complex hip roofs)
  //   · linearWaste:  capped at 10% (trim items — starter, drip edge, hip/ridge, ice & water
  //                   only need 5–10% to cover overlaps and cut ends)
  const linearWaste = Math.min(wastePercent, 10);
  // Multiplier applied to raw EagleView measurements that have no pre-computed waste table
  const linearWasteMultiplier = 1 + linearWaste / 100;

  const shingleSqftBase = getWasteValue(
    report.materialCalculations,
    'Shingle (total sqft)',
    wastePercent,
  );
  const syntheticSqftBase = getWasteValue(
    report.materialCalculations,
    'Synthetic (total sqft; no laps)',
    linearWaste,
  );
  const starterFtBase = getWasteValue(
    report.materialCalculations,
    'Starter (eaves + rakes)',
    linearWaste,
  );
  const iceWaterFtBase = getWasteValue(
    report.materialCalculations,
    'Ice and Water (eaves + valleys + flashings)',
    linearWaste,
  );
  const cappingFtBase = getWasteValue(
    report.materialCalculations,
    'Capping (hips + ridges)',
    linearWaste,
  );
  // Drip edge carries lap waste only — 5% for the overlap at each stick joint.
  const DRIP_EDGE_WASTE = TAKEOFF.dripEdgeLapWastePct;
  const dripEdgeSheetsBase = getWasteValue(
    report.materialCalculations,
    "10' Drip Edge (eaves + rakes; no laps)",
    DRIP_EDGE_WASTE,
  );
  const ridgeFtBase = getWasteValue(
    report.materialCalculations,
    'Ridge (ridgeline only)',
    linearWaste,
  );
  const pipeBootCount = getWasteValue(report.materialCalculations, 'Pipe Boots', 0);

  // When no pre-computed waste table exists (e.g. EagleView reports), apply waste manually.
  // Shingles: apply full wastePercent; linear items: apply capped linearWaste.
  const shingleSqft = shingleSqftBase > 0
    ? shingleSqftBase * areaScale
    : Math.round(totalAreaSqft * (1 + wastePercent / 100));
  const syntheticSqft = syntheticSqftBase > 0
    ? syntheticSqftBase * areaScale
    : Math.round(totalAreaSqft * linearWasteMultiplier);
  // Starter, hip & ridge, ice & water, and drip edge run off NET measurements —
  // their coverage rates already account for laps, and the only waste the
  // takeoff rules add is the 5% on drip edge sticks, applied at the line item so
  // it isn't counted twice.
  //
  // Read the report's own measurement table at 0% waste first. A report with no
  // per-structure breakdown yields a summary whose linear fields are all zero,
  // and reading those directly would silently drop starter, ridge cap, ice &
  // water, and drip edge from the quote.
  const netFromReport = (metric: string) => getWasteValue(report.materialCalculations, metric, 0);
  const starterFt = summary.eavesAndRakesFt > 0
    ? summary.eavesAndRakesFt
    : netFromReport('Starter (eaves + rakes)');
  // Ice & water covers eaves + valleys only. Never use Roofr's precomputed total which
  // includes step/wall flashing LF and inflates the roll count.
  const iceWaterFt = (summary.totalEavesFt + summary.totalValleysFt) > 0
    ? summary.totalEavesFt + summary.totalValleysFt
    : netFromReport('Ice and Water (eaves + valleys + flashings)');
  const cappingFt = summary.hipsAndRidgesFt > 0
    ? summary.hipsAndRidgesFt
    : netFromReport('Capping (hips + ridges)');
  const dripEdgeLf = summary.eavesAndRakesFt > 0
    ? summary.eavesAndRakesFt
    : netFromReport("10' Drip Edge (eaves + rakes; no laps)") * TAKEOFF.dripEdgeStickFt;
  const ridgeScale = getMetricScale(summary.totalRidgesFt, overallSummary.totalRidgesFt);
  const ridgeFt = ridgeFtBase > 0
    ? ridgeFtBase * ridgeScale
    : Math.round(summary.totalRidgesFt * linearWasteMultiplier);
  // Ridge vent runs the ridgeline itself — there is no waste factor on a vent
  // the way there is on cap shingles, and ridgeFt carries the report's 10%
  // bucket. A 28'2" ridge was being called 31 lf, which reads as a wrong
  // measurement to anyone checking the quote and can order an extra box.
  const ridgeFtActual = (() => {
    const raw = getWasteValue(report.materialCalculations, 'Ridge (ridgeline only)', 0);
    return raw > 0 ? raw * ridgeScale : Math.round(summary.totalRidgesFt);
  })();
  // Precompute flashing LF with linear waste applied
  const valleyMetalLf    = Math.round(summary.totalValleysFt    * linearWasteMultiplier);
  const stepFlashingLf   = Math.round(summary.totalStepFlashingFt * linearWasteMultiplier);
  const wallFlashingLf   = Math.round(summary.totalWallFlashingFt  * linearWasteMultiplier);


  // Field squares after waste — the basis for bundle and coil nail counts.
  const shingleSquares = shingleSqft / 100;
  // Step + wall/apron flashing drives the sealant count.
  const totalFlashingLf = summary.totalStepFlashingFt + summary.totalWallFlashingFt;

  // Steep slope and complexity flags (based on overall roof, not per-structure)
  const pitchNum = parseInt((overallSummary.predominantPitch || '').split('/')[0], 10) || 0;
  const facetCount = overallSummary.totalRoofFacets || 0;

  // ── Labor bands ────────────────────────────────────────────────────────────
  // Which squares are actually steep. A roof is rarely one pitch: 731 Bulen is
  // 8 sq at 5/12 and 7 sq at 7/12, and charging on the predominant pitch alone
  // billed none of the steep work. Falls back to the old all-or-nothing rule
  // when the report has no usable breakdown.
  const steepPitchRows = (report.pitchAreas ?? []).filter((r) => r.pitchNum >= 7);
  const steepSquares = steepPitchRows.length > 0
    ? steepPitchRows.reduce((acc, r) => acc + r.squares, 0)
    : (pitchNum >= 7 ? totalSquares : 0);

  // Rate follows the steepest pitch that is actually present, not the
  // predominant one — on a 5/12 roof with a 7/12 section the predominant pitch
  // resolves to no band at all.
  const bandPitch = steepPitchRows.length > 0
    ? Math.max(...steepPitchRows.map((r) => r.pitchNum))
    : pitchNum;

  // Pitch comes from the measurement report; stories and existing layers are
  // job conditions the report can't know, so they arrive from the builder.
  const steepBand =
    bandPitch >= 13 ? { item: 'Steep Slope Adder – Very Steep (13+/12 pitch)', label: 'very steep, 13+/12', fallbacks: ['Steep Charge (10/12 - 12/12)'] }
    : bandPitch >= 10 ? { item: 'Steep Slope Adder – Steep (10–12/12 pitch)', label: 'steep, 10–12/12', fallbacks: ['Steep Charge (10/12 - 12/12)'] }
    : bandPitch >= 7 ? { item: 'Steep Slope Adder – Moderate (7–9/12 pitch)', label: 'moderate, 7–9/12', fallbacks: ['Steep Charge (7/12 - 9/12)'] }
    : null;
  const heightBand =
    jobStories >= 3 ? { item: 'Height Adder – 3+ Story (eave 21+ ft)', label: '3+ stories' }
    : jobStories === 2 ? { item: 'Height Adder – 2-Story (eave 16–20 ft)', label: '2 stories' }
    : null;
  const layerBand =
    jobLayers >= 3 ? { item: 'Tear-Off – 3rd+ Layer', label: `${jobLayers} existing layers` }
    : jobLayers === 2 ? { item: 'Tear-Off – 2nd Layer', label: '2 existing layers' }
    : null;

  // ── Roof decking: 3 sheets per roofing square ────────────────────────────────
  // This item syncs into any template line item whose name contains "deck",
  // "sheathing", "OSB", or "CDX" so the auto-filled quantity is in sheets, not sq.
  const deckingSheets = Math.round(totalSquares * 3);

  // ── Underlayment and ice & water are always billed per ROLL ─────────────────
  // "Code Upgrade – Full Deck" variants are separate sq-billed add-ons added manually.
  // Underlayment covers the deck, so it runs off net area — the cut waste that
  // applies to shingles doesn't apply to a rolled good laid edge to edge.
  const underlaymentRollsWeb = Math.ceil(totalAreaSqft / TAKEOFF.underlaymentSqftPerRoll);
  const underlaymentDesc =
    `Synthetic underlayment — ${totalAreaSqft.toFixed(0)} sq ft ÷ ${TAKEOFF.underlaymentSqftPerRoll.toLocaleString()} sq ft/roll = ${(totalAreaSqft / TAKEOFF.underlaymentSqftPerRoll).toFixed(2)}, round up = ${underlaymentRollsWeb} rolls (10 sq/roll)${label ? ` (${label})` : ''}.`;

  // (Eaves + valleys) ÷ 66 lf per 2-square roll
  const iceWaterRolls = Math.ceil(iceWaterFt / TAKEOFF.iceWaterLfPerRoll);
  const iceWaterDesc =
    `Ice & water shield — ${iceWaterFt.toFixed(1)} lf eaves + valleys ÷ ${TAKEOFF.iceWaterLfPerRoll} lf/roll = ${(iceWaterFt / TAKEOFF.iceWaterLfPerRoll).toFixed(2)}, round up = ${iceWaterRolls} rolls (2 sq/roll)${label ? ` (${label})` : ''}.`;

  // ── Itemized line items ────────────────────────────────────────────────────
  // Each item is priced individually at accurate market rates. The Architectural
  // Shingles per-sq price covers material + install labor (not tear-off or
  // accessories). When all items are summed on a typical job the total targets
  // Good ≈ $485 / Better ≈ $510 / Best ≈ $750 per installed square.
  const generatedItems = [
    {
      // OSB 7/16 leads: one sheet type at one price across all tiers, with the
      // thicker sheets as their own line items.
      aliases: ['OSB Sheathing 7/16 4x8', 'Roof Decking (5/8" CDX/OSB) Repair', 'Decking Repair (5/8" CDX/OSB)', 'Roof Deck Repair (1/2" CDX / Densdeck)', 'Roof Deck Inspection & Repair', 'Roof Decking'],
      quantity: 0,
      description: `Roof decking — enter the number of damaged or rotted sheets found during tear-off. Measurement estimate if full deck: ${deckingSheets} sheets (${totalSquares.toFixed(1)} sq × 3/sq)${label ? ` (${label})` : ''}.`,
      unit: 'sheet',
      alwaysInclude: true,
    },
    {
      // Tear-off covers removal + disposal of a single layer. 2nd/3rd layer surcharges
      // are separate lines below. Single-layer labor is priced into this line.
      aliases: ['Tear Off Existing Roof', 'Roof Tear Off', 'Shingle Tear Off'],
      quantity: roundQuantity(totalSquares, 2),
      description: `Tear-off existing roof — ${totalSquares.toFixed(1)} sq (single layer; 2nd/3rd layer surcharges added separately)${label ? ` (${label})` : ''}.`,
      unit: 'sq',
    },
    {
      aliases: ['Architectural Shingles', 'Field Shingles'],
      // Material only — install labor is billed separately on the Install Labor line.
      quantity: shingleSqft > 0 ? Math.round(shingleSqft / 100 * 10) / 10 : 0,
      description: `Architectural shingles (material) — ${(shingleSqft / 100).toFixed(2)} sq at ${wastePercent}% waste${label ? ` (${label})` : ''}.`,
      unit: 'sq',
    },
    {
      aliases: ['Underlayment / Leak Barrier', 'Synthetic Underlayment', 'Atlas Summit® 60', 'Atlas Summit® 180', 'Summit 60 – Standard Synthetic'],
      quantity: underlaymentRollsWeb,
      description: underlaymentDesc,
      unit: 'roll',
    },
    {
      aliases: ['Ice & Water Shield'],
      quantity: iceWaterRolls,
      description: iceWaterDesc,
      unit: 'roll',
    },
    {
      aliases: ['Starter Strip'],
      // (Eaves + rakes) ÷ coverage per bundle, rounded up to whole bundles
      quantity: Math.ceil(starterFt / TAKEOFF.starterLfPerBundle),
      description: `Starter strip — ${starterFt.toFixed(1)} lf eaves + rakes ÷ ${TAKEOFF.starterLfPerBundle} lf/bundle = ${(starterFt / TAKEOFF.starterLfPerBundle).toFixed(2)}, round up = ${Math.ceil(starterFt / TAKEOFF.starterLfPerBundle)} bundles${label ? ` (${label})` : ''}.`,
      unit: 'bdl',
    },
    {
      aliases: ['Hip & Ridge Cap', 'Hip & Ridge Cap Shingles'],
      // (Ridges + hips) ÷ coverage per bundle, rounded up to whole bundles
      quantity: Math.ceil(cappingFt / TAKEOFF.hipRidgeLfPerBundle),
      description: (() => {
        const bundles = Math.ceil(cappingFt / TAKEOFF.hipRidgeLfPerBundle);
        const spare = bundles * TAKEOFF.hipRidgeLfPerBundle - cappingFt;
        const base = `Hip & ridge cap — ${cappingFt.toFixed(1)} lf ridges + hips ÷ ${TAKEOFF.hipRidgeLfPerBundle} lf/bundle = ${(cappingFt / TAKEOFF.hipRidgeLfPerBundle).toFixed(2)}, round up = ${bundles} bundles${label ? ` (${label})` : ''}.`;
        // The rounding can land within a few feet of the bundle's coverage —
        // 28'2" of ridge plus waste comes to exactly 31 lf against 31 lf of
        // coverage. It computes as enough, but there is nothing spare if a
        // piece breaks or a run starts badly, so say so rather than let it
        // look comfortable.
        return base;
      })(),
      internalNote: (() => {
        const bundles = Math.ceil(cappingFt / TAKEOFF.hipRidgeLfPerBundle);
        const spare = bundles * TAKEOFF.hipRidgeLfPerBundle - cappingFt;
        return spare <= CAP_TIGHT_MARGIN_LF
          ? `Tight on cap — only ${spare.toFixed(1)} lf spare across ${bundles} bundle${bundles === 1 ? '' : 's'}. Consider carrying an extra.`
          : undefined;
      })(),
      unit: 'bdl',
    },
    {
      aliases: ['Ridge Vent & Attic Ventilation Balance', 'Ridge Vent'],
      // Standard ridge vent box covers ~16 lf of ridgeline
      quantity: Math.ceil(ridgeFtActual / 16),
      description: `Ridge vent: ${ridgeFtActual.toFixed(0)} lf ÷ 16 lf/box = ${Math.ceil(ridgeFtActual / 16)} boxes${label ? ` (${label})` : ''}.`,
      unit: 'box',
    },
    {
      aliases: ['Drip Edge'],
      // (Eaves + rakes) ÷ 10 ft sticks, +5% lap waste, rounded up to whole sticks
      quantity: Math.ceil((dripEdgeLf / TAKEOFF.dripEdgeStickFt) * (1 + TAKEOFF.dripEdgeLapWastePct / 100)),
      description: `Drip edge — ${dripEdgeLf.toFixed(1)} lf eaves + rakes ÷ ${TAKEOFF.dripEdgeStickFt} ft/stick = ${(dripEdgeLf / TAKEOFF.dripEdgeStickFt).toFixed(2)}, +${TAKEOFF.dripEdgeLapWastePct}% lap = ${((dripEdgeLf / TAKEOFF.dripEdgeStickFt) * (1 + TAKEOFF.dripEdgeLapWastePct / 100)).toFixed(2)}, round up = ${Math.ceil((dripEdgeLf / TAKEOFF.dripEdgeStickFt) * (1 + TAKEOFF.dripEdgeLapWastePct / 100))} sticks${label ? ` (${label})` : ''}.`,
      unit: 'pc',
    },
    // ── Flashing — individual LF items ────────────────────────────────────────
    {
      aliases: ['Valley Metal', 'Valley Metal Installation', 'Valley Lining'],
      quantity: valleyMetalLf,
      description: `Measurement import: valley metal at ${linearWaste}% waste — ${summary.totalValleysFt.toFixed(0)} lf + waste = ${valleyMetalLf} lf${label ? ` (${label})` : ''}.`,
      unit: 'lf',
    },
    {
      aliases: ['Step Flashing', 'Step Flashing Installation'],
      quantity: stepFlashingLf,
      description: `Measurement import: step flashing at ${linearWaste}% waste — ${summary.totalStepFlashingFt.toFixed(0)} lf + waste = ${stepFlashingLf} lf${label ? ` (${label})` : ''}.`,
      unit: 'lf',
    },
    {
      aliases: ['Flashing (Misc / Apron)', 'Roof Flashing'],
      quantity: wallFlashingLf,
      description: `Measurement import: wall/apron flashing at ${linearWaste}% waste — ${summary.totalWallFlashingFt.toFixed(0)} lf + waste = ${wallFlashingLf} lf${label ? ` (${label})` : ''}.`,
      unit: 'lf',
    },
    // ── Per-unit items ─────────────────────────────────────────────────────────
    {
      aliases: ['Nails & Fasteners', 'Roofing Coil Nails', 'Metal Roofing Screws & Sealant', 'Concealed Fastener Clips & Closures'],
      // Field squares ÷ 15 sq per box, rounded up
      quantity: Math.ceil(shingleSquares / TAKEOFF.squaresPerCoilNailBox),
      description: `Coil nails — ${shingleSquares.toFixed(2)} sq ÷ ${TAKEOFF.squaresPerCoilNailBox} sq/box = ${(shingleSquares / TAKEOFF.squaresPerCoilNailBox).toFixed(2)}, round up = ${Math.ceil(shingleSquares / TAKEOFF.squaresPerCoilNailBox)} box(es)${label ? ` (${label})` : ''}.`,
      unit: 'box',
    },
    {
      aliases: ['Plastic Cap Nails', 'Cap Nails'],
      // 1 box per 20 squares of underlayment, minimum 1
      quantity: totalSquares > 0 ? Math.max(1, Math.ceil(totalSquares / TAKEOFF.squaresPerCapNailBox)) : 0,
      description: `Plastic cap nails — ${totalSquares.toFixed(2)} sq of underlayment ÷ ${TAKEOFF.squaresPerCapNailBox} sq/box = ${(totalSquares / TAKEOFF.squaresPerCapNailBox).toFixed(2)}, round up (min 1) = ${Math.max(1, Math.ceil(totalSquares / TAKEOFF.squaresPerCapNailBox))} box(es)${label ? ` (${label})` : ''}.`,
      unit: 'box',
    },
    {
      aliases: ['Caulk / Sealant', 'OSI Quad Max Sealant', 'Sealant'],
      // 1 tube per 50 lf of flashing. Pipe boots don't add a tube — they come
      // with their own sealant.
      quantity: Math.ceil(totalFlashingLf / TAKEOFF.flashingLfPerSealantTube),
      description: `Sealant — ${totalFlashingLf.toFixed(1)} lf flashing ÷ ${TAKEOFF.flashingLfPerSealantTube} lf/tube = ${(totalFlashingLf / TAKEOFF.flashingLfPerSealantTube).toFixed(2)}, round up = ${Math.ceil(totalFlashingLf / TAKEOFF.flashingLfPerSealantTube)} tube(s)${label ? ` (${label})` : ''}.`,
      unit: 'tube',
    },
    {
      aliases: ['Spray Paint & Finish Detailing'],
      quantity: totalSquares > 0 ? 1 : 0,
      description: 'Touch-up spray paint for exposed metals and blended finish points.',
      unit: 'each',
    },
    {
      aliases: ['Pipe Boots / Split Boots / Seals', 'Pipe Boots'],
      quantity: pipeBootCount,
      description: `${pipeBootCount} pipe boot(s) for plumbing penetrations${label ? ` (${label})` : ''}.`,
      unit: 'each',
    },
    // ── Labor ──────────────────────────────────────────────────────────────────
    // Install labor — installation of new shingles only. Tear-off is priced
    // on the separate "Tear Off Existing Roof" line above.
    {
      aliases: ['Shingle Install Labor', 'Shingle Installation Labor', 'Shingle Roofing Labor', 'Roofing Labor'],
      // Billed on the shingle squares, waste included — the crew is laid out
      // and paid against the material that goes on the roof, not the bare
      // measured area. This billed the measured squares, quoting roughly $200
      // less than mobile on the same job. Jeff's call; mobile is the standard.
      quantity: roundQuantity(shingleSquares, 2),
      description: `Shingle install labor — ${shingleSquares.toFixed(2)} sq${label ? ` (${label})` : ''}.`,
      unit: 'sq',
    },
    // ── Labor surcharges ───────────────────────────────────────────────────────
    // One steep line, priced from the band the measured pitch falls into, so the
    // rate follows the roof rather than being chosen by hand.
    {
      aliases: steepBand
        ? [steepBand.item, ...steepBand.fallbacks, 'Steep Slope Labor', 'Steep Slope Labor Surcharge']
        : ['Steep Slope Labor', 'Steep Slope Labor Surcharge', 'Steep Charge'],
      quantity: roundQuantity(steepSquares, 2),
      description: steepPitchRows.length > 0
        ? `Steep pitch labor — ${steepPitchRows.map((r) => `${r.squares.toFixed(1)} sq at ${r.pitch}`).join(', ')}${label ? ` (${label})` : ''}.`
        : steepBand
          ? `Steep pitch labor — ${overallSummary.predominantPitch} pitch from the measurement report, ${steepBand.label}. ${steepSquares.toFixed(1)} sq${label ? ` (${label})` : ''}.`
          : `Steep pitch labor surcharge — ${overallSummary.predominantPitch} pitch (≥7/12). ${steepSquares.toFixed(1)} sq${label ? ` (${label})` : ''}.`,
      unit: 'sq',
      hidden: true,
    },
    // Story count isn't in the measurement report — it comes from the job setup.
    {
      aliases: heightBand ? [heightBand.item, 'Height Adder', 'Story Charge'] : ['Height Adder'],
      quantity: heightBand ? roundQuantity(totalSquares, 2) : 0,
      description: heightBand
        ? `Height labor — ${heightBand.label}. ${totalSquares.toFixed(1)} sq${label ? ` (${label})` : ''}.`
        : '',
      unit: 'sq',
      hidden: true,
    },
    // Existing layer count also comes from the job setup, not the report.
    {
      aliases: layerBand ? [layerBand.item, 'Tear-Off Layers'] : ['Tear-Off Layers'],
      quantity: layerBand ? roundQuantity(totalSquares, 2) : 0,
      description: layerBand
        ? `Additional tear-off labor — ${layerBand.label}. ${totalSquares.toFixed(1)} sq${label ? ` (${label})` : ''}.`
        : '',
      unit: 'sq',
      hidden: true,
    },
    {
      aliases: ['High Complexity Labor', 'High Complexity Labor Surcharge', 'Complexity Charge', 'Cut-Up Factor'],
      quantity: facetCount >= 21 ? roundQuantity(totalSquares, 2) : 0,
      description: `High complexity labor surcharge — ${facetCount} facets (≥21). ${totalSquares.toFixed(1)} sq${label ? ` (${label})` : ''}.`,
      unit: 'sq',
    },
  ].filter((item) => item.quantity > 0 || (item as any).alwaysInclude);

  return generatedItems.map((item, index) => {
    // priceUnit/priceDivisor let an item bill in a different unit than the one
    // company pricing is configured in (e.g. shingles priced per square but
    // billed per bundle) — look up the price in its configured unit, then
    // scale it down so quantity(billed unit) × price still totals correctly.
    const priceUnit = (item as any).priceUnit ?? item.unit;
    const priceDivisor = (item as any).priceDivisor ?? 1;
    let pricing = resolvePricing(companyPricing, item.aliases, item.description, priceUnit);

    // Last resort: the material list itself. resolvePricing only searches the
    // company library and the built-in templates, so an item that exists only
    // in the price list — labor, and anything added there since — came through
    // at zero.
    if (pricing.goodPrice === 0 && pricing.betterPrice === 0 && pricing.bestPrice === 0) {
      for (const alias of item.aliases) {
        const row = ladderRung(alias);
        if (row && normalizeUnit(row.unit) === normalizeUnit(priceUnit) && row.good_price > 0) {
          pricing = { ...pricing, itemName: row.item_name,
            goodPrice: row.good_price, betterPrice: row.better_price, bestPrice: row.best_price };
          break;
        }
      }
    }

    // Price from the material list when this line has a tier ladder — each tier
    // takes its own product at that product's contractor price. Name matching
    // against the company library is a fuzzy last resort and can land on an
    // unrelated row (a per-lf supplement matching a per-roll line), which is how
    // ice & water ended up at $1.33 a roll.
    const ladder = resolveTierLadder(item.aliases[0] ?? '', ladderRung);
    if (ladder && normalizeUnit(ladder.unit) === normalizeUnit(item.unit)) {
      return {
        id: `roofr-${label ?? 'combined'}-${Date.now()}-${index}`,
        quote_id: '',
        category: 'Roofing',
        item_name: pricing.itemName,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        good_product: ladder.good_product,
        better_product: ladder.better_product,
        best_product: ladder.best_product,
        good_price: roundToCents(ladder.good_price),
        better_price: roundToCents(ladder.better_price),
        best_price: roundToCents(ladder.best_price),
        fixed_price: pricing.fixedPrice,
        hidden_from_customer: (item as any).hidden ?? false,
        internal_note: (item as any).internalNote ?? null,
        sort_order: index,
      } as LineItem;
    }

    return {
      id: `roofr-${label ?? 'combined'}-${Date.now()}-${index}`,
      quote_id: '',
      category: 'Roofing',
      item_name: pricing.itemName,
      // Always use the measurement-derived description so the estimator can
      // see the exact math (sq ft ÷ roll size, lf ÷ bundle size, etc.).
      // The company pricing description is a generic label; the generated
      // description is the authoritative source of truth for this line item.
      description: item.description,
      // Always use the generator's unit — the quantity was calculated in this
      // unit (sq, roll, lf, etc.) and changing it would create a mismatch.
      unit: item.unit,
      quantity: item.quantity,
      // Round to cents — an unrounded $410/sq ÷ 3 renders as 136.66666666666666
      // in the price field and reads as a bug to the estimator.
      good_price: roundToCents(pricing.goodPrice / priceDivisor),
      better_price: roundToCents(pricing.betterPrice / priceDivisor),
      best_price: roundToCents(pricing.bestPrice / priceDivisor),
      fixed_price: pricing.fixedPrice,
      sort_order: index,
    };
  });
};

const buildStructureDivider = (label: string): LineItem => ({
  id: `roofr-divider-${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  quote_id: '',
  category: 'Roofing',
  item_name: label,
  description: '',
  unit: '',
  quantity: 0,
  good_price: 0,
  better_price: 0,
  best_price: 0,
  fixed_price: false,
  is_divider: true,
  sort_order: 0,
});

export const buildRoofrLineItems = (
  report: RoofrParsedReport,
  companyPricing: CompanyPricing[],
  wastePercent: number = 10,
  conditions: JobConditions = DEFAULT_JOB_CONDITIONS,
): LineItem[] => {
  const importMode = report.importMode ?? 'combined';
  const combinedSummary = getReportSummary(report);
  if (!combinedSummary) return [];

  if (importMode === 'combined' || report.structures.length <= 1) {
    return buildRoofrItemsForSummary(combinedSummary, report, companyPricing, wastePercent, undefined, conditions);
  }

  const groupedItems: LineItem[] = [];

  if (importMode === 'separate-and-combined') {
    groupedItems.push(buildStructureDivider('All Structures Combined'));
    groupedItems.push(
      ...buildRoofrItemsForSummary(
        combinedSummary,
        report,
        companyPricing,
        wastePercent,
        'all structures combined',
        conditions,
      ),
    );
  }

  report.structures
    .slice()
    .sort((left, right) => left.structureNumber - right.structureNumber)
    .forEach((structure) => {
      const label = `Structure ${structure.structureNumber}`;
      groupedItems.push(buildStructureDivider(label));
      groupedItems.push(
        ...buildRoofrItemsForSummary(
          structure,
          report,
          companyPricing,
          wastePercent,
          label,
          conditions,
        ),
      );
    });

  return groupedItems.map((item, index) => ({ ...item, sort_order: index }));
};

// ── EagleView Solar (Inform Advanced for Solar) parser ────────────────────────
// Parses an EagleView Inform Advanced for Solar PDF and builds solar installation
// line items using the roof area and per-facet TSRF/SAV data.

export interface EagleViewSolarFacet {
  id: string;          // Roof facet letter (A, B, C … T)
  pitchDeg: number;    // Pitch in degrees (e.g. 27); 0 if not in PDF
  azimuthDeg: number;  // Compass azimuth in degrees (0=N, 90=E, 180=S, 270=W)
  savPercent: number;  // Solar Access Value %
  tsrfPercent: number; // Total Solar Resource Fraction %
}

export interface EagleViewSolarReport {
  address: string;
  /** 'eagleview-solar' = Inform Advanced for Solar (has TSRF/SAV per facet)
   *  'eagleview-sunsite' = SunSite™ Report (roof measurements only, no TSRF) */
  source: 'eagleview-solar' | 'eagleview-sunsite';
  reportNumber: string;
  // ── Roof measurements ──────────────────────────────────────────────────────
  totalRoofAreaSqft: number;
  totalFacets: number;
  predominantPitchDeg: number;   // Degrees, NOT a slope ratio
  ridgesHipsFt: number;          // Combined ridges + hips
  valleysFt: number;
  rakesFt: number;
  eavesFt: number;
  roofObstructionsCount: number;
  roofObstructionsAreaSqft: number;
  // ── Solar data (Inform Advanced only) ──────────────────────────────────────
  facets: EagleViewSolarFacet[];
  avgSavPercent: number;
  avgTsrfPercent: number;
  // ── Derived ────────────────────────────────────────────────────────────────
  usableRoofAreaSqft: number;    // totalRoofArea minus obstruction area
  /** SunSite only: south-facing (S + SE + SW) area used for panel estimation */
  southFacingAreaSqft?: number;
}

function parseSolarFacets(text: string): EagleViewSolarFacet[] {
  const facetMap = new Map<string, EagleViewSolarFacet>();

  // Primary: Roof Summary table — 7 columns:
  //   Roof ID | Pitch° | Azimuth° | SAV% | May-Oct SAV% | Nov-Apr SAV% | TSRF%
  const fullHeaderMatch = /Roof\s+ID\s+Pitch\s+[°o]?\s*Azimuth\s+[°o]?/i.exec(text);
  if (fullHeaderMatch) {
    const tableText = text.slice(fullHeaderMatch.index + fullHeaderMatch[0].length, fullHeaderMatch.index + fullHeaderMatch[0].length + 6000);
    const rowRe = /\b([A-T])\s+(\d{1,2})\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\b/g;
    let m: RegExpExecArray | null;
    while ((m = rowRe.exec(tableText)) !== null) {
      const id = m[1];
      if (!facetMap.has(id)) {
        facetMap.set(id, {
          id,
          pitchDeg: parseInt(m[2], 10),
          azimuthDeg: parseInt(m[3], 10),
          savPercent: parseInt(m[4], 10),
          tsrfPercent: parseInt(m[7], 10),
        });
      }
    }
  }

  // Fallback: Annual Solar Values table — 3 columns: Roof ID | SAV% | TSRF%
  if (facetMap.size === 0) {
    const shortHeaderMatch = /Roof\s+ID\s+SAV\s+%\s+TSRF\s+%/i.exec(text);
    if (shortHeaderMatch) {
      const tableText = text.slice(shortHeaderMatch.index + shortHeaderMatch[0].length, shortHeaderMatch.index + shortHeaderMatch[0].length + 2000);
      const rowRe = /\b([A-T])\s+(\d{1,3})\s+(\d{1,3})\b/g;
      let m: RegExpExecArray | null;
      while ((m = rowRe.exec(tableText)) !== null) {
        const id = m[1];
        if (!facetMap.has(id)) {
          facetMap.set(id, {
            id,
            pitchDeg: 0,
            azimuthDeg: 0,
            savPercent: parseInt(m[2], 10),
            tsrfPercent: parseInt(m[3], 10),
          });
        }
      }
    }
  }

  return Array.from(facetMap.values()).sort((a, b) => a.id.localeCompare(b.id));
}

// ── SunSite™ Report helpers ───────────────────────────────────────────────────

interface SunSiteFacetOrientation {
  direction: string;   // N, NE, E, SE, S, SW, W, NW, Flat
  areaSqft: number;
  percentOfRoof: number;
}

function parseSunSiteFacetOrientations(text: string): SunSiteFacetOrientation[] {
  const results: SunSiteFacetOrientation[] = [];
  const sectionStart = /Facet\s+Orientation/i.exec(text);
  if (!sectionStart) return results;
  const tableText = text.slice(sectionStart.index, sectionStart.index + 2000);
  // Longer alternates first to avoid partial matches (NE/NW before N, SE/SW before S)
  const rowRe = /\b(NE|NW|SE|SW|Flat|N|E|S|W)\s+(?:[\d.]+\s*[-\u2013]\s*[\d.]+|N\/A)\s+(\d+)\s+(\d+)%/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(tableText)) !== null) {
    results.push({
      direction: m[1],
      areaSqft: parseInt(m[2], 10),
      percentOfRoof: parseInt(m[3], 10),
    });
  }
  return results;
}

function _parseSunSiteReport(text: string): EagleViewSolarReport {
  const reportNumberMatch = text.match(/Report:\s*([^\s,]+)/i);

  const totalRoofAreaSqft = extractNum(text, [
    /Total\s+Area\s*[=:]\s*([\d,]+)\s*sq\s*ft/i,
    /\bArea\s*[=:]\s*([\d,]+)\s*sq\s*ft/i,
  ]);
  const totalFacets = extractNum(text, [
    /Total\s+Roof\s+Facets\s*[=:]\s*(\d+)/i,
  ]);
  // Convert slope ratio (e.g. 4/12) to degrees
  const pitchRatioMatch = text.match(/Predominant\s+Pitch\s*[=:]\s*(\d+)\/12/i);
  const predominantPitchDeg = pitchRatioMatch
    ? Math.round(Math.atan(parseInt(pitchRatioMatch[1], 10) / 12) * (180 / Math.PI))
    : 0;

  // SunSite cover: "Total Ridges/Hips =201 ft"; Report Summary splits them
  const ridgesHipsFt = extractNum(text, [
    /Total\s+Ridges\/Hips\s*=\s*([\d,]+)\s*ft/i,
  ]) || (() => {
    const ridges = extractNum(text, [/\bRidges\s*=\s*([\d,]+)\s*ft/i]);
    const hips   = extractNum(text, [/\bHips\s*=\s*([\d,]+)\s*ft/i]);
    return ridges + hips;
  })();
  const valleysFt = extractNum(text, [
    /Total\s+Valleys\s*=\s*([\d,]+)\s*ft/i,
    /\bValleys\s*=\s*([\d,]+)\s*ft/i,
  ]);
  const rakesFt = extractNum(text, [
    /Total\s+Rakes\s*=\s*([\d,]+)\s*ft/i,
    /\bRakes\*?\s*=\s*([\d,]+)\s*ft/i,
  ]);
  const eavesFt = extractNum(text, [
    /Total\s+Eaves\s*=\s*([\d,]+)\s*ft/i,
    /Eaves(?:\/Starter\*{0,2})?\s*=\s*([\d,]+)\s*ft/i,
  ]);
  // SunSite uses "Penetrations" instead of "Roof Obstructions"
  const roofObstructionsCount = extractNum(text, [
    /Total\s+Penetrations\s*=\s*(\d+)(?!\s*(?:Perimeter|Area))/i,
  ]);
  const roofObstructionsAreaSqft = extractNum(text, [
    /Total\s+Penetrations\s+Area\s*=\s*([\d,]+)\s*sq\s*ft/i,
  ]);

  const facetOrientations = parseSunSiteFacetOrientations(text);

  // South-facing = S + SE + SW — optimal for solar in northern hemisphere
  const solarDirs = new Set(['S', 'SE', 'SW']);
  const southFacingAreaSqft = facetOrientations
    .filter(fo => solarDirs.has(fo.direction))
    .reduce((sum, fo) => sum + fo.areaSqft, 0);

  if (totalRoofAreaSqft === 0) {
    throw new Error(
      'Could not read area data from this EagleView SunSite\u2122 report. ' +
      'Make sure you are uploading an EagleView SunSite\u2122 PDF.',
    );
  }

  // usableRoofAreaSqft = south-facing area minus prorated penetrations
  const penetrationsFraction = totalRoofAreaSqft > 0 ? roofObstructionsAreaSqft / totalRoofAreaSqft : 0;
  const southFacingUsable = Math.max(0, Math.round(southFacingAreaSqft * (1 - penetrationsFraction)));
  const usableRoofAreaSqft = southFacingUsable || Math.max(0, totalRoofAreaSqft - roofObstructionsAreaSqft);

  return {
    address: extractAddress(text),
    source: 'eagleview-sunsite',
    reportNumber: reportNumberMatch?.[1] ?? '',
    totalRoofAreaSqft,
    totalFacets,
    predominantPitchDeg,
    ridgesHipsFt,
    valleysFt,
    rakesFt,
    eavesFt,
    roofObstructionsCount,
    roofObstructionsAreaSqft,
    facets: [],
    avgSavPercent: 0,
    avgTsrfPercent: 0,
    usableRoofAreaSqft,
    southFacingAreaSqft,
  };
}

// ── Inform Advanced for Solar (internal) ─────────────────────────────────────

function _parseInformAdvancedReport(text: string): EagleViewSolarReport {
  const reportNumberMatch = text.match(/Report:\s*(\d+)/i);

  const totalRoofAreaSqft = extractNum(text, [
    /\bArea:\s*([\d,]+)\s*sq\s*ft/i,
    /Total\s+Roof\s+Area\s*[=:]\s*([\d,]+)\s*sq\s*ft/i,
  ]);
  const totalFacets = extractNum(text, [
    /Roof\s+Facets:\s*(\d+)/i,
    /Total\s+Roof\s+Facets\s*[=:]\s*(\d+)/i,
  ]);
  const predominantPitchDeg = extractNum(text, [
    /Predominant\s+Pitch:\s*(\d+)\s*°/i,
    /Predominant\s+Pitch[:\s]+(\d+)/i,
  ]);
  const ridgesHipsFt = extractNum(text, [
    /Ridges\/Hips:\s*([\d,]+)\s*ft/i,
    /Ridges\s*[\/&]\s*Hips[:\s]+([\d,]+)\s*ft/i,
  ]);
  const valleysFt = extractNum(text, [/\bValleys:\s*([\d,]+)\s*ft/i]);
  const rakesFt   = extractNum(text, [/\bRakes:\s*([\d,]+)\s*ft/i]);
  const eavesFt   = extractNum(text, [/\bEaves:\s*([\d,]+)\s*ft/i]);
  const roofObstructionsCount = extractNum(text, [
    /Roof\s+Obstructions:\s*(\d+)(?!\s*(?:Perimeter|Area))/i,
  ]);
  const roofObstructionsAreaSqft = extractNum(text, [
    /Roof\s+Obstructions\s+Area:\s*([\d,]+)\s*sq\s*ft/i,
  ]);

  const facets = parseSolarFacets(text);

  const avgSavPercent  = facets.length > 0
    ? Math.round(facets.reduce((s, f) => s + f.savPercent, 0) / facets.length) : 0;
  const avgTsrfPercent = facets.length > 0
    ? Math.round(facets.reduce((s, f) => s + f.tsrfPercent, 0) / facets.length) : 0;

  if (totalRoofAreaSqft === 0) {
    throw new Error(
      'Could not read area data from this EagleView Solar report. ' +
      'Make sure you are uploading an EagleView Inform Advanced for Solar PDF.',
    );
  }

  return {
    address: extractAddress(text),
    source: 'eagleview-solar',
    reportNumber: reportNumberMatch?.[1] ?? '',
    totalRoofAreaSqft,
    totalFacets: totalFacets || facets.length,
    predominantPitchDeg,
    ridgesHipsFt,
    valleysFt,
    rakesFt,
    eavesFt,
    roofObstructionsCount,
    roofObstructionsAreaSqft,
    facets,
    avgSavPercent,
    avgTsrfPercent,
    usableRoofAreaSqft: Math.max(0, totalRoofAreaSqft - roofObstructionsAreaSqft),
  };
}

// ── Public dispatcher ─────────────────────────────────────────────────────────

export const parseEagleViewSolarReportFromFile = async (file: File): Promise<EagleViewSolarReport> => {
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  const doc = await pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  let fullText = '';
  for (let p = 1; p <= doc.numPages; p++) {
    try {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      fullText += (tc.items as any[]).map((i: any) => i?.str ?? '').join(' ') + ' ';
    } catch { /* skip unreadable pages */ }
  }
  const text = fullText.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

  if (!/eagle\s*view/i.test(text)) {
    throw new Error('This does not appear to be an EagleView report.');
  }

  const hasInformAdvanced = /\bTSRF\b/.test(text) && /\bSAV\b/.test(text);
  const hasSunSite = /SunSite/i.test(text) || /Facet\s+Orientation/i.test(text);

  if (hasInformAdvanced) return _parseInformAdvancedReport(text);
  if (hasSunSite)        return _parseSunSiteReport(text);

  throw new Error(
    'Unrecognized EagleView solar report format. ' +
    'Supported formats: Inform Advanced for Solar and SunSite\u2122 Report.',
  );
};

export const buildEagleViewSolarLineItems = (
  report: EagleViewSolarReport,
  companyPricing: CompanyPricing[],
): LineItem[] => {
  const usableAreaSqft = report.usableRoofAreaSqft || report.totalRoofAreaSqft;
  if (usableAreaSqft === 0) return [];

  // Standard 400W monocrystalline panel ≈ 17.5 sq ft (65" × 39")
  // Packing factor: 70% of eligible roof area can be utilized for panels
  const PANEL_SQFT = 17.5;
  const PACKING_FACTOR = 0.70;

  // Use facets with TSRF ≥ 60% to estimate solar-eligible area
  const eligibleFacets = report.facets.filter(f => f.tsrfPercent >= 60);
  const eligibleFraction =
    report.facets.length > 0 ? eligibleFacets.length / report.facets.length : 1.0;
  const solarEligibleAreaSqft = Math.round(usableAreaSqft * eligibleFraction);
  const estimatedPanels = Math.max(1, Math.floor(solarEligibleAreaSqft * PACKING_FACTOR / PANEL_SQFT));
  const estimatedKw = (estimatedPanels * 0.4).toFixed(1); // ~400W per panel

  const isSunSite = report.source === 'eagleview-sunsite';
  const facetNote =
    report.facets.length > 0
      ? ` ${eligibleFacets.length}/${report.facets.length} facets have TSRF ≥ 60%.`
      : '';
  const avgTsrfNote =
    report.avgTsrfPercent > 0 ? ` Avg TSRF: ${report.avgTsrfPercent}%.` : '';
  const southNote =
    isSunSite && report.southFacingAreaSqft
      ? ` South-facing area: ${report.southFacingAreaSqft.toLocaleString()} sq ft.`
      : '';

  const reportLabel = isSunSite ? 'EagleView SunSite™ solar report' : 'EagleView Inform Advanced solar report';
  const obstructionLabel = isSunSite ? 'penetrations' : 'obstructions';

  type SolarItem = { aliases: string[]; quantity: number; unit: string; description: string };
  const items: SolarItem[] = [
    {
      aliases: ['Site Assessment & Structural Analysis'],
      quantity: 1,
      unit: 'lot',
      description:
        `${reportLabel}: ${report.totalFacets} facets, ` +
        `${report.totalRoofAreaSqft.toLocaleString()} sq ft total roof area` +
        (report.predominantPitchDeg ? `, ${report.predominantPitchDeg}° pitch` : '') +
        (report.roofObstructionsCount ? `, ${report.roofObstructionsCount} ${obstructionLabel} (${report.roofObstructionsAreaSqft} sq ft)` : '') +
        `.${isSunSite ? southNote : avgTsrfNote}`,
    },
    {
      aliases: ['Solar Panels (Monocrystalline)', 'Solar Panels'],
      quantity: estimatedPanels,
      unit: 'each',
      description:
        `EagleView measured: ${solarEligibleAreaSqft.toLocaleString()} sq ft ${isSunSite ? 'south-facing' : 'eligible'} area × ${(PACKING_FACTOR * 100).toFixed(0)}% packing ÷ ${PANEL_SQFT} sq ft/panel ≈ ${estimatedPanels} panels (~${estimatedKw} kW).` +
        (isSunSite ? '' : facetNote),
    },
    {
      aliases: ['Racking & Mounting System'],
      quantity: estimatedPanels,
      unit: 'panel',
      description: `Rail-mount racking for ${estimatedPanels} panels. Adjust qty after final layout design.`,
    },
    {
      aliases: ['String Inverter / Microinverters'],
      quantity: 1,
      unit: 'lot',
      description: `Inverter system for estimated ${estimatedPanels}-panel (~${estimatedKw} kW) array.`,
    },
    {
      aliases: ['DC Wiring & Conduit (Roof to Inverter)'],
      quantity: 1,
      unit: 'lot',
      description: 'DC wiring, MC4 connectors, and conduit from roof array to inverter.',
    },
    {
      aliases: ['AC Wiring & Conduit (Inverter to Panel)'],
      quantity: 1,
      unit: 'lot',
      description: 'AC wiring, disconnect switch, and connection from inverter to main electrical panel.',
    },
    {
      aliases: ['Main Panel Upgrade / Electrical Work'],
      quantity: 1,
      unit: 'lot',
      description: 'Electrical panel inspection and any required upgrades for solar grid interconnect.',
    },
    {
      aliases: ['Solar Installation Labor'],
      quantity: 1,
      unit: 'lot',
      description: `Full installation labor: mounting, wiring, commissioning, and utility walkthrough for ${estimatedPanels}-panel system.`,
    },
    {
      aliases: ['Monitoring System'],
      quantity: 1,
      unit: 'lot',
      description: 'System-level production monitoring platform (app + web portal access).',
    },
  ];

  return items.map((item, index) => {
    const pricing = resolvePricing(companyPricing, item.aliases, item.description, item.unit);
    return {
      id: `eagleview-solar-${Date.now()}-${index}`,
      quote_id: '',
      category: 'Solar',
      item_name: pricing.itemName,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      good_price: pricing.goodPrice,
      better_price: pricing.betterPrice,
      best_price: pricing.bestPrice,
      fixed_price: pricing.fixedPrice,
      sort_order: index,
    };
  });
};

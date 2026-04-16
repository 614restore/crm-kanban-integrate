// Roofr PDF Parser
// Extracts roof measurements from Roofr measurement report PDFs
// Built against real Roofr PDF format (verified Apr 2026)

import * as pdfjsLib from 'pdfjs-dist';
// Worker setup — three environments:
//  • Web/dev:       /pdf.worker.min.mjs served from public/
//  • Tauri desktop: CDN copy (tauri:// protocol can't fetch local workers)
//  • Capacitor iOS: /pdf.worker.min.mjs set lazily before first parse;
//                   pdfjs tries a module Worker, WKWebView may reject it and
//                   fall back to _setupFakeWorker() which uses dynamic import()
//                   from capacitor://localhost — that works in Capacitor 7 / iOS 15+.
if (typeof window !== 'undefined') {
  const isTauri =
    typeof (window as any).__TAURI__ !== 'undefined' ||
    window.location.protocol === 'tauri:' ||
    window.location.hostname === 'tauri.localhost';
  const isCapacitor =
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:' ||
    typeof (window as any).Capacitor !== 'undefined';
  if (!isCapacitor) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = isTauri
      ? 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.worker.min.mjs'
      : '/pdf.worker.min.mjs';
  }
}

// Capacitor iOS: dynamically import the bundled worker shim, which sets
// globalThis.pdfjsWorker.WorkerMessageHandler so that pdfjs v4 runs the
// entire PDF pipeline on the main thread, bypassing all Web Worker / dynamic
// import restrictions that WKWebView imposes under the capacitor:// scheme.
let _capacitorWorker: Promise<void> | null = null;
function ensureCapacitorWorker(): Promise<void> {
  if (!_capacitorWorker) {
    console.log('[RoofrParser] Capacitor detected — loading main-thread worker shim…');
    _capacitorWorker = import('./pdfjsCapacitorWorker')
      .then(() => {
        const hasHandler = !!(globalThis as any).pdfjsWorker?.WorkerMessageHandler;
        console.log('[RoofrParser] Worker shim loaded. globalThis.pdfjsWorker.WorkerMessageHandler set:', hasHandler);
      })
      .catch((err) => {
        console.error('[RoofrParser] Worker shim import FAILED:', err);
        // Fallback: point workerSrc at the local .mjs file and let pdfjs
        // attempt _setupFakeWorker() with a same-origin dynamic import.
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        console.log('[RoofrParser] Fallback: workerSrc set to /pdf.worker.min.mjs');
      });
  }
  return _capacitorWorker;
}

export interface RoofrMeasurements {
  totalSquares: number;
  totalSqFt: number;
  ridgeLength: number;
  hipLength: number;
  valleyLength: number;
  eaveLength: number;
  rakeLength: number;
  flashingLength: number;
  predominantPitch: string;
  facetCount: number;
  wallFlashing?: number;
  stepFlashing?: number;
  chimneySides?: number;
  address?: string;
}

export interface StructureMeasurements {
  structureName: string;
  structureIndex: number;
  measurements: RoofrMeasurements;
}

export interface MultiStructureResult {
  hasMultipleStructures: boolean;
  combinedMeasurements: RoofrMeasurements;
  structures: StructureMeasurements[];
}

/**
 * Convert "Xft Yin" (or "Xft") to decimal feet.
 * e.g. "47ft 0in" → 47.0, "143ft 3in" → 143.25, "26ft 5in" → 26.42
 */
function parseFeetInches(raw: string): number {
  const m = raw.match(/([\d.]+)\s*ft(?:\s*([\d.]+)\s*in)?/i);
  if (!m) return 0;
  const feet = parseFloat(m[1]);
  const inches = m[2] ? parseFloat(m[2]) / 12 : 0;
  return feet + inches;
}

/**
 * Extract a ft/in measurement from text using the first matching regex.
 * The regex must capture the "Xft Yin" portion in group 1.
 */
function extractFt(text: string, patterns: RegExp[], fieldName: string): number {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const val = parseFeetInches(match[1]);
      if (val >= 0) {
        console.log(`[RoofrParser] ${fieldName}: ${val.toFixed(2)} ft`);
        return val;
      }
    }
  }
  console.warn(`[RoofrParser] Could not extract ${fieldName}`);
  return 0;
}

/**
 * Extract a plain numeric value from text using the first matching regex.
 */
function extractNum(text: string, patterns: RegExp[], fieldName: string): number {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const num = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(num) && num >= 0) {
        console.log(`[RoofrParser] ${fieldName}: ${num}`);
        return num;
      }
    }
  }
  console.warn(`[RoofrParser] Could not extract ${fieldName}`);
  return 0;
}

/**
 * Parse all measurements out of a block of Roofr PDF text.
 * Handles real Roofr format:
 *   "Total ridges 47ft 0in"  /  "Ridges: 47ft 0in"
 *   "Total roof area 1066 sqft"
 *   "Predominant pitch 6/12"
 */
function extractMeasurements(text: string): RoofrMeasurements {
  // Preserve original capitalisation for ft/in patterns but collapse whitespace
  const t = text.replace(/\s+/g, ' ');

  // ── sq ft ──────────────────────────────────────────────────────────────────
  const totalSqFt = extractNum(t, [
    /total\s+roof\s+area\s+([\d,]+)\s*sqft/i,
    /total\s+pitched\s+area\s+([\d,]+)\s*sqft/i,
    /total\s+area\s+([\d,]+)\s*sqft/i,
    /(?:total\s+(?:square\s*feet|sq\.?\s*ft\.?))[:\s]+([\d,]+)/i,
    /([\d,]{3,})\s*sqft/i,  // bare "1411 sqft"
  ], 'totalSqFt');

  // ── linear measurements (ft/in format) ────────────────────────────────────
  // Patterns cover both:
  //   "Total ridges 47ft 0in"  (structure summary pages)
  //   "Ridges: 47ft 0in"       (length measurement report page)
  const ridgeLength = extractFt(t, [
    /total\s+ridges?\s+([\d.]+ft(?:\s*[\d.]+in)?)/i,
    /ridges?\s*:\s*([\d.]+ft(?:\s*[\d.]+in)?)/i,
    /(?:ridge\s+length)[:\s]+([\d,.]+)/i,
  ], 'ridgeLength');

  const hipLength = extractFt(t, [
    /total\s+hips?\s+([\d.]+ft(?:\s*[\d.]+in)?)/i,
    /hips?\s*:\s*([\d.]+ft(?:\s*[\d.]+in)?)/i,
  ], 'hipLength');

  const valleyLength = extractFt(t, [
    /total\s+valleys?\s+([\d.]+ft(?:\s*[\d.]+in)?)/i,
    /valleys?\s*:\s*([\d.]+ft(?:\s*[\d.]+in)?)/i,
  ], 'valleyLength');

  const eaveLength = extractFt(t, [
    /total\s+eaves?\s+([\d.]+ft(?:\s*[\d.]+in)?)/i,
    /eaves?\s*:\s*([\d.]+ft(?:\s*[\d.]+in)?)/i,
  ], 'eaveLength');

  const rakeLength = extractFt(t, [
    /total\s+rakes?\s+([\d.]+ft(?:\s*[\d.]+in)?)/i,
    /rakes?\s*:\s*([\d.]+ft(?:\s*[\d.]+in)?)/i,
  ], 'rakeLength');

  const wallFlashing = extractFt(t, [
    /total\s+wall\s+flashing\s+([\d.]+ft(?:\s*[\d.]+in)?)/i,
    /wall\s+flashing\s*:\s*([\d.]+ft(?:\s*[\d.]+in)?)/i,
  ], 'wallFlashing') || undefined;

  const stepFlashing = extractFt(t, [
    /total\s+step\s+flashing\s+([\d.]+ft(?:\s*[\d.]+in)?)/i,
    /step\s+flashing\s*:\s*([\d.]+ft(?:\s*[\d.]+in)?)/i,
  ], 'stepFlashing') || undefined;

  // Use wall flashing as the primary "flashing length" field
  const flashingLength = wallFlashing ?? 0;

  // ── facets ─────────────────────────────────────────────────────────────────
  const facetCount = extractNum(t, [
    /total\s+roof\s+facets?\s+([\d]+)/i,
    /([\d]+)\s+facets/i,
  ], 'facetCount');

  // ── pitch ──────────────────────────────────────────────────────────────────
  const pitchMatch = t.match(/predominant\s+pitch[:\s]*([\d]+\/[\d]+)/i);
  const predominantPitch = pitchMatch ? pitchMatch[1] : '—';

  // ── address ────────────────────────────────────────────────────────────────
  const addressMatch = t.match(/(\d+\s+[\w .]+(?:avenue|ave|street|st|road|rd|drive|dr|blvd|lane|ln|court|ct|way|circle|cir)[,\s]+[\w\s]+,\s*[A-Z]{2}\s*[\d]{5})/i);
  const address = addressMatch ? addressMatch[1].trim() : undefined;

  // ── squares ────────────────────────────────────────────────────────────────
  // Roofr doesn't print "X squares" directly; derive from sqft (1 square = 100 sqft)
  const totalSquares = totalSqFt > 0 ? parseFloat((totalSqFt / 100).toFixed(2)) : 0;

  if (totalSquares === 0 && totalSqFt === 0) {
    throw new Error('No valid measurements found in PDF. Please ensure this is a Roofr measurement report.');
  }

  return {
    totalSquares,
    totalSqFt,
    ridgeLength,
    hipLength,
    valleyLength,
    eaveLength,
    rakeLength,
    flashingLength,
    predominantPitch,
    facetCount,
    wallFlashing,
    stepFlashing,
    address,
  };
}

// ─── Structure detection ─────────────────────────────────────────────────────

interface StructureBlock {
  name: string;
  text: string;
}

/**
 * Detect per-structure sections in the full PDF text.
 * Roofr uses headings like "Structure #1 summary" / "Structure #2 summary".
 */
function detectStructures(fullText: string): StructureBlock[] {
  // Normalise the full text once for detection (collapse all whitespace to
  // single space) so pdfjs kerning gaps like "Structure # 1 summary" still
  // match.  We keep the ORIGINAL text for slicing so byte-offsets are valid.
  const normalised = fullText.replace(/\s+/g, ' ');

  const structurePatterns = [
    // Primary Roofr format: "Structure #1 summary" / "Structure # 1 summary"
    /structure\s*#\s*(\d+)\s+summary/gi,
    // "Structure #1" without "summary" (some Roofr variants)
    /structure\s*#\s*(\d+)/gi,
    // Generic fallback: "Structure 1", "Building 1"
    /(?:structure|building)\s+#?\s*(\d+)/gi,
    // Named structures: "Main House", "Garage", etc.
    /(main\s+house|garage|detached\s+garage|shed|barn|carport)/gi,
    /(primary|secondary|additional)\s+structure/gi,
  ];

  let foundMarkers: Array<{ index: number; name: string }> = [];

  for (const pattern of structurePatterns) {
    const matches = [...normalised.matchAll(pattern)];

    // Deduplicate: only keep the FIRST occurrence of each unique name.
    // Without this, a label that repeats in measurement rows creates dozens of
    // bogus split points.
    const seen = new Set<string>();
    const unique: Array<{ index: number; name: string }> = [];
    for (const match of matches) {
      const key = match[0].trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        // Store the index from the normalised string — it corresponds
        // closely enough to the original for slicing (single-space collapsed).
        unique.push({ index: match.index ?? 0, name: match[0] });
      }
    }

    if (unique.length > 1) {
      foundMarkers = unique;
      console.log(`[RoofrParser] Found ${foundMarkers.length} structure markers:`, foundMarkers.map(m => m.name));
      break;
    }
  }

  if (foundMarkers.length > 1) {
    // Slice from the normalised string so offsets are consistent.
    return foundMarkers.map((marker, i) => ({
      name: formatStructureName(marker.name),
      text: normalised.substring(
        marker.index,
        i < foundMarkers.length - 1 ? foundMarkers[i + 1].index : normalised.length
      ),
    }));
  }

  // Single structure — return the normalised text for consistent extraction.
  return [{ name: 'Main Structure', text: normalised }];
}

function formatStructureName(rawName: string): string {
  return rawName
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ─── Combine ─────────────────────────────────────────────────────────────────

function combineStructures(structures: StructureMeasurements[]): RoofrMeasurements {
  const combined: RoofrMeasurements = {
    totalSquares: 0,
    totalSqFt: 0,
    ridgeLength: 0,
    hipLength: 0,
    valleyLength: 0,
    eaveLength: 0,
    rakeLength: 0,
    flashingLength: 0,
    predominantPitch: '',
    facetCount: 0,
    wallFlashing: 0,
    stepFlashing: 0,
    chimneySides: 0,
    address: '',
  };

  for (const { measurements: m } of structures) {
    combined.totalSquares  += m.totalSquares;
    combined.totalSqFt     += m.totalSqFt;
    combined.ridgeLength   += m.ridgeLength;
    combined.hipLength     += m.hipLength;
    combined.valleyLength  += m.valleyLength;
    combined.eaveLength    += m.eaveLength;
    combined.rakeLength    += m.rakeLength;
    combined.flashingLength += m.flashingLength;
    combined.facetCount    += m.facetCount;
    combined.wallFlashing  = (combined.wallFlashing ?? 0) + (m.wallFlashing ?? 0);
    combined.stepFlashing  = (combined.stepFlashing ?? 0) + (m.stepFlashing ?? 0);
    combined.chimneySides  = (combined.chimneySides ?? 0) + (m.chimneySides ?? 0);
    if (!combined.predominantPitch && m.predominantPitch) combined.predominantPitch = m.predominantPitch;
    if (!combined.address && m.address) combined.address = m.address;
  }

  combined.totalSquares = parseFloat(combined.totalSquares.toFixed(2));
  console.log('[RoofrParser] Combined measurements from', structures.length, 'structures');
  return combined;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a Roofr PDF with multi-structure support.
 */
export async function parseRoofrPDFWithStructures(file: File): Promise<MultiStructureResult> {
  console.log('[RoofrParser] parseRoofrPDFWithStructures called. protocol:', typeof window !== 'undefined' ? window.location.protocol : 'no-window', 'Capacitor:', typeof (window as any)?.Capacitor);
  try {
    // On Capacitor iOS, ensure the worker blob URL is ready before loading any PDF
    const isCapacitor =
      typeof window !== 'undefined' && (
        window.location.protocol === 'capacitor:' ||
        window.location.protocol === 'ionic:' ||
        typeof (window as any).Capacitor !== 'undefined'
      );
    if (isCapacitor) await ensureCapacitorWorker();

    const arrayBuffer = await file.arrayBuffer();

    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    console.log(`[RoofrParser] PDF loaded: ${pdf.numPages} pages`);

    // Read ALL pages — Roofr puts structure summaries on pages 6-7+
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = (textContent.items as { str: string }[])
        .map(item => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    console.log('[RoofrParser] Extracted text length:', fullText.length);
    console.log('[RoofrParser] First 300 chars:', fullText.substring(0, 300));

    const structureBlocks = detectStructures(fullText);
    console.log(`[RoofrParser] detectStructures returned ${structureBlocks.length} block(s):`, structureBlocks.map(b => b.name));

    if (structureBlocks.length > 1) {
      // Extract measurements for each block independently.
      // If one block fails, skip it rather than aborting the whole parse.
      const structures: StructureMeasurements[] = [];
      for (let idx = 0; idx < structureBlocks.length; idx++) {
        const block = structureBlocks[idx];
        try {
          const measurements = extractMeasurements(block.text);
          structures.push({ structureName: block.name, structureIndex: idx + 1, measurements });
          console.log(`[RoofrParser] ${block.name}: ${measurements.totalSqFt} sqft`);
        } catch (blockErr) {
          console.warn(`[RoofrParser] Skipping ${block.name} — extraction failed:`, blockErr instanceof Error ? blockErr.message : blockErr);
        }
      }

      if (structures.length > 1) {
        return {
          hasMultipleStructures: true,
          combinedMeasurements: combineStructures(structures),
          structures,
        };
      }

      // Only one block survived — treat as single-structure
      if (structures.length === 1) {
        return {
          hasMultipleStructures: false,
          combinedMeasurements: structures[0].measurements,
          structures,
        };
      }

      // All blocks failed — fall through to full-text parse below
      console.warn('[RoofrParser] All per-structure blocks failed — falling back to full-text parse');
    }

    const measurements = extractMeasurements(fullText.replace(/\s+/g, ' '));
    console.log(`[RoofrParser] Single-structure parse: ${measurements.totalSqFt} sqft`);
    return {
      hasMultipleStructures: false,
      combinedMeasurements: measurements,
      structures: [{ structureName: 'Main Structure', structureIndex: 1, measurements }],
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[RoofrParser] Failed to parse PDF — message:', msg, '| raw:', error);
    // Re-throw preserving the original message so callers can display it.
    throw new Error(msg);
  }
}

/**
 * Original single-structure parser (backward compatibility).
 */
export async function parseRoofrPDF(file: File): Promise<RoofrMeasurements> {
  const result = await parseRoofrPDFWithStructures(file);
  return result.combinedMeasurements;
}

/**
 * Parse a Roofr PDF from a URL (e.g. Supabase signed URL).
 * Fetches the PDF as an ArrayBuffer then runs the same parser pipeline.
 * Avoids all file-picker limitations on Capacitor iOS.
 */
export async function parseRoofrPDFFromUrl(url: string): Promise<MultiStructureResult> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();

  const isCapacitor =
    typeof window !== 'undefined' && (
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:' ||
      typeof (window as any).Capacitor !== 'undefined'
    );
  if (isCapacitor) await ensureCapacitorWorker();

  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = (textContent.items as { str: string }[])
      .map(item => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }

  const structureBlocks = detectStructures(fullText);
  if (structureBlocks.length > 1) {
    const structures: StructureMeasurements[] = [];
    for (let idx = 0; idx < structureBlocks.length; idx++) {
      const block = structureBlocks[idx];
      try {
        structures.push({ structureName: block.name, structureIndex: idx + 1, measurements: extractMeasurements(block.text) });
      } catch {
        console.warn(`[RoofrParser] parseRoofrPDFFromUrl: skipping ${block.name}`);
      }
    }
    if (structures.length > 1) {
      return { hasMultipleStructures: true, combinedMeasurements: combineStructures(structures), structures };
    }
    if (structures.length === 1) {
      return { hasMultipleStructures: false, combinedMeasurements: structures[0].measurements, structures };
    }
  }

  const measurements = extractMeasurements(fullText.replace(/\s+/g, ' '));
  return {
    hasMultipleStructures: false,
    combinedMeasurements: measurements,
    structures: [{ structureName: 'Main Structure', structureIndex: 1, measurements }],
  };
}

/**
 * Validate measurements are reasonable for a roof.
 */
export function validateMeasurements(measurements: RoofrMeasurements): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  if (measurements.totalSquares < 5) warnings.push('Total squares seems unusually small (< 5 squares)');
  if (measurements.totalSquares > 200) warnings.push('Total squares seems unusually large (> 200 squares)');
  if (measurements.ridgeLength === 0) warnings.push('Ridge length is 0 — this may affect material calculations');
  if (measurements.eaveLength === 0) warnings.push('Eave length is 0 — drip edge calculations may be inaccurate');
  return { valid: warnings.length === 0, warnings };
}

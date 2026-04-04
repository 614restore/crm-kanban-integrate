// Roofr PDF Parser
// Extracts roof measurements from Roofr measurement report PDFs

import * as pdfjsLib from 'pdfjs-dist';
// Worker is copied to public/ via the prebuild npm script.
// This avoids CDN CORS/MIME failures and Rollup node_modules ?url limitations.
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
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
  // Additional fields
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
 * Parse a Roofr PDF with multi-structure support
 * Returns individual structures plus combined totals
 */
export async function parseRoofrPDFWithStructures(file: File): Promise<MultiStructureResult> {
  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Load PDF document with worker fallback
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      // Disable worker as fallback if CDN fails (slower but works)
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true
    });
    const pdf = await loadingTask.promise;
    
    console.log(`[RoofrParser] PDF loaded: ${pdf.numPages} pages`);
    
    // Extract text from all pages
    let fullText = '';
    for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    console.log('[RoofrParser] Extracted text length:', fullText.length);
    console.log('[RoofrParser] First 500 chars:', fullText.substring(0, 500));
    
    // Detect and split structures
    const structureBlocks = detectStructures(fullText);
    
    if (structureBlocks.length > 1) {
      console.log(`[RoofrParser] Detected ${structureBlocks.length} structures`);
      
      // Parse each structure separately
      const structures: StructureMeasurements[] = structureBlocks.map((block, index) => ({
        structureName: block.name,
        structureIndex: index + 1,
        measurements: extractMeasurements(block.text)
      }));
      
      // Calculate combined totals
      const combinedMeasurements = combineStructures(structures);
      
      return {
        hasMultipleStructures: true,
        combinedMeasurements,
        structures
      };
    } else {
      // Single structure - just parse normally
      const measurements = extractMeasurements(fullText);
      
      return {
        hasMultipleStructures: false,
        combinedMeasurements: measurements,
        structures: [{
          structureName: 'Main Structure',
          structureIndex: 1,
          measurements
        }]
      };
    }
  } catch (error) {
    console.error('[RoofrParser] Failed to parse PDF:', error);
    throw new Error(`Failed to parse Roofr PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Original single-structure parser (backward compatibility)
 */
export async function parseRoofrPDF(file: File): Promise<RoofrMeasurements> {
  const result = await parseRoofrPDFWithStructures(file);
  return result.combinedMeasurements;
}

/**
 * Extract measurements from text using regex patterns
 */
function extractMeasurements(text: string): RoofrMeasurements {
  // Normalize text for easier parsing
  const normalized = text.replace(/\s+/g, ' ').toLowerCase();
  
  // Helper to extract numeric value with better pattern matching
  const extract = (patterns: RegExp[], fieldName: string): number => {
    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match && match[1]) {
        const value = match[1].replace(/,/g, '');
        const num = parseFloat(value);
        if (!isNaN(num) && num > 0) {
          console.log(`[RoofrParser] Found ${fieldName}: ${num} (pattern: ${pattern.source})`);
          return num;
        }
      }
    }
    console.warn(`[RoofrParser] Could not extract ${fieldName} from text`);
    return 0;
  };
  
  // Helper to extract pitch
  const extractPitch = (): string => {
    const pitchMatch = text.match(/(?:pitch|slope)[:\s]+([\d]+\s*\/\s*[\d]+)/i);
    if (pitchMatch) return pitchMatch[1].trim();
    
    const ratioMatch = text.match(/([\d]+)\s*:\s*([\d]+)/);
    if (ratioMatch) return `${ratioMatch[1]}/${ratioMatch[2]}`;
    
    return '—';
  };
  
  // Extract address
  const extractAddress = (): string | undefined => {
    const addressMatch = text.match(/(?:property address|address)[:\s]+([^\n]+)/i);
    return addressMatch?.[1]?.trim();
  };
  
  // Multiple patterns for each field to handle different Roofr PDF formats
  const patterns = {
    totalSquares: [
      /(?:total\s+squares?)[:\s]+([\d,.]+)/i,
      /(?:roofing\s+squares?)[:\s]+([\d,.]+)/i,
      /(?:squares?)[:\s]+([\d,.]+)/i,
    ],
    totalSqFt: [
      /(?:total\s+(?:square\s*feet|sq\.?\s*ft\.?))[:\s]+([\d,]+)/i,
      /(?:total\s+area)[:\s]+([\d,]+)/i,
      /(?:area)[:\s]+([\d,]+)\s*(?:sq\.?\s*ft\.?|square\s*feet)/i,
    ],
    ridgeLength: [
      /(?:ridge\s+length)[:\s]+([\d,.]+)/i,
      /(?:ridge\s+linear)[:\s]+([\d,.]+)/i,
      /(?:ridge)[:\s]+([\d,.]+)\s*(?:ft|lf|linear|feet)/i,
      /(?:ridges?)[:\s]+([\d,.]+)/i,
    ],
    hipLength: [
      /(?:hip\s+length)[:\s]+([\d,.]+)/i,
      /(?:hip\s+linear)[:\s]+([\d,.]+)/i,
      /(?:hips?)[:\s]+([\d,.]+)\s*(?:ft|lf|linear|feet)/i,
    ],
    valleyLength: [
      /(?:valley\s+length)[:\s]+([\d,.]+)/i,
      /(?:valley\s+linear)[:\s]+([\d,.]+)/i,
      /(?:valleys?)[:\s]+([\d,.]+)\s*(?:ft|lf|linear|feet)/i,
    ],
    eaveLength: [
      /(?:eave\s+length)[:\s]+([\d,.]+)/i,
      /(?:eave\s+linear)[:\s]+([\d,.]+)/i,
      /(?:eaves?)[:\s]+([\d,.]+)\s*(?:ft|lf|linear|feet)/i,
      /(?:perimeter)[:\s]+([\d,.]+)/i,
    ],
    rakeLength: [
      /(?:rake\s+length)[:\s]+([\d,.]+)/i,
      /(?:rake\s+linear)[:\s]+([\d,.]+)/i,
      /(?:rakes?)[:\s]+([\d,.]+)\s*(?:ft|lf|linear|feet)/i,
    ],
    flashingLength: [
      /(?:flashing\s+length)[:\s]+([\d,.]+)/i,
      /(?:flashing\s+linear)[:\s]+([\d,.]+)/i,
      /(?:flashing)[:\s]+([\d,.]+)\s*(?:ft|lf|linear|feet)/i,
    ],
    facetCount: [
      /(?:facets?)[:\s]+([\d]+)/i,
      /(?:planes?)[:\s]+([\d]+)/i,
      /(?:sections?)[:\s]+([\d]+)/i,
      /(?:roof\s+planes?)[:\s]+([\d]+)/i,
      /(?:number\s+of\s+facets?)[:\s]+([\d]+)/i,
    ],
    wallFlashing: [
      /(?:wall\s+flashing)[:\s]+([\d,.]+)/i,
    ],
    stepFlashing: [
      /(?:step\s+flashing)[:\s]+([\d,.]+)/i,
    ],
  };
  
  // Extract all measurements with new multi-pattern approach
  const measurements: RoofrMeasurements = {
    totalSquares: extract(patterns.totalSquares, 'totalSquares'),
    totalSqFt: extract(patterns.totalSqFt, 'totalSqFt'),
    ridgeLength: extract(patterns.ridgeLength, 'ridgeLength'),
    hipLength: extract(patterns.hipLength, 'hipLength'),
    valleyLength: extract(patterns.valleyLength, 'valleyLength'),
    eaveLength: extract(patterns.eaveLength, 'eaveLength'),
    rakeLength: extract(patterns.rakeLength, 'rakeLength'),
    flashingLength: extract(patterns.flashingLength, 'flashingLength'),
    predominantPitch: extractPitch(),
    facetCount: extract(patterns.facetCount, 'facetCount'),
    wallFlashing: extract(patterns.wallFlashing, 'wallFlashing') || undefined,
    stepFlashing: extract(patterns.stepFlashing, 'stepFlashing') || undefined,
    address: extractAddress(),
  };
  
  // Validate we got something useful
  if (measurements.totalSquares === 0 && measurements.totalSqFt === 0) {
    throw new Error('No valid measurements found in PDF. Please ensure this is a Roofr measurement report.');
  }
  
  // Calculate squares from sq ft if missing
  if (measurements.totalSquares === 0 && measurements.totalSqFt > 0) {
    measurements.totalSquares = measurements.totalSqFt / 100;
  }
  
  // Calculate sq ft from squares if missing
  if (measurements.totalSqFt === 0 && measurements.totalSquares > 0) {
    measurements.totalSqFt = measurements.totalSquares * 100;
  }
  
  return measurements;
}

/**
 * Validate measurements are reasonable for a roof
 */
export function validateMeasurements(measurements: RoofrMeasurements): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  // Check for unreasonably small roofs
  if (measurements.totalSquares < 5) {
    warnings.push('Total squares seems unusually small (< 5 squares)');
  }
  
  // Check for unreasonably large roofs
  if (measurements.totalSquares > 200) {
    warnings.push('Total squares seems unusually large (> 200 squares)');
  }
  
  // Check for missing critical measurements
  if (measurements.ridgeLength === 0) {
    warnings.push('Ridge length is 0 - this may affect material calculations');
  }
  
  if (measurements.eaveLength === 0) {
    warnings.push('Eave length is 0 - drip edge calculations may be inaccurate');
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Detect structure boundaries in Roofr PDF text
 * Returns array of {name, text} for each structure found
 */
interface StructureBlock {
  name: string;
  text: string;
}

function detectStructures(fullText: string): StructureBlock[] {
  const structures: StructureBlock[] = [];
  
  // Common patterns for structure headers in Roofr PDFs:
  // "Structure 1", "Structure 2"
  // "Building 1", "Building 2"
  // "Main House", "Garage", "Detached Garage"
  // "Primary Structure", "Secondary Structure"
  
  const structurePatterns = [
    /(?:structure|building)\s+(\d+)/gi,
    /(main\s+house|garage|detached\s+garage|shed|barn|carport)/gi,
    /(primary|secondary|additional)\s+structure/gi
  ];
  
  // Try to find structure markers.
  // Deduplicate by canonical name so that a label like "Structure 1" appearing
  // many times in measurement rows only produces ONE split point (its first occurrence).
  let foundMarkers: Array<{ index: number; name: string }> = [];

  for (const pattern of structurePatterns) {
    const matches = [...fullText.matchAll(pattern)];
    const seen = new Set<string>();
    const unique: Array<{ index: number; name: string }> = [];
    for (const match of matches) {
      const key = match[0].trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push({ index: match.index ?? 0, name: match[0] });
      }
    }
    if (unique.length > 1) {
      // Found multiple distinct structure headers
      foundMarkers = unique;
      console.log(`[RoofrParser] Found ${foundMarkers.length} structure markers:`, foundMarkers.map(m => m.name));
      break;
    }
  }
  
  if (foundMarkers.length > 1) {
    // Split text at each marker
    for (let i = 0; i < foundMarkers.length; i++) {
      const start = foundMarkers[i].index;
      const end = i < foundMarkers.length - 1 ? foundMarkers[i + 1].index : fullText.length;
      const structureText = fullText.substring(start, end);
      
      structures.push({
        name: formatStructureName(foundMarkers[i].name),
        text: structureText
      });
    }
  } else {
    // No structure markers found - treat as single structure
    structures.push({
      name: 'Main Structure',
      text: fullText
    });
  }
  
  return structures;
}

/**
 * Format structure name for display
 */
function formatStructureName(rawName: string): string {
  const normalized = rawName.trim();
  
  // Capitalize first letter of each word
  return normalized
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Combine measurements from multiple structures
 */
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
    address: ''
  };
  
  // Sum all numeric fields
  for (const structure of structures) {
    const m = structure.measurements;
    combined.totalSquares += m.totalSquares;
    combined.totalSqFt += m.totalSqFt;
    combined.ridgeLength += m.ridgeLength;
    combined.hipLength += m.hipLength;
    combined.valleyLength += m.valleyLength;
    combined.eaveLength += m.eaveLength;
    combined.rakeLength += m.rakeLength;
    combined.flashingLength += m.flashingLength;
    combined.facetCount += m.facetCount;
    combined.wallFlashing = (combined.wallFlashing || 0) + (m.wallFlashing || 0);
    combined.stepFlashing = (combined.stepFlashing || 0) + (m.stepFlashing || 0);
    combined.chimneySides = (combined.chimneySides || 0) + (m.chimneySides || 0);
    
    // Take first non-empty pitch
    if (!combined.predominantPitch && m.predominantPitch) {
      combined.predominantPitch = m.predominantPitch;
    }
    
    // Take first address
    if (!combined.address && m.address) {
      combined.address = m.address;
    }
  }
  
  console.log('[RoofrParser] Combined measurements from', structures.length, 'structures');
  
  return combined;
}

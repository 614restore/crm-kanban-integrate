// Roofr PDF Parser
// Extracts roof measurements from Roofr measurement report PDFs

import * as pdfjsLib from 'pdfjs-dist';

// Configure worker — use CDN for reliability in production
if (typeof window !== 'undefined') {
  // Use the same version as installed package (3.11.174)
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.mjs`;
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

/**
 * Parse a Roofr PDF report and extract measurements
 */
export async function parseRoofrPDF(file: File): Promise<RoofrMeasurements> {
  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
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
    
    // Parse measurements using regex patterns
    const measurements = extractMeasurements(fullText);
    
    console.log('[RoofrParser] Extracted measurements:', measurements);
    
    return measurements;
  } catch (error) {
    console.error('[RoofrParser] Failed to parse PDF:', error);
    throw new Error(`Failed to parse Roofr PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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

// Roofr PDF Parser
// Extracts roof measurements from Roofr measurement report PDFs

import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
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
  
  // Helper to extract numeric value
  const extract = (pattern: RegExp): number => {
    const match = normalized.match(pattern);
    if (!match) return 0;
    const value = match[1].replace(/,/g, '');
    return parseFloat(value) || 0;
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
  
  // Common Roofr PDF patterns
  const patterns = {
    totalSquares: /(?:total squares?|roofing squares?)[:\s]+([\d,.]+)/i,
    totalSqFt: /(?:total (?:square feet|sq\.?\s*ft\.?)|area)[:\s]+([\d,]+)/i,
    ridgeLength: /(?:ridge (?:length|linear)|ridge)[:\s]+([\d,.]+)/i,
    hipLength: /(?:hip (?:length|linear)|hips?)[:\s]+([\d,.]+)/i,
    valleyLength: /(?:valley (?:length|linear)|valleys?)[:\s]+([\d,.]+)/i,
    eaveLength: /(?:eave (?:length|linear)|eaves?|perimeter)[:\s]+([\d,.]+)/i,
    rakeLength: /(?:rake (?:length|linear)|rakes?)[:\s]+([\d,.]+)/i,
    flashingLength: /(?:flashing (?:length|linear)|flashing)[:\s]+([\d,.]+)/i,
    facetCount: /(?:facets?|planes?|sections?)[:\s]+([\d]+)/i,
    wallFlashing: /(?:wall flashing)[:\s]+([\d,.]+)/i,
    stepFlashing: /(?:step flashing)[:\s]+([\d,.]+)/i,
  };
  
  // Extract all measurements
  const measurements: RoofrMeasurements = {
    totalSquares: extract(patterns.totalSquares),
    totalSqFt: extract(patterns.totalSqFt),
    ridgeLength: extract(patterns.ridgeLength),
    hipLength: extract(patterns.hipLength),
    valleyLength: extract(patterns.valleyLength),
    eaveLength: extract(patterns.eaveLength),
    rakeLength: extract(patterns.rakeLength),
    flashingLength: extract(patterns.flashingLength),
    predominantPitch: extractPitch(),
    facetCount: extract(patterns.facetCount),
    wallFlashing: extract(patterns.wallFlashing) || undefined,
    stepFlashing: extract(patterns.stepFlashing) || undefined,
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

// Roofr Estimate Generator
// Converts Roofr measurements into estimate line items with pricing

import { RoofrMeasurements } from './roofrParser';
import { EstimateLineItemInput } from './estimateQuote';

export interface PricingRules {
  // Material costs per unit
  shinglesPerSquare: number;
  underlaymentPerSquare: number;
  iceWaterPerRoll: number;
  starterPerBundle: number;
  ridgeCapPerBundle: number;
  dripEdgePerLF: number;
  valleyMetalPerLF: number;
  stepFlashingPerLF: number;
  laborPerSquare: number;
  
  // Multipliers and waste factors
  wasteFactor: number; // typically 1.10 (10% waste)
  ridgeBundleCoverage: number; // linear feet per bundle (typically 25)
  starterBundleCoverage: number; // linear feet per bundle (typically 15)
}

export const DEFAULT_PRICING: PricingRules = {
  shinglesPerSquare: 150,
  underlaymentPerSquare: 22,
  iceWaterPerRoll: 85,
  starterPerBundle: 48,
  ridgeCapPerBundle: 55,
  dripEdgePerLF: 3.5,
  valleyMetalPerLF: 4.5,
  stepFlashingPerLF: 3.25,
  laborPerSquare: 110,
  wasteFactor: 1.10,
  ridgeBundleCoverage: 25,
  starterBundleCoverage: 15,
};

/**
 * Generate estimate line items from Roofr measurements
 */
export function generateEstimateFromMeasurements(
  measurements: RoofrMeasurements,
  pricing: Partial<PricingRules> = {}
): EstimateLineItemInput[] {
  const rules = { ...DEFAULT_PRICING, ...pricing };
  
  const items: EstimateLineItemInput[] = [];
  
  // Apply waste factor to squares
  const adjustedSquares = measurements.totalSquares * rules.wasteFactor;
  
  // 1. Architectural Shingles
  items.push({
    description: 'Architectural Shingles',
    quantity: Math.ceil(adjustedSquares),
    unit: 'SQ',
    rate: rules.shinglesPerSquare,
    amount: Math.ceil(adjustedSquares) * rules.shinglesPerSquare,
  });
  
  // 2. Synthetic Underlayment
  items.push({
    description: 'Synthetic Underlayment',
    quantity: Math.ceil(adjustedSquares),
    unit: 'SQ',
    rate: rules.underlaymentPerSquare,
    amount: Math.ceil(adjustedSquares) * rules.underlaymentPerSquare,
  });
  
  // 3. Ice & Water Shield (valleys + eaves - typically 4-6 rolls for average roof)
  const iceWaterRolls = Math.max(
    Math.ceil((measurements.valleyLength + measurements.eaveLength * 0.3) / 65),
    4
  );
  items.push({
    description: 'Ice & Water Shield',
    quantity: iceWaterRolls,
    unit: 'Roll',
    rate: rules.iceWaterPerRoll,
    amount: iceWaterRolls * rules.iceWaterPerRoll,
  });
  
  // 4. Starter Course (eaves + rakes)
  const starterLength = measurements.eaveLength + measurements.rakeLength;
  const starterBundles = Math.ceil(starterLength / rules.starterBundleCoverage);
  items.push({
    description: 'Starter Course',
    quantity: starterBundles,
    unit: 'Bundle',
    rate: rules.starterPerBundle,
    amount: starterBundles * rules.starterPerBundle,
  });
  
  // 5. Ridge Cap
  const ridgeBundles = Math.ceil(
    (measurements.ridgeLength + measurements.hipLength) / rules.ridgeBundleCoverage
  );
  items.push({
    description: 'Ridge Cap',
    quantity: ridgeBundles,
    unit: 'Bundle',
    rate: rules.ridgeCapPerBundle,
    amount: ridgeBundles * rules.ridgeCapPerBundle,
  });
  
  // 6. Drip Edge (eaves + rakes)
  const dripEdgeLength = Math.ceil(measurements.eaveLength + measurements.rakeLength);
  items.push({
    description: 'Drip Edge',
    quantity: dripEdgeLength,
    unit: 'LF',
    rate: rules.dripEdgePerLF,
    amount: dripEdgeLength * rules.dripEdgePerLF,
  });
  
  // 7. Valley Metal (if valleys exist)
  if (measurements.valleyLength > 0) {
    items.push({
      description: 'Valley Metal',
      quantity: Math.ceil(measurements.valleyLength),
      unit: 'LF',
      rate: rules.valleyMetalPerLF,
      amount: Math.ceil(measurements.valleyLength) * rules.valleyMetalPerLF,
    });
  }
  
  // 8. Step Flashing (if wall flashing exists)
  if (measurements.wallFlashing && measurements.wallFlashing > 0) {
    items.push({
      description: 'Step Flashing',
      quantity: Math.ceil(measurements.wallFlashing),
      unit: 'LF',
      rate: rules.stepFlashingPerLF,
      amount: Math.ceil(measurements.wallFlashing) * rules.stepFlashingPerLF,
    });
  }
  
  // 9. Labor & Tear-Off
  items.push({
    description: 'Labor & Tear-Off',
    quantity: Math.ceil(measurements.totalSquares),
    unit: 'SQ',
    rate: rules.laborPerSquare,
    amount: Math.ceil(measurements.totalSquares) * rules.laborPerSquare,
  });
  
  return items;
}

/**
 * Calculate total estimate amount
 */
export function calculateTotal(lineItems: EstimateLineItemInput[]): number {
  return lineItems.reduce((sum, item) => sum + item.amount, 0);
}

/**
 * Generate estimate summary for display
 */
export function generateEstimateSummary(
  measurements: RoofrMeasurements,
  lineItems: EstimateLineItemInput[]
): {
  roofSize: string;
  pitch: string;
  complexity: string;
  materialsCost: number;
  laborCost: number;
  totalCost: number;
} {
  const laborItem = lineItems.find(item => item.description.includes('Labor'));
  const laborCost = laborItem?.amount || 0;
  const materialsCost = calculateTotal(lineItems) - laborCost;
  
  // Determine complexity based on facets and valleys
  let complexity = 'Simple';
  if (measurements.facetCount > 12 || measurements.valleyLength > 50) {
    complexity = 'Complex';
  } else if (measurements.facetCount > 6 || measurements.valleyLength > 20) {
    complexity = 'Moderate';
  }
  
  return {
    roofSize: `${measurements.totalSquares.toFixed(1)} squares (${measurements.totalSqFt.toLocaleString()} sq ft)`,
    pitch: measurements.predominantPitch,
    complexity: `${complexity} (${measurements.facetCount} facets)`,
    materialsCost,
    laborCost,
    totalCost: materialsCost + laborCost,
  };
}

/**
 * Format estimate for customer presentation
 */
export function formatEstimateForCustomer(
  lineItems: EstimateLineItemInput[],
  includeDetails: boolean = true
): string {
  let output = '## Roof Replacement Estimate\n\n';
  
  if (includeDetails) {
    output += '### Materials & Labor\n\n';
    output += '| Item | Quantity | Unit | Rate | Amount |\n';
    output += '|------|----------|------|------|--------|\n';
    
    lineItems.forEach(item => {
      output += `| ${item.description} | ${item.quantity} | ${item.unit} | $${item.rate.toFixed(2)} | $${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} |\n`;
    });
    
    output += '\n';
  }
  
  const total = calculateTotal(lineItems);
  output += `### Total Project Cost: $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n\n`;
  output += '*This estimate is based on aerial measurements and is subject to field verification.*\n';
  
  return output;
}

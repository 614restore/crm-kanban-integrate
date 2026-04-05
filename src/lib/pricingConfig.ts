// Material pricing configuration — stored in localStorage per-company.
// Provides defaults matching real market rates; user can override anytime from Settings.

export interface IceWaterProduct {
  id: string;
  name: string;
  brand: string;
  lengthFt: number;
  widthIn: number;
  sqFtPerRoll: number; // lengthFt × (widthIn / 12)
  price: number;       // default price per roll
}

/** Verified product specs as of 2025 */
export const ICE_WATER_PRODUCTS: IceWaterProduct[] = [
  {
    id: 'atlas-weathermaster',
    name: 'Atlas WeatherMaster',
    brand: 'Atlas',
    lengthFt: 65,
    widthIn: 36,
    sqFtPerRoll: 195, // 65 × 3
    price: 144,
  },
  {
    id: 'gaf-weatherwatch',
    name: 'GAF WeatherWatch',
    brand: 'GAF',
    lengthFt: 66,
    widthIn: 36,
    sqFtPerRoll: 198, // 66 × 3
    price: 105,
  },
  {
    id: 'gaf-stormguard',
    name: 'GAF StormGuard',
    brand: 'GAF',
    lengthFt: 66,
    widthIn: 36,
    sqFtPerRoll: 198,
    price: 105,
  },
];

export interface MaterialPricing {
  // Roofing — per-unit rates
  tearOffRate: number;          // per sq
  deckingRate: number;          // per 4×8 sheet
  underlaymentRate: number;     // per roll
  underlaymentSqPerRoll: number;// sq covered per roll (standard = 10)
  dripEdgeRate: number;         // per LF
  shingleRate: number;          // per sq
  ridgeCapRate: number;         // per LF
  flashingKitRate: number;      // per kit
  ridgeVentRate: number;        // per unit
  cleanupRate: number;          // flat per job

  // Ice & water
  iceWaterProductId: string;    // key from ICE_WATER_PRODUCTS
  iceWaterRate: number;         // per roll (can override product default)

  lastUpdated?: string;
}

export const PRICING_DEFAULTS: MaterialPricing = {
  tearOffRate: 85,
  deckingRate: 65,
  underlaymentRate: 80,          // ~GAF Feltbuster / Atlas Summit Pro, 10-sq roll
  underlaymentSqPerRoll: 10,
  dripEdgeRate: 4.50,
  shingleRate: 195,
  ridgeCapRate: 12,
  flashingKitRate: 450,
  ridgeVentRate: 85,
  cleanupRate: 350,
  iceWaterProductId: 'gaf-weatherwatch',
  iceWaterRate: 105,
};

const LS_KEY = 'material_pricing_config_v1';

export function getPricingConfig(): MaterialPricing {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...PRICING_DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...PRICING_DEFAULTS };
}

export function savePricingConfig(config: Partial<MaterialPricing>): void {
  const merged: MaterialPricing = { ...getPricingConfig(), ...config, lastUpdated: new Date().toISOString() };
  localStorage.setItem(LS_KEY, JSON.stringify(merged));
}

export function getIceWaterProduct(productId: string): IceWaterProduct {
  return ICE_WATER_PRODUCTS.find(p => p.id === productId) ?? ICE_WATER_PRODUCTS[1];
}

/** Rolls of ice & water needed given eave + valley linear footage and product. */
export function calcIceWaterRolls(
  eaveLF: number,
  valleyLF: number,
  product: IceWaterProduct,
  totalSq?: number
): number {
  // Ice & water applied: one strip (roll width = 3 ft) along eaves, two strips in valleys
  const areaSqFt = eaveLF * 3 + valleyLF * 6;
  if (areaSqFt > 0) return Math.ceil(areaSqFt / product.sqFtPerRoll);
  // Fallback: ~20% of total squares
  if (totalSq && totalSq > 0) return Math.max(1, Math.ceil((totalSq * 100 * 0.20) / product.sqFtPerRoll));
  return 1;
}

/** Rolls of underlayment needed for given number of squares. */
export function calcUnderlaymentRolls(totalSq: number, sqPerRoll = 10): number {
  return Math.max(1, Math.ceil(totalSq / sqPerRoll));
}

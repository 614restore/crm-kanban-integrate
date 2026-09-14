// Copied from QuoteMGR src/lib/measurementProviders.ts (read-only reference).
export type MeasurementProviderId =
  | 'roofr'
  | 'eagleview'
  | 'hover'
  | 'roofsnap'
  | 'gaf_quickmeasure';

export interface MeasurementProviderDefinition {
  id: MeasurementProviderId;
  name: string;
  description: string;
  logo: string;
  website: string;
  features: string[];
  quoteBuildMode: 'pdf_upload' | 'api_ready';
  readyMessage: string;
}

export interface MeasurementIntegrationConfig {
  provider: MeasurementProviderId;
  api_key: string;
  enabled: boolean;
  status?: 'configured' | 'ready' | 'disabled';
  status_message?: string | null;
  capabilities?: Record<string, unknown> | null;
}

export const measurementProviders: MeasurementProviderDefinition[] = [
  {
    id: 'roofr',
    name: 'Roofr',
    description: 'Roof measurement reports and material calculations',
    logo: '📄',
    website: 'https://roofr.com',
    features: ['Roof reports', 'Material calculations', 'PDF exports', 'Multi-structure summaries'],
    quoteBuildMode: 'pdf_upload',
    readyMessage: 'Ready now: upload Roofr PDFs in Quote Builder and build line items from saved measurements.',
  },
  {
    id: 'eagleview',
    name: 'EagleView',
    description: 'Aerial roof measurements and reports',
    logo: '🦅',
    website: 'https://www.eagleview.com',
    features: ['Roof measurements', 'Material estimates', 'Waste calculations', 'Pitch analysis'],
    quoteBuildMode: 'pdf_upload',
    readyMessage: 'Ready now: upload EagleView Premium Report PDFs in Quote Builder and build line items from saved measurements.',
  },
  {
    id: 'hover',
    name: 'HOVER',
    description: '3D property measurements from photos',
    logo: '📸',
    website: 'https://www.hover.to',
    features: ['3D models', 'Exterior measurements', 'Photo-based capture', 'Material lists'],
    quoteBuildMode: 'api_ready',
    readyMessage: 'Credentials are saved and the quote pipeline can store provider-linked measurements for HOVER imports.',
  },
  {
    id: 'roofsnap',
    name: 'RoofSnap',
    description: 'Instant roof measurements',
    logo: '📐',
    website: 'https://www.roofsnap.com',
    features: ['Quick measurements', 'Aerial imagery', 'Waste factors', 'Material ordering'],
    quoteBuildMode: 'api_ready',
    readyMessage: 'Credentials are saved and the quote pipeline can store provider-linked measurements for RoofSnap imports.',
  },
  {
    id: 'gaf_quickmeasure',
    name: 'GAF QuickMeasure',
    description: 'GAF certified roof measurements',
    logo: '🏠',
    website: 'https://www.gaf.com/quickmeasure',
    features: ['GAF certified', 'Roof reports', 'Material estimates', 'Warranty support'],
    quoteBuildMode: 'api_ready',
    readyMessage: 'Credentials are saved and the quote pipeline can store provider-linked measurements for GAF QuickMeasure imports.',
  },
];

export const measurementProviderMap = Object.fromEntries(
  measurementProviders.map((provider) => [provider.id, provider]),
) as Record<MeasurementProviderId, MeasurementProviderDefinition>;

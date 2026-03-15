import { EstimateItem } from './crmData';

export interface EstimateTemplate {
  id: string;
  name: string;
  description: string;
  category: 'water' | 'fire' | 'mold' | 'storm' | 'general';
  items: Omit<EstimateItem, 'id'>[];
  terms?: string;
  notes?: string;
}

export const ESTIMATE_TEMPLATES: EstimateTemplate[] = [
  {
    id: 'water-extraction',
    name: 'Water Damage - Emergency Extraction',
    description: 'Emergency water extraction and drying services',
    category: 'water',
    items: [
      { description: 'Emergency Response & Assessment', quantity: 1, unit: 'ea', unitPrice: 350, total: 350 },
      { description: 'Water Extraction (per room)', quantity: 3, unit: 'room', unitPrice: 450, total: 1350 },
      { description: 'Dehumidifier Setup (per unit)', quantity: 2, unit: 'ea', unitPrice: 125, total: 250 },
      { description: 'Air Mover Setup (per unit)', quantity: 4, unit: 'ea', unitPrice: 75, total: 300 },
      { description: 'Moisture Monitoring (3 days)', quantity: 3, unit: 'day', unitPrice: 150, total: 450 },
    ],
    terms: 'Payment due upon completion. Insurance claims accepted.',
    notes: 'Equipment rental included for up to 3 days. Additional days billed separately.',
  },
  {
    id: 'fire-restoration',
    name: 'Fire Damage - Full Restoration',
    description: 'Complete fire damage restoration including cleanup and repairs',
    category: 'fire',
    items: [
      { description: 'Emergency Board-Up & Securing', quantity: 1, unit: 'ea', unitPrice: 800, total: 800 },
      { description: 'Soot & Smoke Removal', quantity: 1500, unit: 'sqft', unitPrice: 3.5, total: 5250 },
      { description: 'Odor Removal Treatment', quantity: 1, unit: 'ea', unitPrice: 1200, total: 1200 },
      { description: 'Content Pack-Out & Storage', quantity: 1, unit: 'ea', unitPrice: 2500, total: 2500 },
      { description: 'Structural Cleaning', quantity: 1, unit: 'ea', unitPrice: 3500, total: 3500 },
    ],
    terms: 'Deposit required. Insurance billing available.',
    notes: 'Includes initial assessment and detailed scope of work.',
  },
  {
    id: 'mold-remediation',
    name: 'Mold Remediation',
    description: 'Professional mold inspection and remediation',
    category: 'mold',
    items: [
      { description: 'Mold Inspection & Testing', quantity: 1, unit: 'ea', unitPrice: 500, total: 500 },
      { description: 'Containment Setup', quantity: 1, unit: 'ea', unitPrice: 800, total: 800 },
      { description: 'Mold Removal & Treatment', quantity: 500, unit: 'sqft', unitPrice: 8, total: 4000 },
      { description: 'HEPA Air Filtration', quantity: 3, unit: 'day', unitPrice: 200, total: 600 },
      { description: 'Post-Remediation Testing', quantity: 1, unit: 'ea', unitPrice: 400, total: 400 },
    ],
    terms: 'Payment due upon completion. Certified mold remediation.',
    notes: 'All work performed by certified technicians following EPA guidelines.',
  },
  {
    id: 'storm-damage',
    name: 'Storm Damage - Roof & Exterior',
    description: 'Storm damage assessment and emergency repairs',
    category: 'storm',
    items: [
      { description: 'Emergency Roof Tarping', quantity: 1, unit: 'ea', unitPrice: 1200, total: 1200 },
      { description: 'Debris Removal', quantity: 1, unit: 'ea', unitPrice: 800, total: 800 },
      { description: 'Roof Inspection & Assessment', quantity: 1, unit: 'ea', unitPrice: 350, total: 350 },
      { description: 'Window Board-Up', quantity: 4, unit: 'ea', unitPrice: 150, total: 600 },
      { description: 'Interior Water Damage Mitigation', quantity: 1, unit: 'ea', unitPrice: 1500, total: 1500 },
    ],
    terms: 'Insurance claims accepted. Emergency services available 24/7.',
    notes: 'Includes photo documentation for insurance claims.',
  },
  {
    id: 'basement-flood',
    name: 'Basement Flood Cleanup',
    description: 'Complete basement water removal and restoration',
    category: 'water',
    items: [
      { description: 'Basement Water Extraction', quantity: 1, unit: 'ea', unitPrice: 1500, total: 1500 },
      { description: 'Sewage Cleanup (if applicable)', quantity: 1, unit: 'ea', unitPrice: 2000, total: 2000 },
      { description: 'Dehumidification (5 days)', quantity: 5, unit: 'day', unitPrice: 200, total: 1000 },
      { description: 'Antimicrobial Treatment', quantity: 800, unit: 'sqft', unitPrice: 2, total: 1600 },
      { description: 'Carpet Removal & Disposal', quantity: 800, unit: 'sqft', unitPrice: 1.5, total: 1200 },
    ],
    terms: 'Payment due upon completion. Insurance billing available.',
    notes: 'Category 3 water (sewage) requires additional safety protocols.',
  },
  {
    id: 'kitchen-fire',
    name: 'Kitchen Fire Restoration',
    description: 'Kitchen fire damage cleanup and restoration',
    category: 'fire',
    items: [
      { description: 'Kitchen Fire Cleanup', quantity: 1, unit: 'ea', unitPrice: 2500, total: 2500 },
      { description: 'Smoke Odor Removal', quantity: 1, unit: 'ea', unitPrice: 800, total: 800 },
      { description: 'Cabinet Cleaning & Restoration', quantity: 1, unit: 'ea', unitPrice: 1200, total: 1200 },
      { description: 'Appliance Cleaning', quantity: 4, unit: 'ea', unitPrice: 150, total: 600 },
      { description: 'Wall & Ceiling Cleaning', quantity: 300, unit: 'sqft', unitPrice: 4, total: 1200 },
    ],
    terms: 'Insurance claims accepted.',
    notes: 'Includes detailed photo documentation and scope of work.',
  },
  {
    id: 'sewage-backup',
    name: 'Sewage Backup Cleanup',
    description: 'Emergency sewage cleanup and sanitization',
    category: 'water',
    items: [
      { description: 'Emergency Sewage Extraction', quantity: 1, unit: 'ea', unitPrice: 2500, total: 2500 },
      { description: 'Biohazard Cleanup', quantity: 1, unit: 'ea', unitPrice: 1800, total: 1800 },
      { description: 'Antimicrobial Treatment', quantity: 600, unit: 'sqft', unitPrice: 3, total: 1800 },
      { description: 'Affected Materials Removal', quantity: 1, unit: 'ea', unitPrice: 1500, total: 1500 },
      { description: 'Air Scrubbing & Deodorization', quantity: 3, unit: 'day', unitPrice: 250, total: 750 },
    ],
    terms: 'Payment due upon completion. Category 3 water damage.',
    notes: 'All work performed following IICRC S500 standards for Category 3 water.',
  },
  {
    id: 'attic-mold',
    name: 'Attic Mold Remediation',
    description: 'Attic mold removal and prevention',
    category: 'mold',
    items: [
      { description: 'Attic Mold Inspection', quantity: 1, unit: 'ea', unitPrice: 400, total: 400 },
      { description: 'Mold Remediation', quantity: 800, unit: 'sqft', unitPrice: 6, total: 4800 },
      { description: 'Insulation Removal & Disposal', quantity: 800, unit: 'sqft', unitPrice: 2, total: 1600 },
      { description: 'Antimicrobial Treatment', quantity: 800, unit: 'sqft', unitPrice: 1.5, total: 1200 },
      { description: 'Ventilation Improvement', quantity: 1, unit: 'ea', unitPrice: 1200, total: 1200 },
    ],
    terms: 'Payment due upon completion. Warranty on remediation work.',
    notes: 'Includes moisture source identification and prevention recommendations.',
  },
  {
    id: 'commercial-water',
    name: 'Commercial Water Damage',
    description: 'Large-scale commercial water damage restoration',
    category: 'water',
    items: [
      { description: 'Emergency Response (24/7)', quantity: 1, unit: 'ea', unitPrice: 1500, total: 1500 },
      { description: 'Water Extraction (Large Area)', quantity: 5000, unit: 'sqft', unitPrice: 2, total: 10000 },
      { description: 'Industrial Dehumidifiers', quantity: 6, unit: 'ea', unitPrice: 300, total: 1800 },
      { description: 'Air Movers (Commercial)', quantity: 12, unit: 'ea', unitPrice: 100, total: 1200 },
      { description: 'Daily Monitoring (5 days)', quantity: 5, unit: 'day', unitPrice: 400, total: 2000 },
    ],
    terms: 'Commercial insurance billing. Net 30 payment terms.',
    notes: 'After-hours work available. Minimal business disruption guaranteed.',
  },
  {
    id: 'general-restoration',
    name: 'General Property Restoration',
    description: 'Standard property restoration services',
    category: 'general',
    items: [
      { description: 'Initial Assessment & Inspection', quantity: 1, unit: 'ea', unitPrice: 250, total: 250 },
      { description: 'Labor (per hour)', quantity: 8, unit: 'hr', unitPrice: 85, total: 680 },
      { description: 'Materials & Supplies', quantity: 1, unit: 'ea', unitPrice: 500, total: 500 },
      { description: 'Equipment Rental', quantity: 3, unit: 'day', unitPrice: 150, total: 450 },
      { description: 'Disposal & Cleanup', quantity: 1, unit: 'ea', unitPrice: 400, total: 400 },
    ],
    terms: 'Payment due upon completion.',
    notes: 'Customizable based on specific project needs.',
  },
];

export const getTemplatesByCategory = (category: EstimateTemplate['category']) => {
  return ESTIMATE_TEMPLATES.filter(t => t.category === category);
};

export const getTemplateById = (id: string) => {
  return ESTIMATE_TEMPLATES.find(t => t.id === id);
};

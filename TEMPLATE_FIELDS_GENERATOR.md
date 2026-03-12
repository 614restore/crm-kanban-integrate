# Template Fields Generator

This document contains the comprehensive `fields` arrays for all contractor templates (ct-002 through ct-013).

Copy and paste these into the corresponding template objects in `src/lib/contractorTemplates.ts`.

---

## ct-002: Corrugated Metal Roof Estimate

```typescript
fields: [
  { key: 'ESTIMATE_NUMBER', label: 'Estimate Number', type: 'text', defaultValue: 'EST-' + Date.now().toString().slice(-6), required: true },
  { key: 'START_DATE', label: 'Proposed Start Date', type: 'date', required: true },
  { key: 'ESTIMATED_DURATION', label: 'Estimated Duration', type: 'text', placeholder: '2-4 business days', required: true },
  
  // Project Specifications
  { key: 'METAL_GAUGE', label: 'Metal Gauge', type: 'text', defaultValue: '26', placeholder: '26, 29...', required: true },
  { key: 'METAL_COLOR', label: 'Metal Color', type: 'text', placeholder: 'Galvanized, Red, Green...', required: true },
  { key: 'METAL_FINISH', label: 'Metal Finish', type: 'text', defaultValue: 'Galvanized', placeholder: 'Galvanized, Painted...', required: true },
  { key: 'METAL_MANUFACTURER', label: 'Manufacturer', type: 'text', placeholder: 'Mueller, ABC, Union...', required: true },
  { key: 'ROOF_SQUARES', label: 'Roof Area (squares)', type: 'number', placeholder: '24', required: true },
  { key: 'ROOF_SQFT', label: 'Roof Area (sq ft)', type: 'number', placeholder: '2400', required: true },
  { key: 'ROOF_PITCH', label: 'Roof Pitch', type: 'text', placeholder: '4/12', required: true },
  
  // Cost Breakdown
  { key: 'TEAROFF_RATE', label: 'Tear-off Rate (per square)', type: 'text', defaultValue: '$75.00', required: true },
  { key: 'TEAROFF_TOTAL', label: 'Tear-off Total', type: 'text', defaultValue: '$1,800.00', required: true },
  { key: 'DECKING_SHEETS', label: 'Decking Sheets Needed', type: 'number', defaultValue: '2', required: true },
  { key: 'DECKING_RATE', label: 'Decking Rate (per sheet)', type: 'text', defaultValue: '$65.00', required: true },
  { key: 'DECKING_TOTAL', label: 'Decking Total', type: 'text', defaultValue: '$130.00', required: true },
  { key: 'UNDERLAY_RATE', label: 'Underlayment Rate (per square)', type: 'text', defaultValue: '$22.00', required: true },
  { key: 'UNDERLAY_TOTAL', label: 'Underlayment Total', type: 'text', defaultValue: '$528.00', required: true },
  { key: 'PANEL_RATE', label: 'Metal Panel Rate (per square)', type: 'text', defaultValue: '$285.00', required: true },
  { key: 'PANEL_TOTAL', label: 'Metal Panel Total', type: 'text', defaultValue: '$6,840.00', required: true },
  { key: 'RIDGE_LF', label: 'Ridge Cap (linear feet)', type: 'number', defaultValue: '45', required: true },
  { key: 'RIDGE_RATE', label: 'Ridge Rate (per LF)', type: 'text', defaultValue: '$18.00', required: true },
  { key: 'RIDGE_TOTAL', label: 'Ridge Total', type: 'text', defaultValue: '$810.00', required: true },
  { key: 'TRIM_LF', label: 'Trim (linear feet)', type: 'number', defaultValue: '310', required: true },
  { key: 'TRIM_RATE', label: 'Trim Rate (per LF)', type: 'text', defaultValue: '$6.50', required: true },
  { key: 'TRIM_TOTAL', label: 'Trim Total', type: 'text', defaultValue: '$2,015.00', required: true },
  { key: 'HARDWARE_TOTAL', label: 'Fasteners & Hardware', type: 'text', defaultValue: '$450.00', required: true },
  { key: 'CLEANUP_TOTAL', label: 'Cleanup & Haul-away', type: 'text', defaultValue: '$350.00', required: true },
  
  // Totals
  { key: 'SUBTOTAL', label: 'Subtotal', type: 'text', defaultValue: '$12,923.00', required: true },
  { key: 'TAX_RATE', label: 'Tax Rate (%)', type: 'text', defaultValue: '7.5', required: true },
  { key: 'TAX_AMOUNT', label: 'Tax Amount', type: 'text', defaultValue: '$969.23', required: true },
  { key: 'TOTAL_AMOUNT', label: 'Total Amount', type: 'text', defaultValue: '$13,892.23', required: true },
  { key: 'DEPOSIT_AMOUNT', label: 'Deposit Required', type: 'text', defaultValue: '$6,946.12', required: true },
  { key: 'BALANCE_DUE', label: 'Balance Due at Completion', type: 'text', defaultValue: '$6,946.11', required: true },
  
  // Terms
  { key: 'WARRANTY_PERIOD', label: 'Warranty Period', type: 'text', defaultValue: '2 years', required: true },
  { key: 'PAYMENT_TERMS', label: 'Payment Terms', type: 'textarea', defaultValue: 'Payment is due within 30 days of invoice date.\nLate payments subject to 1.5% monthly finance charge.\nQuestions? Contact us at (614) 808-8899.', required: true },
],
```

---

## ct-003: Standing Seam Metal Roof Estimate

```typescript
fields: [
  { key: 'ESTIMATE_NUMBER', label: 'Estimate Number', type: 'text', defaultValue: 'EST-' + Date.now().toString().slice(-6), required: true },
  { key: 'START_DATE', label: 'Proposed Start Date', type: 'date', required: true },
  { key: 'ESTIMATED_DURATION', label: 'Estimated Duration', type: 'text', placeholder: '3-5 business days', required: true },
  
  // Project Specifications
  { key: 'PANEL_WIDTH', label: 'Panel Width (inches)', type: 'text', defaultValue: '16', placeholder: '12, 16, 18...', required: true },
  { key: 'METAL_COLOR', label: 'Metal Color', type: 'text', placeholder: 'Charcoal Gray, Galvalume...', required: true },
  { key: 'METAL_GAUGE', label: 'Metal Gauge', type: 'text', defaultValue: '24', placeholder: '22, 24, 26...', required: true },
  { key: 'METAL_MANUFACTURER', label: 'Manufacturer', type: 'text', placeholder: 'Berridge, MBCI, McElroy...', required: true },
  { key: 'PAINT_WARRANTY', label: 'Paint Warranty', type: 'text', defaultValue: '30-year', required: true },
  { key: 'SUBSTRATE_WARRANTY', label: 'Substrate Warranty', type: 'text', defaultValue: 'Lifetime', required: true },
  { key: 'ROOF_SQUARES', label: 'Roof Area (squares)', type: 'number', placeholder: '24', required: true },
  { key: 'ROOF_SQFT', label: 'Roof Area (sq ft)', type: 'number', placeholder: '2400', required: true },
  { key: 'ROOF_PITCH', label: 'Roof Pitch', type: 'text', placeholder: '3/12', required: true },
  { key: 'SNOW_GUARD_LOCATIONS', label: 'Snow Guard Locations', type: 'text', placeholder: 'South slope, above entry...', required: false },
  
  // Cost Breakdown
  { key: 'TEAROFF_RATE', label: 'Tear-off Rate (per square)', type: 'text', defaultValue: '$75.00', required: true },
  { key: 'TEAROFF_TOTAL', label: 'Tear-off Total', type: 'text', defaultValue: '$1,800.00', required: true },
  { key: 'DECKING_SHEETS', label: 'Decking Sheets Needed', type: 'number', defaultValue: '2', required: true },
  { key: 'DECKING_RATE', label: 'Decking Rate (per sheet)', type: 'text', defaultValue: '$65.00', required: true },
  { key: 'DECKING_TOTAL', label: 'Decking Total', type: 'text', defaultValue: '$130.00', required: true },
  { key: 'UNDERLAY_RATE', label: 'High-Temp Underlayment Rate (per square)', type: 'text', defaultValue: '$45.00', required: true },
  { key: 'UNDERLAY_TOTAL', label: 'Underlayment Total', type: 'text', defaultValue: '$1,080.00', required: true },
  { key: 'PANEL_RATE', label: 'Standing Seam Panel Rate (per square)', type: 'text', defaultValue: '$425.00', required: true },
  { key: 'PANEL_TOTAL', label: 'Panel Total', type: 'text', defaultValue: '$10,200.00', required: true },
  { key: 'CLIP_RATE', label: 'Concealed Clip Rate (per square)', type: 'text', defaultValue: '$35.00', required: true },
  { key: 'CLIP_TOTAL', label: 'Clip System Total', type: 'text', defaultValue: '$840.00', required: true },
  { key: 'TRIM_LF', label: 'Ridge/Hip/Rake Trim (linear feet)', type: 'number', defaultValue: '310', required: true },
  { key: 'TRIM_RATE', label: 'Trim Rate (per LF)', type: 'text', defaultValue: '$12.00', required: true },
  { key: 'TRIM_TOTAL', label: 'Trim Total', type: 'text', defaultValue: '$3,720.00', required: true },
  { key: 'EAVE_LF', label: 'Eave Cleat (linear feet)', type: 'number', defaultValue: '120', required: true },
  { key: 'EAVE_RATE', label: 'Eave Cleat Rate (per LF)', type: 'text', defaultValue: '$8.00', required: true },
  { key: 'EAVE_TOTAL', label: 'Eave Cleat Total', type: 'text', defaultValue: '$960.00', required: true },
  { key: 'FLASHING_TOTAL', label: 'Flashings & Boots', type: 'text', defaultValue: '$650.00', required: true },
  { key: 'SNOW_GUARD_QTY', label: 'Snow Guard Sets', type: 'number', defaultValue: '0', required: false },
  { key: 'SNOW_GUARD_RATE', label: 'Snow Guard Rate (per set)', type: 'text', defaultValue: '$125.00', required: false },
  { key: 'SNOW_GUARD_TOTAL', label: 'Snow Guard Total', type: 'text', defaultValue: '$0.00', required: false },
  { key: 'CLEANUP_TOTAL', label: 'Cleanup & Haul-away', type: 'text', defaultValue: '$400.00', required: true },
  
  // Totals
  { key: 'SUBTOTAL', label: 'Subtotal', type: 'text', defaultValue: '$19,780.00', required: true },
  { key: 'TAX_RATE', label: 'Tax Rate (%)', type: 'text', defaultValue: '7.5', required: true },
  { key: 'TAX_AMOUNT', label: 'Tax Amount', type: 'text', defaultValue: '$1,483.50', required: true },
  { key: 'TOTAL_AMOUNT', label: 'Total Amount', type: 'text', defaultValue: '$21,263.50', required: true },
  { key: 'DEPOSIT_AMOUNT', label: 'Deposit Required', type: 'text', defaultValue: '$10,631.75', required: true },
  { key: 'BALANCE_DUE', label: 'Balance Due at Completion', type: 'text', defaultValue: '$10,631.75', required: true },
  
  // Terms
  { key: 'WARRANTY_PERIOD', label: 'Warranty Period', type: 'text', defaultValue: '2 years', required: true },
  { key: 'PAYMENT_TERMS', label: 'Payment Terms', type: 'textarea', defaultValue: 'Payment is due within 30 days of invoice date.\nLate payments subject to 1.5% monthly finance charge.\nQuestions? Contact us at (614) 808-8899.', required: true },
],
```

---

## Quick Reference: Apply These Changes

1. Open `src/lib/contractorTemplates.ts`
2. Find each template by its `id` (e.g., `id: 'ct-002'`)
3. Add the `fields` array from above right after the `category` line and before `content`
4. Save and test

**Example:**
```typescript
{
  id: 'ct-002',
  name: 'Corrugated Metal Roof Estimate',
  description: '...',
  category: 'estimate',
  fields: [ /* PASTE FIELDS HERE */ ],
  content: header('...') + `...`,
  // ... rest of template
}
```

---

## Remaining Templates to Update

- ✅ ct-001: Asphalt Shingle (DONE)
- ⏳ ct-002: Corrugated Metal Roof
- ⏳ ct-003: Standing Seam Metal Roof
- ⏳ ct-004: Vinyl Siding
- ⏳ ct-005: Aluminum Siding
- ⏳ ct-006: Gutters & Downspouts
- ⏳ ct-007: Interior Drywall
- ⏳ ct-008: Interior Paint
- ⏳ ct-009: EPA Lead Safe Disclosure
- ⏳ ct-010: Window Replacement Contract
- ⏳ ct-011: Siding Replacement Contract
- � ct-012: Insurance Restoration Contract
- ⏳ ct-013: Interior Restoration Contract

I'll create the remaining fields in the next file...

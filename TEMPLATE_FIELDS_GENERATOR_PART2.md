# Template Fields Generator - Part 2

Continuation of comprehensive fields arrays for contractor templates ct-004 through ct-013.

---

## ct-004: Vinyl Siding Estimate

```typescript
fields: [
  { key: 'ESTIMATE_NUMBER', label: 'Estimate Number', type: 'text', defaultValue: 'EST-' + Date.now().toString().slice(-6), required: true },
  { key: 'START_DATE', label: 'Proposed Start Date', type: 'date', required: true },
  { key: 'ESTIMATED_DURATION', label: 'Estimated Duration', type: 'text', placeholder: '5-7 business days', required: true },
  
  // Project Specifications
  { key: 'SIDING_BRAND', label: 'Siding Brand', type: 'text', placeholder: 'CertainTeed, Mastic, Alside...', required: true },
  { key: 'SIDING_STYLE', label: 'Siding Style', type: 'text', placeholder: 'Monogram, Cedar Discovery...', required: true },
  { key: 'SIDING_COLOR', label: 'Siding Color', type: 'text', placeholder: 'Harbor Blue, Pewter...', required: true },
  { key: 'SIDING_PROFILE', label: 'Siding Profile', type: 'text', defaultValue: 'D4.5" Dutch Lap', required: true },
  { key: 'SOFFIT_COLOR', label: 'Soffit Color', type: 'text', placeholder: 'White, Almond...', required: true },
  { key: 'FASCIA_COLOR', label: 'Fascia Color', type: 'text', placeholder: 'White, Match siding...', required: true },
  { key: 'SIDING_SQUARES', label: 'Wall Area (squares)', type: 'number', placeholder: '32', required: true },
  { key: 'SIDING_SQFT', label: 'Wall Area (sq ft)', type: 'number', placeholder: '3200', required: true },
  { key: 'SOFFIT_SQFT', label: 'Soffit Area (sq ft)', type: 'number', placeholder: '450', required: true },
  { key: 'FASCIA_LF', label: 'Fascia (linear feet)', type: 'number', placeholder: '280', required: true },
  
  // Cost Breakdown
  { key: 'REMOVAL_RATE', label: 'Removal Rate (per square)', type: 'text', defaultValue: '$45.00', required: true },
  { key: 'REMOVAL_TOTAL', label: 'Removal Total', type: 'text', defaultValue: '$1,440.00', required: true },
  { key: 'WRAP_RATE', label: 'House Wrap Rate (per square)', type: 'text', defaultValue: '$18.00', required: true },
  { key: 'WRAP_TOTAL', label: 'House Wrap Total', type: 'text', defaultValue: '$576.00', required: true },
  { key: 'SIDING_RATE', label: 'Vinyl Siding Rate (per square)', type: 'text', defaultValue: '$165.00', required: true },
  { key: 'SIDING_TOTAL', label: 'Siding Total', type: 'text', defaultValue: '$5,280.00', required: true },
  { key: 'TRIM_TOTAL', label: 'J-Channel, Corners, Trim', type: 'text', defaultValue: '$1,200.00', required: true },
  { key: 'SOFFIT_RATE', label: 'Soffit Rate (per sq ft)', type: 'text', defaultValue: '$4.50', required: true },
  { key: 'SOFFIT_TOTAL', label: 'Soffit Total', type: 'text', defaultValue: '$2,025.00', required: true },
  { key: 'FASCIA_RATE', label: 'Fascia Rate (per LF)', type: 'text', defaultValue: '$7.50', required: true },
  { key: 'FASCIA_TOTAL', label: 'Fascia Total', type: 'text', defaultValue: '$2,100.00', required: true },
  { key: 'WINDOW_COUNT', label: 'Windows/Doors to Trim', type: 'number', defaultValue: '18', required: true },
  { key: 'WINDOW_TRIM_RATE', label: 'Window Trim Rate (each)', type: 'text', defaultValue: '$45.00', required: true },
  { key: 'WINDOW_TRIM_TOTAL', label: 'Window Trim Total', type: 'text', defaultValue: '$810.00', required: true },
  { key: 'SHEATHING_SHEETS', label: 'Sheathing Repair (sheets)', type: 'number', defaultValue: '0', required: false },
  { key: 'SHEATHING_RATE', label: 'Sheathing Rate (per sheet)', type: 'text', defaultValue: '$55.00', required: false },
  { key: 'SHEATHING_TOTAL', label: 'Sheathing Total', type: 'text', defaultValue: '$0.00', required: false },
  { key: 'CLEANUP_TOTAL', label: 'Cleanup & Haul-away', type: 'text', defaultValue: '$450.00', required: true },
  
  // Totals
  { key: 'SUBTOTAL', label: 'Subtotal', type: 'text', defaultValue: '$13,881.00', required: true },
  { key: 'TAX_RATE', label: 'Tax Rate (%)', type: 'text', defaultValue: '7.5', required: true },
  { key: 'TAX_AMOUNT', label: 'Tax Amount', type: 'text', defaultValue: '$1,041.08', required: true },
  { key: 'TOTAL_AMOUNT', label: 'Total Amount', type: 'text', defaultValue: '$14,922.08', required: true },
  { key: 'DEPOSIT_AMOUNT', label: 'Deposit Required', type: 'text', defaultValue: '$7,461.04', required: true },
  { key: 'BALANCE_DUE', label: 'Balance Due at Completion', type: 'text', defaultValue: '$7,461.04', required: true },
  
  // Terms
  { key: 'WARRANTY_PERIOD', label: 'Warranty Period', type: 'text', defaultValue: '2 years', required: true },
  { key: 'PAYMENT_TERMS', label: 'Payment Terms', type: 'textarea', defaultValue: 'Payment is due within 30 days of invoice date.\nLate payments subject to 1.5% monthly finance charge.\nQuestions? Contact us at (614) 808-8899.', required: true },
],
```

---

## ct-005: Aluminum Siding Estimate

```typescript
fields: [
  { key: 'ESTIMATE_NUMBER', label: 'Estimate Number', type: 'text', defaultValue: 'EST-' + Date.now().toString().slice(-6), required: true },
  { key: 'START_DATE', label: 'Proposed Start Date', type: 'date', required: true },
  { key: 'ESTIMATED_DURATION', label: 'Estimated Duration', type: 'text', placeholder: '5-7 business days', required: true },
  
  // Project Specifications
  { key: 'SIDING_PROFILE', label: 'Siding Profile', type: 'text', defaultValue: 'D4" Horizontal', required: true },
  { key: 'SIDING_COLOR', label: 'Siding Color', type: 'text', placeholder: 'White, Almond, Custom...', required: true },
  { key: 'SIDING_THICKNESS', label: 'Siding Thickness', type: 'text', defaultValue: '.019"', required: true },
  { key: 'TRIM_COLOR', label: 'Trim/Coil Color', type: 'text', placeholder: 'White, Match siding...', required: true },
  { key: 'SIDING_SQUARES', label: 'Wall Area (squares)', type: 'number', placeholder: '32', required: true },
  { key: 'SIDING_SQFT', label: 'Wall Area (sq ft)', type: 'number', placeholder: '3200', required: true },
  { key: 'SOFFIT_SQFT', label: 'Soffit Area (sq ft)', type: 'number', placeholder: '450', required: true },
  { key: 'FASCIA_LF', label: 'Fascia (linear feet)', type: 'number', placeholder: '280', required: true },
  
  // Cost Breakdown
  { key: 'REMOVAL_RATE', label: 'Removal Rate (per square)', type: 'text', defaultValue: '$45.00', required: true },
  { key: 'REMOVAL_TOTAL', label: 'Removal Total', type: 'text', defaultValue: '$1,440.00', required: true },
  { key: 'WRAP_RATE', label: 'House Wrap Rate (per square)', type: 'text', defaultValue: '$18.00', required: true },
  { key: 'WRAP_TOTAL', label: 'House Wrap Total', type: 'text', defaultValue: '$576.00', required: true },
  { key: 'SIDING_RATE', label: 'Aluminum Siding Rate (per square)', type: 'text', defaultValue: '$185.00', required: true },
  { key: 'SIDING_TOTAL', label: 'Siding Total', type: 'text', defaultValue: '$5,920.00', required: true },
  { key: 'TRIM_TOTAL', label: 'Corner Posts, J-Trim', type: 'text', defaultValue: '$1,100.00', required: true },
  { key: 'SOFFIT_RATE', label: 'Aluminum Soffit Rate (per sq ft)', type: 'text', defaultValue: '$5.00', required: true },
  { key: 'SOFFIT_TOTAL', label: 'Soffit Total', type: 'text', defaultValue: '$2,250.00', required: true },
  { key: 'FASCIA_RATE', label: 'Coil Fascia Rate (per LF)', type: 'text', defaultValue: '$8.00', required: true },
  { key: 'FASCIA_TOTAL', label: 'Fascia Total', type: 'text', defaultValue: '$2,240.00', required: true },
  { key: 'WINDOW_COUNT', label: 'Windows/Doors to Wrap', type: 'number', defaultValue: '18', required: true },
  { key: 'WINDOW_WRAP_RATE', label: 'Window Wrap Rate (each)', type: 'text', defaultValue: '$65.00', required: true },
  { key: 'WINDOW_WRAP_TOTAL', label: 'Window Wrap Total', type: 'text', defaultValue: '$1,170.00', required: true },
  { key: 'SHEATHING_SHEETS', label: 'Sheathing Repair (sheets)', type: 'number', defaultValue: '0', required: false },
  { key: 'SHEATHING_RATE', label: 'Sheathing Rate (per sheet)', type: 'text', defaultValue: '$55.00', required: false },
  { key: 'SHEATHING_TOTAL', label: 'Sheathing Total', type: 'text', defaultValue: '$0.00', required: false },
  { key: 'CLEANUP_TOTAL', label: 'Cleanup & Haul-away', type: 'text', defaultValue: '$450.00', required: true },
  
  // Totals
  { key: 'SUBTOTAL', label: 'Subtotal', type: 'text', defaultValue: '$15,146.00', required: true },
  { key: 'TAX_RATE', label: 'Tax Rate (%)', type: 'text', defaultValue: '7.5', required: true },
  { key: 'TAX_AMOUNT', label: 'Tax Amount', type: 'text', defaultValue: '$1,135.95', required: true },
  { key: 'TOTAL_AMOUNT', label: 'Total Amount', type: 'text', defaultValue: '$16,281.95', required: true },
  { key: 'DEPOSIT_AMOUNT', label: 'Deposit Required', type: 'text', defaultValue: '$8,140.98', required: true },
  { key: 'BALANCE_DUE', label: 'Balance Due at Completion', type: 'text', defaultValue: '$8,140.97', required: true },
  
  // Terms
  { key: 'WARRANTY_PERIOD', label: 'Warranty Period', type: 'text', defaultValue: '2 years', required: true },
  { key: 'PAYMENT_TERMS', label: 'Payment Terms', type: 'textarea', defaultValue: 'Payment is due within 30 days of invoice date.\nLate payments subject to 1.5% monthly finance charge.\nQuestions? Contact us at (614) 808-8899.', required: true },
],
```

---

## ct-006: Gutters & Downspouts Estimate

```typescript
fields: [
  { key: 'ESTIMATE_NUMBER', label: 'Estimate Number', type: 'text', defaultValue: 'EST-' + Date.now().toString().slice(-6), required: true },
  { key: 'START_DATE', label: 'Proposed Start Date', type: 'date', required: true },
  { key: 'ESTIMATED_DURATION', label: 'Estimated Duration', type: 'text', placeholder: '1-2 business days', required: true },
  
  // Project Specifications
  { key: 'GUTTER_SIZE', label: 'Gutter Size (inches)', type: 'text', defaultValue: '5', placeholder: '5, 6...', required: true },
  { key: 'GUTTER_COLOR', label: 'Gutter Color', type: 'text', placeholder: 'White, Brown, Custom...', required: true },
  { key: 'DOWNSPOUT_SIZE', label: 'Downspout Size (inches)', type: 'text', defaultValue: '2x3', placeholder: '2x3, 3x4...', required: true },
  { key: 'GUTTER_LF', label: 'Gutter (linear feet)', type: 'number', placeholder: '180', required: true },
  { key: 'DOWNSPOUT_QTY', label: 'Number of Downspouts', type: 'number', defaultValue: '6', required: true },
  { key: 'DOWNSPOUT_LF', label: 'Downspout Length (LF each)', type: 'number', defaultValue: '20', required: true },
  { key: 'GUTTER_GUARD_OPTION', label: 'Gutter Guard Option', type: 'text', placeholder: 'Yes - LeafFilter, No...', required: true },
  { key: 'GUTTER_GUARD_BRAND', label: 'Gutter Guard Brand', type: 'text', placeholder: 'LeafFilter, Gutter Helmet...', required: false },
  
  // Cost Breakdown
  { key: 'REMOVE_GUT_RATE', label: 'Removal Rate (per LF)', type: 'text', defaultValue: '$2.50', required: true },
  { key: 'REMOVE_GUT_TOTAL', label: 'Removal Total', type: 'text', defaultValue: '$450.00', required: true },
  { key: 'FASCIA_REPAIR_LF', label: 'Fascia Repair (LF)', type: 'number', defaultValue: '0', required: false },
  { key: 'FASCIA_REPAIR_RATE', label: 'Fascia Repair Rate (per LF)', type: 'text', defaultValue: '$12.00', required: false },
  { key: 'FASCIA_REPAIR_TOTAL', label: 'Fascia Repair Total', type: 'text', defaultValue: '$0.00', required: false },
  { key: 'GUTTER_RATE', label: 'Seamless Gutter Rate (per LF)', type: 'text', defaultValue: '$8.50', required: true },
  { key: 'GUTTER_TOTAL', label: 'Gutter Total', type: 'text', defaultValue: '$1,530.00', required: true },
  { key: 'DOWNSPOUT_RATE', label: 'Downspout Rate (per LF)', type: 'text', defaultValue: '$6.00', required: true },
  { key: 'DOWNSPOUT_TOTAL', label: 'Downspout Total', type: 'text', defaultValue: '$720.00', required: true },
  { key: 'HARDWARE_TOTAL', label: 'Elbows, Caps, Hardware', type: 'text', defaultValue: '$280.00', required: true },
  { key: 'GG_RATE', label: 'Gutter Guard Rate (per LF)', type: 'text', defaultValue: '$12.00', required: false },
  { key: 'GG_TOTAL', label: 'Gutter Guard Total', type: 'text', defaultValue: '$2,160.00', required: false },
  { key: 'EXTENSION_QTY', label: 'Underground Extensions', type: 'number', defaultValue: '4', required: true },
  { key: 'EXTENSION_RATE', label: 'Extension Rate (each)', type: 'text', defaultValue: '$85.00', required: true },
  { key: 'EXTENSION_TOTAL', label: 'Extension Total', type: 'text', defaultValue: '$340.00', required: true },
  
  // Totals
  { key: 'SUBTOTAL', label: 'Subtotal', type: 'text', defaultValue: '$5,480.00', required: true },
  { key: 'TAX_RATE', label: 'Tax Rate (%)', type: 'text', defaultValue: '7.5', required: true },
  { key: 'TAX_AMOUNT', label: 'Tax Amount', type: 'text', defaultValue: '$411.00', required: true },
  { key: 'TOTAL_AMOUNT', label: 'Total Amount', type: 'text', defaultValue: '$5,891.00', required: true },
  { key: 'DEPOSIT_AMOUNT', label: 'Deposit Required', type: 'text', defaultValue: '$2,945.50', required: true },
  { key: 'BALANCE_DUE', label: 'Balance Due at Completion', type: 'text', defaultValue: '$2,945.50', required: true },
  
  // Terms
  { key: 'WARRANTY_PERIOD', label: 'Warranty Period', type: 'text', defaultValue: '2 years', required: true },
  { key: 'PAYMENT_TERMS', label: 'Payment Terms', type: 'textarea', defaultValue: 'Payment is due within 30 days of invoice date.\nLate payments subject to 1.5% monthly finance charge.\nQuestions? Contact us at (614) 808-8899.', required: true },
],
```

---

## Summary

This file contains fields for:
- ✅ ct-004: Vinyl Siding
- ✅ ct-005: Aluminum Siding
- ✅ ct-006: Gutters & Downspouts

**Next file will contain ct-007 through ct-013.**

Apply these the same way as shown in TEMPLATE_FIELDS_GENERATOR.md Part 1.

# Roofr Measurement → Auto-Generate Estimate

## Overview
Your CRM already has **Roofr integration** built in! Here's how to use Roofr measurement reports to automatically create estimates.

---

## Current State ✅

### What's Already Built
1. **Roofr API Integration** (`src/lib/integrations/roofr.ts`)
   - Order roof measurements by address
   - Fetch completed reports with measurements
   - Get square footage, pitch, ridge length, valleys, etc.

2. **Estimate System** (`src/lib/estimateQuote.ts`)
   - Pre-built estimate templates
   - Line items with quantities & pricing
   - Roof replacement, repair, gutters, siding templates

3. **Document Manager** (`src/components/documents/DocumentManager.tsx`)
   - Generate professional estimates
   - Send to customers
   - E-signature capability

---

## How to Upload Roofr Report & Create Estimate

### Method 1: Manual Import (Available Now)

**Step 1: Order Roofr Report**
```typescript
// In your CRM, use the Roofr integration
const roofr = new RoofrIntegration('your-api-key');

const report = await roofr.orderReport({
  address: contact.street,
  city: contact.city,
  state: contact.state,
  zip: contact.zip,
  contactId: contact.id,
  reportType: 'premium' // or 'standard'
});
```

**Step 2: Wait for Report Completion**
Roofr will email when ready, or poll:
```typescript
const completedReport = await roofr.getReport(report.id);
if (completedReport.status === 'completed') {
  // Report is ready with measurements
}
```

**Step 3: Create Estimate from Measurements**
```typescript
// Use measurements to populate estimate
const measurements = completedReport.measurements;

const estimateItems = [
  {
    description: 'Architectural Shingles',
    qty: measurements.totalSquares,
    unit: 'SQ',
    rate: 150,
    amount: measurements.totalSquares * 150
  },
  {
    description: 'Synthetic Underlayment',
    qty: measurements.totalSquares,
    unit: 'SQ',
    rate: 22,
    amount: measurements.totalSquares * 22
  },
  {
    description: 'Ridge Cap',
    qty: Math.ceil(measurements.ridgeLength / 25), // bundles
    unit: 'Bundle',
    rate: 55,
    amount: Math.ceil(measurements.ridgeLength / 25) * 55
  },
  {
    description: 'Valley Metal',
    qty: measurements.valleyLength,
    unit: 'LF',
    rate: 4.5,
    amount: measurements.valleyLength * 4.5
  },
  {
    description: 'Drip Edge',
    qty: measurements.eaveLength,
    unit: 'LF',
    rate: 3.5,
    amount: measurements.eaveLength * 3.5
  },
  {
    description: 'Labor & Tear-Off',
    qty: measurements.totalSquares,
    unit: 'SQ',
    rate: 110,
    amount: measurements.totalSquares * 110
  }
];
```

---

## Method 2: PDF Upload → Parse Measurements (Needs Implementation)

### What Needs to Be Built

**1. PDF Upload Component**
```typescript
// Add to ContactDetail.tsx or EstimatesView.tsx
<input 
  type="file" 
  accept=".pdf"
  onChange={handleRoofrPDFUpload}
/>
```

**2. PDF Parser**
```typescript
// New file: src/lib/roofrParser.ts
import { getDocument } from 'pdfjs-dist';

export async function parseRoofrPDF(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument(arrayBuffer).promise;
  
  // Extract text from PDF
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();
  const text = textContent.items.map(item => item.str).join(' ');
  
  // Parse measurements using regex
  const measurements = {
    totalSquares: parseFloat(text.match(/Total Squares[:\s]+([\d.]+)/i)?.[1] || '0'),
    totalSqFt: parseFloat(text.match(/Total Square Feet[:\s]+([\d,]+)/i)?.[1]?.replace(',', '') || '0'),
    ridgeLength: parseFloat(text.match(/Ridge Length[:\s]+([\d.]+)/i)?.[1] || '0'),
    valleyLength: parseFloat(text.match(/Valley Length[:\s]+([\d.]+)/i)?.[1] || '0'),
    eaveLength: parseFloat(text.match(/Eave Length[:\s]+([\d.]+)/i)?.[1] || '0'),
    predominantPitch: text.match(/Pitch[:\s]+([\d\/]+)/i)?.[1] || '—',
  };
  
  return measurements;
}
```

**3. Auto-Generate Estimate Button**
```typescript
// In EstimatesView.tsx
const handleRoofrUpload = async (file: File) => {
  toast.info('Parsing Roofr report...');
  
  const measurements = await parseRoofrPDF(file);
  
  // Create estimate with measurements
  const estimate = generateEstimateFromMeasurements(measurements, contact);
  
  // Save to database
  await db.createEstimate(estimate);
  
  toast.success('Estimate created from Roofr measurements!');
};
```

---

## Implementation Steps

### Quick Win (1-2 hours)
1. **Add Roofr section to Contact page**
   - Button: "Order Roofr Measurement"
   - Shows: List of reports for this contact
   - When complete: "Create Estimate" button

2. **Connect Roofr API**
   - Go to Integrations settings
   - Add Roofr API key
   - Test connection

3. **Manual estimate creation**
   - View Roofr measurements
   - Click "Generate Estimate"
   - Pre-fills line items from measurements

### Full Automation (4-6 hours)
1. **PDF Upload**
   - Install `pdfjs-dist` package
   - Create upload component
   - Parse PDF text

2. **Measurement Parser**
   - Regex patterns for Roofr PDF format
   - Extract all measurements
   - Validate data

3. **Auto-Generate Estimates**
   - Calculate materials from measurements
   - Apply pricing rules
   - Create estimate in one click

---

## Quick Start: Order Roofr Report Now

### 1. Enable Roofr Integration
```bash
# In your CRM settings
Settings → Integrations → Roofr → Add API Key
```

### 2. Order a Report
```typescript
// From any contact page
const roofr = integrationManager.getConnection('roofr');
const report = await roofr.orderReport({
  address: '123 Main St',
  city: 'Columbus',
  state: 'OH',
  zip: '43214',
  contactId: 'contact-123',
  reportType: 'standard'
});

console.log('Report ordered:', report.id);
console.log('Status:', report.status); // 'pending'
```

### 3. Check Report Status
Roofr reports usually complete in 24-48 hours:
```typescript
const completedReport = await roofr.getReport(report.id);

if (completedReport.status === 'completed') {
  console.log('Measurements:', completedReport.measurements);
  // {
  //   totalSquares: 35.2,
  //   totalSqFt: 3520,
  //   ridgeLength: 85,
  //   valleyLength: 12,
  //   eaveLength: 180,
  //   predominantPitch: "6/12",
  //   facetCount: 8
  // }
}
```

### 4. Create Estimate
```typescript
// Use the preset estimate template
const preset = getEstimatePreset('roof_replacement');

// Customize with Roofr measurements
const lineItems = [
  {
    description: 'Architectural Shingles',
    quantity: completedReport.measurements.totalSquares,
    unit: 'SQ',
    rate: 150,
    amount: completedReport.measurements.totalSquares * 150
  },
  // ... more items
];

// Generate estimate document
const estimate = {
  contactId: contact.id,
  templateId: 'retail-estimate',
  lineItems: lineItems,
  total: lineItems.reduce((sum, item) => sum + item.amount, 0)
};
```

---

## Example: Full Workflow

```typescript
// 1. Order report
const report = await roofr.orderReport({
  address: contact.street,
  city: contact.city,
  state: contact.state,
  zip: contact.zip,
  contactId: contact.id,
  reportType: 'premium'
});

toast.success(`Roofr report ordered! ID: ${report.id}`);

// 2. Wait for completion (poll or use webhook)
const checkReport = setInterval(async () => {
  const status = await roofr.getReport(report.id);
  
  if (status.status === 'completed') {
    clearInterval(checkReport);
    
    // 3. Auto-generate estimate
    const estimate = generateRoofEstimate(status.measurements);
    await db.createEstimate(estimate);
    
    toast.success('Estimate created from Roofr measurements!');
  }
}, 60000); // Check every minute
```

---

## Files to Modify

### Add Roofr Upload Feature
**File:** `src/components/crm/ContactDetail.tsx`
```typescript
// Add near the Documents section
<button onClick={() => orderRoofrReport(contact)}>
  📐 Order Roof Measurement
</button>

{roofrReports.map(report => (
  <div key={report.id}>
    <p>Status: {report.status}</p>
    {report.status === 'completed' && (
      <button onClick={() => createEstimateFromReport(report)}>
        ✨ Generate Estimate
      </button>
    )}
  </div>
))}
```

### Add Estimate Generator
**File:** `src/lib/roofrEstimateGenerator.ts` (NEW)
```typescript
export function generateRoofEstimate(measurements: RoofrReport['measurements']) {
  if (!measurements) throw new Error('No measurements available');
  
  return {
    items: [
      {
        description: 'Architectural Shingles',
        qty: measurements.totalSquares,
        unit: 'SQ',
        rate: 150
      },
      {
        description: 'Synthetic Underlayment',
        qty: measurements.totalSquares,
        unit: 'SQ',
        rate: 22
      },
      {
        description: 'Ridge Cap',
        qty: Math.ceil(measurements.ridgeLength / 25),
        unit: 'Bundle',
        rate: 55
      },
      {
        description: 'Valley Metal',
        qty: measurements.valleyLength,
        unit: 'LF',
        rate: 4.5
      },
      // ... more materials
    ]
  };
}
```

---

## Next Steps

1. **Test Roofr Integration**
   - Add API key to integrations
   - Order a test report
   - Verify measurements come back

2. **Build UI for Report Ordering**
   - Add button to contact page
   - Show report status
   - Display measurements when ready

3. **Build Auto-Estimate Generator**
   - Map measurements → line items
   - Apply your pricing
   - Generate estimate document

4. **Add PDF Upload (Optional)**
   - Install `pdfjs-dist`
   - Parse PDF measurements
   - Skip API call if customer already has report

---

## Questions?

The integration foundation is built! You just need to:
1. Connect the Roofr API
2. Add UI to order/view reports
3. Map measurements → estimate line items

Would you like me to build any of these features now?

*verified by vibecheck*

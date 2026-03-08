// Contractor Estimate Templates — shared between DocumentTemplates tab and Customer Detail modal
// Templates use {{VARIABLE}} syntax; contact/company vars are auto-filled, totals are user-supplied.

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'estimate' | 'invoice' | 'contract' | 'work-order' | 'proposal' | 'change-order' | 'safety' | 'other';
  content: string;
  variables: string[];
  favorite: boolean;
  isDefault: boolean;
  tags: string[];
  createdAt: string;
  lastModified: string;
  usageCount: number;
  fileType: 'pdf' | 'docx' | 'html';
}

/** Shared CSS for all estimate templates */
const CSS = `
  body{font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#333;max-width:820px;margin:0 auto;padding:24px}
  .hdr{border-bottom:3px solid #2563eb;padding-bottom:18px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:flex-start}
  .hdr-left{flex:1}
  .co-name{font-size:26px;font-weight:700;color:#2563eb;margin-bottom:3px}
  .co-tag{font-size:13px;color:#666;font-style:italic;margin-bottom:8px}
  .co-info{font-size:13px;line-height:1.5}
  .doc-title{text-align:center;font-size:22px;font-weight:700;color:#1f2937;margin:22px 0 18px;letter-spacing:.5px;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:10px 0}
  .grid2{display:flex;gap:20px;margin-bottom:20px}
  .box{flex:1;background:#f8fafc;padding:14px 16px;border-radius:8px;border-left:4px solid #2563eb}
  .box h4{font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin:0 0 10px;padding-bottom:6px;border-bottom:1px solid #e5e7eb}
  .row{display:flex;font-size:13px;margin-bottom:4px}
  .lbl{font-weight:600;color:#6b7280;min-width:108px;flex-shrink:0}
  .val{color:#111827}
  .sec{margin:18px 0;padding:14px 16px;background:#fff;border:1px solid #e5e7eb;border-radius:8px}
  .sec h3{font-size:15px;font-weight:700;color:#1f2937;margin:0 0 10px}
  table{width:100%;border-collapse:collapse}
  th{background:#f3f4f6;font-weight:600;font-size:12px;color:#374151;padding:9px 11px;text-align:left;border-bottom:2px solid #e5e7eb}
  td{padding:8px 11px;font-size:13px;border-bottom:1px solid #f3f4f6;vertical-align:top}
  tr:hover td{background:#fafafa}
  .totals{margin-top:14px;border-top:1px solid #e5e7eb;padding-top:12px}
  .t-row{display:flex;justify-content:flex-end;font-size:13px;margin-bottom:3px}
  .t-lbl{color:#6b7280;width:180px;text-align:right;margin-right:14px}
  .t-val{color:#111827;width:90px;text-align:right}
  .t-grand{font-weight:700;font-size:15px;margin-top:8px;padding-top:8px;border-top:2px solid #1f2937}
  .terms{background:#fef3c7;padding:12px 14px;border-radius:8px;border-left:4px solid #f59e0b;margin:18px 0;font-size:12px;line-height:1.7}
  .sigs{display:flex;gap:40px;margin-top:36px}
  .sig{flex:1;text-align:center}
  .sig-line{border-bottom:2px solid #374151;height:34px;margin-bottom:6px}
  .sig-lbl{font-size:11px;color:#6b7280}
  .footer{margin-top:28px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:14px}
  .scope-list{margin:0;padding-left:20px;font-size:13px;line-height:1.9}
  .highlight{background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:10px 14px;margin:10px 0;font-size:13px}
`;

/** Common header + info grid used by all templates */
const header = (titleText: string) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${titleText}</title><style>${CSS}</style></head>
<body>
<div class="hdr">
  <div class="hdr-left">
    <div class="co-name">{{COMPANY_NAME}}</div>
    <div class="co-tag">{{COMPANY_TAGLINE}}</div>
    <div class="co-info">
      <strong>{{REP_NAME}}</strong><br>
      {{COMPANY_ADDRESS}}, {{COMPANY_CITY}}, {{COMPANY_STATE}} {{COMPANY_ZIP}}<br>
      {{COMPANY_PHONE}} &nbsp;·&nbsp; {{COMPANY_EMAIL}}<br>
      License: {{CONTRACTOR_LICENSE}}
    </div>
  </div>
  <div>{{COMPANY_LOGO}}</div>
</div>
<div class="doc-title">${titleText.toUpperCase()}</div>
<div class="grid2">
  <div class="box">
    <h4>Customer Information</h4>
    <div class="row"><span class="lbl">Name:</span><span class="val">{{CUSTOMER_NAME}}</span></div>
    <div class="row"><span class="lbl">Phone:</span><span class="val">{{CUSTOMER_PHONE}}</span></div>
    <div class="row"><span class="lbl">Email:</span><span class="val">{{CUSTOMER_EMAIL}}</span></div>
    <div class="row"><span class="lbl">Property:</span><span class="val">{{PROPERTY_ADDRESS}}</span></div>
    <div class="row"><span class="lbl"></span><span class="val">{{PROPERTY_CITY}}, {{PROPERTY_STATE}} {{PROPERTY_ZIP}}</span></div>
  </div>
  <div class="box">
    <h4>Estimate Details</h4>
    <div class="row"><span class="lbl">Estimate #:</span><span class="val">{{ESTIMATE_NUMBER}}</span></div>
    <div class="row"><span class="lbl">Date:</span><span class="val">{{ESTIMATE_DATE}}</span></div>
    <div class="row"><span class="lbl">Valid Until:</span><span class="val">{{ESTIMATE_EXPIRY}}</span></div>
    <div class="row"><span class="lbl">Start Date:</span><span class="val">{{START_DATE}}</span></div>
    <div class="row"><span class="lbl">Est. Duration:</span><span class="val">{{ESTIMATED_DURATION}}</span></div>
  </div>
</div>`;

const footer = `<div class="sigs">
  <div class="sig"><div class="sig-line"></div><div class="sig-lbl">Customer Signature / Date</div></div>
  <div class="sig"><div class="sig-line"></div><div class="sig-lbl">Authorized Contractor / Date</div></div>
</div>
<div class="footer">Thank you for choosing {{COMPANY_NAME}}&nbsp;·&nbsp;{{COMPANY_PHONE}}&nbsp;·&nbsp;{{COMPANY_EMAIL}}</div>
</body></html>`;

const totalsBlock = `<div class="totals">
  <div class="t-row"><span class="t-lbl">Subtotal:</span><span class="t-val">{{SUBTOTAL}}</span></div>
  <div class="t-row"><span class="t-lbl">Tax ({{TAX_RATE}}%):</span><span class="t-val">{{TAX_AMOUNT}}</span></div>
  <div class="t-row t-grand"><span class="t-lbl">TOTAL ESTIMATE:</span><span class="t-val">{{TOTAL_AMOUNT}}</span></div>
  <div class="t-row"><span class="t-lbl">Deposit Required:</span><span class="t-val">{{DEPOSIT_AMOUNT}}</span></div>
  <div class="t-row"><span class="t-lbl">Balance Due at Completion:</span><span class="t-val">{{BALANCE_DUE}}</span></div>
</div>`;

const termsBlock = `<div class="terms">
  <strong>Terms &amp; Conditions:</strong><br>
  • This estimate is valid for 30 days from the date shown above.<br>
  • All work performed to manufacturer specifications and local building codes.<br>
  • Materials and workmanship warranted for <strong>{{WARRANTY_PERIOD}}</strong> from completion.<br>
  • Any changes to scope of work require a signed written change order.<br>
  • Payment terms: {{PAYMENT_TERMS}}
</div>`;

// ─── Template Definitions ──────────────────────────────────────────────────

export function getContractorEstimateTemplates(): DocumentTemplate[] {
  return [
    // ── 1. Asphalt Shingle Roof Replacement ──────────────────────────────
    {
      id: 'ct-001',
      name: 'Asphalt Shingle Roof Replacement',
      description: 'Full tear-off and replacement estimate for architectural / 3-tab asphalt shingle roofing',
      category: 'estimate',
      content: header('Asphalt Shingle Roof Replacement Estimate') + `
<div class="sec">
  <h3>Project Specifications</h3>
  <div class="highlight">
    <strong>Shingle:</strong> {{SHINGLE_BRAND}} &nbsp;·&nbsp;
    <strong>Style:</strong> {{SHINGLE_STYLE}} &nbsp;·&nbsp;
    <strong>Color:</strong> {{SHINGLE_COLOR}} &nbsp;·&nbsp;
    <strong>Warranty:</strong> {{SHINGLE_WARRANTY_YEARS}}-year manufacturer
  </div>
  <div class="row"><span class="lbl">Roof Area:</span><span class="val">{{ROOF_SQUARES}} squares ({{ROOF_SQFT}} sq ft)</span></div>
  <div class="row"><span class="lbl">Pitch:</span><span class="val">{{ROOF_PITCH}}</span></div>
  <div class="row"><span class="lbl">Stories:</span><span class="val">{{STORY_COUNT}}</span></div>
</div>
<div class="sec">
  <h3>Scope of Work</h3>
  <ul class="scope-list">
    <li>Remove and dispose of all existing roofing materials ({{LAYER_COUNT}} layer(s))</li>
    <li>Inspect and repair roof decking as needed; replace damaged sheathing</li>
    <li>Install self-adhering ice &amp; water shield at all eaves (2 courses) and valleys</li>
    <li>Install synthetic underlayment over remaining deck area</li>
    <li>Install new aluminum drip edge at eaves and rakes</li>
    <li>Install new step flashing, counter flashing, and chimney flashing</li>
    <li>Install new pipe boot/plumbing vent flashings</li>
    <li>Install <strong>{{SHINGLE_BRAND}} {{SHINGLE_STYLE}}</strong> architectural shingles — Color: {{SHINGLE_COLOR}}</li>
    <li>Install manufacturer-matching ridge cap shingles along all ridges and hips</li>
    <li>Install or replace ridge vent / box vents as needed for proper ventilation</li>
    <li>Complete daily cleanup; magnet sweep for nails; haul away all debris</li>
  </ul>
</div>
<div class="sec">
  <h3>Cost Breakdown</h3>
  <table>
    <thead><tr><th>Description</th><th style="width:100px">Qty / Unit</th><th style="width:105px">Unit Price</th><th style="width:105px">Total</th></tr></thead>
    <tbody>
      <tr><td>Tear-off &amp; disposal ({{LAYER_COUNT}} layer)</td><td>{{ROOF_SQUARES}} sq</td><td>{{TEAROFF_RATE}}</td><td>{{TEAROFF_TOTAL}}</td></tr>
      <tr><td>Decking repair / replacement (4×8 sheets)</td><td>{{DECKING_SHEETS}} sheets</td><td>{{DECKING_RATE}}</td><td>{{DECKING_TOTAL}}</td></tr>
      <tr><td>Ice &amp; water shield</td><td>{{ICE_WATER_SQ}} sq</td><td>{{ICE_WATER_RATE}}</td><td>{{ICE_WATER_TOTAL}}</td></tr>
      <tr><td>Synthetic underlayment</td><td>{{UNDERLAY_SQ}} sq</td><td>{{UNDERLAY_RATE}}</td><td>{{UNDERLAY_TOTAL}}</td></tr>
      <tr><td>Drip edge (aluminum)</td><td>{{DRIP_EDGE_LF}} LF</td><td>{{DRIP_EDGE_RATE}}</td><td>{{DRIP_EDGE_TOTAL}}</td></tr>
      <tr><td>{{SHINGLE_BRAND}} {{SHINGLE_STYLE}} shingles — {{SHINGLE_COLOR}}</td><td>{{ROOF_SQUARES}} sq</td><td>{{SHINGLE_RATE}}</td><td>{{SHINGLE_TOTAL}}</td></tr>
      <tr><td>Ridge cap shingles</td><td>{{RIDGE_LF}} LF</td><td>{{RIDGE_RATE}}</td><td>{{RIDGE_TOTAL}}</td></tr>
      <tr><td>Flashings (step, counter, pipe boots)</td><td>Lot</td><td>—</td><td>{{FLASHING_TOTAL}}</td></tr>
      <tr><td>Ridge vent / ventilation</td><td>{{VENT_COUNT}} units</td><td>{{VENT_RATE}}</td><td>{{VENT_TOTAL}}</td></tr>
      <tr><td>Cleanup &amp; haul-away</td><td>Lot</td><td>—</td><td>{{CLEANUP_TOTAL}}</td></tr>
    </tbody>
  </table>
  ${totalsBlock}
</div>
${termsBlock}
${footer}`,
      variables: ['COMPANY_NAME','COMPANY_TAGLINE','REP_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','ESTIMATE_NUMBER','ESTIMATE_DATE','ESTIMATE_EXPIRY','START_DATE','ESTIMATED_DURATION','SHINGLE_BRAND','SHINGLE_STYLE','SHINGLE_COLOR','SHINGLE_WARRANTY_YEARS','ROOF_SQUARES','ROOF_SQFT','ROOF_PITCH','STORY_COUNT','LAYER_COUNT','TOTAL_AMOUNT','DEPOSIT_AMOUNT','BALANCE_DUE','SUBTOTAL','TAX_RATE','TAX_AMOUNT','WARRANTY_PERIOD','PAYMENT_TERMS'],
      favorite: true, isDefault: true, tags: ['roofing','asphalt','shingle','residential'],
      createdAt: '2026-03-08', lastModified: '2026-03-08', usageCount: 0, fileType: 'html'
    },

    // ── 2. Corrugated Metal Roof ──────────────────────────────────────────
    {
      id: 'ct-002',
      name: 'Corrugated Metal Roof Estimate',
      description: 'Tear-off and installation estimate for corrugated metal panel roofing',
      category: 'estimate',
      content: header('Corrugated Metal Roof Estimate') + `
<div class="sec">
  <h3>Project Specifications</h3>
  <div class="highlight">
    <strong>Panel Type:</strong> Corrugated Metal &nbsp;·&nbsp;
    <strong>Gauge:</strong> {{METAL_GAUGE}} gauge &nbsp;·&nbsp;
    <strong>Color:</strong> {{METAL_COLOR}} &nbsp;·&nbsp;
    <strong>Finish:</strong> {{METAL_FINISH}}
  </div>
  <div class="row"><span class="lbl">Roof Area:</span><span class="val">{{ROOF_SQUARES}} squares ({{ROOF_SQFT}} sq ft)</span></div>
  <div class="row"><span class="lbl">Pitch:</span><span class="val">{{ROOF_PITCH}}</span></div>
  <div class="row"><span class="lbl">Manufacturer:</span><span class="val">{{METAL_MANUFACTURER}}</span></div>
</div>
<div class="sec">
  <h3>Scope of Work</h3>
  <ul class="scope-list">
    <li>Remove and dispose of all existing roofing materials</li>
    <li>Inspect roof decking; repair or replace damaged sheathing</li>
    <li>Install felt underlayment / synthetic underlayment over full deck</li>
    <li>Install butyl tape at laps and penetrations for weatherproofing</li>
    <li>Install corrugated metal panels — {{METAL_GAUGE}} ga., Color: {{METAL_COLOR}}</li>
    <li>Install corrugated ridge cap and hip caps</li>
    <li>Install eave trim, rake trim, and all transition flashings</li>
    <li>Install all fasteners with neoprene washers to manufacturer spec</li>
    <li>Seal all penetrations (vents, pipes, skylights) with appropriate flashing</li>
    <li>Complete debris removal and site cleanup</li>
  </ul>
</div>
<div class="sec">
  <h3>Cost Breakdown</h3>
  <table>
    <thead><tr><th>Description</th><th style="width:100px">Qty / Unit</th><th style="width:105px">Unit Price</th><th style="width:105px">Total</th></tr></thead>
    <tbody>
      <tr><td>Tear-off &amp; disposal</td><td>{{ROOF_SQUARES}} sq</td><td>{{TEAROFF_RATE}}</td><td>{{TEAROFF_TOTAL}}</td></tr>
      <tr><td>Decking repair / replacement</td><td>{{DECKING_SHEETS}} sheets</td><td>{{DECKING_RATE}}</td><td>{{DECKING_TOTAL}}</td></tr>
      <tr><td>Underlayment</td><td>{{ROOF_SQUARES}} sq</td><td>{{UNDERLAY_RATE}}</td><td>{{UNDERLAY_TOTAL}}</td></tr>
      <tr><td>Corrugated metal panels ({{METAL_GAUGE}} ga. — {{METAL_COLOR}})</td><td>{{ROOF_SQUARES}} sq</td><td>{{PANEL_RATE}}</td><td>{{PANEL_TOTAL}}</td></tr>
      <tr><td>Ridge cap &amp; hip cap</td><td>{{RIDGE_LF}} LF</td><td>{{RIDGE_RATE}}</td><td>{{RIDGE_TOTAL}}</td></tr>
      <tr><td>Eave &amp; rake trim, flashings</td><td>{{TRIM_LF}} LF</td><td>{{TRIM_RATE}}</td><td>{{TRIM_TOTAL}}</td></tr>
      <tr><td>Fasteners, butyl tape, sealant</td><td>Lot</td><td>—</td><td>{{HARDWARE_TOTAL}}</td></tr>
      <tr><td>Cleanup &amp; haul-away</td><td>Lot</td><td>—</td><td>{{CLEANUP_TOTAL}}</td></tr>
    </tbody>
  </table>
  ${totalsBlock}
</div>
${termsBlock}
${footer}`,
      variables: ['COMPANY_NAME','COMPANY_TAGLINE','REP_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','ESTIMATE_NUMBER','ESTIMATE_DATE','ESTIMATE_EXPIRY','START_DATE','ESTIMATED_DURATION','METAL_GAUGE','METAL_COLOR','METAL_FINISH','METAL_MANUFACTURER','ROOF_SQUARES','ROOF_SQFT','ROOF_PITCH','TOTAL_AMOUNT','DEPOSIT_AMOUNT','BALANCE_DUE','SUBTOTAL','TAX_RATE','TAX_AMOUNT','WARRANTY_PERIOD','PAYMENT_TERMS'],
      favorite: false, isDefault: false, tags: ['roofing','metal','corrugated'],
      createdAt: '2026-03-08', lastModified: '2026-03-08', usageCount: 0, fileType: 'html'
    },

    // ── 3. Standing Seam Metal Roof ───────────────────────────────────────
    {
      id: 'ct-003',
      name: 'Standing Seam Metal Roof Estimate',
      description: 'Premium concealed-fastener standing seam metal roof installation estimate',
      category: 'estimate',
      content: header('Standing Seam Metal Roof Estimate') + `
<div class="sec">
  <h3>Project Specifications</h3>
  <div class="highlight">
    <strong>System:</strong> Standing Seam (Concealed Fastener) &nbsp;·&nbsp;
    <strong>Panel Width:</strong> {{PANEL_WIDTH}}" &nbsp;·&nbsp;
    <strong>Color:</strong> {{METAL_COLOR}} &nbsp;·&nbsp;
    <strong>Gauge:</strong> {{METAL_GAUGE}} ga.
  </div>
  <div class="row"><span class="lbl">Roof Area:</span><span class="val">{{ROOF_SQUARES}} squares ({{ROOF_SQFT}} sq ft)</span></div>
  <div class="row"><span class="lbl">Pitch:</span><span class="val">{{ROOF_PITCH}}</span></div>
  <div class="row"><span class="lbl">Manufacturer:</span><span class="val">{{METAL_MANUFACTURER}}</span></div>
  <div class="row"><span class="lbl">Finish Warranty:</span><span class="val">{{PAINT_WARRANTY}} paint / {{SUBSTRATE_WARRANTY}} substrate</span></div>
</div>
<div class="sec">
  <h3>Scope of Work</h3>
  <ul class="scope-list">
    <li>Remove and dispose of all existing roofing materials</li>
    <li>Inspect and repair / replace damaged roof decking</li>
    <li>Install high-temp self-adhering underlayment over full deck area</li>
    <li>Install continuous eave cleat / starter strip at all eaves</li>
    <li>Install standing seam panels ({{PANEL_WIDTH}}" width, {{METAL_GAUGE}} ga., {{METAL_COLOR}}) — snap-lock or mechanical seam per manufacturer spec</li>
    <li>Install concealed clip system; no exposed fasteners on field panels</li>
    <li>Install ridge cap, hip cap, and all rake trim</li>
    <li>Install valley flashings, step flashings, and pipe penetration boots</li>
    <li>Install snow guards at {{SNOW_GUARD_LOCATIONS}} (if applicable)</li>
    <li>Sealant at all penetrations; test for watertightness</li>
    <li>Full site cleanup and debris disposal</li>
  </ul>
</div>
<div class="sec">
  <h3>Cost Breakdown</h3>
  <table>
    <thead><tr><th>Description</th><th style="width:100px">Qty / Unit</th><th style="width:105px">Unit Price</th><th style="width:105px">Total</th></tr></thead>
    <tbody>
      <tr><td>Tear-off &amp; disposal</td><td>{{ROOF_SQUARES}} sq</td><td>{{TEAROFF_RATE}}</td><td>{{TEAROFF_TOTAL}}</td></tr>
      <tr><td>Decking repair / replacement</td><td>{{DECKING_SHEETS}} sheets</td><td>{{DECKING_RATE}}</td><td>{{DECKING_TOTAL}}</td></tr>
      <tr><td>High-temp peel &amp; stick underlayment</td><td>{{ROOF_SQUARES}} sq</td><td>{{UNDERLAY_RATE}}</td><td>{{UNDERLAY_TOTAL}}</td></tr>
      <tr><td>Standing seam panels {{PANEL_WIDTH}}" — {{METAL_COLOR}} ({{METAL_GAUGE}} ga.)</td><td>{{ROOF_SQUARES}} sq</td><td>{{PANEL_RATE}}</td><td>{{PANEL_TOTAL}}</td></tr>
      <tr><td>Concealed clip system</td><td>{{ROOF_SQUARES}} sq</td><td>{{CLIP_RATE}}</td><td>{{CLIP_TOTAL}}</td></tr>
      <tr><td>Ridge, hip &amp; rake trim</td><td>{{TRIM_LF}} LF</td><td>{{TRIM_RATE}}</td><td>{{TRIM_TOTAL}}</td></tr>
      <tr><td>Eave cleat / starter strip</td><td>{{EAVE_LF}} LF</td><td>{{EAVE_RATE}}</td><td>{{EAVE_TOTAL}}</td></tr>
      <tr><td>Flashings &amp; penetration boots</td><td>Lot</td><td>—</td><td>{{FLASHING_TOTAL}}</td></tr>
      <tr><td>Snow guards (if applicable)</td><td>{{SNOW_GUARD_QTY}} sets</td><td>{{SNOW_GUARD_RATE}}</td><td>{{SNOW_GUARD_TOTAL}}</td></tr>
      <tr><td>Cleanup &amp; haul-away</td><td>Lot</td><td>—</td><td>{{CLEANUP_TOTAL}}</td></tr>
    </tbody>
  </table>
  ${totalsBlock}
</div>
${termsBlock}
${footer}`,
      variables: ['COMPANY_NAME','COMPANY_TAGLINE','REP_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','ESTIMATE_NUMBER','ESTIMATE_DATE','ESTIMATE_EXPIRY','START_DATE','ESTIMATED_DURATION','PANEL_WIDTH','METAL_COLOR','METAL_GAUGE','METAL_MANUFACTURER','PAINT_WARRANTY','SUBSTRATE_WARRANTY','ROOF_SQUARES','ROOF_SQFT','ROOF_PITCH','TOTAL_AMOUNT','DEPOSIT_AMOUNT','BALANCE_DUE','SUBTOTAL','TAX_RATE','TAX_AMOUNT','WARRANTY_PERIOD','PAYMENT_TERMS'],
      favorite: false, isDefault: false, tags: ['roofing','metal','standing-seam','premium'],
      createdAt: '2026-03-08', lastModified: '2026-03-08', usageCount: 0, fileType: 'html'
    },

    // ── 4. Vinyl Siding ───────────────────────────────────────────────────
    {
      id: 'ct-004',
      name: 'Vinyl Siding Estimate',
      description: 'Installation estimate for vinyl siding including trim, soffit, and fascia',
      category: 'estimate',
      content: header('Vinyl Siding Estimate') + `
<div class="sec">
  <h3>Project Specifications</h3>
  <div class="highlight">
    <strong>Brand:</strong> {{SIDING_BRAND}} &nbsp;·&nbsp;
    <strong>Style:</strong> {{SIDING_STYLE}} &nbsp;·&nbsp;
    <strong>Color:</strong> {{SIDING_COLOR}} &nbsp;·&nbsp;
    <strong>Profile:</strong> {{SIDING_PROFILE}}
  </div>
  <div class="row"><span class="lbl">Wall Area:</span><span class="val">{{SIDING_SQUARES}} squares ({{SIDING_SQFT}} sq ft)</span></div>
  <div class="row"><span class="lbl">Soffit Area:</span><span class="val">{{SOFFIT_SQFT}} sq ft</span></div>
  <div class="row"><span class="lbl">Fascia Linear Ft:</span><span class="val">{{FASCIA_LF}} LF</span></div>
</div>
<div class="sec">
  <h3>Scope of Work</h3>
  <ul class="scope-list">
    <li>Remove and dispose of all existing siding, trim, and related materials</li>
    <li>Inspect and repair sheathing / framing as needed</li>
    <li>Install Tyvek or equivalent house wrap (weather-resistant barrier)</li>
    <li>Install all J-channel, corner posts (inside and outside), starter strip, and F-trim</li>
    <li>Install <strong>{{SIDING_BRAND}} {{SIDING_STYLE}}</strong> vinyl siding panels — Color: {{SIDING_COLOR}}</li>
    <li>Install vinyl soffit panels at all overhangs — Color: {{SOFFIT_COLOR}}</li>
    <li>Install coil stock aluminum fascia — Color: {{FASCIA_COLOR}}</li>
    <li>Install vinyl window trim / J-channel at all windows and doors</li>
    <li>Caulk all penetrations, corners, and transitions</li>
    <li>Daily cleanup; haul away all old siding and debris</li>
  </ul>
</div>
<div class="sec">
  <h3>Cost Breakdown</h3>
  <table>
    <thead><tr><th>Description</th><th style="width:100px">Qty / Unit</th><th style="width:105px">Unit Price</th><th style="width:105px">Total</th></tr></thead>
    <tbody>
      <tr><td>Remove &amp; dispose existing siding</td><td>{{SIDING_SQUARES}} sq</td><td>{{REMOVAL_RATE}}</td><td>{{REMOVAL_TOTAL}}</td></tr>
      <tr><td>House wrap installation</td><td>{{SIDING_SQUARES}} sq</td><td>{{WRAP_RATE}}</td><td>{{WRAP_TOTAL}}</td></tr>
      <tr><td>{{SIDING_BRAND}} {{SIDING_STYLE}} vinyl siding — {{SIDING_COLOR}}</td><td>{{SIDING_SQUARES}} sq</td><td>{{SIDING_RATE}}</td><td>{{SIDING_TOTAL}}</td></tr>
      <tr><td>J-channel, corner posts, starter strip, trim</td><td>Lot</td><td>—</td><td>{{TRIM_TOTAL}}</td></tr>
      <tr><td>Vinyl soffit panels — {{SOFFIT_COLOR}}</td><td>{{SOFFIT_SQFT}} sq ft</td><td>{{SOFFIT_RATE}}</td><td>{{SOFFIT_TOTAL}}</td></tr>
      <tr><td>Coil stock aluminum fascia — {{FASCIA_COLOR}}</td><td>{{FASCIA_LF}} LF</td><td>{{FASCIA_RATE}}</td><td>{{FASCIA_TOTAL}}</td></tr>
      <tr><td>Window/door casing &amp; trim allowance</td><td>{{WINDOW_COUNT}} openings</td><td>{{WINDOW_TRIM_RATE}}</td><td>{{WINDOW_TRIM_TOTAL}}</td></tr>
      <tr><td>Sheathing repair (if needed)</td><td>{{SHEATHING_SHEETS}} sheets</td><td>{{SHEATHING_RATE}}</td><td>{{SHEATHING_TOTAL}}</td></tr>
      <tr><td>Cleanup &amp; haul-away</td><td>Lot</td><td>—</td><td>{{CLEANUP_TOTAL}}</td></tr>
    </tbody>
  </table>
  ${totalsBlock}
</div>
${termsBlock}
${footer}`,
      variables: ['COMPANY_NAME','COMPANY_TAGLINE','REP_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','ESTIMATE_NUMBER','ESTIMATE_DATE','ESTIMATE_EXPIRY','START_DATE','ESTIMATED_DURATION','SIDING_BRAND','SIDING_STYLE','SIDING_COLOR','SIDING_PROFILE','SOFFIT_COLOR','FASCIA_COLOR','SIDING_SQUARES','SIDING_SQFT','TOTAL_AMOUNT','DEPOSIT_AMOUNT','BALANCE_DUE','SUBTOTAL','TAX_RATE','TAX_AMOUNT','WARRANTY_PERIOD','PAYMENT_TERMS'],
      favorite: false, isDefault: false, tags: ['siding','vinyl','exterior'],
      createdAt: '2026-03-08', lastModified: '2026-03-08', usageCount: 0, fileType: 'html'
    },

    // ── 5. Aluminum Siding ────────────────────────────────────────────────
    {
      id: 'ct-005',
      name: 'Aluminum Siding Estimate',
      description: 'Installation estimate for aluminum siding including soffit and fascia coil stock',
      category: 'estimate',
      content: header('Aluminum Siding Estimate') + `
<div class="sec">
  <h3>Project Specifications</h3>
  <div class="highlight">
    <strong>Material:</strong> Aluminum Siding &nbsp;·&nbsp;
    <strong>Profile:</strong> {{SIDING_PROFILE}} &nbsp;·&nbsp;
    <strong>Color:</strong> {{SIDING_COLOR}} &nbsp;·&nbsp;
    <strong>Thickness:</strong> {{SIDING_THICKNESS}}
  </div>
  <div class="row"><span class="lbl">Wall Area:</span><span class="val">{{SIDING_SQUARES}} squares ({{SIDING_SQFT}} sq ft)</span></div>
  <div class="row"><span class="lbl">Soffit/Fascia:</span><span class="val">{{SOFFIT_SQFT}} sq ft soffit · {{FASCIA_LF}} LF fascia</span></div>
</div>
<div class="sec">
  <h3>Scope of Work</h3>
  <ul class="scope-list">
    <li>Remove and dispose of all existing siding and related materials</li>
    <li>Inspect sheathing and framing; repair as needed</li>
    <li>Install house wrap over full wall area</li>
    <li>Install all starter strips, corner posts, J-channel, and trim</li>
    <li>Install aluminum horizontal siding — Profile: {{SIDING_PROFILE}}, Color: {{SIDING_COLOR}}</li>
    <li>Install aluminum vented soffit panels at all overhangs</li>
    <li>Install coil stock fascia at all fascia boards</li>
    <li>Wrap all windows and doors with coil stock — Color: {{TRIM_COLOR}}</li>
    <li>Caulk and seal all penetrations and transitions</li>
    <li>Cleanup and haul away all debris</li>
  </ul>
</div>
<div class="sec">
  <h3>Cost Breakdown</h3>
  <table>
    <thead><tr><th>Description</th><th style="width:100px">Qty / Unit</th><th style="width:105px">Unit Price</th><th style="width:105px">Total</th></tr></thead>
    <tbody>
      <tr><td>Remove &amp; dispose existing siding</td><td>{{SIDING_SQUARES}} sq</td><td>{{REMOVAL_RATE}}</td><td>{{REMOVAL_TOTAL}}</td></tr>
      <tr><td>House wrap installation</td><td>{{SIDING_SQUARES}} sq</td><td>{{WRAP_RATE}}</td><td>{{WRAP_TOTAL}}</td></tr>
      <tr><td>Aluminum siding panels ({{SIDING_PROFILE}} — {{SIDING_COLOR}})</td><td>{{SIDING_SQUARES}} sq</td><td>{{SIDING_RATE}}</td><td>{{SIDING_TOTAL}}</td></tr>
      <tr><td>Corner posts, starter strip, J-trim</td><td>Lot</td><td>—</td><td>{{TRIM_TOTAL}}</td></tr>
      <tr><td>Aluminum vented soffit panels</td><td>{{SOFFIT_SQFT}} sq ft</td><td>{{SOFFIT_RATE}}</td><td>{{SOFFIT_TOTAL}}</td></tr>
      <tr><td>Coil stock fascia wrap</td><td>{{FASCIA_LF}} LF</td><td>{{FASCIA_RATE}}</td><td>{{FASCIA_TOTAL}}</td></tr>
      <tr><td>Coil stock window/door wraps — {{TRIM_COLOR}}</td><td>{{WINDOW_COUNT}} openings</td><td>{{WINDOW_WRAP_RATE}}</td><td>{{WINDOW_WRAP_TOTAL}}</td></tr>
      <tr><td>Sheathing repair (if needed)</td><td>{{SHEATHING_SHEETS}} sheets</td><td>{{SHEATHING_RATE}}</td><td>{{SHEATHING_TOTAL}}</td></tr>
      <tr><td>Cleanup &amp; haul-away</td><td>Lot</td><td>—</td><td>{{CLEANUP_TOTAL}}</td></tr>
    </tbody>
  </table>
  ${totalsBlock}
</div>
${termsBlock}
${footer}`,
      variables: ['COMPANY_NAME','COMPANY_TAGLINE','REP_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','ESTIMATE_NUMBER','ESTIMATE_DATE','ESTIMATE_EXPIRY','START_DATE','ESTIMATED_DURATION','SIDING_PROFILE','SIDING_COLOR','SIDING_THICKNESS','TRIM_COLOR','SIDING_SQUARES','SIDING_SQFT','TOTAL_AMOUNT','DEPOSIT_AMOUNT','BALANCE_DUE','SUBTOTAL','TAX_RATE','TAX_AMOUNT','WARRANTY_PERIOD','PAYMENT_TERMS'],
      favorite: false, isDefault: false, tags: ['siding','aluminum','exterior'],
      createdAt: '2026-03-08', lastModified: '2026-03-08', usageCount: 0, fileType: 'html'
    },

    // ── 6. Gutters & Downspouts ───────────────────────────────────────────
    {
      id: 'ct-006',
      name: 'Gutters & Downspouts Estimate',
      description: 'Seamless aluminum gutter removal and installation estimate with optional gutter guards',
      category: 'estimate',
      content: header('Gutters & Downspouts Estimate') + `
<div class="sec">
  <h3>Project Specifications</h3>
  <div class="highlight">
    <strong>Gutter Size:</strong> {{GUTTER_SIZE}}" K-style Seamless Aluminum &nbsp;·&nbsp;
    <strong>Color:</strong> {{GUTTER_COLOR}} &nbsp;·&nbsp;
    <strong>Downspout Size:</strong> {{DOWNSPOUT_SIZE}}"
  </div>
  <div class="row"><span class="lbl">Gutter Linear Ft:</span><span class="val">{{GUTTER_LF}} LF</span></div>
  <div class="row"><span class="lbl">Downspouts:</span><span class="val">{{DOWNSPOUT_QTY}} downspouts ({{DOWNSPOUT_LF}} LF total)</span></div>
  <div class="row"><span class="lbl">Gutter Guards:</span><span class="val">{{GUTTER_GUARD_OPTION}}</span></div>
</div>
<div class="sec">
  <h3>Scope of Work</h3>
  <ul class="scope-list">
    <li>Remove and dispose of all existing gutters, downspouts, and brackets</li>
    <li>Inspect and repair fascia boards as needed (additional charge per LF if needed)</li>
    <li>Fabricate and install {{GUTTER_SIZE}}" seamless aluminum gutters — Color: {{GUTTER_COLOR}}</li>
    <li>Install all hangers / hidden clip brackets at 24" OC (16" OC in snow regions)</li>
    <li>Install {{DOWNSPOUT_QTY}} aluminum downspouts ({{DOWNSPOUT_SIZE}}×3") — Color: {{GUTTER_COLOR}}</li>
    <li>Install all elbows, end caps, splash blocks, and underground extensions as needed</li>
    <li>Seal all seams and end caps with gutter sealant</li>
    <li>Install {{GUTTER_GUARD_BRAND}} leaf/gutter guards, {{GUTTER_LF}} LF (if selected)</li>
    <li>Confirm proper slope (⅛" per 10 LF) and test flow</li>
    <li>Cleanup and removal of all old materials</li>
  </ul>
</div>
<div class="sec">
  <h3>Cost Breakdown</h3>
  <table>
    <thead><tr><th>Description</th><th style="width:100px">Qty / Unit</th><th style="width:105px">Unit Price</th><th style="width:105px">Total</th></tr></thead>
    <tbody>
      <tr><td>Remove &amp; dispose existing gutters/downspouts</td><td>{{GUTTER_LF}} LF</td><td>{{REMOVE_GUT_RATE}}</td><td>{{REMOVE_GUT_TOTAL}}</td></tr>
      <tr><td>Fascia board repair (if needed)</td><td>{{FASCIA_REPAIR_LF}} LF</td><td>{{FASCIA_REPAIR_RATE}}</td><td>{{FASCIA_REPAIR_TOTAL}}</td></tr>
      <tr><td>{{GUTTER_SIZE}}" seamless aluminum gutters — {{GUTTER_COLOR}}</td><td>{{GUTTER_LF}} LF</td><td>{{GUTTER_RATE}}</td><td>{{GUTTER_TOTAL}}</td></tr>
      <tr><td>Downspouts ({{DOWNSPOUT_SIZE}}×3") — {{GUTTER_COLOR}}</td><td>{{DOWNSPOUT_QTY}} @ {{DOWNSPOUT_LF}} LF ea.</td><td>{{DOWNSPOUT_RATE}}</td><td>{{DOWNSPOUT_TOTAL}}</td></tr>
      <tr><td>Elbows, end caps, sealant, hardware</td><td>Lot</td><td>—</td><td>{{HARDWARE_TOTAL}}</td></tr>
      <tr><td>Gutter guards — {{GUTTER_GUARD_BRAND}}</td><td>{{GUTTER_LF}} LF</td><td>{{GG_RATE}}</td><td>{{GG_TOTAL}}</td></tr>
      <tr><td>Underground extension / splash blocks</td><td>{{EXTENSION_QTY}} ea.</td><td>{{EXTENSION_RATE}}</td><td>{{EXTENSION_TOTAL}}</td></tr>
    </tbody>
  </table>
  ${totalsBlock}
</div>
${termsBlock}
${footer}`,
      variables: ['COMPANY_NAME','COMPANY_TAGLINE','REP_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','ESTIMATE_NUMBER','ESTIMATE_DATE','ESTIMATE_EXPIRY','START_DATE','ESTIMATED_DURATION','GUTTER_SIZE','GUTTER_COLOR','GUTTER_LF','DOWNSPOUT_SIZE','DOWNSPOUT_QTY','DOWNSPOUT_LF','GUTTER_GUARD_OPTION','GUTTER_GUARD_BRAND','TOTAL_AMOUNT','DEPOSIT_AMOUNT','BALANCE_DUE','SUBTOTAL','TAX_RATE','TAX_AMOUNT','WARRANTY_PERIOD','PAYMENT_TERMS'],
      favorite: true, isDefault: false, tags: ['gutters','downspouts','drainage','exterior'],
      createdAt: '2026-03-08', lastModified: '2026-03-08', usageCount: 0, fileType: 'html'
    },

    // ── 7. Interior Drywall ───────────────────────────────────────────────
    {
      id: 'ct-007',
      name: 'Interior Drywall Estimate',
      description: 'Drywall repair or replacement estimate including hanging, taping, and finishing',
      category: 'estimate',
      content: header('Interior Drywall Estimate') + `
<div class="sec">
  <h3>Project Specifications</h3>
  <div class="highlight">
    <strong>Finish Level:</strong> Level {{FINISH_LEVEL}} &nbsp;·&nbsp;
    <strong>Texture:</strong> {{TEXTURE_TYPE}} &nbsp;·&nbsp;
    <strong>Drywall Thickness:</strong> {{DRYWALL_THICKNESS}}"
  </div>
  <div class="row"><span class="lbl">Work Area:</span><span class="val">{{ROOM_LIST}}</span></div>
  <div class="row"><span class="lbl">Total Sq Ft:</span><span class="val">{{DRYWALL_SQFT}} sq ft</span></div>
  <div class="row"><span class="lbl">Ceiling Height:</span><span class="val">{{CEILING_HEIGHT}}</span></div>
</div>
<div class="sec">
  <h3>Scope of Work</h3>
  <ul class="scope-list">
    <li>Protect floors and furniture; remove damaged or existing drywall as needed</li>
    <li>Inspect framing / blocking; add backing or blocking as required</li>
    <li>Install {{DRYWALL_THICKNESS}}" drywall sheets; fasten per code</li>
    <li>Install metal corner bead at all outside corners</li>
    <li>Tape all seams using paper tape and joint compound</li>
    <li>Apply second and third coat of joint compound; feather to Level {{FINISH_LEVEL}}</li>
    <li>Sand smooth between coats; final sand to finish</li>
    <li>Apply {{TEXTURE_TYPE}} texture (if applicable)</li>
    <li>Prime coat all repaired/new drywall (ready for paint)</li>
    <li>Clean up all drywall dust, scrap, and debris</li>
  </ul>
</div>
<div class="sec">
  <h3>Cost Breakdown</h3>
  <table>
    <thead><tr><th>Description</th><th style="width:100px">Qty / Unit</th><th style="width:105px">Unit Price</th><th style="width:105px">Total</th></tr></thead>
    <tbody>
      <tr><td>Demolition / removal of existing drywall</td><td>{{DEMO_SQFT}} sq ft</td><td>{{DEMO_RATE}}</td><td>{{DEMO_TOTAL}}</td></tr>
      <tr><td>Framing / blocking repairs</td><td>{{FRAMING_HOURS}} hrs</td><td>{{FRAMING_RATE}}</td><td>{{FRAMING_TOTAL}}</td></tr>
      <tr><td>{{DRYWALL_THICKNESS}}" drywall — hang &amp; screw</td><td>{{DRYWALL_SQFT}} sq ft</td><td>{{HANG_RATE}}</td><td>{{HANG_TOTAL}}</td></tr>
      <tr><td>Tape, bed &amp; finish (Level {{FINISH_LEVEL}})</td><td>{{DRYWALL_SQFT}} sq ft</td><td>{{TAPE_RATE}}</td><td>{{TAPE_TOTAL}}</td></tr>
      <tr><td>Corner bead installation</td><td>{{CORNER_BEAD_LF}} LF</td><td>{{CB_RATE}}</td><td>{{CB_TOTAL}}</td></tr>
      <tr><td>{{TEXTURE_TYPE}} texture application</td><td>{{DRYWALL_SQFT}} sq ft</td><td>{{TEXTURE_RATE}}</td><td>{{TEXTURE_TOTAL}}</td></tr>
      <tr><td>Prime coat</td><td>{{DRYWALL_SQFT}} sq ft</td><td>{{PRIME_RATE}}</td><td>{{PRIME_TOTAL}}</td></tr>
      <tr><td>Materials (drywall, compound, tape, screws)</td><td>{{MATERIAL_SHEETS}} sheets + supplies</td><td>—</td><td>{{MATERIAL_TOTAL}}</td></tr>
      <tr><td>Cleanup &amp; debris disposal</td><td>Lot</td><td>—</td><td>{{CLEANUP_TOTAL}}</td></tr>
    </tbody>
  </table>
  ${totalsBlock}
</div>
${termsBlock}
${footer}`,
      variables: ['COMPANY_NAME','COMPANY_TAGLINE','REP_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','ESTIMATE_NUMBER','ESTIMATE_DATE','ESTIMATE_EXPIRY','START_DATE','ESTIMATED_DURATION','FINISH_LEVEL','TEXTURE_TYPE','DRYWALL_THICKNESS','ROOM_LIST','DRYWALL_SQFT','CEILING_HEIGHT','TOTAL_AMOUNT','DEPOSIT_AMOUNT','BALANCE_DUE','SUBTOTAL','TAX_RATE','TAX_AMOUNT','WARRANTY_PERIOD','PAYMENT_TERMS'],
      favorite: false, isDefault: false, tags: ['drywall','interior','repair','finishing'],
      createdAt: '2026-03-08', lastModified: '2026-03-08', usageCount: 0, fileType: 'html'
    },

    // ── 8. Interior Paint ─────────────────────────────────────────────────
    {
      id: 'ct-008',
      name: 'Interior Paint Estimate',
      description: 'Full interior painting estimate covering walls, ceilings, trim, and doors',
      category: 'estimate',
      content: header('Interior Paint Estimate') + `
<div class="sec">
  <h3>Project Specifications</h3>
  <div class="highlight">
    <strong>Brand / Line:</strong> {{PAINT_BRAND}} {{PAINT_LINE}} &nbsp;·&nbsp;
    <strong>Wall Color(s):</strong> {{WALL_COLOR}} &nbsp;·&nbsp;
    <strong>Trim Color:</strong> {{TRIM_COLOR}} &nbsp;·&nbsp;
    <strong>Ceiling Color:</strong> {{CEILING_COLOR}}
  </div>
  <div class="row"><span class="lbl">Rooms:</span><span class="val">{{ROOM_LIST}}</span></div>
  <div class="row"><span class="lbl">Paintable Sq Ft:</span><span class="val">Walls: {{WALL_SQFT}} sq ft · Ceilings: {{CEILING_SQFT}} sq ft</span></div>
  <div class="row"><span class="lbl">Coats:</span><span class="val">{{COAT_COUNT}} coats on walls · {{CEILING_COATS}} coat(s) on ceilings</span></div>
  <div class="row"><span class="lbl">Sheen:</span><span class="val">Walls: {{WALL_SHEEN}} · Trim: {{TRIM_SHEEN}} · Ceiling: flat</span></div>
</div>
<div class="sec">
  <h3>Scope of Work</h3>
  <ul class="scope-list">
    <li>Move and cover furniture; protect floors with drop cloths</li>
    <li>Prep all surfaces: fill nail holes and dents, sand, clean, lightly sand existing paint</li>
    <li>Tape windows, doors, trim, and flooring at wall edges</li>
    <li>Apply one coat primer to all repaired areas and bare drywall</li>
    <li>Paint walls — {{COAT_COUNT}} coats of {{PAINT_BRAND}} {{PAINT_LINE}} ({{WALL_SHEEN}}), Color: {{WALL_COLOR}}</li>
    <li>Paint ceilings — {{CEILING_COATS}} coat(s) of ceiling-grade flat white/{{CEILING_COLOR}}</li>
    <li>Paint all baseboards, door casings, and window sills — Color: {{TRIM_COLOR}} ({{TRIM_SHEEN}})</li>
    <li>Paint all interior doors — {{DOOR_COUNT}} doors, Color: {{DOOR_COLOR}}</li>
    <li>Touch-up and clean up; remove all tape and coverings</li>
    <li>Final walk-through with customer; address any touch-ups</li>
  </ul>
</div>
<div class="sec">
  <h3>Cost Breakdown</h3>
  <table>
    <thead><tr><th>Description</th><th style="width:100px">Qty / Unit</th><th style="width:105px">Unit Price</th><th style="width:105px">Total</th></tr></thead>
    <tbody>
      <tr><td>Prep work (patch, sand, caulk, tape)</td><td>{{ROOM_COUNT}} rooms</td><td>{{PREP_RATE}}</td><td>{{PREP_TOTAL}}</td></tr>
      <tr><td>Walls — {{COAT_COUNT}} coats ({{WALL_SHEEN}}) — {{WALL_COLOR}}</td><td>{{WALL_SQFT}} sq ft</td><td>{{WALL_RATE}}</td><td>{{WALL_TOTAL}}</td></tr>
      <tr><td>Ceilings — {{CEILING_COATS}} coat(s) — {{CEILING_COLOR}}</td><td>{{CEILING_SQFT}} sq ft</td><td>{{CEILING_RATE}}</td><td>{{CEILING_TOTAL}}</td></tr>
      <tr><td>Baseboards &amp; door casings — {{TRIM_COLOR}}</td><td>{{TRIM_LF}} LF</td><td>{{TRIM_RATE}}</td><td>{{TRIM_TOTAL}}</td></tr>
      <tr><td>Interior doors — {{DOOR_COLOR}}</td><td>{{DOOR_COUNT}} doors</td><td>{{DOOR_RATE}}</td><td>{{DOOR_TOTAL}}</td></tr>
      <tr><td>Paint, primer, and supplies</td><td>{{PAINT_GALLONS}} gal.</td><td>{{PAINT_COST_GAL}}</td><td>{{PAINT_MATERIAL_TOTAL}}</td></tr>
      <tr><td>Cleanup &amp; final touch-up</td><td>Lot</td><td>—</td><td>{{CLEANUP_TOTAL}}</td></tr>
    </tbody>
  </table>
  ${totalsBlock}
</div>
${termsBlock}
${footer}`,
      variables: ['COMPANY_NAME','COMPANY_TAGLINE','REP_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','ESTIMATE_NUMBER','ESTIMATE_DATE','ESTIMATE_EXPIRY','START_DATE','ESTIMATED_DURATION','PAINT_BRAND','PAINT_LINE','WALL_COLOR','TRIM_COLOR','CEILING_COLOR','DOOR_COLOR','WALL_SHEEN','TRIM_SHEEN','COAT_COUNT','CEILING_COATS','ROOM_LIST','ROOM_COUNT','WALL_SQFT','CEILING_SQFT','DOOR_COUNT','TOTAL_AMOUNT','DEPOSIT_AMOUNT','BALANCE_DUE','SUBTOTAL','TAX_RATE','TAX_AMOUNT','WARRANTY_PERIOD','PAYMENT_TERMS'],
      favorite: false, isDefault: false, tags: ['painting','interior','residential'],
      createdAt: '2026-03-08', lastModified: '2026-03-08', usageCount: 0, fileType: 'html'
    },
  ];
}

// ─── Variable Fill Utilities ───────────────────────────────────────────────

/** Replace {{KEY}} placeholders in template content */
export function fillTemplateVars(content: string, overrides: Record<string, string>): string {
  let result = content;
  for (const [key, val] of Object.entries(overrides)) {
    if (val) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
    }
  }
  return result;
}

/** Build a variable overrides map from a CRM contact + company + user profile */
export function buildContactOverrides(
  contact: {
    firstName?: string; lastName?: string;
    phone1?: string; email?: string;
    address?: string; city?: string; state?: string; zip?: string;
    [key: string]: unknown;
  },
  company: {
    name?: string; tagline?: string; address?: string; city?: string;
    state?: string; zip?: string; phone?: string; email?: string;
    contractor_license?: string; logo_url?: string;
    [key: string]: unknown;
  } | null,
  user: { first_name?: string; last_name?: string; [key: string]: unknown } | null
): Record<string, string> {
  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || '';
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return {
    CUSTOMER_NAME: fullName,
    CLIENT_NAME: fullName,
    CUSTOMER_PHONE: (contact.phone1 as string) || '',
    CUSTOMER_EMAIL: (contact.email as string) || '',
    PROPERTY_ADDRESS: (contact.address as string) || '',
    PROPERTY_CITY: (contact.city as string) || '',
    PROPERTY_STATE: (contact.state as string) || '',
    PROPERTY_ZIP: (contact.zip as string) || '',
    PROJECT_ADDRESS: [contact.address, contact.city, contact.state, contact.zip].filter(Boolean).join(', '),
    INSURANCE_COMPANY: (contact.insurance_company as string) || '',
    POLICY_NUMBER: (contact.policy_number as string) || '',
    CLAIM_NUMBER: (contact.claim_number as string) || '',
    COMPANY_NAME: company?.name || '',
    COMPANY_TAGLINE: (company?.tagline as string) || 'Professional Contractor Services',
    COMPANY_ADDRESS: (company?.address as string) || '',
    COMPANY_CITY: (company?.city as string) || '',
    COMPANY_STATE: (company?.state as string) || '',
    COMPANY_ZIP: (company?.zip as string) || '',
    COMPANY_PHONE: (company?.phone as string) || '',
    COMPANY_EMAIL: (company?.email as string) || '',
    CONTRACTOR_LICENSE: (company?.contractor_license as string) || '',
    COMPANY_LOGO: company?.logo_url
      ? `<img src="${company.logo_url as string}" alt="Logo" style="max-height:70px;max-width:180px;object-fit:contain;" />`
      : '<span style="font-size:11px;color:#9ca3af">[Add logo in Settings → Company Profile]</span>',
    REP_NAME: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '',
    ESTIMATE_DATE: today,
    CURRENT_DATE: today,
    ESTIMATE_EXPIRY: expiry,
    PAYMENT_TERMS: '50% deposit at contract signing; balance due upon completion',
    WARRANTY_PERIOD: '2 years',
    TAX_RATE: '0',
    TAX_AMOUNT: '$0.00',
  };
}

/** Detect remaining unfilled {{VARIABLE}} placeholders in content */
export function getUnfilledVars(content: string): string[] {
  const matches = content.match(/\{\{([A-Z0-9_]+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
}

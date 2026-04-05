// Contractor Document Templates — Two-tier system:
// 1. LEGAL DOCUMENTS: Standalone forms (Contingency, 3-Day Cancel, etc.)
// 2. CUSTOMER SERVICE AGREEMENTS: Contract templates with project-specific line items

export interface DocumentField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number';
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}

export interface LineItemDefault {
  description: string;
  qty: string;       // e.g. "24", "" for Lot items
  unit: string;      // e.g. "sq", "LF", "sheets", ""
  unitPrice: number; // dollar amount, 0 = manual total
  total: number;     // default total (used when qty is empty/Lot)
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'legal' | 'contract' | 'work-order' | 'safety';
  templateType: 'legal-document' | 'customer-service-agreement';
  content: string;
  variables: string[];
  fields?: DocumentField[];
  lineItemDefaults?: LineItemDefault[];
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
  .sig{flex:1}
  .sig-field{margin-bottom:10px}
  .sig-field-label{font-size:10px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px}
  .sig-line{border-bottom:1.5px solid #374151;height:28px;margin-bottom:2px}
  .sig-lbl{font-size:11px;color:#6b7280;font-weight:700;text-align:center;margin-top:6px;padding-top:6px;border-top:2px solid #374151}
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
  <div class="sig">
    <div class="sig-field"><div class="sig-field-label">Print Name</div><div class="sig-line"></div></div>
    <div class="sig-field"><div class="sig-field-label">Signature</div><div class="sig-line"></div></div>
    <div class="sig-field"><div class="sig-field-label">Date</div><div class="sig-line"></div></div>
    <div class="sig-lbl">Customer / Property Owner</div>
  </div>
  <div class="sig">
    <div class="sig-field"><div class="sig-field-label">Print Name</div><div class="sig-line"></div></div>
    <div class="sig-field"><div class="sig-field-label">Signature</div><div class="sig-line"></div></div>
    <div class="sig-field"><div class="sig-field-label">Date</div><div class="sig-line"></div></div>
    <div class="sig-lbl">Authorized Contractor</div>
  </div>
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
  {{TERMS_CONTENT}}
</div>`;

/** Header for contract documents (uses CONTRACT_NUMBER / CONTRACT_DATE instead of estimate fields) */
const contractHeader = (titleText: string) => `<!DOCTYPE html>
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
    <h4>Customer / Property Owner</h4>
    <div class="row"><span class="lbl">Name:</span><span class="val">{{CUSTOMER_NAME}}</span></div>
    <div class="row"><span class="lbl">Phone:</span><span class="val">{{CUSTOMER_PHONE}}</span></div>
    <div class="row"><span class="lbl">Email:</span><span class="val">{{CUSTOMER_EMAIL}}</span></div>
    <div class="row"><span class="lbl">Property:</span><span class="val">{{PROPERTY_ADDRESS}}</span></div>
    <div class="row"><span class="lbl"></span><span class="val">{{PROPERTY_CITY}}, {{PROPERTY_STATE}} {{PROPERTY_ZIP}}</span></div>
  </div>
  <div class="box">
    <h4>Contract Details</h4>
    <div class="row"><span class="lbl">Contract #:</span><span class="val">{{CONTRACT_NUMBER}}</span></div>
    <div class="row"><span class="lbl">Date:</span><span class="val">{{CONTRACT_DATE}}</span></div>
    <div class="row"><span class="lbl">Start Date:</span><span class="val">{{START_DATE}}</span></div>
    <div class="row"><span class="lbl">Est. Completion:</span><span class="val">{{ESTIMATED_COMPLETION}}</span></div>
    <div class="row"><span class="lbl">Project Mgr:</span><span class="val">{{REP_NAME}}</span></div>
  </div>
</div>`;

const contractTermsBlock = `<div class="terms">
  <strong>Terms &amp; Conditions:</strong><br>
  {{TERMS_CONTENT}}
</div>`;

// ─── Template Definitions ──────────────────────────────────────────────────

export function getContractorEstimateTemplates(): DocumentTemplate[] {
  return [
    // ═══════════════════════════════════════════════════════════════════════
    // LEGAL DOCUMENTS (Standalone forms - no line items)
    // ═══════════════════════════════════════════════════════════════════════

    // ── CONTINGENCY AGREEMENT ─────────────────────────────────────────────
    {
      id: 'legal-001',
      name: 'Contingency Agreement',
      description: 'Insurance restoration contingency agreement - contractor assists with claim, paid from insurance proceeds',
      category: 'legal',
      templateType: 'legal-document',
      content: contractHeader('Contingency Agreement') + `
<div class="sec">
  <h3>Agreement Terms</h3>
  <p style="font-size:13px;line-height:1.9;color:#374151">
    This Contingency Agreement ("Agreement") is entered into between <strong>{{CUSTOMER_NAME}}</strong> ("Property Owner") and <strong>{{COMPANY_NAME}}</strong> ("Contractor") for property located at <strong>{{PROPERTY_ADDRESS}}, {{PROPERTY_CITY}}, {{PROPERTY_STATE}} {{PROPERTY_ZIP}}</strong>.
  </p>
</div>
<div class="sec">
  <h3>Scope of Services</h3>
  <p style="font-size:13px;line-height:1.9;color:#374151">
    Contractor agrees to provide the following services on a contingency basis:
  </p>
  <ul class="scope-list">
    <li>Inspect property damage and document all loss-related items</li>
    <li>Prepare detailed scope of work and cost estimate</li>
    <li>Communicate with insurance carrier and adjuster on Property Owner's behalf</li>
    <li>Identify and document any additional damage or omissions from initial insurance estimate</li>
    <li>Prepare and submit supplement requests as needed</li>
    <li>Perform all approved restoration work per insurance scope and supplements</li>
  </ul>
</div>
<div class="sec">
  <h3>Payment Terms</h3>
  <p style="font-size:13px;line-height:1.9;color:#374151">
    <strong>Contingency Basis:</strong> Contractor's compensation is contingent upon approval and payment by Property Owner's insurance carrier. Property Owner is responsible only for their insurance deductible of <strong>{{DEDUCTIBLE_AMOUNT}}</strong>. All other costs will be paid from insurance proceeds.<br><br>
    <strong>Insurance Assignment:</strong> Property Owner authorizes insurance carrier to issue all claim-related payments as dual-party checks payable to both Property Owner and Contractor. Property Owner agrees to endorse all insurance checks promptly upon receipt.<br><br>
    <strong>Deductible Payment:</strong> Property Owner's deductible is due prior to commencement of work.
  </p>
</div>
${contractTermsBlock}
${footer}`,
      variables: ['COMPANY_NAME','COMPANY_TAGLINE','REP_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','CONTRACT_NUMBER','CONTRACT_DATE','START_DATE','ESTIMATED_COMPLETION','DEDUCTIBLE_AMOUNT','WARRANTY_PERIOD','PAYMENT_TERMS'],
      favorite: true, isDefault: false, tags: ['legal','contingency','insurance'],
      createdAt: '2026-03-08', lastModified: '2026-03-08', usageCount: 0, fileType: 'html'
    },

    // ── 3-DAY RIGHT TO CANCEL ─────────────────────────────────────────────
    {
      id: 'legal-002',
      name: '3-Day Right to Cancel',
      description: 'Federal 3-day right to cancel notice for home solicitation sales',
      category: 'legal',
      templateType: 'legal-document',
      content: contractHeader('Notice of Right to Cancel') + `
<div class="alert-box">
  <h3>YOUR RIGHT TO CANCEL</h3>
  <p>You are entering into a transaction that will result in a lien, mortgage, or other security interest in your home. You have a legal right under federal law to cancel this transaction, without cost, within three business days from whichever of the following events occurs last:</p>
  <ul style="margin:8px 0 8px 20px;font-size:13px">
    <li>The date of the transaction, which is <strong>{{CONTRACT_DATE}}</strong>; or</li>
    <li>The date you received your Truth in Lending disclosures; or</li>
    <li>The date you received this notice of your right to cancel.</li>
  </ul>
</div>
<div class="sec">
  <h3>How to Cancel</h3>
  <p style="font-size:13px;line-height:1.9;color:#374151">
    If you decide to cancel this transaction, you may do so by notifying <strong>{{COMPANY_NAME}}</strong> in writing at:<br><br>
    <strong>{{COMPANY_NAME}}</strong><br>
    {{COMPANY_ADDRESS}}<br>
    {{COMPANY_CITY}}, {{COMPANY_STATE}} {{COMPANY_ZIP}}<br>
    Phone: {{COMPANY_PHONE}}<br>
    Email: {{COMPANY_EMAIL}}<br><br>
    You may use any written statement that is signed and dated by you and states your intention to cancel, or you may use the cancellation form on the back of this notice.<br><br>
    <strong>Cancellation Deadline:</strong> {{CANCELLATION_DEADLINE}}
  </p>
</div>
<div class="sec">
  <h3>Effects of Cancellation</h3>
  <p style="font-size:13px;line-height:1.9;color:#374151">
    When you cancel this transaction, any lien, mortgage, or other security interest in your home arising from this transaction becomes void. You are also entitled to a refund of any down payment or other consideration if you cancel. Within 20 calendar days after we receive your notice of cancellation, we must return any money or property you have given to us.<br><br>
    You may keep any money or property we have given you until we have done the things mentioned above, but you must then offer to return the money or property. If we do not claim the money or property within 20 calendar days after your offer to return it, you may keep it without further obligation.
  </p>
</div>
${footer}`,
      variables: ['COMPANY_NAME','COMPANY_TAGLINE','REP_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','CONTRACT_NUMBER','CONTRACT_DATE','CANCELLATION_DEADLINE'],
      favorite: true, isDefault: false, tags: ['legal','cancellation','federal-law'],
      createdAt: '2026-03-08', lastModified: '2026-03-08', usageCount: 0, fileType: 'html'
    },

    // ── CERTIFICATE OF COMPLETION ─────────────────────────────────────────
    {
      id: 'legal-003',
      name: 'Certificate of Completion',
      description: 'Certificate of substantial completion for construction projects',
      category: 'legal',
      templateType: 'legal-document',
      content: contractHeader('Certificate of Completion') + `
<div class="sec">
  <h3>Project Information</h3>
  <div class="row"><span class="lbl">Contract #:</span><span class="val">{{CONTRACT_NUMBER}}</span></div>
  <div class="row"><span class="lbl">Original Contract Date:</span><span class="val">{{CONTRACT_DATE}}</span></div>
  <div class="row"><span class="lbl">Work Commenced:</span><span class="val">{{START_DATE}}</span></div>
  <div class="row"><span class="lbl">Substantial Completion:</span><span class="val">{{COMPLETION_DATE}}</span></div>
  <div class="row"><span class="lbl">Final Inspection:</span><span class="val">{{INSPECTION_DATE}}</span></div>
</div>
<div class="sec">
  <h3>Certification</h3>
  <p style="font-size:13px;line-height:1.9;color:#374151">
    <strong>{{COMPANY_NAME}}</strong> hereby certifies that all work described in Contract #{{CONTRACT_NUMBER}} has been completed in accordance with the contract documents, applicable building codes, and manufacturer specifications.<br><br>
    The following work has been completed:
  </p>
  <div style="background:#f8fafc;padding:12px 14px;border-radius:6px;font-size:13px;line-height:1.9;color:#374151;margin:12px 0">
    {{WORK_COMPLETED}}
  </div>
  <p style="font-size:13px;line-height:1.9;color:#374151">
    All required inspections have been completed and approved. All permits have been closed. The property is ready for occupancy and use.
  </p>
</div>
<div class="sec">
  <h3>Warranty Information</h3>
  <div class="row"><span class="lbl">Workmanship Warranty:</span><span class="val">{{WARRANTY_PERIOD}} from completion date</span></div>
  <div class="row"><span class="lbl">Warranty Start Date:</span><span class="val">{{COMPLETION_DATE}}</span></div>
  <div class="row"><span class="lbl">Warranty Expiration:</span><span class="val">{{WARRANTY_EXPIRATION}}</span></div>
</div>
${footer}`,
      variables: ['COMPANY_NAME','COMPANY_TAGLINE','REP_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','CONTRACT_NUMBER','CONTRACT_DATE','START_DATE','COMPLETION_DATE','INSPECTION_DATE','WORK_COMPLETED','WARRANTY_PERIOD','WARRANTY_EXPIRATION'],
      favorite: true, isDefault: false, tags: ['legal','completion','certificate'],
      createdAt: '2026-03-08', lastModified: '2026-03-08', usageCount: 0, fileType: 'html'
    },

    // ── CHANGE ORDER ──────────────────────────────────────────────────────
    {
      id: 'legal-004',
      name: 'Change Order',
      description: 'Change order form for modifications to existing contracts',
      category: 'legal',
      templateType: 'legal-document',
      content: contractHeader('Change Order') + `
<div class="sec">
  <h3>Original Contract Information</h3>
  <div class="row"><span class="lbl">Original Contract #:</span><span class="val">{{CONTRACT_NUMBER}}</span></div>
  <div class="row"><span class="lbl">Contract Date:</span><span class="val">{{CONTRACT_DATE}}</span></div>
  <div class="row"><span class="lbl">Original Contract Amount:</span><span class="val">{{ORIGINAL_CONTRACT_AMOUNT}}</span></div>
  <div class="row"><span class="lbl">Change Order #:</span><span class="val">{{CHANGE_ORDER_NUMBER}}</span></div>
  <div class="row"><span class="lbl">Change Order Date:</span><span class="val">{{CHANGE_ORDER_DATE}}</span></div>
</div>
<div class="sec">
  <h3>Description of Changes</h3>
  <div style="background:#f8fafc;padding:12px 14px;border-radius:6px;font-size:13px;line-height:1.9;color:#374151">
    {{CHANGE_DESCRIPTION}}
  </div>
</div>
<div class="sec">
  <h3>Cost Impact</h3>
  <table>
    <thead><tr><th>Description</th><th style="width:110px">Amount</th></tr></thead>
    <tbody>
      <tr><td>Original Contract Amount</td><td>{{ORIGINAL_CONTRACT_AMOUNT}}</td></tr>
      <tr><td>Previous Change Orders</td><td>{{PREVIOUS_CHANGE_ORDERS}}</td></tr>
      <tr><td><strong>This Change Order</strong></td><td><strong>{{CHANGE_ORDER_AMOUNT}}</strong></td></tr>
      <tr style="background:#f3f4f6;font-weight:700"><td>New Contract Amount</td><td>{{NEW_CONTRACT_AMOUNT}}</td></tr>
    </tbody>
  </table>
</div>
<div class="sec">
  <h3>Schedule Impact</h3>
  <div class="row"><span class="lbl">Original Completion Date:</span><span class="val">{{ORIGINAL_COMPLETION_DATE}}</span></div>
  <div class="row"><span class="lbl">Time Extension:</span><span class="val">{{TIME_EXTENSION}}</span></div>
  <div class="row"><span class="lbl">New Completion Date:</span><span class="val">{{NEW_COMPLETION_DATE}}</span></div>
</div>
${footer}`,
      variables: ['COMPANY_NAME','COMPANY_TAGLINE','REP_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','CONTRACT_NUMBER','CONTRACT_DATE','ORIGINAL_CONTRACT_AMOUNT','CHANGE_ORDER_NUMBER','CHANGE_ORDER_DATE','CHANGE_DESCRIPTION','PREVIOUS_CHANGE_ORDERS','CHANGE_ORDER_AMOUNT','NEW_CONTRACT_AMOUNT','ORIGINAL_COMPLETION_DATE','TIME_EXTENSION','NEW_COMPLETION_DATE'],
      favorite: true, isDefault: false, tags: ['legal','change-order','modification'],
      createdAt: '2026-03-08', lastModified: '2026-03-08', usageCount: 0, fileType: 'html'
    },

    // ── WORK ORDER ────────────────────────────────────────────────────────
    {
      id: 'legal-005',
      name: 'Work Order',
      description: 'Field work order for crew assignments and daily tasks',
      category: 'work-order',
      templateType: 'legal-document',
      content: contractHeader('Work Order') + `
<div class="sec">
  <h3>Work Order Details</h3>
  <div class="row"><span class="lbl">Work Order #:</span><span class="val">{{WORK_ORDER_NUMBER}}</span></div>
  <div class="row"><span class="lbl">Date Issued:</span><span class="val">{{WORK_ORDER_DATE}}</span></div>
  <div class="row"><span class="lbl">Scheduled Date:</span><span class="val">{{SCHEDULED_DATE}}</span></div>
  <div class="row"><span class="lbl">Priority:</span><span class="val">{{PRIORITY}}</span></div>
  <div class="row"><span class="lbl">Crew Lead:</span><span class="val">{{CREW_LEAD}}</span></div>
  <div class="row"><span class="lbl">Crew Members:</span><span class="val">{{CREW_MEMBERS}}</span></div>
</div>
<div class="sec">
  <h3>Work to be Performed</h3>
  <div style="background:#f8fafc;padding:12px 14px;border-radius:6px;font-size:13px;line-height:1.9;color:#374151">
    {{WORK_DESCRIPTION}}
  </div>
</div>
<div class="sec">
  <h3>Materials & Equipment</h3>
  <div style="background:#f8fafc;padding:12px 14px;border-radius:6px;font-size:13px;line-height:1.9;color:#374151">
    {{MATERIALS_NEEDED}}
  </div>
</div>
<div class="sec">
  <h3>Special Instructions</h3>
  <div style="background:#fef3c7;padding:12px 14px;border-radius:6px;font-size:13px;line-height:1.9;color:#374151;border-left:4px solid #f59e0b">
    {{SPECIAL_INSTRUCTIONS}}
  </div>
</div>
${footer}`,
      variables: ['COMPANY_NAME','COMPANY_TAGLINE','REP_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','WORK_ORDER_NUMBER','WORK_ORDER_DATE','SCHEDULED_DATE','PRIORITY','CREW_LEAD','CREW_MEMBERS','WORK_DESCRIPTION','MATERIALS_NEEDED','SPECIAL_INSTRUCTIONS'],
      favorite: true, isDefault: false, tags: ['work-order','crew','field'],
      createdAt: '2026-03-08', lastModified: '2026-03-08', usageCount: 0, fileType: 'html'
    },

    // ── WARRANTY ──────────────────────────────────────────────────────────
    {
      id: 'legal-006',
      name: 'Warranty Certificate',
      description: 'Workmanship warranty certificate for completed projects',
      category: 'legal',
      templateType: 'legal-document',
      content: contractHeader('Warranty Certificate') + `
<div class="sec">
  <h3>Warranty Coverage</h3>
  <div class="row"><span class="lbl">Contract #:</span><span class="val">{{CONTRACT_NUMBER}}</span></div>
  <div class="row"><span class="lbl">Completion Date:</span><span class="val">{{COMPLETION_DATE}}</span></div>
  <div class="row"><span class="lbl">Warranty Period:</span><span class="val">{{WARRANTY_PERIOD}}</span></div>
  <div class="row"><span class="lbl">Warranty Expiration:</span><span class="val">{{WARRANTY_EXPIRATION}}</span></div>
</div>
<div class="sec">
  <h3>Work Covered</h3>
  <div style="background:#f8fafc;padding:12px 14px;border-radius:6px;font-size:13px;line-height:1.9;color:#374151">
    {{WORK_COVERED}}
  </div>
</div>
<div class="sec">
  <h3>Warranty Terms</h3>
  <p style="font-size:13px;line-height:1.9;color:#374151">
    <strong>{{COMPANY_NAME}}</strong> warrants that all work performed under Contract #{{CONTRACT_NUMBER}} is free from defects in workmanship for a period of <strong>{{WARRANTY_PERIOD}}</strong> from the completion date.<br><br>
    <strong>What is Covered:</strong> Defects in workmanship, installation errors, and failures resulting from improper installation by {{COMPANY_NAME}}.<br><br>
    <strong>What is NOT Covered:</strong> Normal wear and tear, damage from improper maintenance, damage from acts of God, damage from third parties, modifications by others, and manufacturer defects (covered under separate manufacturer warranties).<br><br>
    <strong>How to Make a Claim:</strong> Contact {{COMPANY_NAME}} at {{COMPANY_PHONE}} or {{COMPANY_EMAIL}}. We will inspect the issue and repair any warranted defects at no charge.
  </p>
</div>
${footer}`,
      variables: ['COMPANY_NAME','COMPANY_TAGLINE','REP_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','CONTRACT_NUMBER','COMPLETION_DATE','WARRANTY_PERIOD','WARRANTY_EXPIRATION','WORK_COVERED'],
      favorite: true, isDefault: false, tags: ['legal','warranty','guarantee'],
      createdAt: '2026-03-08', lastModified: '2026-03-08', usageCount: 0, fileType: 'html'
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CUSTOMER SERVICE AGREEMENTS (Contracts with project-specific line items)
    // ═══════════════════════════════════════════════════════════════════════

    // ── 1. Asphalt Shingle Roof Replacement ──────────────────────────────
    {
      id: 'ct-001',
      name: 'Customer Service Agreement - Asphalt Shingle Roof',
      description: 'Customer service agreement for asphalt shingle roof replacement with preloaded line items',
      category: 'contract',
      templateType: 'customer-service-agreement',
      fields: [
        { key: 'ESTIMATE_NUMBER', label: 'Estimate Number', type: 'text', defaultValue: 'EST-' + Date.now().toString().slice(-6), required: true },
        { key: 'START_DATE', label: 'Proposed Start Date', type: 'date', required: true },
        { key: 'ESTIMATED_DURATION', label: 'Estimated Duration', type: 'text', placeholder: '3-5 business days', required: true },
        
        // Project Specifications
        { key: 'SHINGLE_BRAND', label: 'Shingle Brand', type: 'text', placeholder: 'GAF, Owens Corning, CertainTeed...', required: true },
        { key: 'SHINGLE_STYLE', label: 'Shingle Style', type: 'text', placeholder: 'Timberline HDZ, Duration, Landmark...', required: true },
        { key: 'SHINGLE_COLOR', label: 'Shingle Color', type: 'text', placeholder: 'Charcoal, Weathered Wood...', required: true },
        { key: 'SHINGLE_WARRANTY_YEARS', label: 'Warranty (years)', type: 'number', defaultValue: '30', required: true },
        { key: 'ROOF_SQUARES', label: 'Roof Area (squares)', type: 'number', placeholder: '24', required: true },
        { key: 'ROOF_SQFT', label: 'Roof Area (sq ft)', type: 'number', placeholder: '2400', required: true },
        { key: 'ROOF_PITCH', label: 'Roof Pitch', type: 'text', placeholder: '6/12', required: true },
        { key: 'STORY_COUNT', label: 'Stories', type: 'text', placeholder: '2-story', required: true },
        { key: 'LAYER_COUNT', label: 'Layers to Remove', type: 'number', defaultValue: '1', required: true },
        
        // Cost Breakdown - Tear-off
        { key: 'TEAROFF_RATE', label: 'Tear-off Rate (per square)', type: 'text', defaultValue: '$85.00', required: true },
        { key: 'TEAROFF_TOTAL', label: 'Tear-off Total', type: 'text', defaultValue: '$2,040.00', required: true },
        
        // Decking
        { key: 'DECKING_SHEETS', label: 'Decking Sheets Needed', type: 'number', defaultValue: '3', required: true },
        { key: 'DECKING_RATE', label: 'Decking Rate (per sheet)', type: 'text', defaultValue: '$65.00', required: true },
        { key: 'DECKING_TOTAL', label: 'Decking Total', type: 'text', defaultValue: '$195.00', required: true },
        
        // Ice & Water Shield
        { key: 'ICE_WATER_SQ', label: 'Ice & Water Shield (rolls)', type: 'number', defaultValue: '1', required: true },
        { key: 'ICE_WATER_RATE', label: 'Ice & Water Rate (per roll)', type: 'text', defaultValue: '$105.00', required: true },
        { key: 'ICE_WATER_TOTAL', label: 'Ice & Water Total', type: 'text', defaultValue: '$105.00', required: true },

        // Underlayment (1 roll per 10 sq; default 24-sq roof = 3 rolls)
        { key: 'UNDERLAY_SQ', label: 'Underlayment (rolls)', type: 'number', defaultValue: '3', required: true },
        { key: 'UNDERLAY_RATE', label: 'Underlayment Rate (per roll)', type: 'text', defaultValue: '$80.00', required: true },
        { key: 'UNDERLAY_TOTAL', label: 'Underlayment Total', type: 'text', defaultValue: '$240.00', required: true },
        
        // Drip Edge
        { key: 'DRIP_EDGE_LF', label: 'Drip Edge (linear feet)', type: 'number', defaultValue: '310', required: true },
        { key: 'DRIP_EDGE_RATE', label: 'Drip Edge Rate (per LF)', type: 'text', defaultValue: '$4.50', required: true },
        { key: 'DRIP_EDGE_TOTAL', label: 'Drip Edge Total', type: 'text', defaultValue: '$1,395.00', required: true },
        
        // Shingles
        { key: 'SHINGLE_RATE', label: 'Shingle Rate (per square)', type: 'text', defaultValue: '$195.00', required: true },
        { key: 'SHINGLE_TOTAL', label: 'Shingle Total', type: 'text', defaultValue: '$4,680.00', required: true },
        
        // Ridge Cap
        { key: 'RIDGE_LF', label: 'Ridge Cap (linear feet)', type: 'number', defaultValue: '45', required: true },
        { key: 'RIDGE_RATE', label: 'Ridge Rate (per LF)', type: 'text', defaultValue: '$12.00', required: true },
        { key: 'RIDGE_TOTAL', label: 'Ridge Total', type: 'text', defaultValue: '$540.00', required: true },
        
        // Other Items
        { key: 'FLASHING_TOTAL', label: 'Flashings Total', type: 'text', defaultValue: '$450.00', required: true },
        { key: 'VENT_COUNT', label: 'Number of Vents', type: 'number', defaultValue: '2', required: true },
        { key: 'VENT_RATE', label: 'Vent Rate (each)', type: 'text', defaultValue: '$85.00', required: true },
        { key: 'VENT_TOTAL', label: 'Vents Total', type: 'text', defaultValue: '$170.00', required: true },
        { key: 'CLEANUP_TOTAL', label: 'Cleanup & Haul-away', type: 'text', defaultValue: '$350.00', required: true },
        
        // Totals
        { key: 'SUBTOTAL', label: 'Subtotal', type: 'text', defaultValue: '$10,976.00', required: true },
        { key: 'TAX_RATE', label: 'Tax Rate (%)', type: 'text', defaultValue: '7.5', required: true },
        { key: 'TAX_AMOUNT', label: 'Tax Amount', type: 'text', defaultValue: '$823.20', required: true },
        { key: 'TOTAL_AMOUNT', label: 'Total Amount', type: 'text', defaultValue: '$11,799.20', required: true },
        { key: 'DEPOSIT_AMOUNT', label: 'Deposit Required', type: 'text', defaultValue: '$5,899.60', required: true },
        { key: 'BALANCE_DUE', label: 'Balance Due at Completion', type: 'text', defaultValue: '$5,899.60', required: true },
        
        // Terms
        { key: 'WARRANTY_PERIOD', label: 'Warranty Period', type: 'text', defaultValue: '2 years', required: true },
        { key: 'PAYMENT_TERMS', label: 'Payment Terms', type: 'text', defaultValue: '50% deposit at contract signing; balance due upon completion', required: true },
      ],
      lineItemDefaults: [
        { description: 'Tear-off & disposal (1 layer)', qty: '24', unit: 'sq', unitPrice: 85, total: 2040 },
        { description: 'Decking repair / replacement (4×8 sheets)', qty: '3', unit: 'sheets', unitPrice: 65, total: 195 },
        { description: 'Ice & water shield (GAF WeatherWatch)', qty: '1', unit: 'rolls', unitPrice: 105, total: 105 },
        { description: 'Synthetic underlayment', qty: '3', unit: 'rolls', unitPrice: 80, total: 240 },
        { description: 'Drip edge (aluminum)', qty: '310', unit: 'LF', unitPrice: 4.5, total: 1395 },
        { description: 'Shingles', qty: '24', unit: 'sq', unitPrice: 195, total: 4680 },
        { description: 'Ridge cap shingles', qty: '45', unit: 'LF', unitPrice: 12, total: 540 },
        { description: 'Flashings (step, counter, pipe boots)', qty: '1', unit: 'Kit', unitPrice: 450, total: 450 },
        { description: 'Ridge vent / ventilation', qty: '2', unit: 'units', unitPrice: 85, total: 170 },
        { description: 'Cleanup & haul-away', qty: '1', unit: 'Units', unitPrice: 350, total: 350 },
      ],
      content: contractHeader('Customer Service Agreement - Asphalt Shingle Roof Replacement') + `
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

    {
      id: 'ct-002',
      name: 'Customer Service Agreement - Corrugated Metal Roof',
      description: 'Customer service agreement for corrugated metal roof with preloaded line items',
      category: 'contract',
      templateType: 'customer-service-agreement',
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
      lineItemDefaults: [
        { description: 'Tear-off & disposal', qty: '24', unit: 'sq', unitPrice: 75, total: 1800 },
        { description: 'Decking repair / replacement', qty: '2', unit: 'sheets', unitPrice: 65, total: 130 },
        { description: 'Underlayment', qty: '24', unit: 'sq', unitPrice: 22, total: 528 },
        { description: 'Corrugated metal panels', qty: '24', unit: 'sq', unitPrice: 285, total: 6840 },
        { description: 'Ridge cap & hip cap', qty: '45', unit: 'LF', unitPrice: 18, total: 810 },
        { description: 'Eave & rake trim, flashings', qty: '310', unit: 'LF', unitPrice: 6.5, total: 2015 },
        { description: 'Fasteners, butyl tape, sealant', qty: '', unit: 'Lot', unitPrice: 0, total: 450 },
        { description: 'Cleanup & haul-away', qty: '', unit: 'Lot', unitPrice: 0, total: 350 },
      ],
      content: contractHeader('Customer Service Agreement - Corrugated Metal Roof') + `
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

    {
      id: 'ct-003',
      name: 'Customer Service Agreement - Standing Seam Metal Roof',
      description: 'Customer service agreement for standing seam metal roof with preloaded line items',
      category: 'contract',
      templateType: 'customer-service-agreement',
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
      lineItemDefaults: [
        { description: 'Tear-off & disposal', qty: '24', unit: 'sq', unitPrice: 75, total: 1800 },
        { description: 'Decking repair / replacement', qty: '2', unit: 'sheets', unitPrice: 65, total: 130 },
        { description: 'High-temp peel & stick underlayment', qty: '24', unit: 'sq', unitPrice: 45, total: 1080 },
        { description: 'Standing seam panels', qty: '24', unit: 'sq', unitPrice: 425, total: 10200 },
        { description: 'Concealed clip system', qty: '24', unit: 'sq', unitPrice: 35, total: 840 },
        { description: 'Ridge, hip & rake trim', qty: '310', unit: 'LF', unitPrice: 12, total: 3720 },
        { description: 'Eave cleat / starter strip', qty: '120', unit: 'LF', unitPrice: 8, total: 960 },
        { description: 'Flashings & penetration boots', qty: '', unit: 'Lot', unitPrice: 0, total: 650 },
        { description: 'Snow guards (if applicable)', qty: '0', unit: 'sets', unitPrice: 125, total: 0 },
        { description: 'Cleanup & haul-away', qty: '', unit: 'Lot', unitPrice: 0, total: 400 },
      ],
      content: contractHeader('Customer Service Agreement - Standing Seam Metal Roof') + `
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

    {
      id: 'ct-004',
      name: 'Customer Service Agreement - Vinyl Siding',
      description: 'Customer service agreement for vinyl siding installation with preloaded line items',
      category: 'contract',
      templateType: 'customer-service-agreement',
      content: contractHeader('Customer Service Agreement - Vinyl Siding Installation') + `
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

    {
      id: 'ct-005',
      name: 'Customer Service Agreement - Aluminum Siding',
      description: 'Customer service agreement for aluminum siding installation with preloaded line items',
      category: 'contract',
      templateType: 'customer-service-agreement',
      content: contractHeader('Customer Service Agreement - Aluminum Siding Installation') + `
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

    {
      id: 'ct-006',
      name: 'Customer Service Agreement - Gutters & Downspouts',
      description: 'Customer service agreement for gutter system installation with preloaded line items',
      category: 'contract',
      templateType: 'customer-service-agreement',
      content: contractHeader('Customer Service Agreement - Gutters & Downspouts') + `
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

    {
      id: 'ct-007',
      name: 'Customer Service Agreement - Interior Drywall',
      description: 'Customer service agreement for drywall repair/replacement with preloaded line items',
      category: 'contract',
      templateType: 'customer-service-agreement',
      content: contractHeader('Customer Service Agreement - Interior Drywall') + `
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

    {
      id: 'ct-008',
      name: 'Customer Service Agreement - Interior Paint',
      description: 'Customer service agreement for interior painting with preloaded line items',
      category: 'contract',
      templateType: 'customer-service-agreement',
      content: contractHeader('Customer Service Agreement - Interior Painting') + `
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

    // ── 9. EPA Lead Safe Disclosure & Authorization ───────────────────────
    {
      id: 'ct-009',
      name: 'EPA Lead Safe Disclosure & Authorization',
      description: 'Pre-renovation lead disclosure form per EPA RRP Rule (40 CFR Part 745) for homes built before 1978',
      category: 'safety',
      content: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Lead Safe Disclosure</title><style>${CSS}
  .alert-box{background:#fef2f2;border:2px solid #dc2626;border-radius:8px;padding:14px 18px;margin:16px 0;font-size:13px;color:#7f1d1d}
  .alert-box h3{color:#dc2626;font-size:14px;font-weight:700;margin-bottom:6px}
  .check-row{display:flex;align-items:flex-start;gap:10px;margin:8px 0;font-size:13px}
  .check-box{width:16px;height:16px;border:2px solid #374151;border-radius:3px;flex-shrink:0;margin-top:1px}
  .initials-field{display:inline-block;border-bottom:1px solid #374151;min-width:80px;height:20px;margin:0 6px;vertical-align:bottom}
  .cert-block{background:#f0fdf4;border:1px solid #a7f3d0;border-radius:8px;padding:14px 18px;margin:16px 0;font-size:13px}
  .cert-block h3{color:#065f46;font-size:14px;font-weight:700;margin-bottom:8px}
</style></head><body>
<div class="hdr">
  <div class="hdr-left">
    <div class="co-name">{{COMPANY_NAME}}</div>
    <div class="co-tag">{{COMPANY_TAGLINE}}</div>
    <div class="co-info">
      <strong>{{REP_NAME}}</strong><br>
      {{COMPANY_ADDRESS}}, {{COMPANY_CITY}}, {{COMPANY_STATE}} {{COMPANY_ZIP}}<br>
      {{COMPANY_PHONE}} &nbsp;·&nbsp; {{COMPANY_EMAIL}}<br>
      License: {{CONTRACTOR_LICENSE}} &nbsp;·&nbsp; EPA RRP Cert: <strong>{{EPA_RRP_CERT}}</strong>
    </div>
  </div>
  <div>{{COMPANY_LOGO}}</div>
</div>
<div class="doc-title">EPA LEAD SAFE DISCLOSURE &amp; WORK AUTHORIZATION</div>
<div class="grid2">
  <div class="box">
    <h4>Property Owner</h4>
    <div class="row"><span class="lbl">Name:</span><span class="val">{{CUSTOMER_NAME}}</span></div>
    <div class="row"><span class="lbl">Phone:</span><span class="val">{{CUSTOMER_PHONE}}</span></div>
    <div class="row"><span class="lbl">Email:</span><span class="val">{{CUSTOMER_EMAIL}}</span></div>
    <div class="row"><span class="lbl">Property:</span><span class="val">{{PROPERTY_ADDRESS}}</span></div>
    <div class="row"><span class="lbl"></span><span class="val">{{PROPERTY_CITY}}, {{PROPERTY_STATE}} {{PROPERTY_ZIP}}</span></div>
  </div>
  <div class="box">
    <h4>Property &amp; Project</h4>
    <div class="row"><span class="lbl">Year Built:</span><span class="val">{{YEAR_BUILT}}</span></div>
    <div class="row"><span class="lbl">Lead Test:</span><span class="val">{{LEAD_TEST_STATUS}}</span></div>
    <div class="row"><span class="lbl">Disclosure Date:</span><span class="val">{{DISCLOSURE_DATE}}</span></div>
    <div class="row"><span class="lbl">Work Start Date:</span><span class="val">{{START_DATE}}</span></div>
    <div class="row"><span class="lbl">Scope:</span><span class="val">{{WORK_TYPE}}</span></div>
  </div>
</div>

<div class="alert-box">
  <h3>&#x26A0;&#xFE0F; IMPORTANT: This Property May Contain Lead-Based Paint</h3>
  <p>This property was built before 1978. Paint in older homes may contain lead. Lead from paint, paint chips, and dust can pose health hazards if not managed properly. Lead exposure is especially harmful to children under 6 years old. Before your contractor begins renovation work, Federal law requires contractors to provide you with the EPA pamphlet <em>"Renovate Right: Important Lead Hazard Information for Families, Child Care Facilities and Schools"</em> and obtain your acknowledgment of receipt.</p>
</div>

<div class="sec">
  <h3>Description of Renovation Work</h3>
  <div class="row"><span class="lbl">Work Description:</span><span class="val">{{WORK_DESCRIPTION}}</span></div>
  <div class="row"><span class="lbl">Location:</span><span class="val">{{WORK_LOCATION}}</span></div>
  <div class="row"><span class="lbl">Area Affected:</span><span class="val">{{AFFECTED_AREA}}</span></div>
</div>

<div class="sec">
  <h3>Lead-Safe Work Practices — {{COMPANY_NAME}} Certification</h3>
  <p style="font-size:13px;color:#374151;margin-bottom:10px">{{COMPANY_NAME}} (EPA Firm Cert: <strong>{{EPA_FIRM_CERT}}</strong>) certifies that all renovation activities will be conducted in accordance with the EPA Renovation, Repair, and Painting (RRP) Rule (40 CFR Part 745) using the following lead-safe work practices:</p>
  <div class="check-row"><span class="check-box">&#10003;</span><span>Post warning signs at the entrance to the work area before beginning work</span></div>
  <div class="check-row"><span class="check-box">&#10003;</span><span>Contain the work area to prevent dust and debris from spreading — plastic sheeting on floors and covering all HVAC vents</span></div>
  <div class="check-row"><span class="check-box">&#10003;</span><span>Avoid practices that generate airborne lead dust (open-flame burning, dry scraping, dry sanding, power sanding without HEPA vacuum)</span></div>
  <div class="check-row"><span class="check-box">&#10003;</span><span>Clean the work area thoroughly after renovation — wet mopping, wet wiping, HEPA vacuuming all surfaces</span></div>
  <div class="check-row"><span class="check-box">&#10003;</span><span>Collect and properly dispose of all waste in sealed, heavy-duty plastic bags</span></div>
  <div class="check-row"><span class="check-box">&#10003;</span><span>Perform post-renovation cleaning verification before removing containment</span></div>
  <div class="check-row"><span class="check-box">&#10003;</span><span>Maintain records of this disclosure, acknowledgment, and all renovation activities for 3 years</span></div>
</div>

<div class="sec">
  <h3>Property Owner Acknowledgment &amp; Authorization</h3>
  <p style="font-size:13px;color:#374151;margin-bottom:12px">By signing below, the property owner acknowledges and agrees to the following:</p>
  <div class="check-row"><span class="check-box">&#10003;</span><span>I have received a copy of the EPA pamphlet <em>"Renovate Right"</em> before the start of renovation (Pamphlet Date: <span class="initials-field"></span>)</span></div>
  <div class="check-row"><span class="check-box">&#10003;</span><span>I have been informed that this property or the work area may contain lead-based paint and/or lead-based paint hazards</span></div>
  <div class="check-row"><span class="check-box">&#10003;</span><span>I authorize {{COMPANY_NAME}} to perform the renovation work described above using EPA-certified lead-safe work practices</span></div>
  <div class="check-row"><span class="check-box">&#10003;</span><span>I understand that I (or my tenants/occupants) should not be present during renovation work and should stay out of the contained work area</span></div>
  <div class="check-row"><span class="check-box">&#10003;</span><span>I have been given the opportunity to ask questions about lead safety and renovation procedures</span></div>
</div>

<div class="cert-block">
  <h3>Contractor RRP Certification</h3>
  <div class="row"><span class="lbl">Company:</span><span class="val">{{COMPANY_NAME}}</span></div>
  <div class="row"><span class="lbl">EPA Firm Cert #:</span><span class="val">{{EPA_FIRM_CERT}}</span></div>
  <div class="row"><span class="lbl">Certified Renovator:</span><span class="val">{{REP_NAME}}</span></div>
  <div class="row"><span class="lbl">Individual Cert #:</span><span class="val">{{EPA_RRP_CERT}}</span></div>
  <div class="row"><span class="lbl">Cert Expiration:</span><span class="val">{{EPA_CERT_EXPIRY}}</span></div>
</div>

${footer}`,
      variables: ['COMPANY_NAME','COMPANY_TAGLINE','REP_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','YEAR_BUILT','LEAD_TEST_STATUS','DISCLOSURE_DATE','START_DATE','WORK_TYPE','WORK_DESCRIPTION','WORK_LOCATION','AFFECTED_AREA','EPA_FIRM_CERT','EPA_RRP_CERT','EPA_CERT_EXPIRY'],
      favorite: false, isDefault: false, tags: ['lead-safe','EPA','RRP','compliance','safety','pre-1978'],
      createdAt: '2026-03-08', lastModified: '2026-03-08', usageCount: 0, fileType: 'html'
    },

    {
      id: 'ct-010',
      name: 'Customer Service Agreement - Window Replacement',
      description: 'Customer service agreement for window replacement with preloaded line items',
      category: 'contract',
      templateType: 'customer-service-agreement',
      content: contractHeader('Customer Service Agreement - Window Replacement') + `
<div class="sec">
  <h3>Window Specifications</h3>
  <div class="highlight">
    <strong>Brand / Series:</strong> {{WINDOW_BRAND}} {{WINDOW_SERIES}} &nbsp;·&nbsp;
    <strong>Frame:</strong> {{FRAME_MATERIAL}} &nbsp;·&nbsp;
    <strong>Glass:</strong> {{GLASS_PACKAGE}} &nbsp;·&nbsp;
    <strong>Color:</strong> {{FRAME_COLOR}}
  </div>
  <div class="row"><span class="lbl">Total Windows:</span><span class="val">{{TOTAL_WINDOWS}} windows</span></div>
  <div class="row"><span class="lbl">Window Types:</span><span class="val">{{WINDOW_TYPES}}</span></div>
  <div class="row"><span class="lbl">Glass Options:</span><span class="val">{{GLASS_OPTIONS}}</span></div>
  <div class="row"><span class="lbl">Grilles / Screens:</span><span class="val">{{GRILLE_OPTION}}</span></div>
  <div class="row"><span class="lbl">Lead Time:</span><span class="val">{{LEAD_TIME}} from contract signing</span></div>
</div>
<div class="sec">
  <h3>Scope of Work</h3>
  <ul class="scope-list">
    <li>Remove and dispose of all existing windows and related trim / flashing</li>
    <li>Inspect rough opening framing; repair or replace rotted sill plates, jack studs, and trimmers as needed</li>
    <li>Install new {{WINDOW_BRAND}} {{WINDOW_SERIES}} windows — one at a time to maintain building envelope</li>
    <li>Flash all windows per manufacturer specifications using self-adhering flashing tape</li>
    <li>Install interior and exterior trim / casing — Color: {{TRIM_COLOR}}</li>
    <li>Caulk all exterior perimeters with paintable elastomeric sealant; color-match to frame</li>
    <li>Verify all windows open, close, lock, and operate properly</li>
    <li>Clean all glass; haul away all old windows and debris</li>
    <li>Customer walkthrough and demonstration of operation for all windows</li>
  </ul>
</div>
<div class="sec">
  <h3>Cost Breakdown</h3>
  <table>
    <thead><tr><th>Window Type / Location</th><th style="width:60px">Qty</th><th style="width:110px">Unit Price</th><th style="width:110px">Total</th></tr></thead>
    <tbody>
      <tr><td>{{WINDOW_TYPE_1}} ({{WINDOW_SIZE_1}})</td><td>{{WINDOW_QTY_1}}</td><td>{{WINDOW_PRICE_1}}</td><td>{{WINDOW_TOTAL_1}}</td></tr>
      <tr><td>{{WINDOW_TYPE_2}} ({{WINDOW_SIZE_2}})</td><td>{{WINDOW_QTY_2}}</td><td>{{WINDOW_PRICE_2}}</td><td>{{WINDOW_TOTAL_2}}</td></tr>
      <tr><td>{{WINDOW_TYPE_3}} ({{WINDOW_SIZE_3}})</td><td>{{WINDOW_QTY_3}}</td><td>{{WINDOW_PRICE_3}}</td><td>{{WINDOW_TOTAL_3}}</td></tr>
      <tr><td>Removal &amp; disposal of existing windows</td><td>{{TOTAL_WINDOWS}}</td><td>{{REMOVAL_RATE}}</td><td>{{REMOVAL_TOTAL}}</td></tr>
      <tr><td>Rough opening framing repairs (if needed)</td><td>Lot</td><td>—</td><td>{{FRAMING_REPAIR_TOTAL}}</td></tr>
      <tr><td>Exterior trim, casing &amp; caulking</td><td>{{TOTAL_WINDOWS}} openings</td><td>{{TRIM_RATE}}</td><td>{{TRIM_TOTAL}}</td></tr>
      <tr><td>Interior trim / paint-ready casing</td><td>{{TOTAL_WINDOWS}} openings</td><td>{{INT_TRIM_RATE}}</td><td>{{INT_TRIM_TOTAL}}</td></tr>
      <tr><td>Cleanup &amp; haul-away</td><td>Lot</td><td>—</td><td>{{CLEANUP_TOTAL}}</td></tr>
    </tbody>
  </table>
  ${totalsBlock}
</div>
<div class="sec">
  <h3>Warranty</h3>
  <div class="row"><span class="lbl">Manufacturer:</span><span class="val">{{MANUFACTURER_WARRANTY}} — {{WINDOW_BRAND}} limited warranty (glass, frame, hardware)</span></div>
  <div class="row"><span class="lbl">Workmanship:</span><span class="val">{{WORKMANSHIP_WARRANTY}} — labor and installation by {{COMPANY_NAME}}</span></div>
  <div class="row"><span class="lbl">Energy Performance:</span><span class="val">Per {{WINDOW_BRAND}} specifications for selected glass package</span></div>
</div>
${contractTermsBlock}
${footer}`,
      variables: ['COMPANY_NAME','COMPANY_TAGLINE','REP_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','CONTRACT_NUMBER','CONTRACT_DATE','START_DATE','ESTIMATED_COMPLETION','WINDOW_BRAND','WINDOW_SERIES','FRAME_MATERIAL','GLASS_PACKAGE','FRAME_COLOR','TOTAL_WINDOWS','WINDOW_TYPES','GLASS_OPTIONS','GRILLE_OPTION','LEAD_TIME','TRIM_COLOR','WINDOW_TYPE_1','WINDOW_SIZE_1','WINDOW_QTY_1','WINDOW_PRICE_1','WINDOW_TOTAL_1','WINDOW_TYPE_2','WINDOW_SIZE_2','WINDOW_QTY_2','WINDOW_PRICE_2','WINDOW_TOTAL_2','WINDOW_TYPE_3','WINDOW_SIZE_3','WINDOW_QTY_3','WINDOW_PRICE_3','WINDOW_TOTAL_3','SUBTOTAL','TAX_RATE','TAX_AMOUNT','TOTAL_AMOUNT','DEPOSIT_AMOUNT','BALANCE_DUE','WARRANTY_PERIOD','MANUFACTURER_WARRANTY','WORKMANSHIP_WARRANTY','PAYMENT_TERMS'],
      favorite: false, isDefault: false, tags: ['windows','contract','replacement','exterior'],
      createdAt: '2026-03-08', lastModified: '2026-03-08', usageCount: 0, fileType: 'html'
    },

    {
      id: 'ct-011',
      name: 'Customer Service Agreement - Siding Replacement',
      description: 'Customer service agreement for complete siding replacement with preloaded line items',
      category: 'contract',
      templateType: 'customer-service-agreement',
      content: contractHeader('Customer Service Agreement - Siding Replacement') + `
<div class="sec">
  <h3>Siding Specifications</h3>
  <div class="highlight">
    <strong>Product:</strong> {{SIDING_BRAND}} {{SIDING_PRODUCT}} &nbsp;·&nbsp;
    <strong>Style / Profile:</strong> {{SIDING_STYLE}} &nbsp;·&nbsp;
    <strong>Color:</strong> {{SIDING_COLOR}} &nbsp;·&nbsp;
    <strong>Thickness:</strong> {{SIDING_THICKNESS}}
  </div>
  <div class="row"><span class="lbl">Wall Area:</span><span class="val">{{SIDING_SQUARES}} squares ({{SIDING_SQFT}} sq ft)</span></div>
  <div class="row"><span class="lbl">Soffit / Fascia:</span><span class="val">{{SOFFIT_SQFT}} sq ft soffit &nbsp;·&nbsp; {{FASCIA_LF}} LF fascia</span></div>
  <div class="row"><span class="lbl">Window/Door Trim:</span><span class="val">{{TRIM_OPTION}}</span></div>
  <div class="row"><span class="lbl">House Wrap:</span><span class="val">{{WRAP_BRAND}} weather-resistant barrier</span></div>
</div>
<div class="sec">
  <h3>Scope of Work</h3>
  <ul class="scope-list">
    <li>Remove and dispose of all existing siding, trim, and related materials</li>
    <li>Inspect sheathing and framing; repair rotted or damaged areas as needed</li>
    <li>Install {{WRAP_BRAND}} house wrap / weather-resistant barrier over full wall area</li>
    <li>Install all starter strips, corner posts (inside and outside), J-channel, and receiver trim</li>
    <li>Install <strong>{{SIDING_BRAND}} {{SIDING_PRODUCT}}</strong> siding — {{SIDING_STYLE}} profile, Color: {{SIDING_COLOR}}</li>
    <li>Install soffit panels at all overhangs — Color: {{SOFFIT_COLOR}}</li>
    <li>Install fascia / coil stock wrap at all fascia boards — Color: {{FASCIA_COLOR}}</li>
    <li>Wrap all windows and doors with coil stock or install manufacturer trim — Color: {{TRIM_COLOR}}</li>
    <li>Caulk all penetrations, top of windows, and transitions with color-match sealant</li>
    <li>Touch up and prime any exposed areas; daily site cleanup and final haul-away</li>
  </ul>
</div>
<div class="sec">
  <h3>Cost Breakdown</h3>
  <table>
    <thead><tr><th>Description</th><th style="width:100px">Qty / Unit</th><th style="width:110px">Unit Price</th><th style="width:110px">Total</th></tr></thead>
    <tbody>
      <tr><td>Remove &amp; dispose existing siding</td><td>{{SIDING_SQUARES}} sq</td><td>{{REMOVAL_RATE}}</td><td>{{REMOVAL_TOTAL}}</td></tr>
      <tr><td>Sheathing / framing repairs</td><td>Allow</td><td>—</td><td>{{SHEATHING_REPAIR_TOTAL}}</td></tr>
      <tr><td>{{WRAP_BRAND}} house wrap</td><td>{{SIDING_SQUARES}} sq</td><td>{{WRAP_RATE}}</td><td>{{WRAP_TOTAL}}</td></tr>
      <tr><td>{{SIDING_BRAND}} {{SIDING_PRODUCT}} siding — {{SIDING_COLOR}}</td><td>{{SIDING_SQUARES}} sq</td><td>{{SIDING_RATE}}</td><td>{{SIDING_TOTAL}}</td></tr>
      <tr><td>Corner posts, starter strip, J-trim, receiver trim</td><td>Lot</td><td>—</td><td>{{TRIM_MATERIALS_TOTAL}}</td></tr>
      <tr><td>Soffit panels — {{SOFFIT_COLOR}}</td><td>{{SOFFIT_SQFT}} sq ft</td><td>{{SOFFIT_RATE}}</td><td>{{SOFFIT_TOTAL}}</td></tr>
      <tr><td>Fascia / coil stock wrap — {{FASCIA_COLOR}}</td><td>{{FASCIA_LF}} LF</td><td>{{FASCIA_RATE}}</td><td>{{FASCIA_TOTAL}}</td></tr>
      <tr><td>Window &amp; door trim wrap — {{TRIM_COLOR}}</td><td>{{WINDOW_COUNT}} openings</td><td>{{WINDOW_WRAP_RATE}}</td><td>{{WINDOW_WRAP_TOTAL}}</td></tr>
      <tr><td>Sealant, fasteners &amp; accessories</td><td>Lot</td><td>—</td><td>{{HARDWARE_TOTAL}}</td></tr>
      <tr><td>Cleanup &amp; haul-away</td><td>Lot</td><td>—</td><td>{{CLEANUP_TOTAL}}</td></tr>
    </tbody>
  </table>
  ${totalsBlock}
</div>
<div class="sec">
  <h3>Warranty</h3>
  <div class="row"><span class="lbl">Manufacturer:</span><span class="val">{{MANUFACTURER_WARRANTY}} — {{SIDING_BRAND}} limited warranty on product</span></div>
  <div class="row"><span class="lbl">Workmanship:</span><span class="val">{{WORKMANSHIP_WARRANTY}} — installation and labor by {{COMPANY_NAME}}</span></div>
</div>
${contractTermsBlock}
${footer}`,
      variables: ['COMPANY_NAME','COMPANY_TAGLINE','REP_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','CONTRACT_NUMBER','CONTRACT_DATE','START_DATE','ESTIMATED_COMPLETION','SIDING_BRAND','SIDING_PRODUCT','SIDING_STYLE','SIDING_COLOR','SIDING_THICKNESS','SIDING_SQUARES','SIDING_SQFT','SOFFIT_SQFT','FASCIA_LF','TRIM_OPTION','WRAP_BRAND','SOFFIT_COLOR','FASCIA_COLOR','TRIM_COLOR','WINDOW_COUNT','SUBTOTAL','TAX_RATE','TAX_AMOUNT','TOTAL_AMOUNT','DEPOSIT_AMOUNT','BALANCE_DUE','WARRANTY_PERIOD','MANUFACTURER_WARRANTY','WORKMANSHIP_WARRANTY','PAYMENT_TERMS'],
      favorite: false, isDefault: false, tags: ['siding','contract','exterior','replacement'],
      createdAt: '2026-03-08', lastModified: '2026-03-08', usageCount: 0, fileType: 'html'
    },

    // ── 12. Insurance Restoration Contract ───────────────────────────────
    {
      id: 'ct-012',
      name: 'Insurance Restoration Contract',
      description: 'General insurance restoration contract covering RCV/ACV, supplement authorization, insurance assignment, and dual-party payment',
      category: 'contract',
      content: contractHeader('Insurance Restoration Contract') + `
<div class="sec">
  <h3>Insurance Claim Information</h3>
  <div class="highlight">
    <strong>Carrier:</strong> {{INSURANCE_COMPANY}} &nbsp;·&nbsp;
    <strong>Claim #:</strong> {{CLAIM_NUMBER}} &nbsp;·&nbsp;
    <strong>Policy #:</strong> {{POLICY_NUMBER}}
  </div>
  <div class="row"><span class="lbl">Loss Date:</span><span class="val">{{LOSS_DATE}}</span></div>
  <div class="row"><span class="lbl">Loss Type:</span><span class="val">{{LOSS_TYPE}}</span></div>
  <div class="row"><span class="lbl">Adjuster Name:</span><span class="val">{{ADJUSTER_NAME}}</span></div>
  <div class="row"><span class="lbl">Adjuster Phone:</span><span class="val">{{ADJUSTER_PHONE}}</span></div>
  <div class="row"><span class="lbl">RCV Amount:</span><span class="val">{{RCV_AMOUNT}}</span></div>
  <div class="row"><span class="lbl">ACV Amount:</span><span class="val">{{ACV_AMOUNT}}</span></div>
  <div class="row"><span class="lbl">Deductible:</span><span class="val">{{DEDUCTIBLE_AMOUNT}}</span></div>
</div>
<div class="sec">
  <h3>Scope of Restoration Work</h3>
  <div style="background:#f8fafc;padding:12px 14px;border-radius:6px;font-size:13px;line-height:1.9;color:#374151">
    {{SCOPE_OF_WORK}}
  </div>
</div>
<div class="sec">
  <h3>Contract Price</h3>
  <table>
    <thead><tr><th>Trade / Division</th><th style="width:110px">RCV</th><th style="width:110px">ACV</th><th style="width:110px">Depr.</th></tr></thead>
    <tbody>
      <tr><td>{{TRADE_1}}</td><td>{{TRADE_1_RCV}}</td><td>{{TRADE_1_ACV}}</td><td>{{TRADE_1_DEPR}}</td></tr>
      <tr><td>{{TRADE_2}}</td><td>{{TRADE_2_RCV}}</td><td>{{TRADE_2_ACV}}</td><td>{{TRADE_2_DEPR}}</td></tr>
      <tr><td>{{TRADE_3}}</td><td>{{TRADE_3_RCV}}</td><td>{{TRADE_3_ACV}}</td><td>{{TRADE_3_DEPR}}</td></tr>
      <tr><td>Supplements (if any)</td><td>{{SUPPLEMENT_TOTAL}}</td><td>—</td><td>—</td></tr>
    </tbody>
  </table>
  <div class="totals">
    <div class="t-row"><span class="t-lbl">Total RCV:</span><span class="t-val">{{RCV_AMOUNT}}</span></div>
    <div class="t-row"><span class="t-lbl">Less Deductible:</span><span class="t-val">–{{DEDUCTIBLE_AMOUNT}}</span></div>
    <div class="t-row"><span class="t-lbl">ACV Payment:</span><span class="t-val">{{ACV_AMOUNT}}</span></div>
    <div class="t-row t-grand"><span class="t-lbl">CUSTOMER OWES (Deductible):</span><span class="t-val">{{DEDUCTIBLE_AMOUNT}}</span></div>
  </div>
</div>
<div class="sec">
  <h3>Authorization &amp; Assignment</h3>
  <div style="font-size:12.5px;line-height:1.9;color:#374151;background:#fef3c7;padding:12px 14px;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0">
    <strong>Insurance Assignment:</strong> Customer hereby authorizes {{INSURANCE_COMPANY}} to include {{COMPANY_NAME}} as a co-payee on all restoration-related insurance payments. Customer authorizes {{COMPANY_NAME}} to communicate directly with the insurance carrier and adjuster on all matters related to this claim.<br><br>
    <strong>Supplement Authorization:</strong> Customer authorizes {{COMPANY_NAME}} to identify and submit supplements for any additional damage discovered during the course of work and for any line items omitted from the initial insurance scope. No supplement work shall commence without written customer approval.<br><br>
    <strong>Deductible:</strong> Customer is responsible for paying their insurance deductible of <strong>{{DEDUCTIBLE_AMOUNT}}</strong> directly to {{COMPANY_NAME}}. Customer may not waive or reduce their deductible through any discount or credit arrangement, as this may constitute insurance fraud.
  </div>
</div>
<div class="sec">
  <h3>Payment Schedule</h3>
  <table>
    <thead><tr><th>Milestone</th><th style="width:140px">Amount</th><th>Due</th></tr></thead>
    <tbody>
      <tr><td>Insurance deductible</td><td>{{DEDUCTIBLE_AMOUNT}}</td><td>Prior to work commencement</td></tr>
      <tr><td>ACV check (insurance)</td><td>{{ACV_AMOUNT}}</td><td>Upon receipt from insurance carrier</td></tr>
      <tr><td>Recoverable depreciation</td><td>{{RECOVERABLE_DEPRECIATION}}</td><td>Upon completion and depreciation release from carrier</td></tr>
      <tr><td>Approved supplements</td><td>{{SUPPLEMENT_TOTAL}}</td><td>Per supplement approval and completion</td></tr>
    </tbody>
  </table>
</div>
${contractTermsBlock}
${footer}`,
      variables: ['COMPANY_NAME','COMPANY_TAGLINE','REP_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','CONTRACT_NUMBER','CONTRACT_DATE','START_DATE','ESTIMATED_COMPLETION','INSURANCE_COMPANY','CLAIM_NUMBER','POLICY_NUMBER','LOSS_DATE','LOSS_TYPE','ADJUSTER_NAME','ADJUSTER_PHONE','RCV_AMOUNT','ACV_AMOUNT','DEDUCTIBLE_AMOUNT','RECOVERABLE_DEPRECIATION','SCOPE_OF_WORK','TRADE_1','TRADE_1_RCV','TRADE_1_ACV','TRADE_1_DEPR','TRADE_2','TRADE_2_RCV','TRADE_2_ACV','TRADE_2_DEPR','TRADE_3','TRADE_3_RCV','TRADE_3_ACV','TRADE_3_DEPR','SUPPLEMENT_TOTAL','WARRANTY_PERIOD','PAYMENT_TERMS'],
      favorite: true, isDefault: false, tags: ['restoration','contract','insurance','RCV','ACV','supplement'],
      createdAt: '2026-03-08', lastModified: '2026-03-08', usageCount: 0, fileType: 'html'
    },

    {
      id: 'ct-013',
      name: 'Customer Service Agreement - Interior Restoration',
      description: 'Customer service agreement for interior restoration with preloaded line items',
      category: 'contract',
      templateType: 'customer-service-agreement',
      content: contractHeader('Customer Service Agreement - Interior Restoration') + `
<div class="sec">
  <h3>Project Overview</h3>
  <div class="highlight">
    <strong>Loss Type:</strong> {{LOSS_TYPE}} &nbsp;·&nbsp;
    <strong>Affected Area:</strong> {{AFFECTED_SQFT}} sq ft &nbsp;·&nbsp;
    <strong>Rooms:</strong> {{ROOM_LIST}}
  </div>
  <div class="row"><span class="lbl">Insurance Carrier:</span><span class="val">{{INSURANCE_COMPANY}}</span></div>
  <div class="row"><span class="lbl">Claim #:</span><span class="val">{{CLAIM_NUMBER}}</span></div>
  <div class="row"><span class="lbl">Adjuster:</span><span class="val">{{ADJUSTER_NAME}} — {{ADJUSTER_PHONE}}</span></div>
  <div class="row"><span class="lbl">Mitigation Co.:</span><span class="val">{{MITIGATION_COMPANY}}</span></div>
</div>
<div class="sec">
  <h3>Scope of Restoration Work</h3>
  <ul class="scope-list">
    <li><strong>Drywall:</strong> {{DRYWALL_SCOPE}} — hang, tape, float to Level {{FINISH_LEVEL}}, texture to match existing</li>
    <li><strong>Insulation:</strong> {{INSULATION_SCOPE}}</li>
    <li><strong>Paint / Finish:</strong> {{PAINT_SCOPE}} — prime all repaired areas; {{PAINT_COATS}} finish coats matching existing color</li>
    <li><strong>Flooring:</strong> {{FLOORING_SCOPE}} — remove damaged flooring, install {{FLOORING_TYPE}} to match existing</li>
    <li><strong>Trim / Millwork:</strong> {{TRIM_SCOPE}}</li>
    <li><strong>Cabinetry:</strong> {{CABINET_SCOPE}}</li>
    <li><strong>Contents / Flatwork:</strong> {{CONTENTS_SCOPE}}</li>
    <li>All debris removal, containment, and site cleanup throughout and upon completion</li>
    <li>Environmental monitoring as required: {{ENVIRONMENTAL_CONTROLS}}</li>
  </ul>
</div>
<div class="sec">
  <h3>Cost Breakdown</h3>
  <table>
    <thead><tr><th>Division</th><th style="width:100px">Qty / Unit</th><th style="width:110px">Unit Price</th><th style="width:110px">Total</th></tr></thead>
    <tbody>
      <tr><td>Demo / debris removal</td><td>{{DEMO_SQFT}} sq ft</td><td>{{DEMO_RATE}}</td><td>{{DEMO_TOTAL}}</td></tr>
      <tr><td>Drywall — hang, tape &amp; finish (Level {{FINISH_LEVEL}})</td><td>{{DRYWALL_SQFT}} sq ft</td><td>{{DRYWALL_RATE}}</td><td>{{DRYWALL_TOTAL}}</td></tr>
      <tr><td>Insulation replacement</td><td>{{INSULATION_SQFT}} sq ft</td><td>{{INSULATION_RATE}}</td><td>{{INSULATION_TOTAL}}</td></tr>
      <tr><td>Texture matching</td><td>{{TEXTURE_SQFT}} sq ft</td><td>{{TEXTURE_RATE}}</td><td>{{TEXTURE_TOTAL}}</td></tr>
      <tr><td>Paint (prime + {{PAINT_COATS}} coats)</td><td>{{PAINT_SQFT}} sq ft</td><td>{{PAINT_RATE}}</td><td>{{PAINT_TOTAL}}</td></tr>
      <tr><td>Flooring — {{FLOORING_TYPE}}</td><td>{{FLOORING_SQFT}} sq ft</td><td>{{FLOORING_RATE}}</td><td>{{FLOORING_TOTAL}}</td></tr>
      <tr><td>Base, casing &amp; millwork</td><td>{{TRIM_LF}} LF</td><td>{{TRIM_RATE}}</td><td>{{TRIM_TOTAL}}</td></tr>
      <tr><td>Cabinetry / built-ins</td><td>Allow</td><td>—</td><td>{{CABINET_TOTAL}}</td></tr>
      <tr><td>Contents — cleaning / restoration</td><td>Allow</td><td>—</td><td>{{CONTENTS_TOTAL}}</td></tr>
      <tr><td>Environmental controls &amp; monitoring</td><td>Allow</td><td>—</td><td>{{ENVIRONMENTAL_TOTAL}}</td></tr>
      <tr><td>General cleanup &amp; haul-away</td><td>Lot</td><td>—</td><td>{{CLEANUP_TOTAL}}</td></tr>
    </tbody>
  </table>
  ${totalsBlock}
</div>
<div class="sec">
  <h3>Warranty</h3>
  <div class="row"><span class="lbl">Workmanship:</span><span class="val">{{WARRANTY_PERIOD}} — all labor performed by {{COMPANY_NAME}}</span></div>
  <div class="row"><span class="lbl">Materials:</span><span class="val">Per manufacturer warranties — flooring, paint, and millwork products</span></div>
  <div class="row"><span class="lbl">Exclusions:</span><span class="val">Warranty does not cover recurrence of the original loss, secondary water intrusion, or damage from occupant activity</span></div>
</div>
${contractTermsBlock}
${footer}`,
      variables: ['COMPANY_NAME','COMPANY_TAGLINE','REP_NAME','COMPANY_ADDRESS','COMPANY_CITY','COMPANY_STATE','COMPANY_ZIP','COMPANY_PHONE','COMPANY_EMAIL','CONTRACTOR_LICENSE','COMPANY_LOGO','CUSTOMER_NAME','CUSTOMER_PHONE','CUSTOMER_EMAIL','PROPERTY_ADDRESS','PROPERTY_CITY','PROPERTY_STATE','PROPERTY_ZIP','CONTRACT_NUMBER','CONTRACT_DATE','START_DATE','ESTIMATED_COMPLETION','LOSS_TYPE','AFFECTED_SQFT','ROOM_LIST','INSURANCE_COMPANY','CLAIM_NUMBER','ADJUSTER_NAME','ADJUSTER_PHONE','MITIGATION_COMPANY','DRYWALL_SCOPE','FINISH_LEVEL','INSULATION_SCOPE','PAINT_SCOPE','PAINT_COATS','FLOORING_SCOPE','FLOORING_TYPE','TRIM_SCOPE','CABINET_SCOPE','CONTENTS_SCOPE','ENVIRONMENTAL_CONTROLS','DEMO_SQFT','DEMO_RATE','DEMO_TOTAL','DRYWALL_SQFT','DRYWALL_RATE','DRYWALL_TOTAL','INSULATION_SQFT','INSULATION_RATE','INSULATION_TOTAL','TEXTURE_SQFT','TEXTURE_RATE','TEXTURE_TOTAL','PAINT_SQFT','PAINT_RATE','PAINT_TOTAL','FLOORING_SQFT','FLOORING_RATE','FLOORING_TOTAL','TRIM_LF','TRIM_RATE','TRIM_TOTAL','CABINET_TOTAL','CONTENTS_TOTAL','ENVIRONMENTAL_TOTAL','CLEANUP_TOTAL','SUBTOTAL','TAX_RATE','TAX_AMOUNT','TOTAL_AMOUNT','DEPOSIT_AMOUNT','BALANCE_DUE','WARRANTY_PERIOD','PAYMENT_TERMS'],
      favorite: false, isDefault: false, tags: ['interior','restoration','contract','drywall','paint','flooring','water-damage','fire-damage'],
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

  // Sample pricing defaults - users can override these
  const defaults: Record<string, string> = {
    // Customer & Company (auto-filled)
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
    CONTRACT_DATE: today,
    CURRENT_DATE: today,
    ESTIMATE_EXPIRY: expiry,
    PAYMENT_TERMS: '50% deposit at contract signing; balance due upon completion',
    WARRANTY_PERIOD: '2 years',
    TAX_RATE: '7.5',
    TAX_AMOUNT: '$823.20',
    CONTRACT_NUMBER: 'CON-' + Date.now().toString().slice(-6),
    // Plain text — newlines converted to <br> at preview/save time so the textarea looks clean
    TERMS_CONTENT: '• This estimate is valid for 30 days from the date shown above.\n' +
      '• All work performed to manufacturer specifications and local building codes.\n' +
      '• Materials and workmanship warranted for 2 years from completion.\n' +
      '• Any changes to scope of work require a signed written change order.\n' +
      '• Payment terms: 50% deposit at contract signing; balance due upon completion.',
    
    // Sample project specs (user should override)
    SHINGLE_BRAND: 'GAF',
    SHINGLE_STYLE: 'Timberline HDZ',
    SHINGLE_COLOR: 'Charcoal',
    SHINGLE_WARRANTY_YEARS: '30',
    ROOF_SQUARES: '24',
    ROOF_SQFT: '2,400',
    ROOF_PITCH: '6/12',
    STORY_COUNT: '2-story',
    LAYER_COUNT: '1',
    ESTIMATE_NUMBER: 'EST-' + Date.now().toString().slice(-6),
    START_DATE: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    ESTIMATED_DURATION: '3-5 business days',
    
    // Sample pricing - EDIT THESE VALUES to match your actual rates
    TEAROFF_RATE: '$85.00',           // Cost per square to tear off old roof
    TEAROFF_TOTAL: '$2,040.00',       // 24 squares × $85
    DECKING_SHEETS: '3',              // Number of 4×8 plywood sheets needed
    DECKING_RATE: '$65.00',           // Cost per sheet for decking repair
    DECKING_TOTAL: '$195.00',         // 3 sheets × $65
    ICE_WATER_SQ: '1',                // Rolls of ice & water shield (GAF WeatherWatch default)
    ICE_WATER_RATE: '$105.00',        // $105/roll — GAF WeatherWatch/StormGuard; Atlas WeatherMaster = $144
    ICE_WATER_TOTAL: '$105.00',       // 1 roll × $105
    UNDERLAY_SQ: '3',                 // Rolls of synthetic underlayment (1 roll per 10 sq; 24 sq ÷ 10 = 3 rolls)
    UNDERLAY_RATE: '$80.00',          // Cost per roll (~10-sq roll, e.g. GAF Feltbuster / Atlas Summit Pro)
    UNDERLAY_TOTAL: '$240.00',        // 3 rolls × $80
    DRIP_EDGE_LF: '310',              // Linear feet of drip edge (perimeter + rakes)
    DRIP_EDGE_RATE: '$4.50',          // Cost per linear foot
    DRIP_EDGE_TOTAL: '$1,395.00',     // 310 LF × $4.50
    SHINGLE_RATE: '$195.00',          // Cost per square for shingles installed
    SHINGLE_TOTAL: '$4,680.00',       // 24 squares × $195
    RIDGE_LF: '45',                   // Linear feet of ridge cap
    RIDGE_RATE: '$12.00',             // Cost per linear foot of ridge
    RIDGE_TOTAL: '$540.00',           // 45 LF × $12
    FLASHING_TOTAL: '$450.00',        // Lump sum for all flashings
    VENT_COUNT: '2',                  // Number of vents to install
    VENT_RATE: '$85.00',              // Cost per vent
    VENT_TOTAL: '$170.00',            // 2 vents × $85
    CLEANUP_TOTAL: '$350.00',         // Lump sum for cleanup & haul-away
    SUBTOTAL: '$10,976.00',           // Sum of all line items
    TOTAL_AMOUNT: '$11,799.20',       // Subtotal + tax
    DEPOSIT_AMOUNT: '$5,899.60',      // 50% deposit
    BALANCE_DUE: '$5,899.60',         // Remaining balance
  };

  return defaults;
}


/** Detect remaining unfilled {{VARIABLE}} placeholders in content */
export function getUnfilledVars(content: string): string[] {
  const matches = content.match(/\{\{([A-Z0-9_]+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
}

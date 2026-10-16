// Professional Certificate of Completion Template
// Matches the style from the provided screenshots
import { toLocalDateString } from './dates';


export const getCertificateOfCompletionTemplate = () => {
  return {
    id: 'cert-completion-pro',
    name: 'Certificate of Completion (Professional)',
    description: 'Legal certificate documenting project completion with dual signatures',
    category: 'other' as const,
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate of Completion</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #000;
      background: #fff;
      padding: 40px 60px;
    }
    .header-notice {
      text-align: right;
      font-size: 9pt;
      color: #666;
      font-style: italic;
      margin-bottom: 8px;
    }
    .doc-title {
      text-align: right;
      font-size: 20pt;
      font-weight: bold;
      margin-bottom: 30px;
    }
    .logo-container {
      text-align: center;
      margin: 20px 0 30px;
    }
    .logo-container img {
      max-width: 200px;
      max-height: 100px;
      object-fit: contain;
    }
    .main-title {
      text-align: center;
      font-size: 24pt;
      font-weight: bold;
      text-transform: uppercase;
      margin: 30px 0 10px;
      letter-spacing: 2px;
    }
    .cert-number {
      text-align: center;
      font-size: 11pt;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .verification-hash {
      text-align: center;
      font-size: 9pt;
      color: #666;
      margin-bottom: 30px;
    }
    .divider {
      border-bottom: 2px solid #000;
      margin: 20px 0;
    }
    .intro-text {
      margin: 25px 0;
      line-height: 1.8;
    }
    .section-title {
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      margin: 25px 0 15px;
      letter-spacing: 1px;
    }
    .info-grid {
      margin: 20px 0;
    }
    .info-row {
      display: flex;
      margin-bottom: 8px;
    }
    .info-label {
      font-weight: bold;
      min-width: 150px;
    }
    .info-value {
      flex: 1;
    }
    .statement-box {
      border: 2px solid #000;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .statement-box .box-title {
      font-weight: bold;
      margin-bottom: 12px;
    }
    .statement-box ul {
      list-style: disc;
      margin-left: 25px;
    }
    .statement-box li {
      margin-bottom: 8px;
    }
    .signature-section {
      margin-top: 40px;
      page-break-inside: avoid;
    }
    .sig-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 30px;
    }
    .sig-block {
      page-break-inside: avoid;
    }
    .sig-header {
      font-weight: bold;
      font-size: 12pt;
      margin-bottom: 15px;
    }
    .sig-company {
      font-weight: bold;
      margin-bottom: 5px;
    }
    .sig-license {
      font-size: 10pt;
      color: #333;
      margin-bottom: 15px;
    }
    .sig-line {
      border-bottom: 2px solid #000;
      height: 50px;
      margin-bottom: 8px;
    }
    .sig-label {
      font-size: 10pt;
    }
    .sig-name {
      font-weight: bold;
      margin-bottom: 15px;
    }
    .sig-date {
      border-bottom: 2px solid #000;
      height: 35px;
      margin: 15px 0 5px;
    }
    .legal-section {
      margin-top: 30px;
      padding: 15px;
      border-left: 4px solid #000;
      background: #f5f5f5;
    }
    .legal-section .legal-title {
      font-weight: bold;
      font-size: 11pt;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .legal-section p {
      font-size: 9pt;
      line-height: 1.6;
    }
    .footer {
      margin-top: 40px;
      padding-top: 15px;
      border-top: 1px solid #ccc;
      font-size: 9pt;
      color: #666;
      display: flex;
      justify-content: space-between;
    }
    .page-number {
      text-align: right;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>

  <!-- Page 1 -->
  <div class="header-notice">LEGAL DOCUMENT - NOT FOR REPRODUCTION</div>
  <div class="doc-title">Certificate of Completion</div>

  <div class="logo-container">
    <img src="{{COMPANY_LOGO_URL}}" alt="{{COMPANY_NAME}}" onerror="this.style.display='none'" />
  </div>

  <h1 class="main-title">Certificate of Completion</h1>
  
  <div class="cert-number">Certificate No. {{CERTIFICATE_NUMBER}}</div>
  <div class="verification-hash">Verification Hash: {{VERIFICATION_HASH}}</div>
  
  <div class="divider"></div>

  <div class="intro-text">
    This Certificate of Completion ("Certificate") certifies that all work described in the Customer 
    Service Agreement and Contingency Agreement dated <strong>{{CONTRACT_DATE}}</strong> has been 
    completed to the satisfaction of both parties.
  </div>

  <div class="section-title">Project Information</div>
  
  <div class="info-grid">
    <div class="info-row">
      <div class="info-label">Contractor::</div>
      <div class="info-value">{{COMPANY_NAME}}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Completion Date::</div>
      <div class="info-value">{{COMPLETION_DATE}}</div>
    </div>
  </div>

  <div class="section-title">Completion Statement</div>
  
  <div class="statement-box">
    <div class="box-title">The Contractor, {{COMPANY_NAME}}, hereby certifies that:</div>
    <ul>
      <li>All work specified in the Customer Service Agreement and Contingency Agreement has been completed in accordance with the terms and conditions of said agreement.</li>
      <li>All work has been performed in a workmanlike manner and in accordance with industry standards and applicable building codes.</li>
      <li>All materials used in the performance of the work are of good quality and suitable for their intended purpose.</li>
      <li>The work site has been cleaned and left in a safe and orderly condition.</li>
      <li>All permits and inspections required by local authorities have been obtained and completed.</li>
    </ul>
  </div>

  <div class="footer">
    <div>Document ID: {{DOCUMENT_ID}}<br>Verification Hash: {{VERIFICATION_HASH}}<br>Generated: {{GENERATION_DATE}}</div>
    <div class="page-number">Page 1 of 3<br>{{COMPANY_NAME}}</div>
  </div>

  <!-- Page 2 -->
  <div style="page-break-before: always;"></div>

  <div class="header-notice">LEGAL DOCUMENT - NOT FOR REPRODUCTION</div>
  <div class="doc-title">Certificate of Completion</div>

  <div class="statement-box">
    <ul>
      <li>All materials used in the performance of the work are of good quality and suitable for their intended purpose.</li>
      <li>The work site has been cleaned and left in a safe and orderly condition.</li>
      <li>All permits and inspections required by local authorities have been obtained and completed.</li>
    </ul>
  </div>

  <div class="section-title">Customer Acknowledgment</div>

  <div class="intro-text">
    <strong>The Customer, {{CUSTOMER_NAME}}, hereby acknowledges that:</strong>
  </div>

  <ul style="margin-left: 25px; margin-bottom: 20px;">
    <li>All work described in the Customer Service Agreement and Contingency Agreement has been completed to my satisfaction.</li>
    <li>I have inspected the completed work and found it to be satisfactory.</li>
    <li>I have no outstanding complaints or concerns regarding the quality of the work performed.</li>
    <li>I understand that by signing this Certificate, I am accepting the work as complete and releasing the Contractor from further obligations, except as provided in the warranty section of the original agreement.</li>
  </ul>

  <div class="statement-box">
    <div class="box-title">Execution Statement</div>
    <p>This Certificate has been executed by both parties on the date(s) indicated below. The signatures below represent the legal acknowledgment that all work has been completed to the satisfaction of both parties.</p>
  </div>

  <div class="divider"></div>

  <div class="footer">
    <div>Document ID: {{DOCUMENT_ID}}<br>Verification Hash: {{VERIFICATION_HASH}}<br>Generated: {{GENERATION_DATE}}</div>
    <div class="page-number">Page 2 of 3<br>{{COMPANY_NAME}}</div>
  </div>

  <!-- Page 3 - Signatures -->
  <div style="page-break-before: always;"></div>

  <div class="header-notice">LEGAL DOCUMENT - NOT FOR REPRODUCTION</div>
  <div class="doc-title">Certificate of Completion</div>

  <div class="signature-section">
    <div class="sig-grid">
      <!-- Contractor Signature -->
      <div class="sig-block">
        <div class="sig-header">CONTRACTOR:</div>
        <div class="sig-company">{{COMPANY_NAME}}</div>
        <div class="sig-license">License #: {{CONTRACTOR_LICENSE}}</div>
        
        <div class="sig-label">Authorized Signature</div>
        <div class="sig-line"></div>
        
        <div class="sig-name">{{COMPANY_NAME}}</div>
        <div class="sig-label">Printed Name</div>
        
        <div class="sig-date"></div>
        <div class="sig-label">Date Executed</div>
      </div>

      <!-- Customer Signature -->
      <div class="sig-block">
        <div class="sig-header">CUSTOMER:</div>
        <div style="height: 44px;"></div>
        
        <div class="sig-label">Customer Signature</div>
        <div class="sig-line"></div>
        
        <div class="sig-label">Printed Name</div>
        
        <div class="sig-date"></div>
        <div class="sig-label">Date Executed</div>
      </div>
    </div>
  </div>

  <div class="legal-section">
    <div class="legal-title">Legal Acknowledgment</div>
    <p>By signing below, I acknowledge that all work described in the Customer Service Agreement and Contingency Agreement has been completed to my satisfaction. I understand that this is a legally binding document and that my signature represents my acceptance of the completed work and release of the Contractor from further obligations, except as provided in the warranty section of the original agreement.</p>
  </div>

  <div class="legal-section" style="margin-top: 20px;">
    <div class="legal-title">Legal Compliance and Verification</div>
    <p>This document has been executed in accordance with applicable state and federal laws. The signatures contained herein are authentic and represent the voluntary agreement of both parties. This document may be used as evidence in legal proceedings and is admissible in a court of law.</p>
    <p style="margin-top: 10px;"><strong>Document ID:</strong> {{DOCUMENT_ID}} &nbsp;&nbsp;&nbsp; <strong>Hash:</strong> {{VERIFICATION_HASH}}</p>
  </div>

  <div class="footer">
    <div>Document ID: {{DOCUMENT_ID}}<br>Verification Hash: {{VERIFICATION_HASH}}<br>Generated: {{GENERATION_DATE}}</div>
    <div class="page-number">Page 3 of 3<br>{{COMPANY_NAME}}</div>
  </div>

</body>
</html>`,
    variables: [
      'COMPANY_NAME',
      'COMPANY_LOGO_URL',
      'CERTIFICATE_NUMBER',
      'VERIFICATION_HASH',
      'CONTRACT_DATE',
      'COMPLETION_DATE',
      'CUSTOMER_NAME',
      'CONTRACTOR_LICENSE',
      'DOCUMENT_ID',
      'GENERATION_DATE'
    ],
    fields: [
      { 
        key: 'CUSTOMER_NAME', 
        label: 'Customer Name', 
        type: 'text' as const, 
        required: true, 
        placeholder: 'John & Mary Smith' 
      },
      { 
        key: 'CONTRACT_DATE', 
        label: 'Original Contract Date', 
        type: 'date' as const, 
        required: true 
      },
      { 
        key: 'COMPLETION_DATE', 
        label: 'Project Completion Date', 
        type: 'date' as const, 
        required: true 
      }
    ],
    favorite: true,
    isDefault: true,
    tags: ['completion', 'certificate', 'legal', 'professional'],
    createdAt: toLocalDateString(),
    lastModified: toLocalDateString(),
    usageCount: 0,
    fileType: 'html' as const
  };
};

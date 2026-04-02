/**
 * Enhanced Document Template System with Location-Based Legal Requirements
 * Updates the existing contractor templates to include state-specific legal verbiage
 */

import { DocumentTemplate, DocumentField, LineItemDefault } from './contractorTemplates';
import { getStateLegalRequirements, generateStateLegalClauses, getContractorLicenseDisplay } from './stateLegalRequirements';

interface LocationAwareTemplateOptions {
  companyState?: string;
  customerState?: string;
  officeState?: string; // Office location (takes precedence)
  contractDate?: string;
  isEmergencyRepair?: boolean;
}

/**
 * Enhanced template generator that uses office location for legal requirements
 */
export function generateLocationAwareTemplate(
  baseTemplate: DocumentTemplate,
  options: LocationAwareTemplateOptions,
  variables: Record<string, string> = {}
): string {
  // Determine which state's laws apply (office location takes precedence)
  const applicableState = options.officeState || options.companyState || options.customerState;
  const legalRequirements = getStateLegalRequirements(applicableState);
  
  // Generate state-specific legal clauses
  const stateLegalClauses = generateStateLegalClauses(applicableState, options.contractDate);
  
  // Enhanced variable replacement that includes state-specific content
  const enhancedVariables = {
    ...variables,
    // State-specific legal clauses
    STATE_LEGAL_CLAUSES: stateLegalClauses,
    STATE_NAME: legalRequirements.stateName,
    
    // Enhanced contractor license display
    CONTRACTOR_LICENSE_DISPLAY: getContractorLicenseDisplay(
      applicableState, 
      variables.CONTRACTOR_LICENSE
    ),
    
    // State-specific warranty clause
    WARRANTY_CLAUSE: `
      <div class="warranty-section">
        <h4>WARRANTY</h4>
        <p>${legalRequirements.warranty.verbiage}</p>
      </div>
    `,
    
    // State-specific home improvement registration
    HOME_IMPROVEMENT_CLAUSE: legalRequirements.homeImprovement.registrationRequired ? `
      <div class="registration-notice">
        <p><strong>Registration Notice:</strong> ${legalRequirements.homeImprovement.verbiage}</p>
      </div>
    ` : '',
    
    // Additional state-required clauses
    ADDITIONAL_STATE_CLAUSES: legalRequirements.additionalClauses
      .map(clause => `<p style="font-size: 12px; color: #666;">${clause}</p>`)
      .join(''),
      
    // Emergency repair exemption notice
    EMERGENCY_REPAIR_NOTICE: options.isEmergencyRepair && legalRequirements.emergencyRepairs.exemptFromCancel ? `
      <div class="emergency-notice" style="background: #fef3c7; padding: 12px; border-left: 4px solid #f59e0b; margin: 16px 0;">
        <h4 style="color: #92400e; margin: 0 0 8px;">Emergency Repair</h4>
        <p style="margin: 0; font-size: 13px;">
          This contract is for emergency repairs as defined by ${legalRequirements.stateName} law: 
          ${legalRequirements.emergencyRepairs.definition}. 
          The 3-day cancellation right does not apply to emergency repairs.
        </p>
      </div>
    ` : ''
  };

  // Replace all variables in the template content
  let processedContent = baseTemplate.content;
  Object.entries(enhancedVariables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    processedContent = processedContent.replace(regex, value || '');
  });

  return processedContent;
}

/**
 * Enhanced contractor templates with location-aware legal content
 */
export function getLocationAwareContractorTemplates(): DocumentTemplate[] {
  return [
    // ═══════════════════════════════════════════════════════════════════════
    // ENHANCED LEGAL DOCUMENTS with State-Specific Content
    // ═══════════════════════════════════════════════════════════════════════
    
    {
      id: 'location-legal-001',
      name: 'Home Improvement Contract (Location-Aware)',
      description: 'Comprehensive home improvement contract with state-specific legal requirements',
      category: 'legal',
      templateType: 'legal-document',
      content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Home Improvement Contract</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 8.5in; margin: 0 auto; padding: 24px; }
    .header { border-bottom: 3px solid #2563eb; padding-bottom: 18px; margin-bottom: 28px; }
    .company-info { display: flex; justify-content: space-between; align-items: flex-start; }
    .contract-title { text-align: center; font-size: 24px; font-weight: bold; color: #1f2937; margin: 24px 0; }
    .section { margin: 20px 0; padding: 16px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #2563eb; }
    .section h3 { margin: 0 0 12px; color: #1f2937; font-size: 16px; }
    .two-column { display: flex; gap: 20px; margin: 20px 0; }
    .column { flex: 1; }
    .legal-notices { background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .signature-block { display: flex; gap: 40px; margin-top: 40px; }
    .signature { flex: 1; }
    .signature-line { border-bottom: 2px solid #333; height: 30px; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <div>
        <h1>{{COMPANY_NAME}}</h1>
        <p>{{COMPANY_TAGLINE}}</p>
        <p>{{COMPANY_ADDRESS}}, {{COMPANY_CITY}}, {{COMPANY_STATE}} {{COMPANY_ZIP}}</p>
        <p>Phone: {{COMPANY_PHONE}} | Email: {{COMPANY_EMAIL}}</p>
        <p>{{CONTRACTOR_LICENSE_DISPLAY}}</p>
      </div>
      <div>{{COMPANY_LOGO}}</div>
    </div>
  </div>

  <div class="contract-title">HOME IMPROVEMENT CONTRACT</div>

  <div class="two-column">
    <div class="column">
      <div class="section">
        <h3>Contractor Information</h3>
        <p><strong>Company:</strong> {{COMPANY_NAME}}</p>
        <p><strong>Representative:</strong> {{REP_NAME}}</p>
        <p><strong>License:</strong> {{CONTRACTOR_LICENSE}}</p>
        <p><strong>Phone:</strong> {{COMPANY_PHONE}}</p>
        <p><strong>Email:</strong> {{COMPANY_EMAIL}}</p>
      </div>
    </div>
    <div class="column">
      <div class="section">
        <h3>Customer Information</h3>
        <p><strong>Name:</strong> {{CUSTOMER_NAME}}</p>
        <p><strong>Phone:</strong> {{CUSTOMER_PHONE}}</p>
        <p><strong>Email:</strong> {{CUSTOMER_EMAIL}}</p>
        <p><strong>Property:</strong> {{PROPERTY_ADDRESS}}</p>
        <p>{{PROPERTY_CITY}}, {{PROPERTY_STATE}} {{PROPERTY_ZIP}}</p>
      </div>
    </div>
  </div>

  <div class="section">
    <h3>Contract Details</h3>
    <div class="two-column">
      <div class="column">
        <p><strong>Contract Number:</strong> {{CONTRACT_NUMBER}}</p>
        <p><strong>Contract Date:</strong> {{CONTRACT_DATE}}</p>
        <p><strong>Start Date:</strong> {{START_DATE}}</p>
      </div>
      <div class="column">
        <p><strong>Est. Completion:</strong> {{ESTIMATED_COMPLETION}}</p>
        <p><strong>Total Amount:</strong> {{TOTAL_AMOUNT}}</p>
        <p><strong>Deposit:</strong> {{DEPOSIT_AMOUNT}}</p>
      </div>
    </div>
  </div>

  <div class="section">
    <h3>Scope of Work</h3>
    <p>{{WORK_DESCRIPTION}}</p>
    {{WORK_ITEMS_TABLE}}
  </div>

  <div class="section">
    <h3>Terms and Conditions</h3>
    <p>{{TERMS_CONTENT}}</p>
  </div>

  {{WARRANTY_CLAUSE}}
  {{HOME_IMPROVEMENT_CLAUSE}}
  {{EMERGENCY_REPAIR_NOTICE}}

  <!-- State-Specific Legal Notices -->
  <div class="legal-notices">
    <h3>IMPORTANT LEGAL NOTICES - {{STATE_NAME}}</h3>
    {{STATE_LEGAL_CLAUSES}}
    {{ADDITIONAL_STATE_CLAUSES}}
  </div>

  <div class="signature-block">
    <div class="signature">
      <div class="signature-line"></div>
      <p><strong>Customer Signature</strong></p>
      <p>{{CUSTOMER_NAME}}</p>
      <p>Date: _______________</p>
    </div>
    <div class="signature">
      <div class="signature-line"></div>
      <p><strong>Contractor Signature</strong></p>
      <p>{{REP_NAME}}, {{COMPANY_NAME}}</p>
      <p>Date: _______________</p>
    </div>
  </div>

  <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #666;">
    <p>{{COMPANY_NAME}} | {{COMPANY_PHONE}} | {{COMPANY_EMAIL}}</p>
    <p>This contract complies with {{STATE_NAME}} home improvement laws and regulations.</p>
  </div>
</body>
</html>`,
      variables: [
        'COMPANY_NAME', 'COMPANY_TAGLINE', 'COMPANY_ADDRESS', 'COMPANY_CITY', 'COMPANY_STATE', 'COMPANY_ZIP',
        'COMPANY_PHONE', 'COMPANY_EMAIL', 'COMPANY_LOGO', 'CONTRACTOR_LICENSE', 'CONTRACTOR_LICENSE_DISPLAY',
        'REP_NAME', 'CUSTOMER_NAME', 'CUSTOMER_PHONE', 'CUSTOMER_EMAIL', 'PROPERTY_ADDRESS', 'PROPERTY_CITY',
        'PROPERTY_STATE', 'PROPERTY_ZIP', 'CONTRACT_NUMBER', 'CONTRACT_DATE', 'START_DATE', 'ESTIMATED_COMPLETION',
        'TOTAL_AMOUNT', 'DEPOSIT_AMOUNT', 'WORK_DESCRIPTION', 'WORK_ITEMS_TABLE', 'TERMS_CONTENT',
        'WARRANTY_CLAUSE', 'HOME_IMPROVEMENT_CLAUSE', 'STATE_LEGAL_CLAUSES', 'ADDITIONAL_STATE_CLAUSES',
        'STATE_NAME', 'EMERGENCY_REPAIR_NOTICE'
      ],
      fields: [
        { key: 'CUSTOMER_NAME', label: 'Customer Name', type: 'text', required: true },
        { key: 'CONTRACT_DATE', label: 'Contract Date', type: 'date', required: true, defaultValue: new Date().toISOString().split('T')[0] },
        { key: 'START_DATE', label: 'Project Start Date', type: 'date', required: true },
        { key: 'ESTIMATED_COMPLETION', label: 'Estimated Completion', type: 'date', required: true },
        { key: 'WORK_DESCRIPTION', label: 'Work Description', type: 'textarea', required: true, placeholder: 'Describe the work to be performed...' },
        { key: 'TOTAL_AMOUNT', label: 'Total Contract Amount', type: 'text', required: true, placeholder: '$0.00' },
        { key: 'DEPOSIT_AMOUNT', label: 'Deposit Amount', type: 'text', required: true, placeholder: '$0.00' },
        { key: 'TERMS_CONTENT', label: 'Terms and Conditions', type: 'textarea', defaultValue: 'Payment terms, change order policy, and other contract terms...' }
      ],
      favorite: true,
      isDefault: false,
      tags: ['legal', 'contract', 'home-improvement', 'location-aware'],
      createdAt: '2026-03-09',
      lastModified: '2026-03-09',
      usageCount: 0,
      fileType: 'html'
    },

    {
      id: 'location-legal-002', 
      name: 'Work Order (Location-Aware)',
      description: 'Professional work order with state-specific legal compliance',
      category: 'work-order',
      templateType: 'legal-document',
      content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Work Order</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.5; color: #333; max-width: 8.5in; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
    .work-order-title { text-align: center; font-size: 20px; font-weight: bold; color: #1f2937; margin: 20px 0; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
    .info-box { background: #f8fafc; padding: 16px; border-radius: 6px; border-left: 3px solid #2563eb; }
    .work-details { margin: 20px 0; padding: 16px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; }
    .legal-footer { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 16px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="header">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h2>{{COMPANY_NAME}}</h2>
        <p>{{COMPANY_ADDRESS}}, {{COMPANY_CITY}}, {{COMPANY_STATE}} {{COMPANY_ZIP}}</p>
        <p>{{COMPANY_PHONE}} | {{CONTRACTOR_LICENSE_DISPLAY}}</p>
      </div>
      <div>{{COMPANY_LOGO}}</div>
    </div>
  </div>

  <div class="work-order-title">WORK ORDER #{{WORK_ORDER_NUMBER}}</div>

  <div class="info-grid">
    <div class="info-box">
      <h4 style="margin: 0 0 8px; color: #1f2937;">Customer Information</h4>
      <p><strong>Name:</strong> {{CUSTOMER_NAME}}</p>
      <p><strong>Phone:</strong> {{CUSTOMER_PHONE}}</p>
      <p><strong>Email:</strong> {{CUSTOMER_EMAIL}}</p>
      <p><strong>Address:</strong> {{PROPERTY_ADDRESS}}, {{PROPERTY_CITY}}, {{PROPERTY_STATE}} {{PROPERTY_ZIP}}</p>
    </div>
    <div class="info-box">
      <h4 style="margin: 0 0 8px; color: #1f2937;">Work Order Details</h4>
      <p><strong>Date:</strong> {{WORK_ORDER_DATE}}</p>
      <p><strong>Scheduled:</strong> {{SCHEDULED_DATE}}</p>
      <p><strong>Technician:</strong> {{ASSIGNED_TECH}}</p>
      <p><strong>Priority:</strong> {{PRIORITY_LEVEL}}</p>
    </div>
  </div>

  <div class="work-details">
    <h4 style="margin: 0 0 12px; color: #1f2937;">Work Description</h4>
    <p>{{WORK_DESCRIPTION}}</p>
    
    <h4 style="margin: 16px 0 8px; color: #1f2937;">Materials and Labor</h4>
    {{WORK_ITEMS_TABLE}}
    
    <div style="margin-top: 16px; text-align: right;">
      <p><strong>Total Amount: {{TOTAL_AMOUNT}}</strong></p>
    </div>
  </div>

  {{EMERGENCY_REPAIR_NOTICE}}
  {{WARRANTY_CLAUSE}}

  <div class="legal-footer">
    <h4 style="margin: 0 0 8px; color: #92400e;">Legal Compliance - {{STATE_NAME}}</h4>
    <p style="font-size: 12px; margin: 0;">{{ADDITIONAL_STATE_CLAUSES}}</p>
    {{HOME_IMPROVEMENT_CLAUSE}}
  </div>

  <div style="margin-top: 30px;">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
      <div style="text-align: center;">
        <div style="border-bottom: 2px solid #333; height: 30px; margin-bottom: 8px;"></div>
        <p><strong>Customer Signature</strong></p>
        <p>Date: _______________</p>
      </div>
      <div style="text-align: center;">
        <div style="border-bottom: 2px solid #333; height: 30px; margin-bottom: 8px;"></div>
        <p><strong>Technician Signature</strong></p>
        <p>Date: _______________</p>
      </div>
    </div>
  </div>
</body>
</html>`,
      variables: [
        'COMPANY_NAME', 'COMPANY_ADDRESS', 'COMPANY_CITY', 'COMPANY_STATE', 'COMPANY_ZIP',
        'COMPANY_PHONE', 'COMPANY_LOGO', 'CONTRACTOR_LICENSE_DISPLAY', 'WORK_ORDER_NUMBER',
        'CUSTOMER_NAME', 'CUSTOMER_PHONE', 'CUSTOMER_EMAIL', 'PROPERTY_ADDRESS', 'PROPERTY_CITY',
        'PROPERTY_STATE', 'PROPERTY_ZIP', 'WORK_ORDER_DATE', 'SCHEDULED_DATE', 'ASSIGNED_TECH',
        'PRIORITY_LEVEL', 'WORK_DESCRIPTION', 'WORK_ITEMS_TABLE', 'TOTAL_AMOUNT',
        'EMERGENCY_REPAIR_NOTICE', 'WARRANTY_CLAUSE', 'HOME_IMPROVEMENT_CLAUSE',
        'ADDITIONAL_STATE_CLAUSES', 'STATE_NAME'
      ],
      fields: [
        { key: 'WORK_ORDER_NUMBER', label: 'Work Order #', type: 'text', required: true, defaultValue: () => `WO-${Date.now()}` },
        { key: 'CUSTOMER_NAME', label: 'Customer Name', type: 'text', required: true },
        { key: 'WORK_ORDER_DATE', label: 'Work Order Date', type: 'date', required: true, defaultValue: new Date().toISOString().split('T')[0] },
        { key: 'SCHEDULED_DATE', label: 'Scheduled Date', type: 'date', required: true },
        { key: 'ASSIGNED_TECH', label: 'Assigned Technician', type: 'text', required: true },
        { key: 'PRIORITY_LEVEL', label: 'Priority Level', type: 'text', defaultValue: 'Normal' },
        { key: 'WORK_DESCRIPTION', label: 'Work Description', type: 'textarea', required: true, placeholder: 'Describe the work to be performed...' },
        { key: 'TOTAL_AMOUNT', label: 'Total Amount', type: 'text', placeholder: '$0.00' }
      ],
      favorite: true,
      isDefault: false,
      tags: ['work-order', 'service', 'location-aware'],
      createdAt: '2026-03-09',
      lastModified: '2026-03-09',
      usageCount: 0,
      fileType: 'html'
    }
  ];
}
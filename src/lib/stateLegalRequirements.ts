/**
 * State-Specific Legal Requirements for Document Templates
 * Provides location-based legal verbiage for contractor documents
 */

export interface StateLegalRequirement {
  state: string;
  stateName: string;
  contractorLicense: {
    required: boolean;
    format?: string;
    display: string;
  };
  threeDayCancel: {
    required: boolean;
    days: number;
    exclusions: string[];
    verbiage: string;
  };
  lienRights: {
    required: boolean;
    verbiage: string;
    noticeRequired: boolean;
    noticeDays?: number;
  };
  warranty: {
    minimumYears: number;
    verbiage: string;
  };
  emergencyRepairs: {
    exemptFromCancel: boolean;
    definition: string;
  };
  homeImprovement: {
    registrationRequired: boolean;
    bondRequired: boolean;
    verbiage: string;
  };
  additionalClauses: string[];
}

/**
 * State-specific legal requirements database
 */
export const STATE_LEGAL_REQUIREMENTS: Record<string, StateLegalRequirement> = {
  OH: {
    state: 'OH',
    stateName: 'Ohio',
    contractorLicense: {
      required: true,
      format: 'OH-#######',
      display: 'Ohio Home Improvement Contractor License: {{CONTRACTOR_LICENSE}}'
    },
    threeDayCancel: {
      required: true,
      days: 3,
      exclusions: ['emergency repairs', 'repairs under $500'],
      verbiage: `
        <div style="background: #fef2f2; border: 3px solid #dc2626; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #991b1b; font-weight: bold; margin-bottom: 12px;">🛡️ YOUR RIGHT TO CANCEL - OHIO</h3>
          <p><strong>Under Ohio Revised Code Section 1345.21-1345.28, you have the right to cancel this home improvement contract within three (3) business days.</strong></p>
          <p><strong>Contract Date:</strong> {{CONTRACT_DATE}}<br>
          <strong>Cancellation Deadline:</strong> {{CANCEL_DEADLINE}} by midnight</p>
          <p><strong>To Cancel:</strong> Send written notice by mail, email, or text to {{COMPANY_EMAIL}} or {{COMPANY_PHONE}}</p>
          <p><em>Note: This right to cancel does not apply to emergency repairs or contracts under $500.</em></p>
        </div>
      `
    },
    lienRights: {
      required: true,
      noticeRequired: true,
      noticeDays: 21,
      verbiage: `
        <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h4 style="color: #92400e; font-weight: bold;">⚠️ OHIO LIEN RIGHTS NOTICE</h4>
          <p style="font-size: 13px; line-height: 1.6;">
            Under Ohio law, those who work on your property or provide materials may enforce a claim for payment of services and materials by placing a lien upon your property. A lien may be claimed for work or materials furnished after the date stated in any required notice. Liens may be claimed even if you have paid the contractor in full. If you wish to protect yourself against liens, you should take one or both of the following steps: (1) Request that the contractor furnish you with a release or waiver of lien signed by all subcontractors and material suppliers; or (2) Pay the contractor with a joint check made payable to both the contractor and subcontractors or material suppliers.
          </p>
          <p style="font-size: 12px; margin-top: 10px;"><strong>Notice Date:</strong> {{NOTICE_DATE}}</p>
        </div>
      `
    },
    warranty: {
      minimumYears: 1,
      verbiage: 'This work is warranted against defects in workmanship for a period of one (1) year from completion as required by Ohio law.'
    },
    emergencyRepairs: {
      exemptFromCancel: true,
      definition: 'Repairs necessary to prevent damage to property or ensure safety of occupants'
    },
    homeImprovement: {
      registrationRequired: true,
      bondRequired: false,
      verbiage: 'Contractor is registered with the Ohio Department of Commerce as required by Ohio Revised Code Section 4740.'
    },
    additionalClauses: [
      'Work performed in compliance with Ohio Building Code',
      'All permits obtained as required by local jurisdiction'
    ]
  },

  WI: {
    state: 'WI',
    stateName: 'Wisconsin',
    contractorLicense: {
      required: false, // Wisconsin doesn't require state contractor license for most trades
      display: 'Licensed and Insured Contractor'
    },
    threeDayCancel: {
      required: true,
      days: 3,
      exclusions: ['emergency repairs', 'contracts under $25'],
      verbiage: `
        <div style="background: #fef2f2; border: 3px solid #dc2626; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #991b1b; font-weight: bold; margin-bottom: 12px;">🛡️ YOUR RIGHT TO CANCEL - WISCONSIN</h3>
          <p><strong>Under Wisconsin Consumer Act Section 423.202, you have the right to cancel this home improvement contract within three (3) business days.</strong></p>
          <p><strong>Contract Date:</strong> {{CONTRACT_DATE}}<br>
          <strong>Cancellation Deadline:</strong> {{CANCEL_DEADLINE}} by midnight</p>
          <p><strong>To Cancel:</strong> Send written notice by mail, email, or text to {{COMPANY_EMAIL}} or {{COMPANY_PHONE}}</p>
          <p><em>Note: This right to cancel does not apply to emergency repairs or contracts under $25.</em></p>
        </div>
      `
    },
    lienRights: {
      required: true,
      noticeRequired: true,
      noticeDays: 60,
      verbiage: `
        <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h4 style="color: #92400e; font-weight: bold;">⚠️ WISCONSIN LIEN RIGHTS NOTICE</h4>
          <p style="font-size: 13px; line-height: 1.6;">
            Under Wisconsin Statute Section 779.02, contractors and suppliers have the right to file a construction lien against your property for unpaid work or materials. This notice is required to preserve lien rights. To protect yourself, you may request lien waivers from all contractors and suppliers upon payment.
          </p>
          <p style="font-size: 12px; margin-top: 10px;"><strong>Notice Date:</strong> {{NOTICE_DATE}}</p>
        </div>
      `
    },
    warranty: {
      minimumYears: 1,
      verbiage: 'This work is warranted against defects in workmanship for a period of one (1) year from completion.'
    },
    emergencyRepairs: {
      exemptFromCancel: true,
      definition: 'Repairs to prevent imminent damage to health, safety, or property'
    },
    homeImprovement: {
      registrationRequired: false,
      bondRequired: false,
      verbiage: 'Contractor maintains appropriate insurance coverage as required by Wisconsin law.'
    },
    additionalClauses: [
      'Work performed in compliance with Wisconsin Uniform Dwelling Code',
      'All applicable permits obtained from local authorities'
    ]
  },

  // Add more states as needed
  DEFAULT: {
    state: 'DEFAULT',
    stateName: 'Default',
    contractorLicense: {
      required: false,
      display: 'Licensed and Insured Contractor'
    },
    threeDayCancel: {
      required: true,
      days: 3,
      exclusions: ['emergency repairs'],
      verbiage: `
        <div style="background: #fef2f2; border: 3px solid #dc2626; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #991b1b; font-weight: bold; margin-bottom: 12px;">🛡️ YOUR RIGHT TO CANCEL</h3>
          <p><strong>You have the right to cancel this home improvement contract within three (3) business days.</strong></p>
          <p><strong>Contract Date:</strong> {{CONTRACT_DATE}}<br>
          <strong>Cancellation Deadline:</strong> {{CANCEL_DEADLINE}} by midnight</p>
          <p><strong>To Cancel:</strong> Send written notice by mail, email, or text to {{COMPANY_EMAIL}} or {{COMPANY_PHONE}}</p>
          <p><em>Note: This right to cancel does not apply to emergency repairs.</em></p>
        </div>
      `
    },
    lienRights: {
      required: true,
      noticeRequired: false,
      verbiage: `
        <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h4 style="color: #92400e; font-weight: bold;">⚠️ LIEN RIGHTS NOTICE</h4>
          <p style="font-size: 13px; line-height: 1.6;">
            Contractors and suppliers may have the right to file liens against your property for unpaid work or materials. To protect yourself, request lien waivers upon payment.
          </p>
        </div>
      `
    },
    warranty: {
      minimumYears: 1,
      verbiage: 'This work is warranted against defects in workmanship for a period of one (1) year from completion.'
    },
    emergencyRepairs: {
      exemptFromCancel: true,
      definition: 'Repairs necessary to prevent damage or ensure safety'
    },
    homeImprovement: {
      registrationRequired: false,
      bondRequired: false,
      verbiage: 'Licensed and insured contractor.'
    },
    additionalClauses: [
      'Work performed in compliance with local building codes',
      'All applicable permits obtained from local authorities'
    ]
  }
};

/**
 * Get legal requirements for a specific state
 */
export function getStateLegalRequirements(state?: string): StateLegalRequirement {
  if (!state) return STATE_LEGAL_REQUIREMENTS.DEFAULT;
  
  const normalizedState = state.toUpperCase();
  return STATE_LEGAL_REQUIREMENTS[normalizedState] || STATE_LEGAL_REQUIREMENTS.DEFAULT;
}

/**
 * Generate state-specific legal clauses for document templates
 */
export function generateStateLegalClauses(state?: string, contractDate?: string): string {
  const requirements = getStateLegalRequirements(state);
  let clauses = '';

  // Three-day cancellation clause
  if (requirements.threeDayCancel.required) {
    const today = contractDate || new Date().toLocaleDateString();
    const cancelDeadline = new Date(Date.now() + requirements.threeDayCancel.days * 24 * 60 * 60 * 1000).toLocaleDateString();
    
    clauses += requirements.threeDayCancel.verbiage
      .replace('{{CONTRACT_DATE}}', today)
      .replace('{{CANCEL_DEADLINE}}', cancelDeadline);
  }

  // Lien rights notice
  if (requirements.lienRights.required) {
    const noticeDate = new Date().toLocaleDateString();
    clauses += requirements.lienRights.verbiage
      .replace('{{NOTICE_DATE}}', noticeDate);
  }

  return clauses;
}

/**
 * Get contractor license display for a state
 */
export function getContractorLicenseDisplay(state?: string, licenseNumber?: string): string {
  const requirements = getStateLegalRequirements(state);
  if (!requirements.contractorLicense.required || !licenseNumber) {
    return requirements.contractorLicense.display;
  }
  
  return requirements.contractorLicense.display.replace('{{CONTRACTOR_LICENSE}}', licenseNumber);
}

/**
 * Validate if emergency repair exemption applies
 */
export function isEmergencyRepairExempt(state?: string): boolean {
  const requirements = getStateLegalRequirements(state);
  return requirements.emergencyRepairs.exemptFromCancel;
}
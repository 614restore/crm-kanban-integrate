/**
 * Legal Clauses for Contractor Documents
 * Reusable components for Contingency and 3-Day Right to Cancel
 */

import React from 'react';

export interface ContingencyClauseProps {
  insuranceCompany?: string;
  claimNumber?: string;
}

export interface ThreeDayCancelProps {
  contractDate?: string;
  cancelDeadline?: string;
}

/**
 * Contingency upon Insurance Approval Clause
 * Use in: Contracts, Work Orders, Change Orders, Authorizations
 */
export function ContingencyClause({ insuranceCompany, claimNumber }: ContingencyClauseProps) {
  return (
    <div style={{
      background: '#fffbeb',
      border: '2px solid #f59e0b',
      borderRadius: '8px',
      padding: '20px',
      margin: '20px 0',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '12px',
        color: '#92400e',
        fontWeight: 'bold',
        fontSize: '16px',
      }}>
        <span style={{ fontSize: '24px' }}>⚠️</span>
        CONTINGENCY CLAUSE
      </div>
      
      <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#78350f' }}>
        <p style={{ margin: '0 0 10px 0' }}>
          <strong>This agreement is contingent upon approval and payment by the property insurance carrier.</strong>
        </p>
        
        <p style={{ margin: '0 0 10px 0' }}>
          The property owner understands and agrees that:
        </p>
        
        <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
          <li>Work will not commence until insurance approval is received</li>
          <li>Final payment is subject to insurance claim settlement</li>
          <li>
            If the insurance carrier {insuranceCompany ? `(${insuranceCompany})` : ''} denies the claim 
            {claimNumber ? ` (#${claimNumber})` : ''} or reduces the approved amount, 
            this contract may be modified or cancelled without penalty to either party
          </li>
          <li>The property owner remains responsible for any deductible amount and any work not covered by insurance</li>
          <li>Any dispute between the property owner and insurance carrier is separate from this contract</li>
        </ul>

        <p style={{ margin: '10px 0 0 0', fontWeight: '600' }}>
          The contractor will work directly with the insurance adjuster to ensure all approved work is completed 
          according to the claim settlement. Any additional work beyond the approved scope will require a separate 
          written authorization and payment arrangement.
        </p>
      </div>
    </div>
  );
}

/**
 * 3-Day Right to Cancel Clause (Federal Law Compliance)
 * Required for: All customer-signed contracts for residential work
 */
export function ThreeDayRightToCancel({ contractDate, cancelDeadline }: ThreeDayCancelProps) {
  const today = contractDate || new Date().toLocaleDateString();
  const deadline = cancelDeadline || (
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()
  );

  return (
    <div style={{
      background: '#fef2f2',
      border: '3px solid #dc2626',
      borderRadius: '8px',
      padding: '20px',
      margin: '20px 0',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '12px',
        color: '#991b1b',
        fontWeight: 'bold',
        fontSize: '18px',
      }}>
        <span style={{ fontSize: '28px' }}>🛡️</span>
        YOUR RIGHT TO CANCEL
      </div>
      
      <div style={{ fontSize: '14px', lineHeight: '1.7', color: '#7f1d1d' }}>
        <p style={{ margin: '0 0 12px 0', fontWeight: 'bold', fontSize: '15px' }}>
          You, the customer, have the right to cancel this contract within three (3) business days.
        </p>
        
        <div style={{
          background: 'white',
          padding: '12px',
          borderRadius: '6px',
          margin: '12px 0',
          border: '1px solid #fca5a5',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '6px 0', color: '#991b1b', fontWeight: '600' }}>Contract Date:</td>
                <td style={{ padding: '6px 0', color: '#1f2937', fontWeight: 'bold' }}>{today}</td>
              </tr>
              <tr>
                <td style={{ padding: '6px 0', color: '#991b1b', fontWeight: '600' }}>Cancellation Deadline:</td>
                <td style={{ padding: '6px 0', color: '#1f2937', fontWeight: 'bold' }}>{deadline} by midnight</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p style={{ margin: '12px 0', fontWeight: '600' }}>
          TO CANCEL THIS CONTRACT:
        </p>

        <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px' }}>
          <li>Send written notice of cancellation by mail, email, or text message</li>
          <li>Notice must be sent before midnight on the cancellation deadline shown above</li>
          <li>You do NOT need to provide a reason for cancellation</li>
          <li>Keep a copy of your cancellation notice for your records</li>
        </ul>

        <div style={{
          background: '#fef3c7',
          padding: '10px',
          borderRadius: '6px',
          border: '1px solid #fbbf24',
          marginTop: '12px',
        }}>
          <p style={{ margin: '0', fontSize: '13px', color: '#78350f' }}>
            <strong>📧 Send cancellation to:</strong> {'{COMPANY_EMAIL}'} or {'{COMPANY_PHONE}'}
          </p>
        </div>

        <p style={{ margin: '12px 0 0 0', fontSize: '12px', fontStyle: 'italic' }}>
          If you cancel within the 3-day period, any payments you have made will be returned within 10 business days. 
          This right to cancel does not apply to emergency repairs necessary to protect persons or property.
        </p>
      </div>
    </div>
  );
}

/**
 * Combined Legal Section (Contingency + 3-Day Cancel)
 * Use this for contracts and major agreements
 */
export function LegalComplianceSection({
  insuranceCompany,
  claimNumber,
  contractDate,
  cancelDeadline,
}: ContingencyClauseProps & ThreeDayCancelProps) {
  return (
    <div style={{ margin: '30px 0' }}>
      <div style={{
        fontSize: '20px',
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: '20px',
        paddingBottom: '10px',
        borderBottom: '2px solid #e5e7eb',
      }}>
        IMPORTANT LEGAL TERMS & CONDITIONS
      </div>
      
      <ContingencyClause 
        insuranceCompany={insuranceCompany} 
        claimNumber={claimNumber} 
      />
      
      <ThreeDayRightToCancel 
        contractDate={contractDate} 
        cancelDeadline={cancelDeadline} 
      />
    </div>
  );
}

/**
 * HTML string versions for template injection
 */

export function getContingencyClauseHtml(insuranceCompany?: string, claimNumber?: string): string {
  return `
    <div style="background: #fffbeb; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; color: #92400e; font-weight: bold; font-size: 16px;">
        <span style="font-size: 24px;">⚠️</span>
        CONTINGENCY CLAUSE
      </div>
      <div style="font-size: 14px; line-height: 1.6; color: #78350f;">
        <p style="margin: 0 0 10px 0;"><strong>This agreement is contingent upon approval and payment by the property insurance carrier.</strong></p>
        <p style="margin: 0 0 10px 0;">The property owner understands and agrees that:</p>
        <ul style="margin: 0 0 10px 0; padding-left: 20px;">
          <li>Work will not commence until insurance approval is received</li>
          <li>Final payment is subject to insurance claim settlement</li>
          <li>If the insurance carrier ${insuranceCompany ? `(${insuranceCompany})` : ''} denies the claim ${claimNumber ? `(#${claimNumber})` : ''} or reduces the approved amount, this contract may be modified or cancelled without penalty to either party</li>
          <li>The property owner remains responsible for any deductible amount and any work not covered by insurance</li>
          <li>Any dispute between the property owner and insurance carrier is separate from this contract</li>
        </ul>
        <p style="margin: 10px 0 0 0; font-weight: 600;">The contractor will work directly with the insurance adjuster to ensure all approved work is completed according to the claim settlement. Any additional work beyond the approved scope will require a separate written authorization and payment arrangement.</p>
      </div>
    </div>
  `;
}

export function getThreeDayCancelHtml(contractDate?: string, cancelDeadline?: string): string {
  const today = contractDate || '{{CONTRACT_DATE}}';
  const deadline = cancelDeadline || '{{CANCEL_DEADLINE}}';
  
  return `
    <div style="background: #fef2f2; border: 3px solid #dc2626; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; color: #991b1b; font-weight: bold; font-size: 18px;">
        <span style="font-size: 28px;">🛡️</span>
        YOUR RIGHT TO CANCEL
      </div>
      <div style="font-size: 14px; line-height: 1.7; color: #7f1d1d;">
        <p style="margin: 0 0 12px 0; font-weight: bold; font-size: 15px;">You, the customer, have the right to cancel this contract within three (3) business days.</p>
        <div style="background: white; padding: 12px; border-radius: 6px; margin: 12px 0; border: 1px solid #fca5a5;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; color: #991b1b; font-weight: 600;">Contract Date:</td><td style="padding: 6px 0; color: #1f2937; font-weight: bold;">${today}</td></tr>
            <tr><td style="padding: 6px 0; color: #991b1b; font-weight: 600;">Cancellation Deadline:</td><td style="padding: 6px 0; color: #1f2937; font-weight: bold;">${deadline} by midnight</td></tr>
          </table>
        </div>
        <p style="margin: 12px 0; font-weight: 600;">TO CANCEL THIS CONTRACT:</p>
        <ul style="margin: 0 0 12px 0; padding-left: 20px;">
          <li>Send written notice of cancellation by mail, email, or text message</li>
          <li>Notice must be sent before midnight on the cancellation deadline shown above</li>
          <li>You do NOT need to provide a reason for cancellation</li>
          <li>Keep a copy of your cancellation notice for your records</li>
        </ul>
        <div style="background: #fef3c7; padding: 10px; border-radius: 6px; border: 1px solid #fbbf24; margin-top: 12px;">
          <p style="margin: 0; font-size: 13px; color: #78350f;"><strong>📧 Send cancellation to:</strong> {{COMPANY_EMAIL}} or {{COMPANY_PHONE}}</p>
        </div>
        <p style="margin: 12px 0 0 0; font-size: 12px; font-style: italic;">If you cancel within the 3-day period, any payments you have made will be returned within 10 business days. This right to cancel does not apply to emergency repairs necessary to protect persons or property.</p>
      </div>
    </div>
  `;
}

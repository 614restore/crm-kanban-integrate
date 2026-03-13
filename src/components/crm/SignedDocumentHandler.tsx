/**
 * Signed Document Handler
 * Orchestrates the complete workflow when a customer signs a document:
 * 1. Generate signed PDF version
 * 2. Upload to Supabase Storage
 * 3. Mark document status as "Signed"
 * 4. Attach to communication timeline
 * 5. Email signed PDF to sales rep
 */

import { toast } from 'sonner';
import { generateAndUploadPdf, downloadPdf } from '@/lib/pdfService';
import { db } from '@/lib/database';
import { sendEmail } from '@/lib/emailApi';
import type { Contact, Communication } from '@/lib/crmData';

export interface SignedDocumentMetadata {
  documentId: string;
  documentType: string;
  documentName: string;
  contactId: string;
  contactName: string;
  companyId: string;
  companyName: string;
  salesRepEmail: string;
  salesRepName: string;
  signatureDataUrl: string;
  signedAt: string;
}

export interface SignedDocumentResult {
  success: boolean;
  pdfUrl?: string;
  storagePath?: string;
  communicationId?: string;
  error?: string;
}

/**
 * Complete signed document workflow
 */
export async function processSignedDocument(
  htmlElement: HTMLElement,
  metadata: SignedDocumentMetadata
): Promise<SignedDocumentResult> {
  try {
    toast.info('Processing signed document...');

    // Step 1: Generate PDF with signature and upload to storage
    const pdfResult = await generateAndUploadPdf(
      htmlElement,
      metadata.companyId,
      metadata.contactId,
      metadata.documentId,
      metadata.documentType
    );

    toast.success('PDF generated and stored');

    // Step 2: Update document record - mark as signed
    try {
      await db.updateDocument(metadata.documentId, {
        status: 'signed',
        signed_at: metadata.signedAt,
        signed_pdf_url: pdfResult.publicUrl,
        signature_data_url: metadata.signatureDataUrl,
      });
    } catch (error) {
      console.warn('[SignedDocumentHandler] Failed to update document record:', error);
      // Continue workflow even if DB update fails
    }

    // Step 3: Create communication timeline entry
    let communicationId: string | undefined;
    try {
      const communication: Partial<Communication> = {
        contact_id: metadata.contactId,
        company_id: metadata.companyId,
        type: 'note',
        direction: 'inbound',
        content: `📄 Document signed: ${metadata.documentName}\n\nSigned by: ${metadata.contactName}\nSigned at: ${new Date(metadata.signedAt).toLocaleString()}\n\nPDF: ${pdfResult.publicUrl}`,
        timestamp: metadata.signedAt,
      };

      const created = await db.createCommunication(communication);
      if (created) {
        communicationId = created.id;
        toast.success('Added to communication timeline');
      }
    } catch (error) {
      console.warn('[SignedDocumentHandler] Failed to create communication:', error);
      // Continue workflow
    }

    // Step 4: Email signed PDF to sales rep
    try {
      const emailSubject = `✅ Signed Document: ${metadata.documentName} - ${metadata.contactName}`;
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">✅ Document Signed!</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 20px;">
              <h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px;">Document Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Document:</td>
                  <td style="padding: 8px 0; color: #1f2937;">${metadata.documentName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Type:</td>
                  <td style="padding: 8px 0; color: #1f2937;">${metadata.documentType}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Customer:</td>
                  <td style="padding: 8px 0; color: #1f2937; font-weight: bold;">${metadata.contactName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Signed At:</td>
                  <td style="padding: 8px 0; color: #1f2937;">${new Date(metadata.signedAt).toLocaleString()}</td>
                </tr>
              </table>
            </div>

            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>⚡ Action Required:</strong> The signed document has been attached to the customer timeline and stored in Supabase. 
                Review the document and proceed with the next steps in your workflow.
              </p>
            </div>

            <div style="text-align: center; margin-top: 25px;">
              <a href="${pdfResult.publicUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);">
                📄 View Signed PDF
              </a>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Sent from ${metadata.companyName} CRM • TrussCTR
              </p>
            </div>
          </div>
        </div>
      `;

      await sendEmail({
        to: metadata.salesRepEmail,
        subject: emailSubject,
        html: emailBody,
      });

      toast.success(`Email sent to ${metadata.salesRepName}`);
    } catch (error) {
      console.error('[SignedDocumentHandler] Failed to send email:', error);
      toast.warning('PDF saved, but email failed to send');
      // Don't fail entire workflow if email fails
    }

    // Step 5: Trigger download for customer (optional)
    downloadPdf(pdfResult.blob, `${metadata.documentName}-signed.pdf`);

    toast.success('✅ Document signing complete!');

    return {
      success: true,
      pdfUrl: pdfResult.publicUrl,
      storagePath: pdfResult.storagePath,
      communicationId,
    };
  } catch (error) {
    console.error('[SignedDocumentHandler] Workflow failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    toast.error(`Document signing failed: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Generate and download unsigned PDF (preview/draft)
 */
export async function generateDraftPdf(
  htmlElement: HTMLElement,
  documentName: string
): Promise<void> {
  try {
    toast.info('Generating PDF...');
    
    const { generateAndDownloadPdf } = await import('@/lib/pdfService');
    await generateAndDownloadPdf(htmlElement, `${documentName}-draft.pdf`);
    
    toast.success('PDF downloaded');
  } catch (error) {
    console.error('[SignedDocumentHandler] Draft PDF failed:', error);
    toast.error('Failed to generate PDF');
  }
}

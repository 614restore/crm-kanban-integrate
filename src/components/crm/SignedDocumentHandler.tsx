/**
 * Signed Document Handler
 * Orchestrates the complete workflow when a customer signs a document:
 * 1. Generate signed PDF
 * 2. Upload to Supabase Storage
 * 3. Log to communication timeline
 * 4. Email signed PDF to sales rep
 */

import { toast } from 'sonner';
import { generateAndUploadPdf, generateAndDownloadPdf, downloadPdf } from '@/lib/pdfService';
import { db } from '@/lib/database';
import { sendEmail } from '@/lib/emailApi';

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

    // 1. Generate PDF + upload to Supabase Storage
    const pdfResult = await generateAndUploadPdf(
      htmlElement,
      metadata.companyId,
      metadata.contactId,
      metadata.documentId,
      metadata.documentType
    );
    toast.success('PDF generated and stored');

    // 2. Log to communication timeline (stores PDF URL + signature note)
    let communicationId: string | undefined;
    try {
      const created = await db.createCommunication({
        contact_id: metadata.contactId,
        company_id: metadata.companyId,
        type: 'note',
        direction: 'inbound',
        content: [
          `📄 Document signed: ${metadata.documentName}`,
          `Signed by: ${metadata.contactName}`,
          `Signed at: ${new Date(metadata.signedAt).toLocaleString()}`,
          `PDF: ${pdfResult.publicUrl}`,
        ].join('\n'),
      });
      if (created) {
        communicationId = created.id;
        toast.success('Added to communication timeline');
      }
    } catch (err) {
      console.warn('[SignedDocumentHandler] Timeline log failed (non-fatal):', err);
    }

    // 3. Email signed PDF to sales rep
    try {
      await sendEmail({
        to: metadata.salesRepEmail,
        subject: `✅ Signed: ${metadata.documentName} — ${metadata.contactName}`,
        html: buildSignedEmail(metadata, pdfResult.publicUrl),
      });
      toast.success(`Email sent to ${metadata.salesRepName}`);
    } catch (err) {
      console.error('[SignedDocumentHandler] Email failed (non-fatal):', err);
      toast.warning('PDF saved, but email failed to send');
    }

    // 4. Trigger download for customer copy
    downloadPdf(pdfResult.blob, `${metadata.documentName}-signed.pdf`);

    toast.success('✅ Document signing complete!');

    return {
      success: true,
      pdfUrl: pdfResult.publicUrl,
      storagePath: pdfResult.storagePath,
      communicationId,
    };
  } catch (err) {
    console.error('[SignedDocumentHandler] Workflow failed:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    toast.error(`Document signing failed: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * Generate and download unsigned draft PDF (preview)
 */
export async function generateDraftPdf(
  htmlElement: HTMLElement,
  documentName: string
): Promise<void> {
  try {
    toast.info('Generating PDF...');
    await generateAndDownloadPdf(htmlElement, `${documentName}-draft.pdf`);
    toast.success('PDF downloaded');
  } catch (err) {
    console.error('[SignedDocumentHandler] Draft PDF failed:', err);
    toast.error('Failed to generate PDF');
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildSignedEmail(meta: SignedDocumentMetadata, pdfUrl: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:white;padding:30px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="margin:0;font-size:28px;">✅ Document Signed!</h1>
      </div>
      <div style="background:#f9fafb;padding:30px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;">
        <div style="background:white;padding:20px;border-radius:8px;border-left:4px solid #10b981;margin-bottom:20px;">
          <h2 style="margin:0 0 15px 0;color:#1f2937;font-size:18px;">Document Details</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#6b7280;font-weight:600;">Document:</td><td style="padding:8px 0;color:#1f2937;">${meta.documentName}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;font-weight:600;">Type:</td><td style="padding:8px 0;color:#1f2937;">${meta.documentType}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;font-weight:600;">Customer:</td><td style="padding:8px 0;color:#1f2937;font-weight:bold;">${meta.contactName}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;font-weight:600;">Signed At:</td><td style="padding:8px 0;color:#1f2937;">${new Date(meta.signedAt).toLocaleString()}</td></tr>
          </table>
        </div>
        <div style="background:#fef3c7;padding:15px;border-radius:8px;border-left:4px solid #f59e0b;margin-bottom:20px;">
          <p style="margin:0;color:#92400e;font-size:14px;"><strong>⚡ Action Required:</strong> Review the signed document and proceed with your next workflow step.</p>
        </div>
        <div style="text-align:center;margin-top:25px;">
          <a href="${pdfUrl}" style="display:inline-block;background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">📄 View Signed PDF</a>
        </div>
        <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">Sent from ${meta.companyName} CRM • TrussCTR</p>
        </div>
      </div>
    </div>
  `;
}

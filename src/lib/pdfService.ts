/**
 * PDF Service - Client-side HTML to PDF conversion and storage
 * Uses html2pdf.js for rendering and Supabase Storage for persistence
 */

import html2pdf from 'html2pdf.js';
import { supabase } from './supabase';

export interface PdfGenerationOptions {
  filename: string;
  margin?: number;
  image?: { type: string; quality: number };
  html2canvas?: { scale: number; useCORS: boolean };
  jsPDF?: { unit: string; format: string; orientation: string };
}

export interface GeneratedPdfResult {
  blob: Blob;
  url: string;
  storagePath: string;
  publicUrl: string;
}

/**
 * Generate PDF from HTML element and upload to Supabase Storage
 */
export async function generateAndUploadPdf(
  htmlElement: HTMLElement,
  companyId: string,
  contactId: string,
  documentId: string,
  documentType: string,
  options?: Partial<PdfGenerationOptions>
): Promise<GeneratedPdfResult> {
  // Default PDF options optimized for professional documents
  const defaultOptions: PdfGenerationOptions = {
    filename: `${documentType}-${documentId}.pdf`,
    margin: [10, 10, 10, 10],
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };

  const finalOptions = { ...defaultOptions, ...options };

  try {
    // Generate PDF blob from HTML
    const pdfBlob = await html2pdf()
      .set(finalOptions)
      .from(htmlElement)
      .outputPdf('blob');

    // Create storage path: documents/{companyId}/{contactId}/{documentId}-signed.pdf
    const timestamp = new Date().getTime();
    const storagePath = `documents/${companyId}/${contactId}/${documentId}-signed-${timestamp}.pdf`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(storagePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('documents')
      .getPublicUrl(storagePath);

    // Create temporary blob URL for immediate download
    const blobUrl = URL.createObjectURL(pdfBlob);

    return {
      blob: pdfBlob,
      url: blobUrl,
      storagePath: data.path,
      publicUrl: publicUrlData.publicUrl,
    };
  } catch (error) {
    console.error('[pdfService] PDF generation failed:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Download PDF blob to user's device
 */
export function downloadPdf(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate PDF and trigger immediate download (no upload)
 */
export async function generateAndDownloadPdf(
  htmlElement: HTMLElement,
  filename: string,
  options?: Partial<PdfGenerationOptions>
): Promise<void> {
  const defaultOptions: PdfGenerationOptions = {
    filename,
    margin: [10, 10, 10, 10],
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };

  const finalOptions = { ...defaultOptions, ...options };

  try {
    await html2pdf()
      .set(finalOptions)
      .from(htmlElement)
      .save();
  } catch (error) {
    console.error('[pdfService] PDF download failed:', error);
    throw new Error(`Failed to download PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a professional document header for PDFs
 */
export function createPdfHeader(companyName: string, documentTitle: string): string {
  return `
    <div style="border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px;">
      <div style="font-size: 28px; font-weight: bold; color: #2563eb; margin-bottom: 5px;">
        ${companyName}
      </div>
      <div style="text-align: center; font-size: 24px; font-weight: bold; margin-top: 20px;">
        ${documentTitle}
      </div>
    </div>
  `;
}

/**
 * Add watermark to PDF (e.g., "DRAFT", "SIGNED", "COPY")
 */
export function addWatermark(htmlElement: HTMLElement, text: string, opacity: number = 0.1): void {
  const watermark = document.createElement('div');
  watermark.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 120px;
    font-weight: bold;
    color: rgba(0, 0, 0, ${opacity});
    pointer-events: none;
    z-index: 9999;
    user-select: none;
  `;
  watermark.textContent = text;
  htmlElement.appendChild(watermark);
}

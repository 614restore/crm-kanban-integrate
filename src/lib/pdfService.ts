/**
 * PDF Service — client-side HTML→PDF conversion + Supabase Storage upload.
 * html2pdf.js is a CJS-only library; we import it via a dynamic import with
 * type: ignore to satisfy ESNext / bundler moduleResolution without require().
 */

// @ts-expect-error — html2pdf.js ships no ESM build; bundler (Vite) handles CJS interop at runtime
import _html2pdf from 'html2pdf.js';
import type { } from 'html2pdf.js'; // pulls in our declare module shim
import { supabase } from './supabase';

// Typed wrapper so call-sites get autocompletion
const html2pdf = _html2pdf as typeof import('html2pdf.js');

export interface PdfGenerationOptions {
  filename: string;
  margin?: number | number[];
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

/** Generate PDF from an HTML element and upload to Supabase Storage. */
export async function generateAndUploadPdf(
  htmlElement: HTMLElement,
  companyId: string,
  contactId: string,
  documentId: string,
  documentType: string,
  options?: Partial<PdfGenerationOptions>
): Promise<GeneratedPdfResult> {
  const finalOptions = {
    filename: `${documentType}-${documentId}.pdf`,
    margin: [10, 10, 10, 10],
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    ...options,
  };

  const pdfBlob: Blob = await html2pdf()
    .set(finalOptions)
    .from(htmlElement)
    .outputPdf('blob');

  const storagePath = `documents/${companyId}/${contactId}/${documentId}-signed-${Date.now()}.pdf`;

  const { data, error } = await supabase.storage
    .from('documents')
    .upload(storagePath, pdfBlob, { contentType: 'application/pdf', upsert: false });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(storagePath);

  return {
    blob: pdfBlob,
    url: URL.createObjectURL(pdfBlob),
    storagePath: data.path,
    publicUrl: publicUrlData.publicUrl,
  };
}

/** Trigger a browser download of a PDF blob. */
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

/** Generate PDF and immediately download it — no Supabase upload. */
export async function generateAndDownloadPdf(
  htmlElement: HTMLElement,
  filename: string,
  options?: Partial<PdfGenerationOptions>
): Promise<void> {
  const finalOptions = {
    filename,
    margin: [10, 10, 10, 10],
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    ...options,
  };
  await html2pdf().set(finalOptions).from(htmlElement).save();
}

/** Build a branded header string to inject at the top of PDF HTML. */
export function createPdfHeader(companyName: string, documentTitle: string): string {
  return `
    <div style="border-bottom:3px solid #2563eb;padding-bottom:20px;margin-bottom:30px;">
      <div style="font-size:28px;font-weight:bold;color:#2563eb;">${companyName}</div>
      <div style="text-align:center;font-size:24px;font-weight:bold;margin-top:20px;">${documentTitle}</div>
    </div>`;
}

/** Overlay a watermark on an element (e.g., DRAFT / SIGNED). */
export function addWatermark(htmlElement: HTMLElement, text: string, opacity = 0.1): void {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'top:50%', 'left:50%',
    'transform:translate(-50%,-50%) rotate(-45deg)',
    'font-size:120px', 'font-weight:bold',
    `color:rgba(0,0,0,${opacity})`,
    'pointer-events:none', 'z-index:9999', 'user-select:none',
  ].join(';');
  el.textContent = text;
  htmlElement.appendChild(el);
}

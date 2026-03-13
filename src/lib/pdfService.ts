/**
 * PDF Service — HTML→PDF (html2pdf.js) + Supabase Storage upload.
 *
 * html2pdf.js is a legacy CJS-only bundle. We load it at runtime via a script
 * tag so neither tsc nor Vite's bundler ever tries to statically resolve it.
 * The library attaches itself to window.html2pdf after loading.
 */
import { supabase } from './supabase';

// ---- types for the html2pdf chain API ----
interface Html2PdfWorker {
  set(options: Record<string, unknown>): Html2PdfWorker;
  from(el: HTMLElement): Html2PdfWorker;
  outputPdf(type: 'blob'): Promise<Blob>;
  save(): Promise<void>;
}

type Html2PdfFn = () => Html2PdfWorker;

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    html2pdf?: Html2PdfFn;
  }
}

const CDN_URL =
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js';

let loadPromise: Promise<Html2PdfFn> | null = null;

function loadHtml2Pdf(): Promise<Html2PdfFn> {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CDN_URL;
    script.onload = () => {
      if (window.html2pdf) resolve(window.html2pdf);
      else reject(new Error('html2pdf loaded but window.html2pdf is undefined'));
    };
    script.onerror = () => reject(new Error('Failed to load html2pdf.js from CDN'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

// ---- public types ----
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

function defaultOptions(filename: string, overrides?: Partial<PdfGenerationOptions>): Record<string, unknown> {
  return {
    filename,
    margin: [10, 10, 10, 10],
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    ...overrides,
  };
}

/** Generate PDF, upload to Supabase Storage, return URLs. */
export async function generateAndUploadPdf(
  htmlElement: HTMLElement,
  companyId: string,
  contactId: string,
  documentId: string,
  documentType: string,
  options?: Partial<PdfGenerationOptions>
): Promise<GeneratedPdfResult> {
  const html2pdf = await loadHtml2Pdf();
  const filename = `${documentType}-${documentId}.pdf`;

  const pdfBlob: Blob = await html2pdf()
    .set(defaultOptions(filename, options))
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

/** Trigger a browser download of a Blob. */
export function downloadPdf(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Generate PDF and immediately prompt download — no Supabase upload. */
export async function generateAndDownloadPdf(
  htmlElement: HTMLElement,
  filename: string,
  options?: Partial<PdfGenerationOptions>
): Promise<void> {
  const html2pdf = await loadHtml2Pdf();
  await html2pdf().set(defaultOptions(filename, options)).from(htmlElement).save();
}

/** Branded header HTML for injecting at the top of a document before PDF render. */
export function createPdfHeader(companyName: string, documentTitle: string): string {
  return `
    <div style="border-bottom:3px solid #2563eb;padding-bottom:20px;margin-bottom:30px;">
      <div style="font-size:28px;font-weight:bold;color:#2563eb;">${companyName}</div>
      <div style="text-align:center;font-size:24px;font-weight:bold;margin-top:20px;">${documentTitle}</div>
    </div>`;
}

/** Overlay a watermark text on an element before rendering to PDF. */
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

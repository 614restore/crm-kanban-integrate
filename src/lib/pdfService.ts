import { supabase } from './supabase';
import { buildStoredDocumentUrl } from './documentAccess';

interface Html2PdfWorker {
  set(options: Record<string, unknown>): Html2PdfWorker;
  from(el: HTMLElement): Html2PdfWorker;
  outputPdf(type: 'blob'): Promise<Blob>;
  save(): Promise<void>;
}

type Html2PdfFn = () => Html2PdfWorker;

let loadPromise: Promise<Html2PdfFn> | null = null;

function loadHtml2Pdf(): Promise<Html2PdfFn> {
  if (loadPromise) return loadPromise;

  loadPromise = import('html2pdf.js')
    .catch(() => {
      // First attempt failed (stale service worker cache / chunk hash mismatch).
      // Clear the cached promise and retry once — this forces a fresh network fetch.
      loadPromise = null;
      return import('html2pdf.js');
    })
    .then((module: any) => {
      const html2pdf = module?.default || module;
      if (!html2pdf) {
        throw new Error('html2pdf.js failed to load from local bundle');
      }
      return html2pdf as Html2PdfFn;
    });

  return loadPromise;
}

function buildOptions(filename: string, overrides?: Record<string, unknown>) {
  return {
    filename,
    margin: [10, 10, 10, 10],
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    ...overrides,
  };
}

const DOCUMENT_UPLOAD_BUCKETS = ['documents', 'projectceo-photos'] as const;

export async function uploadToAvailableBucket(
  storagePath: string,
  file: Blob,
  contentType: string,
  companyId?: string
) {
  let lastError: Error | null = null;

  for (const bucket of DOCUMENT_UPLOAD_BUCKETS) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file, { contentType, upsert: false });

    if (!error && data) {
      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
      const { data: signedUrlData } = await supabase.storage.from(bucket).createSignedUrl(data.path, 60 * 60);
      return {
        bucket,
        path: data.path,
        publicUrl: publicUrlData.publicUrl,
        signedUrl: signedUrlData?.signedUrl || publicUrlData.publicUrl,
      };
    }

    lastError = new Error(error?.message || `Upload failed for bucket ${bucket}`);
    if (!error?.message?.toLowerCase().includes('bucket')) {
      break;
    }
  }

  throw lastError || new Error('No available storage bucket for document upload');
}

export async function generateAndUploadPdf(
  htmlElement: HTMLElement,
  companyId: string,
  contactId: string,
  documentId: string,
  documentType: string,
  filename: string
) {
  const html2pdf = await loadHtml2Pdf();
  const pdfBlob: Blob = await html2pdf()
    .set(buildOptions(filename))
    .from(htmlElement)
    .outputPdf('blob');

  const storagePath = `${companyId}/${contactId}/${documentType}-${documentId}-${Date.now()}.pdf`;
  const uploaded = await uploadToAvailableBucket(storagePath, pdfBlob, 'application/pdf', companyId);

  return {
    blob: pdfBlob,
    storagePath: uploaded.path,
    publicUrl: uploaded.publicUrl,
    storedUrl: buildStoredDocumentUrl(uploaded.publicUrl, uploaded.bucket, uploaded.path),
    bucket: uploaded.bucket,
  };
}

export async function generateAndDownloadPdf(
  htmlElement: HTMLElement,
  filename: string
) {
  const html2pdf = await loadHtml2Pdf();
  await html2pdf().set(buildOptions(filename)).from(htmlElement).save();
}

/**
 * Convert an HTML string to a PDF Blob by mounting it off-screen,
 * running html2pdf, then removing it.
 */
export async function htmlStringToPdfBlob(html: string, filename: string): Promise<Blob> {
  // Use a hidden iframe so the full HTML document (including <style> in <head>) renders
  // correctly. Setting innerHTML on a <div> strips <html>/<head>/<body> tags and
  // the embedded <style> may not be applied, producing a blank PDF.
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;height:297mm;border:none;visibility:hidden;';
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) throw new Error('Could not access iframe document');
    doc.open();
    doc.write(html);
    doc.close();
    // Wait for layout to settle
    await new Promise(resolve => setTimeout(resolve, 300));
    const html2pdf = await loadHtml2Pdf();
    const blob: Blob = await html2pdf()
      .set(buildOptions(filename))
      .from(doc.body)
      .outputPdf('blob');
    return blob;
  } finally {
    document.body.removeChild(iframe);
  }
}

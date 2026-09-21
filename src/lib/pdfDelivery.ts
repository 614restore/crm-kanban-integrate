/**
 * What to do with a generated PDF once it exists: open it, save it, or put it
 * somewhere a customer can reach it.
 *
 * These used to live inside DocumentsWizard, which meant every other screen
 * that produced a PDF could only ever call doc.save() — the photo report was
 * download-only for exactly that reason.
 */
import type jsPDF from 'jspdf';
import { supabase } from '@/lib/supabase';

/** Bucket that already holds shared measurement reports and signed documents. */
const REPORT_BUCKET = 'signed-quotes';

const isMobile = (): boolean =>
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
  ('ontouchstart' in window && navigator.maxTouchPoints > 0);

/**
 * Opens the document in a new tab, or saves it.
 *
 * Mobile always saves: on iOS Safari a window.open() of a blob URL is blocked
 * once the original tap is no longer a trusted gesture, which every one of
 * these call sites is by the time an async generator has finished.
 */
export const openOrSavePdf = (
  doc: jsPDF,
  fileName: string,
  mode: 'view' | 'download',
): void => {
  if (mode === 'view' && !isMobile()) {
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(fileName);
  }
};

/**
 * Uploads the document to storage and returns a public URL for sharing.
 *
 * Each upload is timestamped rather than overwriting a per-quote path, so a
 * link already sent to a customer keeps resolving to the document they were
 * sent even after the report is regenerated.
 */
export const uploadPdfForSharing = async (
  doc: jsPDF,
  fileName: string,
  companyId: string,
): Promise<string> => {
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `reports/${companyId}/${Date.now()}-${safeName}`;
  const blob = doc.output('blob');

  const { error } = await supabase.storage
    .from(REPORT_BUCKET)
    .upload(path, blob, { contentType: 'application/pdf', upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(REPORT_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Upload succeeded but no public URL was returned');
  return data.publicUrl;
};

/**
 * Copies text, falling back to a hidden textarea where the async clipboard API
 * is unavailable (older Safari, and any non-secure context).
 */
export const copyToClipboard = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // fall through
  }
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
  document.body.appendChild(el);
  el.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(el);
  }
};

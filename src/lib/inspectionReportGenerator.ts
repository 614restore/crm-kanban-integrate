// Copied from QuoteMGR src/lib/inspectionReportGenerator.ts (read-only reference).
/**
 * Web Inspection Photo Report Generator
 *
 * Fetches all inspection photos, compresses each one to ≤ 100 KB using the
 * Canvas API (no native dependencies), then lays them out into a PDF with
 * jsPDF and saves it directly — no print dialog, and the file size is ours
 * to control rather than the browser print engine's.
 */

interface Photo {
  id: string;
  photo_url: string;
  caption?: string | null;
  damage_type?: string | string[] | null;
  damage_cause?: string | string[] | null;
  location?: string | string[] | null;
  sort_order?: number;
}

interface Company {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  logo_url?: string | null;
  quote_primary_color?: string | null;
  quote_accent_color?: string | null;
}

interface InspectionReportOptions {
  quote: {
    quote_number: string;
    cover_page_title?: string | null;
    project_description?: string | null;
    created_at: string;
    cover_photo_url?: string | null;
  };
  photos: Photo[];
  company: Company;
  customer: {
    first_name: string;
    last_name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  };
  onProgress?: (msg: string) => void;
}

// ─── Canvas-based compression ─────────────────────────────────────────────────

const fetchAndCompressToDataUri = async (
  url: string,
  targetKB = 90,
): Promise<string> => {
  try {
    // Fetch the image via a blob (avoids CORS issues with crossOrigin img)
    const resp = await fetch(url, {mode: 'cors'});
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = blobUrl;
    });
    URL.revokeObjectURL(blobUrl);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    // Start with a max dimension of 1200px, reduce if needed
    let maxDim = 1200;
    let quality = 0.80;

    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const dataUri = canvas.toDataURL('image/jpeg', quality);
      // Estimate size: base64 is ~4/3 of binary, minus the data URI prefix
      const estimatedKB = ((dataUri.length - dataUri.indexOf(',') - 1) * 0.75) / 1024;

      if (estimatedKB <= targetKB || (quality <= 0.3 && maxDim <= 600)) {
        return dataUri;
      }

      // Tighten compression for next pass
      if (quality > 0.3) {
        quality = Math.max(0.3, quality - 0.12);
      } else {
        maxDim = Math.max(600, Math.round(maxDim * 0.75));
        quality = 0.55; // reset quality when shrinking dimensions
      }
    }

    return canvas.toDataURL('image/jpeg', quality);
  } catch (err) {
    console.warn('inspectionReportGenerator: failed to compress', url, err);
    return url; // fall back to original URL
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return '';
  return new Date(typeof d === 'string' ? d : d).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
};


// ─── Public API ───────────────────────────────────────────────────────────────

/** #rrggbb -> [r,g,b] for jsPDF's setFillColor/setTextColor. */
const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [30, 58, 95];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const generateInspectionReportPDF = async (
  options: InspectionReportOptions,
): Promise<void> => {
  const {photos, company, quote, onProgress} = options;

  onProgress?.('Compressing photos…');

  // Compress all photos (4 at a time)
  const compressed: string[] = new Array(photos.length).fill('');
  const BATCH = 4;
  for (let i = 0; i < photos.length; i += BATCH) {
    const batch = photos.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(p => fetchAndCompressToDataUri(p.photo_url, 90)));
    results.forEach((r, j) => { compressed[i + j] = r; });
    onProgress?.(`Compressing photos… ${Math.min(i + BATCH, photos.length)} / ${photos.length}`);
  }

  let coverDataUri = '';
  if (quote.cover_photo_url) {
    onProgress?.('Processing cover photo…');
    coverDataUri = await fetchAndCompressToDataUri(quote.cover_photo_url, 120);
  }

  onProgress?.('Building report…');

  // Built with jsPDF rather than rendering HTML through the browser's print
  // dialog: this downloads a file straight away (no dialog, nothing for the
  // user to configure) and the photos are embedded at the size they're
  // actually drawn, so a 30-photo report stays a few MB instead of whatever
  // the browser's print engine decides to do with them.
  const {default: jsPDF} = await import('jspdf');
  const doc = new jsPDF({unit: 'pt', format: 'letter'});

  const PAGE_W = doc.internal.pageSize.getWidth();   // 612
  const PAGE_H = doc.internal.pageSize.getHeight();  // 792
  const MARGIN = 40;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const primary = hexToRgb(company.quote_primary_color || '#1e3a5f');
  const accent = hexToRgb(company.quote_accent_color || '#ff6b35');

  /** Draws an image inside a box, preserving aspect ratio and centering it. */
  const drawFitted = (dataUri: string, x: number, y: number, boxW: number, boxH: number) => {
    let w = boxW;
    let h = boxH;
    try {
      const props = doc.getImageProperties(dataUri);
      const scale = Math.min(boxW / props.width, boxH / props.height);
      w = props.width * scale;
      h = props.height * scale;
    } catch {
      /* unreadable image — fall back to filling the box */
    }
    doc.addImage(dataUri, 'JPEG', x + (boxW - w) / 2, y + (boxH - h) / 2, w, h, undefined, 'FAST');
  };

  const drawPageHeader = (title: string) => {
    doc.setFillColor(...primary);
    doc.rect(0, 0, PAGE_W, 52, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(company.name || '', MARGIN, 24);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(210, 220, 235);
    doc.text(title, MARGIN, 39);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(`Quote #${quote.quote_number}`, PAGE_W - MARGIN, 24, {align: 'right'});
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `${company.name} · Inspection Report · ${photos.length} photos`,
      MARGIN, PAGE_H - 22,
    );
    doc.text(`Page ${pageNum} of ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 22, {align: 'right'});
  };

  // 2 columns x 3 rows per photo page
  const COLS = 2;
  const ROWS = 3;
  const PER_PAGE = COLS * ROWS;
  const GUTTER = 16;
  const CELL_W = (CONTENT_W - GUTTER * (COLS - 1)) / COLS;
  const IMG_H = 170;
  const CAPTION_H = 34;
  const ROW_H = IMG_H + CAPTION_H + 18;
  const totalPages = 1 + Math.max(1, Math.ceil(photos.length / PER_PAGE));

  // ── Page 1: cover ──────────────────────────────────────────────────────────
  drawPageHeader('Inspection Photo Report');
  let y = 52 + 28;

  doc.setTextColor(25, 25, 25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(quote.cover_page_title || 'Inspection Photo Report', MARGIN, y);
  y += 10;
  doc.setFillColor(...accent);
  doc.rect(MARGIN, y, 54, 3, 'F');
  y += 28;

  const custName = `${options.customer.first_name || ''} ${options.customer.last_name || ''}`.trim();
  const custAddr = [
    options.customer.address,
    [options.customer.city, options.customer.state, options.customer.zip].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ');

  const infoRow = (label: string, value: string) => {
    if (!value) return;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 150);
    doc.text(label.toUpperCase(), MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(25, 25, 25);
    const lines = doc.splitTextToSize(value, CONTENT_W);
    doc.text(lines, MARGIN, y + 14);
    y += 14 + lines.length * 13 + 12;
  };

  infoRow('Property Owner', custName);
  infoRow('Address', custAddr);
  infoRow('Date', fmtDate(quote.created_at));
  if (quote.project_description) infoRow('Scope', quote.project_description);

  if (coverDataUri) {
    const coverH = Math.min(250, PAGE_H - 70 - y);
    if (coverH > 80) drawFitted(coverDataUri, MARGIN, y, CONTENT_W, coverH);
  }
  drawFooter(1, totalPages);

  // ── Photo pages ────────────────────────────────────────────────────────────
  onProgress?.('Laying out photos…');
  for (let i = 0; i < photos.length; i += PER_PAGE) {
    doc.addPage();
    const pageNum = 2 + i / PER_PAGE;
    drawPageHeader('Inspection Photos');
    const top = 52 + 24;

    photos.slice(i, i + PER_PAGE).forEach((photo, j) => {
      const col = j % COLS;
      const row = Math.floor(j / COLS);
      const cx = MARGIN + col * (CELL_W + GUTTER);
      const cy = top + row * ROW_H;

      doc.setDrawColor(228, 232, 240);
      doc.setLineWidth(0.7);
      doc.roundedRect(cx, cy, CELL_W, IMG_H + CAPTION_H, 5, 5, 'S');

      const dataUri = compressed[i + j];
      if (dataUri) drawFitted(dataUri, cx + 4, cy + 4, CELL_W - 8, IMG_H - 4);

      // Number badge
      doc.setFillColor(...primary);
      doc.circle(cx + 15, cy + 15, 9, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(String(i + j + 1), cx + 15, cy + 18, {align: 'center'});

      // Caption + tags
      const tags = [photo.location, photo.damage_type]
        .flatMap(t => (Array.isArray(t) ? t : typeof t === 'string' ? t.split(',') : []))
        .map(t => String(t).trim())
        .filter(Boolean);

      doc.setTextColor(40, 42, 48);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      const capLines = doc.splitTextToSize(photo.caption || '', CELL_W - 16).slice(0, 2);
      if (capLines.length) doc.text(capLines, cx + 8, cy + IMG_H + 12);

      if (tags.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(120, 130, 150);
        const tagLine = doc.splitTextToSize(tags.join(' · '), CELL_W - 16)[0];
        doc.text(tagLine, cx + 8, cy + IMG_H + 12 + capLines.length * 10 + 2);
      }
    });

    drawFooter(pageNum, totalPages);
  }

  const safeNumber = String(quote.quote_number || 'report').replace(/[^a-zA-Z0-9-_]/g, '_');
  doc.save(`${safeNumber}_Inspection_Report.pdf`);
};

// Copied from QuoteMGR src/lib/pdfGenerator.ts (read-only reference).
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company, CustomQuotePage, LineItem, QuotePhoto } from '@/data/quoteData';
import { getMeasurementSummary } from '@/lib/measurementSummary';
import { calculateCancellationDeadline, getLegalNotice } from '@/lib/legalNotices';

// Brand colors as RGB tuples
const NAVY: [number, number, number] = [30, 58, 95];
const NAVY_LIGHT: [number, number, number] = [45, 90, 142];
const ORANGE: [number, number, number] = [255, 107, 53];
const WHITE: [number, number, number] = [255, 255, 255];
const GRAY_50: [number, number, number] = [249, 250, 251];
const GRAY_100: [number, number, number] = [243, 244, 246];
const GRAY_200: [number, number, number] = [229, 231, 235];
const GRAY_500: [number, number, number] = [107, 114, 128];
const GRAY_700: [number, number, number] = [55, 65, 81];
const GRAY_900: [number, number, number] = [17, 24, 39];
const EMERALD: [number, number, number] = [5, 150, 105];
const BLUE_600: [number, number, number] = [37, 99, 235];
const AMBER: [number, number, number] = [217, 119, 6];
const RED: [number, number, number] = [220, 38, 38];
const GREEN_LIGHT: [number, number, number] = [220, 252, 231];
const BLUE_LIGHT: [number, number, number] = [219, 234, 254];
const AMBER_LIGHT: [number, number, number] = [254, 243, 199];
const RED_LIGHT: [number, number, number] = [254, 226, 226];
const EMERALD_LIGHT: [number, number, number] = [236, 253, 245];

// Page dimensions (Letter size in mm)
const PAGE_W = 215.9;
const PAGE_H = 279.4;
const MARGIN = 20;
const CONTENT_W = PAGE_W - MARGIN * 2;
const HEADER_H = 18;
const CONTENT_TOP = MARGIN + HEADER_H + 4;
const CONTENT_BOTTOM = PAGE_H - MARGIN - 16;

// ─── WinAnsi text folding ────────────────────────────────────────────────────
// jsPDF's built-in fonts are WinAnsi-only. A character outside that set is
// written as its raw low byte, so "≈" came out as `"H` and the minus sign in
// "1708 sqft deck − 306 sqft" collapsed into a stray quote. Embedding a Unicode
// font would add hundreds of KB to every emailed PDF, so fold the symbols we
// actually use down to characters WinAnsi can represent instead. The safe list
// and the failures below were both confirmed against jsPDF's own output.
const WINANSI_SAFE_ABOVE_LATIN1 = new Set([
  '\u2014', '\u2013', '\u2022', '\u2026', '\u2122', '\u2020', '\u2021',
  '\u2018', '\u2019', '\u201C', '\u201D', '\u20AC',
]);

const SYMBOL_FALLBACKS: Record<string, string> = {
  '\u2212': '-',        // minus sign
  '\u2248': '~',        // almost equal to
  '\u2260': '!=',
  '\u2264': '<=',
  '\u2265': '>=',
  '\u2192': '->',
  '\u2190': '<-',
  '\u2194': '<->',
  '\u2197': '^',
  '\u2713': '\u2022',   // check mark -> bullet
  '\u2714': '\u2022',
  '\u2717': '\u00D7',   // ballot X -> multiplication sign
  '\u2715': '\u00D7',
  '\u2605': '*',
  '\u2606': '*',
  '\u2726': '*',
  '\u26A0': '!',
  '\u2032': "'",        // prime -> apostrophe (feet)
  '\u2033': '"',        // double prime -> quote (inches)
  '\u25CF': '\u2022',
  '\u25CB': 'o',
  '\u25B2': '^',
  '\u25BC': 'v',
  '\u25BE': 'v',
  '\u22EE': ':',
  '\u2500': '-',        // box drawing, used in section rules
  '\u2550': '=',
  '\u00A0': ' ',        // non-breaking space
};

const toWinAnsi = (value: string): string => {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0xff || WINANSI_SAFE_ABOVE_LATIN1.has(ch)) {
      out += ch;
      continue;
    }
    // Anything still unmapped — emoji above all — would print as garbage bytes,
    // so drop it rather than let it reach the page.
    out += SYMBOL_FALLBACKS[ch] ?? '';
  }
  return out;
};

// Routes every string drawn on this document through the fold, including the
// ones jspdf-autotable writes into table cells.
export const foldDocumentText = (doc: jsPDF): void => {
  const drawText = doc.text.bind(doc);
  (doc as unknown as { text: unknown }).text = ((
    text: string | string[],
    x: number,
    y: number,
    ...rest: unknown[]
  ) => drawText(
    Array.isArray(text) ? text.map(toWinAnsi) : toWinAnsi(String(text)),
    x,
    y,
    ...(rest as []),
  )) as typeof doc.text;
};

export interface QuotePDFData {
  id: string;
  quote_number: string;
  status: string;
  project_type: string;
  project_description: string;
  selected_tier?: 'good' | 'better' | 'best' | 'all' | null;
  good_total: number;
  better_total: number;
  best_total: number;
  use_manual_totals?: boolean;
  manual_good_total?: number | null;
  manual_better_total?: number | null;
  manual_best_total?: number | null;
  cover_page_title: string;
  include_about_page: boolean;
  include_warranty_page: boolean;
  include_cancel_notice: boolean;
  include_better: boolean;
  include_best: boolean;
  measurement_provider?: string | null;
  measurement_source_name?: string | null;
  measurement_data?: Record<string, unknown> | null;
  good_tier_name?: string;
  better_tier_name?: string;
  best_tier_name?: string;
  tier_photo_good: string | null;
  tier_photo_better: string | null;
  tier_photo_best: string | null;
  tier_desc_good?: string | null;
  tier_desc_better?: string | null;
  tier_desc_best?: string | null;
  quote_style?: 'classic' | 'professional' | null;
  cover_photo_url?: string | null;
  cover_photo_zoom?: number | null;
  cover_photo_offset_x?: number | null;
  cover_photo_offset_y?: number | null;
  sales_rep_photo_url?: string | null;
  sales_rep_photo_zoom?: number | null;
  sales_rep_photo_offset_x?: number | null;
  sales_rep_photo_offset_y?: number | null;
  show_line_item_prices: boolean;
  show_section_totals: boolean;
  notes: string;
  signed_at: string | null;
  signed_by: string | null;
  signature_data: string | null;
  selected_custom_pages?: CustomQuotePage[] | null;
  created_at: string;
  customer?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  creator?: {
    full_name: string;
    email: string;
    phone: string;
  };
}

function hexToRgb(value: string | undefined | null, fallback: [number, number, number]): [number, number, number] {
  if (!value) return fallback;
  const normalized = value.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

// Load image as base64 — tries fetch first (no CORS canvas-taint issues),
// falls back to the canvas approach for data-URL inputs.
async function loadImageAsBase64(url: string, format: 'jpeg' | 'png' = 'jpeg'): Promise<string | null> {
  // Fetch path: works for any CORS-enabled URL (Supabase storage, etc.)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (res.ok) {
        const blob = await res.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
    } catch {
      // fall through to canvas approach
    }
  }

  // Canvas path: for data-URLs or when fetch fails
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    return new Promise((resolve) => {
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(format === 'png'
              ? canvas.toDataURL('image/png')
              : canvas.toDataURL('image/jpeg', 0.85));
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  } catch {
    return null;
  }
}

// Loads an image and crops/scales it to match the exact same natural-size-aware
// zoom + pan positioning (including box-shrink) used by the app's photo editors
// and the live proposal HTML, so this PDF always matches what was set while
// editing instead of always drawing the raw, uncropped, un-zoomed photo.
//
// frameW/frameH is the ORIGINAL reserved slot size (mm) for this photo — the
// returned boxW/boxH is the size to actually draw at (<= frameW x frameH),
// centered within that same reserved slot, so nothing else in the fixed jsPDF
// layout has to move: a zoomed-out photo shrinks and centers in place rather
// than the surrounding layout reflowing around it.
async function loadFramedImageAsBase64(
  url: string,
  frameW: number,
  frameH: number,
  zoom: number,
  offsetXPct: number,
  offsetYPct: number,
  shape: 'rect' | 'circle' = 'rect',
): Promise<{ dataUri: string; boxW: number; boxH: number } | null> {
  // Fetch-first, same as loadImageAsBase64 above — sidesteps canvas-taint
  // entirely, since the resulting data: URI is always same-origin for canvas
  // purposes regardless of the original host's CORS policy.
  const rawDataUri = await loadImageAsBase64(url, 'png');
  if (!rawDataUri) return null;

  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = rawDataUri;
  });
  if (!img || !img.naturalWidth || !img.naturalHeight) return null;

  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  const coverScale = Math.max(frameW / natW, frameH / natH);
  const containScale = Math.min(frameW / natW, frameH / natH);
  const zoomMin = Math.min(1, containScale / coverScale);
  const z = Math.max(zoomMin, Math.min(3, zoom || 1));
  const w = natW * coverScale * z;
  const h = natH * coverScale * z;

  let boxW: number;
  let boxH: number;
  if (shape === 'circle') {
    // A circle can't shrink each axis independently without clipping the
    // photo into an off-center ellipse, so both are pinned to the smaller.
    const boxD = Math.min(w, h, frameW, frameH);
    boxW = boxD;
    boxH = boxD;
  } else {
    boxW = Math.min(w, frameW);
    boxH = Math.min(h, frameH);
  }
  const left = boxW >= w ? 0 : boxW / 2 - (offsetXPct / 100) * w;
  const top = boxH >= h ? 0 : boxH / 2 - (offsetYPct / 100) * h;

  // Source-pixel crop rectangle equivalent to the on-screen box position.
  const s = coverScale * z; // source px -> mm-equivalent scale
  const sx = Math.min(natW, Math.max(0, -left / s));
  const sy = Math.min(natH, Math.max(0, -top / s));
  const sWidth = Math.max(1, Math.min(natW - sx, boxW / s));
  const sHeight = Math.max(1, Math.min(natH - sy, boxH / s));

  // Render at a fixed pixel resolution (not 1:1 with mm) for decent print
  // quality without bloating the PDF — long edge capped at 900px.
  const maxOutputPx = 900;
  const outAspect = boxW / boxH;
  const outW = Math.max(1, Math.round(outAspect >= 1 ? maxOutputPx : maxOutputPx * outAspect));
  const outH = Math.max(1, Math.round(outAspect >= 1 ? maxOutputPx / outAspect : maxOutputPx));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (shape === 'circle') {
    ctx.save();
    ctx.beginPath();
    ctx.arc(outW / 2, outH / 2, Math.min(outW, outH) / 2, 0, Math.PI * 2);
    ctx.clip();
  }
  ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, outW, outH);
  if (shape === 'circle') ctx.restore();

  // PNG for the circle (needs a transparent surround so it reads as a circle
  // once placed on the PDF), JPEG for the rect (smaller file, no transparency
  // needed since it always fully covers its box).
  const dataUri = shape === 'circle'
    ? canvas.toDataURL('image/png')
    : canvas.toDataURL('image/jpeg', 0.9);

  return { dataUri, boxW, boxH };
}

// Pre-rotate an image data URL by -45° on a transparent canvas (for diagonal watermark)
async function rotateImageDiagonal(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const diagonal = Math.ceil(Math.sqrt(img.width ** 2 + img.height ** 2));
      const canvas = document.createElement('canvas');
      canvas.width = diagonal;
      canvas.height = diagonal;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(diagonal / 2, diagonal / 2);
        ctx.rotate(-Math.PI / 4);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function fmtCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val);
}

export async function generateQuotePDF(
  quote: QuotePDFData,
  company: Company,
  lineItems: LineItem[],
  photos: QuotePhoto[],
  onProgress?: (step: string) => void,
  quoteOptions?: Array<{ id: string; name: string; sort_order: number; subtotal: number }>
): Promise<jsPDF> {
  const SECTION_GAP = 8; // mm of whitespace between major sections
  // Shadow module-level const so all inline page-break checks become dead code
  // Real Letter pages. This used to be a single 5-metre-tall page so the quote
  // scrolled as one continuous document, but printing then scaled the whole
  // thing down to fit a sheet — a modest quote came out at 23%, a long one at
  // 9%, far too small to read. CONTENT_BOTTOM is the module-level Letter value
  // again, so the guards below become genuine page breaks instead of the
  // never-true conditions they had become.
  const doc = new jsPDF({ unit: 'mm', format: [PAGE_W, PAGE_H] });
  foldDocumentText(doc);
  let totalPagesEstimate = 1; // cover always
  const includeAbout = quote.include_about_page !== false;
  const includeWarranty = quote.include_warranty_page !== false;
  const includeCancelNotice = quote.include_cancel_notice !== false;
  const includeBetter = quote.include_better !== false;
  const includeBest = quote.include_best !== false;
  const selectedCustomPages = Array.isArray(quote.selected_custom_pages) ? quote.selected_custom_pages : [];
  const brandPrimary = hexToRgb(company.quote_primary_color, NAVY);
  const brandAccent = hexToRgb(company.quote_accent_color, ORANGE);

  // If manual totals are set, override computed totals in the quote data
  const resolvedQuote = quote.use_manual_totals ? {
    ...quote,
    good_total: quote.manual_good_total ?? quote.good_total,
    better_total: quote.manual_better_total ?? quote.better_total,
    best_total: quote.manual_best_total ?? quote.best_total,
  } : quote;
  const goodTierName = resolvedQuote.good_tier_name || 'Good';
  const betterTierName = resolvedQuote.better_tier_name || 'Better';
  const bestTierName = resolvedQuote.best_tier_name || 'Best';

  const activeTiers: Array<{ key: 'good' | 'better' | 'best'; label: string; subtitle: string; description: string | null; totalKey: 'good_total' | 'better_total' | 'best_total'; priceKey: 'good_price' | 'better_price' | 'best_price'; photoUrl: string | null; color: [number, number, number]; bgColor: [number, number, number]; badge: string | null }> = [
    { key: 'good', label: goodTierName, subtitle: 'Essential Coverage', description: resolvedQuote.tier_desc_good || null, totalKey: 'good_total', priceKey: 'good_price', photoUrl: resolvedQuote.tier_photo_good ?? null, color: EMERALD, bgColor: EMERALD_LIGHT, badge: null },
    ...(includeBetter ? [{ key: 'better' as const, label: betterTierName, subtitle: 'Enhanced Protection', description: resolvedQuote.tier_desc_better || null, totalKey: 'better_total' as const, priceKey: 'better_price' as const, photoUrl: resolvedQuote.tier_photo_better ?? null, color: BLUE_600, bgColor: BLUE_LIGHT, badge: 'RECOMMENDED' }] : []),
    ...(includeBest ? [{ key: 'best' as const, label: bestTierName, subtitle: 'Premium Solution', description: resolvedQuote.tier_desc_best || null, totalKey: 'best_total' as const, priceKey: 'best_price' as const, photoUrl: resolvedQuote.tier_photo_best ?? null, color: AMBER, bgColor: AMBER_LIGHT, badge: 'BEST VALUE' }] : []),
  ];

  // Estimate total pages
  if (includeAbout) totalPagesEstimate++;
  totalPagesEstimate += activeTiers.length; // one page per tier
  totalPagesEstimate += selectedCustomPages.length;
  if (photos.length > 0) totalPagesEstimate += Math.ceil(photos.length / 4);
  if (includeWarranty) totalPagesEstimate++;
  if (includeCancelNotice) totalPagesEstimate++;
  totalPagesEstimate++; // signature

  // Pre-load logo
  let logoData: string | null = null;
  if (company.logo_url) {
    onProgress?.('Loading company logo...');
    logoData = await loadImageAsBase64(company.logo_url);
  }
  const coverPhotoUrl = quote.cover_photo_url || photos[0]?.photo_url || null;
  // leftW/coverImgH (the cover photo's reserved slot) aren't computed until
  // the cover page draws below, but they're fixed layout constants, not
  // derived from data — safe to compute them here too for the crop.
  const coverFrameW = Math.round(PAGE_W * 0.56);
  const coverFrameH = 86;
  const coverPhotoData = coverPhotoUrl
    ? await loadFramedImageAsBase64(
        coverPhotoUrl,
        coverFrameW,
        coverFrameH,
        quote.cover_photo_zoom ?? 1,
        quote.cover_photo_offset_x ?? 50,
        quote.cover_photo_offset_y ?? 50,
        'rect',
      )
    : null;
  const salesRepPhotoData = quote.sales_rep_photo_url
    ? await loadFramedImageAsBase64(
        quote.sales_rep_photo_url,
        22,
        22,
        quote.sales_rep_photo_zoom ?? 1,
        quote.sales_rep_photo_offset_x ?? 50,
        quote.sales_rep_photo_offset_y ?? 50,
        'circle',
      )
    : null;
  const measurementSummary = getMeasurementSummary(
    quote.measurement_provider,
    quote.measurement_source_name,
    quote.measurement_data ?? null,
  );
  const legalNotice = getLegalNotice(quote.customer?.state, company.state);
  const cancellationDeadline = calculateCancellationDeadline(quote.created_at);

  // Pre-load inspection photos
  const photoDataMap: Map<string, string | null> = new Map();
  if (photos.length > 0) {
    onProgress?.('Loading inspection photos...');
    for (const photo of photos) {
      const data = await loadImageAsBase64(photo.photo_url);
      photoDataMap.set(photo.id, data);
    }
  }

  // Pre-load tier option photos
  const tierPhotoDataMap: Map<string, string | null> = new Map();
  for (const tier of activeTiers) {
    if (tier.photoUrl) {
      onProgress?.(`Loading ${tier.label} option photo...`);
      const data = await loadImageAsBase64(tier.photoUrl);
      tierPhotoDataMap.set(tier.key, data);
    }
  }

  // Pre-load watermark (company watermark for subscribers, QuoteMGR logo otherwise)
  const isSubscribed = company.subscription_status === 'active';
  let watermarkData: string | null = null;
  const wmOpacity: number = isSubscribed ? (company.quote_watermark_opacity ?? 0.08) : 0.06;
  const wmDiagonal = isSubscribed
    ? (company.quote_watermark_rotation ?? 'diagonal') === 'diagonal'
    : true; // QuoteMGR logo always diagonal
  if (isSubscribed && company.quote_watermark_url) {
    onProgress?.('Loading watermark...');
    const raw = await loadImageAsBase64(company.quote_watermark_url, 'png');
    if (raw) watermarkData = wmDiagonal ? await rotateImageDiagonal(raw) : raw;
  } else if (!isSubscribed) {
    const raw = await loadImageAsBase64(`${window.location.origin}/quotemgr-logo.png`, 'png');
    if (raw) watermarkData = await rotateImageDiagonal(raw);
  }

  // ─── Shared drawing helpers ───

  /**
   * Breaks to a new page when `needed` mm would not fit in the remaining space.
   *
   * The guards through this file were written when the page was 5 m tall, so
   * CONTENT_BOTTOM sat at ~4963 mm and none of them could ever fire; several
   * `break` or `return` outright, meaning on a real page they would silently
   * drop content rather than continue it. They call this instead, so a section
   * that no longer fits moves to the next page intact.
   */
  function ensureSpace(needed: number): void {
    if (y + needed <= CONTENT_BOTTOM) return;
    addContentPage();
    y = CONTENT_TOP;
  }

  function drawWatermark() {
    if (!watermarkData) return;
    const wSize = 140; // mm — fits diagonal image within letter page
    const wx = (PAGE_W - wSize) / 2;
    const wy = (PAGE_H - wSize) / 2;
    (doc as any).saveGraphicsState();
    (doc as any).setGState((doc as any).GState({ opacity: wmOpacity }));
    try {
      doc.addImage(watermarkData, 'PNG', wx, wy, wSize, wSize);
    } catch { /* skip on error */ }
    (doc as any).restoreGraphicsState();
  }

  function drawPageHeader() {
    drawWatermark();
    // Left orange accent bar
    doc.setFillColor(...brandAccent);
    doc.rect(0, 0, 3.5, MARGIN + HEADER_H, 'F');

    // Company logo
    const hY = 2;
    if (logoData) {
      try {
        doc.addImage(logoData, 'JPEG', 6, hY, 15, 15);
      } catch { /* skip logo */ }
    }

    // Company name — right-aligned in brand accent color
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...brandAccent);
    doc.text(company.name, PAGE_W - MARGIN, hY + 7, { align: 'right' });

    // Contact info — right-aligned, small gray text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY_500);
    const contactLines: string[] = [];
    const cityState = [company.city, company.state].filter(Boolean).join(', ');
    if (cityState) contactLines.push(cityState);
    if (company.phone) contactLines.push(company.phone);
    if (company.email) contactLines.push(company.email);
    contactLines.forEach((line, i) => {
      doc.text(line, PAGE_W - MARGIN, hY + 11 + i * 3.5, { align: 'right' });
    });

    // Separator
    doc.setDrawColor(...GRAY_200);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, MARGIN + HEADER_H, PAGE_W - MARGIN, MARGIN + HEADER_H);
  }

  // ─── Section header banner helper ───────────────────────────────────────────
  // Returns the new Y position after the banner
  function drawSectionHeader(sectionLabel: string, title: string, yPos: number): number {
    const bannerH = 20;
    doc.setFillColor(...brandPrimary);
    doc.roundedRect(MARGIN, yPos, CONTENT_W, bannerH, 3, 3, 'F');
    // Orange bottom stripe
    doc.setFillColor(...brandAccent);
    doc.rect(MARGIN, yPos + bannerH - 2, CONTENT_W, 2, 'F');
    // Section label (e.g. "SECTION 02")
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...brandAccent);
    doc.text(sectionLabel, MARGIN + 5, yPos + 7);
    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...WHITE);
    doc.text(title, MARGIN + 5, yPos + 17);
    return yPos + bannerH + 6;
  }

  function drawPageFooter(pageNumber: number, total: number) {
    const fY = PAGE_H - MARGIN - 2;
    doc.setDrawColor(...GRAY_200);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, fY - 6, PAGE_W - MARGIN, fY - 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY_500);

    const repName = quote.creator?.full_name;
    if (repName) {
      doc.setFont('helvetica', 'bold');
      doc.text(repName, MARGIN, fY - 3.5);
      doc.setFont('helvetica', 'normal');
    }

    const parts: string[] = [];
    if (company.phone) parts.push(company.phone);
    if (company.email) parts.push(company.email);
    if (company.website) parts.push(company.website);
    doc.text(parts.join('  |  '), MARGIN, fY);

    doc.setFontSize(7);
    doc.text(`Page ${pageNumber} of ${total}`, PAGE_W - MARGIN, fY, { align: 'right' });
  }

  /**
   * Starts a fresh content page with the running header.
   *
   * Stubbed out to a no-op when the document became one continuous page, which
   * is why callers such as startCustomPageSection() stopped breaking and simply
   * carried on down the sheet.
   */
  function addContentPage(): number {
    doc.addPage();
    drawPageHeader();
    return doc.getNumberOfPages();
  }

  function startCustomPageSection() {
    addContentPage();
    const nextY = CONTENT_TOP + 6;

    doc.setFillColor(...BLUE_LIGHT);
    doc.roundedRect(MARGIN, nextY - 2, 10, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...BLUE_600);
    doc.text('C', MARGIN + 2.8, nextY + 5);

    return nextY;
  }

  // ── Build section list for right-column cover card ──
  const coverSectionItems: { num: string; name: string }[] = [];
  let _sNum = 1;
  coverSectionItems.push({ num: '01', name: 'Cover' });
  _sNum = 2;
  if (includeAbout) { coverSectionItems.push({ num: String(_sNum).padStart(2, '0'), name: 'About Our Company' }); _sNum++; }
  activeTiers.forEach(() => { coverSectionItems.push({ num: String(_sNum).padStart(2, '0'), name: 'Project Overview & Scope' }); _sNum++; });
  if (photos.length > 0) { coverSectionItems.push({ num: String(_sNum).padStart(2, '0'), name: 'Photo Documentation' }); _sNum++; }
  if (includeWarranty) { coverSectionItems.push({ num: String(_sNum).padStart(2, '0'), name: 'Warranty Information' }); _sNum++; }
  selectedCustomPages.forEach(p => { coverSectionItems.push({ num: String(_sNum).padStart(2, '0'), name: p.title }); _sNum++; });
  coverSectionItems.push({ num: String(_sNum).padStart(2, '0'), name: 'Acceptance & Signature' }); _sNum++;
  if (includeCancelNotice) { coverSectionItems.push({ num: String(_sNum).padStart(2, '0'), name: 'Notice of Right to Cancel' }); }

  // Running section counter for content pages
  let _contentSectionNum = includeAbout ? 2 : 2;

  // ═══════════════════════════════════════════
  // PAGE 1: COVER PAGE  (two-column vertical split)
  // ═══════════════════════════════════════════
  onProgress?.('Generating cover page...');

  const leftW = Math.round(PAGE_W * 0.56);   // ~121 mm — dark navy column
  const rightW = PAGE_W - leftW;              // ~95 mm  — light column
  const rPad = 8;
  const rX = leftW + rPad;
  const rCardW = rightW - rPad * 2;

  // ── Backgrounds ──────────────────────────────────────────────────────────
  doc.setFillColor(...brandPrimary);
  doc.rect(0, 0, leftW, 279.4, 'F'); // letter-height only — not full continuous page
  doc.setFillColor(238, 242, 250);
  doc.rect(leftW, 0, rightW, 279.4, 'F');

  // ── Left: cover photo (top of column) ───────────────────────────────────
  const coverImgH = 86;
  if (coverPhotoData) {
    try {
      // Box-shrink: draw at its own (possibly smaller, zoomed-out) size,
      // centered within the reserved (0,0,leftW,coverImgH) slot instead of
      // stretching to fill it — matches the app editor and live preview.
      const cx = (leftW - coverPhotoData.boxW) / 2;
      const cy = (coverImgH - coverPhotoData.boxH) / 2;
      doc.addImage(coverPhotoData.dataUri, 'JPEG', cx, cy, coverPhotoData.boxW, coverPhotoData.boxH);
    } catch { /* skip */ }
  } else {
    doc.setFillColor(20, 45, 80);
    doc.rect(0, 0, leftW, coverImgH, 'F');
  }

  // ── Left: "PREPARED PROPOSAL" pill ──────────────────────────────────────
  const pillStartY = coverImgH + 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const pillLabel = 'PREPARED PROPOSAL';
  const pillLabelW = doc.getTextWidth(pillLabel) + 16;
  doc.setFillColor(40, 68, 108);
  doc.roundedRect(MARGIN, pillStartY, pillLabelW, 8, 4, 4, 'F');
  doc.setTextColor(163, 196, 232);
  doc.text(pillLabel, MARGIN + 8, pillStartY + 5.5);

  // ── Left: logo + company name + project type ─────────────────────────────
  const logoBlockY = pillStartY + 14;
  let compTextX = MARGIN;
  if (logoData) {
    try {
      doc.setFillColor(30, 55, 90);
      doc.roundedRect(MARGIN, logoBlockY, 18, 18, 2, 2, 'F');
      doc.addImage(logoData, 'JPEG', MARGIN + 1, logoBlockY + 1, 16, 16);
      compTextX = MARGIN + 22;
    } catch { compTextX = MARGIN; }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.text(company.name, compTextX, logoBlockY + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(163, 196, 232);
  const projTypeStr = (quote.project_type.charAt(0).toUpperCase() + quote.project_type.slice(1)) + ' Proposal';
  doc.text(projTypeStr, compTextX, logoBlockY + 14);

  // ── Left: title ──────────────────────────────────────────────────────────
  const titleStartY = logoBlockY + 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...WHITE);
  const titleLines = doc.splitTextToSize(quote.cover_page_title || 'Home Restoration Proposal', leftW - MARGIN * 2);
  titleLines.forEach((line: string, i: number) => {
    doc.text(line, MARGIN, titleStartY + i * 11);
  });

  // ── Left: description ───────────────────────────────────────────────────
  const descStartY = titleStartY + titleLines.length * 11 + 6;
  if (quote.project_description) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(163, 196, 232);
    const descLines = doc.splitTextToSize(quote.project_description, leftW - MARGIN * 2 - 2);
    descLines.slice(0, 3).forEach((line: string, i: number) => {
      doc.text(line, MARGIN, descStartY + i * 5);
    });
  }

  // ── Left: 4 info boxes (2×2 grid pinned to bottom) ─────────────────────
  const infoBoxAreaY = PAGE_H - 75;
  const infoBoxW = (leftW - MARGIN * 2 - 5) / 2;
  const infoBoxH = 30;
  const infoBoxBg: [number, number, number] = [35, 65, 108];

  const infoBoxes = [
    { label: 'PREPARED FOR', value: quote.customer ? `${quote.customer.first_name} ${quote.customer.last_name}` : 'N/A' },
    { label: 'PREPARED BY',  value: quote.creator?.full_name || company.name },
    { label: 'PROPOSAL DATE', value: new Date(quote.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) },
    { label: 'QUOTE NUMBER', value: quote.quote_number },
  ];

  infoBoxes.forEach((box, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const bx = MARGIN + col * (infoBoxW + 5);
    const by = infoBoxAreaY + row * (infoBoxH + 5);
    doc.setFillColor(...infoBoxBg);
    doc.roundedRect(bx, by, infoBoxW, infoBoxH, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(163, 196, 232);
    doc.text(box.label, bx + 5, by + 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...WHITE);
    const displayVal = box.value.length > 20 ? box.value.substring(0, 19) + '…' : box.value;
    doc.text(displayVal, bx + 5, by + 20);
  });

  // ── Right: Proposal Sections card ───────────────────────────────────────
  const sectionsShown = Math.min(coverSectionItems.length, 5);
  const moreSections = coverSectionItems.length - sectionsShown;
  const sectCardH = 18 + sectionsShown * 14 + (moreSections > 0 ? 14 : 0) + 8;
  const sectCardY = 14;

  doc.setFillColor(...WHITE);
  doc.roundedRect(rX, sectCardY, rCardW, sectCardH, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...GRAY_900);
  doc.text('Proposal Sections', rX + 7, sectCardY + 12);

  coverSectionItems.slice(0, 5).forEach((sect, i) => {
    const rowY = sectCardY + 22 + i * 14;
    // Number badge
    doc.setFillColor(255, 237, 213);
    doc.circle(rX + 13, rowY + 3.5, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...brandAccent);
    doc.text(sect.num, rX + 13, rowY + 5.5, { align: 'center' });
    // Name
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY_700);
    doc.text(sect.name, rX + 23, rowY + 5.5);
  });

  if (moreSections > 0) {
    const moreY = sectCardY + 22 + sectionsShown * 14;
    doc.setFillColor(...GRAY_200);
    doc.circle(rX + 13, moreY + 3.5, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY_500);
    doc.text(`+${moreSections}`, rX + 13, moreY + 5.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY_500);
    doc.text('more sections', rX + 23, moreY + 5.5);
  }

  // ── Right: Project Snapshot card ─────────────────────────────────────────
  const snapshotCardY = sectCardY + sectCardH + 6;
  const snapshotCardH = 60;

  doc.setFillColor(...WHITE);
  doc.roundedRect(rX, snapshotCardY, rCardW, snapshotCardH, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...GRAY_900);
  doc.text('Project Snapshot', rX + 7, snapshotCardY + 12);
  doc.setDrawColor(...GRAY_200);
  doc.setLineWidth(0.3);
  doc.line(rX + 4, snapshotCardY + 15, rX + rCardW - 4, snapshotCardY + 15);

  const validUntilDate = new Date(quote.created_at);
  validUntilDate.setDate(validUntilDate.getDate() + 28);
  const validUntilStr = validUntilDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });

  const snapshotRows: [string, string][] = [
    ['VALID UNTIL', validUntilStr],
    ['SECTIONS', String(coverSectionItems.length)],
    ['PHOTOS', String(photos.length)],
    ['OPTIONS', String(activeTiers.length)],
  ];
  snapshotRows.forEach(([label, value], i) => {
    const rowY = snapshotCardY + 22 + i * 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY_500);
    doc.text(label, rX + 7, rowY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY_900);
    doc.text(value, rX + rCardW - 7, rowY, { align: 'right' });
    if (i < snapshotRows.length - 1) {
      doc.setDrawColor(...GRAY_100);
      doc.setLineWidth(0.2);
      doc.line(rX + 4, rowY + 4, rX + rCardW - 4, rowY + 4);
    }
  });

  // ── Right: Your Representative card ─────────────────────────────────────
  const repCardY = snapshotCardY + snapshotCardH + 6;
  const repCardH = 68;

  doc.setFillColor(...WHITE);
  doc.roundedRect(rX, repCardY, rCardW, repCardH, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...GRAY_900);
  doc.text('Your Representative', rX + 7, repCardY + 12);
  doc.setDrawColor(...GRAY_200);
  doc.setLineWidth(0.3);
  doc.line(rX + 4, repCardY + 15, rX + rCardW - 4, repCardY + 15);

  if (salesRepPhotoData) {
    try {
      // Box-shrink, centered in the reserved 22x22 slot — same reasoning as
      // the cover photo above. PNG (from loadFramedImageAsBase64) so the
      // circular clip's transparent corners show the card background.
      const rcx = rX + 7 + (22 - salesRepPhotoData.boxW) / 2;
      const rcy = repCardY + 20 + (22 - salesRepPhotoData.boxH) / 2;
      doc.addImage(salesRepPhotoData.dataUri, 'PNG', rcx, rcy, salesRepPhotoData.boxW, salesRepPhotoData.boxH);
    } catch { /* skip */ }
  }
  const repNameX = salesRepPhotoData ? rX + 34 : rX + 7;
  const repName = quote.creator?.full_name || company.name;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY_900);
  doc.text(repName, repNameX, repCardY + 29);

  doc.setDrawColor(...GRAY_200);
  doc.setLineWidth(0.3);
  doc.line(rX + 4, repCardY + 35, rX + rCardW - 4, repCardY + 35);

  let repInfoY = repCardY + 43;
  if (company.phone) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY_700);
    doc.text(company.phone, rX + 7, repInfoY);
    repInfoY += 8;
  }
  if (company.email) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY_700);
    doc.text(company.email, rX + 7, repInfoY);
  }

  if (measurementSummary) {
    // Compact measurement summary at the bottom of the right column
    const msY = repCardY + repCardH + 8;
    if (msY + 30 < PAGE_H - 10) {
      doc.setFillColor(...WHITE);
      doc.roundedRect(rX, msY, rCardW, 32, 3, 3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...GRAY_900);
      doc.text('Imported Measurements', rX + 7, msY + 8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...GRAY_500);
      const provLabel = `${measurementSummary.providerLabel}${measurementSummary.sourceName ? ` • ${measurementSummary.sourceName}` : ''}`;
      doc.text(provLabel, rX + 7, msY + 13);
      const mMetrics = [
        `Area: ${measurementSummary.roofAreaSqft} sqft`,
        `Pitch: ${measurementSummary.pitch}`,
        `Facets: ${measurementSummary.facets}`,
      ];
      doc.setFontSize(7);
      doc.setTextColor(...GRAY_700);
      mMetrics.forEach((m, mi) => {
        doc.text(m, rX + 7, msY + 20 + mi * 4);
      });
    }
  }

  // ═══════════════════════════════════════════
  // CONTENT SECTIONS — begin on the page after the cover
  // ═══════════════════════════════════════════
  // Content used to continue straight down the same continuous sheet, starting
  // at PAGE_H so it sat just under the cover. On real pages that start point is
  // already past the bottom margin, so every section would break immediately
  // and the document filled with near-empty pages. The cover owns page 1; the
  // content starts on a fresh one.
  addContentPage();
  let y = CONTENT_TOP - SECTION_GAP; // the first `y += SECTION_GAP` lands on CONTENT_TOP

  if (includeAbout) {
    onProgress?.('Generating about page...');
    y += SECTION_GAP;
    const aboutSectionNum = _contentSectionNum++;
    y = drawSectionHeader(`SECTION ${String(aboutSectionNum).padStart(2, '0')}`, `About ${company.name}`, y);

    // About text — full-width, bold first paragraph
    if (company.about_text) {
      const paragraphs = company.about_text.split('\n').filter((p: string) => p.trim());
      let isFirstPara = true;
      for (const para of paragraphs) {
        ensureSpace(15);
        if (isFirstPara) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(...GRAY_900);
          isFirstPara = false;
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(...GRAY_700);
        }
        const paraLines = doc.splitTextToSize(para, CONTENT_W);
        paraLines.forEach((line: string) => {
          ensureSpace(15);
          doc.text(line, MARGIN, y);
          y += 5.5;
        });
        y += 4;
      }
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(...GRAY_500);
      doc.text('Company information has not been set up yet.', MARGIN, y);
      y += 10;
    }

    y += 6;

    // "WHY CLIENTS CHOOSE US" — dark full-width panel with 4 card columns
    const whyCards = [
      { title: 'Transparent Process',       detail: 'Clear scopes, organized approvals, and visible milestones from start to finish.' },
      { title: 'Quality Craftsmanship',     detail: 'Work is organized by trade section so every part of the project is easy to review.' },
      { title: 'Professional Documentation', detail: 'Photos, section totals, upgrades, and acceptance details packaged into one proposal.' },
      { title: 'Customer-Focused Delivery', detail: 'Customers can review options, select sections, and sign the exact scope they want.' },
    ];

    ensureSpace(80);
    {
      const panelH = 72;
      doc.setFillColor(17, 24, 39);
      doc.roundedRect(MARGIN, y, CONTENT_W, panelH, 4, 4, 'F');
      // Panel heading
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...brandAccent);
      doc.text('WHY CLIENTS CHOOSE US', MARGIN + 6, y + 10);
      // 4 cards in a row
      const cW = (CONTENT_W - 10) / 4 - 2;
      const cSY = y + 16;
      const cH = panelH - 22;
      whyCards.forEach((card, i) => {
        const cx = MARGIN + 5 + i * (cW + 2.5);
        doc.setFillColor(30, 41, 59);
        doc.roundedRect(cx, cSY, cW, cH, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...WHITE);
        const ctLines = doc.splitTextToSize(card.title, cW - 6);
        ctLines.slice(0, 2).forEach((line: string, li: number) => {
          doc.text(line, cx + 4, cSY + 8 + li * 5);
        });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(200, 200, 200);
        const cdLines = doc.splitTextToSize(card.detail, cW - 6);
        const offset = ctLines.length > 1 ? 24 : 18;
        cdLines.slice(0, 4).forEach((line: string, li: number) => {
          doc.text(line, cx + 4, cSY + offset + li * 4.5);
        });
      });
      y += panelH + 6;
    }

    // "GET IN TOUCH" contact strip to fill remaining page space
    ensureSpace(22);
    {
      const contactBarH = 18;
      doc.setFillColor(...brandPrimary);
      doc.roundedRect(MARGIN, y, CONTENT_W, contactBarH, 3, 3, 'F');
      doc.setFillColor(...brandAccent);
      doc.rect(MARGIN, y + contactBarH - 2, CONTENT_W, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...brandAccent);
      doc.text('GET IN TOUCH', MARGIN + 5, y + 7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...WHITE);
      const contactItems: string[] = [company.phone, company.email, company.website].filter(Boolean) as string[];
      contactItems.forEach((item, i) => {
        doc.text(item, MARGIN + 40 + i * 56, y + 7);
      });
      const cityState = [company.city, company.state, company.zip].filter(Boolean).join(', ');
      const addressLine = [company.address, cityState].filter(Boolean).join('  |  ');
      if (addressLine) doc.text(addressLine, MARGIN + 5, y + 14);
      y += contactBarH + 4;
    }
  }

  // ═══════════════════════════════════════════
  // PHOTO DOCUMENTATION (before pricing)
  // ═══════════════════════════════════════════
  if (photos.length > 0) {
    onProgress?.('Generating photo pages...');
    y += SECTION_GAP;
    const photoSectionNum = _contentSectionNum++;
    y = drawSectionHeader(`SECTION ${String(photoSectionNum).padStart(2, '0')}`, 'Photo Documentation', y);

    // 3-column grid: up to 3 rows per page
    const photoCols = 3;
    const photoGap = 4;
    const photoW = (CONTENT_W - photoGap * (photoCols - 1)) / photoCols;
    const photoImgH = Math.round(photoW * 0.62); // ~35mm landscape proportion
    const photoTextH = 8; // space below card border for optional caption
    const photoBlockH = photoImgH + photoTextH;

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const col = i % photoCols;

      if (col === 0 && i > 0) {
        y += photoBlockH + photoGap;
      }

      const px = MARGIN + col * (photoW + photoGap);

      // Border wraps only the image — no empty white space below
      doc.setDrawColor(...GRAY_200);
      doc.setLineWidth(0.3);
      doc.roundedRect(px, y, photoW, photoImgH, 2, 2, 'S');

      // Image fills the card edge-to-edge
      const imgData = photoDataMap.get(photo.id);
      if (imgData) {
        try {
          doc.addImage(imgData, 'JPEG', px + 1, y + 1, photoW - 2, photoImgH - 2, undefined, 'MEDIUM');
        } catch {
          doc.setFillColor(...GRAY_100);
          doc.rect(px + 1, y + 1, photoW - 2, photoImgH - 2, 'F');
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7);
          doc.setTextColor(...GRAY_500);
          doc.text('Image unavailable', px + photoW / 2, y + photoImgH / 2, { align: 'center' });
        }
      } else {
        doc.setFillColor(...GRAY_100);
        doc.rect(px + 1, y + 1, photoW - 2, photoImgH - 2, 'F');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(...GRAY_500);
        doc.text('Image unavailable', px + photoW / 2, y + photoImgH / 2, { align: 'center' });
      }

      // Caption / tags appear below the card border
      let textY = y + photoImgH + 4;

      // Damage badge
      if (photo.damage_type) {
        doc.setFillColor(...RED_LIGHT);
        const badgeW = doc.getStringUnitWidth(photo.damage_type) * 5.5 * 0.352778 + 6;
        doc.roundedRect(px + 3, textY - 3, Math.min(badgeW, photoW - 6), 5.5, 1, 1, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(...RED);
        doc.text(photo.damage_type, px + 5, textY);
        textY += 5.5;
      }

      // Caption
      if (photo.caption) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...GRAY_900);
        const capLines = doc.splitTextToSize(photo.caption, photoW - 6);
        capLines.slice(0, 2).forEach((line: string) => {
          if (textY < y + photoBlockH - 2) {
            doc.text(line, px + 3, textY);
            textY += 3.5;
          }
        });
      }

      // Notes
      if (photo.notes) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...GRAY_700);
        const noteLines = doc.splitTextToSize(photo.notes, photoW - 6);
        noteLines.slice(0, 2).forEach((line: string) => {
          if (textY < y + photoBlockH - 2) {
            doc.text(line, px + 3, textY);
            textY += 3;
          }
        });
      }
    }
  }

  // ═══════════════════════════════════════════
  // PRICING PAGES — option-based or tier-based
  // ═══════════════════════════════════════════

  // Guard: only use the options path when items are actually linked to options via
  // quote_option_id.  Quotes that have option records but no linked items (e.g. legacy tiered
  // quotes that were incorrectly given option rows) should fall through to the tier path.
  const someItemsLinkedToOptions = lineItems.some((item: any) => item.quote_option_id != null);
  if (quoteOptions && quoteOptions.length > 0 && someItemsLinkedToOptions) {
    // Option-based architecture: one page per option
    for (const opt of quoteOptions) {
      onProgress?.(`Generating ${opt.name} option page...`);
      const optItems = lineItems.filter((item: any) => item.quote_option_id === opt.id);
      if (optItems.length === 0) continue;
      y += SECTION_GAP;
      const showPrices = quote.show_line_item_prices !== false;
      const showSectionTotals = quote.show_section_totals !== false;
      const optSectionNum = _contentSectionNum++;
      const bannerH = 20;
      doc.setFillColor(...brandPrimary);
      doc.roundedRect(MARGIN, y, CONTENT_W, bannerH, 3, 3, 'F');
      doc.setFillColor(...brandAccent);
      doc.rect(MARGIN, y + bannerH - 2, CONTENT_W, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...brandAccent);
      doc.text(`SECTION ${String(optSectionNum).padStart(2, '0')}`, MARGIN + 5, y + 7);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(`${opt.name} Option`, MARGIN + 5, y + 15);
      y += bannerH + 8;

      const grouped = optItems.reduce((acc: Record<string, LineItem[]>, item: any) => {
        if ((item as any).is_divider) return acc;
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
      }, {} as Record<string, LineItem[]>);

      for (const [category, items] of Object.entries(grouped)) {
        doc.setFillColor(...NAVY_LIGHT);
        doc.roundedRect(MARGIN, y, CONTENT_W, 6, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...brandPrimary);
        doc.text(category.toUpperCase(), MARGIN + 4, y + 4.5);
        y += 7;

        for (const item of (items as any[])) {
          const itemPrice = (item as any).price ?? (item as any).good_price ?? 0;
          const lineTotal = item.quantity * itemPrice;
          // Pre-calculate wrapped description lines so row height is accurate
          const descText = item.description ? String(item.description) : '';
          doc.setFontSize(6.5);
          const descW = CONTENT_W * (showPrices ? 0.55 : 0.75);
          const descLines: string[] = descText ? doc.splitTextToSize(descText, descW) : [];
          const itemH = descLines.length > 0 ? (6 + descLines.length * 3.5) : 6;
          ensureSpace(itemH + 2);
          doc.setDrawColor(...GRAY_200);
          doc.setLineWidth(0.2);
          doc.line(MARGIN, y + itemH, MARGIN + CONTENT_W, y + itemH);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(...GRAY_700);
          doc.text(String(item.item_name || ''), MARGIN + 2, y + 4.5);
          if (descLines.length > 0) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(...GRAY_500);
            descLines.forEach((line: string, i: number) => {
              doc.text(line, MARGIN + 2, y + 8.5 + i * 3.5);
            });
          }
          const qtyW = 18; const unitW = 18; const priceW = 22; const totalW = 22;
          const colRight = MARGIN + CONTENT_W;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(...GRAY_500);
          doc.text(`${item.quantity} ${item.unit}`, colRight - totalW - priceW - unitW - qtyW + 2, y + 4.5);
          if (showPrices) {
            doc.text(`$${item.quantity > 1 ? (itemPrice).toFixed(2) : ''}`, colRight - totalW - priceW + 2, y + 4.5, { align: 'right' });
            doc.text(`$${lineTotal.toFixed(2)}`, colRight, y + 4.5, { align: 'right' });
          }
          y += itemH;
        }

        if (showSectionTotals) {
          const catTotal = (items as any[]).reduce((s: number, i: any) => s + i.quantity * ((i as any).price ?? (i as any).good_price ?? 0), 0);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(...brandPrimary);
          doc.text(`Section Total: $${catTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, MARGIN + CONTENT_W, y + 3, { align: 'right' });
          y += 6;
        }
        y += 2;
      }

      doc.setFillColor(...brandPrimary);
      doc.roundedRect(MARGIN, y, CONTENT_W, 10, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(`${opt.name} Total`, MARGIN + 5, y + 7);
      const optTotal = optItems.reduce((s: number, i: any) => s + i.quantity * ((i as any).price ?? (i as any).good_price ?? 0), 0);
      doc.text(`$${optTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, MARGIN + CONTENT_W - 3, y + 7, { align: 'right' });
      y += 14;
    }
  } else {

  // Legacy tier-based pricing pages
  for (const tier of activeTiers) {
    onProgress?.(`Generating ${tier.label} option page...`);
    const tierLineItems = lineItems.filter(item =>
      !item.tiers_applicable || item.tiers_applicable.length === 0 || item.tiers_applicable.includes(tier.key)
    );
    if (tierLineItems.length === 0 && resolvedQuote[tier.totalKey] === 0) continue;
    y += SECTION_GAP;

    const showPrices = quote.show_line_item_prices !== false;
    const showSectionTotals = quote.show_section_totals !== false;

    // ── Section header (navy banner style) ───────────────────────────────
    const tierSectionNum = _contentSectionNum++;
    const tierSectionLabel = `SECTION ${String(tierSectionNum).padStart(2, '0')}`;
    const tierTitle = `Project Overview & Scope — ${tier.label} Option`;

    // Navy banner
    const bannerH = 20;
    doc.setFillColor(...brandPrimary);
    doc.roundedRect(MARGIN, y, CONTENT_W, bannerH, 3, 3, 'F');
    // Orange bottom stripe
    doc.setFillColor(...brandAccent);
    doc.rect(MARGIN, y + bannerH - 2, CONTENT_W, 2, 'F');
    // Section label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...brandAccent);
    doc.text(tierSectionLabel, MARGIN + 5, y + 7);
    // Title (left side)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...WHITE);
    doc.text(tierTitle, MARGIN + 5, y + 17);
    // Tier badge (right side)
    if (tier.badge) {
      doc.setFillColor(...WHITE);
      const badgeText = tier.badge;
      doc.setFontSize(6);
      const badgeW = doc.getTextWidth(badgeText) + 8;
      doc.roundedRect(PAGE_W - MARGIN - badgeW - 4, y + 6, badgeW, 6, 2, 2, 'F');
      doc.setTextColor(...brandPrimary);
      doc.text(badgeText, PAGE_W - MARGIN - badgeW / 2 - 4, y + 10, { align: 'center' });
    }

    y += bannerH + 4;

    // ── Tier description blurb ─────────────────
    if (tier.description) {
      doc.setFillColor(...tier.bgColor);
      doc.rect(MARGIN, y, CONTENT_W, 12, 'F');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...tier.color);
      const descLines = doc.splitTextToSize(tier.description, CONTENT_W - 8);
      doc.text(descLines.slice(0, 2), MARGIN + 4, y + 4.5);
      y += 14;
    }

    // ── Optional tier photo ───────────────────
    const tierImgData = tierPhotoDataMap.get(tier.key);
    if (tierImgData) {
      const imgH = 40;
      try {
        doc.addImage(tierImgData, 'JPEG', MARGIN, y, CONTENT_W, imgH, undefined, 'MEDIUM');
      } catch {
        doc.setFillColor(...GRAY_100);
        doc.rect(MARGIN, y, CONTENT_W, imgH, 'F');
      }
      y += imgH + 2;
    }

    // ── Section header ────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY_500);
    doc.text("WHAT'S INCLUDED", MARGIN, y + 3);
    doc.setFillColor(...GRAY_200);
    doc.rect(MARGIN, y + 5, CONTENT_W, 0.3, 'F');
    y += 7;

    // ── Per-category product list ─────────────
    const grouped = tierLineItems.reduce((acc, item) => {
      if ((item as any).is_divider) return acc; // skip visual dividers in PDF
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, LineItem[]>);

    for (const [category, items] of Object.entries(grouped)) {
      // Category label
      doc.setFillColor(...tier.bgColor);
      doc.roundedRect(MARGIN, y, CONTENT_W, 6, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...tier.color);
      doc.text(category.toUpperCase(), MARGIN + 4, y + 4.5);
      y += 7;

      for (const item of items) {
        const lineTotal = item.quantity * item[tier.priceKey];
        const productKey = tier.key === 'good' ? 'good_product' : tier.key === 'better' ? 'better_product' : 'best_product';
        const productName = (item as any)[productKey] as string | undefined;
        // Pre-calculate sub-lines so row height is accurate before drawing
        const descW = CONTENT_W * (showPrices ? 0.62 : 0.82);
        doc.setFontSize(6.5);
        const descLines: string[] = item.description
          ? doc.splitTextToSize(item.description, descW)
          : [];
        // Product name counts as one sub-line; description lines stack below it
        const subLineCount = (productName ? 1 : 0) + descLines.length;
        const itemH = subLineCount > 0 ? (6 + subLineCount * 3.5) : 6;

        // Rows used to run straight off the bottom of the sheet — harmless on a
        // 5-metre page, but on real pages everything past the fold vanished.
        // The height is known here, so break before a row that will not fit.
        ensureSpace(itemH + 2);

        doc.setDrawColor(...GRAY_200);
        doc.setLineWidth(0.2);
        doc.line(MARGIN, y + itemH, MARGIN + CONTENT_W, y + itemH);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...GRAY_900);
        doc.text(item.item_name, MARGIN + 2, y + 4.5);

        let subY = y + 8.5;
        if (productName) {
          // Product/grade name in tier color (italic)
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(6.5);
          doc.setTextColor(...tier.color);
          doc.text(productName, MARGIN + 2, subY);
          subY += 3.5;
        }
        if (descLines.length > 0) {
          // Full description including measurement breakdowns — all lines
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(...GRAY_500);
          descLines.forEach((line: string) => {
            doc.text(line, MARGIN + 2, subY);
            subY += 3.5;
          });
        }

        // Qty
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...GRAY_500);
        doc.text(`${item.quantity} ${item.unit}`, PAGE_W - MARGIN - (showPrices ? 28 : 4), y + 4.5, { align: 'right' });

        // Price (conditional)
        if (showPrices) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(...tier.color);
          doc.text(fmtCurrency(lineTotal), PAGE_W - MARGIN - 2, y + 4.5, { align: 'right' });
        }

        y += itemH;
      }

      // Section subtotal (conditional) — shows independently of line item prices
      if (showSectionTotals) {
        const sectionTotal = items.reduce((sum, item) => sum + item.quantity * item[tier.priceKey], 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...GRAY_500);
        doc.text(`${category} Subtotal:`, PAGE_W - MARGIN - 28, y + 2, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...tier.color);
        doc.text(fmtCurrency(sectionTotal), PAGE_W - MARGIN - 2, y + 2, { align: 'right' });
        y += 4;
      }
      y += 1;
    }

    // ── Total row ──────────────────────────────
    doc.setFillColor(...tier.color);
    doc.roundedRect(MARGIN, y, CONTENT_W, 12, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...WHITE);
    doc.text('Total Investment', MARGIN + 6, y + 8);
    doc.setFontSize(11);
    doc.text(fmtCurrency(resolvedQuote[tier.totalKey]), PAGE_W - MARGIN - 6, y + 8, { align: 'right' });
  }
  } // end else (legacy tiers)

  // ═══════════════════════════════════════════
  // CUSTOM PAGE SNAPSHOTS
  // ═══════════════════════════════════════════
  for (const customPage of selectedCustomPages) {
    onProgress?.(`Generating ${customPage.title} page...`);
    y += SECTION_GAP;
    const cpSectionNum = _contentSectionNum++;
    y = drawSectionHeader(`SECTION ${String(cpSectionNum).padStart(2, '0')}`, customPage.title, y);

    if (customPage.body) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...GRAY_700);
      const bodyLines = doc.splitTextToSize(customPage.body, CONTENT_W);
      bodyLines.forEach((line: string) => {
        if (y + 12 > CONTENT_BOTTOM) {
          y = startCustomPageSection();
        }
        doc.text(line, MARGIN, y);
        y += 5;
      });
      y += 4;
    }

    for (const attachment of customPage.attachments) {
      if (y + 60 > CONTENT_BOTTOM) {
        y = startCustomPageSection();
      }

      if (attachment.type.startsWith('image/')) {
        const imageData = await loadImageAsBase64(attachment.url);
        const imageHeight = 56;
        if (imageData) {
          try {
            doc.addImage(imageData, 'JPEG', MARGIN, y, CONTENT_W, imageHeight, undefined, 'MEDIUM');
          } catch {
            doc.setFillColor(...GRAY_100);
            doc.rect(MARGIN, y, CONTENT_W, imageHeight, 'F');
          }
        } else {
          doc.setFillColor(...GRAY_100);
          doc.rect(MARGIN, y, CONTENT_W, imageHeight, 'F');
        }
        y += imageHeight + 6;
      } else {
        doc.setFillColor(...GRAY_50);
        doc.roundedRect(MARGIN, y, CONTENT_W, 16, 3, 3, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...NAVY);
        doc.text(`Attachment: ${attachment.name}`, MARGIN + 5, y + 7);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...GRAY_500);
        doc.text('View the linked file in the digital proposal.', MARGIN + 5, y + 12);
        y += 22;
      }
    }
  }

  // ═══════════════════════════════════════════
  // WARRANTY PAGE
  // ═══════════════════════════════════════════
  if (includeWarranty) {
    onProgress?.('Generating warranty page...');
    y += SECTION_GAP;
    const warrantySectionNum = _contentSectionNum++;
    y = drawSectionHeader(`SECTION ${String(warrantySectionNum).padStart(2, '0')}`, 'Warranty Information', y);

    if (company.warranty_text) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...GRAY_700);
      const wLines = doc.splitTextToSize(company.warranty_text, CONTENT_W);
      wLines.forEach((line: string) => {
        ensureSpace(5);
        doc.text(line, MARGIN, y);
        y += 6;
      });
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(...GRAY_500);
      doc.text('Warranty information has not been configured.', MARGIN, y);
      y += 10;
    }

    y += 6;

    // Warranty Coverage Highlights panel
    ensureSpace(58);
    {
      const warrantyCards = [
        { title: 'Workmanship Warranty', detail: 'All labor and installation is backed by our workmanship guarantee for your peace of mind.' },
        { title: 'Material Warranty', detail: 'Manufacturer warranties apply to all materials used in your project per their published terms.' },
        { title: 'Warranty Service', detail: 'Contact us promptly for any warranty claims or concerns after project completion.' },
      ];
      const wpanelH = 68;
      doc.setFillColor(17, 24, 39);
      doc.roundedRect(MARGIN, y, CONTENT_W, wpanelH, 4, 4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...brandAccent);
      doc.text('WARRANTY COVERAGE HIGHLIGHTS', MARGIN + 6, y + 10);
      const wcW = (CONTENT_W - 10) / 3 - 2;
      const wcSY = y + 16;
      const wcH = wpanelH - 22;
      warrantyCards.forEach((card, i) => {
        const cx = MARGIN + 5 + i * (wcW + 2.5);
        doc.setFillColor(30, 41, 59);
        doc.roundedRect(cx, wcSY, wcW, wcH, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...WHITE);
        const ctLines = doc.splitTextToSize(card.title, wcW - 6);
        ctLines.slice(0, 2).forEach((line: string, li: number) => {
          doc.text(line, cx + 4, wcSY + 8 + li * 5);
        });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(200, 200, 200);
        const cdLines = doc.splitTextToSize(card.detail, wcW - 6);
        const offset = ctLines.length > 1 ? 24 : 18;
        cdLines.slice(0, 4).forEach((line: string, li: number) => {
          doc.text(line, cx + 4, wcSY + offset + li * 4.5);
        });
      });
      y += wpanelH + 6;
    }

    // Warranty contact box
    ensureSpace(28);
    {
      const contactBoxH = 22;
      doc.setFillColor(...GRAY_50);
      doc.roundedRect(MARGIN, y, CONTENT_W, contactBoxH, 3, 3, 'F');
      doc.setFillColor(...brandAccent);
      doc.rect(MARGIN, y, 3.5, contactBoxH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...GRAY_900);
      doc.text('Questions About Your Warranty?', MARGIN + 8, y + 8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...GRAY_700);
      const wContactParts: string[] = [company.phone, company.email].filter(Boolean) as string[];
      if (wContactParts.length > 0) doc.text(`Contact us: ${wContactParts.join('  |  ')}`, MARGIN + 8, y + 14.5);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(...GRAY_500);
      doc.text("We're committed to standing behind our work and ensuring your complete satisfaction.", MARGIN + 8, y + 20);
      y += contactBoxH + 4;
    }
  }

  // ═══════════════════════════════════════════
  // SIGNATURE PAGE (before cancel notice)
  // ═══════════════════════════════════════════
  onProgress?.('Generating signature page...');
  y += SECTION_GAP;
  const sigSectionNum = _contentSectionNum++;

  // ── Acceptance header banner ──────────────────────────────────────────────
  const selectedTierForSig = quote.selected_tier ? activeTiers.find(t => t.key === quote.selected_tier) : null;
  const acceptedTotal = selectedTierForSig ? resolvedQuote[selectedTierForSig.totalKey] : null;

  const sigBannerH = 22;
  doc.setFillColor(...brandPrimary);
  doc.roundedRect(MARGIN, y, CONTENT_W, sigBannerH, 3, 3, 'F');
  doc.setFillColor(...brandAccent);
  doc.rect(MARGIN, y + sigBannerH - 2, CONTENT_W, 2, 'F');
  // Label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...brandAccent);
  doc.text('QUOTE ACCEPTANCE AGREEMENT', MARGIN + 5, y + 7);
  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text('Customer Acceptance', MARGIN + 5, y + 18);
  // Accepted amount box (right side)
  if (acceptedTotal !== null && selectedTierForSig) {
    const amtBoxW = 48;
    doc.setFillColor(40, 68, 108);
    doc.roundedRect(PAGE_W - MARGIN - amtBoxW, y + 3, amtBoxW, sigBannerH - 6, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(163, 196, 232);
    doc.text(`${selectedTierForSig.label.toUpperCase()} TOTAL`, PAGE_W - MARGIN - amtBoxW / 2, y + 9, { align: 'center' });
    doc.setFontSize(11);
    doc.setTextColor(...WHITE);
    doc.text(fmtCurrency(acceptedTotal), PAGE_W - MARGIN - amtBoxW / 2, y + 17, { align: 'center' });
  }
  y += sigBannerH + 4;

  // ── Three info columns: Contractor | Customer | Quote Details ─────────────
  const infoColW = (CONTENT_W - 8) / 3;
  const infoColH = 34;
  const infoCols = [
    {
      label: 'CONTRACTOR',
      lines: [
        company.name,
        company.phone || '',
        company.email || '',
        company.address || '',
        [company.city, company.state, company.zip].filter(Boolean).join(', '),
      ].filter(Boolean),
    },
    {
      label: 'CUSTOMER',
      lines: quote.customer ? [
        `${quote.customer.first_name} ${quote.customer.last_name}`,
        quote.customer.address || '',
        [quote.customer.city, quote.customer.state, quote.customer.zip].filter(Boolean).join(', '),
        quote.customer.email || '',
        quote.customer.phone || '',
      ].filter(Boolean) : ['N/A'],
    },
    {
      label: 'QUOTE DETAILS',
      lines: [
        `Quote #: ${quote.quote_number}`,
        `Date Issued: ${new Date(quote.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}`,
        `Valid Until: ${new Date(new Date(quote.created_at).getTime() + 28 * 86400000).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}`,
      ],
    },
  ];

  infoCols.forEach((col, ci) => {
    const cx = MARGIN + ci * (infoColW + 4);
    doc.setFillColor(...GRAY_50);
    doc.roundedRect(cx, y, infoColW, infoColH, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...GRAY_500);
    doc.text(col.label, cx + 5, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY_900);
    col.lines.slice(0, 4).forEach((line, li) => {
      if (li === 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
      }
      doc.text(line, cx + 5, y + 13 + li * 5);
    });
  });
  y += infoColH + 4;

  // ── Accepted scope & tier price comparison ────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY_500);
  doc.text('ACCEPTED SCOPE OF WORK', MARGIN, y + 2);
  y += 8;

  // Show tier-name chips (Good/Better/Best) rather than line-item category names.
  // Customers choose a tier — categories are an internal implementation detail.
  const tierChips = activeTiers.map(t => t.label);
  let tagX = MARGIN;
  tierChips.forEach(s => {
    doc.setFillColor(...AMBER_LIGHT);
    const tagW = doc.getTextWidth(s) + 10;
    if (tagX + tagW > PAGE_W - MARGIN) return;
    doc.roundedRect(tagX, y, tagW, 7, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...AMBER);
    doc.text(s, tagX + 5, y + 5);
    tagX += tagW + 4;
  });
  y += 10;

  // Tier price comparison boxes
  if (activeTiers.length > 0) {
    const tierBoxW = Math.min((CONTENT_W - (activeTiers.length - 1) * 5) / activeTiers.length, 52);
    activeTiers.forEach((tier, ti) => {
      const tx = MARGIN + ti * (tierBoxW + 5);
      const isSelected = quote.selected_tier === tier.key;
      doc.setFillColor(...tier.bgColor);
      if (isSelected) { doc.setFillColor(...tier.color); }
      doc.roundedRect(tx, y, tierBoxW, 16, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(isSelected ? WHITE[0] : tier.color[0], isSelected ? WHITE[1] : tier.color[1], isSelected ? WHITE[2] : tier.color[2]);
      doc.text(tier.label.toUpperCase(), tx + tierBoxW / 2, y + 7, { align: 'center' });
      doc.setFontSize(9);
      doc.text(fmtCurrency(resolvedQuote[tier.totalKey]), tx + tierBoxW / 2, y + 13, { align: 'center' });
    });
    y += 18;
  }

  // ── Agreement terms ───────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY_500);
  doc.text('AGREEMENT TERMS', MARGIN, y + 2);
  y += 6;

  doc.setFillColor(...GRAY_50);
  const agText = legalNotice.contractAgreementText;
  const agLines = doc.splitTextToSize(agText, CONTENT_W - 10);
  const agBoxH = Math.max(agLines.length * 3.8 + 8, 18);
  doc.roundedRect(MARGIN, y, CONTENT_W, agBoxH, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY_700);
  agLines.forEach((line: string, i: number) => {
    doc.text(line, MARGIN + 5, y + 5 + i * 3.8);
  });
  y += agBoxH + 4;

  // ── Payment schedule ──────────────────────────────────────────────────────
  const customPmtText = (company as any).payment_terms_text?.trim();
  const depositPct = (company as any).default_deposit_percent ?? 50;
  const balancePct = 100 - depositPct;
  const pmtText = customPmtText ||
    `Payment Schedule: A deposit of ${depositPct}% of the agreed project total is due prior to ` +
    `commencement of work. The remaining ${balancePct}% balance is due upon satisfactory completion ` +
    `of all work described in this proposal. Any additional scope must be agreed upon in writing prior to performance.`;
  const pmtLines = doc.splitTextToSize(pmtText, CONTENT_W - 10);
  const pmtBoxH = Math.max(pmtLines.length * 3.8 + 8, 14);
  doc.setFillColor(...GRAY_50);
  doc.roundedRect(MARGIN, y, CONTENT_W, pmtBoxH, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY_700);
  pmtLines.forEach((line: string, i: number) => {
    doc.text(line, MARGIN + 5, y + 5 + i * 3.8);
  });
  y += pmtBoxH + 6;

  // ── Signature section ─────────────────────────────────────────────────────
  const sigColW = (CONTENT_W - 6) / 2;

  if (quote.signed_at && quote.signature_data) {
    // Signed — show the actual signature image
    doc.setFillColor(...GREEN_LIGHT);
    doc.roundedRect(MARGIN, y, CONTENT_W, 42, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...EMERALD);
    doc.text('Customer Signature', MARGIN + 5, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY_700);
    doc.text(`Signed by ${quote.signed_by || 'Customer'} on ${new Date(quote.signed_at).toLocaleDateString()}`, MARGIN + 5, y + 14);
    if (quote.signature_data.startsWith('data:image')) {
      try {
        doc.addImage(quote.signature_data, 'PNG', MARGIN + 5, y + 18, 60, 18);
      } catch { /* skip */ }
    }
  } else {
    // Unsigned — draw signature lines
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY_500);
    doc.text('CUSTOMER SIGNATURE', MARGIN, y);
    doc.text('CONTRACTOR REPRESENTATIVE', MARGIN + sigColW + 6, y);
    y += 6;

    // Customer sig line
    doc.setDrawColor(...GRAY_900);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y + 18, MARGIN + sigColW, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY_500);
    const custName = quote.customer ? `${quote.customer.first_name} ${quote.customer.last_name}` : '';
    if (custName) { doc.text(custName, MARGIN, y + 22); }
    doc.text('Print Name', MARGIN, y + 26);
    doc.line(MARGIN + sigColW * 0.65, y + 18, MARGIN + sigColW, y + 18);
    doc.text('Date', MARGIN + sigColW * 0.65 + 1, y + 22);

    // Contractor sig line
    const repX = MARGIN + sigColW + 6;
    doc.setDrawColor(...GRAY_900);
    doc.line(repX, y + 18, repX + sigColW, y + 18);
    doc.text('Print Name & Title', repX, y + 22);
    doc.text('Print Name', repX, y + 26);
    doc.line(repX + sigColW * 0.65, y + 18, repX + sigColW, y + 18);
    doc.text('Date', repX + sigColW * 0.65 + 1, y + 22);

    y += 34;

    // Footer line
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY_500);
    const footerParts = [company.name, company.phone, company.email].filter(Boolean).join('  |  ');
    doc.text(footerParts, MARGIN + CONTENT_W / 2, y + 4, { align: 'center' });
  }

  // ═══════════════════════════════════════════
  // 3-DAY RIGHT TO CANCEL (after signature)
  // ═══════════════════════════════════════════
  if (includeCancelNotice) {
    onProgress?.('Generating cancellation notice...');
    // Its own page. This is a statutory notice the homeowner keeps and returns,
    // not a continuation of the quote — and its heading, transaction date and
    // instructions previously drew with no space check at all, so whatever was
    // left at the foot of the page simply fell off it.
    addContentPage();
    y = CONTENT_TOP;

    doc.setFillColor(...AMBER_LIGHT);
    doc.roundedRect(MARGIN, y - 2, 10, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...AMBER);
    doc.text('!', MARGIN + 3.8, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...GRAY_900);
    doc.text(legalNotice.cancelTitle, MARGIN + 14, y + 5.5);
    y += 18;
    doc.setFillColor(...ORANGE);
    doc.rect(MARGIN, y, 40, 1.2, 'F');
    y += 8;

    // Date box
    doc.setFillColor(...AMBER_LIGHT);
    doc.roundedRect(MARGIN, y, CONTENT_W, 14, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY_900);
    doc.text(`Date of Transaction: ${new Date(quote.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, MARGIN + 6, y + 9);
    y += 22;

    const cancelParagraphs = [
      ...(legalNotice.cancelIntroParagraphs ?? [legalNotice.cancelBody ?? '']),
      '',
      legalNotice.cancelTitle.toUpperCase(),
      '',
      legalNotice.cancelInstructionText ?? '',
      '',
      'To cancel this transaction, mail or deliver a signed and dated copy of this cancellation notice or any other written notice to:',
    ];

    cancelParagraphs.forEach(text => {
      ensureSpace(30);
      if (text === '') { y += 3; return; }
      if (text === legalNotice.cancelTitle.toUpperCase()) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...GRAY_900);
        doc.text(text, MARGIN, y);
        y += 7;
        return;
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...GRAY_700);
      const pLines = doc.splitTextToSize(text, CONTENT_W);
      pLines.forEach((line: string) => {
        ensureSpace(30);
        doc.text(line, MARGIN, y);
        y += 4.5;
      });
    });

    // Company address box
    y += 4;
    ensureSpace(30);
    {
      doc.setFillColor(...GRAY_50);
      doc.roundedRect(MARGIN, y, CONTENT_W * 0.5, 26, 3, 3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...GRAY_900);
      doc.text(company.name, MARGIN + 6, y + 7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...GRAY_700);
      if (company.address) doc.text(company.address, MARGIN + 6, y + 13);
      doc.text([company.city, company.state, company.zip].filter(Boolean).join(', '), MARGIN + 6, y + 18);
      if (company.email) doc.text(company.email, MARGIN + 6, y + 23);
      y += 32;
    }

    // Deadline
    const deadlineStr = cancellationDeadline.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    ensureSpace(10);
    {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...GRAY_700);
      const prefix = 'NOT LATER THAN MIDNIGHT OF ';
      doc.text(prefix, MARGIN, y);
      doc.setFont('helvetica', 'bold');
      doc.text(deadlineStr, MARGIN + doc.getTextWidth(prefix), y);
    }
  }
  // ═══════════════════════════════════════════
  // FINALIZE: trim the page down to the content
  // ═══════════════════════════════════════════
  onProgress?.('Finalizing document...');

  // The media box used to be cropped here to trim the unused tail of the 5-metre
  // page. Pages are a fixed Letter size now, so there is no tail to crop.

  return doc;
}

// Copied from QuoteMGR src/lib/inspectionReportGenerator.ts (read-only reference).
/**
 * Web Inspection Photo Report Generator
 *
 * Fetches all inspection photos, compresses each one to ≤ 100 KB using the
 * Canvas API (no native dependencies), builds a self-contained HTML string,
 * then prints it via a hidden iframe — same "Save as PDF" flow as the
 * professional quote layout.
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

// ─── HTML builder ─────────────────────────────────────────────────────────────

const escHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return '';
  return new Date(typeof d === 'string' ? d : d).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
};

const buildReportHtml = (
  options: InspectionReportOptions,
  compressedPhotos: string[],
  logoDataUri: string,
  coverDataUri: string,
): string => {
  const {quote, photos, company, customer} = options;
  const primary = company.quote_primary_color || '#1e3a5f';
  const accent  = company.quote_accent_color  || '#ff6b35';

  const customerAddr = [
    customer.address,
    customer.city
      ? `${customer.city}, ${customer.state || ''} ${customer.zip || ''}`.trim()
      : null,
  ].filter(Boolean).join(' ');

  // Helper: normalise a field that may be a string (possibly comma-separated),
  // an array, or null/undefined — always returns a flat array of non-empty strings.
  const toTagList = (v: string | string[] | null | undefined): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    return v.split(',').map(s => s.trim()).filter(Boolean);
  };

  const buildPhotoCell = (photo: Photo, globalIndex: number): string => {
    const src = compressedPhotos[globalIndex] || photo.photo_url;
    const rawTags: string[] = [
      ...toTagList(photo.damage_type),
      ...toTagList((photo as any).damage_cause),
      ...toTagList(photo.location),
    ];
    return `<td class="photo-td">
      <div class="photo-card">
        <div class="photo-wrap">
          <img src="${escHtml(src)}" class="photo-img" alt="${escHtml(photo.caption || `Photo ${globalIndex + 1}`)}">
          <div class="photo-num">${globalIndex + 1}</div>
        </div>
        ${rawTags.length ? `<div class="photo-tags">${rawTags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
        ${photo.caption ? `<div class="photo-caption">${escHtml(photo.caption)}</div>` : ''}
      </div>
    </td>`;
  };

  // Page 1: header content + first 2 photos (1 table row).
  // Pages 2-N: 6 photos each (3 table rows of 2).
  // Footer goes after the very last photo — never on its own page.
  // Using <table><tr> because table-row page-break-inside:avoid is the most
  // reliably honored hint in all print engines (Chrome, Safari, WKWebView).
  const buildTableHtml = (chunk: Photo[], startGlobalIdx: number): string => {
    const rows: string[] = [];
    let idx = startGlobalIdx;
    for (let r = 0; r < chunk.length; r += 2) {
      const pair = chunk.slice(r, r + 2);
      const cells = pair.map(photo => buildPhotoCell(photo, idx++)).join('');
      const emptyCell = pair.length === 1 ? '<td class="photo-td"></td>' : '';
      rows.push(`<tr>${cells}${emptyCell}</tr>`);
    }
    return `<table class="photo-table"><tbody>${rows.join('')}</tbody></table>`;
  };

  const FIRST_PAGE_PHOTOS = 2;
  const PER_PAGE = 8;
  // chunk 0 = first 2 (go on page 1 with header); chunks 1-N = 8 each
  const allChunks: Photo[][] = [];
  if (photos.length > 0) {
    allChunks.push(photos.slice(0, FIRST_PAGE_PHOTOS));
    for (let i = FIRST_PAGE_PHOTOS; i < photos.length; i += PER_PAGE) {
      allChunks.push(photos.slice(i, i + PER_PAGE));
    }
  }
  let gIdx = 0; // running global photo index across all chunks

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 0; size: letter portrait; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size:12px; color:#111827; line-height:1.5; }

  .banner { background:${primary}; padding:28px 40px 24px; display:flex; justify-content:space-between; align-items:flex-start; }
  .banner-left { flex:1; }
  .banner-logo { height:44px; object-fit:contain; margin-bottom:10px; display:block; background:rgba(255,255,255,0.12); border-radius:8px; padding:6px; }
  .banner-company { font-size:20px; font-weight:800; color:#fff; }
  .banner-sub { font-size:11px; color:rgba(255,255,255,0.72); margin-top:3px; }
  .banner-right { text-align:right; }
  .banner-label { font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:rgba(255,255,255,0.6); }
  .banner-num { font-size:18px; font-weight:800; color:#fff; margin-top:2px; }
  .banner-date { font-size:10px; color:rgba(255,255,255,0.7); margin-top:3px; }
  .accent-bar { height:4px; background:${accent}; }

  .cover-wrap { overflow:hidden; max-height:280px; background:#f1f5f9; }
  .cover-img { width:100%; height:auto; max-height:280px; object-fit:cover; display:block; }

  .info-row { display:flex; border-bottom:1px solid #e5e7eb; }
  .info-card { flex:1; padding:14px 20px; border-right:1px solid #e5e7eb; }
  .info-card:last-child { border-right:none; }
  .info-label { font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:${accent}; margin-bottom:4px; }
  .info-name { font-size:13px; font-weight:700; color:${primary}; }
  .info-detail { font-size:11px; color:#6b7280; margin-top:2px; }

  .section-header { background:${primary}; padding:10px 40px; display:flex; align-items:center; gap:12px; }
  .section-badge { background:${accent}; color:#fff; font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; padding:3px 8px; border-radius:20px; }
  .section-title { font-size:14px; font-weight:700; color:#fff; }
  .section-inner { padding:20px 40px 28px; }

  /* Page 1 content area */
  .photo-page { padding:20px 40px 28px; }
  /* Continuation pages — explicit break-before applied via inline style, not sibling selector */
  .cont-page { padding:24px 40px 20px; }
  /* Table layout — rows are the most reliably break-inside:avoid unit across all print engines */
  .photo-table { width:100%; border-collapse:separate; border-spacing:0 14px; margin-top:-14px; }
  .photo-td { width:50%; vertical-align:top; padding:0 7px; }
  .photo-td:first-child { padding-left:0; }
  .photo-td:last-child { padding-right:0; }
  .photo-table tr { page-break-inside:avoid; break-inside:avoid; }
  .photo-card { border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; background:#fff; page-break-inside:avoid; break-inside:avoid; }
  /* Fixed-height contain box — shows full image with no cropping */
  .photo-wrap { position:relative; background:#e8edf2; height:220px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .photo-img { max-width:100%; max-height:220px; width:auto; height:auto; object-fit:contain; display:block; }
  .photo-num { position:absolute; top:8px; left:8px; background:rgba(0,0,0,0.55); color:#fff; font-size:10px; font-weight:700; width:22px; height:22px; border-radius:11px; display:flex; align-items:center; justify-content:center; }
  .photo-tags { display:flex; flex-wrap:wrap; gap:4px; padding:8px 10px 4px; }
  .tag { background:#fef3c7; color:#92400e; font-size:9px; font-weight:700; padding:2px 7px; border-radius:20px; border:1px solid #fcd34d; }
  .photo-caption { font-size:10px; color:#374151; padding:4px 10px 10px; line-height:1.5; }
  /* Continuation page photo sizing */
  .cont-page .photo-table { border-spacing:0 10px; margin-top:-10px; }
  .cont-page .photo-wrap { height:166px; }
  .cont-page .photo-img { max-height:166px; }
  .cont-page .photo-tags { padding:6px 9px 3px; gap:3px; }
  .cont-page .photo-caption { padding:3px 9px 8px; line-height:1.35; }

  .report-footer { background:${primary}; padding:10px 40px; display:flex; justify-content:space-between; align-items:center; margin-top:24px; }
  .footer-text { font-size:10px; color:rgba(255,255,255,0.7); }
  .footer-count { font-size:10px; color:rgba(255,255,255,0.9); font-weight:700; }
</style>
</head>
<body>

<!-- ── Page 1: header + first 2 photos ── -->
<div${allChunks.length > 1 ? ' style="page-break-after:always;break-after:page;"' : ''}>
  <div class="banner">
    <div class="banner-left">
      ${logoDataUri ? `<img src="${escHtml(logoDataUri)}" class="banner-logo" alt="${escHtml(company.name)}">` : ''}
      <div class="banner-company">${escHtml(company.name)}</div>
      <div class="banner-sub">Inspection Photo Report</div>
    </div>
    <div class="banner-right">
      <div class="banner-label">Quote Number</div>
      <div class="banner-num">#${escHtml(String(quote.quote_number))}</div>
      <div class="banner-date">${fmtDate(quote.created_at)}</div>
    </div>
  </div>
  <div class="accent-bar"></div>
  ${coverDataUri ? `<div class="cover-wrap"><img src="${escHtml(coverDataUri)}" class="cover-img" alt="Property"></div><div class="accent-bar"></div>` : ''}
  <div class="info-row">
    <div class="info-card">
      <div class="info-label">Property / Customer</div>
      <div class="info-name">${escHtml(`${customer.first_name} ${customer.last_name}`)}</div>
      ${customerAddr ? `<div class="info-detail">${escHtml(customerAddr)}</div>` : ''}
    </div>
    <div class="info-card">
      <div class="info-label">Project</div>
      <div class="info-name">${escHtml(quote.cover_page_title || quote.project_description || 'Inspection')}</div>
      ${quote.project_description && quote.cover_page_title ? `<div class="info-detail">${escHtml(quote.project_description)}</div>` : ''}
    </div>
    <div class="info-card">
      <div class="info-label">Total Photos</div>
      <div class="info-name">${photos.length}</div>
      <div class="info-detail">Compressed · ${fmtDate(quote.created_at)}</div>
    </div>
  </div>
  <div class="section-header">
    <span class="section-badge">Documentation</span>
    <span class="section-title">Inspection Photos</span>
  </div>
  ${allChunks.length > 0 ? `<div class="photo-page">${buildTableHtml(allChunks[0], 0)}${(() => { gIdx = allChunks[0].length; return ''; })()}</div>` : ''}
  ${allChunks.length === 1 ? `<div class="report-footer"><div class="footer-text">${escHtml(company.name)} · Quote #${escHtml(String(quote.quote_number))} · Inspection Report</div><div class="footer-count">${photos.length} photos</div></div>` : ''}
</div>

<!-- ── Pages 2-N: 6 photos each, footer on the last page ── -->
${allChunks.slice(1).map((chunk, i) => {
  const isLast = i === allChunks.length - 2;
  const startIdx = gIdx;
  gIdx += chunk.length;
  return `<div style="page-break-before:always;break-before:page;">
  <div class="cont-page">${buildTableHtml(chunk, startIdx)}</div>
  ${isLast ? `<div class="report-footer"><div class="footer-text">${escHtml(company.name)} · Quote #${escHtml(String(quote.quote_number))} · Inspection Report</div><div class="footer-count">${photos.length} photos</div></div>` : ''}
</div>`;
}).join('\n')}

</body>
</html>`;
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const generateAndPrintInspectionReport = async (
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

  // Compress logo and cover photo
  let logoDataUri = '';
  let coverDataUri = '';
  if (company.logo_url) {
    onProgress?.('Processing logo…');
    logoDataUri = await fetchAndCompressToDataUri(company.logo_url, 60);
  }
  if (quote.cover_photo_url) {
    onProgress?.('Processing cover photo…');
    coverDataUri = await fetchAndCompressToDataUri(quote.cover_photo_url, 120);
  }

  onProgress?.('Building report…');
  const html = buildReportHtml(options, compressed, logoDataUri, coverDataUri);

  // Print via hidden iframe (same pattern as "Download Professional")
  onProgress?.('Opening print dialog…');
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:0;';
  document.body.appendChild(iframe);

  await new Promise<void>(resolve => {
    iframe.addEventListener('load', () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch { /* already removed */ }
        }, 60000);
        resolve();
      }, 400);
    });
    iframe.srcdoc = html;
  });
};

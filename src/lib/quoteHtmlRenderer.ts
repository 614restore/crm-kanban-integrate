// Copied from QuoteMGR src/lib/quoteHtmlRenderer.ts (read-only reference).
// Web-compatible port of the mobile pdfGenerator HTML generation.
// No React Native dependencies — generates a self-contained HTML string
// suitable for display in an <iframe srcDoc={...}>.

import { canHideBranding, normalizeTier } from './planLimits';
import { getMeasurementSummary } from './measurementSummary';
import { calculateCancellationDeadline, getLegalNotice } from './legalNotices';

type PageKey = 'cover' | 'about' | 'scope' | 'photos' | 'warranty' | 'signature' | 'cancel';

const PAGE_TITLES: Record<PageKey, string> = {
  cover: 'Cover',
  about: 'About Our Company',
  scope: 'Project Overview & Scope',
  photos: 'Photo Documentation',
  warranty: 'Warranty Information',
  signature: 'Quote Acceptance Agreement',
  cancel: '3-Day Right to Cancel',
};

const DEFAULT_PAGE_ORDER: PageKey[] = ['cover', 'about', 'photos', 'scope', 'warranty', 'signature', 'cancel'];
const VALID_PAGE_KEYS = new Set<PageKey>(DEFAULT_PAGE_ORDER);

interface QuoteHtmlOptions {
  quote: any;
  lineItems: any[];
  photos: any[];
  company: any;
  customer: any;
  signatureData?: string;
  signedBy?: string;
  signedAt?: string;
  cancelSignatureData?: string;
  cancelSignedAt?: string;
  contractorSignatureData?: string;
  contractorSignedBy?: string;
  contractorSignedAt?: string;
  selectedSections?: string[];
  upgrades?: any[];
  quoteOptions?: any[];
}

// ── Tier color helpers ────────────────────────────────────────────────────────
const _hexDarken = (hex: string, amt: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amt)))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
};
const _hexLighten = (hex: string, amt: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + (255 - v) * amt))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
};
const _hexRgba = (hex: string, a: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};
const _makeTierPalette = (color: string) => {
  const dark  = _hexDarken(color, 0.22);
  const light = _hexLighten(color, 0.14);
  return {
    headerGrad:  `linear-gradient(135deg, ${dark} 0%, ${color} 55%, ${light} 100%)`,
    accentBar:   light,
    footerBg:    dark,
    cardGrad:    `linear-gradient(135deg, ${dark} 0%, ${color} 45%, ${_hexLighten(color, 0.2)} 100%)`,
    cardShadow:  _hexRgba(color, 0.25),
    bannerGrad:  `linear-gradient(135deg, ${color} 0%, ${_hexLighten(color, 0.22)} 100%)`,
    bannerShadow: _hexRgba(color, 0.35),
    badgeBg:     _hexLighten(color, 0.76),
    badgeFg:     _hexDarken(color, 0.28),
  };
};
// ─────────────────────────────────────────────────────────────────────────────

export const generateQuoteHTML = ({
  quote,
  lineItems,
  photos,
  company,
  customer,
  signatureData,
  signedBy,
  signedAt,
  cancelSignatureData,
  cancelSignedAt,
  contractorSignatureData,
  contractorSignedBy,
  contractorSignedAt,
  selectedSections,
  upgrades,
  quoteOptions,
}: QuoteHtmlOptions): string => {
  const hasOptions = quoteOptions && quoteOptions.length > 0;
  // True when this is a multi-scope quote (options with linked line items)
  const someItemsLinkedToOptions = lineItems.some((i: any) => i.quote_option_id != null);
  const isMultiScope = hasOptions && someItemsLinkedToOptions;
  // "Designed with QuoteMGR" — shown on customer documents unless the company
  // is on a tier whose pricing promises white-labelling (Business, Enterprise)
  // and has switched it off. Starter and Professional advertise custom
  // branding, not white-label, so the line stays for them.
  const brandingHidden =
    canHideBranding(normalizeTier((company as any).subscription_plan ?? (company as any).subscription_tier)) &&
    (company as any).hide_quotemgr_branding === true;
  const attributionHtml = brandingHidden
    ? ''
    : `<p style="margin-top:6px;font-size:9px;color:#9ca3af;">Designed with QuoteMGR</p>`;

  const groupedItems = groupLineItemsByCategory(lineItems);
  const categoryTotals = calculateCategoryTotals(groupedItems);
  const totals = calculateTotals(lineItems);
  const resolvedTotals = quote.use_manual_totals
    ? {
        // Fall back to computed total when manual total is 0/unset
        good:   (quote.manual_good_total   || 0) || (quote.good_total   || totals.good),
        better: (quote.manual_better_total || 0) || (quote.better_total || totals.better),
        best:   (quote.manual_best_total   || 0) || (quote.best_total   || totals.best),
      }
    : {
        // Use saved DB total; fall back to live recalculation when the DB value was never set (0)
        good:   quote.good_total   || totals.good,
        better: quote.better_total || totals.better,
        best:   quote.best_total   || totals.best,
      };
  const quoteUpgrades = upgrades ?? quote.upgrades ?? [];
  const visibleUpgrades = quoteUpgrades.filter(upgrade => upgrade.is_suggested || upgrade.is_selected);
  const primaryColor = company.quote_primary_color || '#1e3a5f';
  const secondaryColor = company.quote_secondary_color || '#0d1f3c';
  const accentColor = company.quote_accent_color || '#ff6b35';
  const tierPalettes = {
    good:   _makeTierPalette(company.tier_good_color   || '#059669'),
    better: _makeTierPalette(company.tier_better_color || '#2563eb'),
    best:   _makeTierPalette(company.tier_best_color   || '#d97706'),
  };
  const goodTierName = quote.good_tier_name || 'Good';
  const betterTierName = quote.better_tier_name || 'Better';
  const bestTierName = quote.best_tier_name || 'Best';
  const measurementSummary = getMeasurementSummary(
    quote.measurement_provider,
    quote.measurement_source_name,
    quote.measurement_data ?? null,
  );
  const legalNotice = getLegalNotice(customer.state, company.state);
  const cancellationDeadline = calculateCancellationDeadline(quote.sent_at || quote.created_at || new Date());
  const acceptedSections = selectedSections?.length
    ? selectedSections
    : Object.keys(groupedItems);
  const acceptedSectionTotals = calculateAcceptedSectionTotals(
    categoryTotals,
    acceptedSections,
  );
  const isInspectionReportDoc = quote.quote_structure_type === 'inspection_report' || quote.project_type === 'inspection_report';
  const orderedPageKeys = resolvePageOrder(quote.page_order, {
    includeAbout: quote.include_about_page !== false,
    // Inspection reports have no line items/pricing to show a scope page for
    // unless the contingency toggle is on, where 'scope' renders the
    // contingency agreement instead.
    includeScope: !isInspectionReportDoc || Boolean(quote.contingency_enabled),
    includePhotos: photos.length > 0,
    includeWarranty: quote.include_warranty_page !== false && Boolean(company.warranty_text),
    // Inspection reports never get the generic tier-acceptance signature/cancel
    // pages — with contingency on, signing happens via the dedicated agreement
    // flow; with it off, there's nothing to sign at all, just cover/about/photos.
    includeSignatureAndCancel: !isInspectionReportDoc && !quote.contingency_enabled && quote.quote_structure_type !== 'insurance_invoice' && quote.quote_structure_type !== 'insurance_supplement',
    includeCancel: quote.include_cancel_notice !== false,
  });
  const signatureImage = signatureData || quote.signature_data || null;
  const signedName = signedBy || quote.signed_by || '';
  const signedDate = signedAt || quote.signed_at || '';
  const cancelSignatureImage = cancelSignatureData || quote.cancel_signature_data || null;
  const cancelSignedDate = cancelSignedAt || quote.cancel_signed_at || '';
  const contractorSigImage = contractorSignatureData || quote.contractor_signature_data || null;
  const contractorSigName = contractorSignedBy || quote.contractor_signed_by || '';
  const contractorSigDate = contractorSignedAt || quote.contractor_signed_at || '';
  const frontPageImageUrl = quote.cover_photo_url || photos[0]?.photo_url || '';
  const hasCoverImage = Boolean(frontPageImageUrl);
  const proposalSections = orderedPageKeys.map((pageKey, index) => ({
    number: String(index + 1).padStart(2, '0'),
    title: PAGE_TITLES[pageKey],
  }));
  const overviewCards = Object.entries(groupedItems).map(([category, items]) => ({
    category,
    itemCount: items.length,
    summary: items
      .slice(0, 4)
      .map(item => item.item_name)
      .filter(Boolean),
    totals: categoryTotals[category],
  }));
  const DEFAULT_EXPERTISE_CARDS = [
    { title: 'Transparent Process',         description: 'Clear scopes, organized approvals, and visible milestones from start to finish.' },
    { title: 'Quality Craftsmanship',       description: 'Work is organized by trade section so every part of the project is easy to review.' },
    { title: 'Professional Documentation', description: 'Photos, section totals, upgrades, and acceptance details are packaged into one proposal.' },
    { title: 'Customer-Focused Delivery',  description: 'Customers can review options, select sections, and sign the exact scope they want.' },
  ];
  const DEFAULT_PROCESS_STEPS = [
    { title: 'Free Inspection & Photo Report',   desc: 'We inspect your property and deliver a detailed photo report with findings and recommendations—no pressure, just facts.' },
    { title: 'Custom Quote & Planning',           desc: 'Receive a no-obligation quote with transparent pricing, materials, and timeline. We handle insurance claims if needed.' },
    { title: 'Scheduling & Prep',                 desc: 'We order premium materials, secure permits, and schedule at your convenience. Your project manager keeps you updated every step.' },
    { title: 'Expert Installation & Final Check', desc: 'Our certified crew completes the job efficiently, cleans up completely, and walks through the result with you. 2-year labor warranty included.' },
    { title: 'Ongoing Support & Warranty',        desc: 'We activate your manufacturer warranty, provide all documentation, and offer priority service for any future needs.' },
  ];
  const processSteps: Array<{ title: string; desc: string }> =
    company.about_process_steps && company.about_process_steps.length > 0
      ? company.about_process_steps.map(s => ({ title: s.title, desc: s.description }))
      : DEFAULT_PROCESS_STEPS;
  // Use company's custom highlights if set; fall back to defaults
  const expertiseCards: Array<{ title: string; description: string; photoUrl?: string }> =
    company.about_highlights && company.about_highlights.length > 0
      ? company.about_highlights.slice(0, 4).map(h => ({ title: h.title, description: h.description, photoUrl: h.photoUrl }))
      : DEFAULT_EXPERTISE_CARDS;
  const companyHighlights = [
    {
      value: `${Object.keys(groupedItems).length}+`,
      label: 'Project Sections',
      detail: 'Clearly organized scopes and trade categories for easier review.',
    },
    {
      value: `${photos.length}+`,
      label: 'Inspection Photos',
      detail: 'Documented site conditions and supporting project photography.',
    },
    {
      value: `${getVisibleTierCount(quote)}`,
      label: 'Pricing Options',
      detail: 'Flexible proposal options with clear totals and optional upgrades.',
    },
  ];
  // Use company's custom "Why Clients Choose Us" items if configured, else hardcoded defaults
  const DEFAULT_COVER_BADGES = [
    { title: 'Licensed & Insured',  detail: 'Protected work, documented crews, and accountable project delivery.' },
    { title: 'Free Estimates',      detail: 'Clear scopes and pricing before the project moves forward.' },
    { title: 'Quality Materials',   detail: 'Professional-grade products selected for long-term performance.' },
    { title: 'Expert Team',         detail: 'Skilled installers and organized oversight from start to finish.' },
  ];
  const coverBadges: Array<{ title: string; detail: string }> =
    company.about_highlights && company.about_highlights.length > 0
      ? company.about_highlights.slice(0, 4).map(h => ({ title: h.title, detail: h.description }))
      : DEFAULT_COVER_BADGES;

  // Header card intentionally omitted from inner sections — the document flows
  // as one continuous scroll. A small running footer at the bottom of each
  // section carries the branding without creating page-break-like visual gaps.
  const renderHeader = () => '';

  const isSubscribed = company.subscription_status === 'active' || company.watermark_exempt === true;
  const wmUrl = isSubscribed ? (company.quote_watermark_url || null) : '/quotemgr-logo.png';
  const wmOpacity = isSubscribed ? (company.quote_watermark_opacity ?? 0.08) : 0.06;
  const wmDiagonal = isSubscribed
    ? (company.quote_watermark_rotation ?? 'diagonal') === 'diagonal'
    : true;
  const wmTransform = wmDiagonal
    ? 'translate(-50%, -50%) rotate(-45deg)'
    : 'translate(-50%, -50%)';
  // Size: user-controlled 0.20–1.40 multiplier. Default 0.55 (55% = original subtle size).
  const wmSize = isSubscribed ? (company.quote_watermark_size ?? 0.55) : 0.55;
  const wmSizePct = `${Math.round(wmSize * 100)}%`;
  const renderWatermark = () => wmUrl
    ? `<img src="${escapeHtml(wmUrl)}" class="page-watermark" alt="" style="opacity:${wmOpacity};transform:${wmTransform};width:${wmSizePct};height:${wmSizePct};" />`
    : '';

  const heroContent = `
    <div class="hero-topline">Prepared proposal</div>
    <div class="hero-brand">
      ${company.logo_url ? `<img src="${escapeHtml(company.logo_url)}" class="hero-logo" alt="${escapeHtml(company.name)}">` : ''}
      <div>
        <div class="hero-company">${escapeHtml(company.name)}</div>
        <div class="hero-subtitle">${escapeHtml(quote.project_type)} project proposal</div>
      </div>
    </div>
    <div class="hero-title">${escapeHtml(truncateForCover(
      (quote.completion_certificate_enabled && (!quote.cover_page_title || quote.cover_page_title === 'Inspection Report'))
        ? 'Completion Photos & Certificate'
        : (quote.cover_page_title || 'Project Proposal'),
      70
    ))}</div>
    <div class="hero-description">
      ${escapeHtml(truncateForCover(quote.project_description || 'A clear proposal designed to present your scope, pricing, documentation, and acceptance details.', 260))}
    </div>
    <div class="hero-meta-grid">
      <div class="hero-meta-card">
        <div class="hero-meta-label">Prepared For</div>
        <div class="hero-meta-value">${escapeHtml(truncateForCover(`${customer.first_name || ''} ${customer.last_name || ''}`.trim(), 90))}</div>
      </div>
      <div class="hero-meta-card">
        <div class="hero-meta-label">Prepared By</div>
        <div class="hero-meta-value">${escapeHtml(truncateForCover(quote.creator?.full_name || company.name, 90))}</div>
      </div>
      <div class="hero-meta-card">
        <div class="hero-meta-label">Proposal Date</div>
        <div class="hero-meta-value">${formatDate(quote.created_at)}</div>
      </div>
      <div class="hero-meta-card">
        <div class="hero-meta-label">Quote Number</div>
        <div class="hero-meta-value">${escapeHtml(quote.quote_number)}</div>
      </div>
    </div>
  `;

  // Stacked layout: photo block on top, dark content block below.
  // Pan (object-position) is plain CSS on a frame-sized <img> -- proven safe in
  // production for months. Zoom is edited and live-previewed in the app, but is
  // intentionally NOT applied here: a same-day version of this file rendered a
  // zoomed cover photo through an oversized <img> clipped only by a parent's
  // overflow:hidden (plus a JS margin-shift), and Chrome's print/Save-as-PDF
  // pipeline did not reliably clip that overflow -- it produced 30MB+ PDFs with
  // blank space pushed onto a couple of pages. Until a safer implementation
  // (pre-cropping to a bitmap, the way pdfGenerator.ts's jsPDF path already
  // does) is built and verified, printed/downloaded/emailed documents show the
  // chosen pan position at a native "cover" crop, ignoring zoom.
  const coverOffsetX = quote.cover_photo_offset_x ?? 50;
  const coverOffsetY = quote.cover_photo_offset_y ?? 50;
  const heroPanelHtml = hasCoverImage
    ? `<div style="border-radius:20px;overflow:hidden;background:${primaryColor};">
        <img
          src="${escapeHtml(frontPageImageUrl)}"
          style="display:block;width:100%;height:180px;object-fit:cover;object-position:${coverOffsetX}% ${coverOffsetY}%;"
          alt="Property photo"
          crossorigin="anonymous"
        >
        <div style="padding:14px 22px;color:white;background:linear-gradient(180deg,${secondaryColor} 0%,${primaryColor} 100%);">
          ${heroContent}
        </div>
       </div>`
    : `<div class="hero-panel hero-panel-compact">
        <div class="hero-content hero-content-compact">
          ${heroContent}
        </div>
       </div>`;

  const renderCoverPage = () => `
    <div class="page page-cover">
      ${renderWatermark()}
      <div class="hero-shell ${hasCoverImage ? 'hero-shell-image' : 'hero-shell-compact'}">
        <div>${heroPanelHtml}</div>

        <div class="hero-sidebar">
          <div class="sidebar-card">
            <div class="sidebar-title">Proposal Sections</div>
            ${proposalSections.map(section => `
              <div class="sidebar-row">
                <span class="sidebar-number">${section.number}</span>
                <span class="sidebar-text">${escapeHtml(section.title)}</span>
              </div>
            `).join('')}
          </div>

          <div class="sidebar-card compact">
            <div class="sidebar-title">Project Snapshot</div>
            <div class="snapshot-row"><span>Valid Until</span><strong>${formatDate(quote.valid_until || new Date())}</strong></div>
            <div class="snapshot-row"><span>Sections</span><strong>${Object.keys(groupedItems).length}</strong></div>
            <div class="snapshot-row"><span>Photos</span><strong>${photos.length}</strong></div>
            <div class="snapshot-row"><span>Options</span><strong>${getVisibleTierCount(quote)}</strong></div>
          </div>

          <div class="sidebar-card compact" style="padding:14px 12px;">
            <div class="sidebar-title" style="margin-bottom:8px;">Your Representative</div>
            ${quote.sales_rep_photo_url ? (() => {
              // Small (56px) avatar -- transform:scale is safe at this size, unlike
              // the full-width cover photo above (see its comment for why the
              // oversized-img + overflow:hidden technique was reverted there).
              const zoom = quote.sales_rep_photo_zoom ?? 1;
              const ox   = quote.sales_rep_photo_offset_x ?? 50;
              const oy   = quote.sales_rep_photo_offset_y ?? 50;
              return `<img src="${escapeHtml(quote.sales_rep_photo_url)}" alt="Sales Representative" crossorigin="anonymous" style="width:56px;height:56px;border-radius:50%;object-fit:cover;display:block;margin:0 0 8px;border:3px solid ${accentColor};transform:scale(${zoom});transform-origin:${ox}% ${oy}%;">`;
            })() : ''}
            ${(quote.creator?.full_name || company.name) ? `<div style="font-size:12px;font-weight:700;color:#111827;line-height:1.3;margin-bottom:6px;">${escapeHtml(quote.creator?.full_name || company.name)}</div>` : ''}
            <div style="height:1px;background:#e5e7eb;margin:8px 0;"></div>
            ${company.phone ? `<div style="font-size:11px;color:#374151;margin-bottom:4px;">📞 ${escapeHtml(company.phone)}</div>` : ''}
            ${company.email ? `<div style="font-size:11px;color:#374151;margin-bottom:4px;">✉ ${escapeHtml(company.email)}</div>` : ''}
            ${company.website ? `<div style="font-size:11px;color:#374151;margin-bottom:4px;overflow-wrap:break-word;word-break:break-all;">🌐 ${escapeHtml(company.website)}</div>` : ''}
            ${company.license_number ? `<div style="font-size:11px;color:#374151;">✓ Lic. ${escapeHtml(company.license_number)}</div>` : ''}
          </div>
        </div>
      </div>

      ${measurementSummary ? `
        <div class="measurement-summary">
          <div class="section-title">Imported Measurements</div>
          <div class="measurement-source">
            ${escapeHtml(measurementSummary.providerLabel)}${measurementSummary.sourceName ? ` • ${escapeHtml(measurementSummary.sourceName)}` : ''}
          </div>
          <div class="measurement-grid">
            <div class="measurement-card">
              <div class="measurement-label">Roof Area</div>
              <div class="measurement-value">${escapeHtml(String(measurementSummary.roofAreaSqft))} sqft</div>
            </div>
            <div class="measurement-card">
              <div class="measurement-label">Facets</div>
              <div class="measurement-value">${escapeHtml(String(measurementSummary.facets))}</div>
            </div>
            <div class="measurement-card">
              <div class="measurement-label">Pitch</div>
              <div class="measurement-value">${escapeHtml(String(measurementSummary.pitch))}</div>
            </div>
            <div class="measurement-card">
              <div class="measurement-label">Structures</div>
              <div class="measurement-value">${escapeHtml(String(measurementSummary.structures))}</div>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  const renderAboutPage = () => {
    const sectionNum = String(proposalSections.findIndex(section => section.title === PAGE_TITLES.about) + 1).padStart(2, '0');
    const aboutBodyText = (company.about_mission && company.about_mission.trim())
      ? company.about_mission.trim()
      : (company.about_text && company.about_text.trim())
      ? company.about_text.trim()
      : null;
    const aboutBody = aboutBodyText
      ? formatRichText(aboutBodyText)
      : [
          company.address ? `<p style="margin-bottom:6px;">${escapeHtml(company.address)}${company.city ? `, ${escapeHtml(company.city)}, ${escapeHtml(company.state || '')} ${escapeHtml(company.zip || '')}` : ''}</p>` : '',
          company.phone   ? `<p style="margin-bottom:6px;">📞 ${escapeHtml(company.phone)}</p>` : '',
          company.email   ? `<p style="margin-bottom:6px;">✉️ ${escapeHtml(company.email)}</p>` : '',
          company.website ? `<p style="margin-bottom:6px;">🌐 ${escapeHtml(company.website)}</p>` : '',
          company.license_number ? `<p style="margin-bottom:6px;">License #${escapeHtml(company.license_number)}</p>` : '',
        ].filter(Boolean).join('') || '<p style="color:#9ca3af;">Company details coming soon.</p>';
    return `
    <div class="page">
      ${renderWatermark()}
      ${renderHeader()}
      <div class="proposal-panel">
        <div class="proposal-panel-header">
          <div class="proposal-panel-kicker">Section ${sectionNum}</div>
          <div class="proposal-panel-title">About ${escapeHtml(company.name || 'Our Company')}</div>
        </div>
        <div class="proposal-panel-accent"></div>
        <div class="proposal-panel-body" style="padding: 20px 24px 0;">
          <div class="about-heading" style="font-size: 15px; margin-bottom: 14px;">${escapeHtml(company.about_tagline || 'A professional company committed to quality, clarity, and reliable delivery.')}</div>
          <div class="about-section" style="font-size: 12px; line-height: 1.6; color: #374151; margin-bottom: 24px;">${aboutBody}</div>
          ${company.about_showcase_photos && company.about_showcase_photos.length > 0 ? `
          <div style="margin-bottom: 24px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 8px;">Our Work</div>
            <div class="showcase-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
              ${company.about_showcase_photos.slice(0, 4).map(p => `
                <div style="border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; aspect-ratio: 4/3; position: relative;">
                  <img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.caption || 'Our work')}" style="width:100%;height:100%;object-fit:cover;display:block;">
                  ${p.caption ? `<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.5);color:#fff;font-size:9px;padding:3px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.caption)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>` : ''}
        </div>
        <!-- Why Clients Choose Us — full-width dark strip at the bottom -->
        <div style="background:#111827;padding:20px 24px 22px;border-radius:0 0 18px 18px;break-inside:avoid;page-break-inside:avoid;">
          <div style="font-size:13px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${accentColor};margin-bottom:16px;">Why Clients Choose Us</div>
          <div class="about-card-row">
            ${expertiseCards.map(card => `
              <div class="about-card" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.10);border-top:3px solid ${accentColor};border-radius:12px;padding:14px 12px 16px;">
                <div style="font-size:13px;font-weight:800;color:#ffffff;margin-bottom:8px;line-height:1.25;">${escapeHtml(card.title)}</div>
                <div style="font-size:11px;line-height:1.55;color:rgba(255,255,255,0.80);">${escapeHtml(card.description)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
  };

  const renderScopePage = () => {
    const scopeSectionNum = String(proposalSections.findIndex(section => section.title === PAGE_TITLES.scope) + 1).padStart(2, '0');

    // Build one page per tier so pricing is never seen side-by-side
    const renderOneTierPage = (
      tierKey: 'good' | 'better' | 'best',
      tierName: string,
      tierTotal: number,
      tierPhoto: string | undefined | null,
      tierCardClass: string,
      isLast: boolean,
      tierDesc?: string | null
    ) => {
      const priceKey   = `${tierKey}_price`   as 'good_price' | 'better_price' | 'best_price';
      const productKey = `${tierKey}_product` as 'good_product' | 'better_product' | 'best_product';
      const { badgeBg, badgeFg } = tierPalettes[tierKey];

      const tierGroupedItems: Record<string, any[]> = Object.fromEntries(
        Object.entries(groupedItems)
          .map(([cat, items]) => [cat, (items as any[]).filter((item: any) =>
            !item.tiers_applicable || item.tiers_applicable.length === 0 || item.tiers_applicable.includes(tierKey)
          )])
          // Drop categories the customer would see as an empty table — e.g. a
          // labor category where every row is internal-only. Their dollars stay
          // in the tier total, which is computed from the full item list.
          .filter(([, items]) => (items as any[]).some((i: any) => !i.hidden_from_customer))
      );
      const tierCategoryTotals = calculateCategoryTotals(tierGroupedItems);
      const categoryBlocks = Object.entries(tierGroupedItems).map(([category, items]) => {
        const categoryTotal = tierCategoryTotals[category];
        const catTierTotal  = categoryTotal[tierKey];
        return `
          <div class="category-section">
            <div class="category-header">${escapeHtml(category)}</div>
            <table>
              <thead>
                <tr>
                  <th style="width:52%;">Item</th>
                  <th style="width:10%;">Qty</th>
                  <th style="width:10%;">Unit</th>
                  ${quote.show_line_item_prices !== false ? `<th style="width:14%;" class="price">Unit Price</th><th style="width:14%;" class="price">Total</th>` : ''}
                </tr>
              </thead>
              <tbody>
                ${items.filter(item => !item.hidden_from_customer).map(item => `
                  <tr style="break-inside:avoid;page-break-inside:avoid;">
                    <td>
                      <div class="item-name">${escapeHtml(item.item_name)}</div>
                      ${item.description ? `<div class="item-description">${escapeHtml(item.description)}</div>` : ''}
                      ${item[productKey] ? `<span style="font-size:10px;background:${badgeBg};color:${badgeFg};padding:1px 6px;border-radius:20px;font-weight:500;display:inline-block;margin-top:2px;">${escapeHtml(item[productKey] as string)}</span>` : ''}
                    </td>
                    <td>${formatNumber(item.quantity)}</td>
                    <td>${escapeHtml(item.unit)}</td>
                    ${quote.show_line_item_prices !== false ? `
                      <td class="price">$${formatMoney(item[priceKey])}</td>
                      <td class="price">$${formatMoney(item.quantity * item[priceKey])}</td>
                    ` : ''}
                  </tr>
                `).join('')}
                ${quote.show_section_totals !== false && quote.show_line_item_prices !== false ? `
                  <tr class="category-total">
                    <td colspan="${quote.show_line_item_prices !== false ? 3 : 3}"><strong>${escapeHtml(category)} Subtotal</strong></td>
                    ${quote.show_line_item_prices !== false ? `<td class="price"></td><td class="price">$${formatMoney(catTierTotal)}</td>` : ''}
                  </tr>
                ` : ''}
              </tbody>
            </table>
            ${quote.show_section_totals !== false && quote.show_line_item_prices === false ? `
              <div class="subtotal-strip">
                <div class="subtotal-item">
                  <span>${escapeHtml(category)} subtotal</span>
                  <strong>$${formatMoney(catTierTotal)}</strong>
                </div>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      const isSingleTier = tierKey === 'good' && quote.include_better === false && quote.include_best === false;
      const tierLabelText = isSingleTier ? 'Project Total' : `${escapeHtml(tierName)} Option`;
      const tierSummary = `
        <div class="tier-totals" style="grid-template-columns: 1fr; max-width: 380px; margin: 24px auto 0;">
          <div class="tier-card ${tierCardClass}">
            ${tierPhoto ? `<img src="${tierPhoto}" data-lb data-caption="${isSingleTier ? 'Project' : escapeHtml(tierName) + ' Option'}" alt="${isSingleTier ? 'Project' : escapeHtml(tierName) + ' option'}" style="width:calc(100% + 32px);height:160px;object-fit:cover;border-radius:8px 8px 0 0;margin:-16px -16px 12px -16px;" />` : ''}
            ${isSingleTier ? '' : `<div class="tier-label">${escapeHtml(tierName)} Option</div>`}
            <div class="tier-amount">$${formatMoney(tierTotal)}</div>
            ${tierDesc ? `<div style="font-size:12px;margin-top:10px;opacity:0.9;font-style:italic;line-height:1.5;">${escapeHtml(tierDesc)}</div>` : ''}
          </div>
        </div>
        ${isLast && visibleUpgrades.length > 0 ? `
          <div class="section-title" style="margin-top: 32px;">Suggested Upgrades</div>
          ${renderUpgradeTable(visibleUpgrades, quote, {goodTierName, betterTierName, bestTierName})}
        ` : ''}
      `;

      return `
        <div class="page">
          ${renderWatermark()}
          ${renderHeader()}
          <div class="proposal-panel-header compact">
            <div class="proposal-panel-kicker">Section ${scopeSectionNum}</div>
            <div class="proposal-panel-title">${isSingleTier ? 'Project Overview & Scope' : `Project Overview & Scope — ${escapeHtml(tierName)} Option`}</div>
          </div>
          <div class="proposal-panel-accent" style="margin-bottom:18px;"></div>
          <div class="about-heading" style="margin-bottom:18px;">
            ${isSingleTier
              ? 'A detailed breakdown of the proposed work.'
              : `A detailed breakdown of the proposed work for the <strong>${escapeHtml(tierName)}</strong> option.`}
          </div>
          ${categoryBlocks}
          ${tierSummary}
        </div>
      `;
    };

    // Option-based rendering (new architecture).
    // Guard: only enter this path when at least one line item actually references an option
    // via quote_option_id.  If quote_options rows exist but no items are linked (e.g. a legacy
    // tiered quote that was incorrectly given option records), fall through to the tier path so
    // line items are not silently swallowed.
    const someItemsLinkedToOptions = lineItems.some((i: any) => i.quote_option_id != null);
    if (hasOptions && quoteOptions && someItemsLinkedToOptions) {
      // Per-option color palette: green / blue / amber
      const optPalette = [
        { headerGrad: 'linear-gradient(135deg, #065f46 0%, #047857 55%, #059669 100%)', accentBar: '#10b981', footerBg: '#047857' },
        { headerGrad: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 55%, #2563eb 100%)', accentBar: '#3b82f6', footerBg: '#1d4ed8' },
        { headerGrad: 'linear-gradient(135deg, #78350f 0%, #b45309 55%, #d97706 100%)', accentBar: '#f59e0b', footerBg: '#b45309' },
      ];
      // Build each option as a self-contained block (no per-option page wrapper).
      // All option blocks flow inside ONE .page div so there is no forced blank
      // space between short scopes — the content fills the page naturally.
      // Single-tier mode: suppress options 2 and 3 when Better+Best are hidden.
      const visibleOptions = (quote.include_better === false && quote.include_best === false)
        ? quoteOptions.slice(0, 1)
        : quoteOptions;
      const optionBlocks = visibleOptions.map((opt, idx) => {
        const pal = optPalette[idx % optPalette.length];
        const optItems = lineItems.filter((i: any) => i.quote_option_id === opt.id);
        const optTotal = optItems.reduce((s: number, i: any) => s + i.quantity * (i.price ?? i.good_price ?? 0), 0);
        const optGrouped: Record<string, any[]> = {};
        for (const item of optItems) {
          if (!optGrouped[item.category]) optGrouped[item.category] = [];
          optGrouped[item.category].push(item);
        }
        const categoryBlocks = Object.entries(optGrouped)
          // Skip categories with nothing customer-visible (e.g. internal labor)
          .filter(([, items]) => (items as any[]).some((i: any) => !i.hidden_from_customer))
          .map(([category, items]) => {
          const catTotal = (items as any[]).reduce((s: number, i: any) => s + i.quantity * (i.price ?? i.good_price ?? 0), 0);
          const rows = (items as any[]).filter((i: any) => !i.hidden_from_customer).map((item: any) => `
            <tr style="break-inside:avoid;page-break-inside:avoid;">
              <td>
                <div class="item-name">${escapeHtml(item.item_name)}</div>
                ${item.description ? `<div class="item-description">${escapeHtml(item.description)}</div>` : ''}
              </td>
              <td>${item.quantity}</td>
              <td>${escapeHtml(item.unit)}</td>
              ${quote.show_line_item_prices !== false ? `<td class="price">$${formatMoney(item.price ?? item.good_price ?? 0)}</td><td class="price">$${formatMoney(item.quantity * (item.price ?? item.good_price ?? 0))}</td>` : ''}
            </tr>
          `).join('');
          return `
            <div class="category-section">
              <div class="category-header">${escapeHtml(category)}</div>
              <table>
                <thead>
                  <tr>
                    <th style="width:52%;">Item</th>
                    <th style="width:10%;">Qty</th>
                    <th style="width:10%;">Unit</th>
                    ${quote.show_line_item_prices !== false ? `<th style="width:14%;" class="price">Unit Price</th><th style="width:14%;" class="price">Total</th>` : ''}
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
              ${quote.show_section_totals !== false ? `<div class="category-total">Section Total: $${formatMoney(catTotal)}</div>` : ''}
            </div>
          `;
        }).join('');
        const isNotLast = idx < visibleOptions.length - 1;
        return `
          <div style="${isNotLast ? 'margin-bottom: 32px;' : ''}">
            <div class="proposal-panel-header compact" style="background:${pal.headerGrad};">
              <div class="proposal-panel-kicker" style="color:rgba(255,255,255,0.65);">${visibleOptions.length > 1 ? `Option ${idx + 1} of ${visibleOptions.length}` : 'Project Scope'}</div>
              <div class="proposal-panel-title">${escapeHtml(opt.name)}</div>
            </div>
            <div class="proposal-panel-accent" style="background:${pal.accentBar};margin-bottom:18px;"></div>
            ${categoryBlocks}
            <div style="margin-top:20px;background:${pal.footerBg};border-radius:14px;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;color:#ffffff;">
              <div>
                <div style="font-size:10px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;opacity:0.65;margin-bottom:4px;">Option Total</div>
                <div style="font-size:16px;font-weight:700;">${escapeHtml(opt.name)}</div>
              </div>
              <div style="font-size:32px;font-weight:900;letter-spacing:-0.5px;">$${formatMoney(optTotal)}</div>
            </div>
          </div>
        `;
      });
      return `
        <div class="page">
          ${renderWatermark()}
          ${renderHeader()}
          <div class="proposal-panel-header compact">
            <div class="proposal-panel-kicker">Section ${scopeSectionNum}</div>
            <div class="proposal-panel-title">Project Overview & Scope</div>
          </div>
          <div class="proposal-panel-accent" style="margin-bottom:18px;"></div>
          ${optionBlocks.join('')}
        </div>
      `;
    }

    // Determine which tiers are active and render a page for each (legacy model)
    const tierPages: string[] = [];
    if (resolvedTotals.good > 0) {
      tierPages.push(renderOneTierPage('good', goodTierName, resolvedTotals.good, quote.tier_photo_good, 'tier-good', quote.include_better === false && quote.include_best === false, quote.tier_desc_good));
    }
    if (quote.include_better !== false && resolvedTotals.better > 0) {
      tierPages.push(renderOneTierPage('better', betterTierName, resolvedTotals.better, quote.tier_photo_better, 'tier-better', quote.include_best === false, quote.tier_desc_better));
    }
    if (quote.include_best !== false && resolvedTotals.best > 0) {
      tierPages.push(renderOneTierPage('best', bestTierName, resolvedTotals.best, quote.tier_photo_best, 'tier-best', true, quote.tier_desc_best));
    }

    return tierPages.join('\n');
  };

  const renderInvoicePage = () => {
    const total = (quote as any).manual_good_total ?? 0;
    const deposit = (quote as any).deposit_amount ?? 0;
    const balance = total - deposit;
    const depositDue = (quote as any).deposit_due_date
      ? new Date((quote as any).deposit_due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : null;
    const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const customerName = quote.customer
      ? `${quote.customer.first_name || ''} ${quote.customer.last_name || ''}`.trim()
      : (quote as any).customer_name || '';
    const address = [quote.customer?.address, quote.customer?.city, quote.customer?.state].filter(Boolean).join(', ');
    return `
      <div class="page" style="padding:56px 64px; font-family:'Inter',sans-serif; color:#111827; background:#fff;">
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:40px; padding-bottom:24px; border-bottom:2px solid #e5e7eb;">
          <div>
            <div style="font-size:11px; font-weight:700; letter-spacing:2px; color:#6b7280; text-transform:uppercase; margin-bottom:6px;">Insurance Work Authorization</div>
            <div style="font-size:28px; font-weight:800; color:#111827; margin-bottom:4px;">${quote.cover_page_title || 'Project Invoice'}</div>
            <div style="font-size:14px; color:#6b7280;">Quote #${quote.quote_number || ''}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700; font-size:15px; color:#111827;">${company.name}</div>
            ${company.phone ? `<div style="font-size:13px; color:#6b7280;">${company.phone}</div>` : ''}
            ${company.email ? `<div style="font-size:13px; color:#6b7280;">${company.email}</div>` : ''}
            ${company.website ? `<div style="font-size:13px; color:#6b7280;">${company.website}</div>` : ''}
          </div>
        </div>

        <!-- Customer + Project -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:32px; margin-bottom:40px;">
          <div style="background:#f9fafb; border-radius:12px; padding:20px;">
            <div style="font-size:11px; font-weight:700; letter-spacing:1.5px; color:#9ca3af; text-transform:uppercase; margin-bottom:10px;">Bill To</div>
            <div style="font-weight:700; font-size:16px; color:#111827;">${customerName}</div>
            ${address ? `<div style="font-size:14px; color:#6b7280; margin-top:4px;">${address}</div>` : ''}
            ${quote.customer?.email ? `<div style="font-size:14px; color:#6b7280; margin-top:2px;">${quote.customer.email}</div>` : ''}
            ${quote.customer?.phone ? `<div style="font-size:14px; color:#6b7280; margin-top:2px;">${quote.customer.phone}</div>` : ''}
          </div>
          <div style="background:#f9fafb; border-radius:12px; padding:20px;">
            <div style="font-size:11px; font-weight:700; letter-spacing:1.5px; color:#9ca3af; text-transform:uppercase; margin-bottom:10px;">Project</div>
            <div style="font-weight:600; font-size:15px; color:#111827;">${quote.project_description || quote.cover_page_title || ''}</div>
            ${quote.notes ? `<div style="font-size:13px; color:#6b7280; margin-top:6px; line-height:1.5;">${quote.notes}</div>` : ''}
          </div>
        </div>

        <!-- Amount table -->
        <div style="border:2px solid #e5e7eb; border-radius:16px; overflow:hidden; margin-bottom:40px;">
          <div style="background:#1e3a5f; padding:16px 24px;">
            <div style="color:#fff; font-weight:700; font-size:14px; letter-spacing:0.5px;">Payment Summary</div>
          </div>
          <div style="padding:0 24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:18px 0; border-bottom:1px solid #f3f4f6;">
              <div>
                <div style="font-weight:600; font-size:15px; color:#111827;">Total Project Amount</div>
                <div style="font-size:12px; color:#6b7280; margin-top:2px;">Insurance-approved scope of work</div>
              </div>
              <div style="font-size:20px; font-weight:800; color:#111827;">$${fmt(total)}</div>
            </div>
            ${deposit > 0 ? `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:18px 0; border-bottom:1px solid #f3f4f6;">
              <div>
                <div style="font-weight:600; font-size:15px; color:#111827;">Deposit / Down Payment</div>
                ${depositDue ? `<div style="font-size:12px; color:#dc2626; font-weight:600; margin-top:2px;">Due by ${depositDue}</div>` : ''}
              </div>
              <div style="font-size:18px; font-weight:700; color:#dc2626;">$${fmt(deposit)}</div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding:18px 0;">
              <div>
                <div style="font-weight:700; font-size:15px; color:#111827;">Balance Due at Completion</div>
                <div style="font-size:12px; color:#6b7280; margin-top:2px;">Payable upon satisfactory completion</div>
              </div>
              <div style="font-size:20px; font-weight:800; color:#1e3a5f;">$${fmt(balance)}</div>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Signature / Authorization -->
        <div style="border:1.5px solid #e5e7eb; border-radius:16px; padding:28px; margin-bottom:24px;">
          <div style="font-size:13px; font-weight:700; color:#374151; margin-bottom:12px; text-transform:uppercase; letter-spacing:1px;">Authorization</div>
          <div style="font-size:13px; color:#4b5563; line-height:1.7; margin-bottom:20px;">
            By signing below, I authorize ${company.name} to perform the scope of work as outlined in this invoice and as approved by my insurance carrier. I agree to pay the deposit amount listed above and the balance due upon satisfactory completion of the work.
          </div>
          ${quote.signature_data ? `
            <div style="margin-bottom:8px;">
              <img src="${quote.signature_data}" style="max-height:60px; max-width:280px;" />
            </div>
            <div style="font-size:12px; color:#374151; font-weight:600;">${quote.signed_by || customerName}</div>
            <div style="font-size:11px; color:#6b7280; margin-top:2px;">${quote.signed_at ? new Date(quote.signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}</div>
          ` : `
            <div style="border-bottom:1.5px solid #374151; width:280px; margin-bottom:6px; height:50px;"></div>
            <div style="font-size:12px; color:#374151;">Customer Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div>
          `}
        </div>

        <div style="font-size:11px; color:#9ca3af; text-align:center;">
          ${company.name}${company.address ? ' · ' + company.address : ''}${company.license_number ? ' · License #' + company.license_number : ''}
        </div>
      </div>
    `;
  };

  const renderContingencyPage = () => {
    const sectionNum = String(proposalSections.findIndex(s => s.title === PAGE_TITLES.scope) + 1).padStart(2, '0');
    const cancelDeadline = calculateCancellationDeadline(quote.created_at || new Date()).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const isSigned = quote.status === 'signed';
    return `
    <div class="page">
      ${renderWatermark()}
      ${renderHeader()}
      <div class="proposal-panel-header compact">
        <div class="proposal-panel-kicker">Section ${sectionNum}</div>
        <div class="proposal-panel-title">Insurance Contingency Agreement</div>
      </div>
      <div class="proposal-panel-accent" style="margin-bottom:18px;"></div>
      <div style="padding:0 4px">
        <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:10px;padding:12px 16px;text-align:center;margin-bottom:20px">
          <p style="font-weight:700;color:#92400e;font-size:13px;margin:0">⚠ THREE (3) BUSINESS DAY RIGHT TO CANCEL</p>
          <p style="color:#92400e;font-size:11px;margin:4px 0 0">You may cancel this agreement without penalty within 3 business days of signing.</p>
        </div>
        <div style="space-y:12px;font-size:11.5px;color:#374151;line-height:1.6">
          ${[
            ['1. Contingency Basis', 'This Agreement is entered into on a contingency basis. No restoration or repair work will be performed and no payment will be due from the Property Owner unless and until the Property Owner\'s insurance carrier approves a claim for the repair or replacement of damage to the property described herein.'],
            ['2. Authorization to Act', 'Property Owner hereby authorizes Contractor to communicate directly with Property Owner\'s insurance company, insurance adjuster, and any related parties on Property Owner\'s behalf for the sole purpose of facilitating the insurance claim and scope of approved repairs. This authorization does not constitute assignment of benefits.'],
            ['3. Scope of Work', 'Contractor agrees to perform all work as outlined and approved in the final insurance scope of loss issued by the insurance carrier. Any supplements or additional line items identified during the course of the project that are approved by the insurance carrier shall be included in the final contract price.'],
            ['4. Payment Terms', 'Property Owner agrees to pay Contractor all insurance proceeds received from the insurance carrier for covered repairs, including any recoverable depreciation released upon completion of work, all approved supplements, and the applicable insurance deductible as stated in the Property Owner\'s policy.'],
            ['5. No Out-of-Pocket Cost Representation', 'Contractor makes no guarantee that Property Owner will owe nothing beyond the deductible. Final amounts owed are determined by the insurance carrier\'s approved scope and applicable policy terms.'],
            ['6. Property Owner Responsibilities', 'Property Owner agrees to promptly provide Contractor with all insurance documentation, adjuster reports, and claim correspondence. Property Owner shall not independently settle or close the insurance claim without written consent from Contractor while this Agreement is in effect.'],
            ['7. Contractor Obligations', 'Contractor agrees to provide professional workmanship meeting or exceeding industry standards, maintain all required licenses and insurance coverage, and pursue all legitimate supplements on behalf of the Property Owner at no additional charge beyond the approved insurance scope.'],
            ['8. Cancellation', 'Either party may cancel this Agreement within three (3) business days of execution without penalty. After the rescission period, cancellation by the Property Owner after work has commenced may result in liability for costs incurred by Contractor up to the date of cancellation.'],
          ].map(([title, body]) => `
            <div style="margin-bottom:10px;break-inside:avoid;page-break-inside:avoid;">
              <p style="font-weight:600;color:#111827;margin:0 0 2px">${title}</p>
              <p style="margin:0;color:#4b5563">${body}</p>
            </div>
          `).join('')}
        </div>
        <!-- Signatures: customer agreement + contractor (side by side when both present) -->
        <div style="margin-top:20px;border-top:1.5px solid #e5e7eb;padding-top:16px;break-inside:avoid;page-break-inside:avoid;">
          ${(() => {
            const custSigImg  = (quote as any).contingency_signature_data  || quote.signature_data  || null;
            const custSigName = (quote as any).contingency_signed_by        || quote.signed_by        || '';
            const custSigDate = (quote as any).contingency_signed_at        || quote.signed_at        || '';
            const contSigImg  = contractorSigImage;
            const contName    = contractorSigName;
            const contDate    = contractorSigDate;
            const hasCustSig  = isSigned && custSigImg;
            const hasContSig  = isSigned && contSigImg;
            if (!isSigned) return `
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                <div>
                  <p style="font-size:11px;color:#6b7280;margin:0 0 6px">Property Owner Signature &amp; Date</p>
                  <div style="border-bottom:1.5px solid #374151;height:40px;margin-bottom:4px"></div>
                  <div style="display:flex;justify-content:space-between"><p style="font-size:10px;color:#9ca3af;margin:0">Signature</p><p style="font-size:10px;color:#9ca3af;margin:0">Date</p></div>
                </div>
                <div>
                  <p style="font-size:11px;color:#6b7280;margin:0 0 6px">Sales Representative Signature</p>
                  <div style="border-bottom:1.5px solid #374151;height:40px;margin-bottom:4px"></div>
                  <div style="display:flex;justify-content:space-between"><p style="font-size:10px;color:#9ca3af;margin:0">Signature</p><p style="font-size:10px;color:#9ca3af;margin:0">Date</p></div>
                </div>
              </div>`;
            return `<div style="display:grid;grid-template-columns:${hasContSig ? '1fr 1fr' : '1fr'};gap:16px">
              <div>
                <p style="font-size:11px;color:#6b7280;margin:0 0 6px">Property Owner Signature &amp; Date</p>
                ${hasCustSig
                  ? `<img src="${escapeHtml(custSigImg!)}" style="max-height:56px;max-width:240px;object-fit:contain;display:block;margin-bottom:4px" alt="Customer Signature">`
                  : '<div style="border-bottom:1.5px solid #374151;height:40px;margin-bottom:4px"></div>'
                }
                <div style="display:flex;justify-content:space-between">
                  <p style="font-size:10px;color:#374151;font-weight:600;margin:0">${escapeHtml(custSigName)}</p>
                  <p style="font-size:10px;color:#374151;margin:0">${custSigDate ? new Date(custSigDate).toLocaleDateString() : ''}</p>
                </div>
              </div>
              ${hasContSig ? `
              <div>
                <p style="font-size:11px;color:#6b7280;margin:0 0 6px">Sales Representative Signature</p>
                <img src="${escapeHtml(contSigImg!)}" style="max-height:56px;max-width:240px;object-fit:contain;display:block;margin-bottom:4px" alt="Contractor Signature">
                <div style="display:flex;justify-content:space-between">
                  <p style="font-size:10px;color:#374151;font-weight:600;margin:0">${escapeHtml(contName)}</p>
                  <p style="font-size:10px;color:#374151;margin:0">${contDate ? new Date(contDate).toLocaleDateString() : ''}</p>
                </div>
              </div>` : ''}
            </div>`;
          })()}
        </div>

        <!-- 3-Day Right to Cancel — embedded in same page, no extra header break -->
        <div style="margin-top:24px;border-top:2px solid #fca5a5;padding-top:16px;break-inside:avoid;page-break-inside:avoid;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
            <div style="width:28px;height:28px;background:#dc2626;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <span style="color:#fff;font-weight:900;font-size:14px">!</span>
            </div>
            <p style="font-weight:700;color:#7f1d1d;font-size:13px;margin:0">3-Day Right to Cancel</p>
          </div>
          <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:10px;padding:14px;margin-bottom:14px;break-inside:avoid;page-break-inside:avoid;">
            <p style="font-weight:700;color:#7f1d1d;font-size:12px;margin:0 0 6px;text-align:center">NOTICE OF THREE (3) DAY RIGHT TO CANCEL</p>
            <p style="color:#991b1b;font-size:11.5px;line-height:1.6;margin:0 0 6px">You, the buyer, may cancel this transaction at any time prior to midnight of the third business day after the date of this transaction.</p>
            <p style="color:#991b1b;font-size:11.5px;line-height:1.6;margin:0 0 6px">To cancel this transaction, mail or deliver a signed and dated copy of this cancellation notice to:</p>
            <p style="font-weight:600;color:#7f1d1d;font-size:11.5px;margin:0">${escapeHtml(company.name || '')}</p>
            ${company.address ? `<p style="color:#7f1d1d;font-size:11.5px;margin:0">${escapeHtml(company.address)}${company.city ? ', ' + escapeHtml(company.city) : ''}${company.state ? ', ' + escapeHtml(company.state) : ''}</p>` : ''}
            ${company.email ? `<p style="color:#7f1d1d;font-size:11.5px;margin:0">${escapeHtml(company.email)}</p>` : ''}
            <p style="color:#991b1b;font-size:11.5px;line-height:1.6;margin:6px 0 0">NOT LATER THAN MIDNIGHT OF <strong>${cancelDeadline}</strong>.</p>
          </div>
          <p style="font-size:11.5px;color:#374151;line-height:1.6;margin:0 0 14px">If you cancel, any payments made by you will be returned within 10 business days following receipt of your cancellation notice.</p>
          ${company.cost_recovery_clause_enabled !== false ? `<div style="background:#fef9c3;border:1.5px solid #fbbf24;border-radius:8px;padding:12px;margin-bottom:14px;break-inside:avoid;page-break-inside:avoid;">
            <p style="font-weight:700;font-size:11px;color:#78350f;margin:0 0 6px">When This Clause Applies</p>
            <p style="font-size:10.5px;color:#92400e;line-height:1.6;margin:0 0 8px">This cost-recovery clause is <strong>only triggered</strong> under a very specific set of circumstances — it is not a general cancellation fee:</p>
            <ul style="font-size:10.5px;color:#92400e;line-height:1.6;margin:0 0 8px;padding-left:16px">
              <li>Your insurance carrier has <strong>already approved the claim</strong>, and</li>
              <li>You have <strong>not yet moved forward with repairs</strong>, and</li>
              <li>The contractor has <strong>already incurred costs</strong> related to the claim — costs that cannot be recouped if the project does not proceed.</li>
            </ul>
            <p style="font-size:10.5px;color:#92400e;line-height:1.6;margin:0 0 8px">Those costs may include adjuster meetings and scope negotiations, permit fees, engineering or inspection reports, ordered materials with non-refundable restocking fees, or emergency services already performed. Because the project will not be completed, there is no longer a contract value from which the contractor can recover these expenses.</p>
            <p style="font-size:10.5px;color:#92400e;line-height:1.6;margin:0 0 6px">Where applicable, administrative fees are structured in line with standard insurance industry <strong>Overhead &amp; Profit (O&amp;P) percentages</strong> — typically 10% overhead and 10% profit — a range already recognized by insurance adjusters and defensible before a mediator or arbitrator.</p>
            <div style="background:#fff8e1;border-left:3px solid #f59e0b;padding:8px 10px;border-radius:0 6px 6px 0;">
              <p style="font-weight:700;font-size:10px;color:#78350f;margin:0 0 3px">Key Legal Note</p>
              <p style="font-size:10px;color:#92400e;line-height:1.6;margin:0">State contractor regulations may place caps on cancellation fees or require specific language for a fee to qualify as legitimate liquidated damages rather than an unenforceable penalty. Aligning fees with standard O&amp;P percentages (10%–20%) provides the strongest legal justification.</p>
            </div>
          </div>` : ''}
          <div style="border-top:1.5px solid #e5e7eb;padding-top:14px">
            <p style="font-size:11px;color:#6b7280;margin:0 0 6px">Property Owner Signature — Acknowledging Receipt of Right to Cancel &amp; Date</p>
            ${(() => {
              const cancelSigImg  = (quote as any).contingency_cancel_signature_data || quote.cancel_signature_data || null;
              const cancelSigName = (quote as any).contingency_signed_by              || quote.signed_by              || '';
              const cancelSigDate = (quote as any).contingency_cancel_signed_at       || quote.signed_at              || '';
              if (isSigned && cancelSigImg) return `
                <img src="${escapeHtml(cancelSigImg)}" style="max-height:56px;max-width:240px;object-fit:contain;display:block;margin-bottom:4px" alt="Cancel Acknowledgment Signature">
                <div style="display:flex;justify-content:space-between">
                  <p style="font-size:10px;color:#374151;font-weight:600;margin:0">${escapeHtml(cancelSigName)}</p>
                  <p style="font-size:10px;color:#374151;margin:0">${cancelSigDate ? new Date(cancelSigDate).toLocaleDateString() : ''}</p>
                </div>`;
              return `
                <div style="border-bottom:1.5px solid #374151;height:40px;margin-bottom:4px"></div>
                <div style="display:flex;justify-content:space-between">
                  <p style="font-size:10px;color:#9ca3af;margin:0">Signature</p>
                  <p style="font-size:10px;color:#9ca3af;margin:0">Date</p>
                </div>`;
            })()}
          </div>
        </div>
      </div>
    </div>
  `;
  };

  const renderPhotosPage = () => `
    <div class="page">
      ${renderWatermark()}
      ${renderHeader()}
      <div class="proposal-panel-header compact">
        <div class="proposal-panel-kicker">Section ${String(proposalSections.findIndex(section => section.title === PAGE_TITLES.photos) + 1).padStart(2, '0')}</div>
        <div class="proposal-panel-title">Photo Documentation</div>
      </div>
      <div class="proposal-panel-accent" style="margin-bottom:18px;"></div>
      <div class="photos-wrap">
        ${(() => {
          const renderPhotoCard = (photo: any) => `
          <div class="photo-item">
            <img src="${escapeHtml(photo.photo_url)}" class="photo-img" data-lb data-caption="${escapeHtml(photo.caption || '')}" data-notes="${escapeHtml(photo.notes || '')}" alt="${escapeHtml(photo.caption || 'Project photo')}">
            ${photo.caption ? `<div class="photo-caption">${escapeHtml(photo.caption)}</div>` : ''}
            ${(() => {
              const locs = photo.location ? photo.location.split(',').filter(Boolean).map(l => `<span class="photo-tag photo-tag-blue">${escapeHtml(l.trim())}</span>`).join('') : '';
              const dmgs = photo.damage_type ? photo.damage_type.split(',').filter(Boolean).map(d => `<span class="photo-tag photo-tag-red">${escapeHtml(d.trim())}</span>`).join('') : '';
              return (locs || dmgs) ? `<div class="photo-tags">${locs}${dmgs}</div>` : '';
            })()}
            ${photo.notes ? `<div class="photo-notes">${escapeHtml(photo.notes)}</div>` : ''}
          </div>`;
          const rows: any[][] = [];
          for (let i = 0; i < photos.length; i += 2) rows.push(photos.slice(i, i + 2));
          return rows.map(row => `
          <div class="photo-row">${row.map(renderPhotoCard).join('')}</div>`).join('');
        })()}
      </div>
    </div>
  `;

  const renderWarrantyPage = () => `
    <div class="page">
      ${renderWatermark()}
      ${renderHeader()}
      <div class="proposal-panel">
        <div class="proposal-panel-header">
          <div class="proposal-panel-kicker">Section ${String(proposalSections.findIndex(s => s.title === PAGE_TITLES.warranty) + 1).padStart(2, '0')}</div>
          <div class="proposal-panel-title">Warranty Information</div>
        </div>
        <div class="proposal-panel-accent"></div>
        <div class="proposal-panel-body" style="padding:20px 24px 0;">
          <div class="warranty-section" style="margin-bottom:20px;">${formatRichText(company.warranty_text || '')}</div>
        </div>
        <div style="background:#111827;padding:20px 24px 22px;border-radius:0 0 18px 18px;break-before:avoid;page-break-before:avoid;">
          <div style="font-size:13px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${accentColor};margin-bottom:16px;">Our Seamless Process</div>
          <div class="about-card-row">
            ${processSteps.map((step, idx) => `
              <div class="about-card" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.10);border-top:3px solid ${accentColor};border-radius:12px;padding:12px 10px 14px;break-inside:avoid;page-break-inside:avoid;">
                <div style="width:22px;height:22px;border-radius:50%;background:${accentColor};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff;margin-bottom:8px;">${String(idx + 1).padStart(2, '0')}</div>
                <div style="font-size:11px;font-weight:800;color:#ffffff;margin-bottom:6px;line-height:1.3;">${escapeHtml(step.title)}</div>
                <div style="font-size:10px;line-height:1.5;color:rgba(255,255,255,0.75);">${escapeHtml(step.desc)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  const renderAcceptancePage = () => {
    // ── Insurance Contingency Agreement page ─────────────────────────────────
    if ((quote as any).include_payment_contract) {
      const custName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Homeowner';
      const addr = [customer.address, customer.city ? `${customer.city}, ${customer.state || ''} ${customer.zip || ''}`.trim() : null].filter(Boolean).join(', ');
      const today = new Date(quote.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const signedDateFmt = signedDate ? new Date(signedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
      return `
    <div class="page" style="padding:44px 52px;font-family:inherit;color:#111827;background:#fff;">
      ${renderHeader()}

      <div style="background:#1e3a5f;border-radius:12px;padding:20px 28px;margin-bottom:24px;margin-top:16px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.6);text-transform:uppercase;margin-bottom:4px;">Legal Document</div>
        <div style="font-size:22px;font-weight:900;color:#fff;margin-bottom:2px;">Insurance Contingency Agreement</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.7);">Ref #${escapeHtml(String(quote.quote_number))} &nbsp;·&nbsp; ${today}${signedDateFmt ? ` &nbsp;·&nbsp; Signed ${signedDateFmt}` : ''}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#ff6b35;margin-bottom:6px;">Contractor</div>
          <div style="font-weight:700;font-size:13px;color:#111827;">${escapeHtml(company.name)}</div>
          ${company.address ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${escapeHtml(company.address)}</div>` : ''}
          ${company.phone ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${escapeHtml(company.phone)}</div>` : ''}
          ${company.email ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${escapeHtml(company.email)}</div>` : ''}
          ${(company as any).license_number ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">Lic #${escapeHtml((company as any).license_number)}</div>` : ''}
        </div>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#ff6b35;margin-bottom:6px;">Property Owner</div>
          <div style="font-weight:700;font-size:13px;color:#111827;">${escapeHtml(custName)}</div>
          ${addr ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${escapeHtml(addr)}</div>` : ''}
          ${customer.phone ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${escapeHtml(customer.phone)}</div>` : ''}
          ${customer.email ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${escapeHtml(customer.email)}</div>` : ''}
        </div>
      </div>

      <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1e3a5f;text-align:center;margin-bottom:14px;text-decoration:underline;">TERMS AND CONDITIONS</div>

      <div style="font-size:11px;color:#374151;line-height:1.7;">
        <p style="font-weight:700;color:#1e3a5f;margin:0 0 3px;">1. CONTINGENCY BASIS</p>
        <p style="margin:0 0 12px;">This Agreement is entered into on a contingency basis. No restoration or repair work will be performed and no payment will be due from Property Owner unless and until Property Owner's insurance carrier approves a claim for the repair or replacement of damage to the property described herein.</p>

        <p style="font-weight:700;color:#1e3a5f;margin:0 0 3px;">2. SCOPE OF WORK</p>
        <p style="margin:0 0 12px;">Property Owner authorizes Contractor to inspect the property and, where applicable, to assist Property Owner in documenting damage and supporting an insurance claim. If the insurance carrier approves a claim, Contractor agrees to perform the approved scope of work in accordance with the carrier's scope of loss.</p>

        <p style="font-weight:700;color:#1e3a5f;margin:0 0 3px;">3. AUTHORIZATION TO PERFORM APPROVED WORK</p>
        <p style="margin:0 0 12px;">In the event that Property Owner's insurance carrier approves coverage, Property Owner hereby authorizes and agrees to retain Contractor as the exclusive contractor to perform all carrier-approved work at the property. Property Owner agrees to cooperate fully in facilitating Contractor's access to complete the approved work.</p>

        <p style="font-weight:700;color:#1e3a5f;margin:0 0 3px;">4. COMPENSATION AND DEDUCTIBLE</p>
        <p style="margin:0 0 12px;">Contractor's compensation shall be limited to the insurance carrier's approved amount. Property Owner agrees to: (a) cooperate fully with the claims process and provide Contractor reasonable access to the property; (b) endorse and deliver insurance proceeds checks payable jointly to Property Owner and Contractor as necessary; and (c) pay Contractor the applicable insurance deductible upon commencement of the approved work. Property Owner shall not be responsible for any amount above the carrier-approved scope unless separately authorized in writing.</p>

        <p style="font-weight:700;color:#1e3a5f;margin:0 0 3px;">5. CONTRACTOR'S OBLIGATIONS</p>
        <p style="margin:0 0 12px;">Contractor agrees to: (a) conduct a thorough inspection of the property; (b) prepare documentation to support the insurance claim; (c) meet with the insurance adjuster at Property Owner's request; (d) perform all carrier-approved work in a professional and workmanlike manner consistent with industry standards; and (e) obtain all required permits and comply with all applicable building codes and regulations.</p>

        <p style="font-weight:700;color:#1e3a5f;margin:0 0 3px;">6. CLAIM DENIAL</p>
        <p style="margin:0 0 12px;">If the insurance carrier denies the claim in its entirety, Property Owner shall owe nothing to Contractor for inspection and claim-support services. If the carrier approves coverage but Property Owner elects not to use Contractor, Property Owner may be liable for Contractor's reasonable and documented costs incurred in preparing the claim and attending adjuster meetings.</p>

        <p style="font-weight:700;color:#1e3a5f;margin:0 0 3px;">7. GOVERNING LAW</p>
        <p style="margin:0 0 12px;">This Agreement shall be governed by and construed in accordance with the laws of the state in which the property is located. If any provision is found unenforceable, the remaining provisions shall remain in full force and effect.</p>

        <p style="font-weight:700;color:#1e3a5f;margin:0 0 3px;">8. ENTIRE AGREEMENT</p>
        <p style="margin:0 0 4px;">This Agreement constitutes the entire agreement between the parties regarding its subject matter and supersedes all prior representations, agreements, and understandings, whether written or oral. No modification shall be binding unless in writing and signed by both parties.</p>
      </div>

      <div style="margin-top:18px;padding-top:14px;border-top:1.5px solid #e5e7eb;">
        <p style="font-size:10px;color:#6b7280;margin:0 0 16px;">By signing below, both parties acknowledge that they have read, understood, and agree to the terms of this Insurance Contingency Agreement. This document does not commit either party to any work or payment until an insurance claim is approved.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;">
          <div>
            <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#374151;margin:0 0 4px;">Property Owner — ${escapeHtml(custName)}</p>
            <div style="height:40px;border-bottom:1.5px solid #374151;margin-bottom:3px;display:flex;align-items:flex-end;padding-bottom:2px;">
              ${signatureImage ? `<img src="${escapeHtml(signatureImage)}" style="max-height:36px;max-width:100%;object-fit:contain;" alt="Signature" crossorigin="anonymous">` : ''}
            </div>
            <div style="display:flex;justify-content:space-between;font-size:9px;color:#9ca3af;">
              <span>${signedName ? escapeHtml(signedName) : 'Signature'}</span>
              <span>${signedDateFmt || 'Date'}</span>
            </div>
          </div>
          <div>
            <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#374151;margin:0 0 4px;">Contractor — ${escapeHtml(company.name)}</p>
            <div style="height:40px;border-bottom:1.5px solid #374151;margin-bottom:3px;display:flex;align-items:flex-end;padding-bottom:2px;">
              ${contractorSigImage ? `<img src="${escapeHtml(contractorSigImage)}" style="max-height:36px;max-width:100%;object-fit:contain;" alt="Contractor Signature" crossorigin="anonymous">` : ''}
            </div>
            <div style="display:flex;justify-content:space-between;font-size:9px;color:#9ca3af;">
              <span>${contractorSigName ? escapeHtml(contractorSigName) : 'Authorized Signature / Title'}</span>
              <span>${contractorSigDate ? new Date(contractorSigDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Date'}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="footer" style="margin-top:20px;">
        <p>${escapeHtml(company.name)} | ${escapeHtml(company.phone || '')} | ${escapeHtml(company.email || '')}</p>
        ${(company as any).license_number ? `<p>License #${escapeHtml((company as any).license_number)}</p>` : ''}
        ${attributionHtml}
      </div>
    </div>`;
    }

    // ── Standard Quote Acceptance page ───────────────────────────────────────
    // Helper: is a tier key included in the (possibly multi-tier) selection string?
    const tierInSel = (t: string) => !!quote.selected_tier && (quote.selected_tier === 'all' || quote.selected_tier.split(',').includes(t));
    const selectedKeys = quote.selected_tier === 'all' ? ['good','better','best'] : (quote.selected_tier || '').split(',').filter(Boolean);

    // Build a human-readable label for the selection
    const tierLabels: Record<string, string> = { good: goodTierName, better: betterTierName, best: bestTierName };
    const selectedTierName = selectedKeys.length === 0 ? betterTierName
      : selectedKeys.length >= 3 || quote.selected_tier === 'all' ? 'All Tiers'
      : selectedKeys.map(k => tierLabels[k] || k).join(' + ');

    // Sum totals for all selected tiers
    const hasSelectedTier = selectedKeys.length > 0;
    const tierTotalsMap: Record<string, number> = {
      good: resolvedTotals.good,
      better: resolvedTotals.better,
      best: resolvedTotals.best,
    };
    const selectedBaseTotal = selectedKeys.reduce((sum, k) => {
      if (k === 'good') return sum + resolvedTotals.good;
      if (k === 'better' && quote.include_better !== false) return sum + resolvedTotals.better;
      if (k === 'best' && quote.include_best !== false) return sum + resolvedTotals.best;
      return sum;
    }, 0) || resolvedTotals.better; // fallback to better if nothing matched

    // Customer-selected upgrades saved on signing
    const customerUpgrades: any[] = Array.isArray((quote as any).customer_selected_upgrades) ? (quote as any).customer_selected_upgrades : [];
    const firstTierKey = selectedKeys[0] || 'good';
    const upgradesTotal = customerUpgrades.reduce((s, u) => {
      const price = (u.quantity || 1) * ((u.price ?? u[firstTierKey + '_price'] ?? u.good_price) || 0);
      return s + price;
    }, 0);
    const selectedTotal = selectedBaseTotal + upgradesTotal;

    return `
    <div class="page">
      ${renderWatermark()}
      ${renderHeader()}

      <div class="accept-hero">
        <div class="accept-hero-left">
          <div class="section-kicker" style="opacity:0.8;">Quote Acceptance Agreement</div>
          <div class="accept-hero-title">Customer Acceptance</div>
          <div class="accept-hero-subtitle">Quote #${escapeHtml(String(quote.quote_number))} &mdash; ${escapeHtml(quote.project_description || quote.cover_page_title || 'Project Proposal')}</div>
        </div>
        ${hasSelectedTier ? `
          <div class="accept-total-box">
            <div class="accept-total-label">${escapeHtml(selectedTierName)} Total</div>
            <div class="accept-total-amount">$${formatMoney(selectedTotal)}</div>
            <div class="accept-total-sub">Accepted amount</div>
          </div>
        ` : ''}
      </div>

      <div class="accept-parties">
        <div class="accept-party">
          <div class="accept-party-label">Contractor</div>
          <div class="accept-party-name">${escapeHtml(company.name)}</div>
          ${company.license_number ? `<div class="accept-party-detail">License #${escapeHtml(company.license_number)}</div>` : ''}
          ${company.address ? `<div class="accept-party-detail">${escapeHtml(company.address)}</div>` : ''}
          ${company.phone ? `<div class="accept-party-detail">${escapeHtml(company.phone)}</div>` : ''}
          ${company.email ? `<div class="accept-party-detail">${escapeHtml(company.email)}</div>` : ''}
        </div>
        <div class="accept-party">
          <div class="accept-party-label">Customer</div>
          <div class="accept-party-name">${escapeHtml(signedName || `${customer.first_name} ${customer.last_name}`)}</div>
          ${customer.address ? `<div class="accept-party-detail">${escapeHtml(customer.address)}, ${escapeHtml(customer.city || '')} ${escapeHtml(customer.state || '')} ${escapeHtml(customer.zip || '')}</div>` : ''}
          ${customer.phone ? `<div class="accept-party-detail">${escapeHtml(customer.phone)}</div>` : ''}
          ${customer.email ? `<div class="accept-party-detail">${escapeHtml(customer.email)}</div>` : ''}
        </div>
        <div class="accept-party">
          <div class="accept-party-label">Quote Details</div>
          <div class="accept-party-detail"><strong>Quote #:</strong> ${escapeHtml(String(quote.quote_number))}</div>
          <div class="accept-party-detail"><strong>Date Issued:</strong> ${formatDate(quote.created_at || new Date())}</div>
          <div class="accept-party-detail"><strong>Valid Until:</strong> ${formatDate(quote.valid_until || new Date())}</div>
          ${signedDate ? `<div class="accept-party-detail"><strong>Signed:</strong> ${formatDate(signedDate)}</div>` : ''}
        </div>
      </div>

      <!-- Always-visible pricing banners — customer circles/initials the one they choose -->
      <div class="accept-pricing-row">
        ${isMultiScope && quoteOptions ? `
          ${quoteOptions.map((opt: any, idx: number) => {
            const optItems = lineItems.filter((i: any) => i.quote_option_id === opt.id);
            const optTotal = optItems.reduce((s: number, i: any) => s + i.quantity * (i.price ?? i.good_price ?? 0), 0) || opt.subtotal || 0;
            const bannerColors = ['accept-price-banner-good', 'accept-price-banner-better', 'accept-price-banner-best'];
            const isSelected = false; // multi-scope doesn't use selected_tier
            return `
              <div class="accept-price-banner ${bannerColors[idx % bannerColors.length]}">
                <div class="accept-price-banner-label">${escapeHtml(opt.name || `Option ${idx + 1}`)}</div>
                <div class="accept-price-banner-amount">$${formatMoney(optTotal)}</div>
                <div class="accept-price-banner-select"><span class="accept-price-banner-circle"></span>&nbsp;Select this option</div>
              </div>
            `;
          }).join('')}
        ` : `
          <div class="accept-price-banner accept-price-banner-good${tierInSel('good') ? ' accept-price-banner-active' : ''}">
            <div class="accept-price-banner-label">${escapeHtml(goodTierName)}</div>
            <div class="accept-price-banner-amount">$${formatMoney(resolvedTotals.good)}</div>
            <div class="accept-price-banner-select">
              <span class="accept-price-banner-circle${tierInSel('good') ? ' accept-price-banner-circle-checked' : ''}"></span>&nbsp;Select this option
            </div>
          </div>
          ${quote.include_better !== false ? `
            <div class="accept-price-banner accept-price-banner-better${tierInSel('better') ? ' accept-price-banner-active' : ''}">
              <div class="accept-price-banner-label">${escapeHtml(betterTierName)}</div>
              <div class="accept-price-banner-amount">$${formatMoney(resolvedTotals.better)}</div>
              <div class="accept-price-banner-select">
                <span class="accept-price-banner-circle${tierInSel('better') ? ' accept-price-banner-circle-checked' : ''}"></span>&nbsp;Select this option
              </div>
            </div>
          ` : ''}
          ${quote.include_best !== false ? `
            <div class="accept-price-banner accept-price-banner-best${tierInSel('best') ? ' accept-price-banner-active' : ''}">
              <div class="accept-price-banner-label">${escapeHtml(bestTierName)}</div>
              <div class="accept-price-banner-amount">$${formatMoney(resolvedTotals.best)}</div>
              <div class="accept-price-banner-select">
                <span class="accept-price-banner-circle${tierInSel('best') ? ' accept-price-banner-circle-checked' : ''}"></span>&nbsp;Select this option
              </div>
            </div>
          ` : ''}
        `}
      </div>

      ${(() => {
        type ScopeRow = { label: string; amount: number; accepted: boolean };
        const scopeRows: ScopeRow[] = [];
        if (isMultiScope && quoteOptions) {
          const sortedOpts = [...quoteOptions].sort((a, b) => a.sort_order - b.sort_order);
          sortedOpts.forEach((opt, idx) => {
            const key = idx === 0 ? 'good' : idx === 1 ? 'better' : 'best';
            const optItems = lineItems.filter((i: any) => i.quote_option_id === opt.id);
            const amount = optItems.reduce((s: number, i: any) => s + i.quantity * (i.price ?? i.good_price ?? 0), 0) || opt.subtotal || 0;
            scopeRows.push({ label: opt.name || `Option ${idx + 1}`, amount, accepted: selectedKeys.length === 0 || selectedKeys.includes(key) });
          });
        } else {
          // Tiers are alternatives — the customer accepts one. Scopes are
          // additive; tiers never are. This marked every tier accepted when
          // nothing had been chosen yet and then summed them, so a quote
          // offering one price at $5,117.45 presented a "Total Accepted" of
          // $15,352.35 to the customer.
          scopeRows.push({ label: goodTierName, amount: resolvedTotals.good, accepted: selectedKeys.includes('good') });
          if (quote.include_better !== false) scopeRows.push({ label: betterTierName, amount: resolvedTotals.better, accepted: selectedKeys.includes('better') });
          if (quote.include_best !== false) scopeRows.push({ label: bestTierName, amount: resolvedTotals.best, accepted: selectedKeys.includes('best') });
        }
        // Scopes add up; a tier stands alone.
        const acceptedRows = scopeRows.filter(r => r.accepted);
        const grandTotal = isMultiScope
          ? acceptedRows.reduce((s, r) => s + r.amount, 0)
          : (acceptedRows[0]?.amount ?? 0);
        const nothingChosen = acceptedRows.length === 0;
        return `
        <div class="accept-scope-panel">
          <div class="accept-scope-title">Accepted Scope of Work</div>
          <div style="margin-top: 10px;">
            ${scopeRows.map(row => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;margin-bottom:6px;border-radius:8px;${row.accepted ? 'background:#f0fdf4;border:1px solid #86efac;' : 'background:#f9fafb;border:1px solid #e5e7eb;opacity:0.55;'}">
                <div style="display:flex;align-items:center;gap:10px;">
                  ${row.accepted
                    ? `<div style="width:20px;height:20px;border-radius:50%;background:#16a34a;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="color:white;font-size:12px;font-weight:900;">&#10003;</span></div>`
                    : `<div style="width:20px;height:20px;border-radius:50%;border:2px solid #d1d5db;flex-shrink:0;"></div>`
                  }
                  <span style="font-size:13px;font-weight:${row.accepted ? '700' : '500'};color:${row.accepted ? '#15803d' : '#6b7280'};">${escapeHtml(row.label)}</span>
                </div>
                <span style="font-size:14px;font-weight:700;color:${row.accepted ? '#15803d' : '#9ca3af'};">$${formatMoney(row.amount)}</span>
              </div>
            `).join('')}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding:10px 12px;background:#1e3a5f;border-radius:8px;">
              <span style="font-size:12px;font-weight:700;color:white;text-transform:uppercase;letter-spacing:0.5px;">${nothingChosen ? 'Total' : 'Total Accepted'}</span>
              <span style="font-size:16px;font-weight:900;color:white;">${nothingChosen ? 'Select an option above' : `$${formatMoney(grandTotal)}`}</span>
            </div>
          </div>
        </div>
      `;
      })()}

      <!-- Order Summary -->
      ${hasSelectedTier ? `
      <div class="accept-order-summary">
        <div class="accept-order-summary-title">Order Summary</div>
        ${selectedKeys.length > 1 ? selectedKeys.map(k => `
          <div class="accept-order-row">
            <span>${escapeHtml(tierLabels[k] || k)}</span>
            <span>$${formatMoney(tierTotalsMap[k] ?? 0)}</span>
          </div>
        `).join('') : `
          <div class="accept-order-row">
            <span>${escapeHtml(selectedTierName)}</span>
            <span>$${formatMoney(selectedBaseTotal)}</span>
          </div>
        `}
        ${customerUpgrades.length > 0 ? customerUpgrades.map((u: any) => {
          const price = (u.quantity || 1) * ((u.price ?? u[firstTierKey + '_price'] ?? u.good_price) || 0);
          return `<div class="accept-order-row accept-order-upgrade">
            <span>+ ${escapeHtml(u.name || 'Upgrade')}</span>
            <span>$${formatMoney(price)}</span>
          </div>`;
        }).join('') : ''}
        <div class="accept-order-total">
          <span>Total Amount Due</span>
          <span>$${formatMoney(selectedTotal)}</span>
        </div>
      </div>
      ` : ''}

      <div class="accept-legal-box">
        <div class="accept-legal-title">Agreement Terms</div>
        <p class="accept-legal-body">
          ${escapeHtml(legalNotice.contractAgreementText)}
        </p>
        <p class="accept-legal-body" style="margin-top: 10px;">
          By signing below, the Customer acknowledges that they have read, understand, and agree to the full scope of work and pricing described in Quote #${escapeHtml(String(quote.quote_number))} issued by ${escapeHtml(company.name)}. The Customer agrees that the scope, materials, and pricing set forth in this quote constitute a binding agreement upon execution. Any changes to the scope of work must be agreed upon in writing by both parties. This quote is valid until ${formatDate(quote.valid_until || new Date())}.
        </p>
        <p class="accept-legal-body" style="margin-top: 10px;">
          ${(() => {
            const custom = (company as any).payment_terms_text?.trim();
            if (custom) return escapeHtml(custom);
            const depositPct = (company as any).default_deposit_percent ?? 50;
            const balancePct = 100 - depositPct;
            return `Payment Schedule: A deposit of ${depositPct}% of the agreed project total is due prior to commencement of work. The remaining ${balancePct}% balance is due upon satisfactory completion of all work described in this proposal. Any additional scope beyond what is outlined herein must be agreed upon in writing prior to performance.`;
          })()}
        </p>
        <p class="accept-legal-body" style="margin-top: 10px;">
          ${escapeHtml(legalNotice.signatureFooterText)}
        </p>
      </div>

      <div class="accept-sig-block">
        <div class="accept-sig-col">
          <div class="accept-sig-label">Customer Signature</div>
          <div class="accept-sig-area">
            ${signatureImage
              ? `<img src="${escapeHtml(signatureImage)}" class="signature-image" alt="Customer Signature">`
              : '<div class="accept-sig-blank"></div>'
            }
          </div>
          <div class="accept-sig-line"></div>
          <div class="accept-sig-meta">
            <span>${escapeHtml(signedName || `${customer.first_name} ${customer.last_name}`)}</span>
            <span>${signedDate ? formatDate(signedDate) : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</span>
          </div>
          <div class="accept-sig-meta-label">
            <span>Print Name</span>
            <span>Date</span>
          </div>
        </div>
        <div class="accept-sig-col">
          <div class="accept-sig-label">Contractor Representative</div>
          <div class="accept-sig-area">
            ${contractorSigImage
              ? `<img src="${escapeHtml(contractorSigImage)}" class="signature-image" alt="Contractor Signature">`
              : '<div class="accept-sig-blank"></div>'
            }
          </div>
          <div class="accept-sig-line"></div>
          <div class="accept-sig-meta">
            <span>${contractorSigName ? escapeHtml(contractorSigName) : '&nbsp;'}</span>
            <span>${contractorSigDate ? formatDate(contractorSigDate) : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</span>
          </div>
          <div class="accept-sig-meta-label">
            <span>Print Name &amp; Title</span>
            <span>Date</span>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>${escapeHtml(company.name)} | ${escapeHtml(company.phone || '')} | ${escapeHtml(company.email || '')}</p>
        ${company.license_number ? `<p>License #${escapeHtml(company.license_number)}</p>` : ''}
        ${attributionHtml}
      </div>
    </div>
  `};

  const renderCancelNoticePage = () => `
    <div class="page">
      ${renderWatermark()}
      ${renderHeader()}

      <div class="cancel-hero">
        <div class="cancel-hero-icon">!</div>
        <div>
          <div class="cancel-hero-kicker">Legal Notice — Required by Federal &amp; State Law</div>
          <div class="cancel-hero-title">${escapeHtml(legalNotice.cancelTitle)}</div>
          <div class="cancel-hero-subtitle">Quote #${escapeHtml(String(quote.quote_number))} &mdash; ${escapeHtml(company.name)}</div>
        </div>
      </div>

      <div class="cancel-two-col">
        <div class="cancel-left">
          <div class="cancel-section-title">Your Right to Cancel</div>
          <p class="cancel-body-text">${escapeHtml(legalNotice.cancelBody)}</p>
          <p class="cancel-body-text" style="margin-top:10px;">This right applies to the transaction in Quote #${escapeHtml(String(quote.quote_number))} dated ${formatDate(quote.created_at || new Date())}. You must cancel in writing no later than midnight of <strong>${escapeHtml(formatLongDate(cancellationDeadline))}</strong>.</p>

          <div class="cancel-steps-title">How to Cancel</div>
          <div class="cancel-step"><span class="cancel-step-num">1</span><span>Prepare a written notice stating you are canceling this transaction. Include the date, your name, address, and your signature.</span></div>
          <div class="cancel-step"><span class="cancel-step-num">2</span><span>Deliver or mail your notice to ${escapeHtml(company.name)}${company.address ? ' at ' + escapeHtml(company.address) : ''}${company.email ? ', or email to ' + escapeHtml(company.email) : ''}.</span></div>
          <div class="cancel-step"><span class="cancel-step-num">3</span><span>Your notice must be delivered or postmarked before midnight of the cancellation deadline shown.</span></div>
          <div class="cancel-step"><span class="cancel-step-num">4</span><span>Any payments made by you will be returned within 10 business days of the contractor receiving your cancellation notice. Any security interest arising from this transaction will be cancelled.</span></div>
        </div>

        <div class="cancel-right">
          <div class="cancel-deadline-banner">
            <div class="cancel-deadline-label">Cancellation Deadline</div>
            <div class="cancel-deadline-date">${escapeHtml(formatLongDate(cancellationDeadline))}</div>
            <div class="cancel-deadline-sub">Must cancel in writing by midnight on this date</div>
          </div>

          <div class="cancel-effect-panel">
            <div class="cancel-effect-title">Effect of Cancellation</div>
            <p class="cancel-body-text">If you cancel this transaction, any property traded in, any payments made by you, and any negotiable instrument executed by you will be returned within 10 business days following receipt of your cancellation notice. Any security interest arising out of the transaction will be cancelled. If you cancel, you must make available to the seller, in substantially as good condition as when received, any goods delivered to you under this contract; or you may comply with the seller's instructions regarding return shipment at the seller's expense and risk. If you do not make the goods available to the seller, or if you agree to return the goods and do not do so, you remain liable for performance of all obligations under the contract.</p>
          </div>

          <div class="cancel-notice-box">
            <div class="cancel-effect-title">Notice to Buyer</div>
            <p class="cancel-body-text">Do not sign this contract before you read it. You are entitled to a copy of the contract at the time you sign. Keep it to protect your legal rights. A contractor may not start work or require payment until the three-day cancellation period has expired, unless you expressly request that work begin immediately for emergency purposes. You should not waive your right to cancel unless a genuine emergency exists.</p>
          </div>
        </div>
      </div>

      ${company.cost_recovery_clause_enabled !== false ? `<div class="cancel-info-box" style="background:#fef9c3;border:1.5px solid #fbbf24;border-radius:10px;padding:16px;margin-top:16px;">
        <div class="cancel-effect-title" style="color:#78350f;margin-bottom:6px;">When This Cost-Recovery Clause Applies</div>
        <p class="cancel-body-text" style="color:#92400e;margin-bottom:10px;">This clause is <strong>not a general cancellation fee</strong>. It is only triggered under a specific combination of circumstances:</p>

        <div style="display:flex;flex-wrap:wrap;gap:10px;margin:0 0 14px;">
          <div style="flex:1 1 180px;background:#fffbeb;border:1px solid #fcd34d;border-radius:7px;padding:10px;">
            <p style="font-weight:700;font-size:10.5px;color:#78350f;margin:0 0 6px;">Trigger Condition</p>
            <p style="font-size:10.5px;color:#92400e;line-height:1.7;margin:0;">All three must be true:</p>
            <ul style="font-size:10.5px;color:#92400e;line-height:1.7;margin:4px 0 0;padding-left:14px;">
              <li>Insurance carrier has <strong>approved the claim</strong></li>
              <li>Property owner has <strong>not yet proceeded</strong> with repairs</li>
              <li>Contractor has <strong>already incurred costs</strong> tied to the claim that cannot be recovered without completing the project</li>
            </ul>
          </div>
          <div style="flex:1 1 180px;background:#fffbeb;border:1px solid #fcd34d;border-radius:7px;padding:10px;">
            <p style="font-weight:700;font-size:10.5px;color:#78350f;margin:0 0 6px;">What Costs Are Covered</p>
            <p style="font-size:10.5px;color:#92400e;line-height:1.6;margin:0 0 6px;">Because the project will not proceed, the contractor has no contract value from which to recover expenses already committed, which may include:</p>
            <ul style="font-size:10.5px;color:#92400e;line-height:1.7;margin:0;padding-left:14px;">
              <li>Adjuster meetings &amp; scope negotiations</li>
              <li>Permit fees &amp; engineering reports</li>
              <li>Materials ordered with non-refundable restocking fees</li>
              <li>Emergency services already performed</li>
            </ul>
          </div>
          <div style="flex:1 1 180px;background:#fffbeb;border:1px solid #fcd34d;border-radius:7px;padding:10px;">
            <p style="font-weight:700;font-size:10.5px;color:#78350f;margin:0 0 6px;">How the Fee Is Structured</p>
            <p style="font-size:10.5px;color:#92400e;line-height:1.6;margin:0 0 6px;">Administrative fees align with standard insurance industry <strong>Overhead &amp; Profit (O&amp;P)</strong> — typically 10% overhead + 10% profit — a range already recognized by adjusters and defensible before a mediator or arbitrator.</p>
            <ul style="font-size:10.5px;color:#92400e;line-height:1.7;margin:0;padding-left:14px;">
              <li>$10,000 scope × 15% = <strong>$1,500</strong></li>
              <li>$40,000 scope × 15% = <strong>$6,000</strong></li>
            </ul>
          </div>
        </div>

        <div style="background:#fffde7;border-left:4px solid #f59e0b;padding:10px 12px;border-radius:0 8px 8px 0;margin-bottom:10px;">
          <p style="font-weight:700;font-size:10.5px;color:#78350f;margin:0 0 4px;">Recommended Contract Language</p>
          <p style="font-size:10.5px;color:#7c6600;line-height:1.7;margin:0;font-style:italic;">"If Property Owner cancels this Agreement after the insurance carrier has approved the claim and before repairs have commenced, and Contractor has incurred costs related to the claim that cannot be recouped through project completion, Property Owner shall be liable to Contractor for: (a) all actual documented expenses incurred, including permit fees, engineering reports, restocking fees, and completed emergency services; and (b) an administrative and liquidated damages fee equal to [10%–20%] of the total approved insurance claim amount to compensate Contractor for administrative overhead, scope preparation, and lost business opportunity."</p>
        </div>

        <div style="background:#fff8e1;border-left:3px solid #f59e0b;padding:8px 12px;border-radius:0 6px 6px 0;">
          <p style="font-weight:700;font-size:10px;color:#78350f;margin:0 0 3px;">Key Legal Note</p>
          <p style="font-size:10.5px;color:#92400e;line-height:1.6;margin:0;">State contractor regulations may cap cancellation penalties or require specific language for a fee to qualify as legitimate liquidated damages rather than an unenforceable penalty. Aligning fees with standard O&amp;P percentages (10%–20%) and tying them to documented, unrecouped costs provides the strongest legal justification.</p>
        </div>
      </div>` : ''}

      <div class="accept-legal-box" style="background:#fef3c7; border-color:#f59e0b; margin-top:16px;">
        <div class="accept-legal-title" style="color:#92400e;">Acknowledgment of Receipt</div>
        <p class="accept-legal-body" style="color:#78350f;">
          By signing below, I, ${escapeHtml(signedName || `${customer.first_name} ${customer.last_name}`)}, acknowledge that I have received, read, and understand this Notice of Right to Cancel. I understand that I have the right to cancel the transaction described in Quote #${escapeHtml(String(quote.quote_number))} without penalty or obligation if I deliver written notice of cancellation to ${escapeHtml(company.name)} no later than midnight of ${escapeHtml(formatLongDate(cancellationDeadline))}. I further acknowledge that no work may be performed and no payment is required before the cancellation period expires unless I have separately waived this right in writing.
        </p>
      </div>

      <div class="accept-sig-block">
        <div class="accept-sig-col">
          <div class="accept-sig-label">Customer Signature — Acknowledging Receipt</div>
          <div class="accept-sig-area">
            ${cancelSignatureImage
              ? `<img src="${escapeHtml(cancelSignatureImage)}" class="signature-image" alt="Customer Signature">`
              : '<div class="accept-sig-blank"></div>'
            }
          </div>
          <div class="accept-sig-line"></div>
          <div class="accept-sig-meta">
            <span>${escapeHtml(signedName || `${customer.first_name} ${customer.last_name}`)}</span>
            <span>${cancelSignedDate ? formatDate(cancelSignedDate) : signedDate ? formatDate(signedDate) : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</span>
          </div>
          <div class="accept-sig-meta-label">
            <span>Print Name</span>
            <span>Date</span>
          </div>
        </div>
        <div class="accept-sig-col">
          <div class="accept-sig-label">Contractor Representative</div>
          <div class="accept-sig-area"><div class="accept-sig-blank"></div></div>
          <div class="accept-sig-line"></div>
          <div class="accept-sig-meta">
            <span>&nbsp;</span>
            <span>&nbsp;</span>
          </div>
          <div class="accept-sig-meta-label">
            <span>Print Name &amp; Title</span>
            <span>Date</span>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>${escapeHtml(company.name)} | ${escapeHtml(company.phone || '')} | ${escapeHtml(company.email || '')}</p>
        ${company.license_number ? `<p>License #${escapeHtml(company.license_number)}</p>` : ''}
        ${attributionHtml}
      </div>
    </div>
  `;

  const renderPaymentRequestPage = (): string => {
    const rcv = (quote as any).manual_good_total ?? 0;
    const dep = (quote as any).depreciation_amount ?? 0;
    const ded = (quote as any).deductible_amount ?? 0;
    const dedIncluded = (quote as any).deductible_included ?? false;
    const supp = (quote as any).supplement_total ?? 0;
    const downPmt = (quote as any).deposit_amount ?? 0;
    const acv = rcv - dep;
    const netClaim = dedIncluded ? acv : acv - ded;
    const jobTotal = rcv + supp;
    const balanceDue = jobTotal - downPmt;
    const fmtCur = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
    const dueDate = (quote as any).deposit_due_date
      ? new Date((quote as any).deposit_due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : null;
    const issueDate = new Date(quote.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const custName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    const addr = [customer?.address, customer?.city, customer?.state].filter(Boolean).join(', ');
    const insCompany = (quote as any).insurance_company_name || '';
    const claimNum = (quote as any).claim_number || '';

    const row = (label: string, value: string, sub?: string, bold?: boolean, color?: string) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 20px;border-bottom:1px solid #f3f4f6;">
        <div>
          <div style="font-size:13px;font-weight:${bold ? '700' : '500'};color:${color || '#374151'};">${label}</div>
          ${sub ? `<div style="font-size:11px;color:#9ca3af;margin-top:1px;">${sub}</div>` : ''}
        </div>
        <div style="font-size:${bold ? '16px' : '14px'};font-weight:${bold ? '800' : '600'};color:${color || '#111827'};">${value}</div>
      </div>`;

    const sigBadge = (name: string, date: string) => name ? `
      <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:8px;padding:8px 12px;display:flex;align-items:center;gap:8px;">
        <span style="color:#16a34a;font-size:14px;">✓</span>
        <div>
          <p style="margin:0;font-weight:600;color:#15803d;font-size:11px;">${escapeHtml(name)}</p>
          ${date ? `<p style="margin:0;color:#166534;font-size:10px;">${new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>` : ''}
        </div>
      </div>` : `<div style="border-bottom:1.5px solid #374151;height:36px;margin-bottom:4px;"></div>`;

    const includeContract = (quote as any).include_payment_contract;
    const clauses = [
      ['1. Scope of Work', `The Contractor agrees to perform all work as specified in the insurance carrier's${insCompany ? ` (${escapeHtml(insCompany)})` : ''} approved scope of loss and related documentation.`],
      ['2. Complete Performance', 'The Contractor agrees to perform all work in its entirety unless a specific item is mutually agreed upon in writing by both parties. No verbal modifications shall be binding.'],
      ['3. Right to Supplement', 'The Contractor retains the right to identify and submit supplemental claims for any work items omitted from the initial scope. All approved supplements shall be incorporated into the final contract price at no additional out-of-pocket cost to the Homeowner beyond the deductible.'],
      ['4. Payment Terms', 'The Homeowner agrees to remit all insurance proceeds received—including ACV, recoverable depreciation, and approved supplements—to the Contractor per the payment schedule above. The deductible is the sole responsibility of the Homeowner.'],
      ['5. Change Orders', 'Any work beyond the insurance-approved scope shall require a written change order signed by both parties prior to commencement.'],
      ['6. Homeowner Cooperation', 'The Homeowner agrees to cooperate fully with the Contractor and carrier, provide timely property access, and promptly forward all insurance correspondence and payment checks related to this claim.'],
      ['7. Workmanship Warranty', "The Contractor warrants all labor and installation for one (1) year from substantial completion. Material warranties are per the manufacturer's terms."],
      ['8. Licensing & Insurance', 'The Contractor warrants it holds all required licenses, permits, and insurance coverage and will maintain such coverage throughout this project.'],
    ].map(([title, body]) => `
      <div style="margin-bottom:12px;">
        <p style="font-weight:700;color:#111827;font-size:11.5px;margin:0 0 3px;">${title}</p>
        <p style="margin:0;color:#4b5563;font-size:11px;line-height:1.6;">${body}</p>
      </div>`).join('');

    return `
    <div class="page" style="padding:52px 60px;font-family:inherit;color:#111827;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:18px;border-bottom:2px solid #e5e7eb;">
        <div>
          <div style="font-size:10px;font-weight:700;letter-spacing:2.5px;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">Insurance Payment Request</div>
          <div style="font-size:24px;font-weight:800;color:${primaryColor};margin-bottom:4px;">${escapeHtml(quote.project_description || quote.cover_page_title || 'Payment Summary')}</div>
          <div style="font-size:12px;color:#6b7280;">#${escapeHtml(quote.quote_number || '')} &nbsp;·&nbsp; Issued ${issueDate}${dueDate ? ` &nbsp;·&nbsp; <span style="color:#dc2626;font-weight:600;">Due ${dueDate}</span>` : ''}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:700;font-size:14px;color:#111827;">${escapeHtml(company.name)}</div>
          ${company.phone ? `<div style="font-size:12px;color:#6b7280;">${escapeHtml(company.phone)}</div>` : ''}
          ${company.email ? `<div style="font-size:12px;color:#6b7280;">${escapeHtml(company.email)}</div>` : ''}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px;">
        <div style="background:#f9fafb;border-radius:10px;padding:16px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:1.5px;color:#9ca3af;text-transform:uppercase;margin-bottom:8px;">Bill To</div>
          <div style="font-weight:700;font-size:14px;color:#111827;">${escapeHtml(custName)}</div>
          ${addr ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">${escapeHtml(addr)}</div>` : ''}
          ${customer?.email ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">${escapeHtml(customer.email)}</div>` : ''}
          ${customer?.phone ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">${escapeHtml(customer.phone)}</div>` : ''}
        </div>
        <div style="background:#f9fafb;border-radius:10px;padding:16px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:1.5px;color:#9ca3af;text-transform:uppercase;margin-bottom:8px;">Insurance Carrier</div>
          ${insCompany ? `<div style="font-weight:700;font-size:14px;color:#111827;">${escapeHtml(insCompany)}</div>` : ''}
          ${claimNum ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">Claim #${escapeHtml(claimNum)}</div>` : ''}
          ${!insCompany && !claimNum ? '<div style="color:#9ca3af;font-size:12px;">—</div>' : ''}
        </div>
      </div>
      <div style="border:1.5px solid #e5e7eb;border-radius:14px;overflow:hidden;margin-bottom:20px;">
        <div style="background:${primaryColor};padding:12px 20px;">
          <div style="color:#fff;font-weight:700;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Insurance Settlement Breakdown</div>
        </div>
        ${row('Replacement Cost Value (RCV)', fmtCur(rcv), 'Full replacement cost approved by the carrier')}
        ${dep > 0 ? row('− Depreciation (Holdback)', `− ${fmtCur(dep)}`, 'Withheld by carrier — released upon satisfactory completion', false, '#d97706') : ''}
        ${dep > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 20px;border-bottom:1px solid #f3f4f6;background:#eff6ff;"><div style="font-size:13px;font-weight:700;color:#1e40af;">= Actual Cash Value (ACV)</div><div style="font-size:15px;font-weight:800;color:#1e40af;">${fmtCur(acv)}</div></div>` : ''}
        ${ded > 0 && !dedIncluded ? row('− Deductible', `− ${fmtCur(ded)}`, "Homeowner's out-of-pocket portion — owed separately", false, '#dc2626') : ''}
        ${ded > 0 && dedIncluded ? row('Deductible (Included in Total)', fmtCur(ded), 'Already included — no additional out-of-pocket for homeowner', false, '#059669') : ''}
        ${ded > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 20px;background:#f0fdf4;"><div style="font-size:13px;font-weight:700;color:#166534;">= Net Claim (First Insurance Check)</div><div style="font-size:15px;font-weight:800;color:#166534;">${fmtCur(netClaim)}</div></div>` : ''}
      </div>
      <div style="border:1.5px solid #e5e7eb;border-radius:14px;overflow:hidden;margin-bottom:20px;">
        <div style="background:#374151;padding:12px 20px;">
          <div style="color:#fff;font-weight:700;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Payment Request</div>
        </div>
        ${row(`Job Total (RCV${supp > 0 ? ' + Supplements' : ''})`, fmtCur(jobTotal), supp > 0 ? `Includes ${fmtCur(supp)} in approved supplements` : 'Based on full replacement cost value', true)}
        ${downPmt > 0 ? row('− Down Payment Due Now', `− ${fmtCur(downPmt)}`, dueDate ? `Due by ${dueDate}` : 'Due before work begins', false, '#7c3aed') : ''}
        ${downPmt > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 20px;background:${primaryColor};"><div><div style="font-size:13px;font-weight:700;color:#fff;">Balance Due at Completion</div>${dep > 0 ? `<div style="font-size:11px;color:#6ee7b7;margin-top:2px;">+ ${fmtCur(dep)} depreciation to be released by carrier</div>` : ''}</div><div style="font-size:22px;font-weight:900;color:#fff;">${fmtCur(balanceDue)}</div></div>` : `<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 20px;background:${primaryColor};"><div><div style="font-size:13px;font-weight:700;color:#fff;">Total Due</div>${dep > 0 ? `<div style="font-size:11px;color:#6ee7b7;margin-top:2px;">+ ${fmtCur(dep)} depreciation to be released by carrier</div>` : ''}</div><div style="font-size:22px;font-weight:900;color:#fff;">${fmtCur(jobTotal)}</div></div>`}
      </div>
      ${(quote as any).notes ? `<div style="border:1.5px solid #e5e7eb;border-radius:10px;padding:16px;margin-bottom:20px;"><div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#9ca3af;margin-bottom:6px;">Notes</div><div style="font-size:12px;color:#374151;line-height:1.7;white-space:pre-wrap;">${escapeHtml((quote as any).notes)}</div></div>` : ''}
      ${includeContract ? `
      <div style="border:1.5px solid ${primaryColor};border-radius:14px;overflow:hidden;margin-bottom:20px;">
        <div style="background:${primaryColor};padding:12px 20px;">
          <div style="color:#fff;font-weight:700;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Contractor–Homeowner Work Agreement</div>
        </div>
        <div style="padding:18px 20px;font-size:11.5px;color:#374151;line-height:1.7;">
          <p style="margin:0 0 14px;color:#4b5563;font-style:italic;">
            This Agreement is entered into between <strong style="color:#111827;">${escapeHtml(company.name)}</strong> ("Contractor") and
            <strong style="color:#111827;">${escapeHtml(custName || 'Homeowner')}</strong> ("Homeowner")
            in connection with insurance claim${claimNum ? ` #${escapeHtml(claimNum)}` : ''} for the property located at
            ${addr ? `<strong style="color:#111827;">${escapeHtml(addr)}</strong>` : 'the insured property'}.
          </p>
          ${clauses}
          <div style="margin-top:24px;padding-top:18px;border-top:1.5px solid #e5e7eb;">
            <p style="font-size:10px;color:#6b7280;margin:0 0 18px;">By signing below, both parties acknowledge that they have read, understood, and agree to the terms of this Work Agreement.</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;">
              <div>
                <p style="font-size:10px;font-weight:600;color:#374151;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Homeowner</p>
                ${sigBadge(signedName, signedDate)}
              </div>
              <div>
                <p style="font-size:10px;font-weight:600;color:#374151;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Contractor — ${escapeHtml(company.name)}</p>
                ${sigBadge(contractorSigName, contractorSigDate)}
              </div>
            </div>
          </div>
        </div>
      </div>` : ''}
      <div style="font-size:10px;color:#9ca3af;text-align:center;padding-top:14px;border-top:1px solid #f3f4f6;">
        ${escapeHtml(company.name)}${company.address ? ' · ' + escapeHtml(company.address) : ''}${(company as any).license_number ? ' · License #' + escapeHtml((company as any).license_number) : ''}
      </div>
    </div>`;
  };

  const pageRenderers: Record<PageKey, () => string> = {
    cover: renderCoverPage,
    about: renderAboutPage,
    scope: quote.quote_structure_type === 'payment_request'
      ? renderPaymentRequestPage
      : quote.quote_structure_type === 'insurance_invoice'
        ? renderInvoicePage
        // Insurance supplements go straight to line items — no contingency/cancel pages
        : quote.quote_structure_type === 'insurance_supplement'
          ? renderScopePage
          : (quote.contingency_enabled && isInspectionReportDoc)
            // Inspection report with contingency: legal agreement replaces the scope
            ? renderContingencyPage
            : quote.contingency_enabled
              // Tiered/regular quote with contingency: show line items first, then the agreement
              ? () => renderScopePage() + renderContingencyPage()
              : renderScopePage,
    photos: renderPhotosPage,
    warranty: renderWarrantyPage,
    signature: renderAcceptancePage,
    cancel: renderCancelNoticePage,
  };

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          /* The cover is full-bleed and must reach the sheet edges, so page
             margins were zero throughout. Every sheet after it then began
             flush against the top trim: a section heading or a run of body
             text started in the first millimetre of the page with nothing
             above it. The .page box has internal padding, but that applies once to
             the box, not again where it continues onto the next sheet.
             Margin only where it is wanted — the first sheet keeps its bleed. */
          @page { margin: 0.45in 0; size: letter portrait; }
          @page :first { margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          html, body { height: auto; overflow: visible; }
          img { max-width: 100%; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            color: ${primaryColor};
            line-height: 1.6;
          }
          .page {
            position: relative;
            overflow: visible;
            padding: 40px;
            background: #ffffff;
          }
          /* Cover page keeps the gradient and clip */
          .page-cover {
            background: linear-gradient(150deg, #eef3ff 0%, #ffffff 28%, #ffffff 72%, #fff4ef 100%);
            overflow: hidden;
          }
          .page-watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            /* width/height are overridden per-image via inline style using
               company.quote_watermark_size (0.20–1.40). This is the fallback. */
            width: 55%;
            height: 55%;
            object-fit: contain;
            pointer-events: none;
            z-index: 0;
          }

          /* ── Screen-only: one continuous scrolling document ── */
          @media screen {
            html, body {
              background: #d1d5db;
              padding: 32px 16px;
              overflow-x: hidden;
            }
            .page {
              max-width: 860px;
              margin: 0 auto;
              background: #ffffff;
              border-bottom: 1px solid #e5e7eb;
            }
            .page-cover {
              box-shadow: 0 0 24px rgba(0,0,0,0.15);
              border-bottom: none;
              border-radius: 6px 6px 0 0;
            }
            .page:last-of-type { border-radius: 0 0 6px 6px; border-bottom: none; margin-bottom: 32px; box-shadow: 0 4px 16px rgba(0,0,0,0.10); }
          }

          /* ── Print: cover gets its own sheet; every other section flows
             continuously so no sheet is left half-empty. Blocks below carry
             break-inside:avoid so nothing is cut at a page boundary. ── */
          @media print {
            /* overflow:hidden on a box that spans multiple sheets makes
               WebKit clip text at page boundaries — keep it visible in print.
               .proposal-panel (About section) is the other long, rounded-
               corner container that regularly spans 2+ pages with real
               company bios/photos — same fix applies. */
            .page, .proposal-panel { overflow: visible !important; }
            .page { padding: 28px 32px !important; }
            .page-cover {
              break-after: page;
              page-break-after: always;
            }
            /* Shorten the cover hero so the whole cover reliably fits one
               sheet (Letter or A4) without zoom/vh tricks, which Safari's
               print engine handles unreliably. */
            .page-cover .hero-panel-image, .page-cover .hero-content-image { min-height: 400px !important; }
            /* Two unbounded text fields feed the cover hero: cover_page_title
               (which "Duplicate Quote" can compound into "Copy of Copy of
               ..." over repeated use) and the customer's name (commercial
               customers often carry a full org name plus multiple "Attn:"
               contacts). At the hero panel's ~500px width, a long value can
               wrap 6-8 lines deep and push the whole cover past one printed
               page -- with break-after:page above then forcing the next
               section onto the page after that spillover, leaving it almost
               entirely blank (reproduced and verified fixed with a headless
               Chromium print-to-PDF harness). Cap both to a generous but
               fixed number of lines so the cover's print height stays
               bounded regardless of text length -- high enough that a
               normal title/company name is never visibly truncated, low
               enough that even a very long one can't blow out the page. The
               full, untruncated title/name still appear elsewhere in the
               document (e.g. Customer Acceptance). */
            .hero-title {
              display: -webkit-box !important;
              -webkit-line-clamp: 4 !important;
              -webkit-box-orient: vertical !important;
              overflow: hidden !important;
            }
            .hero-meta-value {
              font-size: 13px !important;
              line-height: 1.35 !important;
              display: -webkit-box !important;
              -webkit-line-clamp: 6 !important;
              -webkit-box-orient: vertical !important;
              overflow: hidden !important;
            }
            .hero-description {
              font-size: 14px !important;
              line-height: 1.5 !important;
              display: -webkit-box !important;
              -webkit-line-clamp: 5 !important;
              -webkit-box-orient: vertical !important;
              overflow: hidden !important;
            }
            p, li, td { orphans: 3; widows: 3; }
            .warranty-section p { orphans: 4; widows: 4; }
            /* Safari splits inside <tr> despite tr-level avoid; reinforce on cells */
            td, th { break-inside: avoid; page-break-inside: avoid; }
            /* Section banners & letterheads: never split, never stranded at a page bottom */
            .header, .proposal-panel-header, .accept-hero, .cancel-hero, .category-header {
              break-inside: avoid; page-break-inside: avoid;
              break-after: avoid; page-break-after: avoid;
            }
            /* Self-contained blocks that must never be cut in half */
            .about-card-row, .about-card, .overview-card, .photo-item,
            .tier-totals, .signature-section, .accept-sig-block,
            .cancel-deadline-banner, .cancel-notice-box, .cancel-body-panel,
            .cancel-effect-panel, .sidebar-card {
              break-inside: avoid; page-break-inside: avoid;
            }
            .tier-totals { margin: 24px 0 !important; }
            .cover-title { margin: 20px 0 24px !important; }
            .footer { margin-top: 24px !important; }
            h2, h3 { margin-top: 0 !important; margin-bottom: 12px !important; }
          }

          /* ── Print: natural flow, letter size ── */
          @media print {
            html, body { width: 816px; max-width: 816px; margin: 0; padding: 0; background: white !important; overflow-x: hidden; }
            .page {
              overflow: visible;
              max-width: none;
              margin: 0;
              border-radius: 0;
              box-shadow: none;
              border-bottom: none;
              background: white !important;
            }
            .page-cover {
              background: linear-gradient(150deg, #eef3ff 0%, #ffffff 28%, #ffffff 72%, #fff4ef 100%) !important;
            }
          }

          /* ── Mobile responsive ── */
          @media screen and (max-width: 640px) {
            html, body { padding: 0; background: #f3f4f6; }
            .page { padding: 16px 12px; border-radius: 0 !important; margin-bottom: 0; box-shadow: none; }

            /* ── Cover hero ── */
            .hero-shell, .hero-shell-compact { grid-template-columns: 1fr !important; }
            .hero-panel-image { min-height: 160px !important; }
            .hero-content { padding: 12px 14px !important; }
            .hero-content-image { min-height: 160px !important; }
            .hero-title { font-size: 24px !important; letter-spacing: -0.5px !important; margin-top: 12px !important; }
            .hero-description { font-size: 13px !important; margin-top: 10px !important; }
            .hero-company { font-size: 16px !important; }
            .hero-brand { gap: 10px !important; margin-top: 12px !important; }
            .hero-logo { width: 44px !important; height: 44px !important; }
            /* Hero meta — 4 col single row, tighten spacing for print */
            .hero-meta-grid { grid-template-columns: repeat(4, 1fr) !important; gap: 8px !important; margin-top: 10px !important; }
            .hero-meta-card { padding: 10px !important; }
            .hero-meta-value { font-size: 13px !important; }
            /* Cover badges — 4 cols → 2 cols */
            .cover-badge-row { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; margin-top: 12px !important; }
            .cover-badge { padding: 10px !important; }
            .cover-badge-title { font-size: 12px !important; }
            .cover-badge-detail { font-size: 10px !important; }
            /* Sidebar hidden on mobile (stacks below hero panel already) */
            .hero-sidebar { gap: 12px !important; }
            .sidebar-card { padding: 14px !important; }

            /* ── Header bar ── */
            .header { flex-direction: column; gap: 8px; align-items: flex-start !important; padding: 10px 12px !important; margin-bottom: 20px !important; }
            .company-info { text-align: left !important; }
            .company-name { font-size: 16px !important; }
            .company-details { font-size: 11px !important; }
            .logo { max-width: 100px !important; max-height: 40px !important; }

            /* ── Proposal panel ── */
            .proposal-panel-title { font-size: 20px !important; }
            .proposal-panel-body { padding: 14px !important; }

            /* ── Stats bar — stack to 1 column ── */
            .proposal-stats-bar { grid-template-columns: 1fr !important; }
            .proposal-stat { border-left: none !important; border-top: 1px solid rgba(17,17,17,0.12) !important; }
            .proposal-stat:first-child { border-top: none; }
            .proposal-stat-value { font-size: 22px !important; }

            /* ── Cover title ── */
            .cover-title { font-size: 22px !important; margin: 24px 0 18px !important; }

            /* ── About page ── */
            .about-grid, .split-layout, .cover-media { grid-template-columns: 1fr !important; }
            .showcase-grid { grid-template-columns: repeat(2, 1fr) !important; }
            .expertise-panel { align-self: start !important; margin-top: 0 !important; }
            .about-heading { font-size: 16px !important; }
            /* Why Clients Choose Us — 4-col table → 2×2 grid on mobile */
            .about-card-row { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; border-spacing: 0 !important; }
            .about-card { display: block !important; }

            /* ── Scope / line items ── */
            .overview-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
            .customer-grid { grid-template-columns: 1fr !important; }
            .measurement-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
            .subtotal-strip { grid-template-columns: 1fr !important; }
            /* Line item table — hide price columns, keep item + total readable */
            table { font-size: 11px !important; }
            th, td { padding: 5px 6px !important; }
            .category-header { font-size: 13px !important; padding: 10px 12px !important; }

            /* ── Tier totals ── */
            .tier-totals { grid-template-columns: 1fr !important; max-width: 100% !important; gap: 12px !important; }

            /* ── Photos ── */
            .photo-grid-2col { grid-template-columns: 1fr !important; }
            .photo-row, .photo-item { display: block !important; width: 100% !important; }
            .photo-item { margin-bottom: 12px !important; }

            /* ── Signature / acceptance page ── */
            .accept-grid { grid-template-columns: 1fr !important; }
            .accept-parties { grid-template-columns: 1fr !important; gap: 10px !important; }
            .accept-sig-block { grid-template-columns: 1fr !important; gap: 16px !important; }
            .cancel-two-col { grid-template-columns: 1fr !important; }
            .acceptance-tags { grid-template-columns: repeat(2, 1fr) !important; }
            /* Accept hero — stack vertically on narrow screens so the amount box
               never overlaps the "Customer Acceptance" title */
            .accept-hero { flex-wrap: wrap !important; padding: 18px !important; gap: 12px !important; }
            .accept-total-box { min-width: 0 !important; width: 100% !important; text-align: left !important; }
            .accept-pricing-row { flex-direction: column !important; }
            .accept-price-banner { padding: 14px !important; }
          }
          .section-kicker {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1.4px;
            text-transform: uppercase;
            color: ${accentColor};
            margin-bottom: 8px;
          }
          .proposal-panel {
            border-radius: 18px;
            overflow: hidden;
            border: 1px solid #e0e8f4;
            background: linear-gradient(180deg, #f6f9ff 0%, #ffffff 100%);
            box-shadow: 0 2px 12px rgba(30,58,95,0.06);
            /* Force GPU compositing so iOS WKWebView renders overflow:hidden + gradient correctly */
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
          }
          .proposal-panel-header {
            background: linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 55%, ${primaryColor}cc 100%);
            color: #ffffff;
            padding: 12px 20px 14px;
          }
          .proposal-panel-header.compact {
            border-radius: 18px 18px 0 0;
          }
          .proposal-panel-kicker {
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 1.6px;
            text-transform: uppercase;
            color: ${accentColor};
            margin-bottom: 6px;
          }
          .proposal-panel-title {
            font-size: 30px;
            font-weight: 800;
            line-height: 1.1;
          }
          .proposal-panel-accent {
            height: 6px;
            background: ${accentColor};
          }
          .proposal-panel-body {
            padding: 24px;
          }
          .about-heading {
            font-size: 20px;
            font-weight: 700;
            line-height: 1.4;
            color: #111827;
            margin-bottom: 18px;
          }
          .proposal-stats-bar {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 0;
            background: ${accentColor};
            color: #111827;
          }
          .proposal-stat {
            padding: 18px 16px;
            border-left: 1px solid rgba(17,17,17,0.12);
          }
          .proposal-stat:first-child {
            border-left: 0;
          }
          .proposal-stat-value {
            font-size: 28px;
            font-weight: 900;
            line-height: 1;
            margin-bottom: 8px;
          }
          .proposal-stat-label {
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.9px;
            margin-bottom: 6px;
          }
          .proposal-stat-text {
            font-size: 11px;
            line-height: 1.5;
            color: #1f2937;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 32px;
            padding-bottom: 18px;
            border-bottom: 0;
            background: linear-gradient(90deg, ${primaryColor}08 0%, transparent 60%);
            border-radius: 12px;
            padding: 14px 18px 14px 18px;
            border-left: 4px solid ${accentColor};
          }
          .logo { max-width: 200px; max-height: 80px; }
          .company-info { text-align: right; }
          .company-name { font-size: 24px; font-weight: bold; color: ${primaryColor}; margin-bottom: 5px; }
          .company-details { font-size: 12px; color: #6b7280; }
          .cover-title { font-size: 36px; font-weight: bold; color: ${primaryColor}; text-align: center; margin: 60px 0 40px; }
          .hero-shell {
            display: grid;
            grid-template-columns: 1.45fr 0.9fr;
            gap: 20px;
            margin-bottom: 18px;
          }
          .hero-shell-compact {
            grid-template-columns: 1.1fr 0.9fr;
            align-items: start;
          }
          .hero-panel {
            position: relative;
            border-radius: 20px;
            overflow: hidden;
            background: ${primaryColor};
            color: white;
          }
          .hero-bg-img {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
            display: block;
            z-index: 0;
          }
          .hero-panel-image { min-height: 560px; }
          .hero-panel-compact {
            min-height: auto;
            background: #ffffff;
            color: #111827;
            border: 1px solid #e5e7eb;
          }
          .hero-overlay {
            position: absolute;
            inset: 0;
            background: linear-gradient(180deg, rgba(15,23,42,0.24), rgba(15,23,42,0.88));
          }
          .hero-content {
            position: relative;
            z-index: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 28px;
          }
          .hero-content-image { min-height: 560px; }
          .hero-content-compact {
            min-height: auto;
            gap: 18px;
            padding: 24px;
          }
          .hero-topline {
            align-self: flex-start;
            padding: 8px 12px;
            border-radius: 999px;
            background: rgba(255,255,255,0.14);
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
          }
          .hero-content-compact .hero-topline {
            background: ${accentColor}18;
            color: ${primaryColor};
          }
          .hero-brand {
            display: flex;
            align-items: center;
            gap: 14px;
            margin-top: 20px;
          }
          .hero-content-compact .hero-brand { margin-top: 8px; }
          .hero-logo {
            width: 62px;
            height: 62px;
            object-fit: contain;
            background: rgba(255,255,255,0.12);
            border-radius: 14px;
            padding: 8px;
          }
          .hero-company { font-size: 24px; font-weight: 800; }
          .hero-subtitle { font-size: 13px; opacity: 0.88; text-transform: capitalize; }
          .hero-content-compact .hero-company,
          .hero-content-compact .hero-subtitle,
          .hero-content-compact .hero-title,
          .hero-content-compact .hero-description {
            color: #111827;
          }
          .hero-title {
            margin-top: 22px;
            font-size: 48px;
            line-height: 1.02;
            font-weight: 900;
            letter-spacing: -1px;
            text-transform: uppercase;
            max-width: 92%;
          }
          .hero-content-compact .hero-title {
            font-size: 44px;
            color: #4b5563;
          }
          .hero-description {
            margin-top: 14px;
            max-width: 92%;
            font-size: 15px;
            line-height: 1.6;
            color: rgba(255,255,255,0.92);
          }
          .hero-meta-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-top: 12px;
          }
          .cover-badge-row {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-top: 16px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .cover-badge {
            padding: 14px 12px 16px;
            border-radius: 16px;
            background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%);
            color: #1e3a5f;
            border: 1px solid #bfdbfe;
          }
          .hero-content-image .cover-badge {
            background: rgba(239,246,255,0.92);
            color: #0f172a;
            border-color: rgba(191,219,254,0.6);
          }
          .cover-badge-kicker {
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            color: #2563eb;
            margin-bottom: 8px;
          }
          .cover-badge-title {
            font-size: 14px;
            font-weight: 800;
            line-height: 1.25;
            color: #111827;
          }
          .cover-badge-detail {
            margin-top: 7px;
            font-size: 11px;
            line-height: 1.45;
            color: #374151;
          }
          .hero-meta-card {
            background: rgba(255,255,255,0.12);
            border: 1px solid rgba(255,255,255,0.16);
            border-radius: 16px;
            padding: 12px 14px;
          }
          .hero-content-compact .hero-meta-card {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
          }
          .hero-meta-label {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.9px;
            text-transform: uppercase;
            color: rgba(255,255,255,0.82);
            margin-bottom: 6px;
          }
          .hero-content-compact .hero-meta-label { color: #6b7280; }
          .hero-meta-value { font-size: 16px; font-weight: 700; }
          .hero-content-compact .hero-meta-value { color: #111827; }
          .hero-sidebar {
            display: flex;
            flex-direction: column;
            gap: 18px;
          }
          .hero-content-image .cover-badge-kicker { color: #1d4ed8; }
          .hero-content-image .cover-badge-title,
          .hero-content-image .cover-badge-detail { color: #0f172a; }
          .sidebar-card {
            border-radius: 20px;
            border: 1px solid #e0e8f4;
            background: linear-gradient(160deg, #f6f9ff 0%, #ffffff 50%, #fff9f7 100%);
            padding: 20px;
            break-inside: avoid;
            page-break-inside: avoid;
            box-shadow: 0 2px 8px rgba(30,58,95,0.05);
          }
          .sidebar-card.compact { padding-bottom: 14px; }
          .sidebar-title {
            font-size: 18px;
            font-weight: 800;
            color: #111827;
            margin-bottom: 14px;
          }
          .sidebar-row, .snapshot-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 10px 0;
            border-top: 1px solid #eef2f7;
          }
          .sidebar-row:first-of-type, .snapshot-row:first-of-type { border-top: 0; }
          .sidebar-number {
            width: 34px;
            height: 34px;
            border-radius: 17px;
            background: ${accentColor}20;
            color: ${primaryColor};
            font-size: 11px;
            font-weight: 800;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          .sidebar-text {
            flex: 1;
            color: #111827;
            font-size: 13px;
            font-weight: 600;
          }
          .snapshot-row span {
            color: #4b5563;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
          }
          .snapshot-row strong { color: #111827; font-size: 14px; }
          .customer-section, .warranty-section {
            background: #f9fafb;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 24px;
          }
          .about-section {
            background: transparent;
            padding: 0;
            border-radius: 0;
            margin-bottom: 0;
          }
          .section-title {
            font-size: 18px;
            font-weight: bold;
            color: ${primaryColor};
            margin-bottom: 15px;
            border-bottom: 2px solid ${accentColor};
            padding-bottom: 8px;
          }
          .customer-grid, .cover-media, .measurement-grid, .tier-totals, .subtotal-strip, .acceptance-tags {
            display: grid;
            gap: 15px;
          }
          .split-layout {
            display: grid;
            grid-template-columns: 1.15fr 0.95fr;
            gap: 20px;
          }
          .customer-grid { grid-template-columns: 1fr 1fr; }
          .cover-media { grid-template-columns: 1.3fr 1fr; gap: 20px; margin-bottom: 24px; }
          .measurement-grid { grid-template-columns: repeat(4, 1fr); gap: 12px; }
          .tier-totals { gap: 20px; margin: 40px 0; break-inside: avoid; page-break-inside: avoid; }
          .subtotal-strip { grid-template-columns: repeat(${getVisibleTierCount(quote)}, 1fr); margin-top: 14px; }
          .acceptance-tags { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); margin: 14px 0 16px; }
          .info-row { margin-bottom: 8px; }
          .info-label { font-weight: 600; color: #374151; font-size: 12px; }
          .info-value { color: #6b7280; font-size: 14px; }
          .quote-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            padding: 15px;
            background: ${accentColor}20;
            border-radius: 12px;
          }
          .quote-number { font-size: 20px; font-weight: bold; color: ${accentColor}; }
          .quote-date { color: #6b7280; font-size: 14px; }
          .cover-photo, .photo-img { width: 100%; object-fit: cover; border-radius: 12px; }
          .cover-photo { height: 260px; }
          /* Rep card — full photo layout */
          .rep-card {
            overflow: hidden;
            border-radius: 16px;
            border: 1px solid #e0e8f4;
            background: linear-gradient(135deg, #f8faff 0%, #ffffff 100%);
            box-shadow: 0 2px 8px rgba(30,58,95,0.06);
          }
          .rep-photo-full-wrap {
            width: 100%;
            height: 200px;
            overflow: hidden;
            border-bottom: 2px solid ${accentColor};
          }
          .rep-photo-full {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }
          .rep-card-info {
            padding: 12px 14px 14px;
          }
          .rep-label { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #6b7280; }
          .rep-name { font-size: 18px; font-weight: 700; color: #111827; margin-top: 4px; }
          /* Sidebar badge stack (Why Clients Choose Us — vertical, in sidebar) */
          .sidebar-badge-stack {
            background: #111827;
            border-radius: 16px;
            padding: 14px;
            color: white;
          }
          .sidebar-badge-heading {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            color: rgba(255,255,255,0.55);
            margin-bottom: 10px;
          }
          .sidebar-badge {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 10px 12px;
            margin-bottom: 8px;
          }
          .sidebar-badge:last-child { margin-bottom: 0; }
          .sidebar-badge-title {
            font-size: 13px;
            font-weight: 800;
            color: #ffffff;
            margin-bottom: 3px;
          }
          .sidebar-badge-detail {
            font-size: 11px;
            line-height: 1.45;
            color: rgba(255,255,255,0.8);
          }
          .sidebar-contact-card {
            background: #111827;
            border-radius: 16px;
            padding: 14px;
            color: white;
          }
          .sidebar-contact-row {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            font-size: 11px;
            color: rgba(255,255,255,0.85);
            margin-bottom: 7px;
            line-height: 1.4;
          }
          .sidebar-contact-row:last-child { margin-bottom: 0; }
          .sidebar-contact-icon {
            font-size: 12px;
            flex-shrink: 0;
            margin-top: 1px;
          }
          .measurement-source, .item-description, .photo-notes, .footer { color: #6b7280; }
          .measurement-card {
            border: 1px solid #e5e7eb;
            background: #f9fafb;
            border-radius: 12px;
            padding: 12px;
          }
          .measurement-label {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            color: #6b7280;
            margin-bottom: 6px;
          }
          .measurement-value { font-size: 16px; font-weight: 700; color: #111827; }
          /* Allow large category sections to flow naturally across print pages.
             break-inside:avoid on individual <tr> rows (added inline) keeps
             each row intact; the category-header's break-after:avoid keeps
             the header pinned to the first item row. */
          .category-section { margin-bottom: 30px; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          .overview-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            margin-top: 16px;
          }
          .overview-card {
            border-radius: 16px;
            border: 1px solid #e5e7eb;
            background: #ffffff;
            padding: 16px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .overview-card-header {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 10px;
          }
          .overview-card-title { font-size: 16px; font-weight: 800; color: #111827; }
          .overview-card-count {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            color: #4b5563;
          }
          .overview-list {
            margin-left: 18px;
            color: #1f2937;
            font-size: 12px;
            line-height: 1.7;
            min-height: 64px;
          }
          .overview-card-totals {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 12px;
          }
          .overview-card-totals span {
            padding: 6px 10px;
            border-radius: 999px;
            background: #f3f4f6;
            font-size: 11px;
            font-weight: 700;
            color: #374151;
          }
          .category-header {
            background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%);
            color: white;
            padding: 12px 16px;
            font-size: 15px;
            font-weight: 700;
            border-radius: 8px 8px 0 0;
            letter-spacing: 0.3px;
            break-after: avoid;
            page-break-after: avoid;
          }
          table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          th {
            background: #f3f4f6;
            padding: 12px;
            text-align: left;
            font-size: 12px;
            font-weight: 600;
            color: #374151;
            border-bottom: 2px solid #e5e7eb;
          }
          td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; vertical-align: top; }
          .item-name { font-weight: 600; color: #1e3a5f; }
          .item-description { font-size: 11px; margin-top: 3px; }
          .price { text-align: right; font-weight: 600; }
          .category-total { background: #f9fafb; font-weight: bold; }
          .subtotal-item, .acceptance-summary {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 12px 14px;
          }
          .subtotal-item span {
            display: block;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #6b7280;
            margin-bottom: 6px;
          }
          .subtotal-item strong { font-size: 18px; color: #111827; }
          .tier-card { padding: 28px 25px; border-radius: 16px; text-align: center; color: white; break-inside: avoid; page-break-inside: avoid; position: relative; overflow: hidden; }
          .tier-card::before { content: ''; position: absolute; top: -30px; right: -30px; width: 100px; height: 100px; border-radius: 50%; background: rgba(255,255,255,0.08); }
          .tier-card::after { content: ''; position: absolute; bottom: -20px; left: -20px; width: 70px; height: 70px; border-radius: 50%; background: rgba(255,255,255,0.06); }
          .tier-good { background: linear-gradient(135deg, #047857 0%, #059669 45%, #10b981 100%); box-shadow: 0 6px 20px rgba(5,150,105,0.25); }
          .tier-better { background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 45%, #3b82f6 100%); box-shadow: 0 6px 20px rgba(37,99,235,0.25); }
          .tier-best { background: linear-gradient(135deg, #92400e 0%, #d97706 45%, #f59e0b 100%); box-shadow: 0 6px 20px rgba(217,119,6,0.25); }
          .tier-label { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 10px; opacity: 0.9; }
          .tier-amount { font-size: 34px; font-weight: 900; letter-spacing: -0.5px; }
          .photos-wrap { margin-top: 18px; }
          /* display:table (not flex) — Safari/WebKit's print engine does not
             reliably honor break-inside:avoid on flex containers, which was
             causing photo pairs to split or produce blank pages when printed
             from Safari. Tables paginate correctly across all browsers. */
          .photo-row {
            display: table;
            width: 100%;
            table-layout: fixed;
            border-spacing: 16px 0;
            margin-bottom: 16px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .about-card-row {
            display: table;
            width: 100%;
            table-layout: fixed;
            border-spacing: 8px;
          }
          .about-card {
            display: table-cell;
          }
          .expertise-panel {
            border-radius: 16px;
            background: #111827;
            padding: 18px;
            color: white;
            align-self: start;
          }
          .expertise-title {
            font-size: 22px;
            font-weight: 800;
            margin-bottom: 16px;
          }
          .expertise-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .expertise-card {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 14px;
            padding: 14px;
          }
          .expertise-card-title {
            font-size: 14px;
            font-weight: 800;
            margin-bottom: 6px;
            color: #ffffff;
          }
          .expertise-card-text {
            font-size: 12px;
            line-height: 1.6;
            color: rgba(255,255,255,0.9);
          }
          .photo-item {
            display: table-cell;
            vertical-align: top;
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 12px;
            background: white;
            overflow: hidden;
          }
          .photo-img { width: 100%; height: 200px; object-fit: cover; border: 1px solid #e5e7eb; border-radius: 6px; }
          .photo-caption { margin-top: 8px; font-size: 12px; color: #374151; font-weight: 600; }
          .photo-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
          .photo-tag { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 20px; display: inline-block; }
          .photo-tag-blue { background: #1e3a5f; color: white; }
          .photo-tag-red { background: #ef4444; color: white; }
          .signature-section { margin-top: 20px; padding: 30px; border: 2px solid #e5e7eb; border-radius: 12px; break-inside: avoid; page-break-inside: avoid; }
          .signature-line { border-top: 2px solid #1e3a5f; margin-top: 28px; padding-top: 10px; min-height: 48px; }
          .signature-label { font-size: 12px; color: #6b7280; }
          .signature-value { font-size: 15px; font-weight: 600; color: #111827; min-height: 24px; margin-bottom: 6px; }
          .signature-image-wrap {
            min-height: 120px;
            display: flex;
            align-items: flex-end;
            justify-content: flex-start;
            margin-top: 10px;
          }
          .signature-image { width: 280px; height: 100px; object-fit: contain; }
          .signature-spacer { height: 100px; }
          .acceptance-title {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #6b7280;
          }
          .acceptance-tag {
            display: inline-block;
            padding: 8px 10px;
            border-radius: 999px;
            background: ${accentColor}20;
            color: ${primaryColor};
            font-size: 12px;
            font-weight: 600;
          }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; font-size: 11px; }

          /* ── Acceptance Page ─────────────────────────────── */
          .accept-hero { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; background: ${primaryColor}; color: white; border-radius: 14px; padding: 24px 28px; margin-bottom: 20px; }
          .accept-hero-left { flex: 1 1 auto; min-width: 0; }
          .accept-hero-title { font-size: 26px; font-weight: 800; line-height: 1.1; margin: 6px 0 4px; }
          .accept-hero-subtitle { font-size: 13px; opacity: 0.8; }
          .accept-total-box { flex: 0 0 auto; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; padding: 16px 22px; text-align: right; min-width: 200px; }
          .accept-total-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; margin-bottom: 6px; white-space: nowrap; }
          .accept-total-amount { font-size: 26px; font-weight: 900; white-space: nowrap; }
          .accept-total-sub { font-size: 10px; opacity: 0.7; margin-top: 4px; white-space: nowrap; }
          .accept-parties { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 18px; }
          .accept-party { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; }
          .accept-party-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 6px; }
          .accept-party-name { font-size: 15px; font-weight: 700; color: #111827; margin-bottom: 4px; }
          .accept-party-detail { font-size: 11px; color: #374151; line-height: 1.5; }
          .accept-scope-panel { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; margin-bottom: 16px; }
          .accept-scope-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #374151; margin-bottom: 8px; }
          /* ── Pricing banners (always visible, before signature) ── */
          .accept-pricing-row { display: flex; gap: 12px; margin-bottom: 18px; }
          .accept-price-banner { flex: 1; border-radius: 12px; padding: 18px 14px 14px; text-align: center; color: white; position: relative; }
          .accept-price-banner-good   { background: linear-gradient(135deg, #059669 0%, #34d399 100%); box-shadow: 0 4px 14px rgba(5,150,105,0.35); }
          .accept-price-banner-better { background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); box-shadow: 0 4px 14px rgba(29,78,216,0.35); }
          .accept-price-banner-best   { background: linear-gradient(135deg, #b45309 0%, #f59e0b 100%); box-shadow: 0 4px 14px rgba(180,83,9,0.35); }
          .accept-price-banner-active { outline: 3px solid rgba(255,255,255,0.9); outline-offset: -3px; }
          .accept-price-banner-label  { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; opacity: 0.92; margin-bottom: 8px; }
          .accept-price-banner-amount { font-size: 28px; font-weight: 900; line-height: 1; margin-bottom: 10px; }
          .accept-price-banner-select { display: inline-flex; align-items: center; justify-content: center; gap: 5px; font-size: 10px; font-weight: 600; opacity: 0.88; background: rgba(255,255,255,0.18); border-radius: 20px; padding: 4px 12px; }
          .accept-price-banner-circle { width: 13px; height: 13px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.9); display: inline-block; flex-shrink: 0; }
          .accept-price-banner-circle-checked { background: white; }
          .accept-order-summary { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; margin-bottom: 16px; }
          .accept-order-summary-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #374151; margin-bottom: 10px; }
          .accept-order-row { display: flex; justify-content: space-between; font-size: 13px; color: #374151; padding: 4px 0; }
          .accept-order-upgrade { color: #d97706; }
          .accept-order-total { display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: #111827; border-top: 2px solid #e5e7eb; margin-top: 8px; padding-top: 8px; }
          .accept-legal-box { background: linear-gradient(135deg, #eef3ff 0%, #f8fafc 100%); border: 1px solid #c7d7f0; border-radius: 10px; padding: 16px 18px; margin-bottom: 16px; border-left: 4px solid ${primaryColor}40; }
          .accept-legal-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #374151; margin-bottom: 10px; }
          .accept-legal-body { font-size: 11px; color: #374151; line-height: 1.65; }
          .accept-sig-block { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 20px; break-inside: avoid; page-break-inside: avoid; align-items: start; }
          .cancel-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 16px; }
          .cancel-left { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; }
          .cancel-right { display: flex; flex-direction: column; gap: 14px; }
          .cancel-notice-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 16px; }
          .accept-sig-col { display: flex; flex-direction: column; }
          .accept-sig-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #6b7280; margin-bottom: 8px; min-height: 30px; }
          .accept-sig-area { height: 80px; background: #f9fafb; border: 1px dashed #d1d5db; border-radius: 8px; display: flex; align-items: center; justify-content: flex-start; padding: 8px; margin-bottom: 0; }
          .accept-sig-blank { height: 60px; width: 100%; }
          .accept-sig-line { border-top: 2px solid ${primaryColor}; margin-top: 0; padding-top: 6px; }
          .accept-sig-meta { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; color: #111827; margin-top: 4px; }
          .accept-sig-meta-label { display: flex; justify-content: space-between; font-size: 10px; color: #6b7280; margin-top: 2px; }

          /* ── Cancel Notice Page ─────────────────────────── */
          .cancel-hero { display: flex; align-items: center; gap: 18px; background: #92400e; color: white; border-radius: 14px; padding: 20px 24px; margin-bottom: 18px; }
          .cancel-hero-icon { width: 48px; height: 48px; border-radius: 50%; background: #f59e0b; color: #111827; font-size: 28px; font-weight: 900; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .cancel-hero-kicker { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; opacity: 0.8; margin-bottom: 4px; }
          .cancel-hero-title { font-size: 24px; font-weight: 800; margin-bottom: 4px; }
          .cancel-hero-subtitle { font-size: 12px; opacity: 0.8; }
          .cancel-deadline-banner { background: #fef3c7; border: 2px solid #f59e0b; border-radius: 12px; padding: 16px 22px; margin-bottom: 18px; text-align: center; break-inside: avoid; page-break-inside: avoid; }
          .cancel-deadline-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #92400e; margin-bottom: 6px; }
          .cancel-deadline-date { font-size: 22px; font-weight: 900; color: #78350f; }
          .cancel-deadline-sub { font-size: 11px; color: #92400e; margin-top: 4px; }
          .cancel-body-panel { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 18px 20px; margin-bottom: 16px; }
          .cancel-section-title { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.8px; }
          .cancel-body-text { font-size: 11.5px; color: #374151; line-height: 1.7; }
          .cancel-steps-title { font-size: 12px; font-weight: 700; color: #111827; margin: 16px 0 10px; text-transform: uppercase; letter-spacing: 0.8px; }
          .cancel-step { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 10px; font-size: 11.5px; color: #374151; line-height: 1.6; }
          .cancel-step-num { width: 22px; height: 22px; border-radius: 50%; background: ${primaryColor}; color: white; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
          .cancel-effect-panel { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 14px 16px; margin-top: 14px; }
          .cancel-effect-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #9a3412; margin-bottom: 8px; }
        </style>
        <style>
          .lb-overlay { display:none; position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.92); align-items:center; justify-content:center; flex-direction:column; cursor:zoom-out; }
          .lb-overlay.open { display:flex; }
          .lb-img { max-width:90vw; max-height:80vh; object-fit:contain; border-radius:8px; box-shadow:0 25px 60px rgba(0,0,0,0.5); cursor:default; }
          .lb-close { position:absolute; top:16px; right:16px; background:rgba(255,255,255,0.15); border:none; color:white; border-radius:50%; width:40px; height:40px; font-size:22px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
          .lb-close:hover { background:rgba(255,255,255,0.25); }
          .lb-caption { position:absolute; bottom:0; left:0; right:0; padding:20px; text-align:center; background:linear-gradient(to top, rgba(0,0,0,0.75), transparent); color:white; }
          .lb-caption strong { display:block; font-size:15px; }
          .lb-caption span { font-size:13px; opacity:0.75; }
          .lb-prev, .lb-next { position:absolute; top:50%; transform:translateY(-50%); background:rgba(255,255,255,0.12); border:none; color:white; border-radius:50%; width:44px; height:44px; font-size:24px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
          .lb-prev:hover, .lb-next:hover { background:rgba(255,255,255,0.25); }
          .lb-prev { left:12px; } .lb-next { right:12px; }
          .lb-counter { position:absolute; top:16px; left:50%; transform:translateX(-50%); color:rgba(255,255,255,0.6); font-size:13px; }
          img[data-lb] { cursor:zoom-in; transition:opacity 0.15s; }
          img[data-lb]:hover { opacity:0.88; }
        </style>
      </head>
      <body>
        ${orderedPageKeys.map(pageKey => pageRenderers[pageKey]()).join('')}
        ${(() => {
          const files: any[] = Array.isArray((quote as any).attached_files) ? (quote as any).attached_files : [];
          if (files.length === 0 || (quote as any).include_brochures === false) return '';
          return `
          <div class="page" style="padding:48px 40px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px;">
              <div style="width:4px;height:32px;background:${primaryColor};border-radius:2px;"></div>
              <h2 style="font-size:22px;font-weight:700;color:${primaryColor};">Documents &amp; Brochures</h2>
            </div>
            <p style="color:#6b7280;font-size:14px;margin-bottom:24px;">The following materials have been included for your reference. Click any document to open it.</p>
            <div style="display:flex;flex-direction:column;gap:12px;">
              ${files.map((f: any) => `
              <a href="${escapeHtml(f.fileUrl)}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;gap:16px;padding:16px 20px;border:1.5px solid #e5e7eb;border-radius:12px;text-decoration:none;background:#fafafa;">
                <div style="width:40px;height:40px;background:${primaryColor};border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div style="flex:1;min-width:0;">
                  <p style="font-weight:600;color:#111827;font-size:15px;margin:0 0 2px;">${escapeHtml(f.title || f.fileName)}</p>
                  ${f.description ? `<p style="color:#6b7280;font-size:13px;margin:0;">${escapeHtml(f.description)}</p>` : ''}
                </div>
                <div style="flex-shrink:0;background:#e5e7eb;color:#374151;font-size:12px;font-weight:600;padding:4px 10px;border-radius:20px;">View</div>
              </a>`).join('')}
            </div>
          </div>`;
        })()}

        <!-- Lightbox overlay -->
        <div class="lb-overlay" id="lb" onclick="lbClose()">
          <span class="lb-counter" id="lb-counter"></span>
          <button class="lb-close" onclick="lbClose()">✕</button>
          <button class="lb-prev" id="lb-prev" onclick="event.stopPropagation();lbNav(-1)">&#8249;</button>
          <img class="lb-img" id="lb-img" src="" alt="" onclick="event.stopPropagation()" />
          <button class="lb-next" id="lb-next" onclick="event.stopPropagation();lbNav(1)">&#8250;</button>
          <div class="lb-caption" id="lb-caption"></div>
        </div>

        <script>
          var lbPhotos = [];
          var lbIdx = 0;
          document.querySelectorAll('img[data-lb]').forEach(function(img, i) {
            img.addEventListener('click', function(e) {
              e.stopPropagation();
              lbPhotos = Array.from(document.querySelectorAll('img[data-lb]')).map(function(el) {
                return { src: el.src, caption: el.dataset.caption || '', notes: el.dataset.notes || '' };
              });
              lbIdx = i;
              lbShow();
            });
          });
          function lbShow() {
            var p = lbPhotos[lbIdx];
            document.getElementById('lb-img').src = p.src;
            document.getElementById('lb-img').alt = p.caption;
            var cap = document.getElementById('lb-caption');
            cap.innerHTML = (p.caption ? '<strong>'+p.caption+'</strong>' : '') + (p.notes ? '<span>'+p.notes+'</span>' : '');
            cap.style.display = (p.caption || p.notes) ? 'block' : 'none';
            document.getElementById('lb-counter').textContent = lbPhotos.length > 1 ? (lbIdx+1)+' / '+lbPhotos.length : '';
            document.getElementById('lb-prev').style.display = lbIdx > 0 ? 'flex' : 'none';
            document.getElementById('lb-next').style.display = lbIdx < lbPhotos.length-1 ? 'flex' : 'none';
            document.getElementById('lb').classList.add('open');
            document.body.style.overflow = 'hidden';
          }
          function lbClose() { document.getElementById('lb').classList.remove('open'); document.body.style.overflow = ''; }
          function lbNav(dir) { lbIdx = Math.max(0, Math.min(lbPhotos.length-1, lbIdx+dir)); lbShow(); }
          document.addEventListener('keydown', function(e) {
            if (!document.getElementById('lb').classList.contains('open')) return;
            if (e.key==='Escape') lbClose();
            if (e.key==='ArrowLeft') lbNav(-1);
            if (e.key==='ArrowRight') lbNav(1);
          });
        </script>

        <style>
          .print-fab {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 8px;
            background: #1e3a5f;
            color: white;
            border: none;
            padding: 12px 22px;
            border-radius: 32px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(0,0,0,0.22);
            font-family: system-ui, -apple-system, sans-serif;
            letter-spacing: 0.01em;
            transition: background 0.15s, transform 0.12s, box-shadow 0.12s;
          }
          .print-fab:hover { background: #152d4a; transform: translateY(-2px); box-shadow: 0 6px 24px rgba(0,0,0,0.28); }
          .print-fab:active { transform: translateY(0); box-shadow: 0 4px 16px rgba(0,0,0,0.2); }
          @media print { .print-fab { display: none !important; } }
        </style>
        <script>
          function _printDoc() {
            // Calling window.print() from an iframe prints only that iframe's content.
            // The user clicked this button so user activation is present — Chrome allows it.
            window.print();
          }
        </script>
        <button class="print-fab" onclick="_printDoc()">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print / Save PDF
        </button>
      </body>
    </html>
  `;
};

const renderUpgradeTable = (
  upgrades: any[],
  quote: any,
  tierNames: {goodTierName: string; betterTierName: string; bestTierName: string},
) => {
  const showPrices = quote.show_upgrade_prices !== false;
  return `
  <table>
    <thead>
      <tr>
        <th style="width: ${showPrices ? '40%' : '60%'};">Upgrade</th>
        <th style="width: 10%;">Qty</th>
        <th style="width: 10%;">Unit</th>
        ${showPrices ? `
        <th style="width: 13%;" class="price">${escapeHtml(tierNames.goodTierName)}</th>
        ${quote.include_better !== false ? `<th style="width: 13%;" class="price">${escapeHtml(tierNames.betterTierName)}</th>` : ''}
        ${quote.include_best !== false ? `<th style="width: 13%;" class="price">${escapeHtml(tierNames.bestTierName)}</th>` : ''}
        ` : ''}
      </tr>
    </thead>
    <tbody>
      ${upgrades.map(upgrade => `
        <tr>
          <td>
            <div class="item-name">${escapeHtml(upgrade.item_name)}</div>
            ${upgrade.description ? `<div class="item-description">${escapeHtml(upgrade.description)}</div>` : ''}
            ${(upgrade.good_product || upgrade.better_product || upgrade.best_product) ? `
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:3px;">
                ${upgrade.good_product ? `<span style="font-size:10px;background:#d1fae5;color:#065f46;padding:1px 6px;border-radius:20px;font-weight:500;">${escapeHtml(tierNames.goodTierName)}: ${escapeHtml(upgrade.good_product)}</span>` : ''}
                ${upgrade.better_product && quote.include_better !== false ? `<span style="font-size:10px;background:#dbeafe;color:#1e40af;padding:1px 6px;border-radius:20px;font-weight:500;">${escapeHtml(tierNames.betterTierName)}: ${escapeHtml(upgrade.better_product)}</span>` : ''}
                ${upgrade.best_product && quote.include_best !== false ? `<span style="font-size:10px;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:20px;font-weight:500;">${escapeHtml(tierNames.bestTierName)}: ${escapeHtml(upgrade.best_product)}</span>` : ''}
              </div>` : ''}
          </td>
          <td>${formatNumber(upgrade.quantity)}</td>
          <td>${escapeHtml(upgrade.unit)}</td>
          ${showPrices ? `
          <td class="price">$${formatMoney((upgrade.quantity || 0) * ((upgrade.good_price ?? upgrade.price) || 0))}</td>
          ${quote.include_better !== false ? `<td class="price">$${formatMoney((upgrade.quantity || 0) * ((upgrade.better_price ?? upgrade.price) || 0))}</td>` : ''}
          ${quote.include_best !== false ? `<td class="price">$${formatMoney((upgrade.quantity || 0) * ((upgrade.best_price ?? upgrade.price) || 0))}</td>` : ''}
          ` : ''}
        </tr>
      `).join('')}
    </tbody>
  </table>
`;};

const groupLineItemsByCategory = (items: any[]): Record<string, any[]> =>
  items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, any[]>);

const calculateTotals = (items: any[]) =>
  items.reduce(
    (acc, item) => ({
      good: acc.good + item.quantity * item.good_price,
      better: acc.better + item.quantity * item.better_price,
      best: acc.best + item.quantity * item.best_price,
    }),
    {good: 0, better: 0, best: 0},
  );

const calculateCategoryTotals = (groupedItems: any) => {
  const result: Record<string, {good: number; better: number; best: number}> = {};
  for (const [category, items] of Object.entries(groupedItems)) {
    result[category] = calculateTotals(items);
  }
  return result;
};

const calculateAcceptedSectionTotals = (
  categoryTotals: Record<string, {good: number; better: number; best: number}>,
  acceptedSections: string[],
) =>
  acceptedSections.reduce(
    (acc, category) => {
      const totals = categoryTotals[category];
      if (!totals) {
        return acc;
      }
      return {
        good: acc.good + totals.good,
        better: acc.better + totals.better,
        best: acc.best + totals.best,
      };
    },
    {good: 0, better: 0, best: 0},
  );

const resolvePageOrder = (
  rawPageOrder: string | null | undefined,
  flags: {
    includeAbout: boolean;
    includeScope: boolean;
    includePhotos: boolean;
    includeWarranty: boolean;
    includeSignatureAndCancel?: boolean;
    includeCancel?: boolean;
  },
): PageKey[] => {
  const parsed = parsePageOrder(rawPageOrder);
  const unique = parsed.filter((page, index) => parsed.indexOf(page) === index);
  const merged = [...unique, ...DEFAULT_PAGE_ORDER.filter(page => !unique.includes(page))];

  // includeSignatureAndCancel=false suppresses both (contingency flow uses its own pages)
  const showSigAndCancel = flags.includeSignatureAndCancel !== false;

  const filtered = merged.filter(page => {
    if (page === 'about') return flags.includeAbout;
    if (page === 'scope') return flags.includeScope;
    if (page === 'photos') return flags.includePhotos;
    if (page === 'warranty') return flags.includeWarranty;
    if (page === 'signature') return showSigAndCancel;
    if (page === 'cancel') return showSigAndCancel && flags.includeCancel !== false;
    return true;
  });
  if (!showSigAndCancel) return filtered;
  // Ensure cancel always immediately follows signature (only when cancel is included)
  if (flags.includeCancel === false) return filtered;
  const withoutCancel = filtered.filter(p => p !== 'cancel');
  const sigIdx = withoutCancel.indexOf('signature');
  if (sigIdx >= 0) {
    withoutCancel.splice(sigIdx + 1, 0, 'cancel');
  } else {
    withoutCancel.push('cancel');
  }
  return withoutCancel;
};

const parsePageOrder = (rawPageOrder: string | null | undefined): PageKey[] => {
  if (!rawPageOrder) {
    return DEFAULT_PAGE_ORDER;
  }

  try {
    const parsed = JSON.parse(rawPageOrder) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is PageKey => typeof value === 'string' && VALID_PAGE_KEYS.has(value as PageKey));
    }
  } catch {
    const parsed = rawPageOrder
      .split(',')
      .map(part => part.trim())
      .filter((value): value is PageKey => VALID_PAGE_KEYS.has(value as PageKey));
    if (parsed.length > 0) {
      return parsed;
    }
  }

  return DEFAULT_PAGE_ORDER;
};

const getVisibleTierCount = (quote: any) =>
  1 + (quote.include_better !== false ? 1 : 0) + (quote.include_best !== false ? 1 : 0);

const formatDate = (value: string | number | Date) => new Date(value).toLocaleDateString();

const formatLongDate = (value: string | number | Date) =>
  new Date(value).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const formatMoney = (value: number) =>
  Number(value ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});

const formatNumber = (value: number) =>
  Number(value ?? 0).toLocaleString(undefined, {maximumFractionDigits: 2});

const formatRichText = (value: string) => escapeHtml(value).replace(/\n/g, '<br>');

const truncateForCover = (value: unknown, maxLen: number) => {
  const s = String(value ?? '');
  return s.length > maxLen ? `${s.slice(0, maxLen - 1).trimEnd()}\u2026` : s;
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

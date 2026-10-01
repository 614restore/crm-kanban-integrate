import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jsPDF } from 'npm:jspdf@4.2.1';

/**
 * Builds the executed document — the one behind "View Full Document" — and
 * hands it back as base64.
 *
 * It exists because the iOS app cannot produce it. jsPDF needs a DOM-ish
 * runtime that React Native does not provide, so the phone used to email its
 * own HTML-rendered proposal instead: six pages of cover, tiers and pricing
 * where the homeowner should get the two-page executed record with both
 * signatures. Web builds the same document client-side from
 * src/lib/fullSignedDocument.ts; this is that builder, running server-side so
 * both platforms send an identical file.
 *
 * Returns the PDF rather than emailing it, so the caller still goes through
 * send-quote-alert for the wording, the recipient rules and the
 * countersigned_copy_sent_at bookkeeping.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

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
const foldDocumentText = (doc: any): void => {
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

const buildFullSignedDocumentPdf = (
  fullQuote: any,
  company: any,
  photos: Array<{ dataUri: string; caption?: string | null }> = [],
): { doc: any; fileName: string } => {
  // Mirrors the wizard's own flags. Inside the builder the quote handed in is
  // always the full record, so its `q` and `fullQuote` are the same object.
  const isInsurance = !!fullQuote?.contingency_enabled;
  const contingencySigned = !!(fullQuote?.contingency_signed_at || fullQuote?.contingency_signature_data);
  const retailSigned = !isInsurance && !!(fullQuote?.signed_at || fullQuote?.signature_data);

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  foldDocumentText(doc);
  const margin = 50;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const custName = `${fullQuote.customer?.first_name ?? ''} ${fullQuote.customer?.last_name ?? ''}`.trim();
  const companyName = company?.name ?? '';
  const cityStateZip = [fullQuote.customer?.city, fullQuote.customer?.state, fullQuote.customer?.zip].filter(Boolean).join(', ');

  const addSigImage = (dataUrl: string, x: number, y: number) => {
    // Format was hardcoded to PNG and a failure was silently swallowed, so a
    // signature stored in any other format — or one from a path this
    // function's author didn't anticipate — would leave a blank space where
    // a legal signature belongs, with nothing in the logs to say why. Read
    // the real format from the data URI, and log instead of going silent.
    const mimeMatch = /^data:image\/(png|jpe?g|webp);base64,/i.exec(dataUrl);
    const format = mimeMatch ? mimeMatch[1].toUpperCase().replace('JPG', 'JPEG') : 'PNG';
    try {
      doc.addImage(dataUrl, format, x, y, 200, 45);
    } catch (err) {
      console.error(`Could not embed a signature image (format ${format}):`, err);
    }
  };

  const ensureSpace = (needed: number): number => {
    if (y + needed > pageH - margin) { doc.addPage(); return margin; }
    return y;
  };

  const drawBanner = () => {
    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, pageW, 58, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(companyName, margin, 24);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const contactLine = [company?.phone, company?.email].filter(Boolean).join('  |  ');
    if (contactLine) doc.text(contactLine, margin, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(fullQuote.quote_number ?? '', pageW - margin, 24, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('QUOTE #', pageW - margin, 38, { align: 'right' });
    doc.setTextColor(40, 40, 40);
  };


  // ── Page 1: Cover / Info ───────────────────────────────────────────────
  drawBanner();
  let y = 78;

  const docTitle = isInsurance
    ? 'Inspection Report & Insurance Contingency Agreement'
    : 'Project Proposal & Customer Agreement';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 58, 95);
  doc.text(docTitle, margin, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  doc.text(`Prepared for: ${custName}`, margin, y);
  if (fullQuote.customer?.address) doc.text(`Address: ${fullQuote.customer.address}${cityStateZip ? ', ' + cityStateZip : ''}`, margin + 230, y);
  y += 12;
  if (fullQuote.customer?.email) doc.text(`Email: ${fullQuote.customer.email}`, margin, y);
  if (fullQuote.customer?.phone) doc.text(`Phone: ${fullQuote.customer.phone}`, margin + 230, y);
  y += 20;

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 14;

  // Project description
  if (fullQuote.project_description || fullQuote.cover_page_title) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 58, 95);
    doc.text('PROJECT DESCRIPTION', margin, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    const desc = fullQuote.cover_page_title
      ? `${fullQuote.cover_page_title}${fullQuote.project_description ? '\n\n' + fullQuote.project_description : ''}`
      : fullQuote.project_description ?? '';
    const descLines = doc.splitTextToSize(desc, pageW - margin * 2);
    doc.text(descLines, margin, y);
    y += descLines.length * 10 + 14;
  }

  // Status summary
  const statuses: string[] = [];
  if (contingencySigned) statuses.push(`Contingency agreement signed by ${fullQuote.contingency_signed_by ?? custName} on ${new Date(fullQuote.contingency_signed_at).toLocaleDateString()}`);
  if (retailSigned) statuses.push(`Quote signed by ${fullQuote.signed_by ?? custName} on ${new Date(fullQuote.signed_at).toLocaleDateString()}`);
  if (fullQuote.contractor_signed_at) statuses.push(`Contractor authorization: ${fullQuote.contractor_signed_by ?? companyName} on ${new Date(fullQuote.contractor_signed_at).toLocaleDateString()}`);
  if (statuses.length > 0) {
    y = ensureSpace(statuses.length * 12 + 24);
    doc.setFillColor(237, 247, 237);
    doc.roundedRect(margin, y, pageW - margin * 2, statuses.length * 12 + 16, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(20, 100, 40);
    doc.text('DOCUMENT STATUS', margin + 8, y + 11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 80, 50);
    statuses.forEach((s, i) => doc.text(`• ${s}`, margin + 8, y + 22 + i * 12));
    y += statuses.length * 12 + 24;
  }

  // ── Photos ─────────────────────────────────────────────────────────────
  //
  // The inspection photos are the evidence the agreement rests on, so they
  // belong ahead of it in the executed copy. This section was a header with
  // nothing beneath it — the executed document carried no photos at all.
  if (photos.length > 0) {
    doc.addPage();
    y = margin;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text('INSPECTION PHOTOS', pageW / 2, y, { align: 'center' });
    y += 22;

    const cols = 2;
    const gap = 12;
    const cellW = (pageW - margin * 2 - gap) / cols;
    const cellH = cellW * 0.75;

    photos.forEach((photo, i) => {
      const col = i % cols;
      if (col === 0 && i > 0) y += cellH + 26;
      if (y + cellH + 26 > pageH - margin) { doc.addPage(); y = margin; }
      const x = margin + col * (cellW + gap);
      try {
        doc.addImage(photo.dataUri, 'JPEG', x, y, cellW, cellH, undefined, 'FAST');
      } catch {
        // One unreadable photo must not take the whole document down.
        doc.setDrawColor(200, 200, 200);
        doc.rect(x, y, cellW, cellH);
      }
      if (photo.caption) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text(String(photo.caption).slice(0, 90), x, y + cellH + 10, { maxWidth: cellW });
      }
    });
    y += cellH + 26;
  }


  // ── Insurance Contingency Agreement pages ──────────────────────────────
  // The three-day right to cancel is required on both insurance and retail
  // sales, so the executed copy always carries it. It used to live inside the
  // insurance branch, which sent retail quotes out without it.
  //
  // Deliberately not gated on include_cancel_notice: that flag decides whether
  // the notice is shown in the *proposal*, and this is the executed record —
  // the copy the homeowner keeps as proof they received the notice.

  const drawCancelNotice = (
    ackSignature: string | null | undefined,
    ackDate: string | null | undefined,
    ackName: string,
  ) => {
    doc.addPage();
    y = margin;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(170, 30, 30);
    doc.text('NOTICE OF THREE (3) DAY RIGHT TO CANCEL', pageW / 2, y, { align: 'center' });
    y += 20;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const cancelDeadline = new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const cancelParas = [
      'You, the buyer, may cancel this transaction at any time prior to midnight of the third business day after the date of this transaction. See the attached notice of cancellation form for an explanation of this right.',
      `To cancel this transaction, mail or deliver a signed and dated copy of this cancellation notice to:\n${companyName}\n${company?.address ?? ''}\n${company?.email ?? ''}`,
      `NOT LATER THAN MIDNIGHT OF: ${cancelDeadline}.`,
      'If you cancel, any property traded in, any payments made by you under the contract or sale, and any negotiable instrument executed by you will be returned within 10 business days following receipt by the seller of your cancellation notice.',
    ];
    for (const para of cancelParas) {
      const lines = doc.splitTextToSize(para, pageW - margin * 2);
      doc.text(lines, margin, y); y += lines.length * 12 + 10;
    }
    y += 8;
    doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(80, 80, 80);
    const ackText = doc.splitTextToSize('By signing below, I acknowledge that I have received a copy of this Notice of Right to Cancel. This signature does NOT constitute cancellation of the contract.', pageW - margin * 2);
    doc.text(ackText, margin, y); y += ackText.length * 11 + 6;
    doc.setFont('helvetica', 'normal');
    if (ackSignature) addSigImage(ackSignature, margin, y);
    doc.setDrawColor(150, 150, 150);
    doc.line(margin, y + 48, margin + 220, y + 48);
    doc.line(margin + 250, y + 48, margin + 430, y + 48);
    doc.setFontSize(8); doc.setTextColor(80, 80, 80);
    doc.text('Signature — Acknowledgment of Receipt', margin, y + 58);
    doc.text('Date', margin + 250, y + 58);
    if (ackDate) doc.text(new Date(ackDate).toLocaleDateString(), margin + 252, y + 48);
    y += 68;
    doc.text(`Acknowledged by: ${ackName}`, margin, y);
  };

  if (isInsurance) {
    doc.addPage();
    y = margin;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text('INSURANCE CONTINGENCY AGREEMENT', pageW / 2, y, { align: 'center' });
    y += 18;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    doc.text(`${companyName}${company?.phone ? '  |  ' + company.phone : ''}`, pageW / 2, y, { align: 'center' });
    y += 14;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 12;
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`Customer: ${custName}`, margin, y);
    doc.text(`Quote #: ${fullQuote.quote_number ?? ''}`, pageW - margin, y, { align: 'right' });
    y += 12;
    if (fullQuote.customer?.address) { doc.text(fullQuote.customer.address, margin, y); y += 10; }
    y += 6;

    const clauses: [string, string][] = [
      ['1. Agreement to Proceed', 'Property Owner authorizes Contractor to proceed with work contingent upon insurance carrier approval and agreement to pay the approved scope.'],
      ['2. Complete Performance', 'Contractor agrees to perform all work in its entirety per industry standards unless mutually agreed upon in writing. No verbal modifications shall be binding.'],
      ['3. Right to Supplement', 'Contractor retains the right to identify and submit supplemental claims for omitted items. All approved supplements are incorporated at no additional out-of-pocket cost beyond the deductible.'],
      ['4. Payment Terms', 'Property Owner agrees to remit all insurance proceeds received — including ACV, recoverable depreciation, and approved supplements — to Contractor per the payment schedule. The deductible is the sole responsibility of the Property Owner.'],
      ['5. Change Orders', 'Any work beyond the insurance-approved scope requires a written change order signed by both parties prior to commencement.'],
      ['6. Homeowner Cooperation', 'Property Owner agrees to cooperate with Contractor and carrier, provide timely property access, and promptly forward all insurance correspondence and payment checks.'],
      ['7. Workmanship Warranty', 'Contractor warrants all labor and installation for one (1) year from substantial completion. Material warranties are per manufacturer terms.'],
      ['8. Cancellation', 'Either party may cancel within three (3) business days of execution without penalty. After the rescission period, cancellation by the Property Owner after work has commenced may result in liability for costs incurred by Contractor up to the date of cancellation.'],
    ];
    doc.setFontSize(7.5);
    for (const [title, text] of clauses) {
      y = ensureSpace(36);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 40);
      doc.text(title, margin, y); y += 9;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(70, 70, 70);
      const lines = doc.splitTextToSize(text, pageW - margin * 2);
      doc.text(lines, margin, y); y += lines.length * 9 + 6;
    }

    // Customer signature block
    y = ensureSpace(80);
    y += 8;
    if (fullQuote.contingency_signature_data) addSigImage(fullQuote.contingency_signature_data, margin, y);
    doc.setDrawColor(150, 150, 150);
    doc.line(margin, y + 48, margin + 220, y + 48);
    doc.line(margin + 250, y + 48, margin + 430, y + 48);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
    doc.text('Customer Signature', margin, y + 58);
    doc.text('Date', margin + 250, y + 58);
    if (fullQuote.contingency_signed_at) doc.text(new Date(fullQuote.contingency_signed_at).toLocaleDateString(), margin + 252, y + 48);
    y += 68;
    doc.setFontSize(8); doc.text(`Signed by: ${fullQuote.contingency_signed_by ?? custName}`, margin, y);
    y += 14;

    drawCancelNotice(
      fullQuote.contingency_cancel_signature_data,
      fullQuote.contingency_signed_at,
      fullQuote.contingency_signed_by ?? custName,
    );
  }

  // ── Retail customer acceptance pages ────────────────────────────────────
  if (!isInsurance && retailSigned) {
    doc.addPage();
    y = margin;
    drawBanner();
    y = 78;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 58, 95);
    doc.text('CUSTOMER ACCEPTANCE', margin, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    const acceptLines = doc.splitTextToSize(
      `By signing below, I, ${custName} ("Customer"), acknowledge that I have reviewed and agreed to the terms of the proposal presented by ${companyName} and authorize the work described therein to proceed.`,
      pageW - margin * 2
    );
    doc.text(acceptLines, margin, y);
    y += acceptLines.length * 12 + 20;

    if (fullQuote.signature_data) addSigImage(fullQuote.signature_data, margin, y);
    doc.setDrawColor(150, 150, 150);
    doc.line(margin, y + 48, margin + 220, y + 48);
    doc.line(margin + 250, y + 48, margin + 430, y + 48);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
    doc.text('Customer Signature', margin, y + 58);
    doc.text('Date', margin + 250, y + 58);
    if (fullQuote.signed_at) doc.text(new Date(fullQuote.signed_at).toLocaleDateString(), margin + 252, y + 48);
    y += 68;
    doc.text(`Signed by: ${fullQuote.signed_by ?? custName}`, margin, y);

    drawCancelNotice(
      fullQuote.cancel_signature_data,
      fullQuote.cancel_signed_at ?? fullQuote.signed_at,
      fullQuote.signed_by ?? custName,
    );
  }

  // ── Contractor Authorization ─────────────────────────────────────────────
  if (fullQuote.contractor_signed_at) {
    doc.addPage();
    y = margin;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text('CONTRACTOR AUTHORIZATION', pageW / 2, y, { align: 'center' });
    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    const authLines = doc.splitTextToSize(
      `I, ${fullQuote.contractor_signed_by ?? companyName}, on behalf of ${companyName}, hereby accept and authorize this project for ${custName}. By signing below, I confirm that ${companyName} agrees to perform the work as described in ${fullQuote.quote_number ?? 'this document'} in a professional manner in accordance with industry standards and applicable codes.`,
      pageW - margin * 2
    );
    doc.text(authLines, margin, y);
    y += authLines.length * 12 + 24;

    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 20;

    if (fullQuote.contractor_signature_data) addSigImage(fullQuote.contractor_signature_data, margin, y);
    doc.setDrawColor(150, 150, 150);
    doc.line(margin, y + 48, margin + 220, y + 48);
    doc.line(margin + 250, y + 48, margin + 430, y + 48);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
    doc.text('Contractor Signature', margin, y + 58);
    doc.text('Date', margin + 250, y + 58);
    if (fullQuote.contractor_signed_at) doc.text(new Date(fullQuote.contractor_signed_at).toLocaleDateString(), margin + 252, y + 48);
    y += 68;
    doc.text(`${fullQuote.contractor_signed_by ?? ''}`, margin, y);
    y += 11;
    doc.text(companyName, margin, y);
    y += 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 120, 60);
    doc.text('✓  Document Fully Executed — Both Parties Have Signed', margin, y);
  }

  const fileName = `${fullQuote.quote_number ?? 'Document'}_${custName.replace(/\s+/g, '_')}_Signed.pdf`;

  return { doc, fileName };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { quote_id, include_photos } = await req.json();
    if (!quote_id) {
      return new Response(JSON.stringify({ error: 'Missing quote_id' }), { status: 400, headers: corsHeaders });
    }
    // Default true for backward compatibility with callers that don't send this field.
    const shouldIncludePhotos = include_photos !== false;

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // A call bearing the service role key is another edge function, not a
    // person — send-quote-alert asks for this document when a quote has been
    // countersigned automatically and there is no rep in the request to
    // authenticate. Membership is checked below for human callers only.
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const isInternalCall = serviceRoleKey !== '' && token === serviceRoleKey;

    let authUser: { id: string } | null = null;
    if (!isInternalCall) {
      // Who is asking. The service role bypasses RLS below, so membership is
      // checked here rather than assumed.
      const { data: userData } = await admin.auth.getUser(token);
      authUser = userData?.user ?? null;
      if (!authUser) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
    }

    const { data: quote, error: quoteErr } = await admin
      .from('quotes')
      .select('*, customer:customers(id, first_name, last_name, email, phone, address, city, state, zip)')
      .eq('id', quote_id)
      .single();

    if (quoteErr || !quote) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), { status: 404, headers: corsHeaders });
    }

    if (!isInternalCall) {
      const { data: membership } = await admin
        .from('team_members')
        .select('id')
        .eq('company_id', quote.company_id)
        .eq('user_id', authUser!.id)
        .eq('is_active', true)
        .limit(1);

      if (!membership || membership.length === 0) {
        return new Response(JSON.stringify({ error: 'Not a member of this company' }), { status: 403, headers: corsHeaders });
      }
    }

    const { data: company } = await admin
      .from('companies')
      .select('*')
      .eq('id', quote.company_id)
      .single();

    // Fetch the inspection photos so the executed copy carries the evidence the
    // agreement rests on. Capped, and each fetch is allowed to fail on its own:
    // a photo that will not load must not cost the homeowner their document.
    // Skipped entirely when the caller opts out via include_photos: false.
    const photos: Array<{ dataUri: string; caption?: string | null }> = [];
    if (shouldIncludePhotos) {
      const { data: photoRows } = await admin
        .from('quote_photos')
        .select('photo_url, caption')
        .eq('quote_id', quote_id)
        .order('sort_order');

      const MAX_PHOTOS = 24;
      for (const row of (photoRows ?? []).slice(0, MAX_PHOTOS)) {
        if (!row.photo_url) continue;
        try {
          const res = await fetch(row.photo_url, { signal: AbortSignal.timeout(10000) });
          if (!res.ok) continue;
          const bytes = new Uint8Array(await res.arrayBuffer());
          let binary = '';
          for (let i = 0; i < bytes.length; i += 8192) {
            binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          }
          const mime = res.headers.get('content-type') || 'image/jpeg';
          photos.push({ dataUri: `data:${mime};base64,${btoa(binary)}`, caption: row.caption });
        } catch (photoErr) {
          console.warn('Skipped a photo in the executed document:', photoErr);
        }
      }
    }

    const { doc, fileName } = buildFullSignedDocumentPdf(quote, company ?? {}, photos);
    // 'datauristring' keeps this identical to the web path, which base64s the
    // same way before handing the file to send-quote-alert.
    const pdfBase64 = String(doc.output('datauristring')).split(',')[1];

    return new Response(
      JSON.stringify({ pdf_base64: pdfBase64, filename: fileName }),
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('executed-document error:', message);
    return new Response(JSON.stringify({ error: 'Could not build the document', details: message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

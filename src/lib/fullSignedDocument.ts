// Copied from QuoteMGR src/lib/fullSignedDocument.ts (read-only reference).
import jsPDF from 'jspdf';
import { supabase } from '@/lib/supabase';
import { foldDocumentText } from './pdfGenerator';

// The document behind "View Full Document": project details, document status and
// both signatures, without the proposal's cover, pricing tiers or marketing
// pages. Extracted from DocumentsWizard so the countersign flows can email the
// homeowner exactly what that button produces.
export const buildFullSignedDocumentPdf = async (
  fullQuote: any,
  company: any,
  certPhotos: Array<{ photo_url: string; caption?: string | null }> = [],
  options: { includePhotos?: boolean } = {},
): Promise<{ doc: jsPDF; fileName: string }> => {
  // Photos default to on, so existing callers are unchanged. The Documents hub
  // passes false when the user unticks "Include photos".
  const includePhotos = options.includePhotos !== false;

  // Mirrors the wizard's own flags. Inside the builder the quote handed in is
  // always the full record, so its `q` and `fullQuote` are the same object.
  const isInsurance = !!fullQuote?.contingency_enabled;
  const contingencySigned = !!(fullQuote?.contingency_signed_at || fullQuote?.contingency_signature_data);
  const retailSigned = !isInsurance && !!(fullQuote?.signed_at || fullQuote?.signature_data);
  const certificateSigned = !!fullQuote?.certificate_customer_signed_at;

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  foldDocumentText(doc);
  const margin = 50;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const custName = `${fullQuote.customer?.first_name ?? ''} ${fullQuote.customer?.last_name ?? ''}`.trim();
  const companyName = company?.name ?? '';
  const cityStateZip = [fullQuote.customer?.city, fullQuote.customer?.state, fullQuote.customer?.zip].filter(Boolean).join(', ');

  const addSigImage = (dataUrl: string, x: number, y: number) => {
    try { doc.addImage(dataUrl, 'PNG', x, y, 200, 45); } catch { /* skip */ }
  };

  const ensureSpace = (needed: number): number => {
    if (y + needed > pageH - margin) { doc.addPage(); return margin; }
    return y;
  };

  /**
   * Starts a signature-block section (heading + short text + signature
   * line) — Customer Acceptance, the 3-day cancel notice, and Contractor
   * Authorization each used to force their own page with doc.addPage(),
   * even though every one of them is short. Now they flow onto whatever
   * page has room, only breaking when a section genuinely wouldn't fit, and
   * a small gap keeps a heading that lands mid-page from sitting flush
   * against the previous section's signature line.
   */
  const startSection = (estimatedHeight: number) => {
    if (y + estimatedHeight > pageH - margin) {
      doc.addPage();
      y = margin;
    } else if (y > margin) {
      y += 18;
    }
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

  const loadBase64 = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return new Promise(resolve => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.onerror = () => resolve(null);
        r.readAsDataURL(blob);
      });
    } catch { return null; }
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
  if (includePhotos && certPhotos.length > 0) {
    const photoB64s = await Promise.all(certPhotos.map(p => loadBase64(p.photo_url)));
    const loaded = certPhotos.map((p, i) => ({ ...p, b64: photoB64s[i] })).filter(p => p.b64);

    if (loaded.length > 0) {
      y = ensureSpace(40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 58, 95);
      doc.text('PROJECT PHOTOS', margin, y);
      y += 14;

      const colW = (pageW - margin * 2 - 12) / 2;
      const imgH = colW * 0.62;

      for (let i = 0; i < loaded.length; i += 2) {
        y = ensureSpace(imgH + 28);
        const l = loaded[i];
        const r = loaded[i + 1];
        try { doc.addImage(l.b64!, 'JPEG', margin, y, colW, imgH); } catch { try { doc.addImage(l.b64!, 'PNG', margin, y, colW, imgH); } catch { /* skip */ } }
        if (l.caption) { doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(110, 110, 110); doc.text(l.caption, margin, y + imgH + 9); }
        if (r) {
          try { doc.addImage(r.b64!, 'JPEG', margin + colW + 12, y, colW, imgH); } catch { try { doc.addImage(r.b64!, 'PNG', margin + colW + 12, y, colW, imgH); } catch { /* skip */ } }
          if (r.caption) { doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(110, 110, 110); doc.text(r.caption, margin + colW + 12, y + imgH + 9); }
        }
        y += imgH + 22;
      }
    }
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
    // Was an unconditional doc.addPage() — the notice is short (a heading,
    // four short paragraphs, and a compact signature line), so it almost
    // always fits under whatever signature block preceded it. The estimate
    // is generous on purpose so a long company name/address never overlaps
    // the next section rather than trimming a page too aggressively.
    startSection(320);
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

  // ── Completion Certificate ───────────────────────────────────────────────
  // Only when the customer actually signed it. The certificate is a separate
  // document from the agreement with its own signature column, so this section
  // is gated on certificate_customer_signed_at rather than on the quote's
  // status — signing one has never implied signing the other.
  if (certificateSigned) {
    doc.addPage();
    y = margin;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text('CERTIFICATE OF COMPLETION', pageW / 2, y, { align: 'center' });
    y += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    const completionDate = fullQuote.contractor_signed_at ?? fullQuote.certificate_customer_signed_at;
    doc.text(
      `Prepared for ${custName}${completionDate ? `  ·  Completion Date: ${new Date(completionDate).toLocaleDateString()}` : ''}`,
      pageW / 2, y, { align: 'center' },
    );
    y += 22;

    const bulletList = (heading: string, items: string[]) => {
      y = ensureSpace(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 58, 95);
      doc.text(heading, margin, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(60, 60, 60);
      items.forEach(item => {
        const lines = doc.splitTextToSize(`•  ${item}`, pageW - margin * 2 - 10);
        y = ensureSpace(lines.length * 11 + 6);
        doc.text(lines, margin + 6, y);
        y += lines.length * 11 + 5;
      });
      y += 8;
    };

    bulletList(`${companyName} hereby certifies that:`, [
      'All work specified in the Customer Service Agreement has been completed in accordance with its terms and conditions.',
      'All work has been performed in a workmanlike manner and in accordance with applicable industry standards and building codes.',
      'All materials used in the performance of the work are of good quality and suitable for their intended purpose.',
      'The work site has been cleaned and left in a safe and orderly condition.',
      'All required permits and inspections have been obtained and completed.',
    ]);

    bulletList(`By signing below, ${custName} acknowledges that:`, [
      'All work described in the Customer Service Agreement has been completed to my satisfaction.',
      'I have inspected the completed work and found it to be satisfactory.',
      'I have no outstanding complaints or concerns regarding the quality of work performed.',
      'I understand that by signing this Certificate, I release the Contractor from further obligations, except as provided in the warranty section of the original agreement.',
    ]);

    // Signature blocks — customer on the left, contractor on the right.
    y = ensureSpace(96);
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 20;

    const colX = margin + 250;
    if (fullQuote.certificate_customer_signature_data) {
      addSigImage(fullQuote.certificate_customer_signature_data, margin, y);
    }
    if (fullQuote.contractor_signature_data) {
      addSigImage(fullQuote.contractor_signature_data, colX, y);
    }

    doc.setDrawColor(150, 150, 150);
    doc.line(margin, y + 48, margin + 220, y + 48);
    doc.line(colX, y + 48, colX + 180, y + 48);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('Customer Signature', margin, y + 58);
    doc.text('Contractor Signature', colX, y + 58);
    y += 70;

    doc.text(custName, margin, y);
    doc.text(String(fullQuote.contractor_signed_by ?? companyName), colX, y);
    y += 11;
    doc.setTextColor(120, 120, 120);
    doc.text(new Date(fullQuote.certificate_customer_signed_at).toLocaleDateString(), margin, y);
    if (fullQuote.contractor_signed_at) {
      doc.text(new Date(fullQuote.contractor_signed_at).toLocaleDateString(), colX, y);
    }
  }

  // ── Contractor Authorization ─────────────────────────────────────────────
  if (fullQuote.contractor_signed_at) {
    // Same reasoning as drawCancelNotice: this is short enough to usually
    // follow the cancel notice (or, if there's no cancel notice on this
    // quote, the Customer Acceptance block) on the same page rather than
    // forcing a third page for what amounts to one more paragraph and one
    // more signature line.
    startSection(260);

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

    // "Both parties have signed" must actually mean both. This used to render
    // off contractor_signed_at alone, so a document the customer never signed
    // still claimed to be fully executed — and this PDF is emailed to the
    // homeowner by sendFullSignedDocumentToCustomer.
    //
    // Any digitally captured customer signature counts, including the
    // certificate's: a job can have its contingency signed on paper and its
    // completion certificate signed in the app, and that customer has plainly
    // signed. When none is on file the wording stays neutral rather than
    // asserting the customer never signed — they may well have done so on paper,
    // which this document simply cannot attest to.
    const customerHasSigned = contingencySigned || retailSigned || certificateSigned;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    if (customerHasSigned) {
      doc.setTextColor(20, 120, 60);
      doc.text('✓  Document Fully Executed — Both Parties Have Signed', margin, y);
    } else {
      doc.setTextColor(146, 64, 14);
      doc.text('Contractor signed — no customer signature captured in the app', margin, y);
    }
  }

  const fileName = `${fullQuote.quote_number ?? 'Document'}_${custName.replace(/\s+/g, '_')}_Signed.pdf`;

  return { doc, fileName };
};

// Reloads the quote so a caller holding a partial row — the dashboard list, for
// instance — still produces a complete document. Returns false when there is
// nobody to send it to.
export const sendFullSignedDocumentToCustomer = async (
  quoteId: string,
  company: any,
  opts: { resend?: boolean } = {},
): Promise<boolean> => {
  const { data: fullQuote } = await supabase
    .from('quotes')
    .select('*, customer:customers(id, first_name, last_name, email, phone, address, city, state, zip)')
    .eq('id', quoteId)
    .single();

  if (!fullQuote?.customer?.email || !fullQuote?.share_token) return false;

  // No photos: the homeowner is being sent the executed record, not the
  // proposal's photo documentation.
  const { doc, fileName } = await buildFullSignedDocumentPdf(fullQuote, company);
  const base64 = doc.output('datauristring').split(',')[1];

  const { error } = await supabase.functions.invoke('send-quote-alert', {
    body: {
      share_token: fullQuote.share_token,
      event_type: 'countersigned',
      signed_pdf_base64: base64,
      signed_pdf_filename: fileName,
      // send-quote-alert sends the executed copy at most once per quote, so
      // the automatic countersign paths cannot double-email the homeowner.
      // A deliberate re-send opts back in.
      resend: opts.resend === true,
    },
  });
  if (error) throw error;
  return true;
};

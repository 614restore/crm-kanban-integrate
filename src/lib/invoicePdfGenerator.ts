// Copied from QuoteMGR src/lib/invoicePdfGenerator.ts (read-only reference).
// Replaces TrussCTR's unused html2pdf generator. TrussCTR change: a local
// InvoiceCompany type instead of QuoteMGR's Company.
import jsPDF from 'jspdf';
import { foldDocumentText } from './pdfGenerator';
import autoTable from 'jspdf-autotable';
/** The company fields the invoice PDF prints. QuoteMGR passes its whole Company row. */
export interface InvoiceCompany {
  id?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  website?: string | null;
  license_number?: string | null;
  logo_url?: string | null;
}

export interface PaymentRecord {
  date: string;
  description: string;
  amount: number;
  type: 'received' | 'scheduled' | 'credit';
}

export interface InvoicePdfData {
  id: string;
  invoice_number: string;
  status: string;
  issued_date: string;
  due_date: string;
  paid_at?: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  deposit_paid?: number | null;
  project_description?: string | null;
  payment_records?: PaymentRecord[] | null;
  notes?: string | null;
  payment_instructions?: string | null;
  customer?: {
    first_name: string;
    last_name: string;
    email?: string | null;
    address?: string | null;
  } | null;
}

export interface LineItemPdfData {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  is_additional?: boolean; // true = change order not included in invoice.total
  display_only?: boolean;  // true = informational only, no price impact
}

async function fetchLogoDataUri(
  url: string,
): Promise<{ dataUri: string; naturalW: number; naturalH: number } | null> {
  try {
    const resp = await fetch(url, { mode: 'cors' });
    if (!resp.ok) return null;
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
    const maxDim = 400;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight, 1));
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);

    return {
      dataUri: canvas.toDataURL('image/png'),
      naturalW: img.naturalWidth,
      naturalH: img.naturalHeight,
    };
  } catch {
    return null;
  }
}

export async function generateInvoicePdf(
  invoice: InvoicePdfData,
  company: InvoiceCompany,
  lineItems: LineItemPdfData[],
  mode: 'invoice' | 'receipt' = 'invoice',
  action: 'download' | 'preview' = 'download',
): Promise<void> {
  // Letter, not A4: these are printed by US contractors and homeowners on
  // 8.5x11. An A4 page forced onto Letter is scaled to fit, which is what made
  // documents come out slightly small.
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  foldDocumentText(doc);
  // Read the width from the document rather than restating it. It was 210 (A4)
  // while the page is Letter, so the header band drawn to pageW stopped ~6mm
  // short of the right edge and every centred element sat left of true centre.
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  const rightX = pageW - margin;

  const fmt$ = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const navy: [number, number, number] = [30, 58, 95];
  const green: [number, number, number] = [22, 163, 74];
  const white: [number, number, number] = [255, 255, 255];
  const slate: [number, number, number] = [100, 116, 139];
  const dark: [number, number, number] = [30, 41, 59];
  const softWhite: [number, number, number] = [210, 224, 240];

  // ─── Header bar ───────────────────────────────────────────────────────────
  const headerH = 50;
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageW, headerH, 'F');

  // Logo (left side)
  const co = company as any;
  let logoAreaW = 0;
  if (co.logo_url) {
    const logo = await fetchLogoDataUri(co.logo_url);
    if (logo) {
      // Scale to fit 44mm wide × 40mm tall box, preserving aspect ratio
      const pxPerMm = 96 / 25.4; // 96 DPI assumed
      const natWmm = logo.naturalW / pxPerMm;
      const natHmm = logo.naturalH / pxPerMm;
      const maxW = 44;
      const maxH = 40;
      const s = Math.min(maxW / natWmm, maxH / natHmm, 1);
      const w = natWmm * s;
      const h = natHmm * s;
      const logoX = margin;
      const logoY = (headerH - h) / 2;
      try {
        doc.addImage(logo.dataUri, 'PNG', logoX, logoY, w, h);
        logoAreaW = w + 6; // gap after logo
      } catch {
        // fall through to text-only
      }
    }
  }

  // Company info (right-aligned in header, white text)
  doc.setTextColor(...white);
  let infoY = 12;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(co.name || '', rightX, infoY, { align: 'right' });
  infoY += 7;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...softWhite);

  const addrLine = [
    co.address,
    [co.city, co.state].filter(Boolean).join(', '),
    co.zip,
  ]
    .filter(Boolean)
    .join('  ');
  if (addrLine) {
    doc.text(addrLine, rightX, infoY, { align: 'right' });
    infoY += 5;
  }

  const phoneEmail = [co.phone, co.email].filter(Boolean).join('   |   ');
  if (phoneEmail) {
    doc.text(phoneEmail, rightX, infoY, { align: 'right' });
    infoY += 5;
  }
  if (co.website) {
    doc.text(co.website, rightX, infoY, { align: 'right' });
    infoY += 5;
  }
  if (co.license_number) {
    doc.text(`License #${co.license_number}`, rightX, infoY, { align: 'right' });
  }

  // If no logo, show company name large on the left too
  if (!logoAreaW) {
    doc.setTextColor(...white);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text(co.name || '', margin, 24);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...softWhite);
    doc.text(phoneEmail || co.email || '', margin, 32);
  }

  // ─── Document type block ──────────────────────────────────────────────────
  let y = headerH + 12;

  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...navy);
  doc.text(mode === 'receipt' ? 'RECEIPT' : 'INVOICE', margin, y);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...slate);
  doc.text(`#${invoice.invoice_number}`, margin, y + 7);

  // PAID IN FULL badge or status label (right side)
  if (mode === 'receipt') {
    doc.setFillColor(...green);
    doc.roundedRect(rightX - 52, y - 9, 54, 14, 2, 2, 'F');
    doc.setTextColor(...white);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PAID IN FULL', rightX - 25, y + 0.5, { align: 'center' });
  } else {
    const statusLabel =
      invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1);
    doc.setTextColor(...slate);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(statusLabel, rightX, y, { align: 'right' });
  }

  // Dates
  y += 17;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...slate);
  doc.text('ISSUED', margin, y);
  const duePaidLabel =
    mode === 'receipt' && invoice.paid_at ? 'DATE PAID' : 'DUE DATE';
  doc.text(duePaidLabel, pageW / 2, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...dark);
  doc.text(fmtDate(invoice.issued_date), margin, y);
  const duePaidDate =
    mode === 'receipt' && invoice.paid_at
      ? fmtDate(invoice.paid_at)
      : fmtDate(invoice.due_date);
  doc.text(duePaidDate, pageW / 2, y);

  // ─── Bill To ──────────────────────────────────────────────────────────────
  if (invoice.customer) {
    y += 13;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...slate);
    doc.text('BILL TO', margin, y);
    y += 5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text(
      `${invoice.customer.first_name} ${invoice.customer.last_name}`,
      margin,
      y,
    );
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...slate);
    if (invoice.customer.email) {
      doc.text(invoice.customer.email, margin, y);
      y += 5;
    }
    if (invoice.customer.address) {
      doc.text(invoice.customer.address, margin, y);
      y += 5;
    }
  }

  // Thin separator
  y += 5;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, y, rightX, y);
  y += 8;

  // ─── Line items ───────────────────────────────────────────────────────────
  // is_additional=true items are approved change orders added on top of invoice.total.
  // is_additional=false (or unset) items are scope items included in invoice.subtotal.
  const baseItems = lineItems.filter(item => !item.is_additional);
  const changeOrderItems = lineItems.filter(item => item.is_additional && !item.display_only);

  const baseSum = baseItems.reduce((s, item) => s + (item.total ?? 0), 0);
  const changeOrderSum = changeOrderItems.reduce((s, item) => s + (item.total ?? 0), 0);

  // effectiveTotal = stored invoice total + any change orders not yet in the DB total field
  const effectiveTotal = invoice.total + changeOrderSum;

  // Project base = the tier amount not broken out as individual scope rows
  const projectBase = invoice.subtotal - baseSum;

  const tableRows: [string, string, string, string][] = [];
  if (projectBase > 0.01) {
    tableRows.push([
      invoice.project_description || 'Project',
      '1',
      fmt$(projectBase),
      fmt$(projectBase),
    ]);
  }
  baseItems.forEach(item => {
    tableRows.push([
      item.description || '',
      String(item.quantity ?? 1),
      fmt$(item.unit_price ?? 0),
      fmt$(item.total ?? 0),
    ]);
  });

  if (tableRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Description', 'Qty', 'Unit Price', 'Amount']],
      body: tableRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 4, textColor: [30, 41, 59] },
      headStyles: {
        fillColor: navy,
        fontSize: 8,
        fontStyle: 'bold',
        textColor: white,
        cellPadding: 5,
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'center', cellWidth: 16 },
        2: { halign: 'right', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 28 },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ─── Approved Change Orders ───────────────────────────────────────────────
  if (changeOrderItems.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...slate);
    doc.text('APPROVED CHANGE ORDERS', margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Description', 'Qty', 'Unit Price', 'Amount']],
      body: changeOrderItems.map(item => [
        item.description || '',
        String(item.quantity ?? 1),
        fmt$(item.unit_price ?? 0),
        fmt$(item.total ?? 0),
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 4, textColor: [30, 41, 59] },
      headStyles: {
        fillColor: green,
        fontSize: 8,
        fontStyle: 'bold',
        textColor: white,
        cellPadding: 5,
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'center', cellWidth: 16 },
        2: { halign: 'right', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 28 },
      },
      alternateRowStyles: { fillColor: [240, 253, 244] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ─── Totals ───────────────────────────────────────────────────────────────
  const col1 = rightX - 72;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...slate);
  doc.text('Subtotal', col1, y);
  doc.setTextColor(...dark);
  doc.text(fmt$(invoice.subtotal), rightX, y, { align: 'right' });
  y += 7;

  if (changeOrderSum > 0) {
    doc.setTextColor(...slate);
    doc.text('Approved Change Orders', col1, y);
    doc.setTextColor(...green);
    doc.text(`+${fmt$(changeOrderSum)}`, rightX, y, { align: 'right' });
    y += 7;
  }

  if (invoice.tax_rate > 0) {
    doc.setTextColor(...slate);
    doc.text(`Tax (${invoice.tax_rate}%)`, col1, y);
    doc.setTextColor(...dark);
    doc.text(fmt$(invoice.tax_amount), rightX, y, { align: 'right' });
    y += 7;
  }

  // Total bar — uses effectiveTotal (stored total + change orders)
  doc.setFillColor(...navy);
  doc.roundedRect(margin, y, pageW - margin * 2, 13, 2, 2, 'F');
  doc.setTextColor(...white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Invoice Total', margin + 5, y + 9);
  doc.text(fmt$(effectiveTotal), rightX - 5, y + 9, { align: 'right' });
  y += 19;

  // ─── Payments & Balance ───────────────────────────────────────────────────
  const receivedPayments = (invoice.payment_records || []).filter(
    r => r.type === 'received' || r.type === 'credit',
  );

  // Build the rows to display in the payments table
  let paymentRows: [string, string, string][] = [];
  if (receivedPayments.length > 0) {
    paymentRows = receivedPayments.map(r => [
      fmtDate(r.date),
      r.description || 'Payment',
      fmt$(r.amount),
    ]);
    if (mode === 'receipt') {
      // On a receipt, fill any gap between recorded payments and the effective total
      const recordedTotal = receivedPayments.reduce((s, r) => s + r.amount, 0);
      const gap = effectiveTotal - recordedTotal;
      if (gap > 0.01) {
        const finalDate = invoice.paid_at ? fmtDate(invoice.paid_at) : fmtDate(invoice.issued_date);
        paymentRows.push([finalDate, 'Final Payment', fmt$(gap)]);
      }
    }
  } else if (mode === 'receipt') {
    // Receipt with no records: single row using paid_at date
    const dateStr = invoice.paid_at ? fmtDate(invoice.paid_at) : fmtDate(invoice.issued_date);
    paymentRows = [[dateStr, 'Payment in Full', fmt$(effectiveTotal)]];
  }

  // totalPaid = sum of all displayed rows (always effectiveTotal for receipts)
  const totalPaid = mode === 'receipt'
    ? effectiveTotal
    : paymentRows.length > 0
      ? paymentRows.reduce((s, r) => s + (parseFloat(r[2].replace(/[^0-9.-]/g, '')) || 0), 0)
      : invoice.deposit_paid || 0;
  const balanceDue = mode === 'receipt' ? 0 : Math.max(0, effectiveTotal - totalPaid);

  if (paymentRows.length > 0) {
    // Section label
    y += 2;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...slate);
    doc.text('PAYMENTS RECEIVED', margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Description', 'Amount']],
      body: paymentRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 3, textColor: [30, 41, 59] },
      headStyles: {
        fillColor: [100, 116, 139],
        fontSize: 8,
        fontStyle: 'bold',
        textColor: white,
        cellPadding: 4,
      },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 'auto' },
        2: { halign: 'right', cellWidth: 30 },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y = (doc as any).lastAutoTable.finalY + 5;

    // Total paid row (green)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...slate);
    doc.text('Total Paid', col1, y);
    doc.setTextColor(...green);
    doc.text(fmt$(totalPaid), rightX, y, { align: 'right' });
    y += 7;
  } else if (invoice.deposit_paid && invoice.deposit_paid > 0 && mode === 'invoice') {
    // Invoice with only deposit_paid (no detailed records)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...slate);
    const paidLabel = invoice.paid_at
      ? `Payment Received (${fmtDate(invoice.paid_at)})`
      : 'Payment Received';
    doc.text(paidLabel, col1, y);
    doc.setTextColor(...green);
    doc.text(fmt$(invoice.deposit_paid), rightX, y, { align: 'right' });
    y += 7;
  }

  if (paymentRows.length > 0 || (invoice.deposit_paid && invoice.deposit_paid > 0) || mode === 'receipt') {
    // Balance Due
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...slate);
    doc.text('Balance Due', col1, y);
    if (balanceDue === 0) {
      doc.setTextColor(...green);
    } else {
      doc.setTextColor(220, 38, 38);
    }
    doc.text(fmt$(balanceDue), rightX, y, { align: 'right' });
    y += 7;
  }

  // Receipt confirmation box
  if (mode === 'receipt') {
    y += 8;
    const paidDate = invoice.paid_at ? fmtDate(invoice.paid_at) : fmtDate(invoice.issued_date);
    const boxH = 26;
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(...green);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, pageW - margin * 2, boxH, 2, 2, 'FD');
    doc.setTextColor(...green);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('PAID IN FULL', pageW / 2, y + 9, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
      `Payment of ${fmt$(effectiveTotal)} received on ${paidDate} - Thank you for your business!`,
      pageW / 2,
      y + 18,
      { align: 'center' },
    );
    y += boxH + 6;
  }

  // Notes
  if (invoice.notes) {
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...slate);
    doc.text('NOTES', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...dark);
    const noteLines = doc.splitTextToSize(invoice.notes, pageW - margin * 2);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 5 + 4;
  }

  // Payment instructions (invoice only)
  if (mode === 'invoice' && invoice.payment_instructions) {
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...slate);
    doc.text('PAYMENT INSTRUCTIONS', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...dark);
    const piLines = doc.splitTextToSize(
      invoice.payment_instructions,
      pageW - margin * 2,
    );
    doc.text(piLines, margin, y);
  }

  const filename =
    mode === 'receipt'
      ? `Receipt-${invoice.invoice_number}.pdf`
      : `Invoice-${invoice.invoice_number}.pdf`;

  if (action === 'preview') {
    const url = String(doc.output('bloburl'));
    window.open(url, '_blank');
  } else {
    doc.save(filename);
  }
}

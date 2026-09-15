// Copied unchanged from QuoteMGR src/lib/buildInvoicePDF.ts (read-only reference).
import jsPDF from 'jspdf';
import { foldDocumentText } from './pdfGenerator';
import autoTable from 'jspdf-autotable';

export interface InvoiceLineItemPDF {
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
    display_only?: boolean;
}

export interface PaymentRecordPDF {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: 'received' | 'scheduled' | 'credit';
}

export interface BuildInvoicePDFParams {
    invoice: {
        invoice_number: string;
        issued_date: string;
        tax_rate: number;
        tax_amount: number;
        total: number;
        subtotal: number;
        notes?: string | null;
        payment_instructions?: string | null;
        deposit_required?: number | null;
        deposit_paid?: number | null;
        project_start_date?: string | null;
        project_completion_date?: string | null;
    };
    company: {
        name: string;
        email?: string | null;
        phone?: string | null;
        address?: string | null;
        logo_url?: string | null;
    };
    customerName: string;
    customerEmail: string;
    customerAddress: string;
    lineItems: InvoiceLineItemPDF[];
    additionalItems: InvoiceLineItemPDF[];
    includeAddonsInTotal: boolean;
    showLineItems?: boolean;
    hideItemPrices?: boolean;
    headerStyle?: 'slim' | 'bold' | 'clean' | 'branded';
    bannerColor?: string;
    headerCustomText?: string;
    logoData?: string | null;
    currentTier?: 'good' | 'better' | 'best';
    goodTierName?: string;
    betterTierName?: string;
    bestTierName?: string;
    displaySubtotal: number;
    displayTaxAmount: number;
    displayTotal: number;
    paymentRecords?: PaymentRecordPDF[];
}

export async function loadLogoAsBase64(url: string): Promise<string | null> {
    try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        return new Promise(resolve => {
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) { ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL('image/png')); }
                else resolve(null);
            };
            img.onerror = () => resolve(null);
            img.src = url;
        });
    } catch { return null; }
}

const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const pdfSafe = (str: string): string =>
    str
        .replace(/[''ʼ]/g, "'")
        .replace(/[""]/g, '"')
        .replace(/—/g, ' - ')
        .replace(/–/g, '-')
        .replace(/…/g, '...')
        .replace(/½/g, '1/2')
        .replace(/¼/g, '1/4')
        .replace(/¾/g, '3/4')
        // eslint-disable-next-line no-control-regex -- keep only Latin-1, which the PDF font can draw
        .replace(/[^\x00-\xFF]/g, '');

const hexToRgb = (hex: string): [number, number, number] => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

export function buildInvoicePDF(params: BuildInvoicePDFParams): jsPDF {
    const {
        invoice,
        company,
        customerName,
        customerEmail,
        customerAddress,
        lineItems,
        additionalItems,
        includeAddonsInTotal,
        showLineItems = true,
        hideItemPrices = false,
        headerStyle = 'slim',
        bannerColor = '#111111',
        headerCustomText = '',
        logoData = null,
        currentTier = 'good',
        goodTierName = 'Good',
        betterTierName = 'Better',
        bestTierName = 'Best',
        displaySubtotal,
        displayTaxAmount,
        displayTotal,
        paymentRecords = [],
    } = params;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    foldDocumentText(doc);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentW = pageW - margin * 2;
    const BLACK: [number, number, number] = [0, 0, 0];
    const DARK: [number, number, number] = [17, 24, 39];
    const RED: [number, number, number] = [220, 38, 38];
    const GREEN: [number, number, number] = [5, 150, 105];
    const GRAY: [number, number, number] = [100, 110, 130];
    const LGRAY: [number, number, number] = [200, 205, 215];

    const accentRGB = hexToRgb(bannerColor);
    const headerDisplayText = pdfSafe(headerCustomText.trim() || company.name);

    const placeLogoOrText = (
        cx: number, cy: number, mW: number, mH: number,
        textColor: [number, number, number], fontSize: number,
        centerX: number, centerY: number, textAlign: 'center' | 'left' = 'center'
    ) => {
        if (logoData) {
            try {
                const tmpImg = new Image();
                tmpImg.src = logoData;
                const ratio = tmpImg.naturalWidth > 0 ? tmpImg.naturalWidth / tmpImg.naturalHeight : 1;
                let lw = mW; let lh = lw / ratio;
                if (lh > mH) { lh = mH; lw = lh * ratio; }
                doc.addImage(logoData, 'PNG', cx + (mW - lw) / 2, cy + (mH - lh) / 2, lw, lh);
            } catch { /* fall through */ }
        } else {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(fontSize);
            doc.setTextColor(...textColor);
            doc.text(headerDisplayText, centerX, centerY, { align: textAlign });
        }
    };

    let headerH: number;
    switch (headerStyle) {
        case 'bold': {
            headerH = 88;
            doc.setFillColor(...accentRGB);
            doc.rect(0, 0, pageW, headerH, 'F');
            doc.setFillColor(...RED);
            doc.rect(0, headerH - 5, pageW, 5, 'F');
            placeLogoOrText((pageW - 110) / 2, 8, 110, 68, [255, 255, 255], 26, pageW / 2, headerH / 2 + 3);
            break;
        }
        case 'clean': {
            headerH = 44;
            doc.setFillColor(...accentRGB);
            doc.rect(0, 0, 5, headerH, 'F');
            doc.setDrawColor(...accentRGB);
            doc.setLineWidth(0.8);
            doc.line(0, headerH, pageW, headerH);
            if (logoData) {
                const maxW = 55; const maxH = 32;
                try {
                    const tmpImg = new Image();
                    tmpImg.src = logoData;
                    const ratio = tmpImg.naturalWidth > 0 ? tmpImg.naturalWidth / tmpImg.naturalHeight : 1;
                    let lw = maxW; let lh = lw / ratio;
                    if (lh > maxH) { lh = maxH; lw = lh * ratio; }
                    doc.addImage(logoData, 'PNG', 11, (headerH - lh) / 2, lw, lh);
                } catch { /* fall through */ }
            } else {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.setTextColor(...accentRGB);
                doc.text(headerDisplayText, 11, headerH / 2 + 3);
            }
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(...GRAY);
            let ciY = 11;
            if (company.phone) { doc.text(pdfSafe(company.phone), pageW - margin, ciY, { align: 'right' }); ciY += 5; }
            if (company.email) { doc.text(pdfSafe(company.email), pageW - margin, ciY, { align: 'right' }); ciY += 5; }
            if (company.address) { doc.text(pdfSafe(company.address), pageW - margin, ciY, { align: 'right' }); }
            break;
        }
        case 'branded': {
            headerH = 75;
            doc.setFillColor(...accentRGB);
            doc.rect(0, 0, pageW, headerH, 'F');
            doc.setFillColor(
                Math.min(255, accentRGB[0] + 55),
                Math.min(255, accentRGB[1] + 55),
                Math.min(255, accentRGB[2] + 55)
            );
            doc.rect(0, headerH - 4, pageW, 4, 'F');
            placeLogoOrText((pageW - 120) / 2, 6, 120, 58, [255, 255, 255], 24, pageW / 2, headerH / 2 + 3);
            break;
        }
        case 'slim':
        default: {
            headerH = 50;
            doc.setFillColor(...accentRGB);
            doc.rect(0, 0, pageW, headerH, 'F');
            doc.setFillColor(...RED);
            doc.rect(0, headerH - 2, pageW, 2, 'F');
            placeLogoOrText((pageW - 70) / 2, (headerH - 2 - 36) / 2, 70, 36, [255, 255, 255], 18, pageW / 2, headerH / 2 + 3);
            break;
        }
    }

    let y = headerH + 13;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(32);
    doc.setTextColor(...DARK);
    doc.text('INVOICE', margin, y);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...RED);
    doc.text('INVOICE NUMBER', pageW - margin, y - 7, { align: 'right' });
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    doc.text(`#${invoice.invoice_number}`, pageW - margin, y, { align: 'right' });

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    const issuedFormatted = invoice.issued_date
        ? new Date(invoice.issued_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : invoice.issued_date;
    doc.text(`Date: ${issuedFormatted}`, margin, y);

    y += 16;
    const col2X = margin + contentW / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...RED);
    doc.text('FROM', margin, y);
    doc.text('BILL TO', col2X, y);

    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(pdfSafe(company.name), margin, y);
    doc.text(pdfSafe(customerName), col2X, y);

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);

    let fromY = y;
    if (company.address) { doc.text(pdfSafe(company.address), margin, fromY); fromY += 4.5; }
    if (company.phone) { doc.text(pdfSafe(company.phone), margin, fromY); fromY += 4.5; }
    if (company.email) { doc.text(pdfSafe(company.email), margin, fromY); fromY += 4.5; }

    let billY = y;
    if (customerAddress) { doc.text(pdfSafe(customerAddress), col2X, billY); billY += 4.5; }
    if (customerEmail) { doc.text(pdfSafe(customerEmail), col2X, billY); billY += 4.5; }

    const tableStartY = Math.max(fromY, billY) + 12;
    const currentTierName = currentTier === 'good' ? goodTierName : currentTier === 'better' ? betterTierName : bestTierName;

    if (showLineItems && lineItems.length > 0) {
        if (hideItemPrices) {
            autoTable(doc, {
                startY: tableStartY,
                margin: { left: margin, right: margin },
                head: [['SCOPE OF WORK', 'QTY']],
                body: lineItems.map(item => [
                    pdfSafe(item.display_only ? `${item.description} *` : item.description),
                    item.quantity % 1 === 0 ? item.quantity.toString() : item.quantity.toFixed(2),
                ]),
                headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, cellPadding: { top: 5, bottom: 5, left: 6, right: 6 } },
                bodyStyles: { fontSize: 9, textColor: [40, 50, 70], cellPadding: { top: 3, bottom: 3, left: 6, right: 6 } },
                alternateRowStyles: { fillColor: [250, 251, 252] },
                columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 20, halign: 'center' } },
                theme: 'plain',
                tableLineColor: [210, 215, 225],
                tableLineWidth: 0.3,
            });
        } else {
            autoTable(doc, {
                startY: tableStartY,
                margin: { left: margin, right: margin },
                head: [['SCOPE OF WORK', 'QTY', 'AMOUNT']],
                body: lineItems.map(item => [
                    pdfSafe(item.display_only ? `${item.description} *` : item.description),
                    item.quantity % 1 === 0 ? item.quantity.toString() : item.quantity.toFixed(2),
                    item.display_only ? `(${fmt(item.total)})` : fmt(item.total),
                ]),
                headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, cellPadding: { top: 5, bottom: 5, left: 6, right: 6 } },
                bodyStyles: { fontSize: 9, textColor: [40, 50, 70], cellPadding: { top: 3, bottom: 3, left: 6, right: 6 } },
                alternateRowStyles: { fillColor: [250, 251, 252] },
                columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 36, halign: 'right' } },
                theme: 'plain',
                tableLineColor: [210, 215, 225],
                tableLineWidth: 0.3,
            });
        }
    } else if (!showLineItems || lineItems.length === 0) {
        autoTable(doc, {
            startY: tableStartY,
            margin: { left: margin, right: margin },
            head: [['DESCRIPTION OF WORK', 'AMOUNT']],
            body: [[
                { content: `${currentTierName} Project`, styles: { fontStyle: 'bold', fontSize: 10, textColor: [17, 24, 39] as [number, number, number] } },
                fmt(displaySubtotal),
            ]],
            headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, cellPadding: { top: 5, bottom: 5, left: 6, right: 6 } },
            bodyStyles: { fontSize: 9.5, textColor: [40, 50, 70], cellPadding: { top: 8, bottom: 8, left: 6, right: 6 } },
            columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 38, halign: 'right' } },
            theme: 'plain',
            tableLineColor: [210, 215, 225],
            tableLineWidth: 0.3,
            didDrawCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 0) {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7.5);
                    doc.setTextColor(...GRAY);
                    doc.text('Materials, labor, and professional installation.', data.cell.x + 6, data.cell.y + data.cell.height - 3);
                }
            },
        });
    }

    let tableEndY = (doc as any).lastAutoTable.finalY;

    const hasDisplayOnly = lineItems.some(i => i.display_only);
    if (hasDisplayOnly && !hideItemPrices) {
        tableEndY += 4;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(...GRAY);
        doc.text('* Amounts shown in parentheses are informational only and not included in the project total.', margin, tableEndY);
        tableEndY += 5;
    }

    if (additionalItems.length > 0) {
        tableEndY += 6;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(
            includeAddonsInTotal ? 5 : 180,
            includeAddonsInTotal ? 150 : 120,
            includeAddonsInTotal ? 105 : 30
        );
        doc.text('ADDITIONAL ITEMS', margin, tableEndY);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(...GRAY);
        doc.text(
            includeAddonsInTotal ? '(included in project total)' : '(informational only — not included in project total)',
            margin + 44, tableEndY
        );
        tableEndY += 4;

        autoTable(doc, {
            startY: tableEndY,
            margin: { left: margin, right: margin },
            head: [['DESCRIPTION', 'QTY', 'AMOUNT']],
            body: additionalItems.map(item => [
                pdfSafe(item.description || '-'),
                item.quantity % 1 === 0 ? item.quantity.toString() : item.quantity.toFixed(2),
                includeAddonsInTotal ? fmt(item.total) : `(${fmt(item.total)})`,
            ]),
            headStyles: {
                fillColor: includeAddonsInTotal ? [209, 250, 229] : [254, 243, 199],
                textColor: includeAddonsInTotal ? [4, 120, 87] : [146, 64, 14],
                fontStyle: 'bold',
                fontSize: 8,
                cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
            },
            bodyStyles: {
                fontSize: 8.5,
                textColor: includeAddonsInTotal ? [6, 95, 70] : [100, 80, 30],
                cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
                fontStyle: 'italic',
            },
            alternateRowStyles: { fillColor: includeAddonsInTotal ? [236, 253, 245] : [255, 251, 235] },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 20, halign: 'center' },
                2: { cellWidth: 36, halign: 'right' },
            },
            theme: 'plain',
            tableLineColor: includeAddonsInTotal ? [167, 243, 208] : [253, 230, 138],
            tableLineWidth: 0.3,
        });
        tableEndY = (doc as any).lastAutoTable.finalY;
    }

    const labelX = pageW - margin - 75;
    const valueX = pageW - margin;
    let ty = tableEndY + 16;

    const depositPaid = Number(invoice.deposit_paid ?? 0);
    const depositRequired = Number(invoice.deposit_required ?? 0);

    // Compute total received from payment records (source of truth when available)
    const totalFromRecords = paymentRecords
        .filter(r => r.type === 'received' || r.type === 'credit')
        .reduce((s, r) => s + Number(r.amount), 0);

    // Use whichever is higher — payment records or deposit_paid — to avoid false "balance due"
    // when records are incomplete (e.g. after "Mark as Paid" without adding a payment record)
    const effectivePaid = Math.max(totalFromRecords, depositPaid);
    const amountDue = Math.max(0, Number(displayTotal) - effectivePaid);
    const isPaidInFull = effectivePaid >= Number(displayTotal) - 0.01;

    const changeOrderTotal = Number(displayTotal) - Number(displaySubtotal) - Number(displayTaxAmount);
    const hasChangeOrders = changeOrderTotal > 0.01;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...DARK);
    doc.text(hasChangeOrders ? 'Original Scope:' : 'Total Project:', labelX, ty);
    doc.text(fmt(Number(displaySubtotal)), valueX, ty, { align: 'right' });
    ty += 9;

    if (Number(invoice.tax_rate) > 0) {
        doc.setTextColor(...GRAY);
        doc.text(`Tax (${invoice.tax_rate}%):`, labelX, ty);
        doc.setTextColor(...DARK);
        doc.text(fmt(Number(displayTaxAmount)), valueX, ty, { align: 'right' });
        ty += 9;
    }

    if (hasChangeOrders) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(...GREEN);
        doc.text('Approved Changes:', labelX, ty);
        doc.text(`+${fmt(changeOrderTotal)}`, valueX, ty, { align: 'right' });
        ty += 5;
        doc.setDrawColor(...LGRAY);
        doc.setLineWidth(0.3);
        doc.line(labelX, ty, valueX, ty);
        ty += 7;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(...DARK);
        doc.text('Revised Total:', labelX, ty);
        doc.text(fmt(Number(displayTotal)), valueX, ty, { align: 'right' });
        ty += 9;
    }

    if (effectivePaid > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(...GREEN);
        doc.text('Payments Applied:', labelX, ty);
        doc.text(`-${fmt(effectivePaid)}`, valueX, ty, { align: 'right' });
        ty += 4;
        doc.setDrawColor(...GREEN);
        doc.setLineWidth(0.5);
        doc.line(labelX, ty, valueX, ty);
        ty += 9;
    } else if (depositRequired > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...GRAY);
        doc.text('Down Payment Required:', labelX, ty);
        doc.setTextColor(...DARK);
        doc.text(fmt(depositRequired), valueX, ty, { align: 'right' });
        ty += 9;
    }

    if (isPaidInFull) {
        const pillW = pageW - margin - labelX + 4;
        doc.setFillColor(209, 250, 229);
        doc.roundedRect(labelX - 4, ty - 5, pillW, 13, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(5, 150, 105);
        doc.text('PAID IN FULL', labelX, ty + 4);
        doc.text(fmt(0), valueX, ty + 4, { align: 'right' });
    } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...RED);
        doc.text('Amount Due:', labelX, ty);
        doc.setFontSize(14);
        doc.text(fmt(amountDue), valueX, ty, { align: 'right' });
    }

    let phY = ty + 14;
    const hasDates = invoice.project_start_date || invoice.project_completion_date;
    const hasRecords = paymentRecords.length > 0;

    if (hasDates || hasRecords) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...RED);
        doc.text('PROJECT & PAYMENT DETAILS', margin, phY);
        doc.setDrawColor(...LGRAY);
        doc.setLineWidth(0.3);
        doc.line(margin, phY + 2, pageW - margin, phY + 2);
        phY += 8;

        if (hasDates) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(...DARK);
            if (invoice.project_start_date) {
                const startFmt = new Date(invoice.project_start_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                doc.text(`Project Start: ${startFmt}`, margin, phY);
            }
            if (invoice.project_completion_date) {
                const endFmt = new Date(invoice.project_completion_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                doc.text(`Est. Completion: ${endFmt}`, pageW / 2, phY);
            }
            phY += 10;
        }

        if (hasRecords) {
            const typeLabel: Record<string, string> = { received: 'Received', scheduled: 'Scheduled', credit: 'Credit' };

            // If the change order makes total higher than what payment records see,
            // add a descriptive row so the table balances
            const recordRows = paymentRecords.map(r => [
                r.date ? new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
                pdfSafe(r.description || '—'),
                typeLabel[r.type] || r.type,
                (r.type === 'received' || r.type === 'credit' ? '-' : '') + fmt(Number(r.amount)),
            ]);

            autoTable(doc, {
                startY: phY,
                head: [['Date', 'Description', 'Type', 'Amount']],
                body: recordRows,
                theme: 'plain',
                headStyles: { fillColor: [245, 245, 250], textColor: [100, 110, 130], fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
                bodyStyles: { fontSize: 8.5, cellPadding: 3, textColor: [17, 24, 39] },
                columnStyles: { 0: { cellWidth: 32 }, 2: { cellWidth: 24 }, 3: { halign: 'right', cellWidth: 28 } },
                margin: { left: margin, right: margin },
            });
            phY = (doc as any).lastAutoTable.finalY + 6;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(...GRAY);
            doc.text('Total Received:', pageW - margin - 60, phY);
            doc.setTextColor(5, 150, 105);
            doc.setFont('helvetica', 'bold');
            doc.text(`-${fmt(effectivePaid)}`, pageW - margin, phY, { align: 'right' });
            phY += 6;

            if (isPaidInFull) {
                const pillW2 = 60 + margin;
                doc.setFillColor(209, 250, 229);
                doc.roundedRect(pageW - margin - pillW2, phY - 4, pillW2, 11, 2, 2, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(5, 150, 105);
                doc.text('PAID IN FULL', pageW - margin - 60, phY + 3);
                doc.text(fmt(0), pageW - margin, phY + 3, { align: 'right' });
            } else {
                const remainingBalance = amountDue;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(...RED);
                doc.text('Balance Due:', pageW - margin - 60, phY);
                doc.text(fmt(remainingBalance), pageW - margin, phY, { align: 'right' });
            }
        }
    }

    const footerY = pageH - 14;
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 8, pageW - margin, footerY - 8);

    const footerLines: string[] = [];
    if (invoice.payment_instructions) footerLines.push(pdfSafe(invoice.payment_instructions));
    if (invoice.notes) footerLines.push(pdfSafe(invoice.notes));
    if (footerLines.length === 0) {
        footerLines.push(pdfSafe(`Thank you for your business! Please make checks payable to ${company.name}.`));
        footerLines.push('All work is guaranteed as per the service contract.');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    footerLines.slice(0, 2).forEach((line, i) => {
        doc.text(line, pageW / 2, footerY - 3 + i * 5, { align: 'center' });
    });

    return doc;
}

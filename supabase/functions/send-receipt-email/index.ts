import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import nodemailer from 'npm:nodemailer@6.10.0';
import { Buffer } from 'node:buffer';
import { PDFDocument, rgb, StandardFonts, type PDFFont } from 'https://esm.sh/pdf-lib@1.17.1';


// The verified platform sender every TrussCTR email goes out from (same one the quote emails use).
const platformFromEmail = (() => {
  const v = (Deno.env.get('ALERT_FROM_EMAIL') || '').trim();
  return v.match(/<([^>]+)>/)?.[1] || v || 'scopemgr@614restore.com';
})();
const APP_URL = (Deno.env.get('APP_URL') || 'https://trussctr.614restore.com').replace(/\/$/, '');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendReceiptPayload {
  // Pass either an existing payment_id OR full payment data to create server-side
  payment_id?: string;
  // Payment creation fields (used when payment_id is absent)
  company_id: string;
  customer_id?: string;
  quote_id?: string;
  amount?: number;
  payment_method?: string;
  note?: string;
  created_by?: string;
  // Email fields
  to_email: string;
  to_name?: string;
  cc_emails?: string[];
  /**
   * Build the receipt and return its HTML without recording a payment or
   * sending anything. The same builder produces both, so what is previewed is
   * exactly what the customer would receive.
   */
  preview?: boolean;
}

const getSupabaseAdmin = () => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) throw new Error('Missing Supabase env vars');
  return createClient(url, serviceRoleKey);
};

const fmt = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

const methodLabel: Record<string, string> = {
  cash: 'Cash',
  check: 'Check',
  card: 'Credit / Debit Card',
  other: 'Other',
};

const GENERIC_TIER_NAMES = new Set(['good', 'better', 'best']);

const buildReceiptHtml = (data: {
  receiptNumber: string;
  companyName: string;
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
  logoUrl?: string;
  customerName: string;
  customerEmail?: string;
  projectTitle?: string;
  tiers?: { name: string; subtotal: number }[];
  quoteTotal?: number;
  amount: number;
  totalPaidToDate?: number;
  paymentMethod: string;
  note?: string;
  footerText?: string;
  date: string;
  brandColor?: string;
  /** True when the receipt goes out with a PDF copy attached. */
  pdfAttached?: boolean;
}): string => {
  // The header was hardcoded navy while the company's own colours sat unused in
  // the database. Worse for logos than it sounds: an uploaded JPEG has no
  // transparency, so its background is baked in — a black-backed logo on a navy
  // band reads as a blue box drawn around the logo.
  const brand = data.brandColor && /^#[0-9a-fA-F]{6}$/.test(data.brandColor) ? data.brandColor : '#1e3a5f';
  const paidToDate = data.totalPaidToDate ?? data.amount;
  const priorPaid = paidToDate - data.amount;
  const rawBalance = data.quoteTotal != null ? data.quoteTotal - paidToDate : null;
  const balance = rawBalance !== null ? Math.max(0, rawBalance) : null;
  const overpayment = rawBalance !== null && rawBalance < 0 ? Math.abs(rawBalance) : 0;

  // Combine generic tier names (Good/Better/Best) with the project title so customers
  // know what the receipt is for (e.g. "Better — Roof Replacement" not just "Better")
  const cleanTitle = (data.projectTitle ?? '').replace(/\s*(proposal|quote)\s*$/i, '').trim();
  const tiersHtml = (data.tiers ?? []).map(t => {
    const label = cleanTitle && GENERIC_TIER_NAMES.has(t.name.toLowerCase())
      ? `${t.name} — ${cleanTitle}`
      : t.name;
    return `
    <tr>
      <td style="padding:14px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">${label}</td>
      <td style="padding:14px 16px;font-size:14px;color:#374151;text-align:right;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${fmt(t.subtotal)}</td>
    </tr>`;
  }).join('');

  const balanceColor = overpayment > 0 ? '#7c3aed' : balance === 0 ? '#15803d' : '#b45309';
  const balanceText = overpayment > 0 ? `Overpayment: +${fmt(overpayment)}` : balance === 0 ? 'Paid in Full' : fmt(balance ?? 0);
  const balanceLabel = overpayment > 0 ? 'Account Status' : 'Amount Due';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media print{@page{size:letter portrait;margin:0.5in}body{background:#fff!important}table{page-break-inside:auto}tr{page-break-inside:avoid}}</style></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="background:#111827;border-bottom:4px solid ${brand};padding:32px 40px;">
            ${data.logoUrl ? `<img src="${data.logoUrl}" height="48" width="auto" style="display:block;height:48px;width:auto;max-width:200px;margin-bottom:14px;object-fit:contain;" alt="${data.companyName}" />` : ''}
            <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#ffffff;">${data.companyName}</p>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.65);">Payment Receipt &nbsp;·&nbsp; ${data.receiptNumber}</p>
          </td>
        </tr>

        <!-- Customer + Date row -->
        <tr>
          <td style="padding:28px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:top;">
                  <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.6px;">Received From</p>
                  <p style="margin:0 0 2px;font-size:16px;font-weight:700;color:#111827;">${data.customerName}</p>
                  ${data.customerEmail ? `<p style="margin:0;font-size:13px;color:#6b7280;">${data.customerEmail}</p>` : ''}
                </td>
                <td style="vertical-align:top;text-align:right;white-space:nowrap;padding-left:24px;">
                  <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.6px;">Date</p>
                  <p style="margin:0;font-size:14px;color:#374151;">${data.date}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Scope table -->
        <tr>
          <td style="padding:24px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
              <tr style="background:#f3f4f6;">
                <th style="padding:10px 16px;font-size:11px;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid #e5e7eb;font-weight:600;">Scope of Work</th>
                <th style="padding:10px 16px;font-size:11px;color:#6b7280;text-align:right;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid #e5e7eb;font-weight:600;white-space:nowrap;">Price</th>
              </tr>
              ${tiersHtml}
              ${data.quoteTotal != null ? `
              <tr style="background:#f9fafb;">
                <td style="padding:12px 16px;font-size:14px;font-weight:700;color:#111827;">Project Total</td>
                <td style="padding:12px 16px;font-size:14px;font-weight:700;color:#111827;text-align:right;white-space:nowrap;">${fmt(data.quoteTotal)}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>

        <!-- Payment summary -->
        <tr>
          <td style="padding:24px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;">
              <tr>
                <td style="padding:18px 20px 14px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    ${priorPaid > 0 ? `
                    <tr>
                      <td style="font-size:13px;color:#166534;padding-bottom:6px;">Previously paid</td>
                      <td style="font-size:13px;color:#166534;text-align:right;white-space:nowrap;padding-bottom:6px;">${fmt(priorPaid)}</td>
                    </tr>` : ''}
                    <tr>
                      <td style="font-size:15px;font-weight:600;color:#15803d;${priorPaid > 0 ? 'border-top:1px solid #bbf7d0;padding-top:8px;' : ''}">This Payment</td>
                      <td style="font-size:22px;font-weight:700;color:#15803d;text-align:right;white-space:nowrap;${priorPaid > 0 ? 'border-top:1px solid #bbf7d0;padding-top:8px;' : ''}">${fmt(data.amount)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              ${balance !== null ? `
              <tr>
                <td style="padding:0 20px 18px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #bbf7d0;padding-top:12px;">
                    <tr>
                      <td style="padding-top:12px;font-size:14px;color:#374151;">${balanceLabel}</td>
                      <td style="padding-top:12px;font-size:16px;font-weight:700;color:${balanceColor};text-align:right;white-space:nowrap;">${balanceText}</td>
                    </tr>
                  </table>
                </td>
              </tr>` : ''}
            </table>
          </td>
        </tr>

        ${data.pdfAttached ? `
        <tr>
          <td style="padding:16px 40px 0;">
            <p style="margin:0;font-size:13px;color:#6b7280;">A PDF copy of this receipt is attached to this email.</p>
          </td>
        </tr>` : ''}

        ${data.note ? `
        <tr>
          <td style="padding:16px 40px 0;">
            <p style="margin:0;font-size:13px;color:#6b7280;font-style:italic;">Note: ${data.note}</p>
          </td>
        </tr>` : ''}

        ${data.footerText ? `
        <tr>
          <td style="padding:16px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="border-top:1px solid #e5e7eb;padding-top:14px;font-size:13px;color:#374151;line-height:1.6;">
                ${data.footerText.replace(/\n/g, '<br>')}
              </td></tr>
            </table>
          </td>
        </tr>` : ''}

        <!-- Footer -->
        ${data.companyPhone || data.companyEmail || data.companyAddress ? `
        <tr>
          <td style="padding:24px 40px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="border-top:1px solid #e5e7eb;padding-top:20px;font-size:12px;color:#9ca3af;text-align:center;">
                ${[data.companyPhone, data.companyEmail].filter(Boolean).join(' &nbsp;·&nbsp; ')}
                ${data.companyAddress ? `<br>${data.companyAddress}` : ''}
              </td></tr>
            </table>
          </td>
        </tr>` : `<tr><td style="padding-bottom:32px;"></td></tr>`}

      </table>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin:16px 0 0;">This is an official receipt from ${data.companyName}. Please keep for your records.</p>
    </td></tr>
  </table>
</body>
</html>`;
};

// ─── Receipt PDF ──────────────────────────────────────────────────────
// Built from the same data as the HTML receipt, so the PDF a customer opens (or a rep downloads)
// matches the email. pdf-lib's standard fonts are WinAnsi only and it throws on anything else,
// so text is folded down to characters they can draw.
const WINANSI_SAFE_ABOVE_LATIN1 = new Set(['—', '–', '•', '…', '™', '†', '‡', '‘', '’', '“', '”', '€']);
const PDF_SYMBOL_FALLBACKS: Record<string, string> = { '✓': '•', '✔': '•', '−': '-', '≈': '~', '→': '->' };
const winAnsi = (value: string): string => {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0xff || WINANSI_SAFE_ABOVE_LATIN1.has(ch)) { out += ch; continue; }
    out += PDF_SYMBOL_FALLBACKS[ch] ?? '';
  }
  return out;
};

const hexToRgb = (hex: string) => {
  const h = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#1e3a5f';
  return rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
};

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

type ReceiptData = Parameters<typeof buildReceiptHtml>[0];

async function buildReceiptPdf(data: ReceiptData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const W = 612, H = 792, M = 48, RIGHT = W - M;
  const brand = hexToRgb(data.brandColor ?? '');
  const ink = rgb(0.07, 0.09, 0.15), gray = rgb(0.42, 0.45, 0.5), light = rgb(0.61, 0.64, 0.69);
  let page = doc.addPage([W, H]);

  const wrap = (text: string, font: PDFFont, size: number, width: number): string[] => {
    const lines: string[] = [];
    for (const para of winAnsi(text).split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const attempt = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(attempt, size) <= width) line = attempt;
        else { if (line) lines.push(line); line = word; }
      }
      lines.push(line);
    }
    return lines;
  };
  const rightText = (t: string, y: number, font: PDFFont, size: number, color = ink) => {
    const text = winAnsi(t);
    page.drawText(text, { x: RIGHT - font.widthOfTextAtSize(text, size), y, size, font, color });
  };
  const text = (t: string, x: number, y: number, font: PDFFont, size: number, color = ink) =>
    page.drawText(winAnsi(t), { x, y, size, font, color });

  // Header band, with the company's logo when one can be fetched.
  page.drawRectangle({ x: 0, y: H - 112, width: W, height: 112, color: rgb(0.07, 0.09, 0.15) });
  page.drawRectangle({ x: 0, y: H - 116, width: W, height: 4, color: brand });
  let nameX = M;
  if (data.logoUrl) {
    try {
      const res = await fetch(data.logoUrl, { signal: AbortSignal.timeout(4000) });
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (res.ok && bytes.length > 0 && bytes.length < 3_000_000) {
        const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
        const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
        if (isPng || isJpg) {
          const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
          const h = 46, w = Math.min(140, (img.width / img.height) * h);
          page.drawImage(img, { x: M, y: H - 82, width: w, height: h });
          nameX = M + w + 16;
        }
      }
    } catch { /* no logo: the name alone is fine */ }
  }
  text(data.companyName, nameX, H - 56, bold, 20, rgb(1, 1, 1));
  text(`Payment Receipt  ·  ${data.receiptNumber}`, nameX, H - 76, regular, 10, rgb(0.8, 0.83, 0.87));

  // Received from / date
  let y = H - 152;
  text('RECEIVED FROM', M, y, regular, 8, light);
  rightText('DATE', y, regular, 8, light);
  y -= 18;
  text(data.customerName, M, y, bold, 14);
  rightText(data.date, y, regular, 11, gray);
  if (data.customerEmail) { y -= 15; text(data.customerEmail, M, y, regular, 10, gray); }
  y -= 30;

  // Scope of work
  const ensure = (need: number) => {
    if (y - need < 60) { page = doc.addPage([W, H]); y = H - 60; }
  };
  const cleanTitle = (data.projectTitle ?? '').replace(/\s*(proposal|quote)\s*$/i, '').trim();
  const rows = (data.tiers ?? []).map((t) => ({
    label: cleanTitle && GENERIC_TIER_NAMES.has(t.name.toLowerCase()) ? `${t.name} — ${cleanTitle}` : t.name,
    amount: fmt(t.subtotal),
  }));
  if (rows.length > 0 || data.quoteTotal != null) {
    page.drawRectangle({ x: M, y: y - 6, width: RIGHT - M, height: 22, color: rgb(0.95, 0.96, 0.96) });
    text('SCOPE OF WORK', M + 10, y, bold, 8, gray);
    const priceLabel = 'PRICE';
    page.drawText(priceLabel, { x: RIGHT - 10 - bold.widthOfTextAtSize(priceLabel, 8), y, size: 8, font: bold, color: gray });
    y -= 26;
    for (const r of rows) {
      const lines = wrap(r.label, regular, 11, RIGHT - M - 130);
      ensure(lines.length * 14 + 12);
      lines.forEach((l, i) => text(l, M + 10, y - i * 14, regular, 11, rgb(0.22, 0.25, 0.32)));
      page.drawText(winAnsi(r.amount), { x: RIGHT - 10 - regular.widthOfTextAtSize(winAnsi(r.amount), 11), y, size: 11, font: regular, color: rgb(0.22, 0.25, 0.32) });
      y -= lines.length * 14 + 6;
      page.drawLine({ start: { x: M, y: y + 2 }, end: { x: RIGHT, y: y + 2 }, thickness: 0.5, color: rgb(0.9, 0.91, 0.92) });
      y -= 8;
    }
    if (data.quoteTotal != null) {
      ensure(30);
      page.drawRectangle({ x: M, y: y - 8, width: RIGHT - M, height: 24, color: rgb(0.98, 0.98, 0.98) });
      text('Project Total', M + 10, y, bold, 11);
      const t = winAnsi(fmt(data.quoteTotal));
      page.drawText(t, { x: RIGHT - 10 - bold.widthOfTextAtSize(t, 11), y, size: 11, font: bold, color: ink });
      y -= 34;
    }
  }

  // Payment summary
  const paidToDate = data.totalPaidToDate ?? data.amount;
  const priorPaid = paidToDate - data.amount;
  const rawBalance = data.quoteTotal != null ? data.quoteTotal - paidToDate : null;
  const balance = rawBalance !== null ? Math.max(0, rawBalance) : null;
  const overpayment = rawBalance !== null && rawBalance < 0 ? Math.abs(rawBalance) : 0;
  const boxH = 20 + (priorPaid > 0 ? 22 : 0) + 32 + (balance !== null ? 34 : 0);
  ensure(boxH + 10);
  page.drawRectangle({ x: M, y: y - boxH + 14, width: RIGHT - M, height: boxH, color: rgb(0.94, 0.99, 0.96), borderColor: rgb(0.53, 0.94, 0.67), borderWidth: 1 });
  let by = y - 10;
  if (priorPaid > 0) {
    text('Previously paid', M + 16, by, regular, 10.5, rgb(0.09, 0.4, 0.21));
    rightText(fmt(priorPaid), by, regular, 10.5, rgb(0.09, 0.4, 0.21));
    by -= 22;
  }
  text('This Payment', M + 16, by, bold, 12, rgb(0.08, 0.5, 0.24));
  const amt = winAnsi(fmt(data.amount));
  page.drawText(amt, { x: RIGHT - 16 - bold.widthOfTextAtSize(amt, 20), y: by - 2, size: 20, font: bold, color: rgb(0.08, 0.5, 0.24) });
  by -= 30;
  if (balance !== null) {
    page.drawLine({ start: { x: M + 16, y: by + 14 }, end: { x: RIGHT - 16, y: by + 14 }, thickness: 0.5, color: rgb(0.73, 0.97, 0.82) });
    const label = overpayment > 0 ? 'Account Status' : 'Amount Due';
    const value = overpayment > 0 ? `Overpayment: +${fmt(overpayment)}` : balance === 0 ? 'Paid in Full' : fmt(balance);
    const color = overpayment > 0 ? rgb(0.49, 0.23, 0.93) : balance === 0 ? rgb(0.08, 0.5, 0.24) : rgb(0.71, 0.33, 0.04);
    text(label, M + 16, by - 4, regular, 11, rgb(0.22, 0.25, 0.32));
    const v = winAnsi(value);
    page.drawText(v, { x: RIGHT - 16 - bold.widthOfTextAtSize(v, 13), y: by - 5, size: 13, font: bold, color });
    by -= 30;
  }
  y = y - boxH - 4;

  text(`Payment method: ${methodLabel[data.paymentMethod] ?? data.paymentMethod}`, M, y, regular, 10.5, gray);
  y -= 20;
  if (data.note) {
    for (const l of wrap(`Note: ${data.note}`, italic, 10.5, RIGHT - M)) { ensure(16); text(l, M, y, italic, 10.5, gray); y -= 14; }
    y -= 6;
  }
  if (data.footerText) {
    ensure(40);
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: RIGHT, y: y + 6 }, thickness: 0.5, color: rgb(0.9, 0.91, 0.92) });
    y -= 10;
    for (const l of wrap(data.footerText, regular, 10.5, RIGHT - M)) { ensure(16); text(l, M, y, regular, 10.5, rgb(0.22, 0.25, 0.32)); y -= 14; }
    y -= 6;
  }
  ensure(60);
  text('Thank you for your business. Please keep this receipt for your records.', M, y - 6, regular, 10, gray);
  const contact = [data.companyPhone, data.companyEmail, data.companyAddress].filter(Boolean).join('  |  ');
  if (contact) text(contact, M, y - 22, regular, 9, light);

  return await doc.save();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload: SendReceiptPayload = await req.json();
    const { company_id, to_email, to_name, cc_emails, preview } = payload;

    if (!company_id || (!to_email && !preview)) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();

    let payment_id = payload.payment_id;

    // A preview must not record anything. Without this it would insert a
    // payment every time someone looked at the receipt before deciding to send
    // it — the balance would move on a document that was only being checked.
    let previewPayment: Record<string, unknown> | null = null;
    if (preview && !payment_id) {
      const { data: qRow } = payload.quote_id
        ? await supabase.from('quotes').select('quote_number').eq('id', payload.quote_id).single()
        : { data: null };
      const { data: custRow } = payload.customer_id
        ? await supabase.from('customers').select('*').eq('id', payload.customer_id).single()
        : { data: null };
      previewPayment = {
        id: 'preview',
        company_id,
        customer_id: payload.customer_id ?? null,
        quote_id: payload.quote_id ?? null,
        // Shown as it would be numbered, so the preview is not misleading about
        // the receipt number the customer will see.
        receipt_number: qRow?.quote_number ? qRow.quote_number.replace(/^QT-?/i, 'R-') : 'R-PREVIEW',
        amount: payload.amount ?? 0,
        payment_method: payload.payment_method ?? 'cash',
        note: payload.note ?? null,
        created_at: new Date().toISOString(),
        customer: custRow ?? null,
      };
    }

    // If no payment_id provided, create the payment record server-side (bypasses RLS)
    if (!payment_id && !preview) {
      if (!payload.amount || payload.amount <= 0) {
        return new Response(JSON.stringify({ error: 'Amount is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Derive receipt number from the quote number (QT-2026-87412 → R-2026-87412)
      // Fall back to auto-increment only when there's no linked quote.
      let rNum: string;
      if (payload.quote_id) {
        const { data: qRow } = await supabase.from('quotes').select('quote_number').eq('id', payload.quote_id).single();
        rNum = qRow?.quote_number ? qRow.quote_number.replace(/^QT-?/i, 'R-') : (await supabase.rpc('next_receipt_number', { p_company_id: company_id })).data;
      } else {
        const { data, error: rErr } = await supabase.rpc('next_receipt_number', { p_company_id: company_id });
        if (rErr) throw rErr;
        rNum = data;
      }

      const { data: newPayment, error: pErr } = await supabase
        .from('payments')
        .insert({
          company_id,
          customer_id: payload.customer_id,
          quote_id: payload.quote_id,
          receipt_number: rNum,
          amount: payload.amount,
          payment_method: payload.payment_method ?? 'cash',
          note: payload.note ?? null,
          created_by: payload.created_by ?? null,
        })
        .select()
        .single();
      if (pErr) throw pErr;
      payment_id = newPayment.id;
    }

    const [{ data: fetchedPayment }, { data: company }] = await Promise.all([
      payment_id
        ? supabase
            .from('payments')
            .select('*, customer:customers(*), quote:quotes(quote_number,cover_page_title,selected_tier,use_manual_totals,good_total,better_total,best_total,manual_good_total,manual_better_total,manual_best_total,quote_options(name,subtotal,sort_order))')
            .eq('id', payment_id)
            .single()
        : Promise.resolve({ data: null }),
      supabase
        .from('companies')
        .select('name,phone,email,address,city,state,zip,logo_url,quote_primary_color,quote_secondary_color,smtp_host,smtp_port,smtp_secure,smtp_username,smtp_password,smtp_password,quote_sender_email,quote_sender_name,receipt_footer_text,email_send_mode,connected_mail_provider')
        .eq('id', company_id)
        .single(),
    ]);

    // The stand-in carries no embedded quote, so fetch it the same way the
    // saved path gets one — otherwise the preview would omit the tier lines
    // and totals that make up most of the receipt.
    let payment: any = fetchedPayment ?? previewPayment;
    if (previewPayment && !fetchedPayment && payload.quote_id) {
      const { data: q } = await supabase
        .from('quotes')
        .select('quote_number,cover_page_title,selected_tier,use_manual_totals,good_total,better_total,best_total,manual_good_total,manual_better_total,manual_best_total,quote_options(name,subtotal,sort_order)')
        .eq('id', payload.quote_id)
        .single();
      payment = { ...previewPayment, quote: q ?? null };
    }

    if (!payment || !company) {
      return new Response(JSON.stringify({ error: 'Payment or company not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build tier list for the receipt
    const quote = payment.quote as any;
    let tiers: { name: string; subtotal: number }[] = [];
    let quoteTotal: number | undefined;

    if (quote) {
      const opts: { name: string; subtotal: number; sort_order: number }[] = quote.quote_options ?? [];
      const selectedTier = (quote.selected_tier ?? '') as string;
      const tierLabels: Record<string, string> = { good: 'Good', better: 'Better', best: 'Best' };
      const useManual = !!quote.use_manual_totals;
      const colTotals: Record<string, number> = {
        good:   (useManual && quote.manual_good_total   != null ? quote.manual_good_total   : quote.good_total)   ?? 0,
        better: (useManual && quote.manual_better_total != null ? quote.manual_better_total : quote.better_total) ?? 0,
        best:   (useManual && quote.manual_best_total   != null ? quote.manual_best_total   : quote.best_total)   ?? 0,
      };

      if (opts.length > 0) {
        // quote_options rows exist — use their subtotals (correct for both multi-scope and tiered)
        const sorted = [...opts].sort((a, b) => a.sort_order - b.sort_order);
        if (!selectedTier || selectedTier === 'all') {
          tiers = sorted.map(o => ({ name: o.name, subtotal: o.subtotal }));
        } else {
          const match = sorted.find(o => o.name.toLowerCase() === selectedTier.toLowerCase());
          tiers = match ? [{ name: match.name, subtotal: match.subtotal }] : sorted.map(o => ({ name: o.name, subtotal: o.subtotal }));
        }
      } else if (selectedTier) {
        // No quote_options rows — fall back to the tier column totals on the quotes row
        const keys = selectedTier === 'all'
          ? ['good', 'better', 'best'].filter(k => colTotals[k] > 0)
          : [selectedTier].filter(k => colTotals[k] > 0);
        tiers = keys.map(k => ({ name: tierLabels[k] ?? k, subtotal: colTotals[k] }));
      } else if (Object.values(colTotals).some(v => v > 0)) {
        // Single-price quote with no selected_tier — use whatever column has a value
        tiers = Object.entries(colTotals)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => ({ name: tierLabels[k] ?? k, subtotal: v }));
      }

      quoteTotal = tiers.reduce((s, t) => s + t.subtotal, 0) || undefined;
    }

    // Sum ALL payments on this quote so the receipt shows the true running balance
    let totalPaidToDate = payment.amount;
    if (payment.quote_id && payment.id !== 'preview') {
      const { data: allPayments } = await supabase
        .from('payments')
        .select('amount')
        .eq('quote_id', payment.quote_id);
      if (allPayments) {
        totalPaidToDate = allPayments.reduce((s, p) => s + (p.amount ?? 0), 0);
      }
    } else if (payment.id === 'preview' && payment.quote_id) {
      // Not yet recorded, so add this amount to what is already on the quote.
      const { data: allPayments } = await supabase
        .from('payments')
        .select('amount')
        .eq('quote_id', payment.quote_id);
      totalPaidToDate = (allPayments ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0) + (payment.amount ?? 0);
    }

    const receiptData: ReceiptData = {
      receiptNumber: payment.receipt_number,
      companyName: company.name,
      companyPhone: company.phone,
      companyEmail: company.email,
      companyAddress: [company.address, company.city, company.state, company.zip].filter(Boolean).join(', '),
      logoUrl: company.logo_url,
      customerName: to_name || (payment.customer ? `${payment.customer.first_name} ${payment.customer.last_name}` : 'Customer'),
      customerEmail: to_email,
      projectTitle: quote?.cover_page_title,
      tiers,
      quoteTotal,
      amount: payment.amount,
      totalPaidToDate,
      paymentMethod: payment.payment_method,
      note: payment.note,
      footerText: company.receipt_footer_text ?? undefined,
      brandColor: company.quote_primary_color ?? undefined,
      date: new Date(payment.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    };

    // The PDF copy: attached to the email and returned so the apps can offer a download.
    // A failure here must never stop the receipt itself, so it only costs the attachment.
    let pdfBytes: Uint8Array | null = null;
    try {
      pdfBytes = await buildReceiptPdf(receiptData);
    } catch (pdfErr) {
      console.error('Receipt PDF failed:', pdfErr);
    }
    const pdfFilename = `Receipt-${String(payment.receipt_number ?? 'receipt').replace(/[^A-Za-z0-9._-]+/g, '_')}.pdf`;
    const htmlBody = buildReceiptHtml({ ...receiptData, pdfAttached: !!pdfBytes });

    // Preview stops here: the document is built, nothing is sent, and no
    // payment was recorded. Returning the same htmlBody the email uses is the
    // point — a preview built from a second template could drift from it.
    if (preview) {
      return new Response(JSON.stringify({
        preview: true,
        html: htmlBody,
        receipt_number: payment.receipt_number,
        pdf_base64: pdfBytes ? toBase64(pdfBytes) : null,
        pdf_filename: pdfFilename,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const useSmtp =
      company.email_send_mode === 'smtp' &&
      company.smtp_host &&
      company.smtp_port &&
      company.smtp_username &&
      company.smtp_password;

    const smtpUsername: string | undefined = company.smtp_username ?? undefined;
    const provider: string | undefined = company.connected_mail_provider ?? undefined;
    // For Gmail/Outlook the from must match the authenticated account
    const smtpFromEmail = useSmtp
      ? (provider === 'gmail' || provider === 'outlook' ? smtpUsername! : (company.quote_sender_email || smtpUsername!))
      : platformFromEmail;
    const fromName = company.name || company.quote_sender_name || 'Your Contractor';
    const replyTo = useSmtp ? (smtpFromEmail || undefined) : (company.email || company.quote_sender_email || undefined);
    const subject = `Payment Receipt ${payment.receipt_number} — ${company.name}`;

    // Plain-text alternative — improves deliverability significantly
    const plainText = [
      `PAYMENT RECEIPT — ${payment.receipt_number}`,
      `${company.name}`,
      '',
      `Received From: ${to_name || payment.customer?.first_name + ' ' + payment.customer?.last_name}`,
      `Date: ${new Date(payment.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      '',
      tiers.length > 0 ? 'SCOPE OF WORK:\n' + tiers.map(t => `  ${t.name}: ${fmt(t.subtotal)}`).join('\n') : '',
      quoteTotal != null ? `Project Total: ${fmt(quoteTotal)}` : '',
      '',
      `This Payment: ${fmt(payment.amount)}`,
      `Method: ${methodLabel[payment.payment_method] ?? payment.payment_method}`,
      payment.note ? `Note: ${payment.note}` : '',
      '',
      'Thank you for your business. Please keep this receipt for your records.',
      pdfBytes ? 'A PDF copy of this receipt is attached.' : '',
      '',
      company.phone || company.email ? [company.phone, company.email].filter(Boolean).join(' | ') : '',
    ].filter(line => line !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim();

    let sent = false;
    let emailError: string | null = null;

    try {
      if (useSmtp) {
        const transporter = nodemailer.createTransport({
          host: company.smtp_host,
          port: company.smtp_port || 587,
          secure: company.smtp_secure === true,
          auth: { user: company.smtp_username, pass: company.smtp_password },
          requireTLS: company.smtp_secure !== true,
          tls: { rejectUnauthorized: true },
          connectionTimeout: 10000,
          greetingTimeout: 8000,
          socketTimeout: 15000,
        });
        const ccList = (cc_emails ?? []).filter(Boolean);
        await transporter.sendMail({
          from: `"${fromName}" <${smtpFromEmail}>`,
          to: to_email,
          replyTo: replyTo || undefined,
          envelope: { from: smtpFromEmail, to: [to_email] },
          cc: ccList.length > 0 ? ccList.join(', ') : undefined,
          subject,
          text: plainText,
          html: htmlBody,
          ...(pdfBytes ? { attachments: [{ filename: pdfFilename, content: Buffer.from(pdfBytes), contentType: 'application/pdf' }] } : {}),
        });
        sent = true;
      } else {
        const resendKey = Deno.env.get('RESEND_API_KEY');
        if (resendKey) {
          const resendPayload = {
              from: `${fromName} <${platformFromEmail}>`,
              ...(replyTo ? { reply_to: replyTo } : {}),
              to: [to_email],
              cc: (cc_emails ?? []).filter(Boolean),
              subject,
              text: plainText,
              html: htmlBody,
              ...(pdfBytes ? { attachments: [{ filename: pdfFilename, content: toBase64(pdfBytes) }] } : {}),
            };
          console.log('Resend payload (no html):', JSON.stringify({ ...resendPayload, html: '[omitted]', attachments: pdfBytes ? '[pdf]' : undefined }));
          const resp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
            body: JSON.stringify(resendPayload),
            signal: AbortSignal.timeout(15000),
          });
          const resendBody = await resp.text();
          console.log('Resend response:', resp.status, resendBody);
          if (!resp.ok) {
            emailError = `Email provider error (${resp.status}): ${resendBody}`;
          } else {
            sent = true;
          }
        } else {
          emailError = 'No email provider configured (SMTP or Resend)';
        }
      }
    } catch (sendErr) {
      emailError = String(sendErr);
      console.error('Email send error:', sendErr);
    }

    if (sent) {
      const { error: updateErr } = await supabase.from('payments').update({ sent_to_email: to_email, sent_at: new Date().toISOString() }).eq('id', payment_id);
      if (updateErr) console.error('Failed to update sent_at on payment:', updateErr.message);
    }

    return new Response(JSON.stringify({ success: sent, payment_id, receipt_number: payment.receipt_number, email_error: emailError, pdf_attached: !!pdfBytes }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-receipt-email error:', err);
    // Return 200 so the client toast shows the actual error message instead of generic non-2xx
    return new Response(JSON.stringify({ success: false, email_error: `Internal error: ${err instanceof Error ? err.message : JSON.stringify(err)}` }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

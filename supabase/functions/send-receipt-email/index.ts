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

// ─── Colours and small helpers shared by the email and the PDF ──────────────────────
const esc = (v: unknown): string =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const safeHex = (hex: string | undefined | null, fallback: string): string =>
  hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : fallback;

const channels = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
/** A lighter version of a colour: amount 0 is the colour, 1 is white. */
const tint = (hex: string, amount: number): string => {
  const [r, g, b] = channels(hex);
  return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
};
const luminance = (hex: string): number => {
  const [r, g, b] = channels(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};
/** The company colour, darkened if it is too pale to read as text on white. */
const readable = (hex: string): string => {
  if (luminance(hex) <= 0.6) return hex;
  const [r, g, b] = channels(hex);
  return toHex(r * 0.55, g * 0.55, b * 0.55);
};

interface ReceiptStatus { label: string; color: string; }
/** What the customer most needs to see at a glance. */
const receiptStatus = (priorPaid: number, balance: number | null, overpayment: number, brand: string): ReceiptStatus => {
  if (overpayment > 0) return { label: 'Payment received', color: '#7c3aed' };
  if (balance === 0) return { label: 'Paid in full', color: '#15803d' };
  if (balance !== null && priorPaid <= 0) return { label: 'Deposit received', color: brand };
  return { label: 'Payment received', color: brand };
};

const buildReceiptHtml = (data: {
  receiptNumber: string;
  companyName: string;
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
  logoUrl?: string;
  tagline?: string;
  website?: string;
  licenseNumber?: string;
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
  accentColor?: string;
  /** True when the receipt goes out with a PDF copy attached. */
  pdfAttached?: boolean;
}): string => {
  const brand = readable(safeHex(data.brandColor, '#1e3a5f'));
  const accent = safeHex(data.accentColor, brand);
  const paidToDate = data.totalPaidToDate ?? data.amount;
  const priorPaid = paidToDate - data.amount;
  const rawBalance = data.quoteTotal != null ? data.quoteTotal - paidToDate : null;
  const balance = rawBalance !== null ? Math.max(0, rawBalance) : null;
  const overpayment = rawBalance !== null && rawBalance < 0 ? Math.abs(rawBalance) : 0;
  const status = receiptStatus(priorPaid, balance, overpayment, brand);
  const percentPaid = data.quoteTotal && data.quoteTotal > 0 ? Math.max(0, Math.min(100, Math.round((paidToDate / data.quoteTotal) * 100))) : null;
  const firstName = (data.customerName || '').trim().split(/\s+/)[0] || 'there';

  // Generic tier names (Good/Better/Best) read better with the project title ("Better — Roof Replacement").
  const cleanTitle = (data.projectTitle ?? '').replace(/\s*(proposal|quote)\s*$/i, '').trim();
  const tiersHtml = (data.tiers ?? []).map((t) => {
    const label = cleanTitle && GENERIC_TIER_NAMES.has(t.name.toLowerCase()) ? `${t.name} — ${cleanTitle}` : t.name;
    return `
    <tr>
      <td style="padding:13px 16px;font-size:14px;color:#374151;border-bottom:1px solid #eef0f2;">${esc(label)}</td>
      <td style="padding:13px 16px;font-size:14px;color:#374151;text-align:right;border-bottom:1px solid #eef0f2;white-space:nowrap;">${fmt(t.subtotal)}</td>
    </tr>`;
  }).join('');

  const contactBits = [data.companyPhone, data.companyEmail, data.website].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ');
  const balanceLine = overpayment > 0
    ? `<span style="color:#7c3aed;">Overpayment: +${fmt(overpayment)}</span>`
    : balance === 0
      ? `<span style="color:#15803d;">Paid in full — thank you!</span>`
      : `<span style="color:#b45309;">${fmt(balance ?? 0)}</span>`;
  const balanceLabel = overpayment > 0 ? 'Account status' : balance === 0 ? 'Balance' : 'Balance remaining';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media print{@page{size:letter portrait;margin:0.5in}body{background:#fff!important}table{page-break-inside:auto}tr{page-break-inside:avoid}}@media only screen and (max-width:480px){.rcpt-px{padding-left:20px!important;padding-right:20px!important}.rcpt-outer{padding:16px 8px!important}.rcpt-big{font-size:30px!important}}</style></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table class="rcpt-outer" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">

        <!-- Brand stripe -->
        <tr><td style="padding:0;"><table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="72%" style="height:8px;background:${brand};font-size:0;line-height:0;">&nbsp;</td>
          <td width="28%" style="height:8px;background:${accent};font-size:0;line-height:0;">&nbsp;</td>
        </tr></table></td></tr>

        <!-- Header: the company on the left, the document on the right -->
        <tr>
          <td class="rcpt-px" style="padding:28px 40px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="vertical-align:middle;">
                ${data.logoUrl
                  ? `<img src="${esc(data.logoUrl)}" height="52" style="display:block;height:52px;width:auto;max-width:220px;object-fit:contain;margin-bottom:6px;" alt="${esc(data.companyName)}" />`
                  : `<p style="margin:0;font-size:22px;font-weight:800;color:${brand};letter-spacing:-0.3px;">${esc(data.companyName)}</p>`}
                ${data.logoUrl ? `<p style="margin:0;font-size:14px;font-weight:700;color:#111827;">${esc(data.companyName)}</p>` : ''}
                ${data.tagline ? `<p style="margin:3px 0 0;font-size:12px;color:#6b7280;font-style:italic;">${esc(data.tagline)}</p>` : ''}
              </td>
              <td style="vertical-align:middle;text-align:right;white-space:nowrap;padding-left:20px;">
                <p style="margin:0;font-size:26px;font-weight:800;letter-spacing:4px;color:${brand};">RECEIPT</p>
                <p style="margin:4px 0 0;font-size:13px;color:#374151;font-weight:600;">${esc(data.receiptNumber)}</p>
                <p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">${esc(data.date)}</p>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- Status -->
        <tr>
          <td class="rcpt-px" style="padding:0 40px;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="background:${tint(status.color, 0.88)};border:1px solid ${tint(status.color, 0.6)};border-radius:999px;padding:7px 18px;font-size:12px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:${status.color};">&#10003;&nbsp; ${esc(status.label)}</td>
            </tr></table>
          </td>
        </tr>

        <!-- Received from / project -->
        <tr>
          <td class="rcpt-px" style="padding:24px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="vertical-align:top;width:50%;">
                <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;">Received from</p>
                <p style="margin:0 0 2px;font-size:16px;font-weight:700;color:#111827;">${esc(data.customerName)}</p>
                ${data.customerEmail ? `<p style="margin:0;font-size:13px;color:#6b7280;">${esc(data.customerEmail)}</p>` : ''}
              </td>
              <td style="vertical-align:top;width:50%;padding-left:20px;">
                ${cleanTitle ? `<p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;">Project</p>
                <p style="margin:0 0 2px;font-size:15px;font-weight:600;color:#111827;">${esc(cleanTitle)}</p>` : ''}
                <p style="margin:${cleanTitle ? '4px' : '0'} 0 0;font-size:13px;color:#6b7280;">Paid by ${esc(methodLabel[data.paymentMethod] ?? data.paymentMethod)}</p>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- Scope -->
        ${tiersHtml || data.quoteTotal != null ? `
        <tr>
          <td class="rcpt-px" style="padding:24px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;">
              <tr style="background:${tint(brand, 0.92)};">
                <th style="padding:10px 16px;font-size:11px;color:${brand};text-align:left;text-transform:uppercase;letter-spacing:0.8px;font-weight:700;">Scope of work</th>
                <th style="padding:10px 16px;font-size:11px;color:${brand};text-align:right;text-transform:uppercase;letter-spacing:0.8px;font-weight:700;white-space:nowrap;">Price</th>
              </tr>
              ${tiersHtml}
              ${data.quoteTotal != null ? `
              <tr style="background:#f9fafb;">
                <td style="padding:12px 16px;font-size:14px;font-weight:700;color:#111827;">Project total</td>
                <td style="padding:12px 16px;font-size:14px;font-weight:700;color:#111827;text-align:right;white-space:nowrap;">${fmt(data.quoteTotal)}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>` : ''}

        <!-- Amount received -->
        <tr>
          <td class="rcpt-px" style="padding:24px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:${tint(brand, 0.94)};border:1px solid ${tint(brand, 0.7)};border-radius:12px;">
              <tr>
                <td style="padding:20px 24px 6px;">
                  <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${brand};">Amount received</p>
                  <p style="margin:4px 0 0;font-size:36px;font-weight:800;color:${brand};letter-spacing:-0.5px;" class="rcpt-big">${fmt(data.amount)}</p>
                </td>
              </tr>
              ${percentPaid !== null ? `
              <tr>
                <td style="padding:10px 24px 4px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px;"><tr>
                    <td style="font-size:12px;color:#4b5563;">Paid to date <strong>${fmt(paidToDate)}</strong> of ${fmt(data.quoteTotal ?? 0)}</td>
                    <td style="font-size:12px;color:#4b5563;text-align:right;font-weight:700;">${percentPaid}%</td>
                  </tr></table>
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#e5e7eb;border-radius:6px;"><tr>
                    <td width="${Math.max(percentPaid, 1)}%" style="background:${brand};height:10px;border-radius:6px;font-size:0;line-height:0;">&nbsp;</td>
                    <td style="height:10px;font-size:0;line-height:0;">&nbsp;</td>
                  </tr></table>
                </td>
              </tr>` : ''}
              <tr>
                <td style="padding:12px 24px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${tint(brand, 0.7)};">
                    ${priorPaid > 0 ? `<tr>
                      <td style="padding-top:10px;font-size:13px;color:#4b5563;">Previously paid</td>
                      <td style="padding-top:10px;font-size:13px;color:#4b5563;text-align:right;white-space:nowrap;">${fmt(priorPaid)}</td>
                    </tr>` : ''}
                    ${balance !== null ? `<tr>
                      <td style="padding-top:10px;font-size:14px;color:#374151;">${balanceLabel}</td>
                      <td style="padding-top:10px;font-size:15px;font-weight:700;text-align:right;white-space:nowrap;">${balanceLine}</td>
                    </tr>` : ''}
                    ${priorPaid <= 0 && balance === null ? `<tr><td style="padding-top:10px;font-size:13px;color:#4b5563;">Thank you for your payment.</td></tr>` : ''}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${data.pdfAttached ? `
        <tr>
          <td class="rcpt-px" style="padding:14px 40px 0;">
            <p style="margin:0;font-size:12px;color:#6b7280;">&#128206; A PDF copy of this receipt is attached to this email.</p>
          </td>
        </tr>` : ''}

        ${data.note ? `
        <tr>
          <td class="rcpt-px" style="padding:14px 40px 0;">
            <p style="margin:0;font-size:13px;color:#6b7280;font-style:italic;">Note: ${esc(data.note)}</p>
          </td>
        </tr>` : ''}

        <!-- Thank you and the company's own words -->
        <tr>
          <td class="rcpt-px" style="padding:24px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="border-top:1px solid #e5e7eb;padding-top:18px;font-size:14px;color:#374151;line-height:1.65;">
                <strong style="color:${brand};font-size:15px;">Thank you, ${esc(firstName)}!</strong><br>
                ${data.footerText ? esc(data.footerText).replace(/\n/g, '<br>') : `We appreciate your business with ${esc(data.companyName)}.`}
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td class="rcpt-px" style="padding:22px 40px 30px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:12px;color:#6b7280;text-align:center;line-height:1.7;">
                ${contactBits ? `${contactBits}<br>` : ''}
                ${data.companyAddress ? `${esc(data.companyAddress)}<br>` : ''}
                ${data.licenseNumber ? `<span style="color:#9ca3af;">License #${esc(data.licenseNumber)}</span>` : ''}
              </td>
            </tr></table>
          </td>
        </tr>

      </table>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin:16px 0 0;">This is an official receipt from ${esc(data.companyName)}. Please keep it for your records.</p>
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
  const brandHex = readable(safeHex(data.brandColor, '#1e3a5f'));
  const accentHex = safeHex(data.accentColor, brandHex);
  const brand = hexToRgb(brandHex), accent = hexToRgb(accentHex);
  const rgbOf = (hex: string) => hexToRgb(hex);
  const ink = rgb(0.07, 0.09, 0.15), body = rgb(0.22, 0.25, 0.32), gray = rgb(0.42, 0.45, 0.5), light = rgb(0.61, 0.64, 0.69);
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
  const text = (t: string, x: number, y: number, font: PDFFont, size: number, color = ink) =>
    page.drawText(winAnsi(t), { x, y, size, font, color });
  const rightText = (t: string, y: number, font: PDFFont, size: number, color = ink, edge = RIGHT) => {
    const v = winAnsi(t);
    page.drawText(v, { x: edge - font.widthOfTextAtSize(v, size), y, size, font, color });
  };
  const centerText = (t: string, y: number, font: PDFFont, size: number, color = ink) => {
    const v = winAnsi(t);
    page.drawText(v, { x: (W - font.widthOfTextAtSize(v, size)) / 2, y, size, font, color });
  };
  const ensure = (need: number, y: number): number => {
    if (y - need < 60) { page = doc.addPage([W, H]); return H - 60; }
    return y;
  };

  // Brand stripe across the top: the company colour, with its accent at the end.
  page.drawRectangle({ x: 0, y: H - 8, width: W * 0.72, height: 8, color: brand });
  page.drawRectangle({ x: W * 0.72, y: H - 8, width: W * 0.28, height: 8, color: accent });

  // Header: logo (or the name as a wordmark) and tagline on the left, the document on the right.
  let y = H - 56;
  let drewLogo = false;
  if (data.logoUrl) {
    try {
      const res = await fetch(data.logoUrl, { signal: AbortSignal.timeout(4000) });
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (res.ok && bytes.length > 0 && bytes.length < 3_000_000) {
        const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
        const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
        if (isPng || isJpg) {
          const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
          const h = 46, w = Math.min(150, (img.width / img.height) * h);
          page.drawImage(img, { x: M, y: y - 30, width: w, height: h });
          drewLogo = true;
        }
      }
    } catch { /* no logo: the name alone is fine */ }
  }
  if (drewLogo) {
    text(data.companyName, M, y - 46, bold, 11, ink);
    if (data.tagline) text(data.tagline, M, y - 60, italic, 9, gray);
  } else {
    text(data.companyName, M, y - 4, bold, 20, brand);
    if (data.tagline) text(data.tagline, M, y - 20, italic, 9.5, gray);
  }
  rightText('RECEIPT', y - 2, bold, 24, brand);
  rightText(data.receiptNumber, y - 20, bold, 11, body);
  rightText(data.date, y - 35, regular, 10, light);
  y -= 84;

  const paidToDate = data.totalPaidToDate ?? data.amount;
  const priorPaid = paidToDate - data.amount;
  const rawBalance = data.quoteTotal != null ? data.quoteTotal - paidToDate : null;
  const balance = rawBalance !== null ? Math.max(0, rawBalance) : null;
  const overpayment = rawBalance !== null && rawBalance < 0 ? Math.abs(rawBalance) : 0;
  const status = receiptStatus(priorPaid, balance, overpayment, brandHex);
  const percentPaid = data.quoteTotal && data.quoteTotal > 0 ? Math.max(0, Math.min(100, (paidToDate / data.quoteTotal) * 100)) : null;
  const firstName = (data.customerName || '').trim().split(/\s+/)[0] || 'there';

  // Status pill
  const label = winAnsi(status.label.toUpperCase());
  const pillW = bold.widthOfTextAtSize(label, 9.5) + 34;
  page.drawRectangle({ x: M, y: y - 8, width: pillW, height: 22, color: rgbOf(tint(status.color, 0.88)), borderColor: rgbOf(tint(status.color, 0.55)), borderWidth: 1 });
  text('•', M + 10, y - 2, bold, 11, rgbOf(status.color));
  text(label, M + 24, y - 1, bold, 9.5, rgbOf(status.color));
  y -= 42;

  // Received from / project
  text('RECEIVED FROM', M, y, regular, 8, light);
  const cleanTitle = (data.projectTitle ?? '').replace(/\s*(proposal|quote)\s*$/i, '').trim();
  const colX = M + 270;
  if (cleanTitle) text('PROJECT', colX, y, regular, 8, light);
  y -= 17;
  text(data.customerName, M, y, bold, 14);
  if (cleanTitle) {
    const titleLines = wrap(cleanTitle, bold, 12, RIGHT - colX);
    titleLines.slice(0, 2).forEach((l, i) => text(l, colX, y - i * 15, bold, 12, ink));
  }
  let infoY = y;
  if (data.customerEmail) { infoY -= 15; text(data.customerEmail, M, infoY, regular, 10, gray); }
  text(`Paid by ${methodLabel[data.paymentMethod] ?? data.paymentMethod}`, colX, cleanTitle ? y - 32 : y, regular, 10, gray);
  y = Math.min(infoY, cleanTitle ? y - 32 : y) - 30;

  // Scope of work
  const rows = (data.tiers ?? []).map((t) => ({
    label: cleanTitle && GENERIC_TIER_NAMES.has(t.name.toLowerCase()) ? `${t.name} — ${cleanTitle}` : t.name,
    amount: fmt(t.subtotal),
  }));
  if (rows.length > 0 || data.quoteTotal != null) {
    page.drawRectangle({ x: M, y: y - 7, width: RIGHT - M, height: 24, color: rgbOf(tint(brandHex, 0.92)) });
    text('SCOPE OF WORK', M + 10, y, bold, 8, brand);
    rightText('PRICE', y, bold, 8, brand, RIGHT - 10);
    y -= 28;
    for (const r of rows) {
      const lines = wrap(r.label, regular, 11, RIGHT - M - 130);
      y = ensure(lines.length * 14 + 14, y);
      lines.forEach((l, i) => text(l, M + 10, y - i * 14, regular, 11, body));
      rightText(r.amount, y, regular, 11, body, RIGHT - 10);
      y -= lines.length * 14 + 6;
      page.drawLine({ start: { x: M, y: y + 2 }, end: { x: RIGHT, y: y + 2 }, thickness: 0.5, color: rgb(0.92, 0.93, 0.94) });
      y -= 8;
    }
    if (data.quoteTotal != null) {
      y = ensure(34, y);
      page.drawRectangle({ x: M, y: y - 8, width: RIGHT - M, height: 25, color: rgb(0.977, 0.98, 0.984) });
      text('Project total', M + 10, y, bold, 11);
      rightText(fmt(data.quoteTotal), y, bold, 11, ink, RIGHT - 10);
      y -= 36;
    }
  }

  // Amount received: the number that matters, and how far along the job is
  const boxH = 84 + (percentPaid !== null ? 36 : 0) + (priorPaid > 0 ? 20 : 0) + (balance !== null ? 26 : 0);
  y = ensure(boxH + 12, y);
  const top = y + 10;
  page.drawRectangle({ x: M, y: top - boxH, width: RIGHT - M, height: boxH, color: rgbOf(tint(brandHex, 0.94)), borderColor: rgbOf(tint(brandHex, 0.68)), borderWidth: 1 });
  text('AMOUNT RECEIVED', M + 20, top - 24, bold, 8.5, brand);
  text(fmt(data.amount), M + 20, top - 56, bold, 30, brand);
  let by = top - 74;
  if (percentPaid !== null) {
    by -= 14;
    text(`Paid to date ${fmt(paidToDate)} of ${fmt(data.quoteTotal ?? 0)}`, M + 20, by, regular, 9.5, gray);
    rightText(`${Math.round(percentPaid)}%`, by, bold, 9.5, body, RIGHT - 20);
    by -= 14;
    const trackW = RIGHT - M - 40;
    page.drawRectangle({ x: M + 20, y: by, width: trackW, height: 8, color: rgb(0.9, 0.91, 0.92) });
    page.drawRectangle({ x: M + 20, y: by, width: Math.max(4, (trackW * percentPaid) / 100), height: 8, color: brand });
    by -= 12;
  }
  if (priorPaid > 0) { by -= 12; text('Previously paid', M + 20, by, regular, 10.5, gray); rightText(fmt(priorPaid), by, regular, 10.5, body, RIGHT - 20); by -= 8; }
  if (balance !== null) {
    by -= 16;
    const bLabel = overpayment > 0 ? 'Account status' : balance === 0 ? 'Balance' : 'Balance remaining';
    const bValue = overpayment > 0 ? `Overpayment: +${fmt(overpayment)}` : balance === 0 ? 'Paid in full' : fmt(balance);
    const bColor = overpayment > 0 ? rgb(0.49, 0.23, 0.93) : balance === 0 ? rgb(0.08, 0.5, 0.24) : rgb(0.71, 0.33, 0.04);
    text(bLabel, M + 20, by, regular, 11, body);
    rightText(bValue, by, bold, 13, bColor, RIGHT - 20);
  }
  y = top - boxH - 26;

  if (data.note) {
    for (const l of wrap(`Note: ${data.note}`, italic, 10, RIGHT - M)) { y = ensure(16, y); text(l, M, y, italic, 10, gray); y -= 14; }
    y -= 8;
  }

  // Thank you, in the company's words
  y = ensure(90, y);
  page.drawLine({ start: { x: M, y: y + 8 }, end: { x: RIGHT, y: y + 8 }, thickness: 0.5, color: rgb(0.9, 0.91, 0.92) });
  y -= 12;
  text(`Thank you, ${firstName}!`, M, y, bold, 12, brand);
  y -= 17;
  for (const l of wrap(data.footerText || `We appreciate your business with ${data.companyName}.`, regular, 10.5, RIGHT - M)) {
    y = ensure(16, y);
    text(l, M, y, regular, 10.5, body);
    y -= 14;
  }
  y -= 18;
  y = ensure(60, y);
  const contact = [data.companyPhone, data.companyEmail, data.website].filter(Boolean).join('   |   ');
  if (contact) { centerText(contact, y, regular, 9.5, gray); y -= 14; }
  if (data.companyAddress) { centerText(data.companyAddress, y, regular, 9.5, gray); y -= 14; }
  if (data.licenseNumber) { centerText(`License #${data.licenseNumber}`, y, regular, 9, light); y -= 14; }
  centerText(`This is an official receipt from ${data.companyName}. Please keep it for your records.`, y - 6, regular, 8.5, light);

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
        .select('name,phone,email,address,city,state,zip,logo_url,about_tagline,website,license_number,quote_primary_color,quote_secondary_color,quote_accent_color,smtp_host,smtp_port,smtp_secure,smtp_username,smtp_password,smtp_password,quote_sender_email,quote_sender_name,receipt_footer_text,email_send_mode,connected_mail_provider')
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
      accentColor: company.quote_accent_color ?? undefined,
      tagline: company.about_tagline?.trim() || undefined,
      website: company.website?.trim() || undefined,
      licenseNumber: company.license_number?.trim() || undefined,
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

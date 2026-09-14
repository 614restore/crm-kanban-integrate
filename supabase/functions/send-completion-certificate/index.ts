// Copied from QuoteMGR supabase/functions/send-completion-certificate (read-only reference).
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getSupabaseAdmin = () =>
  createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: '2-digit',
  });
};

const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' }) +
    ' at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

/** Simple deterministic 16-char uppercase hex "hash" for the verification block. */
const verificationHash = (quoteId: string, date: string): string => {
  let h = 0x811c9dc5;
  const s = quoteId + '::' + date;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  // Stretch to 16 chars
  let h2 = h ^ 0xdeadbeef;
  h2 = (h2 * 0x45d9f3b) >>> 0;
  return (h.toString(16).toUpperCase().padStart(8, '0') +
          h2.toString(16).toUpperCase().padStart(8, '0'));
};

const certId = (quoteNumber: string, completionDate: string, hash: string): string => {
  const d = completionDate.replace(/-/g, '').slice(0, 8);
  const q = quoteNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6).padEnd(6, '0');
  return `COC-${d}-${q}-${hash.slice(0, 5)}`;
};

// ── Certificate HTML ──────────────────────────────────────────────────────────

type CertPhoto = {
  photo_url: string;
  caption?: string | null;
  location?: string | null;
  notes?: string | null;
  sort_order?: number | null;
};

// ── Supplemental signed-document pages ───────────────────────────────────────

const esc = (s: string | null | undefined) =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Gmail and most webmail clients refuse to load data: URIs in <img>, so the
// signatures arrived as broken-image alt text. Hoisting them into inline (cid)
// attachments makes them render, and unlike hosting them in a public bucket it
// keeps signature images out of any guessable URL.
type InlineImage = { filename: string; content: string; contentType: string; cid: string };
const inlineDataImages = (html: string): { html: string; images: InlineImage[] } => {
  const images: InlineImage[] = [];
  const out = html.replace(
    /src="data:(image\/[a-zA-Z0-9.+-]+);base64,([^"]+)"/g,
    (_match, mime: string, b64: string) => {
      const idx = images.length + 1;
      const ext = mime.split('/')[1].replace('+xml', '').replace('jpeg', 'jpg');
      const cid = `img${idx}.${Date.now()}@quotemgr`;
      images.push({ filename: `signature-${idx}.${ext}`, content: b64, contentType: mime, cid });
      return `src="cid:${cid}"`;
    },
  );
  return { html: out, images };
};

const sigImgOrBlank = (data: string | null | undefined) =>
  data
    ? `<img src="${esc(data)}" alt="Signature" style="max-width:200px;max-height:70px;object-fit:contain;display:block;margin-bottom:4px">`
    : `<div style="width:200px;height:50px;border-bottom:1.5px solid #374151;margin-bottom:4px"></div>`;

const buildContingencyPagesHtml = (q: Record<string, any>, companyName: string, customerName: string, includeCancel = true): string => {
  const fDate = formatDate(q.contingency_signed_at);
  const fCancelDate = formatDate(q.contingency_cancel_signed_at || q.contingency_signed_at);
  const signedBy = esc(q.contingency_signed_by || customerName);
  const hasCancelSig = !!q.contingency_cancel_signature_data;

  return `
  <div style="border-top:2px dashed #ccc;margin:40px 0"></div>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
    <tr>
      <td style="font-size:11px;font-style:italic;color:#555">LEGAL DOCUMENT — NOT FOR REPRODUCTION</td>
      <td style="text-align:right;font-size:11px;font-style:italic;color:#555">Insurance Contingency Agreement</td>
    </tr>
  </table>

  <h2 style="font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px;color:#111">
    Insurance Contingency Agreement
  </h2>
  <p style="font-size:13px;font-weight:700;margin:0 0 20px;color:#444">Signed Copy — ${esc(companyName)}</p>

  <div style="border:1.5px solid #111;border-radius:6px;padding:18px 22px;margin:0 0 20px">
    <p style="margin:0 0 10px;font-weight:700;font-size:13px">CONTINGENCY AGREEMENT</p>
    <p style="font-size:12px;line-height:1.8;margin:0 0 10px;color:#333">
      The undersigned Property Owner hereby authorizes <strong>${esc(companyName)}</strong> (the "Contractor") to perform
      work as specified in the Inspection Report and/or Scope of Work, contingent upon approval by the insurance company.
      The Contractor agrees to represent the Property Owner in negotiating with the insurance company and to perform all
      approved work at the final insurance settlement amount. No additional cost will be charged to the Property Owner
      beyond the deductible, unless the Property Owner requests upgrades or additional work not covered by insurance.
    </p>
    <p style="font-size:12px;line-height:1.8;margin:0;color:#333">
      This agreement is contingent upon insurance approval. If the claim is denied, neither party is obligated to
      proceed, and the Property Owner owes nothing for any inspections or estimates performed.
    </p>
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">
    <tr valign="top">
      <td style="width:48%;padding-right:16px">
        <p style="font-weight:900;font-size:13px;margin:0 0 4px">CONTRACTOR: ${esc(companyName)}</p>
        <p style="font-size:12px;text-decoration:underline;color:#555;margin:0 0 6px">Authorized Representative</p>
        ${sigImgOrBlank(q.contractor_signature_data)}
        <p style="font-size:11px;color:#374151;font-weight:600;margin:0 0 2px">${esc(q.contractor_signed_by || companyName)}</p>
        ${q.contractor_signed_at ? `<p style="font-size:10px;color:#6b7280;margin:0">Date: ${formatDate(q.contractor_signed_at)}</p>` : ''}
      </td>
      <td style="width:48%;padding-left:16px;border-left:1px solid #e5e7eb">
        <p style="font-weight:900;font-size:13px;margin:0 0 4px">PROPERTY OWNER: ${esc(customerName)}</p>
        <p style="font-size:12px;text-decoration:underline;color:#555;margin:0 0 6px">Customer Signature</p>
        ${sigImgOrBlank(q.contingency_signature_data)}
        <p style="font-size:11px;color:#374151;font-weight:600;margin:0 0 2px">${signedBy}</p>
        <p style="font-size:10px;color:#6b7280;margin:0">Date: ${fDate}</p>
      </td>
    </tr>
  </table>

  ${includeCancel && hasCancelSig ? `
  <div style="border-top:2px dashed #ccc;margin:32px 0"></div>

  <div style="border:1.5px solid #111;border-radius:6px;padding:18px 22px;margin:0 0 20px">
    <p style="margin:0 0 10px;font-weight:700;font-size:13px">THREE-DAY RIGHT TO CANCEL</p>
    <p style="font-size:12px;line-height:1.8;margin:0;color:#333">
      You, the buyer, may cancel this transaction at any time prior to midnight of the third business day after
      the date of this transaction. See the attached notice of cancellation form for an explanation of this right.
      By signing below, the Property Owner acknowledges receipt of this notice and understands their right to cancel
      within three (3) business days.
    </p>
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px">
    <tr valign="top">
      <td style="width:60%">
        <p style="font-size:12px;text-decoration:underline;color:#555;margin:0 0 6px">Property Owner Signature — Acknowledging Receipt</p>
        ${sigImgOrBlank(q.contingency_cancel_signature_data)}
        <p style="font-size:11px;color:#374151;font-weight:600;margin:0 0 2px">${signedBy}</p>
        <p style="font-size:10px;color:#6b7280;margin:0">Date: ${fCancelDate}</p>
      </td>
    </tr>
  </table>` : ''}`;
};

const buildRetailSigPageHtml = (q: Record<string, any>, companyName: string, customerName: string, includeCancel = true): string => {
  const fDate = formatDate(q.signed_at);
  const signedBy = esc(q.signed_by || customerName);
  const hasCancelSig = !!q.cancel_signature_data;

  // Resolve selected tier label + amount
  const tierKey = (q.selected_tier || 'good') as string;
  const tierLabels: Record<string, string> = { good: 'Good', better: 'Better', best: 'Best' };
  const useManual = !!q.use_manual_totals;
  const tierTotals: Record<string, number> = {
    good:   (useManual && q.manual_good_total   != null ? q.manual_good_total   : q.good_total)   ?? 0,
    better: (useManual && q.manual_better_total != null ? q.manual_better_total : q.better_total) ?? 0,
    best:   (useManual && q.manual_best_total   != null ? q.manual_best_total   : q.best_total)   ?? 0,
  };
  const tierAmount = tierTotals[tierKey] || tierTotals['good'] || 0;
  const fAmount = tierAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const tierLabel = tierLabels[tierKey] || tierKey;

  return `
  <div style="border-top:2px dashed #ccc;margin:40px 0"></div>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
    <tr>
      <td style="font-size:11px;font-style:italic;color:#555">LEGAL DOCUMENT — NOT FOR REPRODUCTION</td>
      <td style="text-align:right;font-size:11px;font-style:italic;color:#555">Customer Service Agreement</td>
    </tr>
  </table>

  <h2 style="font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px;color:#111">
    Customer Service Agreement
  </h2>
  <p style="font-size:13px;font-weight:700;margin:0 0 20px;color:#444">Signed Copy — ${esc(companyName)}</p>

  <div style="border:1.5px solid #111;border-radius:6px;padding:18px 22px;margin:0 0 20px">
    <p style="margin:0 0 6px;font-weight:700;font-size:13px">CUSTOMER SELECTION</p>
    <table cellpadding="0" cellspacing="0">
      <tr><td style="padding:4px 16px 4px 0;font-weight:700;font-size:13px">Selected Package:</td><td style="font-size:13px">${esc(tierLabel)}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;font-weight:700;font-size:13px">Agreed Price:</td><td style="font-size:13px;font-weight:700">${fAmount}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;font-weight:700;font-size:13px">Date Signed:</td><td style="font-size:13px">${fDate}</td></tr>
    </table>
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">
    <tr valign="top">
      <td style="width:48%;padding-right:16px">
        <p style="font-weight:900;font-size:13px;margin:0 0 4px">CONTRACTOR: ${esc(companyName)}</p>
        <p style="font-size:12px;text-decoration:underline;color:#555;margin:0 0 6px">Authorized Representative</p>
        <div style="width:200px;height:50px;margin-bottom:4px"></div>
        <p style="font-size:11px;color:#374151;font-weight:600;margin:0">${esc(companyName)}</p>
      </td>
      <td style="width:48%;padding-left:16px;border-left:1px solid #e5e7eb">
        <p style="font-weight:900;font-size:13px;margin:0 0 4px">CUSTOMER: ${esc(customerName)}</p>
        <p style="font-size:12px;text-decoration:underline;color:#555;margin:0 0 6px">Customer Signature</p>
        ${sigImgOrBlank(q.signature_data)}
        <p style="font-size:11px;color:#374151;font-weight:600;margin:0 0 2px">${signedBy}</p>
        <p style="font-size:10px;color:#6b7280;margin:0">Date: ${fDate}</p>
      </td>
    </tr>
  </table>

  ${includeCancel && hasCancelSig ? `
  <div style="border-top:2px dashed #ccc;margin:32px 0"></div>

  <div style="border:1.5px solid #111;border-radius:6px;padding:18px 22px;margin:0 0 20px">
    <p style="margin:0 0 10px;font-weight:700;font-size:13px">THREE-DAY RIGHT TO CANCEL</p>
    <p style="font-size:12px;line-height:1.8;margin:0;color:#333">
      You, the buyer, may cancel this transaction at any time prior to midnight of the third business day after
      the date of this transaction. See the attached notice of cancellation form for an explanation of this right.
      By signing below, the Customer acknowledges receipt of this notice and understands their right to cancel
      within three (3) business days.
    </p>
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px">
    <tr valign="top">
      <td style="width:60%">
        <p style="font-size:12px;text-decoration:underline;color:#555;margin:0 0 6px">Customer Signature — Acknowledging Receipt</p>
        ${sigImgOrBlank(q.cancel_signature_data)}
        <p style="font-size:11px;color:#374151;font-weight:600;margin:0 0 2px">${signedBy}</p>
        <p style="font-size:10px;color:#6b7280;margin:0">Date: ${fDate}</p>
      </td>
    </tr>
  </table>` : ''}`;
};

const buildCertificateHtml = (data: {
  companyName: string;
  companyLogoUrl: string | null;
  companyAddress: string;
  companyPhone: string;
  companyLicense: string;
  customerName: string;
  contractorSignedBy: string;
  contractorSignatureData: string | null;
  customerSignatureData: string | null;
  completionDate: string;       // ISO
  generatedAt: string;          // ISO
  documentId: string;
  verHash: string;
  photos?: CertPhoto[];
}): string => {
  const {
    companyName, companyLogoUrl, companyAddress, companyPhone, companyLicense,
    customerName, contractorSignedBy,
    contractorSignatureData, customerSignatureData,
    completionDate, generatedAt, documentId, verHash,
    photos = [],
  } = data;

  const fDate  = formatDate(completionDate);
  const fGenAt = formatDateTime(generatedAt);

  const logoHtml = companyLogoUrl
    ? `<img src="${companyLogoUrl}" alt="${companyName} logo"
           style="max-width:180px;max-height:100px;object-fit:contain;display:block;margin:0 auto 24px">`
    : `<div style="font-size:24px;font-weight:900;color:#111;text-align:center;margin-bottom:24px">${companyName}</div>`;

  const contractorSigHtml = contractorSignatureData
    ? `<img src="${contractorSignatureData}" alt="Contractor Signature"
           style="max-width:200px;max-height:80px;object-fit:contain;display:block">`
    : `<div style="width:200px;height:60px;border:1px solid #ccc;border-radius:4px"></div>`;

  const customerSigHtml = customerSignatureData
    ? `<img src="${customerSignatureData}" alt="Customer Signature"
           style="max-width:200px;max-height:80px;object-fit:contain;display:block">`
    : `<div style="width:200px;height:60px;border:1px solid #ccc;border-radius:4px"></div>`;

  const pageHeaderHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
      <tr>
        <td style="font-size:11px;font-style:italic;color:#555">LEGAL DOCUMENT — NOT FOR REPRODUCTION</td>
        <td style="text-align:right">
          <div style="font-size:11px;font-style:italic;color:#555">Certificate of Completion</div>
        </td>
      </tr>
    </table>`;

  const pageFooterHtml = (page: number, total: number) => `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;border-top:1px solid #aaa;padding-top:8px">
      <tr>
        <td style="font-size:10px;color:#666">
          Document ID: ${documentId}<br>
          Verification Hash: ${verHash}<br>
          Generated: ${fGenAt}
        </td>
        <td style="text-align:right;font-size:10px;color:#666">
          Page ${page} of ${total}<br>
          <strong>${companyName}</strong>
        </td>
      </tr>
    </table>`;

  const divider = `<hr style="border:none;border-top:1.5px solid #111;margin:20px 0">`;
  const sectionHead = (title: string) =>
    `<h2 style="font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;margin:28px 0 12px;color:#111">${title}</h2>`;

  const boxStyle = 'border:1.5px solid #111;border-radius:6px;padding:18px 22px;margin:0 0 20px';

  const completionBullets = `
    <div style="${boxStyle}">
      <p style="margin:0 0 10px;font-weight:700;font-size:13px">
        The Contractor, ${companyName}, hereby certifies that:
      </p>
      <ul style="margin:0;padding-left:22px;font-size:13px;line-height:1.9">
        <li>All work specified in the Customer Service Agreement and Contingency Agreement
            has been completed in accordance with the terms and conditions of said agreement.</li>
        <li>All work has been performed in a workmanlike manner and in accordance with
            industry standards and applicable building codes.</li>
        <li>All materials used in the performance of the work are of good quality and suitable for
            their intended purpose.</li>
        <li>The work site has been cleaned and left in a safe and orderly condition.</li>
        <li>All permits and inspections required by local authorities have been obtained and
            completed.</li>
      </ul>
    </div>`;

  const customerAckBullets = `
    <div style="padding-left:8px;margin-bottom:20px">
      <p style="font-weight:700;font-size:13px;margin:0 0 10px">
        The Customer, ${customerName}, hereby acknowledges that:
      </p>
      <ul style="margin:0;padding-left:22px;font-size:13px;line-height:1.9">
        <li>All work described in the Customer Service Agreement and Contingency Agreement
            has been completed to my satisfaction.</li>
        <li>I have inspected the completed work and found it to be satisfactory.</li>
        <li>I have no outstanding complaints or concerns regarding the quality of the work performed.</li>
        <li>I understand that by signing this Certificate, I am accepting the work as complete
            and releasing the Contractor from further obligations, except as provided in the
            warranty section of the original agreement.</li>
      </ul>
    </div>`;

  const executionBox = `
    <div style="${boxStyle}">
      <p style="font-weight:700;font-size:13px;margin:0 0 8px">EXECUTION STATEMENT</p>
      <p style="font-size:12px;color:#333;margin:0;line-height:1.7">
        This Certificate has been executed by both parties on the date(s) indicated below. The signatures below
        represent the legal acknowledgment that all work has been completed to the satisfaction of both parties.
      </p>
    </div>`;

  // ── Assemble HTML ──────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Certificate of Completion — ${companyName}</title>
  <style>
    @media print {
      /* Pin the sheet. Without a size the browser decides, and the certificate
         is the document homeowners most often print for their records. */
      @page { size: letter portrait; margin: 0.5in; }
      body { background: #fff !important; }
      table { page-break-inside: auto; }
      tr.photo-row { page-break-inside: avoid; break-inside: avoid; page-break-after: auto; }
    }
  </style>
</head>
<body style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111;background:#f3f4f6;margin:0;padding:0">
<table width="100%" bgcolor="#f3f4f6" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:680px;background:#fff;border:1px solid #ddd;border-radius:8px;padding:40px"
       cellpadding="0" cellspacing="0">
<tr><td style="padding:40px 48px">

  <!-- ===== PAGE 1 ===== -->
  ${pageHeaderHtml}

  <!-- Logo -->
  ${logoHtml}

  <!-- Main title -->
  <h1 style="font-size:32px;font-weight:900;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;color:#111">
    Certificate of Completion
  </h1>
  <p style="font-size:14px;font-weight:700;margin:0 0 4px">Certificate No. ${documentId}</p>
  <p style="font-size:11px;color:#444;margin:0 0 20px">Verification Hash: ${verHash}</p>

  ${divider}

  <p style="font-size:13px;line-height:1.8;margin:20px 0">
    This Certificate of Completion (&ldquo;Certificate&rdquo;) certifies that all work described in the Customer
    Service Agreement and Contingency Agreement dated ${fDate} has been
    completed to the satisfaction of both parties.
  </p>

  ${sectionHead('Project Information')}
  <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;padding-left:8px">
    <tr><td style="padding:6px 16px 6px 0;font-weight:700;min-width:160px">Contractor:</td><td>${companyName}</td></tr>
    <tr><td style="padding:6px 16px 6px 0;font-weight:700">Completion Date:</td><td>${fDate}</td></tr>
    ${companyAddress ? `<tr><td style="padding:6px 16px 6px 0;font-weight:700">Address:</td><td>${companyAddress}</td></tr>` : ''}
    ${companyPhone   ? `<tr><td style="padding:6px 16px 6px 0;font-weight:700">Phone:</td><td>${companyPhone}</td></tr>` : ''}
  </table>

  ${sectionHead('Completion Statement')}
  ${completionBullets}

  ${pageFooterHtml(1, photos.length > 0 ? 4 : 3)}

  <!-- ===== PAGE 2 ===== -->
  <div style="border-top:2px dashed #ccc;margin:40px 0"></div>
  ${pageHeaderHtml}

  ${sectionHead('Customer Acknowledgment')}
  ${customerAckBullets}
  ${executionBox}

  ${pageFooterHtml(2, photos.length > 0 ? 4 : 3)}

  <!-- ===== PAGE 3 ===== -->
  <div style="border-top:2px dashed #ccc;margin:40px 0"></div>
  ${pageHeaderHtml}

  <!-- Signature blocks -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 32px">
    <tr valign="top">
      <!-- Contractor -->
      <td style="width:48%;padding-right:16px">
        <p style="font-weight:900;font-size:13px;margin:0 0 6px">CONTRACTOR:</p>
        <p style="font-weight:700;font-size:14px;text-decoration:underline;margin:0 0 4px">${companyName}</p>
        ${companyLicense ? `<p style="font-size:12px;color:#444;margin:0 0 14px">License #: ${companyLicense}</p>` : '<div style="margin-bottom:14px"></div>'}
        <p style="font-size:12px;text-decoration:underline;color:#555;margin:0 0 6px">Authorized Signature</p>
        ${contractorSigHtml}
        <p style="font-weight:700;font-size:13px;margin:14px 0 2px">${contractorSignedBy || companyName}</p>
        <p style="font-size:12px;text-decoration:underline;color:#555;margin:0 0 12px">Printed Name</p>
        <p style="font-size:13px;margin:0 0 2px;border-bottom:1px solid #111;display:inline-block;padding-bottom:2px">${fDate}</p>
        <p style="font-size:12px;text-decoration:underline;color:#555;margin:4px 0 0">Date Executed</p>
      </td>

      <!-- Customer -->
      <td style="width:48%;padding-left:16px;border-left:1px solid #e5e7eb">
        <p style="font-weight:900;font-size:13px;margin:0 0 20px">CUSTOMER:</p>
        <p style="font-size:12px;text-decoration:underline;color:#555;margin:0 0 6px">Customer Signature</p>
        ${customerSigHtml}
        <p style="font-size:13px;font-weight:700;margin:14px 0 2px">${customerName}</p>
        <p style="font-size:12px;text-decoration:underline;color:#555;margin:0 0 12px">Printed Name</p>
        <p style="font-size:13px;margin:0 0 2px;border-bottom:1px solid #111;display:inline-block;padding-bottom:2px">${fDate}</p>
        <p style="font-size:12px;text-decoration:underline;color:#555;margin:4px 0 0">Date Executed</p>
      </td>
    </tr>
  </table>

  <!-- Legal Acknowledgment -->
  <div style="${boxStyle};margin-bottom:16px">
    <p style="font-weight:700;font-size:13px;margin:0 0 8px">LEGAL ACKNOWLEDGMENT</p>
    <p style="font-size:12px;font-style:italic;color:#333;margin:0;line-height:1.8">
      By signing below, I acknowledge that all work described in the Customer Service Agreement and Contingency
      Agreement has been completed to my satisfaction. I understand that this is a legally binding document and that
      my signature represents my acceptance of the completed work and release of the Contractor from further
      obligations, except as provided in the warranty section of the original agreement.
    </p>
  </div>

  <!-- Legal Compliance -->
  <div style="${boxStyle}">
    <p style="font-weight:700;font-size:12px;margin:0 0 6px">LEGAL COMPLIANCE AND VERIFICATION</p>
    <p style="font-size:12px;color:#333;margin:0 0 10px;line-height:1.7">
      This document has been executed in accordance with applicable state and federal laws. The signatures contained herein are
      authentic and represent the voluntary agreement of both parties. This document may be used as evidence in legal
      proceedings and is admissible in a court of law.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:12px;font-weight:700">Document ID: ${documentId}</td>
        <td style="text-align:right;font-size:12px">Hash: ${verHash}</td>
      </tr>
    </table>
  </div>

  ${pageFooterHtml(3, photos.length > 0 ? 4 : 3)}

  ${photos.length > 0 ? `
  <!-- ===== PAGE 4: Photo Report ===== -->
  <div style="border-top:2px dashed #ccc;margin:40px 0"></div>
  ${pageHeaderHtml}

  ${sectionHead('Completion Photo Report')}
  <p style="font-size:13px;color:#555;margin:0 0 20px;line-height:1.7">
    The following photographs document the completed work for this project. These images were
    taken at the time of project completion and are submitted as part of this Certificate of Completion.
  </p>

  <table width="100%" cellpadding="0" cellspacing="12" style="border-collapse:separate">
    ${photos.map((p, i) => i % 2 === 0 ? `
    <tr class="photo-row" style="page-break-inside:avoid;break-inside:avoid">
      <td width="48%" style="vertical-align:top;padding-right:8px">
        <div style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
          <img src="${p.photo_url}" alt="${p.caption || 'Completion photo'}"
               style="width:100%;height:180px;object-fit:cover;display:block">
          ${(p.caption || p.location || p.notes) ? `
          <div style="padding:10px 12px;background:#f9fafb">
            ${p.caption ? `<p style="margin:0 0 4px;font-weight:700;font-size:12px;color:#111">${p.caption}</p>` : ''}
            ${p.location ? `<p style="margin:0 0 2px;font-size:11px;color:#6b7280">📍 ${p.location}</p>` : ''}
            ${p.notes ? `<p style="margin:0;font-size:11px;color:#6b7280;font-style:italic">${p.notes}</p>` : ''}
          </div>` : ''}
        </div>
      </td>
      ${photos[i + 1] ? `
      <td width="48%" style="vertical-align:top;padding-left:8px">
        <div style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
          <img src="${photos[i + 1].photo_url}" alt="${photos[i + 1].caption || 'Completion photo'}"
               style="width:100%;height:180px;object-fit:cover;display:block">
          ${(photos[i + 1].caption || photos[i + 1].location || photos[i + 1].notes) ? `
          <div style="padding:10px 12px;background:#f9fafb">
            ${photos[i + 1].caption ? `<p style="margin:0 0 4px;font-weight:700;font-size:12px;color:#111">${photos[i + 1].caption}</p>` : ''}
            ${photos[i + 1].location ? `<p style="margin:0 0 2px;font-size:11px;color:#6b7280">📍 ${photos[i + 1].location}</p>` : ''}
            ${photos[i + 1].notes ? `<p style="margin:0;font-size:11px;color:#6b7280;font-style:italic">${photos[i + 1].notes}</p>` : ''}
          </div>` : ''}
        </div>
      </td>` : '<td width="48%"></td>'}
    </tr>` : '').filter(Boolean).join('')}
  </table>

  <p style="font-size:11px;color:#9ca3af;margin:20px 0 0;text-align:center">
    ${photos.length} photo${photos.length !== 1 ? 's' : ''} submitted · ${companyName}
  </p>

  ${pageFooterHtml(4, 4)}
  ` : ''}

</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
};

// ── Email wrapper ─────────────────────────────────────────────────────────────

const buildEmailHtml = (data: {
  companyName: string;
  customerName: string;
  documentId: string;
  certificateHtml: string;
  replyTo?: string;
  signingUrl?: string;
  isSignedCopy?: boolean;
  certViewUrl?: string;
  supplementalHtml?: string;
}): string => {
  const { companyName, customerName, documentId, certificateHtml, replyTo, signingUrl, isSignedCopy, certViewUrl, supplementalHtml } = data;

  const signCta = signingUrl ? `
      <!-- Sign CTA -->
      <tr>
        <td style="background:#f0fdf4;padding:20px 36px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;border-top:1px solid #d1fae5">
          <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#065f46">Action Required: Please Sign Your Certificate</p>
          <p style="margin:0 0 14px;font-size:13px;color:#047857;line-height:1.6">
            To make this certificate official, we need your electronic signature. It only takes 30 seconds — click the button below to review and sign.
          </p>
          <div style="text-align:center">
            <a href="${signingUrl}"
               style="display:inline-block;background:#16a34a;color:#fff;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px">
              ✍️ Sign Certificate →
            </a>
          </div>
          <p style="margin:12px 0 0;font-size:11px;color:#9ca3af;text-align:center">
            Or copy this link: <a href="${signingUrl}" style="color:#6b7280">${signingUrl}</a>
          </p>
        </td>
      </tr>
  ` : '';

  const viewCta = isSignedCopy && certViewUrl ? `
      <!-- View/Print CTA -->
      <tr>
        <td style="background:#fffbeb;padding:20px 36px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;border-top:1px solid #fde68a">
          <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#92400e">Save Your Signed Certificate</p>
          <p style="margin:0 0 14px;font-size:13px;color:#b45309;line-height:1.6">
            Click the button below to view your fully signed certificate. Use your browser's Print function to save it as a PDF for your records.
          </p>
          <div style="text-align:center">
            <a href="${certViewUrl}"
               style="display:inline-block;background:#d97706;color:#fff;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px">
              🖨️ View &amp; Print Certificate →
            </a>
          </div>
        </td>
      </tr>
  ` : '';

  const introText = isSignedCopy
    ? `Thank you for choosing <strong>${companyName}</strong>. Your Completion Certificate has been signed by both parties — a copy is attached below for your records.`
    : `Thank you for choosing <strong>${companyName}</strong>. Your project has been completed and your Certificate of Completion is ready for your review and signature.`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:0">
  <table width="100%" bgcolor="#f3f4f6" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:24px 16px">
    <table width="100%" style="max-width:700px" cellpadding="0" cellspacing="0">

      <!-- Header -->
      <tr>
        <td style="background:#1e3a5f;padding:24px 36px;border-radius:10px 10px 0 0">
          <p style="margin:0 0 2px;color:#93c5fd;font-size:11px;text-transform:uppercase;letter-spacing:1px">${isSignedCopy ? 'Signed Certificate of Completion' : 'Certificate of Completion'}</p>
          <h2 style="margin:0;color:#fff;font-size:20px">${companyName}</h2>
        </td>
      </tr>

      <!-- Intro -->
      <tr>
        <td style="background:#fff;padding:28px 36px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
          <p style="margin:0 0 16px;font-size:15px;color:#374151">Hello ${customerName},</p>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7">
            ${introText}
          </p>
          <p style="margin:0 0 4px;font-size:12px;color:#9ca3af">Document ID: ${documentId}</p>
          ${replyTo ? `<p style="margin:0 0 20px;font-size:13px;color:#374151">Questions? Reply to this email or contact us at <a href="mailto:${replyTo}" style="color:#1e3a5f">${replyTo}</a>.</p>` : ''}
        </td>
      </tr>

      ${signCta}
      ${viewCta}

      <!-- Certificate body -->
      <tr>
        <td style="padding:0;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
          ${certificateHtml}
        </td>
      </tr>

      ${supplementalHtml ? `
      <!-- Supplemental signed documents -->
      <tr>
        <td style="padding:0 48px 40px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111">
          ${supplementalHtml}
        </td>
      </tr>` : ''}

      <!-- Footer -->
      <tr>
        <td style="background:#f9fafb;padding:16px 36px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px">
          <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;line-height:1.8">
            This certificate was issued by <strong>${companyName}</strong> via QuoteMGR.<br>
            This is a legally binding document — please retain it for your records.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
  </table>
</body>
</html>`;
};

// ── Contractor alert email ────────────────────────────────────────────────────

const buildContractorAlertHtml = (data: {
  companyName: string;
  customerName: string;
  customerEmail: string;
  documentId: string;
  sentAt: string;
  dashboardUrl: string;
}): string => {
  const { companyName, customerName, customerEmail, documentId, sentAt, dashboardUrl } = data;
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
  <table width="100%" bgcolor="#f4f4f4" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:20px">
  <table width="100%" style="max-width:600px;background:#fff" cellpadding="0" cellspacing="0">
    <tr>
      <td style="background:#1e3a5f;padding:24px 32px;border-radius:8px 8px 0 0">
        <p style="margin:0 0 2px;color:#93c5fd;font-size:11px;text-transform:uppercase;letter-spacing:1px">Sent Confirmation</p>
        <h2 style="margin:0;color:#fff;font-size:18px">Completion Certificate Sent</h2>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p style="margin:0 0 16px;font-size:14px;color:#374151">
          ✅ The Completion Certificate for <strong>${customerName}</strong> (${customerEmail}) has been sent successfully.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:20px">
          <tr><td style="padding:12px 16px;border-bottom:1px solid #f3f4f6">
            <span style="font-size:11px;color:#9ca3af;display:block;margin-bottom:2px">Customer</span>
            <span style="font-size:14px;font-weight:600">${customerName}</span>
            <span style="font-size:12px;color:#6b7280"> · ${customerEmail}</span>
          </td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #f3f4f6">
            <span style="font-size:11px;color:#9ca3af;display:block;margin-bottom:2px">Document ID</span>
            <span style="font-size:14px;font-weight:600">${documentId}</span>
          </td></tr>
          <tr><td style="padding:12px 16px">
            <span style="font-size:11px;color:#9ca3af;display:block;margin-bottom:2px">Sent At</span>
            <span style="font-size:14px">${formatDateTime(sentAt)}</span>
          </td></tr>
        </table>
        <div style="text-align:center;margin-bottom:16px">
          <a href="${dashboardUrl}" style="background:#1e3a5f;color:#fff;padding:11px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">
            View in Dashboard →
          </a>
        </div>
        <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center">
          ${companyName} · Certificate of Completion
        </p>
      </td>
    </tr>
  </table>
  </td></tr>
  </table>
</body>
</html>`;
};

// ── Contingency-only email wrapper ────────────────────────────────────────────

// When a PDF is attached the email is a short cover note: the agreement is the
// attachment, which is what the homeowner can actually save and forward. The
// inline copy is the fallback for when PDF generation failed, so a send never
// goes out with no document at all.
const buildContingencyOnlyEmailHtml = (data: {
  companyName: string;
  customerName: string;
  contingencyHtml: string;
  replyTo?: string;
  attachmentName?: string;
}): string => {
  const { companyName, customerName, contingencyHtml, replyTo, attachmentName } = data;
  const hasAttachment = !!attachmentName;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:0">
  <table width="100%" bgcolor="#f3f4f6" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:24px 16px">
    <table width="100%" style="max-width:700px" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#1e3a5f;padding:24px 36px;border-radius:10px 10px 0 0">
          <p style="margin:0 0 2px;color:#93c5fd;font-size:11px;text-transform:uppercase;letter-spacing:1px">Signed Documents</p>
          <h2 style="margin:0;color:#fff;font-size:20px">${companyName}</h2>
        </td>
      </tr>
      <tr>
        <td style="background:#fff;padding:28px 36px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
          <p style="margin:0 0 16px;font-size:15px;color:#374151">Hello ${customerName},</p>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7">
            Thank you for choosing <strong>${companyName}</strong>. Your signed Contingency Agreement is
            ${hasAttachment
              ? `attached to this email as a PDF (<strong>${attachmentName}</strong>). Please download and keep it for your records.`
              : 'shown below for your records.'}
          </p>
          ${replyTo ? `<p style="margin:0 0 20px;font-size:13px;color:#374151">Questions? Reply to this email or contact us at <a href="mailto:${replyTo}" style="color:#1e3a5f">${replyTo}</a>.</p>` : ''}
        </td>
      </tr>
      ${hasAttachment ? '' : `
      <tr>
        <td style="padding:0 48px 40px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111">
          ${contingencyHtml}
        </td>
      </tr>`}
      <tr>
        <td style="background:#f9fafb;padding:16px 36px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px">
          <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;line-height:1.8">
            This document was issued by <strong>${companyName}</strong> via QuoteMGR.<br>
            This is a legally binding document — please retain it for your records.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
  </table>
</body>
</html>`;
};

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      quote_id: string;
      company_id?: string;
      dashboard_url?: string;
      is_signed_copy?: boolean;
      selected_photos?: CertPhoto[];
      include_contingency?: boolean;
      include_cancel?: boolean;
      contingency_only?: boolean;
      extra_recipients?: string[];
      share_token?: string;
      pdf_base64?: string;
      pdf_filename?: string;
    };

    if (!body.quote_id) {
      return new Response(JSON.stringify({ error: 'Missing quote_id' }), { status: 400, headers: corsHeaders });
    }

    // ── Auth gate: team member OR internal service-to-service call ───────────
    const admin = getSupabaseAdmin();
    const authHeader = req.headers.get('authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!bearerToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // Allow calls from sign-certificate (or other edge functions) using the service role key
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const isInternalCall = serviceRoleKey && bearerToken === serviceRoleKey;

    // Allow sending to extra_recipients only, authenticated by the quote's share_token
    // This lets internal systems forward a copy without needing a user session.
    const isExtraRecipientsOnlyCall = !!(
      body.share_token &&
      body.extra_recipients?.length &&
      !body.contingency_only &&
      !isInternalCall
    );

    if (!isInternalCall && !isExtraRecipientsOnlyCall) {
      const { data: { user: authUser } } = await admin.auth.getUser(bearerToken);
      if (!authUser) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }

      const { data: member } = await admin
        .from('team_members')
        .select('id')
        .eq('user_id', authUser.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!member) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
    }

    // ── Load quote with customer, company, and signatures ────────────────────
    const { data: quote, error: quoteErr } = await admin
      .from('quotes')
      .select(`
        id, quote_number, status, share_token, project_type,
        signed_at, signed_by, signature_data, cancel_signature_data,
        contractor_signature_data, contractor_signed_by, contractor_signed_at,
        certificate_customer_signature_data, certificate_customer_signed_at,
        completion_certificate_enabled,
        contingency_enabled,
        contingency_signature_data, contingency_signed_by, contingency_signed_at,
        contingency_cancel_signature_data, contingency_cancel_signed_at,
        selected_tier, use_manual_totals,
        good_total, better_total, best_total,
        manual_good_total, manual_better_total, manual_best_total,
        project_description, cover_page_title,
        customer:customers(first_name, last_name, email),
        company:companies(
          id, name, logo_url, address, phone, email, license_number,
          quote_sender_name, quote_sender_email, quote_reply_to_email,
          email_send_mode, connected_mail_provider,
          smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password
        )
      `)
      .eq('id', body.quote_id)
      .single();

    if (quoteErr || !quote) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), { status: 404, headers: corsHeaders });
    }

    // Validate share_token for extra-recipients-only calls
    if (isExtraRecipientsOnlyCall && (quote as any).share_token !== body.share_token) {
      return new Response(JSON.stringify({ error: 'Invalid share token' }), { status: 401, headers: corsHeaders });
    }

    const company = quote.company as Record<string, any>;
    const customer = quote.customer as Record<string, any> | null;
    const q = quote as Record<string, any>;

    const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') || quote.signed_by || 'Valued Customer';
    const customerEmail = customer?.email;

    if (!customerEmail) {
      return new Response(JSON.stringify({ error: 'No customer email on file for this quote' }), { status: 422, headers: corsHeaders });
    }

    // ── Contingency-only send path ───────────────────────────────────────────
    if (body.contingency_only === true) {
      if (!q.contingency_signature_data) {
        return new Response(JSON.stringify({ error: 'No signed contingency agreement found for this quote' }), { status: 422, headers: corsHeaders });
      }

      const includeCancel = body.include_cancel !== false;
      const contingencyDocHtml = buildContingencyPagesHtml(q, company.name, customerName, includeCancel);

      const resendKey       = Deno.env.get('RESEND_API_KEY');
      const defaultFromEmail = Deno.env.get('ALERT_FROM_EMAIL') || '';
      const normalizeEmail = (e?: string | null) => e?.trim().toLowerCase() || '';
      const getEmailDomain = (e?: string | null) => {
        const n = normalizeEmail(e);
        return n.includes('@') ? n.split('@').pop() || null : null;
      };
      const parseAllowedDomains = (v?: string | null) =>
        (v || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);

      const senderName    = company.quote_sender_name?.trim() || company.name || 'QuoteMGR';
      const requestedFrom = normalizeEmail(company.quote_sender_email);
      const replyTo       = company.quote_reply_to_email?.trim() || requestedFrom || undefined;
      const subject       = `Your Signed Contingency Agreement — ${company.name}`;

      const pdfName = body.pdf_filename || `Contingency-Agreement-${quote.quote_number ?? 'document'}.pdf`;

      const { html: emailHtml, images: inlineImages } = inlineDataImages(
        buildContingencyOnlyEmailHtml({
          companyName: company.name,
          customerName,
          contingencyHtml: contingencyDocHtml,
          replyTo,
          attachmentName: body.pdf_base64 ? pdfName : undefined,
        }),
      );

      const buildFrom = (name: string, email: string) => name ? `${name} <${email}>` : email;

      const resendAttachmentList = [
        ...(body.pdf_base64 ? [{ filename: pdfName, content: body.pdf_base64 }] : []),
        ...inlineImages.map(img => ({
          filename: img.filename,
          content: img.content,
          content_type: img.contentType,
          content_id: img.cid,
        })),
      ];
      const smtpAttachmentList = [
        ...(body.pdf_base64 ? [{ filename: pdfName, content: body.pdf_base64, encoding: 'base64' }] : []),
        ...inlineImages.map(img => ({
          filename: img.filename,
          content: img.content,
          encoding: 'base64',
          contentType: img.contentType,
          cid: img.cid,
        })),
      ];
      const resendAttachments = resendAttachmentList.length ? resendAttachmentList : undefined;
      const smtpAttachments = smtpAttachmentList.length ? smtpAttachmentList : undefined;

      if (
        company.email_send_mode === 'smtp' &&
        company.smtp_host && company.smtp_port &&
        company.smtp_username && company.smtp_password
      ) {
        const nodemailer = (await import('npm:nodemailer@6.10.0')).default;
        const smtpUser = normalizeEmail(company.smtp_username);
        const smtpFrom = (company.connected_mail_provider === 'gmail' || company.connected_mail_provider === 'outlook')
          ? smtpUser : (requestedFrom || smtpUser);
        const transporter = nodemailer.createTransport({
          host: company.smtp_host, port: company.smtp_port,
          secure: company.smtp_secure === true,
          auth: { user: company.smtp_username, pass: company.smtp_password },
          requireTLS: company.smtp_secure !== true,
          tls: { rejectUnauthorized: true },
        });
        await transporter.sendMail({ from: buildFrom(senderName, smtpFrom), to: customerEmail, replyTo, subject, html: emailHtml, attachments: smtpAttachments });
      } else {
        if (!resendKey) {
          return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY' }), { status: 500, headers: corsHeaders });
        }
        const configuredDomains = parseAllowedDomains(Deno.env.get('RESEND_FROM_DOMAINS'));
        const allowedDomains    = configuredDomains.length ? configuredDomains : [getEmailDomain(defaultFromEmail)].filter(Boolean) as string[];
        const requestedDomain   = getEmailDomain(requestedFrom);
        const canUseRequested   = Boolean(requestedFrom) && allowedDomains.includes(requestedDomain as string);
        const fromHeader        = buildFrom(senderName, canUseRequested && requestedFrom ? requestedFrom : defaultFromEmail);
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: fromHeader, to: [customerEmail], reply_to: replyTo, subject, html: emailHtml, attachments: resendAttachments }),
        });
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
    }

    // completion_certificate_enabled allows sending regardless of status — used
    // when the underlying agreement was signed outside the app.
    if (quote.status !== 'signed' && !quote.completion_certificate_enabled) {
      return new Response(JSON.stringify({ error: 'Quote must be signed before sending a completion certificate' }), { status: 422, headers: corsHeaders });
    }

    // ── Load completion photos ────────────────────────────────────────────────
    // Use caller-provided selection when available; fall back to all saved photos
    let photos: CertPhoto[];
    if (body.selected_photos !== undefined) {
      photos = body.selected_photos;
    } else {
      const { data: photoRows } = await admin
        .from('quote_photos')
        .select('photo_url, caption, location, notes, sort_order')
        .eq('quote_id', body.quote_id)
        .order('sort_order');
      photos = (photoRows ?? []) as CertPhoto[];
    }

    // ── Build certificate identifiers ────────────────────────────────────────
    const completionDate = quote.contractor_signed_at || quote.signed_at || new Date().toISOString();
    const completionDateSlug = completionDate.slice(0, 10); // YYYY-MM-DD
    const verHash = verificationHash(quote.id, completionDate);
    const documentId = certId(quote.quote_number, completionDateSlug, verHash);
    const generatedAt = new Date().toISOString();

    // ── Generate certificate HTML ────────────────────────────────────────────
    // For a signed copy, use the customer's cert signature; otherwise leave blank
    const customerSigData = body.is_signed_copy
      ? ((quote as any).certificate_customer_signature_data || quote.signature_data || null)
      : (quote.signature_data || null);

    const certificateHtml = buildCertificateHtml({
      companyName:              company.name || 'Contractor',
      companyLogoUrl:           company.logo_url || null,
      companyAddress:           company.address || '',
      companyPhone:             company.phone || '',
      companyLicense:           company.license_number || '',
      customerName,
      contractorSignedBy:       quote.contractor_signed_by || company.name || '',
      contractorSignatureData:  quote.contractor_signature_data || null,
      customerSignatureData:    customerSigData,
      completionDate,
      generatedAt,
      documentId,
      verHash,
      photos,
    });

    // ── Resolve email settings ───────────────────────────────────────────────
    const resendKey       = Deno.env.get('RESEND_API_KEY');
    const defaultFromEmail = Deno.env.get('ALERT_FROM_EMAIL') || '';

    const normalizeEmail = (e?: string | null) => e?.trim().toLowerCase() || '';
    const getEmailDomain = (e?: string | null) => {
      const n = normalizeEmail(e);
      return n.includes('@') ? n.split('@').pop() || null : null;
    };
    const parseAllowedDomains = (v?: string | null) =>
      (v || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);

    const senderName     = company.quote_sender_name?.trim() || company.name || 'QuoteMGR';
    const requestedFrom  = normalizeEmail(company.quote_sender_email);
    const replyTo        = company.quote_reply_to_email?.trim() || requestedFrom || undefined;
    const subject        = body.is_signed_copy
      ? `Your Signed Certificate of Completion — ${company.name}`
      : `Your Certificate of Completion — ${company.name}`;

    // Build signing URL — only included when the customer still needs to sign
    const appBaseUrl = body.dashboard_url || 'https://quotes-customize-manage-live.vercel.app';
    const shareToken = (quote as any).share_token as string | null;
    const certViewUrl = shareToken ? `${appBaseUrl}?token=${shareToken}&cert=1` : undefined;
    const signingUrl = body.is_signed_copy ? undefined : certViewUrl;

    // ── Supplemental signed documents ────────────────────────────────────────
    // Flags from the client let the user opt-in/out. Internal (is_signed_copy) calls always include.
    const includeContingency = body.include_contingency !== false; // default true
    const includeCancel = body.include_cancel !== false; // default true
    let supplementalHtml = '';
    if (q.contingency_enabled && q.contingency_signature_data && includeContingency) {
      supplementalHtml = buildContingencyPagesHtml(q, company.name, customerName, includeCancel);
    } else if (!q.contingency_enabled && q.signature_data) {
      supplementalHtml = buildRetailSigPageHtml(q, company.name, customerName, includeCancel);
    }

    // Same data:-URI problem as the contingency email — the signatures only
    // render if they travel as inline attachments.
    const { html: emailHtml, images: certInlineImages } = inlineDataImages(
      buildEmailHtml({
        companyName:  company.name,
        customerName,
        documentId,
        certificateHtml,
        replyTo,
        signingUrl,
        isSignedCopy: body.is_signed_copy,
        certViewUrl: body.is_signed_copy ? certViewUrl : undefined,
        supplementalHtml: supplementalHtml || undefined,
      }),
    );

    const certResendAttachments = certInlineImages.length
      ? certInlineImages.map(img => ({
          filename: img.filename,
          content: img.content,
          content_type: img.contentType,
          content_id: img.cid,
        }))
      : undefined;
    const certSmtpAttachments = certInlineImages.length
      ? certInlineImages.map(img => ({
          filename: img.filename,
          content: img.content,
          encoding: 'base64',
          contentType: img.contentType,
          cid: img.cid,
        }))
      : undefined;

    const buildFrom = (name: string, email: string) => name ? `${name} <${email}>` : email;

    const dashboardUrl = body.dashboard_url || 'https://quotes-customize-manage-live.vercel.app';

    const alertHtml = buildContractorAlertHtml({
      companyName:  company.name,
      customerName,
      customerEmail,
      documentId,
      sentAt:       generatedAt,
      dashboardUrl,
    });

    // Alert recipients = creator + company email (deduped)
    const { data: creator } = await admin
      .from('quotes')
      .select('creator:team_members(email)')
      .eq('id', body.quote_id)
      .single();

    const alertEmails = Array.from(new Set([
      (creator?.creator as any)?.email,
      company.email,
    ].filter(Boolean) as string[]));

    // ── Send via SMTP if configured, else Resend ─────────────────────────────
    const extraRecipients = (body.extra_recipients || []).filter(Boolean);

    if (
      company.email_send_mode === 'smtp' &&
      company.smtp_host && company.smtp_port &&
      company.smtp_username && company.smtp_password
    ) {
      const nodemailer = (await import('npm:nodemailer@6.10.0')).default;
      const smtpUser   = normalizeEmail(company.smtp_username);
      const smtpFrom   = (company.connected_mail_provider === 'gmail' ||
                          company.connected_mail_provider === 'outlook')
        ? smtpUser : (requestedFrom || smtpUser);

      const transporter = nodemailer.createTransport({
        host: company.smtp_host,
        port: company.smtp_port,
        secure: company.smtp_secure === true,
        auth: { user: company.smtp_username, pass: company.smtp_password },
        requireTLS: company.smtp_secure !== true,
        tls: { rejectUnauthorized: true },
      });

      if (!isExtraRecipientsOnlyCall) {
        await transporter.sendMail({
          from: buildFrom(senderName, smtpFrom),
          to:   customerEmail,
          replyTo: replyTo,
          subject,
          html: emailHtml,
          attachments: certSmtpAttachments,
        });

        for (const alertEmail of alertEmails) {
          await transporter.sendMail({
            from: buildFrom(senderName, smtpFrom),
            to:   alertEmail,
            replyTo: replyTo,
            subject: `[Your copy] ${subject}`,
            html: alertHtml,
          });
        }
      }

      for (const extraEmail of extraRecipients) {
        await transporter.sendMail({
          from: buildFrom(senderName, smtpFrom),
          to:   extraEmail,
          replyTo: replyTo,
          subject: `[Copy] ${subject}`,
          html: emailHtml,
          attachments: certSmtpAttachments,
        });
      }
    } else {
      if (!resendKey) {
        return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY' }), { status: 500, headers: corsHeaders });
      }

      const configuredDomains = parseAllowedDomains(Deno.env.get('RESEND_FROM_DOMAINS'));
      const allowedDomains    = configuredDomains.length ? configuredDomains : [getEmailDomain(defaultFromEmail)].filter(Boolean) as string[];
      const requestedDomain   = getEmailDomain(requestedFrom);
      const canUseRequested   = Boolean(requestedFrom) && allowedDomains.includes(requestedDomain as string);
      const fromHeader        = buildFrom(senderName, canUseRequested && requestedFrom ? requestedFrom : defaultFromEmail);

      if (!isExtraRecipientsOnlyCall) {
        // Customer email
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: fromHeader, to: [customerEmail], reply_to: replyTo, subject, html: emailHtml, attachments: certResendAttachments }),
        });

        // Contractor alert(s)
        for (const alertEmail of alertEmails) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: fromHeader,
              to: [alertEmail],
              subject: `[Your copy] ${subject}`,
              html: alertHtml,
            }),
          });
        }
      }

      // Extra recipients (forwarded copy)
      for (const extraEmail of extraRecipients) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: fromHeader,
            to: [extraEmail],
            reply_to: replyTo,
            subject: `[Copy] ${subject}`,
            html: emailHtml,
            attachments: certResendAttachments,
          }),
        });
      }
    }

    // ── Record sent timestamp + notification ─────────────────────────────────
    if (!isExtraRecipientsOnlyCall) {
      await admin
        .from('quotes')
        .update({ completion_certificate_sent_at: generatedAt, completion_certificate_viewed_at: null })
        .eq('id', body.quote_id);

      await admin.from('quote_notifications').insert({
        company_id: company.id,
        quote_id:   body.quote_id,
        event_type: 'certificate_sent',
        message:    `Completion certificate sent to ${customerName} (${customerEmail})`,
      });
    }

    return new Response(JSON.stringify({ ok: true, document_id: documentId }), { status: 200, headers: corsHeaders });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('send-completion-certificate error:', msg);
    return new Response(JSON.stringify({ error: 'Unexpected error', details: msg }), { status: 500, headers: corsHeaders });
  }
});

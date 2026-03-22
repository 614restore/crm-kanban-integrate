// api/sign-doc.mjs
// Handles the Send-for-Signing flow for Document Template documents.
//
// Actions (via ?action= query param):
//   GET  track-view  — called when customer opens the signing link; marks viewed,
//                      sends in-app notification + email to the sender (once only)
//   GET  get         — returns doc metadata + html_content for the signing page
//   POST sign        — saves signature, marks signed, notifies sender, uploads
//                      a signed-HTML record to the customer's document store

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL =
  process.env.VITE_APP_URL ||
  process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://crm-kanban-integrate.vercel.app';
const FROM_EMAIL = 'scopemgr@614restore.com';
const FROM_NAME = '614 Restore';

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [to], subject, html }),
    });
  } catch (err) {
    console.error('[sign-doc] sendEmail error:', err?.message);
  }
}

function setCors(req, res) {
  const origin = req.headers?.origin || '';
  const allowed =
    origin === 'https://crm-kanban-integrate.vercel.app' ||
    origin.endsWith('.vercel.app') ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1');
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : 'https://crm-kanban-integrate.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, token } = req.query;

  // ── GET: fetch doc metadata + html for the signing page ──────────────────
  if (action === 'get' && req.method === 'GET') {
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const { data: doc, error } = await db
      .from('documents')
      .select('id,name,status,html_content,signed_by,signed_at,companies(name)')
      .eq('sign_token', token)
      .single();

    if (error || !doc) return res.status(404).json({ error: 'Document not found' });

    return res.status(200).json({
      doc: {
        id: doc.id,
        name: doc.name,
        status: doc.status,
        html: doc.html_content || '',
        signedBy: doc.signed_by || null,
        signedAt: doc.signed_at || null,
        companyName: doc.companies?.name || '',
        alreadySigned: doc.status === 'signed',
      },
    });
  }

  // ── GET: track-view — mark opened, notify sender once ─────────────────────
  if (action === 'track-view' && req.method === 'POST') {
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const { data: doc } = await db
      .from('documents')
      .select('id,name,status,viewed_at,sent_by,contact_email')
      .eq('sign_token', token)
      .single();

    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.viewed_at) return res.status(200).json({ success: true, alreadyViewed: true });

    await db
      .from('documents')
      .update({ status: 'viewed', viewed_at: new Date().toISOString() })
      .eq('id', doc.id);

    if (doc.sent_by) {
      const { data: sender } = await db
        .from('profiles')
        .select('email,full_name')
        .eq('id', doc.sent_by)
        .single();

      // In-app notification
      await db.from('notifications').insert({
        user_id: doc.sent_by,
        type: 'document_viewed',
        title: 'Document Opened',
        message: `"${doc.name}" has been opened by the customer`,
        link: `/documents`,
      });

      // Email to sender
      if (sender?.email) {
        await sendEmail(
          sender.email,
          `Document Opened: ${doc.name}`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#2563eb;">📧 Document Opened</h2>
            <p>Hi ${sender.full_name || 'there'},</p>
            <p>The customer has just opened <strong>"${doc.name}"</strong> and it's ready to be reviewed and signed.</p>
            <p style="color:#6b7280;font-size:13px;">You'll receive another notification once they sign.</p>
          </div>`,
        );
      }
    }

    return res.status(200).json({ success: true });
  }

  // ── POST: sign — save signature, notify sender, record signed doc ─────────
  if (action === 'sign' && req.method === 'POST') {
    const { signedBy, signatureData } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Missing token' });
    if (!signedBy || !signatureData) return res.status(400).json({ error: 'Missing signedBy or signatureData' });

    const { data: doc } = await db
      .from('documents')
      .select('id,name,status,sign_token,sent_by,contact_id,company_id,html_content,contact_email')
      .eq('sign_token', token)
      .single();

    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.status === 'signed') return res.status(409).json({ error: 'Already signed' });
    if (!doc.sign_token || token !== doc.sign_token) return res.status(403).json({ error: 'Invalid token' });

    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;

    // Build signed HTML — inject signature image into the first signature line
    let signedHtml = doc.html_content || '';
    const sigImg = `<img src="${signatureData}" alt="Signature" style="max-height:60px;display:block;" />`;
    // Replace the first empty signature-line div with the actual signature image
    signedHtml = signedHtml.replace(
      /<div class="signature-line"><\/div>/,
      `<div class="signature-line" style="border:none;">${sigImg}</div>`,
    );
    // Append signed-by / date stamp at the end of body if not already injected
    const stamp = `<div style="margin-top:32px;padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-family:Arial,sans-serif;font-size:12px;color:#166534;">
      ✅ Electronically signed by <strong>${signedBy}</strong> on ${new Date().toLocaleString()}${ip ? ` (IP: ${ip})` : ''}
    </div>`;
    signedHtml = signedHtml.replace(/<\/body>/, `${stamp}</body>`);

    // Persist on the original document row
    await db.from('documents').update({
      status: 'signed',
      signed_by: signedBy,
      signature_data: signatureData,
      signed_at: new Date().toISOString(),
      html_content: signedHtml,
    }).eq('id', doc.id);

    // Create a separate "signed copy" document record for the customer file
    if (doc.contact_id && doc.company_id) {
      await db.from('documents').insert({
        company_id: doc.company_id,
        contact_id: doc.contact_id,
        name: `${doc.name} — Signed`,
        type: 'signed-document',
        url: '',           // no file URL; html_content is the source of truth
        html_content: signedHtml,
        status: 'signed',
        signed_by: signedBy,
        signed_at: new Date().toISOString(),
      });
    }

    // Notify sender
    if (doc.sent_by) {
      const { data: sender } = await db
        .from('profiles')
        .select('email,full_name')
        .eq('id', doc.sent_by)
        .single();

      await db.from('notifications').insert({
        user_id: doc.sent_by,
        type: 'document_signed',
        title: 'Document Signed',
        message: `"${doc.name}" has been signed by ${signedBy}`,
        link: `/documents`,
      });

      if (sender?.email) {
        await sendEmail(
          sender.email,
          `✅ Document Signed: ${doc.name}`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#16a34a;">✅ Document Signed!</h2>
            <p>Hi ${sender.full_name || 'there'},</p>
            <p><strong>${signedBy}</strong> has signed <strong>"${doc.name}"</strong>.</p>
            <p>The signed copy has been saved to the customer's file automatically.</p>
            <p style="color:#6b7280;font-size:13px;">Signed on ${new Date().toLocaleString()}${ip ? ` from IP ${ip}` : ''}.</p>
            <a href="${APP_URL}" style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:16px;">Open CRM</a>
          </div>`,
        );
      }

      // Also send signed copy to customer's own email
      if (doc.contact_email) {
        await sendEmail(
          doc.contact_email,
          `Your signed copy: ${doc.name}`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#1e40af;">Your Signed Document</h2>
            <p>Hi ${signedBy},</p>
            <p>This confirms that you have electronically signed <strong>"${doc.name}"</strong> on ${new Date().toLocaleDateString()}.</p>
            <p style="color:#6b7280;font-size:12px;">This email serves as your receipt. Please save it for your records.</p>
          </div>`,
        );
      }
    }

    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Invalid action. Supported: get, track-view, sign' });
}

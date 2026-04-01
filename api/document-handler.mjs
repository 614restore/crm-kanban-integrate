// Consolidated document handler: estimates (sign/track) + change orders
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// smtpConfig: { host, port, user, pass, secure, fromName, fromEmail } — if provided, use SMTP; else Resend
async function sendEmail(to, subject, html, from = '614 Restore <scopemgr@614restore.com>', smtpConfig = null) {
  try {
    if (smtpConfig?.host && smtpConfig?.user && smtpConfig?.pass) {
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: Number(smtpConfig.port) || 587,
        secure: Boolean(smtpConfig.secure),
        auth: { user: smtpConfig.user, pass: smtpConfig.pass },
      });
      const fromAddr = smtpConfig.fromEmail || smtpConfig.user;
      const fromName = smtpConfig.fromName || fromAddr;
      await transporter.sendMail({
        from: `${fromName} <${fromAddr}>`,
        to,
        subject,
        html,
      });
      return;
    }
    if (!RESEND_API_KEY) { console.warn('sendEmail: no SMTP config and RESEND_API_KEY not set'); return; }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!res.ok) console.error('sendEmail failed:', res.status, await res.text().catch(() => ''));
  } catch (err) {
    console.error('sendEmail error:', err?.message || err);
  }
}

async function getCompanySmtp(companyId) {
  if (!companyId) return null;
  const { data } = await db
    .from('companies')
    .select('smtp_host,smtp_port,smtp_user,smtp_pass,smtp_secure,from_name,from_email,name')
    .eq('id', companyId)
    .single();
  if (!data?.smtp_host) return null;
  return {
    host: data.smtp_host,
    port: data.smtp_port,
    user: data.smtp_user,
    pass: data.smtp_pass,
    secure: data.smtp_secure,
    fromName: data.from_name || data.name,
    fromEmail: data.from_email,
  };
}

function setCors(req, res) {
  const origin = (req.headers && req.headers.origin) || '';
  const isAllowed =
    origin === 'https://crm-kanban-integrate.vercel.app' ||
    origin.endsWith('.vercel.app') ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1');
  const allowedOrigin = isAllowed ? origin : 'https://crm-kanban-integrate.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  // Track estimate view
  if (action === 'track-view' && req.method === 'POST') {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const { data: estimate } = await db.from('estimates').select('id,status,viewed_at,sent_by,estimate_number,title,contacts(name)').eq('sign_token', token).single();
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' });
    if (estimate.viewed_at) return res.status(200).json({ success: true, alreadyViewed: true });

    await db.from('estimates').update({ status: 'viewed', viewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', estimate.id);

    if (estimate.sent_by) {
      const { data: sender } = await db.from('profiles').select('email,full_name').eq('id', estimate.sent_by).single();
      await db.from('notifications').insert({
        user_id: estimate.sent_by,
        type: 'estimate_viewed',
        title: 'Estimate Viewed',
        message: `Estimate #${estimate.estimate_number} "${estimate.title}" has been opened by the customer`,
        link: `/estimates/${estimate.id}`,
      });
      if (sender?.email) {
        await sendEmail(sender.email, `Estimate #${estimate.estimate_number} Viewed`, `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">📧 Estimate Viewed</h2>
            <p>Hi ${sender.full_name || 'there'},</p>
            <p><strong>${estimate.contacts?.name || 'The customer'}</strong> has opened estimate #${estimate.estimate_number}.</p>
            <a href="https://crm-kanban-integrate.vercel.app/estimates/${estimate.id}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Estimate</a>
          </div>
        `);
      }
    }
    return res.status(200).json({ success: true });
  }

  // Sign estimate
  if (action === 'sign-estimate') {
    if (req.method === 'GET') {
      const { token } = req.query;
      if (!token) return res.status(400).json({ error: 'Missing token' });
      const { data: estimate } = await db.from('estimates').select('*,companies(name,from_email,phone,address,city,state,zip)').eq('sign_token', token).single();
      if (!estimate) return res.status(404).json({ error: 'Estimate not found' });
      return res.status(200).json({ estimate, alreadySigned: estimate.status === 'accepted' });
    }

    if (req.method === 'POST') {
      const { estimateId, signedBy, signatureData, token } = req.body || {};
      if (!estimateId || !signedBy || !signatureData || !token) return res.status(400).json({ error: 'Missing required fields' });
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(estimateId)) return res.status(400).json({ error: 'Invalid estimateId' });

      const { data: estimate } = await db.from('estimates').select('id,status,sign_token,sent_by,estimate_number,title').eq('id', estimateId).single();
      if (!estimate) return res.status(404).json({ error: 'Estimate not found' });
      if (!estimate.sign_token || token !== estimate.sign_token) return res.status(403).json({ error: 'Invalid signing token' });
      if (!['sent', 'viewed'].includes(estimate.status)) return res.status(400).json({ error: `Cannot sign in status: ${estimate.status}` });

      const { data: updated } = await db.from('estimates').update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        signed_by: signedBy,
        signature_data: signatureData,
        updated_at: new Date().toISOString(),
      }).eq('id', estimateId).select().single();

      if (estimate.sent_by) {
        const { data: sender } = await db.from('profiles').select('email,full_name').eq('id', estimate.sent_by).single();
        await db.from('notifications').insert({
          user_id: estimate.sent_by,
          type: 'estimate_signed',
          title: 'Estimate Signed',
          message: `Estimate #${estimate.estimate_number} "${estimate.title}" has been signed by ${signedBy}`,
          link: `/estimates/${estimateId}`,
        });
        if (sender?.email) {
          await sendEmail(sender.email, `✅ Estimate #${estimate.estimate_number} Signed by ${signedBy}`, `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #16a34a;">✅ Estimate Signed!</h2>
              <p>Hi ${sender.full_name || 'there'},</p>
              <p><strong>${signedBy}</strong> has signed estimate #${estimate.estimate_number}.</p>
              <a href="https://crm-kanban-integrate.vercel.app/estimates/${estimateId}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Signed Estimate</a>
            </div>
          `);
        }
      }
      return res.status(200).json({ success: true, estimate: updated });
    }
  }

  // Sign change order
  if (action === 'sign-change-order') {
    if (req.method === 'GET') {
      const { token } = req.query;
      if (!token) return res.status(400).json({ error: 'Missing token' });
      const { data: co } = await db.from('change_orders').select('id,change_order_number,title,description,total,subtotal,tax,notes,items,status,signed_by_name,signed_at,sign_token,companies(name,from_email,phone,address,city,state,zip)').eq('sign_token', token).single();
      if (!co) return res.status(404).json({ error: 'Change order not found' });
      return res.status(200).json({ changeOrder: co, alreadySigned: co.status === 'signed' });
    }

    if (req.method === 'POST') {
      const { token, signedBy, signatureData } = req.body || {};
      if (!token || !signedBy) return res.status(400).json({ error: 'Missing required fields' });
      const { data: existing } = await db.from('change_orders').select('id,status').eq('sign_token', token).single();
      if (!existing) return res.status(404).json({ error: 'Change order not found' });
      if (existing.status === 'signed') return res.status(409).json({ error: 'Already signed' });

      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
      const { data } = await db.from('change_orders').update({
        status: 'signed',
        signed_by_name: signedBy,
        signature_data: signatureData || null,
        signed_at: new Date().toISOString(),
        signed_ip: ip,
      }).eq('sign_token', token).select().single();

      return res.status(200).json({ success: true, changeOrder: data });
    }
  }

  // ── Document Template signing actions ────────────────────────────────────

  // doc-get: fetch document metadata + html for customer signing page
  if (action === 'doc-get' && req.method === 'GET') {
    if (!req.query.token) return res.status(400).json({ error: 'Missing token' });
    const { data: doc, error } = await db
      .from('documents')
      .select('id,name,status,html_content,signed_by,signed_at,companies(name,from_email)')
      .eq('sign_token', req.query.token)
      .single();
    if (error || !doc) return res.status(404).json({ error: 'Document not found' });
    return res.status(200).json({
      doc: {
        id: doc.id, name: doc.name, status: doc.status,
        html: doc.html_content || '', signedBy: doc.signed_by || null,
        signedAt: doc.signed_at || null, companyName: doc.companies?.name || '',
        alreadySigned: doc.status === 'signed',
      },
    });
  }

  // doc-track-view: mark doc opened, notify sender once
  if (action === 'doc-track-view' && req.method === 'POST') {
    const { token: bodyToken } = req.body || {};
    const tok = bodyToken || req.query.token;
    if (!tok) return res.status(400).json({ error: 'Missing token' });
    const { data: doc } = await db.from('documents').select('id,name,status,viewed_at,sent_by,contact_email,companies(name,from_email)').eq('sign_token', tok).single();
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.viewed_at) return res.status(200).json({ success: true, alreadyViewed: true });
    await db.from('documents').update({ status: 'viewed', viewed_at: new Date().toISOString() }).eq('id', doc.id);
    if (doc.sent_by) {
      const { data: sender } = await db.from('profiles').select('email,full_name').eq('id', doc.sent_by).single();
      await db.from('notifications').insert({ user_id: doc.sent_by, type: 'document_viewed', title: 'Document Opened', message: `"${doc.name}" has been opened by the customer`, link: '/documents' });
      const smtp = await getCompanySmtp(doc.company_id);
      const fromAddress = doc.companies?.from_email
        ? `${doc.companies.name || 'Your contractor'} <${doc.companies.from_email}>`
        : '614 Restore <scopemgr@614restore.com>';
      if (sender?.email) {
        await sendEmail(sender.email, `Document Opened: ${doc.name}`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><h2 style="color:#2563eb;">📧 Document Opened</h2><p>Hi ${sender.full_name || 'there'},</p><p>The customer has just opened <strong>"${doc.name}"</strong>.</p><p style="color:#6b7280;font-size:13px;">You'll receive another notification once they sign.</p></div>`,
          fromAddress, smtp);
      }
    }
    return res.status(200).json({ success: true });
  }

  // doc-sign: save signature, mark signed, notify sender + customer
  if (action === 'doc-sign' && req.method === 'POST') {
    const { token: bodyToken, signedBy, signatureData } = req.body || {};
    const tok = bodyToken || req.query.token;
    if (!tok) return res.status(400).json({ error: 'Missing token' });
    if (!signedBy || !signatureData) return res.status(400).json({ error: 'Missing signedBy or signatureData' });
    const { data: doc } = await db.from('documents').select('id,name,status,sign_token,sent_by,contact_id,company_id,html_content,contact_email,companies(name,from_email)').eq('sign_token', tok).single();
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.status === 'signed') return res.status(409).json({ error: 'Already signed' });
    if (tok !== doc.sign_token) return res.status(403).json({ error: 'Invalid token' });
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
    let signedHtml = doc.html_content || '';
    const sigImg = `<img src="${signatureData}" alt="Signature" style="max-height:60px;display:block;" />`;
    signedHtml = signedHtml.replace(/<div class="signature-line"><\/div>/, `<div class="signature-line" style="border:none;">${sigImg}</div>`);
    const stamp = `<div style="margin-top:32px;padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-family:Arial,sans-serif;font-size:12px;color:#166534;">✅ Electronically signed by <strong>${signedBy}</strong> on ${new Date().toLocaleString()}${ip ? ` (IP: ${ip})` : ''}</div>`;
    signedHtml = signedHtml.replace(/<\/body>/, `${stamp}</body>`);
    await db.from('documents').update({ status: 'signed', signed_by: signedBy, signature_data: signatureData, signed_at: new Date().toISOString(), html_content: signedHtml }).eq('id', doc.id);
    if (doc.contact_id && doc.company_id) {
      await db.from('documents').insert({ company_id: doc.company_id, contact_id: doc.contact_id, name: `${doc.name} — Signed`, type: 'signed-document', url: '', html_content: signedHtml, status: 'signed', signed_by: signedBy, signed_at: new Date().toISOString() });
    }
    if (doc.sent_by) {
      const { data: sender } = await db.from('profiles').select('email,full_name').eq('id', doc.sent_by).single();
      await db.from('notifications').insert({ user_id: doc.sent_by, type: 'document_signed', title: 'Document Signed', message: `"${doc.name}" has been signed by ${signedBy}`, link: '/documents' });
      const appUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://crm-kanban-integrate.vercel.app';
      const smtp = await getCompanySmtp(doc.company_id);
      const companyFromEmail = doc.companies?.from_email || null;
      const fromAddress = companyFromEmail ? `${doc.companies?.name || 'Your contractor'} <${companyFromEmail}>` : '614 Restore <scopemgr@614restore.com>';
      if (sender?.email) {
        await sendEmail(sender.email, `✅ Document Signed: ${doc.name}`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><h2 style="color:#16a34a;">✅ Document Signed!</h2><p>Hi ${sender.full_name || 'there'},</p><p><strong>${signedBy}</strong> has signed <strong>"${doc.name}"</strong>. The signed copy has been saved to the customer's file.</p><a href="${appUrl}" style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:16px;">Open CRM</a></div>`,
          fromAddress, smtp);
      }
      if (doc.contact_email) {
        await sendEmail(doc.contact_email, `Your signed copy: ${doc.name}`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><h2 style="color:#1e40af;">Your Signed Document</h2><p>Hi ${signedBy},</p><p>This confirms that you have electronically signed <strong>"${doc.name}"</strong> on ${new Date().toLocaleDateString()}.</p><p style="color:#6b7280;font-size:12px;">This email serves as your receipt. Please save it for your records.</p></div>`,
          fromAddress, smtp);
      }
    }
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Invalid action. Use: track-view, sign-estimate, sign-change-order, doc-get, doc-track-view, or doc-sign' });
}

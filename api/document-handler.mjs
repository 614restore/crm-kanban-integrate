// Consolidated document handler: estimates (sign/track) + change orders
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: '614 Restore <scopemgr@614restore.com>', to: [to], subject, html }),
    });
  } catch {}
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

  return res.status(400).json({ error: 'Invalid action. Use: track-view, sign-estimate, or sign-change-order' });
}

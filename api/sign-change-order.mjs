// Public endpoint: GET /api/sign-change-order?token=<sign_token>
// POST /api/sign-change-order  { token, signedBy, signatureData }
import { createClient } from '@supabase/supabase-js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://qgvuzrvpyyrrulhwlzma.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || serviceKey;

const db = createClient(supabaseUrl, serviceKey || anonKey);

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: load change order by sign_token ──
  if (req.method === 'GET') {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const { data: co, error } = await db
      .from('change_orders')
      .select(`
        id, change_order_number, title, description, total, subtotal, tax,
        notes, items, status, signed_by_name, signed_at, sign_token,
        companies (name, from_email, phone, address, city, state, zip)
      `)
      .eq('sign_token', token)
      .single();

    if (error || !co) return res.status(404).json({ error: 'Change order not found or link is invalid.' });

    return res.status(200).json({
      changeOrder: co,
      alreadySigned: co.status === 'signed',
    });
  }

  // ── POST: record signature ──
  if (req.method === 'POST') {
    const { token, signedBy, signatureData } = req.body || {};
    if (!token || !signedBy) return res.status(400).json({ error: 'Missing required fields' });

    // Verify it exists and isn't already signed
    const { data: existing } = await db
      .from('change_orders')
      .select('id, status')
      .eq('sign_token', token)
      .single();

    if (!existing) return res.status(404).json({ error: 'Change order not found' });
    if (existing.status === 'signed') return res.status(409).json({ error: 'Already signed' });

    // Get requester IP for audit trail
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;

    const { data, error } = await db
      .from('change_orders')
      .update({
        status: 'signed',
        signed_by_name: signedBy,
        signature_data: signatureData || null,
        signed_at: new Date().toISOString(),
        signed_ip: ip,
      })
      .eq('sign_token', token)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, changeOrder: data });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

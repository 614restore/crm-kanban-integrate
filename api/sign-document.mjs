// Public endpoint: GET /api/sign-document?token=<estimateId>
// POST /api/sign-document  { estimateId, signedBy, signatureData }
import { createClient } from '@supabase/supabase-js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Use service role for writes, anon for public reads
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabaseRead = createClient(supabaseUrl, anonKey);
const supabaseWrite = createClient(supabaseUrl, serviceKey || anonKey);

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const { data: estimate, error } = await supabaseRead
      .from('estimates')
      .select(`
        id, estimate_number, title, description, total, subtotal, tax,
        notes, terms, items, status, signed_by, accepted_at, valid_until,
        companies (name, from_email, phone, address, city, state, zip)
      `)
      .eq('id', token)
      .single();

    if (error || !estimate) return res.status(404).json({ error: 'Estimate not found' });
    return res.status(200).json({ estimate, alreadySigned: estimate.status === 'accepted' });
  }

  if (req.method === 'POST') {
    const { estimateId, signedBy, signatureData } = req.body || {};
    if (!estimateId || !signedBy) return res.status(400).json({ error: 'Missing required fields' });

    // Verify estimate exists and isn't already signed
    const { data: existing } = await supabaseRead
      .from('estimates')
      .select('id, status')
      .eq('id', estimateId)
      .single();

    if (!existing) return res.status(404).json({ error: 'Estimate not found' });
    if (existing.status === 'accepted') return res.status(409).json({ error: 'Already signed' });

    const { data, error } = await supabaseWrite
      .from('estimates')
      .update({
        status: 'accepted',
        signed_by: signedBy,
        signature_data: signatureData || null,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', estimateId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, estimate: data });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

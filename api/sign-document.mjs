// Public endpoint for customer-facing estimate signing
// Called via a unique token link sent to the customer

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { estimateId, signedBy, signatureData, token } = req.body || {};

  if (!estimateId || !signedBy || !signatureData || !token) {
    return res.status(400).json({ error: 'Missing required fields: estimateId, signedBy, signatureData, token' });
  }

  // Sanitize estimateId — must be a UUID to prevent PostgREST parameter injection
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(estimateId)) {
    return res.status(400).json({ error: 'Invalid estimateId' });
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  try {
    // Verify estimate exists and is in a signable state
    const fetchRes = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${estimateId}&select=id,status,sign_token`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    const [estimate] = await fetchRes.json();

    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    // Always require a valid sign_token — null tokens must never bypass validation
    if (!estimate.sign_token || token !== estimate.sign_token) {
      return res.status(403).json({ error: 'Invalid signing token' });
    }

    if (!['sent', 'viewed'].includes(estimate.status)) {
      return res.status(400).json({ error: `Estimate cannot be signed in status: ${estimate.status}` });
    }

    // Save signature
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${estimateId}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        signed_by: signedBy,
        signature_data: signatureData,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!updateRes.ok) {
      const err = await updateRes.json().catch(() => ({}));
      return res.status(updateRes.status).json({ error: err.message || 'Failed to save signature' });
    }

    const [updated] = await updateRes.json();
    return res.status(200).json({ success: true, estimate: updated });
  } catch (error) {
    return res.status(500).json({ error: error?.message || String(error) });
  }
}

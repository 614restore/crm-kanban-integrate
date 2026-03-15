// Public endpoint for customer-facing estimate signing
// Called via a unique token link sent to the customer

async function sendEmailNotification(to, subject, html, resendKey) {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: '614 Restore <scopemgr@614restore.com>',
        to: [to],
        subject,
        html,
      }),
    });
  } catch (error) {
    // Silent fail - don't block notification flow
  }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  // GET: Load estimate by token
  if (req.method === 'GET') {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'Missing token' });
    }

    try {
      const fetchRes = await fetch(`${SUPABASE_URL}/rest/v1/estimates?sign_token=eq.${token}&select=*,companies(name,from_email,phone,address,city,state,zip)`, {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      });

      const [estimate] = await fetchRes.json();

      if (!estimate) {
        return res.status(404).json({ error: 'Estimate not found' });
      }

      const alreadySigned = estimate.status === 'accepted';

      return res.status(200).json({ estimate, alreadySigned });
    } catch (error) {
      return res.status(500).json({ error: error?.message || String(error) });
    }
  }

  // POST: Sign estimate
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

    // Get estimate details for notification
    const detailsRes = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${estimateId}&select=sent_by,estimate_number,title`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    const [details] = await detailsRes.json();

    // Notify sender
    if (details?.sent_by) {
      // Get sender's email
      const userRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${details.sent_by}&select=email,full_name`, {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      });
      const [sender] = await userRes.json();

      // Create in-app notification
      await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: details.sent_by,
          type: 'estimate_signed',
          title: 'Estimate Signed',
          message: `Estimate #${details.estimate_number} "${details.title}" has been signed by ${signedBy}`,
          link: `/estimates/${estimateId}`,
          created_at: new Date().toISOString(),
        }),
      }).catch(() => {}); // Silent fail

      // Send email notification
      if (sender?.email && RESEND_API_KEY) {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">✅ Estimate Signed!</h2>
            <p>Hi ${sender.full_name || 'there'},</p>
            <p>Great news! <strong>${signedBy}</strong> has signed your estimate:</p>
            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Estimate:</strong> #${details.estimate_number}</p>
              <p style="margin: 4px 0;"><strong>Title:</strong> ${details.title}</p>
              <p style="margin: 4px 0;"><strong>Signed by:</strong> ${signedBy}</p>
            </div>
            <p>You can now proceed with the next steps for this project.</p>
            <a href="https://crm-kanban-integrate.vercel.app/estimates/${estimateId}" 
               style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; margin-top: 16px;">
              View Signed Estimate
            </a>
            <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
              614 Restore CRM - Automated Notification
            </p>
          </div>
        `;
        await sendEmailNotification(
          sender.email,
          `✅ Estimate #${details.estimate_number} Signed by ${signedBy}`,
          emailHtml,
          RESEND_API_KEY
        );
      }
    }

    return res.status(200).json({ success: true, estimate: updated });
  } catch (error) {
    return res.status(500).json({ error: error?.message || String(error) });
  }
}

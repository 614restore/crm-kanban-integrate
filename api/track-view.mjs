// Track when customer views estimate and notify sender

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

  const { token } = req.body || {};

  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  try {
    // Find estimate by token
    const fetchRes = await fetch(`${SUPABASE_URL}/rest/v1/estimates?sign_token=eq.${token}&select=id,status,viewed_at,sent_by,estimate_number,title,contacts(name,email)`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    const [estimate] = await fetchRes.json();

    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    // Only track first view
    if (estimate.viewed_at) {
      return res.status(200).json({ success: true, alreadyViewed: true });
    }

    // Update viewed status
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${estimate.id}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'viewed',
        viewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });

    if (!updateRes.ok) {
      throw new Error('Failed to update estimate');
    }

    // Send notification to sender
    if (estimate.sent_by) {
      // Get sender's email
      const userRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${estimate.sent_by}&select=email,full_name`, {
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
          user_id: estimate.sent_by,
          type: 'estimate_viewed',
          title: 'Estimate Viewed',
          message: `Estimate #${estimate.estimate_number} "${estimate.title}" has been opened by the customer`,
          link: `/estimates/${estimate.id}`,
          created_at: new Date().toISOString(),
        }),
      });

      // Send email notification
      if (sender?.email && RESEND_API_KEY) {
        const contactName = estimate.contacts?.name || 'the customer';
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">📧 Estimate Viewed</h2>
            <p>Hi ${sender.full_name || 'there'},</p>
            <p><strong>${contactName}</strong> has opened the estimate you sent:</p>
            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Estimate:</strong> #${estimate.estimate_number}</p>
              <p style="margin: 4px 0;"><strong>Title:</strong> ${estimate.title}</p>
            </div>
            <p>This is a good time to follow up with them!</p>
            <a href="https://crm-kanban-integrate.vercel.app/estimates/${estimate.id}" 
               style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; margin-top: 16px;">
              View Estimate
            </a>
            <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
              614 Restore CRM - Automated Notification
            </p>
          </div>
        `;
        await sendEmailNotification(
          sender.email,
          `Estimate #${estimate.estimate_number} Viewed`,
          emailHtml,
          RESEND_API_KEY
        );
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error?.message || String(error) });
  }
}

// POST /api/eagleview-webhook
// Receives order completion notifications from EagleView.
// Updates eagleview_orders and the parent jobs record in Supabase.
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Signature verification — enforced when EAGLEVIEW_WEBHOOK_SECRET is configured.
  // Until you register your platform webhook with EagleView's developer portal and
  // receive a shared secret, leave EAGLEVIEW_WEBHOOK_SECRET unset and verification
  // is skipped (webhooks are still processed). Once you have the secret, set it in
  // Vercel env vars and all webhooks will be verified — spoofed requests rejected.
  const webhookSecret = process.env.EAGLEVIEW_WEBHOOK_SECRET;
  const signature = req.headers['x-eagleview-signature'];

  if (webhookSecret) {
    if (!signature) {
      console.warn('EagleView webhook: missing x-eagleview-signature header');
      return res.status(401).json({ error: 'Missing signature' });
    }

    const hmac = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hmac !== signature) {
      console.warn('EagleView webhook signature mismatch');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } else {
    console.warn('EagleView webhook: EAGLEVIEW_WEBHOOK_SECRET not set — skipping signature verification. Set this env var once you register your webhook with EagleView.');
  }

  const { orderId, status, reportUrl, reportType, completedAt } = req.body || {};

  if (!orderId || !status) {
    return res.status(400).json({ error: 'Missing orderId or status' });
  }

  console.log(`EagleView webhook: Order ${orderId} → ${status}`);

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const updatePayload = {
      status: status.toLowerCase(),
      updated_at: new Date().toISOString(),
    };

    if (reportUrl) updatePayload.report_url = reportUrl;
    if (reportType) updatePayload.report_type = reportType;
    if (completedAt) updatePayload.completed_at = completedAt;

    const { data: order, error: orderError } = await supabase
      .from('eagleview_orders')
      .update(updatePayload)
      .eq('eagleview_order_id', orderId)
      .select('job_id, company_id')
      .single();

    if (orderError) {
      console.error('Failed to update eagleview_orders:', orderError);
      return res.status(500).json({ error: 'Database update failed' });
    }

    // Update the parent job with the report status
    if (order?.job_id) {
      const jobUpdate = { updated_at: new Date().toISOString() };
      if (status.toUpperCase() === 'COMPLETED') {
        jobUpdate.notes = `EagleView report ready: ${reportUrl || 'See EagleView portal'}`;
      }
      await supabase
        .from('jobs')
        .update(jobUpdate)
        .eq('id', order.job_id);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('EagleView webhook error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

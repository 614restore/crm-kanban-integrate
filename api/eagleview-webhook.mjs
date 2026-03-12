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

  // Verify EagleView signature if webhook secret is configured
  const webhookSecret = process.env.EAGLEVIEW_WEBHOOK_SECRET;
  const signature = req.headers['x-eagleview-signature'];

  if (webhookSecret && signature) {
    const hmac = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hmac !== signature) {
      console.warn('EagleView webhook signature mismatch');
      return res.status(401).json({ error: 'Invalid signature' });
    }
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

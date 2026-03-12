// POST /api/eagleview-webhook
// Receives order completion notifications from EagleView.
// Updates the job status in Supabase when a measurement report is ready.
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export default async function handler(req, res) {
  // No cache, no CORS needed (server-to-server)
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
    // Update the eagleview_orders record
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

    // If report is completed, also update the parent job record
    if (status.toUpperCase() === 'COMPLETED' && order?.job_id) {
      await supabase
        .from('jobs')
        .update({
          eagleview_status: 'report_ready',
          eagleview_report_url: reportUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.job_id);
    }

    if (status.toUpperCase() === 'FAILED' && order?.job_id) {
      await supabase
        .from('jobs')
        .update({
          eagleview_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.job_id);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('EagleView webhook error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

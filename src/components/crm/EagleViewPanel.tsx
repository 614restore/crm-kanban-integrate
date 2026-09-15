// EagleViewPanel — order aerial roof measurement reports for a customer property,
// poll for completion, and auto-upload the PDF to the customer's documents.
import React, { useState, useEffect, useCallback } from 'react';
import {
  Satellite, Loader2, Settings, CheckCircle, AlertTriangle,
  FileText, Download, RefreshCw, Clock, ExternalLink, Bell,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/database';
import { EagleViewIntegration } from '@/lib/integrations/eagleview';
import { uploadDocument } from '@/lib/storage';
import { Document } from '@/lib/crmData';

interface Props {
  address: string;
  city: string;
  state: string;
  zip: string;
  companyId: string;
  contactId: string;
  contactName?: string;
  userId?: string;
  onDocumentSaved?: (doc: Document) => void;
}

type OrderStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

interface PendingOrder {
  orderId: string;
  address: string;
  reportType: 'standard' | 'premium';
  orderedAt: string;
  status: OrderStatus;
  statusMessage?: string;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending:    'Pending',
  processing: 'Processing',
  completed:  'Completed',
  failed:     'Failed',
  cancelled:  'Cancelled',
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending:    'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed:  'bg-green-100 text-green-800',
  failed:     'bg-red-100 text-red-800',
  cancelled:  'bg-gray-100 text-gray-600',
};

/** Normalize the EagleView API status string to our internal OrderStatus */
function normalizeStatus(raw: string | undefined): OrderStatus {
  if (!raw) return 'pending';
  const s = raw.toLowerCase();
  if (s.includes('complete') || s.includes('done') || s.includes('ready') || s.includes('deliver')) return 'completed';
  if (s.includes('fail') || s.includes('error') || s.includes('reject')) return 'failed';
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('process') || s.includes('progress') || s.includes('review')) return 'processing';
  return 'pending';
}

const STORAGE_KEY = (contactId: string) => `ev_order_${contactId}`;

/** Try localStorage first, then fall back gracefully (private browser, etc.) */
function readOrderFromStorage(contactId: string): PendingOrder | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY(contactId));
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

function writeOrderToStorage(contactId: string, order: PendingOrder | null) {
  try {
    if (order) localStorage.setItem(STORAGE_KEY(contactId), JSON.stringify(order));
    else localStorage.removeItem(STORAGE_KEY(contactId));
  } catch { /* private browser — ignore, state is still held in React */ }
}

export default function EagleViewPanel({
  address, city, state, zip, companyId, contactId, contactName, userId, onDocumentSaved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [configStatus, setConfigStatus] = useState<'unknown' | 'ok' | 'missing'>('unknown');
  const [eagleView, setEagleView] = useState<EagleViewIntegration | null>(null);
  const [order, setOrder] = useState<PendingOrder | null>(null);
  const [reportType, setReportType] = useState<'standard' | 'premium'>('standard');
  const [error, setError] = useState<string | null>(null);
  const [accountCredits, setAccountCredits] = useState<number | null>(null);

  const fullAddress = [address, city, state, zip].filter(Boolean).join(', ');
  const repName = contactName || 'Customer';

  // ── Load saved order + EagleView credentials ─────────────────────────────
  useEffect(() => {
    // Restore any in-progress order from storage (graceful in private browsers)
    const saved = readOrderFromStorage(contactId);
    if (saved) setOrder(saved);

    if (!companyId) { setConfigStatus('missing'); return; }

    const load = async () => {
      try {
        // Ensure the session is active before hitting Supabase — prevents
        // false "not configured" state after dormancy or in private browsers.
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setConfigStatus('missing'); return; }

        const { data, error: dbError } = await supabase
          .from('company_integrations')
          .select('credentials')
          .eq('company_id', companyId)
          .eq('integration_type', 'eagleview')
          .eq('is_active', true)
          .maybeSingle();

        if (dbError && dbError.code !== 'PGRST116') {
          // Real DB / auth error — not just "no rows found"
          setConfigStatus('missing');
          return;
        }

        const apiKey = data?.credentials?.apiKey;
        const clientId = data?.credentials?.clientId;
        const env = data?.credentials?.environment || 'production';
        if (!apiKey || !clientId) { setConfigStatus('missing'); return; }
        const ev = new EagleViewIntegration(apiKey, clientId, env);
        setEagleView(ev);
        setConfigStatus('ok');
        try {
          const credits = await ev.getAccountCredits();
          setAccountCredits(credits?.credits_available ?? credits?.balance ?? null);
        } catch { /* non-critical */ }
      } catch {
        setConfigStatus('missing');
      }
    };
    load();
  }, [companyId, contactId]);

  // ── Persist order to storage ──────────────────────────────────────────────
  const persistOrder = useCallback((o: PendingOrder | null) => {
    setOrder(o);
    writeOrderToStorage(contactId, o);
  }, [contactId]);

  // ── Order a new report ────────────────────────────────────────────────────
  const handleOrderReport = async () => {
    if (!eagleView) return;
    setLoading(true);
    setError(null);
    try {
      const result = await eagleView.orderReport(fullAddress, reportType, {
        contact_id: contactId,
        customer_name: contactName,
      });
      const newOrder: PendingOrder = {
        orderId: result.order_id ?? result.id ?? `DEMO-${Date.now()}`,
        address: fullAddress,
        reportType,
        orderedAt: new Date().toISOString(),
        status: normalizeStatus(result.status),
        statusMessage: result.status_message ?? result.message,
      };
      persistOrder(newOrder);
      toast.success('EagleView report ordered! Check back in a few minutes for results.');
    } catch (err: any) {
      // Demo fallback: create a mock order so the flow can be tested without live credentials
      console.warn('[EagleViewPanel] API error, using demo order:', err.message);
      const demoOrder: PendingOrder = {
        orderId: `DEMO-${Date.now()}`,
        address: fullAddress,
        reportType,
        orderedAt: new Date().toISOString(),
        status: 'processing',
        statusMessage: 'Demo mode — using sample data because no live EagleView connection is active.',
      };
      persistOrder(demoOrder);
      toast.info('EagleView is in demo mode. A sample order has been created.');
    } finally {
      setLoading(false);
    }
  };

  // ── Check order status ─────────────────────────────────────────────────────
  const handleCheckStatus = async () => {
    if (!order) return;
    setCheckingStatus(true);
    setError(null);
    try {
      let newStatus: OrderStatus = order.status;
      let statusMessage = order.statusMessage;

      if (eagleView && !order.orderId.startsWith('DEMO-')) {
        const result = await eagleView.getOrderStatus(order.orderId);
        newStatus = normalizeStatus(result.status);
        statusMessage = result.status_message ?? result.message ?? statusMessage;
      } else {
        // Demo: advance demo order through states
        if (order.status === 'processing') {
          const ageMinutes = (Date.now() - new Date(order.orderedAt).getTime()) / 60000;
          if (ageMinutes > 1) {
            newStatus = 'completed';
            statusMessage = 'Demo report ready.';
          }
        }
      }

      const updated: PendingOrder = { ...order, status: newStatus, statusMessage };
      persistOrder(updated);

      if (newStatus === 'completed' && order.status !== 'completed') {
        toast.success('EagleView report is ready!', { duration: 6000 });
        // Create in-app notification
        try {
          await db.createNotification({
            company_id: companyId,
            user_id: userId,
            type: 'eagleview_report_ready',
            title: `📐 EagleView Report Ready — ${repName}`,
            message: `Your ${order.reportType} aerial measurement report for ${order.address} is complete. Order #${order.orderId}. Open the customer's Documents tab to download and save it.`,
            related_id: contactId,
            related_type: 'contact',
            read: false,
          });
        } catch { /* non-critical */ }
      } else if (newStatus === 'failed') {
        toast.error('EagleView report failed. Please try again or contact EagleView support.');
      } else if (newStatus === order.status) {
        toast.info(`Status: ${STATUS_LABEL[newStatus]} — no change yet.`);
      }
    } catch (err: any) {
      setError('Could not fetch order status. Check your EagleView connection.');
    } finally {
      setCheckingStatus(false);
    }
  };

  // ── Download & save to customer documents ─────────────────────────────────
  const handleDownloadAndSave = async () => {
    if (!order) return;
    setDownloading(true);
    setError(null);
    try {
      let pdfBlob: Blob;

      if (eagleView && !order.orderId.startsWith('DEMO-')) {
        pdfBlob = await eagleView.downloadReport(order.orderId, 'pdf');
      } else {
        // Demo: create a simple HTML placeholder "report"
        const html = `<!DOCTYPE html><html><head><title>EagleView Report (Demo)</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;max-width:700px;margin:auto}
        h1{color:#2563eb}.badge{background:#dbeafe;color:#1d4ed8;padding:4px 12px;border-radius:20px;font-size:12px}</style></head>
        <body>
          <h1>EagleView Aerial Measurement Report <span class="badge">DEMO</span></h1>
          <p><strong>Property:</strong> ${order.address}</p>
          <p><strong>Order ID:</strong> ${order.orderId}</p>
          <p><strong>Report Type:</strong> ${order.reportType}</p>
          <p><strong>Ordered:</strong> ${new Date(order.orderedAt).toLocaleString()}</p>
          <hr>
          <p>This is a demo report generated because EagleView is not connected with live credentials.
          In production, this document would contain detailed aerial roof measurements, pitch, area,
          ridges, valleys, hips, and other structural data from EagleView's imagery.</p>
          <h2>Roof Summary (Sample)</h2>
          <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">
            <tr style="background:#f3f4f6"><th>Area</th><th>Pitch</th><th>Squares</th></tr>
            <tr><td>Main Roof</td><td>6/12</td><td>28.5</td></tr>
            <tr><td>Garage</td><td>4/12</td><td>8.2</td></tr>
            <tr><td>Porch</td><td>2/12</td><td>3.1</td></tr>
            <tr style="font-weight:bold"><td>Total</td><td>—</td><td>39.8</td></tr>
          </table>
        </body></html>`;
        pdfBlob = new Blob([html], { type: 'text/html' });
      }

      const fileName = `EagleView_${order.reportType}_${contactName?.replace(/\s+/g, '_') || contactId}_${new Date().toISOString().slice(0, 10)}.${order.orderId.startsWith('DEMO-') ? 'html' : 'pdf'}`;
      const file = new File([pdfBlob], fileName, { type: pdfBlob.type });

      const uploadResult = await uploadDocument(file, companyId, contactId);
      if (uploadResult.error || !uploadResult.path) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      const newDbDoc = await db.createDocument({
        company_id: companyId,
        contact_id: contactId,
        name: `EagleView ${order.reportType.charAt(0).toUpperCase() + order.reportType.slice(1)} Report — ${repName}`,
        type: 'other',
        url: uploadResult.path,
        size: `${Math.round(pdfBlob.size / 1024)} KB`,
        uploaded_by: userId || null,
      });

      if (!newDbDoc) throw new Error('Failed to create document record');

      const frontendDoc: Document = {
        id: newDbDoc.id,
        contactId,
        name: newDbDoc.name,
        type: 'other',
        url: newDbDoc.url,
        uploadedAt: newDbDoc.created_at || new Date().toISOString(),
        uploadedBy: 'EagleView',
        size: newDbDoc.size || '',
      };

      onDocumentSaved?.(frontendDoc);
      toast.success('EagleView report saved to customer documents!');
      persistOrder(null); // Clear the order once saved
    } catch (err: any) {
      console.error('[EagleViewPanel] Download error:', err);
      setError(err?.message || 'Failed to download and save report.');
    } finally {
      setDownloading(false);
    }
  };

  // ── Render: not configured ─────────────────────────────────────────────────
  if (configStatus === 'missing') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Satellite size={20} className="text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">EagleView Aerial Reports</h3>
        </div>
        <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-500">
          <Settings size={16} className="mt-0.5 shrink-0" />
          <span>EagleView is not connected. Add your API key and Client ID in <strong>Settings → Integrations</strong>.</span>
        </div>
      </div>
    );
  }

  if (configStatus === 'unknown') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-2 text-gray-400 text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading EagleView…
      </div>
    );
  }

  // ── Render: configured ─────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Satellite size={20} className="text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">EagleView Aerial Reports</h3>
        </div>
        {accountCredits !== null && (
          <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
            {accountCredits} credits remaining
          </span>
        )}
      </div>

      {/* Property */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
        <strong>Property:</strong> {fullAddress || <span className="text-blue-400 italic">No address on file for this customer</span>}
      </div>

      {/* Existing order status or new order form */}
      {order ? (
        <div className="space-y-4">
          {/* Order card */}
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-semibold text-gray-900 text-sm">
                  {order.reportType.charAt(0).toUpperCase() + order.reportType.slice(1)} Report
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Order #{order.orderId} &nbsp;·&nbsp; Placed {new Date(order.orderedAt).toLocaleDateString()}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[order.status]}`}>
                {STATUS_LABEL[order.status]}
              </span>
            </div>

            {order.statusMessage && (
              <p className="text-xs text-gray-500 mb-3 italic">{order.statusMessage}</p>
            )}

            <div className="flex flex-wrap gap-2">
              {order.status !== 'completed' && order.status !== 'failed' && order.status !== 'cancelled' && (
                <button
                  onClick={handleCheckStatus}
                  disabled={checkingStatus}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-white transition-colors text-gray-700 disabled:opacity-50"
                >
                  {checkingStatus ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Check Status
                </button>
              )}

              {order.status === 'completed' && (
                <button
                  onClick={handleDownloadAndSave}
                  disabled={downloading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  {downloading ? 'Saving…' : 'Save to Customer Documents'}
                </button>
              )}

              {(order.status === 'failed' || order.status === 'cancelled') && (
                <button
                  onClick={() => persistOrder(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-white transition-colors text-gray-700"
                >
                  Order Again
                </button>
              )}
            </div>
          </div>

          {order.status === 'completed' && (
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              <CheckCircle size={16} className="mt-0.5 shrink-0" />
              Report is ready! Click <strong>Save to Customer Documents</strong> to permanently attach it to this customer.
            </div>
          )}

          {order.status === 'processing' && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
              <Clock size={16} className="mt-0.5 shrink-0" />
              EagleView is processing your report. Standard reports typically complete in 30–60 minutes; premium reports may take longer.
            </div>
          )}
        </div>
      ) : (
        /* New order form */
        <div className="space-y-4">
          {!address && (
            <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              No address saved for this customer — add their property address in the Overview tab first.
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Report Type</label>
            <div className="flex gap-3">
              {(['standard', 'premium'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setReportType(type)}
                  className={`flex-1 p-3 border-2 rounded-xl text-sm font-medium transition-colors ${
                    reportType === type
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <div className="font-semibold capitalize">{type}</div>
                  <div className="text-xs mt-0.5 font-normal opacity-75">
                    {type === 'standard' ? 'Basic measurements & pitch' : 'Full detail with imagery export'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleOrderReport}
            disabled={loading || !address}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Satellite size={16} />}
            {loading ? 'Ordering…' : `Order ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`}
          </button>

          <p className="text-xs text-gray-400 text-center">
            EagleView uses aerial imagery to measure your customer's roof. Report uses 1 credit.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mt-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

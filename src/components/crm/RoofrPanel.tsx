// RoofrPanel — order aerial roof measurement reports via Roofr for a customer
// property, poll for completion, display measurements inline, and save the
// report to the customer's document library.
// ENHANCED: Now includes PDF upload & auto-estimate generation
import React, { useState, useEffect, useCallback } from 'react';
import {
  Ruler, Loader2, Settings, CheckCircle, AlertTriangle,
  FileText, Download, RefreshCw, Clock, ExternalLink, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/database';
import { RoofrIntegration as RoofrAPI, RoofrReport } from '@/lib/integrations/roofr';
import { RoofrIntegration as RoofrUploadComponent } from './RoofrIntegration';
import { uploadDocument } from '@/lib/storage';
import { Document } from '@/lib/crmData';
import type { RoofrMeasurements } from '@/lib/roofrParser';

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

type OrderStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface StoredOrder {
  reportId: string;
  address: string;
  reportType: 'standard' | 'premium';
  orderedAt: string;
  status: OrderStatus;
  statusMessage?: string;
  downloadUrl?: string;
  measurements?: RoofrReport['measurements'];
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending:    'Pending',
  processing: 'Processing',
  completed:  'Completed',
  failed:     'Failed',
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending:    'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed:  'bg-green-100 text-green-800',
  failed:     'bg-red-100 text-red-800',
};

function normalizeStatus(raw: string | undefined): OrderStatus {
  if (!raw) return 'pending';
  const s = raw.toLowerCase();
  if (s === 'completed' || s === 'complete' || s === 'done' || s === 'ready') return 'completed';
  if (s === 'failed' || s === 'error' || s === 'cancelled' || s === 'canceled') return 'failed';
  if (s === 'processing' || s === 'in_progress' || s === 'pending') return 'processing';
  return 'pending';
}

const STORAGE_KEY = (contactId: string) => `roofr_order_${contactId}`;

function readOrderFromStorage(contactId: string): StoredOrder | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY(contactId));
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

function writeOrderToStorage(contactId: string, order: StoredOrder | null) {
  try {
    if (order) localStorage.setItem(STORAGE_KEY(contactId), JSON.stringify(order));
    else localStorage.removeItem(STORAGE_KEY(contactId));
  } catch { /* private browser — state is still held in React */ }
}

export default function RoofrPanel({
  address, city, state, zip, companyId, contactId, contactName, userId, onDocumentSaved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configStatus, setConfigStatus] = useState<'unknown' | 'ok' | 'missing'>('unknown');
  const [roofr, setRoofr] = useState<RoofrIntegration | null>(null);
  const [order, setOrder] = useState<StoredOrder | null>(null);
  const [reportType, setReportType] = useState<'standard' | 'premium'>('standard');
  const [error, setError] = useState<string | null>(null);

  const fullAddress = [address, city, state, zip].filter(Boolean).join(', ');
  const repName = contactName || 'Customer';

  // ── Load saved order + Roofr credentials ──────────────────────────────────
  useEffect(() => {
    const saved = readOrderFromStorage(contactId);
    if (saved) setOrder(saved);

    if (!companyId) { setConfigStatus('missing'); return; }

    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setConfigStatus('missing'); return; }

        const { data, error: dbError } = await supabase
          .from('company_integrations')
          .select('credentials')
          .eq('company_id', companyId)
          .eq('integration_type', 'roofr')
          .eq('is_active', true)
          .single();

        if (dbError && dbError.code !== 'PGRST116') {
          setConfigStatus('missing');
          return;
        }

        const apiKey = data?.credentials?.apiKey;
        if (!apiKey) { setConfigStatus('missing'); return; }

        setRoofr(new RoofrIntegration(apiKey));
        setConfigStatus('ok');
      } catch {
        setConfigStatus('missing');
      }
    };
    load();
  }, [companyId, contactId]);

  // ── Persist order ──────────────────────────────────────────────────────────
  const persistOrder = useCallback((o: StoredOrder | null) => {
    setOrder(o);
    writeOrderToStorage(contactId, o);
  }, [contactId]);

  // ── Order a new report ─────────────────────────────────────────────────────
  const handleOrderReport = async () => {
    if (!roofr) return;
    setLoading(true);
    setError(null);
    try {
      const report = await roofr.orderReport({
        address,
        city,
        state,
        zip,
        contactId,
        reportType,
      });
      persistOrder({
        reportId: report.id,
        address: fullAddress,
        reportType,
        orderedAt: report.orderedAt,
        status: normalizeStatus(report.status),
        downloadUrl: report.downloadUrl,
        measurements: report.measurements,
      });
      toast.success('Roofr measurement report ordered! Check back in a few minutes for results.');
    } catch (err: any) {
      // Demo fallback so the flow can be tested without live credentials
      console.warn('[RoofrPanel] API error, using demo order:', err.message);
      persistOrder({
        reportId: `DEMO-${Date.now()}`,
        address: fullAddress,
        reportType,
        orderedAt: new Date().toISOString(),
        status: 'processing',
        statusMessage: 'Demo mode — no live Roofr connection is active.',
      });
      toast.info('Roofr is in demo mode. A sample order has been created.');
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
      if (roofr && !order.reportId.startsWith('DEMO-')) {
        const report = await roofr.getReport(order.reportId);
        const newStatus = normalizeStatus(report.status);
        const updated: StoredOrder = {
          ...order,
          status: newStatus,
          downloadUrl: report.downloadUrl ?? order.downloadUrl,
          measurements: report.measurements ?? order.measurements,
        };
        persistOrder(updated);

        if (newStatus === 'completed' && order.status !== 'completed') {
          toast.success('Roofr report is ready!', { duration: 6000 });
          try {
            await db.createNotification({
              company_id: companyId,
              user_id: userId,
              type: 'roofr_report_ready',
              title: `📐 Roofr Report Ready — ${repName}`,
              message: `Your ${order.reportType} roof measurement report for ${order.address} is complete. Open the customer's Documents tab to review measurements and save it.`,
              related_id: contactId,
              related_type: 'contact',
              read: false,
            });
          } catch { /* non-critical */ }
        } else if (newStatus === 'failed') {
          toast.error('Roofr report failed. Please try again or contact Roofr support.');
        } else if (newStatus === order.status) {
          toast.info(`Status: ${STATUS_LABEL[newStatus]} — no change yet.`);
        }
      } else {
        // Demo: advance through states after 1 min
        if (order.status === 'processing') {
          const ageMinutes = (Date.now() - new Date(order.orderedAt).getTime()) / 60000;
          if (ageMinutes > 1) {
            persistOrder({
              ...order,
              status: 'completed',
              statusMessage: 'Demo report ready.',
              measurements: {
                totalSquares: 32.4,
                totalSqFt: 3240,
                ridgeLength: 48,
                hipLength: 36,
                valleyLength: 24,
                eaveLength: 140,
                rakeLength: 52,
                flashingLength: 18,
                predominantPitch: '6/12',
                facetCount: 8,
              },
            });
            toast.success('Roofr demo report is ready!', { duration: 6000 });
          } else {
            toast.info('Status: Processing — no change yet.');
          }
        }
      }
    } catch (err: any) {
      setError('Could not fetch report status. Check your Roofr connection.');
    } finally {
      setCheckingStatus(false);
    }
  };

  // ── Save report to customer documents ─────────────────────────────────────
  const handleSaveReport = async () => {
    if (!order) return;
    setSaving(true);
    setError(null);
    try {
      let fileBlob: Blob;
      let ext = 'html';

      if (order.downloadUrl && !order.reportId.startsWith('DEMO-')) {
        // Fetch the actual PDF from Roofr
        const res = await fetch(order.downloadUrl);
        if (!res.ok) throw new Error('Failed to fetch Roofr report PDF');
        fileBlob = await res.blob();
        ext = 'pdf';
      } else {
        // Generate an HTML measurement summary
        const m = order.measurements;
        const measurementRows = m ? `
          <tr><td>Total Squares</td><td>${m.totalSquares} sq</td></tr>
          <tr><td>Total Area</td><td>${m.totalSqFt.toLocaleString()} sq ft</td></tr>
          <tr><td>Predominant Pitch</td><td>${m.predominantPitch}</td></tr>
          <tr><td>Facets</td><td>${m.facetCount}</td></tr>
          <tr><td>Ridge Length</td><td>${m.ridgeLength} LF</td></tr>
          <tr><td>Hip Length</td><td>${m.hipLength} LF</td></tr>
          <tr><td>Valley Length</td><td>${m.valleyLength} LF</td></tr>
          <tr><td>Eave / Perimeter</td><td>${m.eaveLength} LF</td></tr>
          <tr><td>Rake Length</td><td>${m.rakeLength} LF</td></tr>
          <tr><td>Flashing Length</td><td>${m.flashingLength} LF</td></tr>
        ` : '<tr><td colspan="2" style="color:#888">Measurements not yet available</td></tr>';

        const html = `<!DOCTYPE html><html><head><title>Roofr Measurement Report</title>
        <style>
          body{font-family:Arial,sans-serif;padding:40px;max-width:700px;margin:auto;color:#111}
          h1{color:#2563eb;margin-bottom:4px}.badge{background:#dbeafe;color:#1d4ed8;padding:3px 10px;border-radius:20px;font-size:12px;vertical-align:middle}
          .meta{color:#6b7280;font-size:14px;margin-bottom:24px}
          table{width:100%;border-collapse:collapse;margin-top:16px}
          th,td{padding:10px 14px;border:1px solid #e5e7eb;text-align:left}
          th{background:#f3f4f6;font-weight:600;font-size:13px}
          tr:nth-child(even) td{background:#f9fafb}
        </style></head>
        <body>
          <h1>Roofr Measurement Report ${order.reportId.startsWith('DEMO-') ? '<span class="badge">DEMO</span>' : ''}</h1>
          <div class="meta">
            <strong>Property:</strong> ${order.address}<br>
            <strong>Report Type:</strong> ${order.reportType.charAt(0).toUpperCase() + order.reportType.slice(1)}<br>
            <strong>Ordered:</strong> ${new Date(order.orderedAt).toLocaleString()}<br>
            <strong>Order ID:</strong> ${order.reportId}
          </div>
          <table>
            <thead><tr><th>Measurement</th><th>Value</th></tr></thead>
            <tbody>${measurementRows}</tbody>
          </table>
          <p style="font-size:12px;color:#9ca3af;margin-top:24px">
            Generated by TrussCTR via Roofr aerial measurement service. ${order.reportId.startsWith('DEMO-') ? 'This is a demo report — values are for illustration only.' : ''}
          </p>
        </body></html>`;
        fileBlob = new Blob([html], { type: 'text/html' });
      }

      const safeName = (contactName || contactId).replace(/\s+/g, '_');
      const date = new Date().toISOString().slice(0, 10);
      const fileName = `Roofr_${order.reportType}_${safeName}_${date}.${ext}`;
      const file = new File([fileBlob], fileName, { type: fileBlob.type });

      const uploadResult = await uploadDocument(file, companyId, contactId);
      if (uploadResult.error || !uploadResult.path) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      const newDbDoc = await db.createDocument({
        company_id: companyId,
        contact_id: contactId,
        name: `Roofr ${order.reportType.charAt(0).toUpperCase() + order.reportType.slice(1)} Report — ${repName}`,
        type: 'other',
        url: uploadResult.path,
        size: `${Math.round(fileBlob.size / 1024)} KB`,
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
        uploadedBy: 'Roofr',
        size: newDbDoc.size || '',
      };

      onDocumentSaved?.(frontendDoc);
      toast.success('Roofr report saved to customer documents!');
      persistOrder(null);
    } catch (err: any) {
      console.error('[RoofrPanel] Save error:', err);
      setError(err?.message || 'Failed to save report.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render: not configured ─────────────────────────────────────────────────
  if (configStatus === 'missing') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Ruler size={20} className="text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">Roofr Measurement Reports</h3>
        </div>
        <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-500">
          <Settings size={16} className="mt-0.5 shrink-0" />
          <span>Roofr is not connected. Add your API key in <strong>Settings → Integrations</strong>.</span>
        </div>
      </div>
    );
  }

  if (configStatus === 'unknown') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-2 text-gray-400 text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading Roofr…
      </div>
    );
  }

  // ── Render: configured ─────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Ruler size={20} className="text-green-600" />
        <h3 className="text-lg font-semibold text-gray-900">Roofr Measurement Reports</h3>
      </div>

      {/* Property */}
      <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-lg text-sm text-green-800">
        <strong>Property:</strong>{' '}
        {fullAddress || <span className="text-green-400 italic">No address on file for this customer</span>}
      </div>

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
                  Order #{order.reportId} &nbsp;·&nbsp; Placed {new Date(order.orderedAt).toLocaleDateString()}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[order.status]}`}>
                {STATUS_LABEL[order.status]}
              </span>
            </div>

            {order.statusMessage && (
              <p className="text-xs text-gray-500 mb-3 italic">{order.statusMessage}</p>
            )}

            {/* Measurements inline when available */}
            {order.measurements && (
              <div className="mt-3 mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Roof Measurements</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Total Squares', value: `${order.measurements.totalSquares} sq` },
                    { label: 'Total Area', value: `${order.measurements.totalSqFt.toLocaleString()} sq ft` },
                    { label: 'Predominant Pitch', value: order.measurements.predominantPitch },
                    { label: 'Facets', value: String(order.measurements.facetCount) },
                    { label: 'Ridge', value: `${order.measurements.ridgeLength} LF` },
                    { label: 'Hip', value: `${order.measurements.hipLength} LF` },
                    { label: 'Valley', value: `${order.measurements.valleyLength} LF` },
                    { label: 'Eave / Perimeter', value: `${order.measurements.eaveLength} LF` },
                    { label: 'Rake', value: `${order.measurements.rakeLength} LF` },
                    { label: 'Flashing', value: `${order.measurements.flashingLength} LF` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white border border-gray-100 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className="text-sm font-semibold text-gray-800">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              {order.status !== 'completed' && order.status !== 'failed' && (
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
                <>
                  {order.downloadUrl && (
                    <a
                      href={order.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-white transition-colors text-gray-700"
                    >
                      <ExternalLink size={13} />
                      View on Roofr
                    </a>
                  )}
                  <button
                    onClick={handleSaveReport}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                    {saving ? 'Saving…' : 'Save to Customer Documents'}
                  </button>
                </>
              )}

              {order.status === 'failed' && (
                <button
                  onClick={() => persistOrder(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-white transition-colors text-gray-700"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>

          {order.status === 'completed' && (
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              <CheckCircle size={16} className="mt-0.5 shrink-0" />
              Report ready! Review the measurements above, then click <strong>Save to Customer Documents</strong> to attach it permanently.
            </div>
          )}

          {order.status === 'processing' && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
              <Clock size={16} className="mt-0.5 shrink-0" />
              Report is processing. This usually takes 24–48 hours. Check back or click <strong>Check Status</strong> to refresh.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* PDF Upload Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={18} className="text-blue-600" />
              <h4 className="font-semibold text-gray-900">Upload Roofr PDF</h4>
            </div>
            <RoofrUploadComponent 
              contact={{
                id: contactId,
                firstName: contactName?.split(' ')[0] || '',
                lastName: contactName?.split(' ').slice(1).join(' ') || '',
              } as any}
              onEstimateGenerated={(lineItems, measurements) => {
                // Store measurements in order state for display
                persistOrder({
                  reportId: `UPLOADED-${Date.now()}`,
                  address: fullAddress,
                  reportType: 'premium',
                  orderedAt: new Date().toISOString(),
                  status: 'completed',
                  statusMessage: 'Uploaded from PDF',
                  measurements: measurements,
                });
                toast.success('Measurements extracted! Navigate to Estimates to create a quote.');
              }}
            />
          </div>

          {/* OR Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-gray-500">OR</span>
            </div>
          </div>

          {/* Order New Report Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Ruler size={18} className="text-green-600" />
              <h4 className="font-semibold text-gray-900">Order New Report</h4>
            </div>
            
            {!address && (
              <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700 mb-4">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                No address saved for this customer — add their property address in the Overview tab first.
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Report Type</label>
              <div className="flex gap-3">
                {(['standard', 'premium'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setReportType(type)}
                    className={`flex-1 p-3 border-2 rounded-xl text-sm font-medium transition-colors ${
                      reportType === type
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <div className="font-semibold capitalize">{type}</div>
                    <div className="text-xs mt-0.5 font-normal opacity-75">
                      {type === 'standard'
                        ? 'Key measurements & pitch'
                        : 'Full detail with 3D imagery'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleOrderReport}
              disabled={loading || !address}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-4"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Ruler size={16} />}
              {loading ? 'Ordering…' : `Order ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`}
            </button>

            <p className="text-xs text-gray-400 text-center mt-3">
              Roofr uses aerial imagery to measure this customer's roof instantly.
            </p>
          </div>
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

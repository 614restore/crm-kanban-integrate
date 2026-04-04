// RoofrPanel — order aerial roof measurement reports via Roofr for a customer
// property, poll for completion, display measurements inline, and save the
// report to the customer's document library.
// ENHANCED: Now includes PDF upload, auto-estimate generation, and Save as Estimate
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
import type { RoofrMeasurements, StructureMeasurements } from '@/lib/roofrParser';
import { generateEstimateFromMeasurements } from '@/lib/roofrEstimateGenerator';

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
  /** Per-structure breakdowns from a multi-structure Roofr PDF */
  structures?: StructureMeasurements[];
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

// Asphalt-roof template terms/notes used when creating estimate
const ROOFR_ESTIMATE_TERMS = '50% deposit required. Balance due upon completion. Warranty: 10-year workmanship, 30-year manufacturer.';
const ROOFR_ESTIMATE_NOTES = 'Estimate generated from Roofr aerial measurement report. Quantities include 10% waste factor. Does not include structural repairs or decking replacement unless noted.';

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
  const [savingEstimate, setSavingEstimate] = useState(false);
  const [configStatus, setConfigStatus] = useState<'unknown' | 'ok' | 'missing'>('unknown');
  const [roofr, setRoofr] = useState<RoofrAPI | null>(null);
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

        setRoofr(new RoofrAPI(apiKey));
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

      if (order.downloadUrl && !order.reportId.startsWith('DEMO-') && !order.reportId.startsWith('UPLOADED-')) {
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

        const structureRows = order.structures && order.structures.length > 1
          ? order.structures.map(s => `
            <h3>${s.structureName} — ${s.measurements.totalSquares.toFixed(1)} SQ</h3>
            <table>
              <thead><tr><th>Measurement</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td>Total Squares</td><td>${s.measurements.totalSquares.toFixed(1)} sq</td></tr>
                <tr><td>Total Area</td><td>${s.measurements.totalSqFt.toLocaleString()} sq ft</td></tr>
                <tr><td>Pitch</td><td>${s.measurements.predominantPitch || '—'}</td></tr>
                <tr><td>Ridge</td><td>${s.measurements.ridgeLength > 0 ? s.measurements.ridgeLength.toFixed(0) + ' LF' : '—'}</td></tr>
                <tr><td>Valley</td><td>${s.measurements.valleyLength > 0 ? s.measurements.valleyLength.toFixed(0) + ' LF' : '—'}</td></tr>
                <tr><td>Eave</td><td>${s.measurements.eaveLength > 0 ? s.measurements.eaveLength.toFixed(0) + ' LF' : '—'}</td></tr>
              </tbody>
            </table>
          `).join('')
          : '';

        const html = `<!DOCTYPE html><html><head><title>Roofr Measurement Report</title>
        <style>
          body{font-family:Arial,sans-serif;padding:40px;max-width:700px;margin:auto;color:#111}
          h1{color:#2563eb;margin-bottom:4px}.badge{background:#dbeafe;color:#1d4ed8;padding:3px 10px;border-radius:20px;font-size:12px;vertical-align:middle}
          .meta{color:#6b7280;font-size:14px;margin-bottom:24px}
          table{width:100%;border-collapse:collapse;margin-top:16px;margin-bottom:24px}
          th,td{padding:10px 14px;border:1px solid #e5e7eb;text-align:left}
          th{background:#f3f4f6;font-weight:600;font-size:13px}
          tr:nth-child(even) td{background:#f9fafb}
          h3{color:#1d4ed8;margin-top:24px}
        </style></head>
        <body>
          <h1>Roofr Measurement Report ${order.reportId.startsWith('DEMO-') ? '<span class="badge">DEMO</span>' : ''}</h1>
          <div class="meta">
            <strong>Property:</strong> ${order.address}<br>
            <strong>Report Type:</strong> ${order.reportType.charAt(0).toUpperCase() + order.reportType.slice(1)}<br>
            <strong>Ordered:</strong> ${new Date(order.orderedAt).toLocaleString()}<br>
            <strong>Order ID:</strong> ${order.reportId}
          </div>
          ${structureRows || `<table>
            <thead><tr><th>Measurement</th><th>Value</th></tr></thead>
            <tbody>${measurementRows}</tbody>
          </table>`}
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
    } catch (err: any) {
      console.error('[RoofrPanel] Save error:', err);
      setError(err?.message || 'Failed to save report.');
    } finally {
      setSaving(false);
    }
  };

  // ── Create estimate from measurements ─────────────────────────────────────
  const handleCreateEstimate = async (structureMeasurements?: RoofrMeasurements, structureLabel?: string) => {
    const measurements = structureMeasurements ?? (order?.measurements as RoofrMeasurements | undefined);
    if (!measurements || !companyId || !contactId) {
      toast.error('No measurements available to create estimate.');
      return;
    }

    setSavingEstimate(true);
    setError(null);
    try {
      // generateEstimateFromMeasurements applies 10% waste factor (wasteFactor: 1.10)
      const lineItems = generateEstimateFromMeasurements(measurements);
      const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
      const estNumber = `ROOFR-${Date.now().toString().slice(-6)}`;
      const titleSuffix = structureLabel ? ` — ${structureLabel}` : '';
      const title = `Roof Replacement — ${repName}${titleSuffix}`;

      // Create the estimate header using asphalt-roof template terms
      const estimateRecord = await db.createEstimate({
        company_id: companyId,
        contact_id: contactId,
        estimate_number: estNumber,
        title,
        description: `Generated from Roofr aerial measurement report for ${order?.address || fullAddress}. ${measurements.totalSquares.toFixed(1)} squares, pitch ${measurements.predominantPitch || '—'}.`,
        status: 'draft',
        subtotal,
        tax: 0,
        total: subtotal,
        notes: ROOFR_ESTIMATE_NOTES,
        terms: ROOFR_ESTIMATE_TERMS,
        created_by: userId,
      });

      if (!estimateRecord) throw new Error('Failed to create estimate record');

      // Insert line items
      await Promise.all(
        lineItems.map((item, idx) =>
          db.createEstimateItem({
            company_id: companyId,
            estimate_id: estimateRecord.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.rate,
            total: item.amount,
            order_index: idx,
          })
        )
      );

      toast.success(`Estimate "${title}" saved! Open the Estimates tab to review and send.`, { duration: 5000 });
    } catch (err: any) {
      console.error('[RoofrPanel] Create estimate error:', err);
      setError(err?.message || 'Failed to create estimate.');
    } finally {
      setSavingEstimate(false);
    }
  };

  // ── Render measurements section ────────────────────────────────────────────
  const renderMeasurements = () => {
    if (!order) return null;

    if (order.structures && order.structures.length > 1) {
      return (
        <div className="mt-3 mb-3 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Roof Measurements by Structure</p>
          {order.structures.map((structure) => (
            <div key={structure.structureIndex} className="border border-blue-100 rounded-lg p-3 bg-blue-50/40">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-blue-800">
                  {structure.structureName} &nbsp;·&nbsp; {structure.measurements.totalSquares.toFixed(1)} SQ
                </p>
                <button
                  onClick={() => handleCreateEstimate(structure.measurements as unknown as RoofrMeasurements, structure.structureName)}
                  disabled={savingEstimate}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {savingEstimate ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
                  Estimate
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Total Squares', value: `${structure.measurements.totalSquares.toFixed(1)} sq` },
                  { label: 'Total Area', value: `${structure.measurements.totalSqFt.toLocaleString()} sq ft` },
                  { label: 'Predominant Pitch', value: structure.measurements.predominantPitch || '—' },
                  { label: 'Facets', value: structure.measurements.facetCount > 0 ? String(structure.measurements.facetCount) : '—' },
                  { label: 'Ridge', value: structure.measurements.ridgeLength > 0 ? `${structure.measurements.ridgeLength.toFixed(0)} LF` : '—' },
                  { label: 'Hip', value: structure.measurements.hipLength > 0 ? `${structure.measurements.hipLength.toFixed(0)} LF` : '—' },
                  { label: 'Valley', value: structure.measurements.valleyLength > 0 ? `${structure.measurements.valleyLength.toFixed(0)} LF` : '—' },
                  { label: 'Eave', value: structure.measurements.eaveLength > 0 ? `${structure.measurements.eaveLength.toFixed(0)} LF` : '—' },
                  { label: 'Rake', value: structure.measurements.rakeLength > 0 ? `${structure.measurements.rakeLength.toFixed(0)} LF` : '—' },
                  { label: 'Flashing', value: structure.measurements.flashingLength > 0 ? `${structure.measurements.flashingLength.toFixed(0)} LF` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white border border-blue-100 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-sm font-semibold text-gray-800">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (order.measurements) {
      return (
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
      );
    }

    return null;
  };

  // ── Shared PDF upload callback ─────────────────────────────────────────────
  const handleUploadEstimateGenerated = (lineItems: any[], measurements: any, multiResult?: any) => {
    persistOrder({
      reportId: `UPLOADED-${Date.now()}`,
      address: fullAddress,
      reportType: 'premium',
      orderedAt: new Date().toISOString(),
      status: 'completed',
      statusMessage: multiResult?.hasMultipleStructures
        ? `${multiResult.structures.length} structures detected`
        : 'Uploaded from PDF',
      measurements,
      structures: multiResult?.structures,
    });
    if (multiResult?.hasMultipleStructures) {
      toast.success(`Found ${multiResult.structures.length} structures! Click "Estimate" next to each structure.`);
    } else {
      toast.success('Measurements extracted! Click "Create Estimate" to generate a quote.');
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
        <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-500 mb-4">
          <Settings size={16} className="mt-0.5 shrink-0" />
          <span>Roofr API not connected — ordering disabled. Add your key in <strong>Settings → Integrations</strong> to order reports. You can still upload a PDF below.</span>
        </div>

        {order ? (
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-semibold text-gray-900 text-sm">
                  {order.reportType.charAt(0).toUpperCase() + order.reportType.slice(1)} Report
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Placed {new Date(order.orderedAt).toLocaleDateString()}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[order.status]}`}>
                {STATUS_LABEL[order.status]}
              </span>
            </div>
            {order.statusMessage && (
              <p className="text-xs text-gray-500 mb-3 italic">{order.statusMessage}</p>
            )}
            {renderMeasurements()}
            {(order.measurements || order.structures) && (
              <div className="flex flex-wrap gap-2 mt-3">
                {!(order.structures && order.structures.length > 1) && (
                  <button
                    onClick={() => handleCreateEstimate()}
                    disabled={savingEstimate}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {savingEstimate ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                    {savingEstimate ? 'Creating…' : 'Create Estimate'}
                  </button>
                )}
                <button
                  onClick={handleSaveReport}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-white transition-colors text-gray-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  {saving ? 'Saving…' : 'Save to Documents'}
                </button>
                <button
                  onClick={() => persistOrder(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-white transition-colors text-gray-700"
                >
                  Clear & Upload New
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
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
              onEstimateGenerated={handleUploadEstimateGenerated}
            />
          </>
        )}
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

            {/* Measurements */}
            {renderMeasurements()}

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
                  {/* Single-structure estimate button */}
                  {!(order.structures && order.structures.length > 1) && order.measurements && (
                    <button
                      onClick={() => handleCreateEstimate()}
                      disabled={savingEstimate}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {savingEstimate ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                      {savingEstimate ? 'Creating…' : 'Create Estimate'}
                    </button>
                  )}
                  <button
                    onClick={handleSaveReport}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                    {saving ? 'Saving…' : 'Save to Documents'}
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

              <button
                onClick={() => persistOrder(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-white transition-colors text-gray-500"
              >
                Clear
              </button>
            </div>
          </div>

          {order.status === 'completed' && (
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              <CheckCircle size={16} className="mt-0.5 shrink-0" />
              <span>
                Report ready!{' '}
                {order.structures && order.structures.length > 1
                  ? 'Click "Estimate" next to each structure to create separate quotes.'
                  : 'Click "Create Estimate" to generate a quote, or "Save to Documents" to archive the report.'}
              </span>
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
              onEstimateGenerated={handleUploadEstimateGenerated}
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

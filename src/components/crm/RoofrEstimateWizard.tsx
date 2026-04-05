// RoofrEstimateWizard — 3-step wizard to create a roofing estimate from
// Roofr measurements (manual entry from a PDF report, or from a live completed report).
// Step 1: Enter measurements (manually from PDF, or auto-filled from live report)
// Step 2: Choose roof type (Asphalt / Corrugated Metal / Standing Seam)
// Step 3: Review auto-generated line items, fill in unit prices, and save
import React, { useState, useRef, useCallback } from 'react';
import {
  X, ChevronRight, ChevronLeft, CheckCircle,
  Loader2, Trash2, FileSpreadsheet, ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/database';
import { EstimateItem } from '@/lib/crmData';
import { RoofrReport } from '@/lib/integrations/roofr';

type RoofrMeasurements = RoofrReport['measurements'];

type RoofType = 'asphalt' | 'corrugated-metal' | 'standing-seam';

interface Props {
  contactId: string;
  contactName: string;
  companyId: string;
  userId?: string;
  /** Measurements from a completed live Roofr order — skips file upload step */
  existingMeasurements?: RoofrMeasurements;
  onClose: () => void;
  onEstimateCreated: () => void;
}

// ── CSV / JSON parser ─────────────────────────────────────────────────────────

/** Column aliases for flexible Roofr CSV format matching */
const COL = {
  totalSqFt:    ['total area (sq ft)', 'total area', 'area (sq ft)', 'area'],
  totalSquares: ['total squares', 'squares'],
  pitch:        ['predominant pitch', 'primary pitch', 'pitch', 'average pitch'],
  ridge:        ['ridge (lf)', 'ridge'],
  hip:          ['hip (lf)', 'hip'],
  valley:       ['valley (lf)', 'valley'],
  rake:         ['rake (lf)', 'rake'],
  eave:         ['eave (lf)', 'eave', 'eave / gutter (lf)', 'eave/gutter (lf)'],
  flashing:     ['flashing (lf)', 'flashing', 'step flashing (lf)'],
};

function findCol(headers: string[], aliases: string[]): number {
  const lower = headers.map(h => h.trim().toLowerCase());
  for (const alias of aliases) {
    const idx = lower.indexOf(alias.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseRoofrCSV(text: string): RoofrMeasurements | null {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return null;

  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());

  const idxSqFt    = findCol(headers, COL.totalSqFt);
  const idxSquares = findCol(headers, COL.totalSquares);
  const idxPitch   = findCol(headers, COL.pitch);
  const idxRidge   = findCol(headers, COL.ridge);
  const idxHip     = findCol(headers, COL.hip);
  const idxValley  = findCol(headers, COL.valley);
  const idxRake    = findCol(headers, COL.rake);
  const idxEave    = findCol(headers, COL.eave);
  const idxFlash   = findCol(headers, COL.flashing);

  // Use "Entire Structure" row if present, else use last data row
  let dataRow: string[] | null = null;
  for (let i = lines.length - 1; i >= 1; i--) {
    const cells = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
    if (cells[0]?.toLowerCase().includes('entire') || cells[0]?.toLowerCase().includes('total')) {
      dataRow = cells;
      break;
    }
    if (!dataRow) dataRow = cells; // fallback: last data row
  }

  if (!dataRow) return null;

  const num = (idx: number) => idx >= 0 ? parseFloat(dataRow![idx] || '0') || 0 : 0;
  const str = (idx: number) => idx >= 0 ? (dataRow![idx] || '') : '';

  const totalSqFt    = num(idxSqFt);
  const totalSquares = num(idxSquares) || (totalSqFt > 0 ? totalSqFt / 100 : 0);

  if (totalSquares === 0 && totalSqFt === 0) return null;

  return {
    totalSquares: Math.round(totalSquares * 10) / 10,
    totalSqFt:    totalSqFt || Math.round(totalSquares * 100),
    ridgeLength:  num(idxRidge),
    hipLength:    num(idxHip),
    valleyLength: num(idxValley),
    eaveLength:   num(idxEave),
    rakeLength:   num(idxRake),
    flashingLength: num(idxFlash),
    predominantPitch: str(idxPitch) || 'Unknown',
    facetCount:   0,
  };
}

function parseRoofrJSON(text: string): RoofrMeasurements | null {
  try {
    const json = JSON.parse(text);
    // Accept our own StoredOrder.measurements shape directly
    if (typeof json.totalSquares === 'number') return json as RoofrMeasurements;
    // Accept wrapped: { measurements: {...} }
    if (json.measurements && typeof json.measurements.totalSquares === 'number') {
      return json.measurements as RoofrMeasurements;
    }
    return null;
  } catch {
    return null;
  }
}

async function parseMeasurementFile(file: File): Promise<RoofrMeasurements | null> {
  const text = await file.text();
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.json')) return parseRoofrJSON(text);
  // CSV — also try JSON parse as fallback
  const csvResult = parseRoofrCSV(text);
  if (csvResult) return csvResult;
  return parseRoofrJSON(text);
}

// ── Line item generators ──────────────────────────────────────────────────────

function makeItem(description: string, quantity: number, unit: string): EstimateItem {
  return {
    id: crypto.randomUUID(),
    description,
    quantity: Math.round(quantity * 10) / 10,
    unit,
    unitPrice: 0,
    total: 0,
  };
}

function generateAsphaltItems(m: RoofrMeasurements): EstimateItem[] {
  const sq     = m.totalSquares;
  const sqft   = m.totalSqFt || sq * 100;
  const waste  = 1.1;
  const items: EstimateItem[] = [
    makeItem('Roof Tear-Off & Disposal',                    sq,                              'sq'),
    makeItem('Architectural Asphalt Shingles (30-year)',    Math.ceil(sq * waste),           'sq'),
    makeItem('Synthetic Underlayment',                      Math.ceil(sqft * waste),         'sqft'),
    makeItem('Ice & Water Shield (valleys/eaves)',          Math.ceil(sqft * waste * 0.15 / 200), 'roll'),
    makeItem('Drip Edge (aluminum)',                        Math.ceil(m.eaveLength + m.rakeLength), 'lf'),
    makeItem('Ridge Vent',                                  Math.ceil(m.ridgeLength),        'lf'),
    makeItem('Ridge Cap Shingles',                          Math.ceil(m.ridgeLength / 35),   'bundle'),
    makeItem('Starter Shingles',                            Math.ceil(m.eaveLength),         'lf'),
  ];
  if (m.valleyLength > 0) {
    items.push(makeItem('Valley Flashing (metal)', Math.ceil(m.valleyLength), 'lf'));
  }
  items.push(
    makeItem('Pipe Boots/Flashings',        Math.max(2, Math.ceil(sqft / 500)),  'ea'),
    makeItem('Roofing Nails & Fasteners',   1,                                   'lot'),
    makeItem('Labor - Installation',        sq,                                  'sq'),
    makeItem('Dumpster & Cleanup',          1,                                   'ea'),
  );
  return items;
}

function generateCorrugatedMetalItems(m: RoofrMeasurements): EstimateItem[] {
  const sq   = m.totalSquares;
  const sqft = m.totalSqFt || sq * 100;
  const waste = 1.1;
  const items: EstimateItem[] = [
    makeItem('Roof Tear-Off & Disposal (if needed)',  sq,                             'sq'),
    makeItem('Corrugated Metal Panels (29 gauge)',    Math.ceil(sqft * waste),        'sqft'),
    makeItem('Synthetic Underlayment',                Math.ceil(sq * waste),          'sq'),
    makeItem('Metal Roof Purlins/Strapping',          Math.ceil(sqft * waste),        'sqft'),
    makeItem('Eave Trim (metal)',                     Math.ceil(m.eaveLength),        'lf'),
    makeItem('Rake Trim (metal)',                     Math.ceil(m.rakeLength),        'lf'),
    makeItem('Ridge Cap (metal)',                     Math.ceil(m.ridgeLength),       'lf'),
  ];
  if (m.valleyLength > 0) {
    items.push(makeItem('Valley Flashing (metal)', Math.ceil(m.valleyLength), 'lf'));
  }
  items.push(
    makeItem('Closure Strips (foam)',         Math.ceil(m.eaveLength + m.rakeLength), 'lf'),
    makeItem('Metal Roofing Screws (w/ washers)', Math.ceil(sqft / 100),             'box'),
    makeItem('Pipe Flashings (metal)',        Math.max(2, Math.ceil(sqft / 500)),     'ea'),
    makeItem('Butyl Sealant Tape',            Math.ceil(sqft / 400),                 'roll'),
    makeItem('Labor - Installation',          sq,                                    'sq'),
    makeItem('Dumpster & Cleanup',            1,                                     'ea'),
  );
  return items;
}

function generateStandingSeamItems(m: RoofrMeasurements): EstimateItem[] {
  const sq   = m.totalSquares;
  const sqft = m.totalSqFt || sq * 100;
  const waste = 1.1;
  const items: EstimateItem[] = [
    makeItem('Roof Tear-Off & Disposal (if needed)',    sq,                             'sq'),
    makeItem('Standing Seam Metal Panels (24 gauge)',   Math.ceil(sqft * waste),        'sqft'),
    makeItem('High-Temp Underlayment',                  Math.ceil(sq * waste),          'sq'),
    makeItem('Metal Roof Clips (concealed fasteners)',  Math.ceil(sqft * waste),        'sqft'),
    makeItem('Eave Trim (custom bent)',                 Math.ceil(m.eaveLength),        'lf'),
    makeItem('Rake Trim (custom bent)',                 Math.ceil(m.rakeLength),        'lf'),
    makeItem('Ridge Cap (standing seam)',               Math.ceil(m.ridgeLength),       'lf'),
  ];
  if (m.valleyLength > 0) {
    items.push(makeItem('Valley Panels (standing seam)', Math.ceil(m.valleyLength), 'lf'));
  }
  items.push(
    makeItem('Pipe Flashings (custom)',       Math.max(2, Math.ceil(sqft / 500)),     'ea'),
    makeItem('Butyl Sealant & Accessories',   1,                                      'lot'),
    makeItem('Labor - Installation (specialized)', sq,                                'sq'),
    makeItem('Seaming Tool Rental',           1,                                      'ea'),
    makeItem('Dumpster & Cleanup',            1,                                      'ea'),
  );
  return items;
}

function generateItems(roofType: RoofType, m: RoofrMeasurements): EstimateItem[] {
  if (roofType === 'asphalt')          return generateAsphaltItems(m);
  if (roofType === 'corrugated-metal') return generateCorrugatedMetalItems(m);
  return generateStandingSeamItems(m);
}

const ROOF_TYPE_META: Record<RoofType, { label: string; sub: string; terms: string }> = {
  'asphalt': {
    label: 'Asphalt Shingle Roof',
    sub: 'Architectural 30-year shingles · full system replacement',
    terms: '50% deposit required. Balance due upon completion. Warranty: 10-year workmanship, 30-year manufacturer.',
  },
  'corrugated-metal': {
    label: 'Corrugated Metal Roof',
    sub: '29-gauge corrugated panels · energy-efficient & durable',
    terms: '50% deposit required. Balance due upon completion. Warranty: 10-year workmanship, 40-year paint warranty.',
  },
  'standing-seam': {
    label: 'Standing Seam Metal Roof',
    sub: '24-gauge concealed fasteners · premium system',
    terms: '50% deposit required. Balance due upon completion. Warranty: 15-year workmanship, lifetime paint warranty.',
  },
};

// ── Measurement summary card ──────────────────────────────────────────────────

function MeasurementCard({ m }: { m: RoofrMeasurements }) {
  const rows = [
    { label: 'Total Squares',     value: `${m.totalSquares} sq` },
    { label: 'Total Area',        value: `${(m.totalSqFt || m.totalSquares * 100).toLocaleString()} sq ft` },
    { label: 'Pitch',             value: m.predominantPitch || '—' },
    { label: 'Ridge',             value: `${m.ridgeLength} LF` },
    { label: 'Hip',               value: `${m.hipLength} LF` },
    { label: 'Valley',            value: `${m.valleyLength} LF` },
    { label: 'Eave',              value: `${m.eaveLength} LF` },
    { label: 'Rake',              value: `${m.rakeLength} LF` },
    { label: 'Flashing',          value: `${m.flashingLength} LF` },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {rows.map(({ label, value }) => (
        <div key={label} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
          <p className="text-xs text-gray-400">{label}</p>
          <p className="text-sm font-semibold text-gray-800">{value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RoofrEstimateWizard({
  contactId, contactName, companyId, userId,
  existingMeasurements,
  onClose, onEstimateCreated,
}: Props) {
  const [step, setStep]               = useState<1 | 2 | 3>(existingMeasurements ? 2 : 1);
  const [measurements, setMeasurements] = useState<RoofrMeasurements | null>(existingMeasurements ?? null);
  const [roofType, setRoofType]       = useState<RoofType | null>(null);
  const [items, setItems]             = useState<EstimateItem[]>([]);
  const [title, setTitle]             = useState('');
  const [terms, setTerms]             = useState('');
  const [saving, setSaving]           = useState(false);
  const [dragging, setDragging]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Manual entry form state
  const [manualSquares,  setManualSquares]  = useState('');
  const [manualSqFt,     setManualSqFt]     = useState('');
  const [manualPitch,    setManualPitch]    = useState('');
  const [manualRidge,    setManualRidge]    = useState('');
  const [manualHip,      setManualHip]      = useState('');
  const [manualValley,   setManualValley]   = useState('');
  const [manualEave,     setManualEave]     = useState('');
  const [manualRake,     setManualRake]     = useState('');
  const [manualFlashing, setManualFlashing] = useState('');
  const [manualError,    setManualError]    = useState<string | null>(null);

  // Saved Roofr PDFs
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // ── Manual entry submit ────────────────────────────────────────────────────

  const handleManualSubmit = () => {
    const sq = parseFloat(manualSquares);
    if (!sq || sq <= 0) { setManualError('Total Squares is required.'); return; }
    setManualError(null);
    const sqft = parseFloat(manualSqFt) || sq * 100;
    setMeasurements({
      totalSquares:    Math.round(sq * 10) / 10,
      totalSqFt:       Math.round(sqft),
      predominantPitch: manualPitch.trim() || 'Unknown',
      ridgeLength:     parseFloat(manualRidge)    || 0,
      hipLength:       parseFloat(manualHip)      || 0,
      valleyLength:    parseFloat(manualValley)   || 0,
      eaveLength:      parseFloat(manualEave)     || 0,
      rakeLength:      parseFloat(manualRake)     || 0,
      flashingLength:  parseFloat(manualFlashing) || 0,
      facetCount:      0,
    });
    setStep(2);
  };

  // ── Load saved Roofr reports from documents ────────────────────────────────
  
  useEffect(() => {
    loadSavedReports();
  }, [contactId]);

  const loadSavedReports = async () => {
    setLoadingReports(true);
    try {
      const docs = await db.getContactDocuments(contactId);
      const roofrReports = docs.filter((d: any) => 
        d.category === 'measurements' && 
        d.file_type === 'application/pdf'
      );
      setSavedReports(roofrReports);
    } catch (error) {
      console.error('Failed to load saved reports:', error);
    } finally {
      setLoadingReports(false);
    }
  };

  // ── Load and parse a saved PDF ──────────────────────────────────────────────
  
  const loadSavedPdf = async (doc: any) => {
    setLoadingPdf(true);
    toast.info('Parsing Roofr PDF...');
    try {
      // Fetch the PDF file from the URL
      const response = await fetch(doc.file_url);
      if (!response.ok) throw new Error('Failed to fetch PDF');
      
      const blob = await response.blob();
      const file = new File([blob], doc.file_name, { type: 'application/pdf' });
      
      // Parse using the roofrParser
      const { parseRoofrPDFWithStructures } = await import('@/lib/roofrParser');
      const result = await parseRoofrPDFWithStructures(file);
      
      // Pre-fill manual fields so user can review
      const m = result.combinedMeasurements;
      setManualSquares(String(m.totalSquares));
      setManualSqFt(String(m.totalSqFt));
      setManualPitch(m.predominantPitch || '');
      setManualRidge(String(m.ridgeLength));
      setManualHip(String(m.hipLength));
      setManualValley(String(m.valleyLength));
      setManualEave(String(m.eaveLength));
      setManualRake(String(m.rakeLength));
      setManualFlashing(String(m.flashingLength));
      
      toast.success(`Measurements loaded from ${doc.name}! Review and click Continue.`);
    } catch (error) {
      console.error('Failed to parse saved PDF:', error);
      toast.error('Could not read measurements from this file. Make sure it is a Roofr CSV or JSON export, or that the Report is a PDF with valid measurements.');
    } finally {
      setLoadingPdf(false);
    }
  };

  // ── File upload / drag-drop (CSV/JSON/PDF) ──────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (file.name.toLowerCase().endsWith('.pdf')) {
      // Now we support PDFs!
      setLoadingPdf(true);
      toast.info('Parsing Roofr PDF...');
      try {
        const { parseRoofrPDFWithStructures } = await import('@/lib/roofrParser');
        const result = await parseRoofrPDFWithStructures(file);
        
        const m = result.combinedMeasurements;
        setManualSquares(String(m.totalSquares));
        setManualSqFt(String(m.totalSqFt));
        setManualPitch(m.predominantPitch || '');
        setManualRidge(String(m.ridgeLength));
        setManualHip(String(m.hipLength));
        setManualValley(String(m.valleyLength));
        setManualEave(String(m.eaveLength));
        setManualRake(String(m.rakeLength));
        setManualFlashing(String(m.flashingLength));
        
        toast.success('PDF measurements loaded — review and click Continue.');
      } catch (error) {
        console.error('PDF parse error:', error);
        toast.error('Could not read measurements from PDF. Please enter manually.');
      } finally {
        setLoadingPdf(false);
      }
      return;
    }
    
    const m = await parseMeasurementFile(file);
    if (!m) {
      toast.error('Could not read measurements. Use a Roofr CSV/JSON export, upload a PDF, or enter values manually below.');
      return;
    }
    // Pre-fill manual fields from parsed data so user can review
    setManualSquares(String(m.totalSquares));
    setManualSqFt(String(m.totalSqFt));
    setManualPitch(m.predominantPitch || '');
    setManualRidge(String(m.ridgeLength));
    setManualHip(String(m.hipLength));
    setManualValley(String(m.valleyLength));
    setManualEave(String(m.eaveLength));
    setManualRake(String(m.rakeLength));
    setManualFlashing(String(m.flashingLength));
    toast.success('Measurements loaded — review and click Continue.');
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // ── Step transitions ───────────────────────────────────────────────────────

  const handleSelectRoofType = (type: RoofType) => {
    if (!measurements) return;
    const meta = ROOF_TYPE_META[type];
    const newItems = generateItems(type, measurements);
    setRoofType(type);
    setItems(newItems);
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    setTitle(`${meta.label} — ${contactName}`);
    setTerms(meta.terms);
    setStep(3);
  };

  // ── Line item editing ──────────────────────────────────────────────────────

  const updatePrice = (idx: number, price: number) => {
    setItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, unitPrice: price, total: Math.round(item.quantity * price * 100) / 100 } : item
    ));
  };

  const updateQty = (idx: number, qty: number) => {
    setItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, quantity: qty, total: Math.round(qty * item.unitPrice * 100) / 100 } : item
    ));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const subtotal = items.reduce((s, i) => s + i.total, 0);

  // ── Save estimate ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!profile_check()) return;
    if (subtotal <= 0) {
      toast.error('Please enter at least one unit price before saving.');
      return;
    }
    setSaving(true);
    try {
      const estimateData = {
        company_id:         companyId,
        contact_id:         contactId,
        estimate_number:    `EST-${Date.now().toString().slice(-6)}`,
        title:              title || `${ROOF_TYPE_META[roofType!].label} — ${contactName}`,
        items,
        subtotal,
        tax:                0,
        total:              subtotal,
        status:             'draft' as const,
        terms_and_conditions: terms || undefined,
        notes:              `Generated from Roofr measurements. Roof: ${measurements?.totalSquares} sq (${measurements?.totalSqFt?.toLocaleString() ?? ''} sq ft), pitch ${measurements?.predominantPitch}.`,
        created_by:         userId || undefined,
        validity_date:      (() => {
          const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0];
        })(),
      };
      const created = await db.createEstimate(estimateData);
      if (created) {
        toast.success('Estimate created! You can find it in the Estimates tab.');
        onEstimateCreated();
        onClose();
      } else {
        toast.error('Failed to create estimate. Please try again.');
      }
    } catch (err: any) {
      toast.error(`Error: ${err?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  function profile_check() {
    // companyId is required (passed as prop)
    return !!companyId;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Create Estimate from Roofr Measurements</h2>
            <p className="text-xs text-gray-500 mt-0.5">{contactName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium shrink-0">
          {(['Measurements', 'Roof Type', 'Line Items & Pricing'] as const).map((label, i) => {
            const s = i + 1;
            const active = step === s;
            const done   = step > s;
            return (
              <React.Fragment key={label}>
                <div className={`flex items-center gap-1.5 ${active ? 'text-green-700' : done ? 'text-green-500' : 'text-gray-400'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    active ? 'bg-green-600 text-white' : done ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {done ? <CheckCircle size={12} /> : s}
                  </span>
                  <span>{label}</span>
                </div>
                {i < 2 && <ChevronRight size={14} className="text-gray-300" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {/* ── Step 1: Measurements ────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Saved Roofr Reports Section */}
              {savedReports.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={16} className="text-green-600" />
                    <h3 className="text-sm font-semibold text-green-900">
                      Saved Roofr Reports ({savedReports.length})
                    </h3>
                  </div>
                  <p className="text-xs text-green-700 mb-3">
                    Click a report to automatically load measurements:
                  </p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {savedReports.map((doc: any) => (
                      <button
                        key={doc.id}
                        onClick={() => loadSavedPdf(doc)}
                        disabled={loadingPdf}
                        className="w-full text-left p-3 bg-white border border-green-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {doc.notes || 'No description'} • {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          {loadingPdf ? (
                            <Loader2 size={16} className="text-green-600 animate-spin shrink-0" />
                          ) : (
                            <ChevronRight size={16} className="text-green-600 shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                <ClipboardList size={15} className="mt-0.5 shrink-0" />
                <span>Upload a Roofr PDF below, or manually enter measurements. Only <strong>Total Squares</strong> is required — add the others for more accurate material quantities.</span>
              </div>

              {/* Manual entry grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Total Squares <span className="text-red-500">*</span></label>
                  <input type="number" min="0" step="0.1" placeholder="e.g. 32.4"
                    value={manualSquares} onChange={e => setManualSquares(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Total Area (sq ft)</label>
                  <input type="number" min="0" placeholder="e.g. 3240 — or leave blank"
                    value={manualSqFt} onChange={e => setManualSqFt(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Predominant Pitch</label>
                  <input type="text" placeholder="e.g. 6/12"
                    value={manualPitch} onChange={e => setManualPitch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Ridge (LF)</label>
                  <input type="number" min="0" step="0.1" placeholder="0"
                    value={manualRidge} onChange={e => setManualRidge(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Hip (LF)</label>
                  <input type="number" min="0" step="0.1" placeholder="0"
                    value={manualHip} onChange={e => setManualHip(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Valley (LF)</label>
                  <input type="number" min="0" step="0.1" placeholder="0"
                    value={manualValley} onChange={e => setManualValley(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Eave (LF)</label>
                  <input type="number" min="0" step="0.1" placeholder="0"
                    value={manualEave} onChange={e => setManualEave(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Rake (LF)</label>
                  <input type="number" min="0" step="0.1" placeholder="0"
                    value={manualRake} onChange={e => setManualRake(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Flashing (LF)</label>
                  <input type="number" min="0" step="0.1" placeholder="0"
                    value={manualFlashing} onChange={e => setManualFlashing(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                </div>
              </div>

              {manualError && (
                <p className="text-xs text-red-600">{manualError}</p>
              )}

              {/* File upload - CSV, JSON, or PDF */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                  dragging ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                }`}
              >
                <input ref={fileRef} type="file" accept=".csv,.json,.txt,.pdf" className="hidden" onChange={onFileChange} />
                {loadingPdf ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={18} className="text-green-600 animate-spin" />
                    <p className="text-xs text-gray-600">Parsing PDF...</p>
                  </div>
                ) : (
                  <>
                    <FileSpreadsheet size={18} className="mx-auto mb-1 text-gray-300" />
                    <p className="text-xs text-gray-400">Have a Roofr file? <span className="text-green-600 underline">Click to upload</span> (PDF, CSV, or JSON) and auto-fill the fields above</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: Roof type ────────────────────────────────────────────── */}
          {step === 2 && measurements && (
            <div className="space-y-5">
              {/* Measurement summary */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Measurements</p>
                <MeasurementCard m={measurements} />
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Select Roof Type</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(Object.entries(ROOF_TYPE_META) as [RoofType, typeof ROOF_TYPE_META[RoofType]][]).map(([type, meta]) => (
                    <button
                      key={type}
                      onClick={() => handleSelectRoofType(type)}
                      className="text-left p-4 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-colors group"
                    >
                      <p className="font-semibold text-gray-900 text-sm group-hover:text-green-700">{meta.label}</p>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{meta.sub}</p>
                      <div className="mt-3 flex items-center gap-1 text-xs text-green-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        Select <ChevronRight size={13} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {existingMeasurements && (
                <button
                  onClick={() => { setMeasurements(null); setStep(1); }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Upload a different measurement file instead
                </button>
              )}
            </div>
          )}

          {/* ── Step 3: Line items & pricing ─────────────────────────────────── */}
          {step === 3 && roofType && (
            <div className="space-y-5">
              {/* Estimate title */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Estimate Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Line items table */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Line Items — quantities auto-filled from measurements, enter your unit prices
                </p>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Description</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600 text-xs w-16">Qty</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs w-14">Unit</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600 text-xs w-28">Unit Price ($)</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600 text-xs w-24">Total</th>
                        <th className="w-8 px-1" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700 text-xs">{item.description}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={item.quantity}
                              onChange={e => updateQty(idx, parseFloat(e.target.value) || 0)}
                              className="w-16 text-right border border-gray-200 rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-green-500 focus:border-green-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{item.unit}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice || ''}
                              placeholder="0.00"
                              onChange={e => updatePrice(idx, parseFloat(e.target.value) || 0)}
                              className="w-full text-right border border-gray-200 rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-green-500 focus:border-green-500 bg-yellow-50 focus:bg-white"
                            />
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-medium text-gray-800">
                            {item.total > 0 ? `$${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="px-1 py-2">
                            <button
                              onClick={() => removeItem(idx)}
                              className="text-gray-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-right text-xs font-bold text-gray-700">Subtotal</td>
                        <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">
                          ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="text-xs text-amber-600 mt-1.5">
                  Yellow cells need pricing — enter your unit prices above.
                </p>
              </div>

              {/* Terms */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Terms &amp; Conditions</label>
                <textarea
                  rows={2}
                  value={terms}
                  onChange={e => setTerms(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0 rounded-b-2xl">
          <button
            onClick={() => {
              if (step === 3) setStep(2);
              else if (step === 2) setStep(existingMeasurements ? 2 : 1);
              else onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-white transition-colors"
          >
            <ChevronLeft size={15} />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step === 1 && (
            <button
              onClick={handleManualSubmit}
              className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              Continue <ChevronRight size={15} />
            </button>
          )}

          {step === 3 && (
            <button
              onClick={handleSave}
              disabled={saving || items.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              {saving ? 'Saving…' : 'Save Draft Estimate'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

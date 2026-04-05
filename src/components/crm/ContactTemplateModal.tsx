// ContactTemplateModal — Redesigned with proper cost breakdown editor
import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { useFormDraft } from '@/lib/useFormDraft';
import { X, FileText, ChevronLeft, Search, DollarSign, Save, Loader2, Plus, Trash2, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/authContext';
import { db, DbCompany } from '@/lib/database';
import { htmlStringToPdfBlob, uploadToAvailableBucket } from '@/lib/pdfService';
import { buildStoredDocumentUrl } from '@/lib/documentAccess';
import {
  DocumentTemplate,
  LineItemDefault,
  getContractorEstimateTemplates,
  buildContactOverrides,
  fillTemplateVars,
  getUnfilledVars,
} from '@/lib/contractorTemplates';
import { Contact, Document, getContactFullName } from '@/lib/crmData';
import type { RoofrMeasurements, StructureMeasurements } from '@/lib/roofrParser';

interface RoofrData {
  measurements: RoofrMeasurements;
  structures?: StructureMeasurements[];
}

interface Props {
  contact: Contact;
  onClose: () => void;
  onDocumentSaved: (doc: Document) => void;
  roofrData?: RoofrData;
}

interface LineItem {
  id: string;
  description: string;
  qty: string;
  unit: string;
  unitPrice: string;
  total: string; // manual override total (used when qty is empty/Lot)
  structureGroup?: string; // e.g. "Structure 1", "Garage" — used to render section headers
}

const CATEGORY_LABELS: Record<string, string> = {
  estimate: 'Estimates',
  invoice: 'Invoices',
  contract: 'Contracts',
  'work-order': 'Work Orders',
  proposal: 'Proposals',
  'change-order': 'Change Orders',
  safety: 'Safety',
  legal: 'Legal',
  other: 'Other',
};

const CATEGORY_COLORS: Record<string, string> = {
  estimate: 'bg-green-100 text-green-800',
  invoice: 'bg-blue-100 text-blue-800',
  contract: 'bg-purple-100 text-purple-800',
  'work-order': 'bg-orange-100 text-orange-800',
  proposal: 'bg-indigo-100 text-indigo-800',
  'change-order': 'bg-yellow-100 text-yellow-800',
  safety: 'bg-red-100 text-red-800',
  legal: 'bg-gray-100 text-gray-800',
  other: 'bg-gray-100 text-gray-800',
};

// Fields that are handled by the line-items / totals UI — excluded from the sidebar form
const COST_FIELD_PATTERNS = [
  '_RATE', '_TOTAL', 'SUBTOTAL', 'TAX_RATE', 'TAX_AMOUNT',
  'TOTAL_AMOUNT', 'DEPOSIT_AMOUNT', 'BALANCE_DUE',
  'TEAROFF_', 'DECKING_', 'ICE_WATER_', 'UNDERLAY_', 'DRIP_EDGE_',
  'SHINGLE_RATE', 'SHINGLE_TOTAL', 'RIDGE_', 'FLASHING_', 'VENT_',
  'CLEANUP_', 'PANEL_RATE', 'PANEL_TOTAL', 'CLIP_RATE', 'CLIP_TOTAL',
  'TRIM_LF', 'TRIM_RATE', 'TRIM_TOTAL', 'EAVE_LF', 'EAVE_RATE', 'EAVE_TOTAL',
  'SNOW_GUARD_QTY', 'SNOW_GUARD_RATE', 'SNOW_GUARD_TOTAL',
  'HARDWARE_TOTAL', 'REMOVAL_', 'WRAP_', 'SIDING_RATE', 'SIDING_TOTAL',
  'SOFFIT_RATE', 'SOFFIT_TOTAL', 'FASCIA_RATE', 'FASCIA_TOTAL',
  'WINDOW_TRIM_', 'WINDOW_WRAP_', 'SHEATHING_',
  'GUTTER_RATE', 'GUTTER_TOTAL', 'DOWNSPOUT_RATE', 'DOWNSPOUT_TOTAL',
  'GG_RATE', 'GG_TOTAL', 'EXTENSION_RATE', 'EXTENSION_TOTAL',
  'FASCIA_REPAIR_', 'REMOVE_GUT_',
];

// TERMS_CONTENT is always editable (shown as textarea); WARRANTY_PERIOD + PAYMENT_TERMS are now
// embedded inside TERMS_CONTENT so we don't show them as separate fields.
const TERMS_FIELDS = ['TERMS_CONTENT'];
const DOC_INFO_FIELDS = ['ESTIMATE_NUMBER', 'START_DATE', 'ESTIMATED_DURATION', 'ESTIMATE_DATE', 'ESTIMATE_EXPIRY', 'CONTRACT_NUMBER', 'CONTRACT_DATE', 'ESTIMATED_COMPLETION'];

function isCostField(key: string): boolean {
  return COST_FIELD_PATTERNS.some(p => key.includes(p));
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseNum(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function calcItemTotal(item: LineItem): number {
  const qtyNum = parseNum(item.qty);
  const price = parseNum(item.unitPrice);
  if (item.qty.trim() === '' || item.unit.toLowerCase() === 'lot') {
    // Lot item — use manual total
    return parseNum(item.total);
  }
  if (qtyNum > 0 && price > 0) return qtyNum * price;
  return parseNum(item.total);
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fromDefault(d: LineItemDefault): LineItem {
  return {
    id: crypto.randomUUID(),
    description: d.description,
    qty: d.qty,
    unit: d.unit,
    unitPrice: d.unitPrice > 0 ? String(d.unitPrice) : '',
    total: d.total > 0 ? String(d.total) : '',
  };
}

// Keys whose values are computed from lineItems/totals — must NOT be pre-filled by fillTemplateVars.
// buildContactOverrides() returns hardcoded placeholder values for these; we replace them with
// the computed values AFTER fillTemplateVars runs, so they must be stripped from merged first.
const COMPUTED_TOTAL_KEYS = [
  'SUBTOTAL','TAX_AMOUNT','TOTAL_AMOUNT','DEPOSIT_AMOUNT','BALANCE_DUE',
  'TEAROFF_TOTAL','DECKING_TOTAL','ICE_WATER_TOTAL','UNDERLAY_TOTAL',
  'DRIP_EDGE_TOTAL','SHINGLE_TOTAL','RIDGE_TOTAL','FLASHING_TOTAL',
  'VENT_TOTAL','CLEANUP_TOTAL','PANEL_TOTAL','TRIM_TOTAL','EAVE_TOTAL',
  'HARDWARE_TOTAL','REMOVAL_TOTAL','WRAP_TOTAL','SOFFIT_TOTAL',
  'FASCIA_TOTAL','GUTTER_TOTAL','DOWNSPOUT_TOTAL',
];

/** True when a line item should be treated as a lump-sum / Lot item. */
function isLotItem(item: LineItem): boolean {
  const qty = item.qty.trim();
  const unit = item.unit.trim().toLowerCase();
  return qty === '' || unit === 'lot' || unit === '' ;
}

/** Format qty + unit for display, avoiding double-printing when unit already contains qty. */
function formatQtyUnit(item: LineItem): string {
  if (isLotItem(item)) return 'Lot';
  const qty = item.qty.trim();
  const unit = item.unit.trim();
  // Guard: if unit starts with a digit the user likely typed "1 Lot" — treat as Lot
  if (/^\d/.test(unit)) return 'Lot';
  return `${qty}${unit ? ' ' + unit : ''}`;
}

/** Render line items to HTML table rows, injecting group header rows when structureGroup changes. */
function buildLineItemsHtml(items: LineItem[]): string {
  let lastGroup: string | undefined = undefined;
  const rows: string[] = [];
  for (const item of items) {
    if (item.structureGroup !== undefined && item.structureGroup !== lastGroup) {
      lastGroup = item.structureGroup;
      rows.push(
        `<tr style="background:#f1f5f9;"><td colspan="4" style="padding:6px 10px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.05em;">${escHtml(lastGroup)}</td></tr>`
      );
    }
    const computedTotal = calcItemTotal(item);
    const lot = isLotItem(item);
    const qtyDisplay = formatQtyUnit(item);
    const priceDisplay = (!lot && parseNum(item.unitPrice) > 0) ? `$${fmt(parseNum(item.unitPrice))}` : '—';
    rows.push(`<tr><td>${escHtml(item.description || '—')}</td><td>${escHtml(qtyDisplay)}</td><td>${priceDisplay}</td><td>$${fmt(computedTotal)}</td></tr>`);
  }
  return rows.join('\n      ');
}

/** Apply Roofr measurements to a line items array.
 *  Matches on description keywords — safe to call on any template's defaults. */
function applyRoofrToLineItems(items: LineItem[], m: RoofrMeasurements): LineItem[] {
  const sq = m.totalSquares > 0 ? String(Math.ceil(m.totalSquares)) : '';
  const drip = (m.eaveLength + m.rakeLength) > 0
    ? String(Math.ceil(m.eaveLength + m.rakeLength))
    : '';
  const ridge = m.ridgeLength > 0 ? String(Math.ceil(m.ridgeLength)) : '';

  return items.map(item => {
    const desc = item.description.toLowerCase();
    let qty = item.qty;

    if (sq && (desc.includes('tear-off') || desc.includes('tearoff') || desc.includes('tear off'))) qty = sq;
    else if (sq && desc.includes('ice') && desc.includes('water')) qty = sq;
    else if (sq && desc.includes('underlayment')) qty = sq;
    else if (sq && desc.includes('shingle') && !desc.includes('ridge')) qty = sq;
    else if (drip && desc.includes('drip edge')) qty = drip;
    else if (ridge && desc.includes('ridge cap')) qty = ridge;

    // Recalculate total when qty changed
    const price = parseNum(item.unitPrice);
    const qtyNum = parseFloat(qty);
    const newTotal = (qty !== item.qty && !isNaN(qtyNum) && price > 0)
      ? String(Math.round(qtyNum * price * 100) / 100)
      : item.total;

    return { ...item, qty, total: newTotal };
  });
}

/** Build field value overrides from Roofr measurements. */
function roofrFieldOverrides(m: RoofrMeasurements): Record<string, string> {
  const overrides: Record<string, string> = {};
  if (m.totalSquares > 0) {
    overrides['ROOF_SQUARES'] = String(Math.ceil(m.totalSquares));
    overrides['ROOF_SQFT'] = m.totalSqFt > 0 ? String(Math.round(m.totalSqFt)) : String(Math.round(m.totalSquares * 100));
  }
  if (m.predominantPitch) overrides['ROOF_PITCH'] = m.predominantPitch;
  if ((m.eaveLength + m.rakeLength) > 0) overrides['DRIP_EDGE_LF'] = String(Math.ceil(m.eaveLength + m.rakeLength));
  if (m.ridgeLength > 0) overrides['RIDGE_LF'] = String(Math.ceil(m.ridgeLength));
  return overrides;
}

export default function ContactTemplateModal({ contact, onClose, onDocumentSaved, roofrData }: Props) {
  const { profile } = useAuth();
  const [companyProfile, setCompanyProfile] = useState<DbCompany | null>(null);
  const [templates] = useState<DocumentTemplate[]>(getContractorEstimateTemplates());
  const [selected, setSelected] = useState<DocumentTemplate | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Line items state (for customer-service-agreement templates)
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [taxRate, setTaxRate] = useState('0');
  const [depositAmount, setDepositAmount] = useState('');
  // Roofr structure selector (when multiple structures detected)
  const [selectedRoofrStructureIdx, setSelectedRoofrStructureIdx] = useState<number>(0); // 0 = combined
  const initCompanyProfileRef = useRef<DbCompany | null>(null);
  const initProfileRef = useRef(profile);

  // Auto-save draft
  const tmplDraftKey = selected
    ? `template_draft_${contact.id}_${selected.id}`
    : `template_draft_${contact.id}_none`;
  const tmplDraftData = useMemo(() => ({ fieldValues, lineItems, taxRate, depositAmount, selectedId: selected?.id }),
    [fieldValues, lineItems, taxRate, depositAmount, selected?.id]);
  const { loadDraft: loadTmplDraft, clearDraft: clearTmplDraft } = useFormDraft(
    tmplDraftKey, tmplDraftData, { enabled: !!selected }
  );

  // Restore draft when a template is selected
  const restoredForRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!selected) return;
    if (restoredForRef.current === selected.id) return;
    restoredForRef.current = selected.id;
    const draft = loadTmplDraft();
    if (draft && draft.selectedId === selected.id) {
      if (Object.keys(draft.fieldValues || {}).length > 0) setFieldValues(draft.fieldValues);
      if ((draft.lineItems || []).length > 0) setLineItems(draft.lineItems);
      if (draft.taxRate) setTaxRate(draft.taxRate);
      if (draft.depositAmount) setDepositAmount(draft.depositAmount);
      // use a timeout so the toast fires after render
      setTimeout(() => { toast.info('Draft restored — your previous template was recovered.'); }, 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // Load company profile
  useEffect(() => {
    if (!profile?.company_id) return;
    db.getCompany(profile.company_id)
      .then(c => { if (c) setCompanyProfile(c); })
      .catch(() => {});
  }, [profile?.company_id]);

  useEffect(() => {
    if (companyProfile) {
      initCompanyProfileRef.current = companyProfile;
    }
  }, [companyProfile]);

  useEffect(() => {
    initProfileRef.current = profile;
  }, [profile]);

  const isAgreement = selected?.templateType === 'customer-service-agreement';

  // Initialize line items and field values when template is selected
  useEffect(() => {
    if (!selected) return;
    const initialCompany = initCompanyProfileRef.current ?? companyProfile;
    const initialProfile = initProfileRef.current ?? profile;

    if (selected.templateType === 'customer-service-agreement') {
      const lineDefaults = (selected as any).lineItemDefaults as LineItemDefault[] | undefined;
      let items: LineItem[] = lineDefaults && lineDefaults.length > 0
        ? lineDefaults.map(fromDefault)
        : [{ id: crypto.randomUUID(), description: '', qty: '', unit: '', unitPrice: '', total: '' }];

      // Auto-fill quantities from Roofr measurements if available
      if (roofrData) {
        const activeMeasurements = (roofrData.structures && roofrData.structures.length > 0 && selectedRoofrStructureIdx > 0)
          ? roofrData.structures[selectedRoofrStructureIdx - 1].measurements
          : roofrData.measurements;
        items = applyRoofrToLineItems(items, activeMeasurements);
      }

      setLineItems(items);
      // Pre-fill tax rate if in fields
      const taxField = selected.fields?.find(f => f.key === 'TAX_RATE');
      if (taxField?.defaultValue) setTaxRate(taxField.defaultValue);
    }

    // Seed field values: start from buildContactOverrides auto-fills so TERMS_CONTENT,
    // CONTRACT_DATE, CONTRACT_NUMBER etc. are pre-populated even if not in fields[].
    const autoBase = buildContactOverrides(contact, initialCompany, initialProfile);
    const defaults: Record<string, string> = {};

    // Pick useful auto-fill defaults into fieldValues so the user can override them
    const autoKeysToSeed = ['TERMS_CONTENT', 'CONTRACT_NUMBER', 'CONTRACT_DATE', 'ESTIMATE_DATE', 'ESTIMATE_NUMBER', 'ESTIMATE_EXPIRY', 'START_DATE', 'PAYMENT_TERMS', 'WARRANTY_PERIOD'];
    autoKeysToSeed.forEach(k => { if (autoBase[k]) defaults[k] = autoBase[k]; });

    // Also pull defaults from the template's fields[] definition
    selected.fields?.forEach(f => {
      if (f.defaultValue && !isCostField(f.key)) {
        defaults[f.key] = defaults[f.key] ?? f.defaultValue;
      }
    });

    // Auto-fill Roofr measurement fields (ROOF_SQUARES, RIDGE_LF, etc.)
    if (roofrData) {
      const activeMeasurements = (roofrData.structures && roofrData.structures.length > 0 && selectedRoofrStructureIdx > 0)
        ? roofrData.structures[selectedRoofrStructureIdx - 1].measurements
        : roofrData.measurements;
      Object.assign(defaults, roofrFieldOverrides(activeMeasurements));
    }

    setFieldValues(defaults);
  }, [selected?.id, contact.id, selectedRoofrStructureIdx]);

  // Computed totals
  const subtotal = useMemo(() => lineItems.reduce((sum, item) => sum + calcItemTotal(item), 0), [lineItems]);
  const taxAmount = useMemo(() => subtotal * parseNum(taxRate) / 100, [subtotal, taxRate]);
  const totalAmount = useMemo(() => subtotal + taxAmount, [subtotal, taxAmount]);
  const depositNum = useMemo(() => parseNum(depositAmount), [depositAmount]);
  const balanceDue = useMemo(() => totalAmount - depositNum, [totalAmount, depositNum]);

  // Build preview HTML
  const previewContent = useMemo(() => {
    if (!selected) return '';
    const base = buildContactOverrides(contact, companyProfile, profile);
    const merged = { ...base, ...fieldValues };
    // Strip hardcoded total values so computed replacements below can fill them correctly
    COMPUTED_TOTAL_KEYS.forEach(k => delete merged[k]);
    // Convert TERMS_CONTENT plain-text newlines → HTML <br> for the document
    if (merged.TERMS_CONTENT) {
      merged.TERMS_CONTENT = merged.TERMS_CONTENT.replace(/\n/g, '<br>');
    }
    let html = fillTemplateVars(selected.content, merged);

    if (isAgreement) {
      // Inject dynamic line item rows into the Cost Breakdown tbody (with optional structure group headers)
      const rowsHtml = buildLineItemsHtml(lineItems);
      html = html.replace(/<tbody>[\s\S]*?<\/tbody>/, `<tbody>\n      ${rowsHtml}\n    </tbody>`);

      // Replace totals with computed values
      html = html.replace(/\{\{SUBTOTAL\}\}/g, `$${fmt(subtotal)}`);
      html = html.replace(/\{\{TAX_RATE\}\}/g, taxRate || '0');
      html = html.replace(/\{\{TAX_AMOUNT\}\}/g, `$${fmt(taxAmount)}`);
      html = html.replace(/\{\{TOTAL_AMOUNT\}\}/g, `$${fmt(totalAmount)}`);
      html = html.replace(/\{\{DEPOSIT_AMOUNT\}\}/g, depositAmount ? `$${fmt(depositNum)}` : '—');
      html = html.replace(/\{\{BALANCE_DUE\}\}/g, depositAmount ? `$${fmt(balanceDue)}` : '—');
    }
    return html;
  }, [selected, companyProfile, profile, fieldValues, lineItems, taxRate, depositAmount, isAgreement, subtotal, taxAmount, totalAmount, depositNum, balanceDue, contact]);

  const handleSelect = (t: DocumentTemplate) => {
    setSelected(t);
    setFieldValues({});
    setLineItems([]);
    setTaxRate('0');
    setDepositAmount('');
  };

  const handleBack = () => {
    setSelected(null);
    setFieldValues({});
    setLineItems([]);
  };

  // Line item CRUD
  const addLineItem = () => {
    setLineItems(prev => [...prev, { id: crypto.randomUUID(), description: '', qty: '', unit: '', unitPrice: '', total: '' }]);
  };

  const removeLineItem = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      // Auto-calc total when qty or unitPrice changes
      if (field === 'qty' || field === 'unitPrice') {
        const qtyNum = parseNum(updated.qty);
        const price = parseNum(updated.unitPrice);
        const isLot = isLotItem(updated);
        if (!isLot && qtyNum > 0 && price > 0) {
          updated.total = String((qtyNum * price).toFixed(2));
        }
      }
      return updated;
    }));
  };

  const handleSave = async () => {
    if (!selected || !profile?.company_id) {
      toast.error('Unable to save — missing company context.');
      return;
    }

    const base = buildContactOverrides(contact, companyProfile, profile);
    const merged = { ...base, ...fieldValues };
    // Strip hardcoded total values so computed replacements fill them correctly
    COMPUTED_TOTAL_KEYS.forEach(k => delete merged[k]);
    // Convert TERMS_CONTENT plain-text newlines → HTML <br>
    if (merged.TERMS_CONTENT) {
      merged.TERMS_CONTENT = merged.TERMS_CONTENT.replace(/\n/g, '<br>');
    }
    const finalHtml = (() => {
      let html = fillTemplateVars(selected.content, merged);
      if (isAgreement) {
        const rowsHtml = buildLineItemsHtml(lineItems);
        html = html.replace(/<tbody>[\s\S]*?<\/tbody>/, `<tbody>${rowsHtml}</tbody>`);
        html = html.replace(/\{\{SUBTOTAL\}\}/g, `$${fmt(subtotal)}`);
        html = html.replace(/\{\{TAX_RATE\}\}/g, taxRate || '0');
        html = html.replace(/\{\{TAX_AMOUNT\}\}/g, `$${fmt(taxAmount)}`);
        html = html.replace(/\{\{TOTAL_AMOUNT\}\}/g, `$${fmt(totalAmount)}`);
        html = html.replace(/\{\{DEPOSIT_AMOUNT\}\}/g, depositAmount ? `$${fmt(depositNum)}` : '—');
        html = html.replace(/\{\{BALANCE_DUE\}\}/g, depositAmount ? `$${fmt(balanceDue)}` : '—');
      }
      return html;
    })();

    // Check for unfilled vars (non-agreement templates only check fields; agreement skips cost vars)
    const stillUnfilled = getUnfilledVars(finalHtml).filter(v => !isCostField(v) && !TERMS_FIELDS.includes(v) || (!isAgreement));
    if (!isAgreement && stillUnfilled.length > 0) {
      toast.error(`Please fill in: ${stillUnfilled.slice(0, 3).join(', ')}${stillUnfilled.length > 3 ? '...' : ''}`);
      return;
    }

    setIsSaving(true);
    try {
      const contactName = getContactFullName(contact).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `${selected.name.replace(/\s+/g, '_')}_${contactName}_${timestamp}.pdf`;

      const pdfBlob = await htmlStringToPdfBlob(finalHtml, fileName);
      const storagePath = `${profile.company_id}/${contact.id}/${fileName}`;
      const uploaded = await uploadToAvailableBucket(storagePath, pdfBlob, 'application/pdf', profile.company_id);
      const storedUrl = buildStoredDocumentUrl(uploaded.publicUrl, uploaded.bucket, uploaded.path);

      const repName = profile
        ? `${(profile as any).first_name || ''} ${(profile as any).last_name || ''}`.trim()
        : 'Unknown';

      const newDbDoc = await db.createDocument({
        company_id: profile.company_id,
        contact_id: contact.id,
        name: `${selected.name} — ${getContactFullName(contact)}`,
        type: selected.category === 'estimate' ? 'estimate' : 'other',
        url: storedUrl,
        size: `${Math.round(pdfBlob.size / 1024)} KB`,
        uploaded_by: profile?.id || null,
      });

      if (!newDbDoc) throw new Error('Failed to create document record');

      const frontendDoc: Document = {
        id: newDbDoc.id,
        contactId: contact.id,
        name: newDbDoc.name,
        type: (newDbDoc.type || 'other') as Document['type'],
        url: newDbDoc.url,
        uploadedAt: newDbDoc.created_at || new Date().toISOString(),
        uploadedBy: newDbDoc.uploaded_by || repName,
        size: newDbDoc.size || '',
      };

      clearTmplDraft();
      onDocumentSaved(frontendDoc);
      toast.success(`"${selected.name}" saved to ${getContactFullName(contact)}'s documents`);
      onClose();
    } catch (err: any) {
      console.error('[ContactTemplateModal] Save error:', err);
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('import') || msg.toLowerCase().includes('module') || msg.toLowerCase().includes('load failed')) {
        toast.error('PDF generator failed to load. Please refresh the page and try again.');
      } else {
        toast.error(msg || 'Failed to save document. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchesSearch = !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, activeCategory]);

  const categories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category));
    return ['all', ...Array.from(cats)];
  }, [templates]);

  // Categorized editable fields
  const { docInfoFields, specFields, termsFields } = useMemo(() => {
    if (!selected) return { docInfoFields: [], specFields: [], termsFields: [] };
    const base = buildContactOverrides(contact, companyProfile, profile);
    const autoFilled = new Set(Object.keys(base).filter(k => base[k]));
    const templateKeys = new Set((selected.fields ?? []).map(f => f.key));

    // Fields that need user input (not auto-filled) — but DOC_INFO and TERMS fields
    // are always shown so users can override/edit auto-filled values.
    const allEditable = (selected.fields ?? [])
      .map(f => f.key)
      .filter(k => !autoFilled.has(k));

    // Doc info: always show DOC_INFO fields if present in template (even if auto-filled)
    const docInfoKeys = DOC_INFO_FIELDS.filter(k => templateKeys.has(k));

    // Terms: always show TERMS_CONTENT if present in template (even if auto-filled)
    const termsKeys = TERMS_FIELDS.filter(k => templateKeys.has(k));

    // Spec fields: not auto-filled, not doc-info, not cost, not terms
    const specKeys = allEditable.filter(
      k => !DOC_INFO_FIELDS.includes(k) && !isCostField(k) && !TERMS_FIELDS.includes(k)
    );

    return {
      docInfoFields: docInfoKeys,
      specFields: specKeys,
      termsFields: termsKeys,
    };
  }, [selected, contact, companyProfile, profile]);

  const getFieldMeta = (key: string) => selected?.fields?.find(f => f.key === key);

  const renderFieldInput = (key: string) => {
    const meta = getFieldMeta(key);
    const isTermsContent = key === 'TERMS_CONTENT';
    const label = isTermsContent
      ? 'Terms & Conditions'
      : (meta?.label || key.replace(/_/g, ' '));
    const placeholder = isTermsContent
      ? 'Enter your terms and conditions… (each bullet on a new line)'
      : (meta?.placeholder || `Enter ${label.toLowerCase()}…`);
    const type = meta?.type || 'text';
    const isAutoFilled = !!fieldValues[key];
    return (
      <div key={key}>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {label}
          {isAutoFilled && <span className="ml-1 text-green-600 text-xs">✓</span>}
        </label>
        {(type === 'textarea' || isTermsContent) ? (
          <textarea
            value={fieldValues[key] || ''}
            onChange={e => setFieldValues(prev => ({ ...prev, [key]: e.target.value }))}
            placeholder={placeholder}
            rows={isTermsContent ? 8 : 3}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        ) : (
          <input
            type={type === 'date' ? 'date' : 'text'}
            value={fieldValues[key] || ''}
            onChange={e => setFieldValues(prev => ({ ...prev, [key]: e.target.value }))}
            placeholder={placeholder}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
      </div>
    );
  };

  // ── Template list view ──────────────────────────────────────────────────
  const renderList = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat === 'all' ? 'All Templates' : CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText size={32} className="mx-auto mb-2 opacity-40" />
            <p>No templates match your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredTemplates.map(t => (
              <button
                key={t.id}
                onClick={() => handleSelect(t)}
                className="text-left p-4 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText size={18} className="text-blue-700" />
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[t.category] || 'bg-gray-100 text-gray-700'}`}>
                    {CATEGORY_LABELS[t.category] || t.category}
                  </span>
                </div>
                <p className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-blue-700">{t.name}</p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</p>
                {t.templateType === 'customer-service-agreement' && (
                  <span className="inline-flex items-center gap-1 mt-2 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                    <Calculator size={10} /> Fillable cost breakdown
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Document editor view ────────────────────────────────────────────────
  const renderEditor = () => (
    <div className="flex h-full min-h-0">
      {/* LEFT: Form panel */}
      <div className="w-[420px] flex-shrink-0 border-r border-gray-200 overflow-y-auto bg-gray-50">
        <div className="p-4 space-y-5">
          {/* Back + title */}
          <div>
            <button onClick={handleBack} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 mb-3">
              <ChevronLeft size={14} /> Back to templates
            </button>
            <h3 className="font-bold text-gray-900 text-sm leading-snug">{selected!.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Filling in for <strong>{getContactFullName(contact)}</strong> — customer & company info is auto-filled.</p>
          </div>

          {/* Document Info */}
          {docInfoFields.length > 0 && (
            <section>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Document Info</p>
              <div className="space-y-2 bg-white rounded-xl border border-gray-200 p-3">
                {docInfoFields.map(renderFieldInput)}
              </div>
            </section>
          )}

          {/* Project Specs */}
          {specFields.length > 0 && (
            <section>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Project Specs</p>
              <div className="space-y-2 bg-white rounded-xl border border-gray-200 p-3">
                {specFields.map(renderFieldInput)}
              </div>
            </section>
          )}

          {/* Roofr structure panel — multi-structure */}
          {isAgreement && roofrData && roofrData.structures && roofrData.structures.length > 1 && (
            <section className="mb-3">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1.5">Roofr Structures</p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={selectedRoofrStructureIdx}
                    onChange={e => setSelectedRoofrStructureIdx(Number(e.target.value))}
                    className="flex-1 text-sm border border-blue-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value={0}>All Combined ({roofrData.measurements.totalSquares.toFixed(1)} sq)</option>
                    {roofrData.structures.map((s, i) => (
                      <option key={i} value={i + 1}>{s.structureName} ({s.measurements.totalSquares.toFixed(1)} sq)</option>
                    ))}
                  </select>
                </div>
                {/* Add second structure as separate priced section */}
                {selectedRoofrStructureIdx > 0 && (() => {
                  const otherStructures = roofrData.structures!.filter((_, i) => i !== selectedRoofrStructureIdx - 1);
                  const alreadyAdded = lineItems.some(li => li.structureGroup !== undefined);
                  return otherStructures.length > 0 && (
                    <div className="border-t border-blue-200 pt-2">
                      {alreadyAdded ? (
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-blue-700">Both structures included — priced separately.</p>
                          <button
                            onClick={() => {
                              const primaryName = roofrData.structures![selectedRoofrStructureIdx - 1].structureName;
                              // Keep only primary structure items, strip group labels
                              setLineItems(prev =>
                                prev
                                  .filter(li => li.structureGroup === undefined || li.structureGroup === primaryName)
                                  .map(li => ({ ...li, structureGroup: undefined }))
                              );
                            }}
                            className="text-xs text-red-500 hover:text-red-700 underline ml-2"
                          >Remove second structure</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            const primaryName = roofrData.structures![selectedRoofrStructureIdx - 1].structureName;
                            // Label current items as primary structure
                            const primaryItems = lineItems.map(li => ({ ...li, structureGroup: primaryName }));
                            // Build line items for each additional structure
                            const extraItems: LineItem[] = [];
                            for (const s of otherStructures) {
                              const template = lineItems.map(li => ({ ...li, id: crypto.randomUUID(), structureGroup: s.structureName }));
                              extraItems.push(...applyRoofrToLineItems(template, s.measurements));
                            }
                            setLineItems([...primaryItems, ...extraItems]);
                          }}
                          className="flex items-center gap-1.5 text-xs bg-blue-600 text-white rounded px-2.5 py-1.5 hover:bg-blue-700 transition-colors font-medium"
                        >
                          <Plus size={12} /> Add {otherStructures.map(s => s.structureName).join(' + ')} as separate section
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </section>
          )}

          {/* Roofr banner — single structure */}
          {isAgreement && roofrData && (!roofrData.structures || roofrData.structures.length <= 1) && (
            <section className="mb-3">
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-green-600 text-sm">✓</span>
                <p className="text-xs text-green-700">Line item quantities auto-filled from Roofr report ({roofrData.measurements.totalSquares.toFixed(1)} sq). Edit any value as needed.</p>
              </div>
            </section>
          )}

          {/* Cost Breakdown — only for customer-service-agreement */}
          {isAgreement && (
            <section>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Cost Breakdown</p>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_70px_75px_75px_28px] gap-1 px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-500">Description</span>
                  <span className="text-xs font-semibold text-gray-500">Qty</span>
                  <span className="text-xs font-semibold text-gray-500">Unit Price</span>
                  <span className="text-xs font-semibold text-gray-500 text-right">Total</span>
                  <span />
                </div>

                {/* Line item rows */}
                <div className="divide-y divide-gray-100">
                  {(() => {
                    let lastGroup: string | undefined = undefined;
                    return lineItems.map((item) => {
                    const isLot = isLotItem(item);
                    const computedTotal = calcItemTotal(item);
                    const showGroupHeader = item.structureGroup !== undefined && item.structureGroup !== lastGroup;
                    if (showGroupHeader) lastGroup = item.structureGroup;
                    return (
                      <React.Fragment key={item.id}>
                        {showGroupHeader && (
                          <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{item.structureGroup}</span>
                          </div>
                        )}
                      <div className="grid grid-cols-[1fr_70px_75px_75px_28px] gap-1 px-3 py-2 items-start hover:bg-gray-50">
                        {/* Description */}
                        <div className="space-y-1">
                          <input
                            value={item.description}
                            onChange={e => updateLineItem(item.id, 'description', e.target.value)}
                            placeholder="Description…"
                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <div className="flex gap-1">
                            <input
                              value={item.unit}
                              onChange={e => updateLineItem(item.id, 'unit', e.target.value)}
                              placeholder="sq / LF / Lot"
                              className="w-full px-2 py-0.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-500"
                            />
                          </div>
                        </div>

                        {/* Qty */}
                        <input
                          value={item.qty}
                          onChange={e => updateLineItem(item.id, 'qty', e.target.value)}
                          placeholder="—"
                          className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                        />

                        {/* Unit Price */}
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                          <input
                            value={item.unitPrice}
                            onChange={e => updateLineItem(item.id, 'unitPrice', e.target.value)}
                            placeholder={isLot ? '—' : '0.00'}
                            disabled={isLot}
                            className="w-full pl-4 pr-1 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right disabled:bg-gray-50 disabled:text-gray-400"
                          />
                        </div>

                        {/* Total */}
                        <div className="relative">
                          {isLot ? (
                            <>
                              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                              <input
                                value={item.total}
                                onChange={e => updateLineItem(item.id, 'total', e.target.value)}
                                placeholder="0.00"
                                className="w-full pl-4 pr-1 py-1 text-xs border border-blue-300 rounded bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-500 text-right font-medium"
                              />
                            </>
                          ) : (
                            <div className="px-2 py-1 text-xs text-right font-semibold text-gray-800 bg-green-50 border border-green-200 rounded min-h-[26px] flex items-center justify-end">
                              {computedTotal > 0 ? `$${fmt(computedTotal)}` : '—'}
                            </div>
                          )}
                        </div>

                        {/* Delete */}
                        <button
                          onClick={() => removeLineItem(item.id)}
                          className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors mt-0.5"
                          title="Remove line"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      </React.Fragment>
                    );
                  });
                  })()}
                </div>

                {/* Add line button */}
                <div className="px-3 py-2 border-t border-gray-100">
                  <button
                    onClick={addLineItem}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Plus size={13} /> Add Line Item
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Totals — only for customer-service-agreement */}
          {isAgreement && (
            <section>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Totals</p>
              <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">${fmt(subtotal)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 flex-shrink-0">Tax Rate</span>
                  <div className="flex items-center gap-1 ml-auto">
                    <input
                      type="text"
                      value={taxRate}
                      onChange={e => setTaxRate(e.target.value)}
                      className="w-16 px-2 py-1 text-sm text-right border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Tax Amount</span>
                  <span>${fmt(taxAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-bold border-t border-gray-200 pt-2">
                  <span>Total</span>
                  <span className="text-blue-700 text-base">${fmt(totalAmount)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 flex-shrink-0">Deposit</span>
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-sm text-gray-400">$</span>
                    <input
                      type="text"
                      value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-24 px-2 py-1 text-sm text-right border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-1">
                  <span className="text-gray-600">Balance Due</span>
                  <span className="font-semibold">{depositAmount ? `$${fmt(balanceDue)}` : '—'}</span>
                </div>
              </div>
            </section>
          )}

          {/* Terms */}
          {termsFields.length > 0 && (
            <section>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Terms</p>
              <div className="space-y-2 bg-white rounded-xl border border-gray-200 p-3">
                {termsFields.map(renderFieldInput)}
              </div>
            </section>
          )}

          {/* Legal doc fields (non-agreement) */}
          {!isAgreement && (
            <section>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Fill In Values</p>
              <div className="space-y-2 bg-white rounded-xl border border-gray-200 p-3">
                {[...docInfoFields, ...specFields, ...termsFields].map(renderFieldInput)}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* RIGHT: Preview */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-100">
        <div className="px-4 py-2 border-b border-gray-200 bg-white flex items-center justify-between">
          <p className="text-xs font-medium text-gray-500">Live Preview</p>
          {isAgreement && (
            <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
              Total: ${fmt(totalAmount)}
            </span>
          )}
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
            <iframe
              srcDoc={previewContent}
              className="w-full border-0"
              style={{ minHeight: '800px', height: '100%' }}
              title="Document Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-7xl" style={{ height: '92vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            {selected && (
              <button onClick={handleBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
                <ChevronLeft size={16} /> Back
              </button>
            )}
            {selected && <span className="text-gray-300">|</span>}
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                {selected ? selected.name : 'Use Document Template'}
              </h2>
              {selected && (
                <p className="text-xs text-gray-400 mt-0">— {getContactFullName(contact)}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Close">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {selected ? renderEditor() : renderList()}
        </div>

        {/* Footer (editor only) */}
        {selected && (
          <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between gap-3 flex-shrink-0 bg-gray-50">
            {isAgreement ? (
              <p className="text-xs text-gray-500">
                <strong>{lineItems.length}</strong> line item{lineItems.length !== 1 ? 's' : ''} · Total: <strong className="text-blue-700">${fmt(totalAmount)}</strong>
              </p>
            ) : (
              <p className="text-xs text-gray-500">Fill in all fields before saving.</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <><Loader2 size={15} className="animate-spin" /> Saving…</>
                ) : (
                  <><Save size={15} /> Save to {getContactFullName(contact)}</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

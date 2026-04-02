// ContactTemplateModal — Redesigned with proper cost breakdown editor
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, FileText, ChevronLeft, Search, DollarSign, Save, Loader2, Plus, Trash2, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/authContext';
import { db, DbCompany } from '@/lib/database';
import { uploadDocument } from '@/lib/storage';
import {
  DocumentTemplate,
  LineItemDefault,
  getContractorEstimateTemplates,
  buildContactOverrides,
  fillTemplateVars,
  getUnfilledVars,
} from '@/lib/contractorTemplates';
import { Contact, Document, getContactFullName } from '@/lib/crmData';

interface Props {
  contact: Contact;
  onClose: () => void;
  onDocumentSaved: (doc: Document) => void;
}

interface LineItem {
  id: string;
  description: string;
  qty: string;
  unit: string;
  unitPrice: string;
  total: string; // manual override total (used when qty is empty/Lot)
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

export default function ContactTemplateModal({ contact, onClose, onDocumentSaved }: Props) {
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
  const initCompanyProfileRef = useRef<DbCompany | null>(null);
  const initProfileRef = useRef(profile);

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
      if (lineDefaults && lineDefaults.length > 0) {
        setLineItems(lineDefaults.map(fromDefault));
      } else {
        setLineItems([{ id: crypto.randomUUID(), description: '', qty: '', unit: '', unitPrice: '', total: '' }]);
      }
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

    setFieldValues(defaults);
  }, [selected?.id, contact.id]);

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
    // Convert TERMS_CONTENT plain-text newlines → HTML <br> for the document
    if (merged.TERMS_CONTENT) {
      merged.TERMS_CONTENT = merged.TERMS_CONTENT.replace(/\n/g, '<br>');
    }
    let html = fillTemplateVars(selected.content, merged);

    if (isAgreement) {
      // Inject dynamic line item rows into the Cost Breakdown tbody
      const rowsHtml = lineItems.map(item => {
        const computedTotal = calcItemTotal(item);
        const isLot = item.qty.trim() === '' || item.unit.toLowerCase() === 'lot';
        const qtyDisplay = isLot ? 'Lot' : `${item.qty}${item.unit ? ' ' + item.unit : ''}`;
        const priceDisplay = (!isLot && parseNum(item.unitPrice) > 0) ? `$${fmt(parseNum(item.unitPrice))}` : '—';
        return `<tr><td>${escHtml(item.description || '—')}</td><td>${escHtml(qtyDisplay)}</td><td>${priceDisplay}</td><td>$${fmt(computedTotal)}</td></tr>`;
      }).join('\n      ');
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
        const isLot = updated.qty.trim() === '' || updated.unit.toLowerCase() === 'lot';
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
    // Convert TERMS_CONTENT plain-text newlines → HTML <br>
    if (merged.TERMS_CONTENT) {
      merged.TERMS_CONTENT = merged.TERMS_CONTENT.replace(/\n/g, '<br>');
    }
    const finalHtml = (() => {
      let html = fillTemplateVars(selected.content, merged);
      if (isAgreement) {
        const rowsHtml = lineItems.map(item => {
          const computedTotal = calcItemTotal(item);
          const isLot = item.qty.trim() === '' || item.unit.toLowerCase() === 'lot';
          const qtyDisplay = isLot ? 'Lot' : `${item.qty}${item.unit ? ' ' + item.unit : ''}`;
          const priceDisplay = (!isLot && parseNum(item.unitPrice) > 0) ? `$${fmt(parseNum(item.unitPrice))}` : '—';
          return `<tr><td>${escHtml(item.description || '—')}</td><td>${escHtml(qtyDisplay)}</td><td>${priceDisplay}</td><td>$${fmt(computedTotal)}</td></tr>`;
        }).join('\n');
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
      const blob = new Blob([finalHtml], { type: 'text/html' });
      const contactName = getContactFullName(contact).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `${selected.name.replace(/\s+/g, '_')}_${contactName}_${timestamp}.html`;
      const file = new File([blob], fileName, { type: 'text/html' });

      const uploadResult = await uploadDocument(file, profile.company_id, contact.id);
      if (uploadResult.error || !uploadResult.path) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      const repName = profile
        ? `${(profile as any).first_name || ''} ${(profile as any).last_name || ''}`.trim()
        : 'Unknown';

      const newDbDoc = await db.createDocument({
        company_id: profile.company_id,
        contact_id: contact.id,
        name: `${selected.name} — ${getContactFullName(contact)}`,
        type: selected.category === 'estimate' ? 'estimate' : 'other',
        url: uploadResult.path,
        size: `${Math.round(blob.size / 1024)} KB`,
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

      onDocumentSaved(frontendDoc);
      toast.success(`"${selected.name}" saved to ${getContactFullName(contact)}'s documents`);
      onClose();
    } catch (err: any) {
      console.error('[ContactTemplateModal] Save error:', err);
      toast.error(err?.message || 'Failed to save document. Please try again.');
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
                  {lineItems.map((item) => {
                    const isLot = item.qty.trim() === '' || item.unit.toLowerCase() === 'lot';
                    const computedTotal = calcItemTotal(item);
                    return (
                      <div key={item.id} className="grid grid-cols-[1fr_70px_75px_75px_28px] gap-1 px-3 py-2 items-start hover:bg-gray-50">
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
                    );
                  })}
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

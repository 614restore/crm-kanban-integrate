// ContactTemplateModal — Template editor with live line-item pricing + auto-calc
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, FileText, ChevronLeft, Search, DollarSign, Save, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/authContext';
import { db, DbCompany } from '@/lib/database';
import { uploadDocument } from '@/lib/storage';
import {
  DocumentTemplate,
  DocumentField,
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

// ─── Pricing helpers ──────────────────────────────────────────────────────────

function parsePrice(str: string): number {
  if (!str) return 0;
  const n = parseFloat(str.replace(/[$,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

function formatPrice(num: number): string {
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Line item detection ──────────────────────────────────────────────────────

const QTY_SUFFIXES = ['_SQ', '_LF', '_SHEETS', '_COUNT', '_QTY', '_SF', '_EA'];
// When a rate field has no matching qty prefix, fall back to these common area fields
const QTY_FALLBACKS = ['ROOF_SQUARES', 'PANEL_SQ', 'TOTAL_SQ', 'AREA_SQ'];

const TOTALS_KEYS = new Set([
  'SUBTOTAL', 'TAX_RATE', 'TAX_AMOUNT', 'TOTAL_AMOUNT', 'DEPOSIT_AMOUNT', 'BALANCE_DUE',
]);
const TERMS_KEYS = new Set(['WARRANTY_PERIOD', 'PAYMENT_TERMS']);
// Fields always auto-filled from contact/company — never show in sidebar
const CONTACT_AUTO_KEYS = new Set([
  'CUSTOMER_NAME', 'CLIENT_NAME', 'CUSTOMER_PHONE', 'CUSTOMER_EMAIL',
  'PROPERTY_ADDRESS', 'PROPERTY_CITY', 'PROPERTY_STATE', 'PROPERTY_ZIP',
  'PROJECT_ADDRESS', 'COMPANY_NAME', 'COMPANY_TAGLINE', 'COMPANY_ADDRESS',
  'COMPANY_CITY', 'COMPANY_STATE', 'COMPANY_ZIP', 'COMPANY_PHONE', 'COMPANY_EMAIL',
  'CONTRACTOR_LICENSE', 'COMPANY_LOGO', 'REP_NAME', 'ESTIMATE_DATE', 'CURRENT_DATE',
  'ESTIMATE_EXPIRY', 'INSURANCE_COMPANY', 'POLICY_NUMBER', 'CLAIM_NUMBER',
]);

interface LineItemGroup {
  prefix: string;
  label: string;
  rateKey: string;
  totalKey: string;
  qtyKey: string | null;
  isStandalone: boolean; // FLASHING_TOTAL etc. — no matching rate
}

function detectLineItemGroups(fields: DocumentField[]): LineItemGroup[] {
  const fieldMap = new Map(fields.map(f => [f.key, f]));
  const groups: LineItemGroup[] = [];
  const handledTotals = new Set<string>();

  // Pass 1: rate → qty + total pairs
  for (const field of fields) {
    if (!field.key.endsWith('_RATE')) continue;
    const prefix = field.key.slice(0, -5); // remove _RATE
    const totalKey = `${prefix}_TOTAL`;
    if (!fieldMap.has(totalKey)) continue;

    handledTotals.add(totalKey);

    let qtyKey: string | null = null;
    // Try prefix-matched qty fields first
    for (const suffix of QTY_SUFFIXES) {
      if (fieldMap.has(`${prefix}${suffix}`)) {
        qtyKey = `${prefix}${suffix}`;
        break;
      }
    }
    // Fall back to common area fields
    if (!qtyKey) {
      for (const fb of QTY_FALLBACKS) {
        if (fieldMap.has(fb)) { qtyKey = fb; break; }
      }
    }

    const label = field.label
      .replace(/\s+Rate\s*(\(.*\))?\s*$/i, '')
      .trim() || prefix.replace(/_/g, ' ');

    groups.push({ prefix, label, rateKey: field.key, totalKey, qtyKey, isStandalone: false });
  }

  // Pass 2: standalone totals (no matching rate)
  for (const field of fields) {
    if (!field.key.endsWith('_TOTAL')) continue;
    if (TOTALS_KEYS.has(field.key)) continue;
    if (handledTotals.has(field.key)) continue;
    const label = field.label.replace(/\s+Total\s*$/i, '').trim();
    groups.push({
      prefix: field.key.slice(0, -6),
      label,
      rateKey: '',
      totalKey: field.key,
      qtyKey: null,
      isStandalone: true,
    });
  }

  return groups;
}

// ─── Category / color maps ────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  estimate: 'Estimates', invoice: 'Invoices', contract: 'Contracts',
  'work-order': 'Work Orders', proposal: 'Proposals', 'change-order': 'Change Orders',
  safety: 'Safety', other: 'Other',
};

const CATEGORY_COLORS: Record<string, string> = {
  estimate: 'bg-green-100 text-green-800', invoice: 'bg-blue-100 text-blue-800',
  contract: 'bg-purple-100 text-purple-800', 'work-order': 'bg-orange-100 text-orange-800',
  proposal: 'bg-indigo-100 text-indigo-800', 'change-order': 'bg-yellow-100 text-yellow-800',
  safety: 'bg-red-100 text-red-800', other: 'bg-gray-100 text-gray-800',
};

type LineVisibility = 'full' | 'totals-hidden' | 'total-only';

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContactTemplateModal({ contact, onClose, onDocumentSaved }: Props) {
  const { profile } = useAuth();
  const [companyProfile, setCompanyProfile] = useState<DbCompany | null>(null);
  const [templates] = useState<DocumentTemplate[]>(getContractorEstimateTemplates());
  const [selected, setSelected] = useState<DocumentTemplate | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [lineVisibility, setLineVisibility] = useState<LineVisibility>('full');
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    if (!profile?.company_id) return;
    db.getCompany(profile.company_id)
      .then(c => { if (c) setCompanyProfile(c); })
      .catch(() => {});
  }, [profile?.company_id]);

  // Detect line item groups for current template
  const lineItemGroups = useMemo(() =>
    selected?.fields ? detectLineItemGroups(selected.fields) : [],
    [selected]
  );

  // Set of keys that are part of the line item / totals sections
  const pricingKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const g of lineItemGroups) {
      if (g.qtyKey) keys.add(g.qtyKey);
      if (g.rateKey) keys.add(g.rateKey);
      keys.add(g.totalKey);
    }
    TOTALS_KEYS.forEach(k => keys.add(k));
    TERMS_KEYS.forEach(k => keys.add(k));
    return keys;
  }, [lineItemGroups]);

  // Auto-recalculate totals whenever a qty, rate, or tax field changes
  const recalcTotals = useCallback((
    next: Record<string, string>,
    groups: LineItemGroup[],
  ): Record<string, string> => {
    const result = { ...next };

    // Recalc each group's total
    for (const g of groups) {
      if (g.isStandalone) continue;
      const qty = g.qtyKey ? parsePrice(result[g.qtyKey] || '') : 0;
      const rate = parsePrice(result[g.rateKey] || '');
      if (qty > 0 && rate > 0) {
        result[g.totalKey] = formatPrice(qty * rate);
      }
    }

    // Recalc subtotal
    const subtotal = groups.reduce((sum, g) => sum + parsePrice(result[g.totalKey] || ''), 0);
    result['SUBTOTAL'] = formatPrice(subtotal);

    // Recalc tax + grand total
    const taxRate = parseFloat(result['TAX_RATE'] || '0') || 0;
    const taxAmount = subtotal * taxRate / 100;
    result['TAX_AMOUNT'] = formatPrice(taxAmount);
    const total = subtotal + taxAmount;
    result['TOTAL_AMOUNT'] = formatPrice(total);
    result['DEPOSIT_AMOUNT'] = formatPrice(total / 2);
    result['BALANCE_DUE'] = formatPrice(total / 2);

    return result;
  }, []);

  const handleFieldChange = useCallback((key: string, value: string) => {
    setFieldValues(prev => {
      const next = { ...prev, [key]: value };
      return recalcTotals(next, lineItemGroups);
    });
  }, [lineItemGroups, recalcTotals]);

  // When selecting a template, pre-populate with defaults so users see/edit values
  const handleSelect = (t: DocumentTemplate) => {
    setSelected(t);
    setLineVisibility('full');

    const autoFilled = buildContactOverrides(contact, companyProfile, profile);
    const templateDefaults: Record<string, string> = {};
    (t.fields || []).forEach(f => {
      if (f.defaultValue) templateDefaults[f.key] = f.defaultValue;
    });
    const merged = { ...autoFilled, ...templateDefaults };

    // Run initial auto-calc pass
    const groups = t.fields ? detectLineItemGroups(t.fields) : [];
    setFieldValues(recalcTotals(merged, groups));
  };

  const handleBack = () => {
    setSelected(null);
    setFieldValues({});
  };

  // Live preview — apply visibility overrides
  const previewContent = useMemo(() => {
    if (!selected) return '';
    const base = buildContactOverrides(contact, companyProfile, profile);
    const merged = { ...base, ...fieldValues };

    // Apply line item visibility overrides
    if (lineVisibility !== 'full' && lineItemGroups.length > 0) {
      lineItemGroups.forEach(g => { merged[g.totalKey] = '—'; });
      if (lineVisibility === 'total-only') {
        merged['SUBTOTAL'] = '—';
        merged['TAX_AMOUNT'] = '—';
      }
    }

    return fillTemplateVars(selected.content, merged);
  }, [selected, companyProfile, profile, fieldValues, contact, lineVisibility, lineItemGroups]);

  // Save
  const handleSave = async () => {
    if (!selected || !profile?.company_id) {
      toast.error('Unable to save — missing company context.');
      return;
    }

    const base = buildContactOverrides(contact, companyProfile, profile);
    const merged = { ...base, ...fieldValues };
    const finalHtml = fillTemplateVars(selected.content, merged);
    const stillUnfilled = getUnfilledVars(finalHtml);

    if (stillUnfilled.length > 0) {
      toast.error(`Please fill in: ${stillUnfilled.slice(0, 3).join(', ')}${stillUnfilled.length > 3 ? '…' : ''}`);
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
      if (uploadResult.error || !uploadResult.path) throw new Error(uploadResult.error || 'Upload failed');

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
        uploaded_by: repName,
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

  // ── Filtered template list ──
  const filteredTemplates = useMemo(() =>
    templates.filter(t => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q));
      return matchesSearch && (activeCategory === 'all' || t.category === activeCategory);
    }),
    [templates, searchQuery, activeCategory]
  );

  const categories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category));
    return ['all', ...Array.from(cats)];
  }, [templates]);

  // ── Template list view ──
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
                activeCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                  <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <DollarSign size={18} className="text-green-700" />
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[t.category] || 'bg-gray-100 text-gray-700'}`}>
                    {CATEGORY_LABELS[t.category] || t.category}
                  </span>
                </div>
                <p className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-blue-700">{t.name}</p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {t.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Document editor view ──
  const isCSA = selected?.templateType === 'customer-service-agreement';

  // Fields for the General Info / Project Specs section (non-pricing, non-contact-auto)
  const infoFields = useMemo(() => {
    if (!selected?.fields) return [];
    return selected.fields.filter(f =>
      !CONTACT_AUTO_KEYS.has(f.key) &&
      !pricingKeys.has(f.key)
    );
  }, [selected, pricingKeys]);

  const renderInput = (field: DocumentField) => {
    const val = fieldValues[field.key] ?? '';
    const common = "w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";
    if (field.type === 'textarea') {
      return (
        <textarea
          rows={3}
          className={common}
          value={val}
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}…`}
          onChange={e => handleFieldChange(field.key, e.target.value)}
        />
      );
    }
    return (
      <input
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        className={common}
        value={val}
        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}…`}
        onChange={e => handleFieldChange(field.key, e.target.value)}
      />
    );
  };

  const renderCSAEditor = () => (
    <div className="space-y-5 p-4">
      {/* Info / Project Specs */}
      {infoFields.length > 0 && (
        <section>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Project Info</h4>
          <div className="space-y-2">
            {infoFields.map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">{f.label}</label>
                {renderInput(f)}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Line Items */}
      {lineItemGroups.length > 0 && (
        <section>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Line Items</h4>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_80px_90px_90px] gap-1 px-2 py-1.5 bg-gray-100 text-xs font-semibold text-gray-600">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Rate</span>
              <span className="text-right">Total</span>
            </div>

            {/* Rows */}
            {lineItemGroups.map((g, i) => (
              <div
                key={g.prefix}
                className={`grid grid-cols-[1fr_80px_90px_90px] gap-1 px-2 py-1.5 items-center ${
                  i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <span className="text-xs text-gray-800 font-medium truncate">{g.label}</span>

                {/* Qty */}
                {g.isStandalone ? (
                  <span className="text-xs text-gray-400 text-right">—</span>
                ) : g.qtyKey ? (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full px-1.5 py-1 text-xs text-right border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={fieldValues[g.qtyKey] ?? ''}
                    placeholder="0"
                    onChange={e => handleFieldChange(g.qtyKey!, e.target.value)}
                  />
                ) : (
                  <span className="text-xs text-gray-400 text-right">—</span>
                )}

                {/* Rate */}
                {g.isStandalone ? (
                  <span className="text-xs text-gray-400 text-right">—</span>
                ) : (
                  <input
                    type="text"
                    className="w-full px-1.5 py-1 text-xs text-right border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={fieldValues[g.rateKey] ?? ''}
                    placeholder="$0.00"
                    onChange={e => handleFieldChange(g.rateKey, e.target.value)}
                  />
                )}

                {/* Total — editable for standalone, auto-calc (read-only) for others */}
                {g.isStandalone ? (
                  <input
                    type="text"
                    className="w-full px-1.5 py-1 text-xs text-right border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                    value={fieldValues[g.totalKey] ?? ''}
                    placeholder="$0.00"
                    onChange={e => handleFieldChange(g.totalKey, e.target.value)}
                  />
                ) : (
                  <span className="text-xs font-semibold text-gray-900 text-right font-mono">
                    {fieldValues[g.totalKey] || '—'}
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">Totals auto-calculate from Qty × Rate.</p>
        </section>
      )}

      {/* Totals */}
      <section>
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Totals</h4>
        <div className="space-y-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
          {/* Subtotal — read-only */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Subtotal</span>
            <span className="text-sm font-semibold text-gray-900 font-mono">{fieldValues['SUBTOTAL'] || '—'}</span>
          </div>

          {/* Tax rate — editable */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-600 flex-shrink-0">Tax Rate (%)</span>
            <input
              type="number"
              min="0"
              step="0.1"
              className="w-20 px-2 py-1 text-xs text-right border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={fieldValues['TAX_RATE'] ?? ''}
              placeholder="0"
              onChange={e => handleFieldChange('TAX_RATE', e.target.value)}
            />
          </div>

          {/* Tax amount — read-only */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Tax Amount</span>
            <span className="text-sm font-medium text-gray-700 font-mono">{fieldValues['TAX_AMOUNT'] || '—'}</span>
          </div>

          {/* Total — read-only */}
          <div className="flex items-center justify-between border-t border-gray-300 pt-2 mt-1">
            <span className="text-sm font-bold text-gray-900">Total</span>
            <span className="text-base font-bold text-blue-700 font-mono">{fieldValues['TOTAL_AMOUNT'] || '—'}</span>
          </div>

          {/* Deposit — editable */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-600 flex-shrink-0">Deposit Required</span>
            <input
              type="text"
              className="w-28 px-2 py-1 text-xs text-right border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={fieldValues['DEPOSIT_AMOUNT'] ?? ''}
              placeholder="$0.00"
              onChange={e => handleFieldChange('DEPOSIT_AMOUNT', e.target.value)}
            />
          </div>

          {/* Balance due — editable */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-600 flex-shrink-0">Balance Due</span>
            <input
              type="text"
              className="w-28 px-2 py-1 text-xs text-right border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={fieldValues['BALANCE_DUE'] ?? ''}
              placeholder="$0.00"
              onChange={e => handleFieldChange('BALANCE_DUE', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Display options */}
      <section>
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          <Eye size={12} className="inline mr-1" />
          Line Item Visibility
        </h4>
        <div className="space-y-1.5">
          {[
            { value: 'full', label: 'Full breakdown', sub: 'Show all quantities, rates & totals' },
            { value: 'totals-hidden', label: 'Hide line totals', sub: 'Show quantities & rates, hide individual totals' },
            { value: 'total-only', label: 'Grand total only', sub: 'Show only the final total price' },
          ].map(opt => (
            <label key={opt.value} className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
              lineVisibility === opt.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                name="lineVisibility"
                value={opt.value}
                checked={lineVisibility === opt.value}
                onChange={() => setLineVisibility(opt.value as LineVisibility)}
                className="mt-0.5 accent-blue-600"
              />
              <div>
                <div className="text-xs font-medium text-gray-900">{opt.label}</div>
                <div className="text-xs text-gray-500">{opt.sub}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Terms */}
      {selected?.fields?.some(f => TERMS_KEYS.has(f.key)) && (
        <section>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Terms</h4>
          <div className="space-y-2">
            {(selected.fields || []).filter(f => TERMS_KEYS.has(f.key)).map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">{f.label}</label>
                {renderInput(f)}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  // Fallback editor for non-CSA templates (original flat list)
  const renderGenericEditor = () => {
    const autoFilled = buildContactOverrides(contact, companyProfile, profile);
    const autoFilledKeys = new Set(Object.keys(autoFilled).filter(k => autoFilled[k]));
    const fields = (selected?.fields || []).filter(f => !autoFilledKeys.has(f.key));
    return (
      <div className="space-y-3 p-4">
        {fields.length === 0 ? (
          <p className="text-sm text-gray-500">All fields are auto-filled from your contact and company data.</p>
        ) : fields.map(f => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {f.label}
              {fieldValues[f.key] && <span className="ml-1 text-green-600">✓</span>}
            </label>
            {renderInput(f)}
          </div>
        ))}
      </div>
    );
  };

  const renderEditor = () => (
    <div className="flex h-full">
      {/* Left sidebar */}
      <div className="w-96 flex-shrink-0 border-r border-gray-200 overflow-y-auto bg-gray-50">
        <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-4 py-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            <ChevronLeft size={16} />
            Back to templates
          </button>
          <h3 className="font-semibold text-gray-900 text-sm">{selected!.name}</h3>
          <p className="text-xs text-gray-500">For {getContactFullName(contact)}</p>
        </div>

        {isCSA ? renderCSAEditor() : renderGenericEditor()}
      </div>

      {/* Right: Document preview */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <p className="text-xs font-medium text-gray-600">Live Document Preview</p>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-gray-100">
          <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
            <iframe
              srcDoc={previewContent}
              className="w-full h-full min-h-[800px] border-0"
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
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-7xl" style={{ height: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText size={20} className="text-blue-600" />
              Use Document Template
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Select a template — customer and company details will be auto-filled.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {selected ? renderEditor() : renderList()}
        </div>

        {/* Footer */}
        {selected && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between gap-3 flex-shrink-0">
            <p className="text-xs text-gray-500">
              {isCSA
                ? `Total: ${fieldValues['TOTAL_AMOUNT'] || '—'} · Review values above then save.`
                : 'Review the document preview, then save when ready.'}
            </p>
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
                  <><Loader2 size={16} className="animate-spin" /> Saving…</>
                ) : (
                  <><Save size={16} /> Save to {getContactFullName(contact)}</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

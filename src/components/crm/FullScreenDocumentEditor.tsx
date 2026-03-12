// FullScreenDocumentEditor.tsx  v2
// Click-directly-on-the-document-to-type experience.
// Every {{VARIABLE}} renders as a contenteditable inline field.
// Line items (qty × unit price) auto-calculate the line total and grand total.

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Download,
  Printer,
  Send,
  Save,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DbCompany } from '@/lib/database';
import { getContactFullName } from '@/lib/crmData';
import { DOCUMENT_CATEGORIES } from '@/lib/documentCategories';
import { useToast } from '@/hooks/use-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DocumentField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number';
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}

interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  variables: string[];
  fields?: DocumentField[];
  favorite: boolean;
  isDefault: boolean;
  tags: string[];
  createdAt: string;
  lastModified: string;
  usageCount: number;
  fileType: 'pdf' | 'docx' | 'html';
}

export interface FullScreenDocumentEditorProps {
  template: DocumentTemplate;
  onBack: () => void;
  companyProfile: DbCompany | null;
  contacts: any[];
  initialContactId?: string;
  initialContent?: string;
}

interface LineItem {
  id: string;
  description: string;
  qty: string;
  unit: string;
  unitPrice: string;
  total: string; // auto-calculated
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seedFromCompany(company: DbCompany | null): Record<string, string> {
  if (!company) return {};
  const c = company as any;
  return {
    COMPANY_NAME: c.name ?? '',
    COMPANY_TAGLINE: c.tagline ?? '',
    COMPANY_ADDRESS: c.address ?? '',
    COMPANY_CITY: c.city ?? '',
    COMPANY_STATE: c.state ?? '',
    COMPANY_ZIP: c.zip ?? '',
    COMPANY_PHONE: c.phone ?? '',
    COMPANY_EMAIL: c.email ?? '',
    CONTRACTOR_LICENSE: c.contractor_license ?? '',
    COMPANY_LOGO: c.logo_url ?? '',
  };
}

function seedFromContact(contact: any): Record<string, string> {
  if (!contact) return {};
  const fullName = getContactFullName(contact);
  return {
    CUSTOMER_NAME: fullName,
    CLIENT_NAME: fullName,
    CUSTOMER_PHONE: contact.phone1 ?? contact.phone ?? '',
    CUSTOMER_EMAIL: contact.email ?? '',
    PROPERTY_ADDRESS: contact.address ?? '',
    PROPERTY_CITY: contact.city ?? '',
    PROPERTY_STATE: contact.state ?? '',
    PROPERTY_ZIP: contact.zip ?? '',
    JOB_SITE_ADDRESS: contact.address ?? '',
    JOB_SITE_CITY: contact.city ?? '',
    JOB_SITE_STATE: contact.state ?? '',
    JOB_SITE_ZIP: contact.zip ?? '',
    INSURANCE_COMPANY: contact.insurance_company ?? '',
    POLICY_NUMBER: contact.policy_number ?? '',
    CLAIM_NUMBER: contact.claim_number ?? '',
  };
}

function calcLineTotal(qty: string, unitPrice: string): string {
  const q = parseFloat(qty) || 0;
  const p = parseFloat(unitPrice.replace(/[^0-9.]/g, '')) || 0;
  if (q === 0 || p === 0) return '';
  return '$' + (q * p).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcSubtotal(items: LineItem[]): string {
  const sum = items.reduce((acc, item) => {
    const val = parseFloat(item.total.replace(/[^0-9.]/g, '')) || 0;
    return acc + val;
  }, 0);
  if (sum === 0) return '';
  return '$' + sum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function newLineItem(): LineItem {
  return { id: crypto.randomUUID(), description: '', qty: '', unit: '', unitPrice: '', total: '' };
}

const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

// ─── Inline editable field ────────────────────────────────────────────────────
// Renders as plain underlined text when not focused; input when focused.

interface InlineFieldProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  numeric?: boolean;
  printMode?: boolean;
}

const InlineField: React.FC<InlineFieldProps> = ({
  value, onChange, placeholder = 'Click to type…', multiline = false,
  className = '', numeric = false, printMode = false,
}) => {
  const [focused, setFocused] = useState(false);

  const baseClass = [
    'inline-block min-w-[80px] outline-none transition-all duration-150',
    printMode ? '' : 'border-b border-dashed',
    focused
      ? 'border-green-500 bg-green-50 rounded px-1'
      : value
        ? 'border-gray-300 text-gray-900'
        : 'border-gray-300 text-gray-400',
    className,
  ].join(' ');

  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={printMode ? '' : placeholder}
        rows={3}
        className={[
          baseClass,
          'w-full resize-none text-sm leading-relaxed block',
          printMode ? 'border-none bg-transparent' : '',
        ].join(' ')}
      />
    );
  }

  return (
    <input
      type={numeric ? 'number' : 'text'}
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={printMode ? '' : placeholder}
      className={[
        baseClass,
        'text-sm h-auto py-0.5',
        printMode ? 'border-none bg-transparent' : '',
      ].join(' ')}
    />
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const FullScreenDocumentEditor: React.FC<FullScreenDocumentEditorProps> = ({
  template,
  onBack,
  companyProfile,
  contacts,
  initialContactId = '',
}) => {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === initialContactId) ?? null,
    [contacts, initialContactId]
  );

  // Seeded values
  const seed = useMemo(() => ({
    ...seedFromCompany(companyProfile),
    ...seedFromContact(selectedContact),
    ESTIMATE_DATE: today,
    INSPECTION_DATE: today,
    CHANGE_DATE: today,
  }), [companyProfile, selectedContact]);

  // ── Field values ──
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    template.variables.forEach(v => { base[v] = seed[v] ?? ''; });
    return base;
  });

  const set = useCallback((key: string, val: string) => {
    setVals(prev => ({ ...prev, [key]: val }));
  }, []);

  // ── Line items ──
  const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem(), newLineItem(), newLineItem()]);

  const updateLineItem = useCallback((id: string, field: keyof LineItem, value: string) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'qty' || field === 'unitPrice') {
        updated.total = calcLineTotal(
          field === 'qty' ? value : item.qty,
          field === 'unitPrice' ? value : item.unitPrice
        );
      }
      return updated;
    }));
  }, []);

  const addLineItem = () => setLineItems(prev => [...prev, newLineItem()]);
  const removeLineItem = (id: string) => setLineItems(prev => prev.filter(i => i.id !== id));

  // Auto-update subtotal / total in vals whenever line items change
  useEffect(() => {
    const sub = calcSubtotal(lineItems);
    setVals(prev => ({ ...prev, SUBTOTAL: sub, TOTAL_AMOUNT: sub }));
  }, [lineItems]);

  // ── Print / Preview mode ──
  const [printMode, setPrintMode] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!printRef.current) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${template.name}</title><style>body{font-family:Arial,sans-serif;padding:40px;max-width:900px;margin:0 auto;color:#111}input,textarea{border:none;border-bottom:1px solid #ccc;background:transparent;outline:none;font-family:inherit;font-size:inherit;color:inherit;width:100%}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #ddd;text-align:left}th{background:#f5f5f5}</style></head><body>${printRef.current.innerHTML}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name.replace(/\s+/g, '-')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cat = DOCUMENT_CATEGORIES.find(c => c.id === template.category);
  const logoUrl = (companyProfile as any)?.logo_url ?? '';
  const filledCount = template.variables.filter(v => vals[v]?.trim()).length;

  // ── Field shorthand ──
  const F = (key: string, placeholder?: string, opts?: { multiline?: boolean; numeric?: boolean; className?: string }) => (
    <InlineField
      value={vals[key] ?? ''}
      onChange={v => set(key, v)}
      placeholder={placeholder ?? `${key.replace(/_/g, ' ').toLowerCase()}…`}
      multiline={opts?.multiline}
      numeric={opts?.numeric}
      className={opts?.className}
      printMode={printMode}
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-100">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b-2 border-green-600 shadow-sm flex-shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-green-700 hover:text-green-800 font-medium text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Templates
          </button>
          <span className="text-gray-300">|</span>
          <span className="font-semibold text-gray-800 text-sm">{template.name}</span>
          {cat && (
            <Badge className="text-xs" style={{ backgroundColor: cat.color + '22', color: cat.color, border: `1px solid ${cat.color}44` }}>
              {cat.label}
            </Badge>
          )}
          <span className="text-xs text-green-600 font-medium">{filledCount} / {template.variables.length} filled</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"
            onClick={() => setPrintMode(p => !p)}
            className="border-green-300 text-green-700 hover:bg-green-50 gap-1.5"
          >
            {printMode ? <><EyeOff className="w-3.5 h-3.5" /> Edit Mode</> : <><Eye className="w-3.5 h-3.5" /> Preview</>}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}
            className="border-green-300 text-green-700 hover:bg-green-50">
            <Printer className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}
            className="border-green-300 text-green-700 hover:bg-green-50 gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Download
          </Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
            onClick={() => toast({ title: 'Draft saved', description: template.name })}>
            <Save className="w-3.5 h-3.5" />
            Save Draft
          </Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
            onClick={() => toast({ title: 'Coming soon', description: 'Send to customer is coming soon.' })}>
            <Send className="w-3.5 h-3.5" />
            Send to Customer
          </Button>
        </div>
      </div>

      {/* ── Document canvas ── */}
      <div className="flex-1 overflow-auto py-8 px-4">
        <div
          ref={printRef}
          className="bg-white max-w-4xl mx-auto shadow-lg rounded-lg p-12 print:shadow-none print:rounded-none"
          style={{ minHeight: '1100px' }}
        >

          {/* ══ HEADER ══ */}
          <div className="flex justify-between items-start border-b-4 border-green-600 pb-6 mb-8">
            <div className="flex-1">
              <div className="text-3xl font-extrabold text-green-700 mb-1">
                {F('COMPANY_NAME', '614 Restore LLC', { className: 'text-3xl font-extrabold text-green-700 w-64' })}
              </div>
              <div className="text-sm text-gray-500 italic mb-3">
                {F('COMPANY_TAGLINE', 'Professional Contractor Services', { className: 'text-sm w-72' })}
              </div>
              <div className="text-sm text-gray-700 space-y-0.5">
                <div><strong>{F('REP_NAME', 'Your name', { className: 'font-semibold w-48' })}</strong></div>
                <div>{F('COMPANY_ADDRESS', 'Street address', { className: 'w-56' })}, {F('COMPANY_CITY', 'City', { className: 'w-28' })}, {F('COMPANY_STATE', 'ST', { className: 'w-10' })} {F('COMPANY_ZIP', 'ZIP', { className: 'w-16' })}</div>
                <div>Phone: {F('COMPANY_PHONE', '(000) 000-0000', { className: 'w-36' })} | Email: {F('COMPANY_EMAIL', 'email@company.com', { className: 'w-48' })}</div>
                <div>License: {F('CONTRACTOR_LICENSE', 'License number', { className: 'w-40' })}</div>
              </div>
            </div>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-24 h-16 object-contain ml-6" />
            ) : (
              <div className="w-24 h-16 border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 ml-6 rounded">
                Logo
              </div>
            )}
          </div>

          {/* ══ DOCUMENT TITLE ══ */}
          <div className="text-center text-2xl font-bold text-gray-800 mb-8 uppercase tracking-wide">
            {template.name}
          </div>

          {/* ══ CUSTOMER + PROJECT INFO ══ */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Customer */}
            <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-green-600">
              <div className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 border-b border-gray-200 pb-2">Customer Information</div>
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ['Name', 'CUSTOMER_NAME', 'Full name'],
                    ['Phone', 'CUSTOMER_PHONE', '(000) 000-0000'],
                    ['Email', 'CUSTOMER_EMAIL', 'email@example.com'],
                    ['Property', 'PROPERTY_ADDRESS', 'Street address'],
                    ['City/State', 'PROPERTY_CITY', 'City'],
                    ['Insurance', 'INSURANCE_COMPANY', 'Insurance company'],
                    ['Policy #', 'POLICY_NUMBER', 'Policy number'],
                    ['Claim #', 'CLAIM_NUMBER', 'Claim number'],
                    ['Adjuster', 'ADJUSTER_NAME', 'Adjuster name'],
                    ['Adj. Phone', 'ADJUSTER_PHONE', '(000) 000-0000'],
                  ].filter(([, key]) => template.variables.includes(key as string)).map(([label, key, ph]) => (
                    <tr key={key} className="border-b border-gray-100 last:border-0">
                      <td className="py-1.5 pr-3 text-gray-500 font-medium w-28 whitespace-nowrap">{label}:</td>
                      <td className="py-1.5">{F(key as string, ph as string, { className: 'w-full' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Project */}
            <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-green-600">
              <div className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 border-b border-gray-200 pb-2">Project Details</div>
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ['Est. Date', 'ESTIMATE_DATE', 'Date'],
                    ['Estimate #', 'ESTIMATE_NUMBER', 'EST-000000'],
                    ['Project Type', 'PROJECT_TYPE', 'Roof replacement'],
                    ['Storm Date', 'STORM_DATE', 'Date of storm'],
                    ['Damage Type', 'DAMAGE_TYPE', 'Hail / Wind'],
                    ['Start Date', 'REQUESTED_START', 'Requested start'],
                    ['Duration', 'ESTIMATED_DURATION', '1-2 days'],
                    ['Deductible', 'DEDUCTIBLE_AMOUNT', '$0.00'],
                    ['Work Order #', 'WORK_ORDER_NUMBER', 'WO-000000'],
                    ['Priority', 'PRIORITY_LEVEL', 'Normal'],
                    ['Warranty', 'WARRANTY_PERIOD', '10 years'],
                  ].filter(([, key]) => template.variables.includes(key as string)).map(([label, key, ph]) => (
                    <tr key={key} className="border-b border-gray-100 last:border-0">
                      <td className="py-1.5 pr-3 text-gray-500 font-medium w-28 whitespace-nowrap">{label}:</td>
                      <td className="py-1.5">{F(key as string, ph as string, { className: 'w-full' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ══ SCOPE OF WORK ══ */}
          {template.variables.includes('SCOPE_OF_WORK') && (
            <div className="mb-8">
              <div className="text-base font-bold text-gray-800 mb-3 border-b-2 border-green-600 pb-1">Scope of Work</div>
              {F('SCOPE_OF_WORK', 'Describe the full scope of work to be completed…', { multiline: true, className: 'w-full text-sm' })}
            </div>
          )}

          {template.variables.includes('WORK_DESCRIPTION') && (
            <div className="mb-8">
              <div className="text-base font-bold text-gray-800 mb-3 border-b-2 border-green-600 pb-1">Work to be Performed</div>
              {F('WORK_DESCRIPTION', 'Describe the work to be performed…', { multiline: true, className: 'w-full text-sm' })}
            </div>
          )}

          {/* ══ COST BREAKDOWN ══ */}
          <div className="mb-8">
            <div className="text-base font-bold text-gray-800 mb-3 border-b-2 border-green-600 pb-1">Cost Breakdown</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-700 rounded-tl-lg">Description</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-700 w-20">Qty</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-700 w-24">Unit</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-gray-700 w-28">Unit Price</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-gray-700 w-28 rounded-tr-lg">Total</th>
                  {!printMode && <th className="w-8"></th>}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="py-2 px-3">
                      <InlineField
                        value={item.description}
                        onChange={v => updateLineItem(item.id, 'description', v)}
                        placeholder="Item description…"
                        className="w-full"
                        printMode={printMode}
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <InlineField
                        value={item.qty}
                        onChange={v => updateLineItem(item.id, 'qty', v)}
                        placeholder="0"
                        numeric
                        className="w-16 text-center"
                        printMode={printMode}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <InlineField
                        value={item.unit}
                        onChange={v => updateLineItem(item.id, 'unit', v)}
                        placeholder="sq ft"
                        className="w-20"
                        printMode={printMode}
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <InlineField
                        value={item.unitPrice}
                        onChange={v => updateLineItem(item.id, 'unitPrice', v)}
                        placeholder="$0.00"
                        className="w-24 text-right"
                        printMode={printMode}
                      />
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-green-700">
                      {item.total || <span className="text-gray-300 font-normal text-xs">auto</span>}
                    </td>
                    {!printMode && (
                      <td className="py-2 px-1">
                        <button
                          onClick={() => removeLineItem(item.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {!printMode && (
              <button
                onClick={addLineItem}
                className="mt-2 flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 font-medium transition-colors"
              >
                <Plus className="w-4 h-4" /> Add line item
              </button>
            )}

            {/* Totals */}
            <div className="mt-4 flex justify-end">
              <div className="w-72 space-y-2">
                <div className="flex justify-between text-sm border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">{calcSubtotal(lineItems) || '—'}</span>
                </div>
                <div className="flex justify-between text-sm border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Tax ({F('TAX_RATE', '0', { className: 'w-10 text-center' })}%)</span>
                  <span>{F('TAX_AMOUNT', '$0.00', { className: 'w-24 text-right' })}</span>
                </div>
                {template.variables.includes('DEDUCTIBLE_AMOUNT') && (
                  <div className="flex justify-between text-sm border-b border-gray-200 pb-2">
                    <span className="text-gray-600">Insurance Deductible</span>
                    <span className="text-red-500">-{vals['DEDUCTIBLE_AMOUNT'] || '—'}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold bg-green-600 text-white px-4 py-3 rounded-lg">
                  <span>TOTAL</span>
                  <span>{calcSubtotal(lineItems) || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ══ ADDITIONAL FIELDS ══ */}
          {[
            ['REASON_FOR_CHANGE', 'Reason for Change'],
            ['ORIGINAL_SCOPE', 'Original Scope'],
            ['ADDITIONAL_WORK', 'Additional Work Required'],
            ['MATERIALS_LIST', 'Materials Required'],
            ['CREW_ASSIGNMENTS', 'Crew Assignment'],
            ['ADDITIONAL_SAFETY_REQUIREMENTS', 'Additional Safety Requirements'],
          ].filter(([key]) => template.variables.includes(key)).map(([key, label]) => (
            <div key={key} className="mb-6">
              <div className="text-base font-bold text-gray-800 mb-2 border-b-2 border-green-600 pb-1">{label}</div>
              {F(key, `Enter ${label.toLowerCase()}…`, { multiline: true, className: 'w-full text-sm' })}
            </div>
          ))}

          {/* ══ TERMS ══ */}
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg mb-8 text-sm text-gray-700">
            <strong>Terms &amp; Conditions:</strong> This estimate is valid for 30 days. All work completed per agreed specifications.
            Warranty: {F('WARRANTY_PERIOD', '10 years', { className: 'w-24' })}. Payment due upon completion.
          </div>

          {/* ══ SIGNATURES ══ */}
          <div className="grid grid-cols-2 gap-12 mt-10">
            <div>
              <div className="border-b-2 border-gray-400 h-12 mb-2"></div>
              <div className="text-xs text-gray-500 text-center">Customer Signature / Date</div>
            </div>
            <div>
              <div className="border-b-2 border-gray-400 h-12 mb-2"></div>
              <div className="text-xs text-gray-500 text-center">Contractor Signature / Date</div>
            </div>
          </div>

          {/* ══ FOOTER ══ */}
          <div className="mt-10 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
            Thank you for choosing {vals['COMPANY_NAME'] || 'us'} — we're committed to quality workmanship and customer satisfaction.
          </div>

        </div>
      </div>
    </div>
  );
};

export default FullScreenDocumentEditor;

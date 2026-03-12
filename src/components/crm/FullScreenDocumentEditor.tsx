// FullScreenDocumentEditor.tsx  v3
// Click-directly-on-the-document-to-type experience.
// Send to Customer → opens SendDocumentModal → email + sign link sent.

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
import { useAuth } from '@/lib/authContext';
import SendDocumentModal from './SendDocumentModal';

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
  total: string;
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
    return acc + (parseFloat(item.total.replace(/[^0-9.]/g, '')) || 0);
  }, 0);
  if (sum === 0) return '';
  return '$' + sum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function newLineItem(): LineItem {
  return { id: crypto.randomUUID(), description: '', qty: '', unit: '', unitPrice: '', total: '' };
}

const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

// ─── Build print-ready HTML from current state ─────────────────────────────────────────

function buildDocumentHtml(vals: Record<string, string>, lineItems: LineItem[], templateName: string, logoUrl: string): string {
  const subtotal = calcSubtotal(lineItems);
  const lineRows = lineItems
    .filter(i => i.description || i.qty || i.unitPrice)
    .map(i => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${i.description}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${i.qty}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${i.unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${i.unitPrice}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#16a34a">${i.total}</td>
      </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${templateName}</title>
<style>
  body{font-family:Arial,sans-serif;padding:48px;max-width:900px;margin:0 auto;color:#111;line-height:1.5}
  h1{color:#16a34a;margin:0 0 4px}
  table{width:100%;border-collapse:collapse}
  th{background:#f3f4f6;padding:10px 12px;text-align:left;font-size:13px;color:#374151}
  .section-title{font-weight:700;font-size:15px;border-bottom:2px solid #16a34a;padding-bottom:4px;margin:24px 0 12px}
  .info-label{color:#6b7280;font-weight:600;width:140px;padding:5px 8px 5px 0;white-space:nowrap;vertical-align:top}
  .info-value{padding:5px 0;color:#111}
  .total-box{background:#16a34a;color:#fff;padding:16px 24px;border-radius:8px;text-align:right;font-size:20px;font-weight:800;margin-top:16px}
  .sig-line{border-bottom:2px solid #374151;height:48px;margin-bottom:8px}
  .terms{background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 6px 6px 0;font-size:13px;margin:24px 0}
</style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #16a34a;padding-bottom:20px;margin-bottom:24px">
    <div>
      <h1>${vals.COMPANY_NAME || ''}</h1>
      <div style="color:#6b7280;font-style:italic;margin-bottom:8px">${vals.COMPANY_TAGLINE || ''}</div>
      <div style="font-size:14px">${vals.REP_NAME || ''}</div>
      <div style="font-size:14px">${vals.COMPANY_ADDRESS || ''}, ${vals.COMPANY_CITY || ''}, ${vals.COMPANY_STATE || ''} ${vals.COMPANY_ZIP || ''}</div>
      <div style="font-size:14px">Phone: ${vals.COMPANY_PHONE || ''} | Email: ${vals.COMPANY_EMAIL || ''}</div>
      <div style="font-size:14px">License: ${vals.CONTRACTOR_LICENSE || ''}</div>
    </div>
    ${logoUrl ? `<img src="${logoUrl}" style="width:90px;height:60px;object-fit:contain" />` : ''}
  </div>

  <div style="text-align:center;font-size:22px;font-weight:800;color:#111;margin-bottom:24px;text-transform:uppercase;letter-spacing:1px">${templateName}</div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">
    <div style="background:#f0fdf4;border-left:4px solid #16a34a;border-radius:0 8px 8px 0;padding:16px">
      <div class="section-title" style="margin-top:0">Customer Information</div>
      <table><tbody>
        ${[['Name','CUSTOMER_NAME'],['Phone','CUSTOMER_PHONE'],['Email','CUSTOMER_EMAIL'],['Property','PROPERTY_ADDRESS'],['Insurance','INSURANCE_COMPANY'],['Policy #','POLICY_NUMBER'],['Claim #','CLAIM_NUMBER'],['Adjuster','ADJUSTER_NAME']]
          .filter(([,k]) => vals[k]).map(([l,k]) => `<tr><td class="info-label">${l}:</td><td class="info-value">${vals[k]}</td></tr>`).join('')}
      </tbody></table>
    </div>
    <div style="background:#f0fdf4;border-left:4px solid #16a34a;border-radius:0 8px 8px 0;padding:16px">
      <div class="section-title" style="margin-top:0">Project Details</div>
      <table><tbody>
        ${[['Date','ESTIMATE_DATE'],['Estimate #','ESTIMATE_NUMBER'],['Type','PROJECT_TYPE'],['Storm Date','STORM_DATE'],['Damage','DAMAGE_TYPE'],['Start','REQUESTED_START'],['Duration','ESTIMATED_DURATION'],['Deductible','DEDUCTIBLE_AMOUNT'],['Warranty','WARRANTY_PERIOD']]
          .filter(([,k]) => vals[k]).map(([l,k]) => `<tr><td class="info-label">${l}:</td><td class="info-value">${vals[k]}</td></tr>`).join('')}
      </tbody></table>
    </div>
  </div>

  ${vals.SCOPE_OF_WORK ? `<div class="section-title">Scope of Work</div><p style="white-space:pre-wrap;color:#374151">${vals.SCOPE_OF_WORK}</p>` : ''}
  ${vals.WORK_DESCRIPTION ? `<div class="section-title">Work to be Performed</div><p style="white-space:pre-wrap;color:#374151">${vals.WORK_DESCRIPTION}</p>` : ''}

  <div class="section-title">Cost Breakdown</div>
  <table>
    <thead><tr><th>Description</th><th style="text-align:center;width:60px">Qty</th><th style="width:80px">Unit</th><th style="text-align:right;width:100px">Unit Price</th><th style="text-align:right;width:100px">Total</th></tr></thead>
    <tbody>${lineRows}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end;margin-top:12px">
    <div style="width:280px">
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e5e7eb"><span style="color:#6b7280">Subtotal</span><strong>${subtotal || '—'}</strong></div>
      ${vals.TAX_RATE ? `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e5e7eb"><span style="color:#6b7280">Tax (${vals.TAX_RATE}%)</span><span>${vals.TAX_AMOUNT || '—'}</span></div>` : ''}
      <div class="total-box">TOTAL &nbsp; ${subtotal || '—'}</div>
    </div>
  </div>

  <div class="terms"><strong>Terms:</strong> Valid 30 days. Warranty: ${vals.WARRANTY_PERIOD || 'N/A'}. Payment due upon completion.</div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:48px">
    <div><div class="sig-line"></div><div style="text-align:center;font-size:12px;color:#9ca3af">Customer Signature / Date</div></div>
    <div><div class="sig-line"></div><div style="text-align:center;font-size:12px;color:#9ca3af">Contractor Signature / Date</div></div>
  </div>
  <div style="margin-top:32px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px">Thank you for choosing ${vals.COMPANY_NAME || 'us'}.</div>
</body></html>`;
}

// ─── InlineField ─────────────────────────────────────────────────────────────────

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
  const base = [
    'inline-block min-w-[80px] outline-none transition-all duration-150',
    printMode ? '' : 'border-b border-dashed',
    focused ? 'border-green-500 bg-green-50 rounded px-1'
      : value ? 'border-gray-300 text-gray-900' : 'border-gray-300 text-gray-400',
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
        className={[base, 'w-full resize-none text-sm leading-relaxed block', printMode ? 'border-none bg-transparent' : ''].join(' ')}
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
      className={[base, 'text-sm h-auto py-0.5', printMode ? 'border-none bg-transparent' : ''].join(' ')}
    />
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const FullScreenDocumentEditor: React.FC<FullScreenDocumentEditorProps> = ({
  template, onBack, companyProfile, contacts, initialContactId = '',
}) => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);

  const selectedContact = useMemo(
    () => contacts.find(c => c.id === initialContactId) ?? null,
    [contacts, initialContactId]
  );

  const seed = useMemo(() => ({
    ...seedFromCompany(companyProfile),
    ...seedFromContact(selectedContact),
    ESTIMATE_DATE: today,
    INSPECTION_DATE: today,
    CHANGE_DATE: today,
  }), [companyProfile, selectedContact]);

  const [vals, setVals] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    template.variables.forEach(v => { base[v] = seed[v] ?? ''; });
    return base;
  });

  const set = useCallback((key: string, val: string) => setVals(prev => ({ ...prev, [key]: val })), []);

  const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem(), newLineItem(), newLineItem()]);
  const [printMode, setPrintMode] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);

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

  useEffect(() => {
    const sub = calcSubtotal(lineItems);
    setVals(prev => ({ ...prev, SUBTOTAL: sub, TOTAL_AMOUNT: sub }));
  }, [lineItems]);

  const logoUrl = (companyProfile as any)?.logo_url ?? '';
  const filledCount = template.variables.filter(v => vals[v]?.trim()).length;

  const handleDownload = () => {
    const html = buildDocumentHtml(vals, lineItems, template.name, logoUrl);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name.replace(/\s+/g, '-')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getDocumentHtml = () => buildDocumentHtml(vals, lineItems, template.name, logoUrl);

  const cat = DOCUMENT_CATEGORIES.find(c => c.id === template.category);

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

      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b-2 border-green-600 shadow-sm flex-shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-green-700 hover:text-green-800 font-medium text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Templates
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
          <Button variant="outline" size="sm" onClick={() => setPrintMode(p => !p)}
            className="border-green-300 text-green-700 hover:bg-green-50 gap-1.5">
            {printMode ? <><EyeOff className="w-3.5 h-3.5" /> Edit Mode</> : <><Eye className="w-3.5 h-3.5" /> Preview</>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}
            className="border-green-300 text-green-700 hover:bg-green-50">
            <Printer className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}
            className="border-green-300 text-green-700 hover:bg-green-50 gap-1.5">
            <Download className="w-3.5 h-3.5" /> Download
          </Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
            onClick={() => toast({ title: 'Draft saved', description: template.name })}>
            <Save className="w-3.5 h-3.5" /> Save Draft
          </Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
            onClick={() => setShowSendModal(true)}>
            <Send className="w-3.5 h-3.5" /> Send to Customer
          </Button>
        </div>
      </div>

      {/* Document canvas */}
      <div className="flex-1 overflow-auto py-8 px-4">
        <div ref={printRef} className="bg-white max-w-4xl mx-auto shadow-lg rounded-lg p-12 print:shadow-none print:rounded-none" style={{ minHeight: '1100px' }}>

          {/* HEADER */}
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
              <div className="w-24 h-16 border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 ml-6 rounded">Logo</div>
            )}
          </div>

          {/* TITLE */}
          <div className="text-center text-2xl font-bold text-gray-800 mb-8 uppercase tracking-wide">{template.name}</div>

          {/* CUSTOMER + PROJECT */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-green-600">
              <div className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 border-b border-gray-200 pb-2">Customer Information</div>
              <table className="w-full text-sm"><tbody>
                {[['Name','CUSTOMER_NAME','Full name'],['Phone','CUSTOMER_PHONE','(000) 000-0000'],['Email','CUSTOMER_EMAIL','email@example.com'],['Property','PROPERTY_ADDRESS','Street address'],['City/State','PROPERTY_CITY','City'],['Insurance','INSURANCE_COMPANY','Insurance company'],['Policy #','POLICY_NUMBER','Policy number'],['Claim #','CLAIM_NUMBER','Claim number'],['Adjuster','ADJUSTER_NAME','Adjuster name'],['Adj. Phone','ADJUSTER_PHONE','(000) 000-0000']]
                  .filter(([,key]) => template.variables.includes(key as string))
                  .map(([label, key, ph]) => (
                    <tr key={key} className="border-b border-gray-100 last:border-0">
                      <td className="py-1.5 pr-3 text-gray-500 font-medium w-28 whitespace-nowrap">{label}:</td>
                      <td className="py-1.5">{F(key as string, ph as string, { className: 'w-full' })}</td>
                    </tr>
                  ))}
              </tbody></table>
            </div>
            <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-green-600">
              <div className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 border-b border-gray-200 pb-2">Project Details</div>
              <table className="w-full text-sm"><tbody>
                {[['Est. Date','ESTIMATE_DATE','Date'],['Estimate #','ESTIMATE_NUMBER','EST-000000'],['Project Type','PROJECT_TYPE','Roof replacement'],['Storm Date','STORM_DATE','Date of storm'],['Damage Type','DAMAGE_TYPE','Hail / Wind'],['Start Date','REQUESTED_START','Requested start'],['Duration','ESTIMATED_DURATION','1-2 days'],['Deductible','DEDUCTIBLE_AMOUNT','$0.00'],['Work Order #','WORK_ORDER_NUMBER','WO-000000'],['Priority','PRIORITY_LEVEL','Normal'],['Warranty','WARRANTY_PERIOD','10 years']]
                  .filter(([,key]) => template.variables.includes(key as string))
                  .map(([label, key, ph]) => (
                    <tr key={key} className="border-b border-gray-100 last:border-0">
                      <td className="py-1.5 pr-3 text-gray-500 font-medium w-28 whitespace-nowrap">{label}:</td>
                      <td className="py-1.5">{F(key as string, ph as string, { className: 'w-full' })}</td>
                    </tr>
                  ))}
              </tbody></table>
            </div>
          </div>

          {/* SCOPE */}
          {template.variables.includes('SCOPE_OF_WORK') && (
            <div className="mb-8">
              <div className="text-base font-bold text-gray-800 mb-3 border-b-2 border-green-600 pb-1">Scope of Work</div>
              {F('SCOPE_OF_WORK', 'Describe the full scope of work…', { multiline: true, className: 'w-full text-sm' })}
            </div>
          )}
          {template.variables.includes('WORK_DESCRIPTION') && (
            <div className="mb-8">
              <div className="text-base font-bold text-gray-800 mb-3 border-b-2 border-green-600 pb-1">Work to be Performed</div>
              {F('WORK_DESCRIPTION', 'Describe the work…', { multiline: true, className: 'w-full text-sm' })}
            </div>
          )}

          {/* COST BREAKDOWN */}
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
                      <InlineField value={item.description} onChange={v => updateLineItem(item.id, 'description', v)} placeholder="Item description…" className="w-full" printMode={printMode} />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <InlineField value={item.qty} onChange={v => updateLineItem(item.id, 'qty', v)} placeholder="0" numeric className="w-16 text-center" printMode={printMode} />
                    </td>
                    <td className="py-2 px-3">
                      <InlineField value={item.unit} onChange={v => updateLineItem(item.id, 'unit', v)} placeholder="sq ft" className="w-20" printMode={printMode} />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <InlineField value={item.unitPrice} onChange={v => updateLineItem(item.id, 'unitPrice', v)} placeholder="$0.00" className="w-24 text-right" printMode={printMode} />
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-green-700">
                      {item.total || <span className="text-gray-300 font-normal text-xs">auto</span>}
                    </td>
                    {!printMode && (
                      <td className="py-2 px-1">
                        <button onClick={() => removeLineItem(item.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!printMode && (
              <button onClick={addLineItem} className="mt-2 flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 font-medium">
                <Plus className="w-4 h-4" /> Add line item
              </button>
            )}
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

          {/* ADDITIONAL SECTIONS */}
          {[['REASON_FOR_CHANGE','Reason for Change'],['ORIGINAL_SCOPE','Original Scope'],['ADDITIONAL_WORK','Additional Work Required'],['MATERIALS_LIST','Materials Required'],['CREW_ASSIGNMENTS','Crew Assignment'],['ADDITIONAL_SAFETY_REQUIREMENTS','Additional Safety Requirements']]
            .filter(([key]) => template.variables.includes(key)).map(([key, label]) => (
              <div key={key} className="mb-6">
                <div className="text-base font-bold text-gray-800 mb-2 border-b-2 border-green-600 pb-1">{label}</div>
                {F(key, `Enter ${label.toLowerCase()}…`, { multiline: true, className: 'w-full text-sm' })}
              </div>
            ))}

          {/* TERMS */}
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg mb-8 text-sm text-gray-700">
            <strong>Terms &amp; Conditions:</strong> This estimate is valid for 30 days.
            Warranty: {F('WARRANTY_PERIOD', '10 years', { className: 'w-24' })}. Payment due upon completion.
          </div>

          {/* SIGNATURES */}
          <div className="grid grid-cols-2 gap-12 mt-10">
            <div><div className="border-b-2 border-gray-400 h-12 mb-2"></div><div className="text-xs text-gray-500 text-center">Customer Signature / Date</div></div>
            <div><div className="border-b-2 border-gray-400 h-12 mb-2"></div><div className="text-xs text-gray-500 text-center">Contractor Signature / Date</div></div>
          </div>

          <div className="mt-10 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
            Thank you for choosing {vals['COMPANY_NAME'] || 'us'} — we’re committed to quality workmanship and customer satisfaction.
          </div>
        </div>
      </div>

      {/* Send modal */}
      {showSendModal && (
        <SendDocumentModal
          open={showSendModal}
          onClose={() => setShowSendModal(false)}
          templateId={template.id}
          templateName={template.name}
          documentHtml={getDocumentHtml()}
          contactId={initialContactId || undefined}
          defaultEmail={vals['CUSTOMER_EMAIL'] ?? ''}
          defaultName={vals['CUSTOMER_NAME'] ?? ''}
          companyId={(companyProfile as any)?.id ?? (profile as any)?.company_id ?? ''}
        />
      )}
    </div>
  );
};

export default FullScreenDocumentEditor;

// TemplateBuilder — Live document builder with editable fields + live HTML preview
// Used from: DocumentTemplates (sidebar), ContactTemplateModal (Documents tab), ContactDetail (Create Estimate)
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  X, ChevronLeft, Plus, Trash2, Save, Send, Printer,
  User, Building2, FileText, DollarSign, Loader2, CheckCircle,
  Mail, Download, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/authContext';
import { db, DbCompany } from '@/lib/database';
import { uploadDocument } from '@/lib/storage';
import {
  DocumentTemplate,
  buildContactOverrides,
  fillTemplateVars,
  getUnfilledVars,
} from '@/lib/contractorTemplates';
import { Contact, Document, getContactFullName } from '@/lib/crmData';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  description: string;
  qty: string;       // kept as string so user can type freely; parsed on calc
  unit: string;      // e.g. "sq", "LF", "ea", "Lot"
  unitPrice: string; // kept as string
  total: number;     // computed
}

interface CustomerFields {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  insuranceCompany: string;
  claimNumber: string;
  policyNumber: string;
  adjusterName: string;
  adjusterPhone: string;
}

interface ProjectFields {
  estimateNumber: string;
  estimateDate: string;
  estimateExpiry: string;
  startDate: string;
  duration: string;
  projectType: string;
  damageType: string;
  scopeOfWork: string;
  warrantyPeriod: string;
  paymentTerms: string;
  taxRate: string;
  depositPercent: string;
  notes: string;
}

export interface TemplateBuilderProps {
  template: DocumentTemplate;
  contact?: Contact | null;
  onClose: () => void;
  onDocumentSaved?: (doc: Document) => void;
  /** If true, the builder opens inline (no fixed overlay). Default: modal overlay */
  inline?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseNum(s: string): number {
  const n = parseFloat(s.replace(/[$,]/g, ''));
  return isNaN(n) ? 0 : n;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

/** Extract default line items from cost-breakdown tables in the template HTML */
function defaultLineItemsFromTemplate(template: DocumentTemplate): LineItem[] {
  // Parse <tr> rows from the template HTML tbody
  const rows: LineItem[] = [];
  const tbodyMatch = template.content.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return rows;
  const trMatches = tbodyMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/gi);
  for (const trMatch of trMatches) {
    const tds = [...trMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m =>
      m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim()
    );
    if (tds.length < 2) continue;
    // Skip total/subtotal rows (no real line item)
    const description = tds[0] || '';
    if (!description || description.toLowerCase().startsWith('subtotal') || description.toLowerCase().startsWith('total')) continue;
    // Replace {{VARIABLE}} in description label — keep as-is for readability
    const cleanDesc = description.replace(/\{\{[A-Z0-9_]+\}\}/g, '___');
    const qty = tds[1]?.replace(/\{\{[A-Z0-9_]+\}\}/g, '').trim() || '1';
    const unitMatch = qty.match(/(sq|LF|ea|sets?|openings?|doors?|rooms?|gal|hrs?|sheets?|units?|lot)/i);
    const unitLabel = unitMatch ? unitMatch[1] : 'Lot';
    const qtyNum = qty.match(/^\d/) ? qty.split(/\s/)[0] : '1';
    rows.push({
      id: uid(),
      description: cleanDesc,
      qty: qtyNum,
      unit: unitLabel,
      unitPrice: '',
      total: 0,
    });
  }
  return rows.length > 0 ? rows : [
    { id: uid(), description: 'Labor & Materials', qty: '1', unit: 'Lot', unitPrice: '', total: 0 },
  ];
}

/** Build the filled HTML for the preview iframe */
function buildPreviewHtml(
  template: DocumentTemplate,
  customerFields: CustomerFields,
  projectFields: ProjectFields,
  lineItems: LineItem[],
  companyOverrides: Record<string, string>
): string {
  // Build line items HTML
  const itemsHtml = lineItems.map(li => {
    const qty = parseNum(li.qty);
    const up = parseNum(li.unitPrice);
    const total = qty > 0 && up > 0 ? qty * up : parseNum(String(li.total));
    return `<tr>
      <td>${li.description || '—'}</td>
      <td>${li.qty} ${li.unit}</td>
      <td>${li.unitPrice ? fmt(up) : '—'}</td>
      <td>${total > 0 ? fmt(total) : '—'}</td>
    </tr>`;
  }).join('');

  const subtotal = lineItems.reduce((s, li) => {
    const qty = parseNum(li.qty);
    const up = parseNum(li.unitPrice);
    return s + (qty > 0 && up > 0 ? qty * up : li.total);
  }, 0);
  const taxRate = parseNum(projectFields.taxRate);
  const taxAmount = subtotal * taxRate / 100;
  const total = subtotal + taxAmount;
  const depositPercent = parseNum(projectFields.depositPercent);
  const deposit = depositPercent > 0 ? total * depositPercent / 100 : 0;
  const balance = total - deposit;

  const overrides: Record<string, string> = {
    ...companyOverrides,
    CUSTOMER_NAME: customerFields.name,
    CLIENT_NAME: customerFields.name,
    CUSTOMER_PHONE: customerFields.phone,
    CUSTOMER_EMAIL: customerFields.email,
    PROPERTY_ADDRESS: customerFields.address,
    PROPERTY_CITY: customerFields.city,
    PROPERTY_STATE: customerFields.state,
    PROPERTY_ZIP: customerFields.zip,
    PROJECT_ADDRESS: [customerFields.address, customerFields.city, customerFields.state, customerFields.zip]
      .filter(Boolean).join(', '),
    PROJECT_NAME: customerFields.name ? `${customerFields.name} — ${customerFields.address || 'Project'}` : 'Project',
    INSURANCE_COMPANY: customerFields.insuranceCompany,
    CLAIM_NUMBER: customerFields.claimNumber,
    POLICY_NUMBER: customerFields.policyNumber,
    ADJUSTER_NAME: customerFields.adjusterName,
    ADJUSTER_PHONE: customerFields.adjusterPhone,
    ESTIMATE_NUMBER: projectFields.estimateNumber,
    ESTIMATE_DATE: projectFields.estimateDate,
    CONTRACT_DATE: projectFields.estimateDate,
    ESTIMATE_EXPIRY: projectFields.estimateExpiry,
    START_DATE: projectFields.startDate,
    ESTIMATED_DURATION: projectFields.duration,
    PROJECT_TYPE: projectFields.projectType,
    DAMAGE_TYPE: projectFields.damageType,
    SCOPE_OF_WORK: projectFields.scopeOfWork
      ? projectFields.scopeOfWork.replace(/\n/g, '<br>')
      : '—',
    WARRANTY_PERIOD: projectFields.warrantyPeriod || '2 years',
    PAYMENT_TERMS: projectFields.paymentTerms || '50% deposit at signing; balance due upon completion',
    TAX_RATE: projectFields.taxRate || '0',
    TAX_AMOUNT: fmt(taxAmount),
    SUBTOTAL: fmt(subtotal),
    TOTAL_AMOUNT: fmt(total),
    DEPOSIT_AMOUNT: fmt(deposit),
    BALANCE_DUE: fmt(balance),
    NOTES: projectFields.notes ? projectFields.notes.replace(/\n/g, '<br>') : '',
    // Replace cost breakdown placeholder with real items
    COST_BREAKDOWN_ITEMS: itemsHtml,
    LINE_ITEMS_TABLE: itemsHtml,
    MATERIALS_LIST: lineItems.map(li => `<li>${li.description}</li>`).join(''),
  };

  // Fill the template, leave remaining {{VARS}} as styled placeholders
  let html = fillTemplateVars(template.content, overrides);

  // Replace remaining unfilled vars with styled placeholder spans
  html = html.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_m, varName) => {
    const label = varName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    return `<span style="background:#eff6ff;color:#1e40af;border-bottom:2px dashed #93c5fd;padding:0 3px;border-radius:2px;font-style:italic;font-size:0.9em;">[${label}]</span>`;
  });

  return html;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TemplateBuilder({
  template,
  contact,
  onClose,
  onDocumentSaved,
  inline = false,
}: TemplateBuilderProps) {
  const { profile } = useAuth();
  const [companyProfile, setCompanyProfile] = useState<DbCompany | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Customer fields (pre-filled from contact) ─────────────────────────────
  const [customer, setCustomer] = useState<CustomerFields>({
    name: contact ? getContactFullName(contact) : '',
    phone: (contact as any)?.phone1 || '',
    email: contact?.email || '',
    address: contact?.address || '',
    city: contact?.city || '',
    state: contact?.state || '',
    zip: contact?.zip || '',
    insuranceCompany: (contact as any)?.insurance_company || '',
    claimNumber: (contact as any)?.claim_number || '',
    policyNumber: (contact as any)?.policy_number || '',
    adjusterName: (contact as any)?.adjuster_name || '',
    adjusterPhone: (contact as any)?.adjuster_phone || '',
  });

  // ── Project fields ─────────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const expiry = new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const [project, setProject] = useState<ProjectFields>({
    estimateNumber: `EST-${Date.now().toString().slice(-6)}`,
    estimateDate: today,
    estimateExpiry: expiry,
    startDate: '',
    duration: '',
    projectType: '',
    damageType: '',
    scopeOfWork: '',
    warrantyPeriod: '2 years',
    paymentTerms: '50% deposit at signing; balance due upon completion',
    taxRate: '0',
    depositPercent: '50',
    notes: '',
  });

  // ── Line items ─────────────────────────────────────────────────────────────
  const [lineItems, setLineItems] = useState<LineItem[]>(() => defaultLineItemsFromTemplate(template));

  // ── Computed totals ────────────────────────────────────────────────────────
  const { subtotal, taxAmount, total, deposit, balance } = useMemo(() => {
    const sub = lineItems.reduce((s, li) => {
      const qty = parseNum(li.qty);
      const up = parseNum(li.unitPrice);
      return s + (qty > 0 && up > 0 ? qty * up : li.total);
    }, 0);
    const taxAmt = sub * parseNum(project.taxRate) / 100;
    const tot = sub + taxAmt;
    const dep = parseNum(project.depositPercent) > 0 ? tot * parseNum(project.depositPercent) / 100 : 0;
    return { subtotal: sub, taxAmount: taxAmt, total: tot, deposit: dep, balance: tot - dep };
  }, [lineItems, project.taxRate, project.depositPercent]);

  // ── Load company profile ───────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.company_id) return;
    db.getCompany(profile.company_id).then(c => { if (c) setCompanyProfile(c); }).catch(() => {});
  }, [profile?.company_id]);

  // ── Build company variable overrides ──────────────────────────────────────
  const companyOverrides = useMemo(() => {
    return buildContactOverrides(
      contact as any ?? {},
      companyProfile as any,
      profile as any
    );
  }, [contact, companyProfile, profile]);

  // ── Live preview — debounced so we don't thrash the iframe ─────────────────
  const updatePreview = useCallback(() => {
    const html = buildPreviewHtml(template, customer, project, lineItems, companyOverrides);
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) { doc.open(); doc.write(html); doc.close(); }
    } catch {
      iframe.srcdoc = html;
    }
  }, [template, customer, project, lineItems, companyOverrides]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(updatePreview, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [updatePreview]);

  // ── Line item helpers ──────────────────────────────────────────────────────
  const updateLineItem = (id: string, field: keyof LineItem, value: string) => {
    setLineItems(prev => prev.map(li => {
      if (li.id !== id) return li;
      const updated = { ...li, [field]: value };
      const qty = parseNum(field === 'qty' ? value : li.qty);
      const up = parseNum(field === 'unitPrice' ? value : li.unitPrice);
      updated.total = qty > 0 && up > 0 ? qty * up : 0;
      return updated;
    }));
  };

  const addLineItem = () => setLineItems(prev => [
    ...prev,
    { id: uid(), description: '', qty: '1', unit: 'ea', unitPrice: '', total: 0 },
  ]);

  const removeLineItem = (id: string) => setLineItems(prev => prev.filter(li => li.id !== id));

  // ── Save to documents ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!profile?.company_id) { toast.error('Missing company context — please sign in again.'); return; }
    setIsSaving(true);
    try {
      const finalHtml = buildPreviewHtml(template, customer, project, lineItems, companyOverrides);
      const blob = new Blob([finalHtml], { type: 'text/html' });
      const contactName = customer.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '') || 'Customer';
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `${template.name.replace(/\s+/g, '_')}_${contactName}_${timestamp}.html`;
      const file = new File([blob], fileName, { type: 'text/html' });

      const uploadResult = await uploadDocument(file, profile.company_id, contact?.id);
      if (uploadResult.error || !uploadResult.path) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      const repName = profile
        ? `${(profile as any).first_name || ''} ${(profile as any).last_name || ''}`.trim()
        : 'System';

      const newDoc = await db.createDocument({
        company_id: profile.company_id,
        contact_id: contact?.id,
        name: `${template.name}${customer.name ? ` — ${customer.name}` : ''}`,
        type: template.category === 'estimate' ? 'estimate'
          : template.category === 'invoice' ? 'invoice'
          : template.category === 'contract' ? 'contract'
          : 'other',
        url: uploadResult.path,
        size: `${Math.round(blob.size / 1024)} KB`,
        uploaded_by: repName,
      });

      if (newDoc && onDocumentSaved) {
        const frontendDoc: Document = {
          id: newDoc.id,
          contactId: contact?.id || '',
          name: newDoc.name,
          type: (newDoc.type || 'other') as Document['type'],
          url: newDoc.url,
          uploadedAt: newDoc.created_at || new Date().toISOString(),
          uploadedBy: newDoc.uploaded_by || repName,
          size: newDoc.size || '',
        };
        onDocumentSaved(frontendDoc);
      }

      toast.success(`Document saved${customer.name ? ` for ${customer.name}` : ''}`);
      setIsSaved(true);
    } catch (err: any) {
      console.error('[TemplateBuilder] Save error:', err);
      toast.error(err?.message || 'Failed to save document');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Print / Save as PDF ───────────────────────────────────────────────────
  const handlePrint = () => {
    const html = buildPreviewHtml(template, customer, project, lineItems, companyOverrides);
    const win = window.open('', '_blank');
    if (!win) { toast.error('Pop-up blocked — allow pop-ups to print.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  };

  // ── Send for signature ─────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!customer.email) {
      toast.error('No customer email — add an email address first.');
      return;
    }
    // Save first so we have a URL
    await handleSave();

    const subject = encodeURIComponent(`Please Review and Sign: ${template.name}`);
    const body = encodeURIComponent(
      `Hello ${customer.name || 'there'},\n\nPlease review the attached ${template.name} at your earliest convenience.\n\nIf you have any questions, please don't hesitate to reach out.\n\nThank you,\n${(profile as any)?.first_name || ''} ${(profile as any)?.last_name || ''}\n${companyProfile?.name || ''}\n${companyProfile?.phone || ''}`
    );
    window.location.href = `mailto:${customer.email}?subject=${subject}&body=${body}`;
  };

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const setCustomerField = (field: keyof CustomerFields, val: string) =>
    setCustomer(prev => ({ ...prev, [field]: val }));
  const setProjectField = (field: keyof ProjectFields, val: string) =>
    setProject(prev => ({ ...prev, [field]: val }));

  const inputCls = 'w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white placeholder-gray-400';
  const labelCls = 'block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1';

  // ── Render ─────────────────────────────────────────────────────────────────
  const content = (
    <div className="flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ height: inline ? '100%' : '88vh', width: inline ? '100%' : undefined }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileText size={16} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">{template.name}</h2>
            {customer.name && <p className="text-xs text-gray-500">For: <span className="font-medium text-gray-700">{customer.name}</span></p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" title="Print / Save as PDF">
            <Printer size={13} /> Print / PDF
          </button>
          <button onClick={handleSend} disabled={isSaving} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50" title="Send for signature">
            <Mail size={13} /> Send for Signature
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isSaved}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : isSaved ? <><CheckCircle size={13} /> Saved!</> : <><Save size={13} /> Save to Documents</>}
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Close">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Body: left panel + right preview */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 overflow-y-auto bg-gray-50">

          {/* Customer Info */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <User size={14} className="text-blue-500" />
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Customer Info</h3>
            </div>
            <div className="space-y-2">
              <div>
                <label className={labelCls}>Full Name</label>
                <input className={inputCls} value={customer.name} onChange={e => setCustomerField('name', e.target.value)} placeholder="Customer Name" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Phone</label>
                  <input className={inputCls} value={customer.phone} onChange={e => setCustomerField('phone', e.target.value)} placeholder="(555) 000-0000" />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input className={inputCls} value={customer.email} onChange={e => setCustomerField('email', e.target.value)} placeholder="email@example.com" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Property Address</label>
                <input className={inputCls} value={customer.address} onChange={e => setCustomerField('address', e.target.value)} placeholder="123 Main St" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className={labelCls}>City</label>
                  <input className={inputCls} value={customer.city} onChange={e => setCustomerField('city', e.target.value)} placeholder="City" />
                </div>
                <div>
                  <label className={labelCls}>State</label>
                  <input className={inputCls} value={customer.state} onChange={e => setCustomerField('state', e.target.value)} placeholder="OH" />
                </div>
                <div>
                  <label className={labelCls}>Zip</label>
                  <input className={inputCls} value={customer.zip} onChange={e => setCustomerField('zip', e.target.value)} placeholder="43215" />
                </div>
              </div>
            </div>
          </div>

          {/* Insurance Info */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Building2 size={14} className="text-purple-500" />
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Insurance</h3>
            </div>
            <div className="space-y-2">
              <div>
                <label className={labelCls}>Insurance Company</label>
                <input className={inputCls} value={customer.insuranceCompany} onChange={e => setCustomerField('insuranceCompany', e.target.value)} placeholder="State Farm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Claim #</label>
                  <input className={inputCls} value={customer.claimNumber} onChange={e => setCustomerField('claimNumber', e.target.value)} placeholder="Claim Number" />
                </div>
                <div>
                  <label className={labelCls}>Policy #</label>
                  <input className={inputCls} value={customer.policyNumber} onChange={e => setCustomerField('policyNumber', e.target.value)} placeholder="Policy Number" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Adjuster Name</label>
                  <input className={inputCls} value={customer.adjusterName} onChange={e => setCustomerField('adjusterName', e.target.value)} placeholder="Adjuster" />
                </div>
                <div>
                  <label className={labelCls}>Adjuster Phone</label>
                  <input className={inputCls} value={customer.adjusterPhone} onChange={e => setCustomerField('adjusterPhone', e.target.value)} placeholder="Phone" />
                </div>
              </div>
            </div>
          </div>

          {/* Project Details */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={14} className="text-orange-500" />
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Project Details</h3>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Estimate #</label>
                  <input className={inputCls} value={project.estimateNumber} onChange={e => setProjectField('estimateNumber', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Date</label>
                  <input className={inputCls} value={project.estimateDate} onChange={e => setProjectField('estimateDate', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Start Date</label>
                  <input className={inputCls} value={project.startDate} onChange={e => setProjectField('startDate', e.target.value)} placeholder="TBD" />
                </div>
                <div>
                  <label className={labelCls}>Duration</label>
                  <input className={inputCls} value={project.duration} onChange={e => setProjectField('duration', e.target.value)} placeholder="1-2 days" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Project Type</label>
                <input className={inputCls} value={project.projectType} onChange={e => setProjectField('projectType', e.target.value)} placeholder="e.g. Roof Replacement" />
              </div>
              <div>
                <label className={labelCls}>Damage Type</label>
                <input className={inputCls} value={project.damageType} onChange={e => setProjectField('damageType', e.target.value)} placeholder="e.g. Hail, Wind, Water" />
              </div>
              <div>
                <label className={labelCls}>Scope of Work</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={3}
                  value={project.scopeOfWork}
                  onChange={e => setProjectField('scopeOfWork', e.target.value)}
                  placeholder="Describe the full scope of work…"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Warranty Period</label>
                  <input className={inputCls} value={project.warrantyPeriod} onChange={e => setProjectField('warrantyPeriod', e.target.value)} placeholder="2 years" />
                </div>
                <div>
                  <label className={labelCls}>Tax Rate (%)</label>
                  <input className={inputCls} value={project.taxRate} onChange={e => setProjectField('taxRate', e.target.value)} placeholder="0" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Payment Terms</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={2}
                  value={project.paymentTerms}
                  onChange={e => setProjectField('paymentTerms', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <DollarSign size={14} className="text-green-500" />
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Line Items</h3>
              </div>
              <button onClick={addLineItem} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                <Plus size={12} /> Add
              </button>
            </div>

            <p className="text-[10px] text-gray-400 mb-2 flex items-center gap-1">
              <Info size={10} /> Set Qty × Unit Price to auto-calculate totals
            </p>

            <div className="space-y-3">
              {lineItems.map((li, idx) => (
                <div key={li.id} className="border border-gray-200 rounded-lg p-2.5 bg-white relative">
                  <button
                    onClick={() => removeLineItem(li.id)}
                    className="absolute top-1.5 right-1.5 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={11} />
                  </button>
                  <div className="mb-1.5">
                    <label className={labelCls}>Description</label>
                    <input
                      className={inputCls}
                      value={li.description}
                      onChange={e => updateLineItem(li.id, 'description', e.target.value)}
                      placeholder={`Line item ${idx + 1}…`}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <label className={labelCls}>Qty</label>
                      <input className={inputCls} value={li.qty} onChange={e => updateLineItem(li.id, 'qty', e.target.value)} placeholder="1" />
                    </div>
                    <div>
                      <label className={labelCls}>Unit</label>
                      <input className={inputCls} value={li.unit} onChange={e => updateLineItem(li.id, 'unit', e.target.value)} placeholder="sq" />
                    </div>
                    <div>
                      <label className={labelCls}>Unit Price</label>
                      <input className={inputCls} value={li.unitPrice} onChange={e => updateLineItem(li.id, 'unitPrice', e.target.value)} placeholder="$0.00" />
                    </div>
                  </div>
                  {li.total > 0 && (
                    <div className="text-right text-xs font-semibold text-green-700 mt-1">
                      Total: {fmt(li.total)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Totals summary */}
            <div className="mt-3 border-t border-gray-200 pt-3 space-y-1">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Subtotal</span>
                <span className="font-medium">{fmt(subtotal)}</span>
              </div>
              {taxAmount > 0 && (
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Tax ({project.taxRate}%)</span>
                  <span>{fmt(taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                <span>Total</span>
                <span className="text-blue-700">{fmt(total)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <span>Deposit</span>
                  <input
                    className="w-12 text-xs border-b border-gray-300 bg-transparent text-center focus:outline-none focus:border-blue-500"
                    value={project.depositPercent}
                    onChange={e => setProjectField('depositPercent', e.target.value)}
                    placeholder="50"
                  />
                  <span>%</span>
                </div>
                <span>{fmt(deposit)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600 font-medium">
                <span>Balance Due</span>
                <span>{fmt(balance)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="p-4">
            <label className={labelCls}>Additional Notes</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={3}
              value={project.notes}
              onChange={e => setProjectField('notes', e.target.value)}
              placeholder="Any additional notes for this document…"
            />
          </div>
        </div>

        {/* ── RIGHT PANEL: Live Preview ────────────────────────────────────── */}
        <div className="flex-1 bg-gray-100 overflow-hidden flex flex-col">
          <div className="px-3 py-2 bg-gray-800 flex items-center justify-between flex-shrink-0">
            <span className="text-xs text-gray-300 font-medium">Live Document Preview</span>
            <span className="text-[10px] text-gray-500">Updates as you type · Blue dashed = unfilled field</span>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="bg-white rounded-lg shadow-md overflow-hidden min-h-full">
              <iframe
                ref={iframeRef}
                className="w-full border-0"
                style={{ minHeight: '800px', height: '100%' }}
                title={`Preview: ${template.name}`}
                sandbox="allow-same-origin allow-scripts"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (inline) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full" style={{ maxWidth: '1200px' }}>
        {content}
      </div>
    </div>
  );
}

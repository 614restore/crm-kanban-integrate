// Copied from QuoteMGR src/components/DocumentsWizard.tsx (read-only reference).
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Search, Award, Shield, FileText, Loader2, Check, ChevronLeft,
  AlertCircle, Send, Pencil, FilePlus, Plus, Download, Trash2,
  CheckCircle2, Clock, MinusCircle, ExternalLink, Eye, ChevronDown, Link, Link2,
  Mail, Share2, ClipboardList, User, ChevronRight, Camera,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { foldDocumentText } from '@/lib/pdfGenerator';
import { buildFullSignedDocumentPdf } from '@/lib/fullSignedDocument';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { openOrSavePdf, uploadPdfForSharing, copyToClipboard } from '@/lib/pdfDelivery';
import { generateInspectionReportPDF, inspectionReportFileName } from '@/lib/inspectionReportGenerator';
import { certUrl, quoteUrl, cancelNoticeUrl } from '@/lib/appUrl';
import { toast } from 'sonner';
import { toLocalDateString } from '@/lib/dates';

interface DocumentsWizardProps {
  quotes: any[];
  company: any;
  currentUserId?: string;
  currentUserRole?: string;
  onClose: () => void;
  onOpenCertPanel: (quote: any) => void;
  onOpenWorkOrderPanel: (quote: any) => void;
  initialQuote?: any;
}

type Step = 'select_quote' | 'view_documents' | 'configure_contingency' | 'invoice_editor';

// ─── Status badge ────────────────────────────────────────────────────────────
type DocStatus = 'complete' | 'sent' | 'unsigned' | 'none' | 'na';

const StatusBadge: React.FC<{ status: DocStatus; label: string }> = ({ status, label }) => {
  const cls: Record<DocStatus, string> = {
    complete: 'bg-green-100 text-green-700',
    sent:     'bg-amber-100 text-amber-700',
    unsigned: 'bg-gray-100 text-gray-500',
    none:     'bg-gray-100 text-gray-400',
    na:       'bg-gray-50 text-gray-300',
  };
  const icons: Record<DocStatus, React.ReactNode> = {
    complete: <CheckCircle2 className="w-3 h-3" />,
    sent:     <Clock className="w-3 h-3" />,
    unsigned: <MinusCircle className="w-3 h-3" />,
    none:     <MinusCircle className="w-3 h-3" />,
    na:       null,
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls[status]}`}>
      {icons[status]}
      {label}
    </span>
  );
};

// ─── Doc row ─────────────────────────────────────────────────────────────────
/**
 * One customer in the step 1 list.
 *
 * Deliberately plain: a name, where the job is, and how many documents are on
 * file. The previous list carried status pills and two quick-view buttons per
 * row, which meant reading a paragraph of state for every person before you
 * could pick one.
 */
/**
 * Which document is currently opened in the list.
 *
 * The hub showed every document's actions at once — three buttons a row, plus
 * explanatory paragraphs — so the screen asked to be read in full before you
 * could act. A document now opens to reveal its own actions, and only one is
 * open at a time. Carried by context so each row picks it up without every
 * call site having to thread props through.
 */
const DocAccordion = React.createContext<{ open: string | null; setOpen: (k: string | null) => void }>({
  open: null,
  setOpen: () => {},
});

const CustomerRow: React.FC<{
  group: { id: string; name: string; place: string; quotes: any[]; docCount: number };
  dimmed?: boolean;
  onPick: (group: { quotes: any[] }) => void;
}> = ({ group, dimmed = false, onPick }) => {
  const jobs = group.quotes.length;
  return (
    <button
      onClick={() => onPick(group)}
      className={`w-full flex items-center gap-4 p-4 text-left rounded-xl border transition-colors ${
        dimmed ? 'border-gray-100 hover:border-gray-200' : 'border-gray-200 hover:border-[#1e3a5f]/40'
      }`}
    >
      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
        <User className="w-5 h-5 text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{group.name}</p>
        <p className="text-xs text-gray-500 truncate">
          {group.place || (jobs === 1 ? group.quotes[0]?.quote_number : `${jobs} jobs`)}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap">
          {group.docCount === 1 ? '1 document' : `${group.docCount} documents`}
        </span>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </div>
    </button>
  );
};

const DocRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  status: DocStatus;
  statusLabel: string;
  children?: React.ReactNode;
  dimmed?: boolean;
}> = ({ icon, label, status, statusLabel, children, dimmed }) => {
  const { open, setOpen } = React.useContext(DocAccordion);
  const expanded = open === label;
  const hasActions = !!children;

  // A document that cannot exist for this job is not information — it is a row
  // to read and dismiss. Ten rows were rendered for every job regardless of
  // type, several of them only to say "Not Applicable"; those are now absent.
  if (status === 'na') return null;

  const accent: Record<DocStatus, string> = {
    complete: 'border-l-green-400',
    sent:     'border-l-amber-400',
    unsigned: 'border-l-slate-300',
    none:     'border-l-gray-200',
    na:       'border-l-gray-100',
  };
  const bg: Record<DocStatus, string> = {
    complete: 'bg-green-50/50',
    sent:     'bg-amber-50/40',
    unsigned: 'bg-white',
    none:     'bg-white',
    na:       'bg-gray-50/30',
  };
  const header = (
    <div className="flex items-center gap-3 w-full">
      <div className="w-8 h-8 bg-white/70 border border-gray-100 rounded-lg flex items-center justify-center shrink-0 shadow-sm">{icon}</div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
      </div>
      <StatusBadge status={status} label={statusLabel} />
      {hasActions && (
        <ChevronDown
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      )}
    </div>
  );

  return (
    <div className={`flex flex-col gap-2 px-4 py-3.5 border-b border-gray-100 last:border-0 border-l-4 ${accent[status]} ${dimmed ? 'opacity-40 bg-gray-50/50' : bg[status]}`}>
      {hasActions ? (
        <button
          type="button"
          onClick={() => setOpen(expanded ? null : label)}
          className="w-full"
          aria-expanded={expanded}
        >
          {header}
        </button>
      ) : header}
      {hasActions && expanded && <div className="pl-11">{children}</div>}
    </div>
  );
};

// ─── Section header ───────────────────────────────────────────────────────────
const SectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
  </div>
);

// openOrSavePdf now lives in @/lib/pdfDelivery, so screens other than this one
// can open a generated PDF rather than being limited to saving it. The iOS
// Safari caveat that shaped it is documented there.

// ─── Small action button ──────────────────────────────────────────────────────
const ActionBtn: React.FC<{
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
}> = ({ onClick, icon, label, variant = 'ghost', disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 sm:py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
      variant === 'primary'
        ? 'bg-[#1e3a5f] text-white hover:bg-[#162d4a]'
        : 'border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800 bg-white'
    }`}
  >
    {icon}
    {label}
  </button>
);

// ─── Main component ───────────────────────────────────────────────────────────
const DocumentsWizard: React.FC<DocumentsWizardProps> = ({ quotes, company, currentUserId, currentUserRole, onClose, onOpenCertPanel, onOpenWorkOrderPanel, initialQuote }) => {
  const canShareCancelNotice = currentUserRole === 'owner' || currentUserRole === 'admin';
  const [sharingCancelNotice, setSharingCancelNotice] = useState(false);
  // Set when a chosen customer has more than one job; cleared on back.
  const [customerJobs, setCustomerJobs] = useState<any[] | null>(null);
  // Which document row is expanded. Reset whenever a different job is opened so
  // the list always starts closed and scannable.
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  // Controls whether the "View Full Document" PDF carries the photo pages.
  const [includeFullDocPhotos, setIncludeFullDocPhotos] = useState(true);
  const [step, setStep] = useState<Step>(initialQuote ? 'view_documents' : 'select_quote');
  const [search, setSearch] = useState('');
  const [signedFilter, setSignedFilter] = useState<'all' | 'signed' | 'unsigned'>('all');
  const [selectedQuote, setSelectedQuote] = useState<any | null>(initialQuote ?? null);
  const [fullQuote, setFullQuote] = useState<any | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(!!initialQuote);
  const [showCertPreview, setShowCertPreview] = useState(false);
  const [certPhotos, setCertPhotos] = useState<any[]>([]);

  // Invoice / change orders
  const [invoice, setInvoice] = useState<any | null>(null);
  const [invoiceLineItems, setInvoiceLineItems] = useState<any[]>([]);
  const [changeOrders, setChangeOrders] = useState<any[]>([]);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [showAddCo, setShowAddCo] = useState(false);
  const [newCoDesc, setNewCoDesc] = useState('');
  const [newCoAmount, setNewCoAmount] = useState('');
  const [savingCo, setSavingCo] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null); // which pdf is generating
  const [quoteLineItems, setQuoteLineItems] = useState<any[]>([]);

  // Contingency send flow
  const [includeCancel, setIncludeCancel] = useState(true);
  const [sending, setSending] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailOverride, setEmailOverride] = useState<string | null>(null);

  // Contingency preview
  const [showContingencyPreview, setShowContingencyPreview] = useState(false);

  // Share via email
  const [shareEmail, setShareEmail] = useState('');
  const [sendingShareEmail, setSendingShareEmail] = useState(false);

  // Quick-view from Step 1 quote list
  const [quickViewLoading, setQuickViewLoading] = useState<string | null>(null);
  const [pendingQuickView, setPendingQuickView] = useState<'retail' | 'contingency' | 'cert' | null>(null);

  // Invoice editor
  const [editingDueDate, setEditingDueDate] = useState('');
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'check' | 'cash' | 'card' | 'transfer' | 'other'>('check');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [markingPaid, setMarkingPaid] = useState(false);

  const q = fullQuote || selectedQuote;
  const customerName = q?.customer
    ? `${q.customer.first_name} ${q.customer.last_name}`.trim()
    : q?.quote_number ?? '';
  const effectiveEmail = emailOverride ?? q?.customer?.email ?? '';

  // ── Filtered quote list ────────────────────────────────────────────────────
  const filteredQuotes = quotes.filter(quote => {
    if (signedFilter !== 'all') {
      const isSigned = !!(quote.signed_at || quote.contingency_signed_at || quote.certificate_customer_signed_at);
      if (signedFilter === 'signed' && !isSigned) return false;
      if (signedFilter === 'unsigned' && isSigned) return false;
    }
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const name = quote.customer
      ? `${quote.customer.first_name} ${quote.customer.last_name}`.toLowerCase()
      : '';
    return name.includes(term) || (quote.quote_number ?? '').toLowerCase().includes(term);
  });

  // ── Step 1 is a list of people, not a list of quotes ────────────────────────
  // It used to show every quote for every customer in one flat list, so finding
  // one person meant reading past everybody else. Quotes are grouped under the
  // customer they belong to; a customer with a single job opens straight into
  // their documents.
  type CustomerGroup = {
    id: string;
    name: string;
    sortKey: string;
    place: string;
    quotes: any[];
    latest: number;
    docCount: number;
  };

  /** Documents actually on file for a job — what the count in the list means. */
  const documentsOnFile = (q: any): number => {
    let n = 0;
    if (q.sent_at) n++;                                  // the quote or report itself
    if (q.signature_data || q.signed_at) n++;            // signed agreement
    if (q.contingency_signed_at) n++;                    // contingency agreement
    if (q.certificate_customer_signed_at) n++;           // completion certificate
    if (q.completion_certificate_sent_at && !q.certificate_customer_signed_at) n++;
    return n;
  };

  const customerGroups: CustomerGroup[] = (() => {
    const byCustomer = new Map<string, CustomerGroup>();
    for (const quote of filteredQuotes) {
      const c = quote.customer;
      const id = c?.id ?? `no-customer-${quote.id}`;
      const name = c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Unnamed customer' : 'Unnamed customer';
      const existing = byCustomer.get(id);
      const when = new Date(quote.updated_at ?? quote.created_at ?? 0).getTime();
      if (existing) {
        existing.quotes.push(quote);
        existing.latest = Math.max(existing.latest, when);
        existing.docCount += documentsOnFile(quote);
      } else {
        byCustomer.set(id, {
          id,
          name,
          // Sort on surname so the list reads like a directory.
          sortKey: `${(c?.last_name ?? '').toLowerCase()} ${(c?.first_name ?? '').toLowerCase()}`.trim() || name.toLowerCase(),
          place: [c?.address, c?.city].filter(Boolean).join(', '),
          quotes: [quote],
          latest: when,
          docCount: documentsOnFile(quote),
        });
      }
    }
    return Array.from(byCustomer.values());
  })();

  const alphabeticalCustomers = [...customerGroups].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  // Pinned above A–Z: on site the job you just finished is the one you want, and
  // under a strict alphabet it could be an entire scroll away.
  const recentCustomers = search.trim()
    ? []
    : [...customerGroups].sort((a, b) => b.latest - a.latest).slice(0, 4);
  const recentIds = new Set(recentCustomers.map(c => c.id));

  // ── Auto-load initial quote when opened from a per-quote entry point ─────────
  useEffect(() => {
    if (initialQuote) handleSelectQuote(initialQuote);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Picking a customer. With one job it opens straight into that job's
   * documents — the intermediate list would be a screen with a single row on
   * it. With several, their jobs are listed and nobody else's.
   */
  const handlePickCustomer = (group: { quotes: any[] }) => {
    if (group.quotes.length === 1) {
      void handleSelectQuote(group.quotes[0]);
      return;
    }
    setCustomerJobs(group.quotes);
  };

  // ── Select a quote ─────────────────────────────────────────────────────────
  const handleSelectQuote = async (quote: any) => {
    setOpenDoc(null);
    setSelectedQuote(quote);
    setFullQuote(null);
    setInvoice(null);
    setInvoiceLineItems([]);
    setChangeOrders([]);
    setEmailOverride(null);
    setEditingEmail(false);
    setShowContingencyPreview(false);
    setShowCertPreview(false);
    setCertPhotos([]);
    setShareEmail('');
    setEditingDueDate('');
    setPaymentMethod('check');
    setPaymentDate('');
    setPaymentAmount('');
    setPaymentNotes('');
    setStep('view_documents');
    setLoadingQuote(true);
    setLoadingInvoice(true);

    try {
      const [{ data: fullQ }, { data: inv }, { data: photoRows }, { data: lineItemRows }] = await Promise.all([
        supabase
          .from('quotes')
          .select(`*, customer:customers(id, first_name, last_name, email, phone, address, city, state, zip)`)
          .eq('id', quote.id)
          .single(),
        supabase
          .from('invoices')
          .select('*, customer:customers(first_name, last_name, email, address, city, state, zip)')
          .eq('quote_id', quote.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('quote_photos')
          .select('id, photo_url, caption, damage_type, damage_cause, location, notes, sort_order')
          .eq('quote_id', quote.id)
          .order('sort_order'),
        supabase
          .from('quote_line_items')
          .select('id, category, description, quantity, unit, good_price, better_price, best_price, sort_order')
          .eq('quote_id', quote.id)
          .order('sort_order'),
      ]);

      setCertPhotos(photoRows ?? []);

      if (fullQ) {
        setFullQuote(fullQ);
        const hasCancelSig = fullQ.contingency_enabled
          ? !!fullQ.contingency_cancel_signature_data
          : !!fullQ.cancel_signature_data;
        setIncludeCancel(hasCancelSig);
      }

      setInvoice(inv ?? null);
      setQuoteLineItems(lineItemRows ?? []);

      if (inv) {
        const { data: items } = await supabase
          .from('invoice_line_items')
          .select('*')
          .eq('invoice_id', inv.id)
          .order('sort_order');
        const all = items ?? [];
        setInvoiceLineItems(all);
        setChangeOrders(all.filter((i: any) => i.is_additional && !i.display_only));
      }
    } finally {
      setLoadingQuote(false);
      setLoadingInvoice(false);
    }
  };

  // ── Change orders ──────────────────────────────────────────────────────────
  const handleAddChangeOrder = async () => {
    if (!newCoDesc.trim() || !newCoAmount || !invoice) return;
    setSavingCo(true);
    try {
      const amount = parseFloat(newCoAmount);
      const { data, error } = await supabase
        .from('invoice_line_items')
        .insert({
          invoice_id: invoice.id,
          description: newCoDesc.trim(),
          quantity: 1,
          unit_price: amount,
          total: amount,
          display_only: false,
          is_additional: true,
          sort_order: changeOrders.length,
        })
        .select()
        .single();
      if (error) throw error;
      setChangeOrders(prev => [...prev, data]);
      setNewCoDesc('');
      setNewCoAmount('');
      setShowAddCo(false);
      toast.success('Change order added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add change order');
    } finally {
      setSavingCo(false);
    }
  };

  const handleDeleteChangeOrder = async (id: string) => {
    try {
      await supabase.from('invoice_line_items').delete().eq('id', id);
      setChangeOrders(prev => prev.filter(c => c.id !== id));
    } catch {
      toast.error('Failed to remove');
    }
  };

  // ── PDF generators ─────────────────────────────────────────────────────────
  const handleDownloadChangeOrderPdf = async () => {
    setGeneratingPdf('co');
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      foldDocumentText(doc);
      const margin = 50;
      const pageW = doc.internal.pageSize.getWidth();
      let y = margin;

      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 58, 95);
      doc.text('CHANGE ORDER', pageW / 2, y, { align: 'center' });
      y += 28;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(company?.name ?? '', pageW / 2, y, { align: 'center' });
      y += 16;
      if (company?.email) { doc.text(company.email, pageW / 2, y, { align: 'center' }); y += 14; }
      if (company?.phone) { doc.text(company.phone, pageW / 2, y, { align: 'center' }); y += 14; }
      y += 10;

      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageW - margin, y);
      y += 16;

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.text(`Date: ${dateStr}`, margin, y);
      if (invoice?.invoice_number) doc.text(`Invoice #: ${invoice.invoice_number}`, pageW - margin, y, { align: 'right' });
      y += 16;
      doc.text(`Quote #: ${q?.quote_number ?? ''}`, margin, y);
      y += 20;

      doc.setFont('helvetica', 'bold');
      doc.text('Customer:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(customerName, margin + 65, y);
      y += 14;
      if (q?.customer?.address) { doc.text(q.customer.address, margin + 65, y); y += 14; }
      y += 14;

      autoTable(doc, {
        startY: y,
        head: [['Description', 'Amount']],
        body: changeOrders.map(c => [c.description, `$${Number(c.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}`]),
        foot: [[
          { content: 'Total Change Order Amount', styles: { fontStyle: 'bold' } },
          { content: `$${changeOrders.reduce((s, c) => s + Number(c.total), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold' } },
        ]],
        headStyles: { fillColor: [30, 58, 95] },
        footStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30] },
        margin: { left: margin, right: margin },
        columnStyles: { 1: { halign: 'right', cellWidth: 100 } },
      });

      const finalY = (doc as any).lastAutoTable?.finalY ?? y + 60;
      const sigY = finalY + 40;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.line(margin, sigY, margin + 180, sigY);
      doc.text('Customer Signature', margin, sigY + 14);
      doc.line(margin + 220, sigY, margin + 400, sigY);
      doc.text('Date', margin + 220, sigY + 14);

      doc.save(`Change-Order-${q?.quote_number ?? 'document'}.pdf`);
    } finally {
      setGeneratingPdf(null);
    }
  };

  // ── Inspection photo report ────────────────────────────────────────────────
  // Available from here for any quote that has photos, rather than only from
  // the quote preview screen, and independent of whether the quote has been
  // signed — the photos exist from the inspection onward.
  const handlePhotoReportPdf = async (mode: 'view' | 'download' | 'share' = 'view') => {
    if (!fullQuote) return;
    if (certPhotos.length === 0) {
      toast.error('This quote has no photos yet.');
      return;
    }
    setGeneratingPdf(`photos-${mode}`);
    try {
      const doc = await generateInspectionReportPDF({
        quote: {
          quote_number: fullQuote.quote_number,
          cover_page_title: fullQuote.cover_page_title,
          project_description: fullQuote.project_description,
          created_at: fullQuote.created_at,
          cover_photo_url: fullQuote.cover_photo_url,
        },
        photos: certPhotos,
        company,
        customer: {
          first_name: fullQuote.customer?.first_name || '',
          last_name: fullQuote.customer?.last_name || '',
          address: fullQuote.customer?.address,
          city: fullQuote.customer?.city,
          state: fullQuote.customer?.state,
          zip: fullQuote.customer?.zip,
        },
      });
      const fileName = inspectionReportFileName(fullQuote.quote_number);
      if (mode === 'share') {
        const url = await uploadPdfForSharing(doc, fileName, company.id);
        await copyToClipboard(url);
        toast.success('Photo report link copied to clipboard');
      } else {
        openOrSavePdf(doc, fileName, mode);
      }
    } catch (err) {
      console.error('Photo report error:', err);
      toast.error('Failed to build the photo report. Please try again.');
    } finally {
      setGeneratingPdf(null);
    }
  };

  // ── Full signed document PDF (project info + photos + signatures) ──────────
  const handleFullDocPdf = async (mode: 'view' | 'download' = 'view') => {
    if (!fullQuote) return;
    setGeneratingPdf(mode === 'view' ? 'full-view' : 'full-download');
    try {
      const { doc, fileName } = await buildFullSignedDocumentPdf(fullQuote, company, certPhotos, {
        includePhotos: includeFullDocPhotos,
      });
      openOrSavePdf(doc, fileName, mode);
    } catch {
      toast.error('Failed to generate document');
    } finally {
      setGeneratingPdf(null);
    }
  };

  // 'base64' returns the same document the download button produces, so the
  // send flow can attach it to the email instead of relying on the inline copy.
  const handleContingencyPdf = async (
    mode: 'download' | 'view' | 'base64' = 'download'
  ): Promise<string | null> => {
    if (!fullQuote) return null;
    setGeneratingPdf(mode === 'view' ? 'contingency-view' : 'contingency');
    try {
      const margin = 50;
      const pageW = 612;
      // Real Letter pages. This was a single 612x1300 sheet — 1.6x Letter — so
      // printing scaled the whole document to about 61% and the result came out
      // too small to read. Nothing here paginated, because one tall page never
      // needed it; the helper below adds the breaks that are now required.
      const pageH = 792;
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      foldDocumentText(doc);

      let y = margin;

      /** Starts a new page when `needed` points would overflow the current one. */
      const ensureSpace = (needed: number) => {
        if (y + needed > pageH - margin) {
          doc.addPage();
          y = margin;
        }
      };
      const custName = `${fullQuote.customer?.first_name ?? ''} ${fullQuote.customer?.last_name ?? ''}`.trim();

      const addSigImage = (dataUrl: string, x: number, y: number) => {
        try { doc.addImage(dataUrl, 'PNG', x, y, 200, 45); } catch { /* skip if corrupt */ }
      };

      // ── Section 1: Contingency Agreement ─────────────────────────────────────
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 58, 95);
      doc.text('INSURANCE CONTINGENCY AGREEMENT', pageW / 2, y, { align: 'center' });
      y += 16;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(90, 90, 90);
      doc.text(company?.name ?? '', pageW / 2, y, { align: 'center' });
      y += 11;
      if (company?.phone) { doc.text(company.phone, pageW / 2, y, { align: 'center' }); y += 10; }
      if (company?.email) { doc.text(company.email, pageW / 2, y, { align: 'center' }); y += 10; }
      y += 3;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageW - margin, y);
      y += 10;

      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`Customer: ${custName}`, margin, y);
      doc.text(`Quote #: ${fullQuote.quote_number ?? ''}`, pageW - margin, y, { align: 'right' });
      y += 10;
      if (fullQuote.customer?.address) { doc.text(fullQuote.customer.address, margin, y); y += 10; }
      y += 6;

      const clauses: [string, string][] = [
        ['1. Agreement to Proceed', 'Property Owner authorizes Contractor to proceed with work contingent upon insurance carrier approval and agreement to pay the approved scope.'],
        ['2. Complete Performance', 'Contractor agrees to perform all work in its entirety per industry standards unless mutually agreed upon in writing. No verbal modifications shall be binding.'],
        ['3. Right to Supplement', 'Contractor retains the right to identify and submit supplemental claims for omitted items. All approved supplements are incorporated at no additional out-of-pocket cost beyond the deductible.'],
        ['4. Payment Terms', 'Property Owner agrees to remit all insurance proceeds received — including ACV, recoverable depreciation, and approved supplements — to Contractor per the payment schedule. The deductible is the sole responsibility of the Property Owner.'],
        ['5. Change Orders', 'Any work beyond the insurance-approved scope requires a written change order signed by both parties prior to commencement.'],
        ['6. Homeowner Cooperation', 'Property Owner agrees to cooperate with Contractor and carrier, provide timely property access, and promptly forward all insurance correspondence and payment checks.'],
        ['7. Workmanship Warranty', 'Contractor warrants all labor and installation for one (1) year from substantial completion. Material warranties are per manufacturer terms.'],
        ['8. Cancellation', 'Either party may cancel within three (3) business days of execution without penalty. After the rescission period, cancellation by the Property Owner after work has commenced may result in liability for costs incurred by Contractor up to the date of cancellation.'],
      ];

      doc.setFontSize(9);
      for (const [title, text] of clauses) {
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(text, pageW - margin * 2);
        // Measure first so a heading is never stranded at the foot of a page
        // with its clause overleaf.
        ensureSpace(9 + lines.length * 12 + 6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(title, margin, y);
        y += 9;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(70, 70, 70);
        doc.text(lines, margin, y);
        y += lines.length * 12 + 6;
      }

      y += 6;
      // A signature, its rule and its caption are one unit — never split them.
      ensureSpace(80);
      if (fullQuote.contingency_signature_data) addSigImage(fullQuote.contingency_signature_data, margin, y);
      doc.setDrawColor(150, 150, 150);
      doc.line(margin, y + 48, margin + 210, y + 48);
      doc.line(margin + 240, y + 48, margin + 420, y + 48);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text('Customer Signature', margin, y + 54);
      doc.text('Date', margin + 240, y + 54);
      doc.text(fullQuote.contingency_signed_at ? new Date(fullQuote.contingency_signed_at).toLocaleDateString() : '', margin + 242, y + 48);
      y += 62;
      doc.text(`Signed by: ${fullQuote.contingency_signed_by ?? custName}`, margin, y);

      // ── Section 2: 3-Day Right to Cancel ─────────────────────────────────────
      // Its own page: this is a distinct statutory notice, not a continuation.
      doc.addPage();
      y = margin;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageW - margin, y);
      y += 22;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 30, 30);
      doc.text('NOTICE OF THREE (3) DAY RIGHT TO CANCEL', pageW / 2, y, { align: 'center' });
      y += 18;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);

      const deadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

      const cancelParas = [
        'You, the buyer, may cancel this transaction at any time prior to midnight of the third business day after the date of this transaction. See the attached notice of cancellation form for an explanation of this right.',
        `To cancel this transaction, mail or deliver a signed and dated copy of this cancellation notice to:\n${company?.name ?? ''}\n${company?.address ?? ''}\n${company?.email ?? ''}`,
        `NOT LATER THAN MIDNIGHT OF: ${deadline}.`,
        'If you cancel, any property traded in, any payments made by you under the contract or sale, and any negotiable instrument executed by you will be returned within 10 business days following receipt by the seller of your cancellation notice.',
      ];

      for (const para of cancelParas) {
        const lines = doc.splitTextToSize(para, pageW - margin * 2);
        ensureSpace(lines.length * 11 + 7);
        doc.text(lines, margin, y);
        y += lines.length * 11 + 7;
      }

      y += 10;
      doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(80, 80, 80);
      const ackText2 = doc.splitTextToSize('By signing below, I acknowledge that I have received a copy of this Notice of Right to Cancel. This signature does NOT constitute cancellation of the contract.', pageW - margin * 2);
      // Acknowledgement wording and the signature it refers to stay together.
      ensureSpace(ackText2.length * 11 + 6 + 80);
      doc.text(ackText2, margin, y); y += ackText2.length * 11 + 6;
      doc.setFont('helvetica', 'normal');
      if (fullQuote.contingency_cancel_signature_data) {
        addSigImage(fullQuote.contingency_cancel_signature_data, margin, y);
      }
      doc.setDrawColor(150, 150, 150);
      doc.line(margin, y + 48, margin + 210, y + 48);
      doc.line(margin + 240, y + 48, margin + 420, y + 48);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text('Signature — Acknowledgment of Receipt', margin, y + 58);
      doc.text('Date', margin + 240, y + 58);
      doc.text(fullQuote.contingency_signed_at ? new Date(fullQuote.contingency_signed_at).toLocaleDateString() : '', margin + 242, y + 48);
      y += 68;
      doc.text(`Acknowledged by: ${fullQuote.contingency_signed_by ?? custName}`, margin, y);

      // ── Section 3: Contractor Authorization ──────────────────────────────────
      if (fullQuote.contractor_signature_data || fullQuote.contractor_signed_at) {
        // Its own page, like the notice above — this is the contractor's
        // separate execution of the agreement.
        doc.addPage();
        y = margin;
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, pageW - margin, y);
        y += 22;

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 58, 95);
        doc.text('CONTRACTOR AUTHORIZATION', pageW / 2, y, { align: 'center' });
        y += 18;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text(`Quote #: ${fullQuote.quote_number ?? ''}`, margin, y);
        doc.text(
          `Date: ${fullQuote.contractor_signed_at ? new Date(fullQuote.contractor_signed_at).toLocaleDateString() : ''}`,
          pageW - margin, y, { align: 'right' }
        );
        y += 12;
        const authLines = doc.splitTextToSize(
          'The undersigned contractor hereby acknowledges and agrees to the terms of this Insurance Contingency Agreement and authorizes the work described herein.',
          pageW - margin * 2
        );
        doc.text(authLines, margin, y);
        y += authLines.length * 11 + 14;
        ensureSpace(80);

        if (fullQuote.contractor_signature_data) addSigImage(fullQuote.contractor_signature_data, margin, y);
        doc.setDrawColor(150, 150, 150);
        doc.line(margin, y + 48, margin + 210, y + 48);
        doc.line(margin + 240, y + 48, margin + 420, y + 48);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text('Contractor Signature', margin, y + 54);
        doc.text('Date', margin + 240, y + 54);
        doc.text(
          fullQuote.contractor_signed_at ? new Date(fullQuote.contractor_signed_at).toLocaleDateString() : '',
          margin + 242, y + 48
        );
        y += 62;
        doc.text(`Signed by: ${fullQuote.contractor_signed_by ?? company?.name ?? ''}`, margin, y);
      }

      if (mode === 'base64') return doc.output('datauristring').split(',')[1];

      openOrSavePdf(doc, `Contingency-Agreement-${fullQuote.quote_number ?? 'document'}.pdf`, mode);
      return null;
    } catch (err: any) {
      toast.error('Failed to generate PDF');
      return null;
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleDownloadInvoicePdf = async (type: 'invoice' | 'receipt') => {
    if (!invoice) return;
    setGeneratingPdf(type);
    try {
      const { generateInvoicePdf } = await import('@/lib/invoicePdfGenerator');
      await generateInvoicePdf(invoice, company, invoiceLineItems, type);
    } catch {
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingPdf(null);
    }
  };

  // ── Contingency send ───────────────────────────────────────────────────────
  const handleSaveEmail = async () => {
    const trimmed = emailDraft.trim();
    if (!trimmed || !trimmed.includes('@')) { toast.error('Please enter a valid email address'); return; }
    setSavingEmail(true);
    const { error } = await supabase.from('customers').update({ email: trimmed }).eq('id', q?.customer?.id);
    setSavingEmail(false);
    if (error) { toast.error('Failed to update email'); }
    else { setEmailOverride(trimmed); setEditingEmail(false); toast.success('Email updated'); }
  };

  const handleSendContingency = async () => {
    if (!effectiveEmail) { toast.error('No customer email on file'); return; }
    const confirmed = window.confirm(`Send Contingency Agreement to ${effectiveEmail}?`);
    if (!confirmed) return;
    setSending(true);
    try {
      // The homeowner needs a document they can save and forward, not just the
      // copy rendered in the email body.
      const pdfBase64 = await handleContingencyPdf('base64');

      const { error } = await supabase.functions.invoke('send-completion-certificate', {
        body: {
          quote_id: q.id,
          company_id: company.id,
          dashboard_url: window.location.origin,
          contingency_only: true,
          include_cancel: includeCancel,
          selected_photos: [],
          ...(pdfBase64 ? {
            pdf_base64: pdfBase64,
            pdf_filename: `Contingency-Agreement-${q.quote_number ?? 'document'}.pdf`,
          } : {}),
        },
      });
      if (error) {
        let detail = error.message;
        try {
          const ctx = (error as any).context;
          const parsed = ctx && typeof ctx.json === 'function' ? await ctx.json() : ctx;
          if (parsed?.details) detail = parsed.details;
          else if (parsed?.error) detail = parsed.error;
        } catch { /* ignore */ }
        toast.error(`Failed to send: ${detail}`, { duration: 8000 });
      } else {
        toast.success(`Contingency Agreement sent to ${effectiveEmail}`, { duration: 5000 });
        setStep('view_documents');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  // ── Retail signed quote PDF (mode: 'download' saves file; 'view' opens blob in new tab) ──
  const handleRetailSignedPdf = async (mode: 'download' | 'view' = 'download') => {
    if (!fullQuote) return;
    setGeneratingPdf(mode === 'view' ? 'retail-view' : 'retail');
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      foldDocumentText(doc);
      const margin = 50;
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const bottomPad = 52; // footer clearance
      const custName = `${fullQuote.customer?.first_name ?? ''} ${fullQuote.customer?.last_name ?? ''}`.trim();
      const companyName = company?.name ?? '';
      const quoteNo = fullQuote.quote_number ?? '';
      const cityStateZip = [fullQuote.customer?.city, fullQuote.customer?.state, fullQuote.customer?.zip].filter(Boolean).join(', ');

      const addSigImage = (dataUrl: string, x: number, startY: number) => {
        if (!dataUrl) return;
        try { doc.addImage(dataUrl, 'PNG', x, startY, 200, 48); } catch { /* skip */ }
      };

      const drawPageHeader = (title: string) => {
        doc.setFillColor(30, 58, 95);
        doc.rect(0, 0, pageW, 65, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(companyName, margin, 26);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        if (company?.phone) doc.text(`${company.phone}${company?.email ? '  |  ' + company.email : ''}`, margin, 44);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(quoteNo, pageW - margin, 26, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text('QUOTE #', pageW - margin, 42, { align: 'right' });
        doc.setTextColor(30, 30, 30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text(title, margin, 92);
        return 112;
      };

      const drawFooter = (label: string) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(160, 160, 160);
        doc.text(label, pageW / 2, pageH - 22, { align: 'center' });
      };

      // Advance to a new page if there isn't enough room; return new y
      let pageCount = 1;
      const ensureSpace = (currentY: number, needed: number, headerTitle: string): number => {
        if (currentY + needed > pageH - bottomPad) {
          drawFooter(`${quoteNo}  |  ${companyName}`);
          doc.addPage();
          pageCount++;
          return drawPageHeader(headerTitle);
        }
        return currentY;
      };

      // Starts a new logical section (Customer Acceptance, Contractor
      // Authorization, etc). Flows onto the current page with a lightweight
      // divider + title when the section fits in the remaining space;
      // otherwise starts a fresh page with the full letterhead. This is what
      // keeps short sections from each burning a whole mostly-blank page.
      const startSection = (currentY: number, title: string, estimatedHeight: number): number => {
        const gapBefore = 28;
        if (currentY + gapBefore + estimatedHeight > pageH - bottomPad) {
          drawFooter(`${quoteNo}  |  ${companyName}`);
          doc.addPage();
          pageCount++;
          return drawPageHeader(title);
        }
        let sy = currentY + gapBefore;
        doc.setDrawColor(210, 218, 232);
        doc.setLineWidth(0.75);
        doc.line(margin, sy, pageW - margin, sy);
        sy += 22;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.setTextColor(30, 30, 30);
        doc.text(title, margin, sy);
        return sy + 22;
      };

      // ── Pages 1+: Project Proposal ─────────────────────────────────────────
      const showPrices = fullQuote.show_line_item_prices !== false;
      // Which tier's pricing belongs on this signed contract: whatever the
      // customer actually selected/signed, falling back to whichever tier is
      // included when none was chosen — never hardcode Good, or a
      // Better/Best acceptance prints the wrong (lower) price on the document.
      const stForPdf = fullQuote.selected_tier;
      const tierForPdf: 'good' | 'better' | 'best' =
        stForPdf === 'good' || stForPdf === 'better' || stForPdf === 'best' ? stForPdf
        : fullQuote.include_better !== false ? 'better'
        : fullQuote.include_best !== false ? 'best'
        : 'good';
      const priceKeyForPdf = `${tierForPdf}_price` as 'good_price' | 'better_price' | 'best_price';
      const getQuoteTierTotalForPdf = (tier: 'good' | 'better' | 'best') =>
        fullQuote.use_manual_totals === true
          ? (fullQuote as any)[`manual_${tier}_total`] ?? (fullQuote as any)[`${tier}_total`] ?? 0
          : (fullQuote as any)[`${tier}_total`] ?? 0;
      const totalForPdf = stForPdf === 'all'
        ? getQuoteTierTotalForPdf('good') + getQuoteTierTotalForPdf('better') + getQuoteTierTotalForPdf('best')
        : getQuoteTierTotalForPdf(tierForPdf);
      const grouped: Record<string, any[]> = {};
      for (const li of quoteLineItems) {
        const cat = li.category || 'General';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(li);
      }

      let y = drawPageHeader('Project Proposal & Customer Agreement');

      // Customer info grid
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(120, 130, 150);
      doc.text('PREPARED FOR', margin, y);
      doc.text('ADDRESS', margin + 210, y);
      doc.text('CONTACT', margin + 390, y);
      y += 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(25, 25, 25);
      doc.text(custName, margin, y);
      doc.text(fullQuote.customer?.address ?? '', margin + 210, y);
      doc.text(fullQuote.customer?.phone ?? '', margin + 390, y);
      y += 14;
      doc.text(cityStateZip, margin + 210, y);
      if (fullQuote.customer?.email) doc.text(fullQuote.customer.email, margin + 390, y);
      y += 20;

      doc.setDrawColor(210, 218, 232);
      doc.setLineWidth(0.75);
      doc.line(margin, y, pageW - margin, y);
      y += 16;

      // Project description
      if (fullQuote.project_description) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 58, 95);
        doc.text('PROJECT DESCRIPTION', margin, y);
        y += 13;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(50, 55, 65);
        const descWords = doc.splitTextToSize(fullQuote.project_description, pageW - margin * 2);
        for (const line of descWords) {
          y = ensureSpace(y, 14, 'Project Description (continued)');
          doc.text(line, margin, y);
          y += 14;
        }
        y += 10;
      }

      // Scope of work table
      if (Object.keys(grouped).length > 0) {
        y = ensureSpace(y, 48, 'Scope of Work');

        // Table header
        doc.setFillColor(30, 58, 95);
        doc.rect(margin, y, pageW - margin * 2, 22, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text('SCOPE OF WORK', margin + 10, y + 14);
        if (showPrices) doc.text('AMOUNT', pageW - margin - 10, y + 14, { align: 'right' });
        y += 22;

        let rowShade = false;
        for (const [category, items] of Object.entries(grouped)) {
          // Category header row
          y = ensureSpace(y, 22 + 20, 'Scope of Work (continued)');
          doc.setFillColor(220, 228, 245);
          doc.rect(margin, y, pageW - margin * 2, 20, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(20, 48, 100);
          doc.text(category.toUpperCase(), margin + 10, y + 13);
          y += 20;
          rowShade = false;

          for (const li of items) {
            const wrappedDesc = doc.splitTextToSize(li.description || '', pageW - margin * 2 - (showPrices ? 100 : 24));
            const rowH = Math.max(wrappedDesc.length * 13 + 8, 22);
            y = ensureSpace(y, rowH, 'Scope of Work (continued)');

            if (rowShade) {
              doc.setFillColor(246, 248, 253);
              doc.rect(margin, y, pageW - margin * 2, rowH, 'F');
            }
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(40, 42, 48);
            doc.text(wrappedDesc, margin + 14, y + 14);
            const liPrice = li[priceKeyForPdf] ?? li.good_price;
            if (showPrices && liPrice != null) {
              doc.setFont('helvetica', 'bold');
              doc.text(
                `$${Number(liPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                pageW - margin - 10, y + 14, { align: 'right' }
              );
            }
            y += rowH;
            rowShade = !rowShade;
          }
        }

        // Total bar
        y = ensureSpace(y, 30, 'Scope of Work (continued)');
        doc.setFillColor(30, 58, 95);
        doc.rect(margin, y, pageW - margin * 2, 30, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text('TOTAL CONTRACT AMOUNT', margin + 10, y + 20);
        const totalStr = `$${Number(totalForPdf ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        doc.text(totalStr, pageW - margin - 10, y + 20, { align: 'right' });
        y += 30;
      }

      // ── Customer Acceptance ─────────────────────────────────────────────────
      y = startSection(y, 'Customer Acceptance', 300);

      // Customer info
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(120, 130, 150);
      doc.text('CUSTOMER', margin, y);
      doc.text('ADDRESS', margin + 210, y);
      doc.text('CONTACT', margin + 390, y);
      y += 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(25, 25, 25);
      doc.text(custName, margin, y);
      doc.text(fullQuote.customer?.address ?? '', margin + 210, y);
      doc.text(fullQuote.customer?.phone ?? '', margin + 390, y);
      y += 14;
      doc.text(cityStateZip, margin + 210, y);
      if (fullQuote.customer?.email) doc.text(fullQuote.customer.email, margin + 390, y);
      y += 20;

      doc.setDrawColor(210, 218, 232);
      doc.setLineWidth(0.75);
      doc.line(margin, y, pageW - margin, y);
      y += 16;

      // Agreement text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(50, 55, 65);
      const agreementLines = doc.splitTextToSize(
        `By signing below, I, ${custName} ("Customer"), acknowledge that I have reviewed and agreed to the terms of the proposal presented by ${companyName} and authorize the work described therein to proceed. I understand this constitutes a binding agreement upon both parties' signatures.`,
        pageW - margin * 2
      );
      doc.text(agreementLines, margin, y);
      y += agreementLines.length * 14 + 20;

      // Customer signature box
      doc.setFillColor(248, 249, 252);
      doc.roundedRect(margin, y, pageW - margin * 2, 118, 4, 4, 'F');
      doc.setDrawColor(210, 218, 232);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, y, pageW - margin * 2, 118, 4, 4, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 130);
      doc.text('CUSTOMER SIGNATURE', margin + 14, y + 16);
      if (fullQuote.signature_data) addSigImage(fullQuote.signature_data, margin + 14, y + 20);
      doc.setDrawColor(150, 155, 165);
      doc.setLineWidth(0.75);
      doc.line(margin + 14, y + 74, margin + 240, y + 74);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(40, 42, 48);
      doc.text(fullQuote.signed_by ?? custName, margin + 14, y + 86);
      doc.setTextColor(110, 115, 130);
      doc.setFontSize(8);
      // Gate the signed date on the signature itself, not on signed_at. A
      // signed_at with no signature_data printed "Signed: <date>" under an
      // empty box, which reads as a broken render rather than an unsigned doc.
      if (fullQuote.signature_data && fullQuote.signed_at) {
        doc.text(`Signed: ${new Date(fullQuote.signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, margin + 14, y + 99);
      } else if (!fullQuote.signature_data) {
        doc.text('Not yet signed', margin + 14, y + 99);
      }
      y += 134;

      drawFooter(`${quoteNo}  |  ${companyName}`);

      // ── 3-Day Right to Cancel ──────────────────────────────────────────────
      if (fullQuote.include_cancel_notice) {
        doc.addPage();
        pageCount++;
        y = drawPageHeader('3-Day Right to Cancel');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(50, 55, 65);

        const cancelParas = [
          'NOTICE OF RIGHT TO CANCEL',
          '',
          `Customer Name: ${custName}`,
          `Address: ${fullQuote.customer?.address ?? ''}, ${cityStateZip}`,
          `Date of Transaction: ${fullQuote.signed_at ? new Date(fullQuote.signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}`,
          '',
          'YOU MAY CANCEL THIS TRANSACTION, WITHOUT PENALTY OR OBLIGATION, WITHIN THREE BUSINESS DAYS FROM THE ABOVE DATE.',
          '',
          'If you cancel, any property traded in, any payments made by you under the contract or sale, and any negotiable instrument executed by you will be returned within 10 business days following receipt by the seller of your cancellation notice, and any security interest arising out of the transaction will be cancelled.',
          '',
          'If you cancel, you must make available to the seller at your residence, in substantially as good condition as when received, any goods delivered to you under this contract or sale.',
          '',
          `To cancel this transaction, contact: ${companyName}${company?.phone ? ' — ' + company.phone : ''}${company?.email ? ' — ' + company.email : ''}`,
          '',
          'NOT LATER THAN MIDNIGHT OF THE THIRD BUSINESS DAY AFTER THE DATE OF THIS TRANSACTION.',
        ];

        for (const para of cancelParas) {
          const lines = doc.splitTextToSize(para, pageW - margin * 2);
          if (para === 'NOTICE OF RIGHT TO CANCEL') { doc.setFont('helvetica', 'bold'); } else { doc.setFont('helvetica', 'normal'); }
          doc.text(lines, margin, y);
          y += lines.length * 13 + (para === '' ? -6 : 2);
          if (y > pageH - 170) break;
        }

        y = Math.max(y + 16, pageH - 160);

        doc.setFillColor(248, 249, 252);
        doc.roundedRect(margin, y, pageW - margin * 2, 132, 4, 4, 'F');
        doc.setDrawColor(210, 218, 232);
        doc.setLineWidth(0.5);
        doc.roundedRect(margin, y, pageW - margin * 2, 132, 4, 4, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 110, 130);
        doc.text('ACKNOWLEDGMENT OF RECEIPT', margin + 14, y + 16);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(130, 135, 145);
        const ackNote = doc.splitTextToSize('I acknowledge receipt of this Notice of Right to Cancel. This signature does NOT constitute cancellation of the contract.', pageW - margin * 2 - 28);
        doc.text(ackNote, margin + 14, y + 27);
        if (fullQuote.cancel_signature_data) addSigImage(fullQuote.cancel_signature_data, margin + 14, y + 36);
        doc.setDrawColor(150, 155, 165);
        doc.setLineWidth(0.75);
        doc.line(margin + 14, y + 88, margin + 240, y + 88);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(40, 42, 48);
        doc.text(fullQuote.signed_by ?? custName, margin + 14, y + 100);
        doc.setTextColor(110, 115, 130);
        doc.setFontSize(8);
        if (fullQuote.cancel_signed_at) doc.text(`Acknowledged: ${new Date(fullQuote.cancel_signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, margin + 14, y + 113);

        drawFooter(`${quoteNo}  |  ${companyName}`);
      }

      // ── Contractor Authorization ───────────────────────────────────────────
      if (fullQuote.contractor_signed_at) {
        y = startSection(y, 'Contractor Authorization', 300);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(50, 55, 65);
        const authLines = doc.splitTextToSize(
          `I, ${fullQuote.contractor_signed_by ?? company?.name ?? ''}, on behalf of ${companyName}, hereby accept and authorize this project for ${custName}. By signing below, I confirm that ${companyName} agrees to perform the work as described in ${quoteNo} in a professional manner in accordance with industry standards and applicable codes.`,
          pageW - margin * 2
        );
        doc.text(authLines, margin, y);
        y += authLines.length * 14 + 20;

        doc.setDrawColor(210, 218, 232);
        doc.setLineWidth(0.75);
        doc.line(margin, y, pageW - margin, y);
        y += 20;

        doc.setFillColor(248, 249, 252);
        doc.roundedRect(margin, y, pageW - margin * 2, 118, 4, 4, 'F');
        doc.setDrawColor(210, 218, 232);
        doc.setLineWidth(0.5);
        doc.roundedRect(margin, y, pageW - margin * 2, 118, 4, 4, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 110, 130);
        doc.text('CONTRACTOR SIGNATURE', margin + 14, y + 16);
        if (fullQuote.contractor_signature_data) addSigImage(fullQuote.contractor_signature_data, margin + 14, y + 20);
        doc.setDrawColor(150, 155, 165);
        doc.setLineWidth(0.75);
        doc.line(margin + 14, y + 74, margin + 240, y + 74);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(40, 42, 48);
        doc.text(fullQuote.contractor_signed_by ?? companyName, margin + 14, y + 86);
        doc.text(companyName, margin + 14, y + 99);
        doc.setTextColor(110, 115, 130);
        doc.setFontSize(8);
        if (fullQuote.contractor_signed_at) doc.text(`Signed: ${new Date(fullQuote.contractor_signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, margin + 14, y + 111);
        y += 136;

        // Only claim full execution when the customer actually signed. This
        // banner used to render off contractor_signed_at alone, producing a
        // PDF that asserted "Agreement Fully Executed" above an empty customer
        // signature box — and that document gets emailed to the homeowner.
        const customerHasSigned = !!fullQuote.signature_data;
        doc.setFillColor(...(customerHasSigned ? [230, 238, 255] : [255, 244, 224]) as [number, number, number]);
        doc.roundedRect(margin, y, pageW - margin * 2, 48, 4, 4, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...(customerHasSigned ? [30, 58, 95] : [146, 64, 14]) as [number, number, number]);
        doc.text(
          customerHasSigned ? 'Agreement Fully Executed' : 'Awaiting Customer Signature',
          margin + 14, y + 18
        );
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60, 70, 90);
        doc.text(
          `Customer signed: ${customerHasSigned && fullQuote.signed_at ? new Date(fullQuote.signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not signed'}   |   Contractor signed: ${fullQuote.contractor_signed_at ? new Date(fullQuote.contractor_signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}`,
          margin + 14, y + 34
        );

        drawFooter(`${quoteNo}  |  ${companyName}`);
      }

      openOrSavePdf(doc, `Signed-Quote-${fullQuote.quote_number ?? 'document'}.pdf`, mode);
    } catch (err: any) {
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingPdf(null);
    }
  };

  // ── Quick-view: load + open a signed doc directly from the Step 1 quote list ──
  const handleQuickViewDoc = async (quote: any, docType: 'retail' | 'contingency' | 'cert') => {
    setQuickViewLoading(`${quote.id}:${docType}`);
    try {
      const [{ data: fq }, { data: photoRows }] = await Promise.all([
        supabase
          .from('quotes')
          .select(`*, customer:customers(id, first_name, last_name, email, phone, address, city, state, zip)`)
          .eq('id', quote.id)
          .single(),
        supabase
          .from('quote_photos')
          .select('id, photo_url, caption, damage_type, damage_cause, location, notes, sort_order')
          .eq('quote_id', quote.id)
          .order('sort_order'),
      ]);
      if (!fq) { toast.error('Could not load document'); return; }
      setFullQuote(fq);
      setCertPhotos(photoRows ?? []);
      setSelectedQuote(quote);
      setPendingQuickView(docType);
    } catch {
      toast.error('Failed to load document');
    } finally {
      setQuickViewLoading(null);
    }
  };

  // Fires after fullQuote state update lands — triggers the appropriate view
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pendingQuickView || !fullQuote) return;
    const action = pendingQuickView;
    setPendingQuickView(null);
    if (action === 'cert') setShowCertPreview(true);
    else if (action === 'retail') handleRetailSignedPdf('view');
    else handleContingencyPdf('view');
  }, [pendingQuickView, fullQuote]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Share: copy certificate link to clipboard ──────────────────────────────
  const handleCopyCertLink = async () => {
    if (!fullQuote?.share_token) { toast.error('No certificate link available'); return; }
    try {
      await navigator.clipboard.writeText(certUrl(fullQuote.share_token));
      toast.success('Certificate link copied to clipboard');
    } catch {
      toast.error('Failed to copy — use the View button instead');
    }
  };

  // ── Manager one-off tool: share a digital copy of the 3-Day Right to Cancel
  //    notice for e-signature. Separate from the normal quote/contingency
  //    flow — owners/admins only, and off by default per quote until this
  //    runs. See standalone_cancel_share_enabled migration for the rationale. ──
  const handleShareCancelNotice = async () => {
    if (!fullQuote?.share_token) { toast.error('No share link available for this quote'); return; }
    setSharingCancelNotice(true);
    try {
      const { error } = await supabase
        .from('quotes')
        .update({
          standalone_cancel_share_enabled: true,
          standalone_cancel_sent_at: new Date().toISOString(),
          standalone_cancel_sent_by: currentUserId || null,
        })
        .eq('id', fullQuote.id);
      if (error) throw error;
      setFullQuote((prev: any) => prev ? {
        ...prev,
        standalone_cancel_share_enabled: true,
        standalone_cancel_sent_at: new Date().toISOString(),
      } : prev);
      await navigator.clipboard.writeText(cancelNoticeUrl(fullQuote.share_token));
      toast.success('Digital cancel-notice link copied to clipboard');
    } catch {
      toast.error('Failed to share the digital cancel notice');
    } finally {
      setSharingCancelNotice(false);
    }
  };

  // ── Invoice editor ─────────────────────────────────────────────────────────
  const handleOpenInvoiceEditor = () => {
    if (!invoice) return;
    setEditingDueDate(invoice.due_date ? String(invoice.due_date).split('T')[0] : '');
    setPaymentMethod('check');
    setPaymentDate(toLocalDateString());
    const total = invoiceLineItems.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    setPaymentAmount(total.toFixed(2));
    setPaymentNotes('');
    setStep('invoice_editor');
  };

  const handleSaveInvoiceDueDate = async () => {
    if (!invoice) return;
    setSavingInvoice(true);
    try {
      const { error } = await supabase.from('invoices').update({ due_date: editingDueDate || null }).eq('id', invoice.id);
      if (error) throw error;
      setInvoice((prev: any) => ({ ...prev, due_date: editingDueDate || null }));
      toast.success('Due date saved');
    } catch {
      toast.error('Could not save due date');
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!invoice) return;
    setMarkingPaid(true);
    try {
      const paidAt = paymentDate
        ? new Date(paymentDate + 'T12:00:00').toISOString()
        : new Date().toISOString();
      const { error } = await supabase.from('invoices').update({ status: 'paid', paid_at: paidAt }).eq('id', invoice.id);
      if (error) throw error;
      setInvoice((prev: any) => ({ ...prev, status: 'paid', paid_at: paidAt }));
      toast.success('Invoice marked as paid');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update invoice');
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleUnmarkPaid = async () => {
    if (!invoice) return;
    try {
      const { error } = await supabase.from('invoices').update({ status: 'sent', paid_at: null }).eq('id', invoice.id);
      if (error) throw error;
      setInvoice((prev: any) => ({ ...prev, status: 'sent', paid_at: null }));
      toast.success('Payment status reverted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

  // ── Completion Certificate: show signed copy in-app ──────────────────────────
  const handleViewSignedCertificate = () => {
    if (!fullQuote?.certificate_customer_signed_at) { toast.error('Certificate has not been signed yet'); return; }
    setShowCertPreview(true);
  };

  // ── Share signed documents via email ──────────────────────────────────────
  const handleShareDocsByEmail = async () => {
    const email = shareEmail.trim();
    if (!email || !email.includes('@')) { toast.error('Enter a valid email address'); return; }
    if (!fullQuote?.share_token) { toast.error('No share link available for this quote'); return; }
    setSendingShareEmail(true);
    try {
      const qUrl = quoteUrl(fullQuote.share_token);
      const cUrl = fullQuote.certificate_customer_signed_at ? certUrl(fullQuote.share_token) : undefined;
      const custName = `${fullQuote.customer?.first_name ?? ''} ${fullQuote.customer?.last_name ?? ''}`.trim();
      const { error } = await supabase.functions.invoke('send-quote-email', {
        body: {
          company_id: company.id,
          to_email: email,
          from_company: company.name,
          quote_number: fullQuote.quote_number,
          quote_url: qUrl,
          ...(cUrl ? { certificate_url: cUrl } : {}),
          email_subject: `Signed Documents — ${fullQuote.quote_number} from ${company.name}`,
          email_message: `Hi,\n\nPlease find the signed documents for ${custName ? 'customer ' + custName + ' — ' : ''}project ${fullQuote.quote_number} below.\n\nThank you,\n${company.name}`,
        },
      });
      if (error) throw error;
      toast.success(`Documents sent to ${email}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send email');
    } finally {
      setSendingShareEmail(false);
    }
  };

  // ── Derived doc statuses ───────────────────────────────────────────────────
  const isInsurance = !!q?.contingency_enabled;
  const contingencySigned = !!(q?.contingency_signed_at || q?.contingency_signature_data);
  const retailSigned = !isInsurance && !!(q?.signed_at || fullQuote?.signature_data);
  const cancelNoticeApplicable = isInsurance || !!fullQuote?.include_cancel_notice;
  const cancelSigned = isInsurance ? !!fullQuote?.contingency_cancel_signature_data : !!fullQuote?.cancel_signature_data;
  const certSent = !!q?.completion_certificate_sent_at;
  const certSigned = !!q?.certificate_customer_signed_at;
  const invoicePaid = !!invoice?.paid_at;
  const invoiceStatus = invoice?.status ?? null;

  const loading = loadingQuote || loadingInvoice;

  const formatCertDate = (iso: string | null | undefined) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' });
  };

  const certCustomerName = fullQuote?.customer
    ? `${fullQuote.customer.first_name} ${fullQuote.customer.last_name}`.trim()
    : customerName;

  return (
    <>
    {/* ── Signed Certificate In-App Preview Modal ─────────────────────────────
         Portaled straight to document.body: this modal renders inline inside
         the authenticated dashboard tree, and printing treats position:fixed
         as normal document flow rather than a viewport overlay — so without
         the portal, the dashboard behind it (other customers' names/phone/
         email) printed above the certificate. As a genuine direct child of
         body, print can now hide every other sibling with one plain rule
         instead of a visibility cascade over the whole page — the earlier
         cascade toggled every node's visibility including the signature
         images and intermittently dropped the customer's from the printed
         output. ── */}
    {showCertPreview && fullQuote && createPortal(
      <div className="cert-print-modal fixed inset-0 z-[60] bg-gray-50 flex flex-col overflow-hidden print:bg-white">
        <style>{`
          @media print {
            .no-print { display: none !important; }
            .print-only { display: flex !important; }
            body { background: white !important; }
            body > *:not(.cert-print-modal) { display: none !important; }

            /* The modal is a viewport-sized overlay: position:fixed, inset-0,
               overflow-hidden, wrapping a flex-1 overflow-y-auto scroller. That
               is right on screen and fatal in print — print has no viewport to
               pin to, so the fixed box collapses and the inner scroller clips
               its content away, which produced a completely blank sheet. Unwind
               all of it so the certificate lays out as ordinary flowing content
               and can run onto a second page. */
            html, body { height: auto !important; overflow: visible !important; }
            .cert-print-modal {
              position: static !important;
              display: block !important;
              height: auto !important;
              max-height: none !important;
              overflow: visible !important;
            }
            .cert-print-scroll {
              flex: none !important;
              height: auto !important;
              max-height: none !important;
              overflow: visible !important;
            }

            /* Photos run past the first sheet once the certificate paginates,
               and a page boundary was slicing straight through them.
               break-inside is unreliable on grid items — Chrome's fragmentation
               support inside CSS Grid is patchy, which is why the emailed
               version of this certificate lays its photos out in a table. Drop
               out of grid for print and use inline-block cells, which fragment
               predictably, so each photo stays whole with its caption. */
            .cert-photos-grid {
              display: block !important;
            }
            .cert-photo-cell {
              display: inline-block !important;
              width: 31% !important;
              vertical-align: top !important;
              margin: 0 1% 10px 0 !important;
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            /* Clear of the top edge, so a row landing at the head of a page is
               not pressed against the trim. */
            .cert-photos-section {
              padding-top: 8mm !important;
            }
          }
          .print-only { display: none; }
        `}</style>

        {/* Header */}
        <div className="no-print bg-[#1e3a5f] text-white px-4 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCertPreview(false)}
              className="text-blue-300 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="h-9 object-contain bg-white/10 rounded-lg p-1 flex-shrink-0" />
            ) : null}
            <div>
              <p className="text-blue-200 text-xs uppercase tracking-wider">Certificate of Completion</p>
              <h1 className="font-bold text-base leading-tight">{certCustomerName}</h1>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-colors flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            Print / Save PDF
          </button>
        </div>

        <div className="cert-print-scroll flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

            {/* Signed confirmation banner */}
            <div className="no-print bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-800 text-sm">Certificate Signed</p>
                <p className="text-xs text-green-700">
                  Signed by {certCustomerName} on {formatCertDate(fullQuote.certificate_customer_signed_at)}.
                  Use Print / Save PDF above to save a copy for your records.
                </p>
              </div>
            </div>

            {/* Certificate document */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:rounded-none print:shadow-none print:border-0">

              {/* Print-only company header */}
              <div className="print-only items-start justify-between gap-4 px-6 pt-6 pb-5 mb-1 border-l-4 border-[#1e3a5f] bg-gradient-to-r from-[#1e3a5f]/5 to-transparent">
                <div className="flex-shrink-0">
                  {company.logo_url ? (
                    <img src={company.logo_url} alt={company.name} style={{ maxWidth: 180, maxHeight: 70, objectFit: 'contain' }} />
                  ) : (
                    <span className="text-xl font-bold text-[#1e3a5f]">{company.name}</span>
                  )}
                </div>
                <div className="text-right text-sm">
                  <p className="font-bold text-[#1e3a5f] text-lg leading-tight">{company.name}</p>
                  {company.address && <p className="text-gray-500 text-xs mt-0.5">{company.address}</p>}
                  {(company.city || company.state) && (
                    <p className="text-gray-500 text-xs">{[company.city, company.state, company.zip].filter(Boolean).join(', ')}</p>
                  )}
                  {company.phone && <p className="text-gray-500 text-xs">{company.phone}</p>}
                  {company.email && <p className="text-gray-500 text-xs">{company.email}</p>}
                </div>
              </div>

              {/* Certificate header */}
              <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3">
                <Award className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-bold text-gray-900">Certificate of Completion</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Prepared for <strong>{certCustomerName}</strong>
                    {fullQuote.contractor_signed_at && (
                      <> · Completion Date: <strong>{formatCertDate(fullQuote.contractor_signed_at)}</strong></>
                    )}
                  </p>
                </div>
              </div>

              <div className="px-6 py-5 space-y-5">

                {/* Contractor certifies section */}
                <div className="border border-gray-200 rounded-xl p-4">
                  <p className="font-semibold text-sm text-gray-800 mb-3">
                    {company.name} hereby certifies that:
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700">
                    {[
                      'All work specified in the Customer Service Agreement has been completed in accordance with its terms and conditions.',
                      'All work has been performed in a workmanlike manner and in accordance with applicable industry standards and building codes.',
                      'All materials used in the performance of the work are of good quality and suitable for their intended purpose.',
                      'The work site has been cleaned and left in a safe and orderly condition.',
                      'All required permits and inspections have been obtained and completed.',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Customer acknowledgment section */}
                <div className="px-1">
                  <p className="font-semibold text-sm text-gray-800 mb-3">
                    By signing below, <strong>{certCustomerName}</strong> acknowledges that:
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700">
                    {[
                      'All work described in the Customer Service Agreement has been completed to my satisfaction.',
                      'I have inspected the completed work and found it to be satisfactory.',
                      'I have no outstanding complaints or concerns regarding the quality of work performed.',
                      'I understand that by signing this Certificate, I release the Contractor from further obligations, except as provided in the warranty section of the original agreement.',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Completion photos */}
                {certPhotos.length > 0 && (
                  <div className="cert-photos-section border-t border-gray-100 pt-5">
                    <p className="font-semibold text-sm text-gray-800 mb-3">Completion Photos</p>
                    <div className="cert-photos-grid grid grid-cols-2 sm:grid-cols-3 gap-3 print:grid-cols-3">
                      {certPhotos.map((photo) => (
                        <div key={photo.id} className="cert-photo-cell space-y-1">
                          <img
                            src={photo.photo_url}
                            alt={photo.caption || 'Completion photo'}
                            className="w-full aspect-square object-cover rounded-lg border border-gray-200 print:rounded-none"
                          />
                          {photo.caption && (
                            <p className="text-xs text-gray-500 leading-tight">{photo.caption}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Signature blocks */}
                <div className="border-t border-gray-100 pt-5 grid grid-cols-2 gap-6">
                  {/* Contractor */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contractor</p>
                    {fullQuote.contractor_signature_data ? (
                      <img
                        src={fullQuote.contractor_signature_data}
                        alt="Contractor signature"
                        className="h-16 max-w-full border border-gray-200 rounded-lg bg-gray-50 p-1.5 object-contain mb-2"
                      />
                    ) : (
                      <div className="h-16 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center mb-2">
                        <p className="text-xs font-semibold text-gray-400">{company.name}</p>
                      </div>
                    )}
                    <p className="font-semibold text-gray-800 text-sm">{fullQuote.contractor_signed_by || company.name}</p>
                    <p className="text-xs text-gray-500">{company.name}</p>
                    {company.license_number && (
                      <p className="text-xs text-gray-400">License #{company.license_number}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{formatCertDate(fullQuote.contractor_signed_at)}</p>
                  </div>

                  {/* Customer */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Customer</p>
                    {fullQuote.certificate_customer_signature_data ? (
                      <img
                        src={fullQuote.certificate_customer_signature_data}
                        alt="Customer signature"
                        className="h-16 max-w-full border border-gray-200 rounded-lg bg-gray-50 p-1.5 object-contain mb-2"
                      />
                    ) : (
                      <div className="h-16 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center mb-2">
                        <p className="text-xs text-gray-400">Awaiting signature</p>
                      </div>
                    )}
                    <p className="font-semibold text-gray-800 text-sm">{certCustomerName}</p>
                    <p className="text-xs text-gray-500">Customer</p>
                    {fullQuote.certificate_customer_signed_at && (
                      <p className="text-xs text-gray-400 mt-1">{formatCertDate(fullQuote.certificate_customer_signed_at)}</p>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}

    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="bg-[#1e3a5f] px-6 py-5 flex items-start justify-between shrink-0">
          <div className="flex items-start gap-3">
            {(step !== 'select_quote' || customerJobs) && (
              <button
                onClick={() => {
                  if (step === 'configure_contingency' || step === 'invoice_editor') setStep('view_documents');
                  // Back out of a customer's job list to the customer list,
                  // rather than jumping the whole way out of the picker.
                  else if (step === 'select_quote') setCustomerJobs(null);
                  else { setStep('select_quote'); setCustomerJobs(null); }
                }}
                className="text-blue-300 hover:text-white transition-colors mt-0.5"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <p className="text-blue-300 text-xs uppercase tracking-wider mb-1">Documents</p>
              <h2 className="text-white text-lg font-bold">
                {step === 'select_quote' ? 'Select Customer'
                  : step === 'configure_contingency' ? 'Contingency Agreement'
                  : step === 'invoice_editor' ? 'Edit Invoice'
                  : customerName}
              </h2>
              {q && (step === 'view_documents' || step === 'configure_contingency') && (
                <p className="text-blue-200 text-sm mt-0.5">
                  {step === 'configure_contingency' ? `${customerName} · ${q.quote_number}` : q.quote_number}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-blue-300 hover:text-white transition-colors mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step bar */}
        <div className="flex shrink-0 border-b border-gray-100">
          {(['select_quote', 'view_documents'] as const).map((s, i) => {
            const idx = ['select_quote', 'view_documents'].indexOf(
              (step === 'configure_contingency' || step === 'invoice_editor') ? 'view_documents' : step
            );
            return (
              <div key={s} className={`flex-1 h-1 ${i === idx ? 'bg-[#ff6b35]' : i < idx ? 'bg-[#1e3a5f]' : 'bg-gray-100'} transition-colors`} />
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Pick the customer ──────────────────────────────────
               One question per screen: who is this for. The signed/unsigned
               filter and the per-row quick-view buttons that used to live here
               belonged to step 2 — they asked you to judge documents before you
               had chosen a person. ── */}
          {step === 'select_quote' && customerJobs && (
            <div className="px-6 py-6 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-1">
                Jobs for {customerJobs[0]?.customer
                  ? `${customerJobs[0].customer.first_name ?? ''} ${customerJobs[0].customer.last_name ?? ''}`.trim()
                  : 'this customer'}
              </p>
              {customerJobs.map(job => (
                <button
                  key={job.id}
                  onClick={() => void handleSelectQuote(job)}
                  className="w-full flex items-center gap-4 p-4 text-left rounded-xl border border-gray-200 hover:border-[#1e3a5f]/40 transition-colors"
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {job.cover_page_title || job.project_description || job.quote_number}
                    </p>
                    <p className="text-xs text-gray-500">
                      {job.quote_number}
                      {job.created_at ? ` · ${new Date(job.created_at).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {step === 'select_quote' && !customerJobs && (
            <div className="px-6 py-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search customers…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none text-sm"
                />
              </div>

              {alphabeticalCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="w-10 h-10 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500">
                    {search ? 'No customers match your search.' : 'No customers with documents yet.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {recentCustomers.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-1">Recent</p>
                      {recentCustomers.map(c => (
                        <CustomerRow key={`recent-${c.id}`} group={c} onPick={handlePickCustomer} />
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    {recentCustomers.length > 0 && (
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-1">All customers</p>
                    )}
                    {alphabeticalCustomers.map(c => (
                      <CustomerRow
                        key={c.id}
                        group={c}
                        dimmed={recentIds.has(c.id)}
                        onPick={handlePickCustomer}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Document hub ── */}
          {step === 'view_documents' && (
            loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
              <DocAccordion.Provider value={{ open: openDoc, setOpen: setOpenDoc }}>
              <div>

                {/* ══ Original Document ════════════════════════════════════ */}
                <SectionHeader label="Original Document" />

                {/* ── Original Sent Document ── */}
                <DocRow
                  icon={<ExternalLink className="w-4 h-4 text-[#1e3a5f]" />}
                  label={q?.project_type === 'inspection_report' ? 'Inspection Report' : 'Quote / Proposal'}
                  status={q?.sent_at ? 'sent' : 'unsigned'}
                  statusLabel={q?.sent_at ? 'Sent to Customer' : 'Not Yet Sent'}
                >
                  {q?.sent_at ? (
                    <div className="flex flex-wrap gap-2">
                      <ActionBtn
                        variant="primary"
                        onClick={() => handleFullDocPdf('view')}
                        disabled={!!generatingPdf}
                        icon={generatingPdf === 'full-view' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                        label="View Full Document"
                      />
                      <ActionBtn
                        onClick={() => handleFullDocPdf('download')}
                        disabled={!!generatingPdf}
                        icon={generatingPdf === 'full-download' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        label="Download PDF"
                      />
                      {q?.share_token && (
                        <ActionBtn
                          onClick={() => window.open(quoteUrl(q.share_token), '_blank')}
                          icon={<ExternalLink className="w-3 h-3" />}
                          label="View Live"
                        />
                      )}
                      {certPhotos.length > 0 && (
                        <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none px-1">
                          <input
                            type="checkbox"
                            checked={includeFullDocPhotos}
                            onChange={e => setIncludeFullDocPhotos(e.target.checked)}
                            className="w-3.5 h-3.5 rounded accent-[#1e3a5f]"
                          />
                          Include photos
                        </label>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">Document has not been sent yet.</p>
                  )}
                </DocRow>

                {/* ══ Signed Agreements ════════════════════════════════════ */}
                <SectionHeader label="Signed Agreements" />

                {/* ── Signed Quote ── */}
                <DocRow
                  icon={<FileText className="w-4 h-4 text-blue-600" />}
                  label="Signed Quote"
                  // "Fully Executed" requires BOTH parties. It used to key off
                  // contractor_signed_at alone, so a quote the customer never
                  // signed showed a green "Fully Executed" badge directly above
                  // the row's own "Customer has not yet signed this quote."
                  status={
                    isInsurance ? 'na'
                    : (retailSigned && fullQuote?.contractor_signed_at) ? 'complete'
                    : (retailSigned || fullQuote?.contractor_signed_at) ? 'sent'
                    : 'unsigned'
                  }
                  statusLabel={
                    isInsurance ? 'Not Applicable'
                    : (retailSigned && fullQuote?.contractor_signed_at) ? 'Fully Executed'
                    : retailSigned ? 'Customer Signed'
                    : fullQuote?.contractor_signed_at ? 'Awaiting Customer'
                    : 'Not Signed'
                  }
                  dimmed={isInsurance}
                >
                  {!isInsurance && retailSigned && (
                    <div className="flex flex-wrap gap-2">
                      <ActionBtn
                        variant="primary"
                        onClick={() => handleRetailSignedPdf('view')}
                        disabled={!!generatingPdf}
                        icon={generatingPdf === 'retail-view' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                        label="View Signed"
                      />
                      <ActionBtn
                        onClick={() => handleRetailSignedPdf('download')}
                        disabled={!!generatingPdf}
                        icon={generatingPdf === 'retail' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        label="Download PDF"
                      />
                    </div>
                  )}
                  {!isInsurance && !retailSigned && (
                    <p className="text-xs text-gray-400">
                      {q?.signed_at ? 'Loading signature…' : 'Customer has not yet signed this quote.'}
                    </p>
                  )}
                </DocRow>

                {/* ── Inspection Photo Report ──
                    Always listed. The photos exist from the inspection onward,
                    so this does not wait on a signature the way the documents
                    around it do; it just says so when there are none yet. */}
                <DocRow
                  icon={<Camera className="w-4 h-4 text-emerald-500" />}
                  label="Inspection Photo Report"
                  status={loading || certPhotos.length === 0 ? 'na' : 'complete'}
                  statusLabel={loading ? 'Loading…' : certPhotos.length > 0 ? `${certPhotos.length} photo${certPhotos.length === 1 ? '' : 's'}` : 'No Photos'}
                  dimmed={!loading && certPhotos.length === 0}
                >
                  {/* The photo list starts empty and fills in, so without this
                      loading branch the row tells you a quote has no photos for
                      as long as the fetch takes. */}
                  {loading ? (
                    <p className="text-xs text-gray-400 flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading photos…
                    </p>
                  ) : certPhotos.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      <ActionBtn
                        variant="primary"
                        onClick={() => handlePhotoReportPdf('view')}
                        disabled={!!generatingPdf}
                        icon={generatingPdf === 'photos-view' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                        label="View Report"
                      />
                      <ActionBtn
                        onClick={() => handlePhotoReportPdf('download')}
                        disabled={!!generatingPdf}
                        icon={generatingPdf === 'photos-download' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        label="Download PDF"
                      />
                      <ActionBtn
                        onClick={() => handlePhotoReportPdf('share')}
                        disabled={!!generatingPdf}
                        icon={generatingPdf === 'photos-share' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                        label="Copy Link"
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">
                      No photos have been added to this quote yet.
                    </p>
                  )}
                </DocRow>

                {/* ── Contingency Agreement ── */}
                <DocRow
                  icon={<Shield className="w-4 h-4 text-indigo-500" />}
                  label="Contingency Agreement"
                  status={!isInsurance ? 'na' : contingencySigned ? 'complete' : 'unsigned'}
                  statusLabel={!isInsurance ? 'Not Applicable' : contingencySigned ? 'Signed' : 'Not Signed'}
                  dimmed={!isInsurance}
                >
                  {isInsurance && (
                    <div className="flex flex-wrap gap-2">
                      <ActionBtn
                        variant="primary"
                        onClick={() => handleContingencyPdf('view')}
                        disabled={!!generatingPdf}
                        icon={generatingPdf === 'contingency-view' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                        label={contingencySigned ? 'View Signed' : 'Preview'}
                      />
                      {contingencySigned && (
                        <ActionBtn
                          onClick={() => handleContingencyPdf('download')}
                          disabled={!!generatingPdf}
                          icon={generatingPdf === 'contingency' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                          label="Download PDF"
                        />
                      )}
                      <ActionBtn
                        onClick={() => setStep('configure_contingency')}
                        icon={<Send className="w-3 h-3" />}
                        label={contingencySigned ? 'Resend' : 'Send to Customer'}
                      />
                    </div>
                  )}
                </DocRow>

                {/* ── 3-Day Right to Cancel ── */}
                <DocRow
                  icon={<FileText className="w-4 h-4 text-blue-500" />}
                  label="3-Day Right to Cancel"
                  status={!cancelNoticeApplicable ? 'na' : cancelSigned ? 'complete' : 'unsigned'}
                  statusLabel={!cancelNoticeApplicable ? 'Not Included' : cancelSigned ? 'Acknowledged' : 'Not Signed'}
                  dimmed={!cancelNoticeApplicable}
                >
                  {cancelNoticeApplicable && (
                    <p className="text-xs text-gray-400">
                      {cancelSigned
                        ? (isInsurance ? 'Included in the Contingency Agreement PDF.' : 'Included in the Signed Quote PDF.')
                        : (isInsurance ? 'Sent alongside the Contingency Agreement — not yet acknowledged.' : 'Included with quote — not yet acknowledged by customer.')}
                    </p>
                  )}
                </DocRow>

                {/* ── 3-Day Right to Cancel — Digital Copy (owner/admin only, one-off use) ── */}
                {canShareCancelNotice && (
                  <DocRow
                    icon={<Send className="w-4 h-4 text-indigo-500" />}
                    label="3-Day Right to Cancel — Digital Copy"
                    status={q?.standalone_cancel_signed_at ? 'complete' : q?.standalone_cancel_share_enabled ? 'sent' : 'none'}
                    statusLabel={q?.standalone_cancel_signed_at ? 'Signed' : q?.standalone_cancel_share_enabled ? 'Awaiting Signature' : 'Not Shared'}
                  >
                    <p className="text-xs text-gray-400 mb-2">
                      Owner/admin-only. The standard cancel notice stays paper-only — use this only for a one-off
                      situation where you need this specific customer's signature electronically.
                    </p>
                    {q?.standalone_cancel_signed_at && (
                      <p className="text-xs text-gray-500 mb-2">
                        Signed by {q.standalone_cancel_signed_by} on {formatCertDate(q.standalone_cancel_signed_at)}.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <ActionBtn
                        variant={!q?.standalone_cancel_share_enabled ? 'primary' : 'ghost'}
                        onClick={handleShareCancelNotice}
                        disabled={sharingCancelNotice}
                        icon={sharingCancelNotice ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        label={
                          sharingCancelNotice
                            ? 'Sharing…'
                            : q?.standalone_cancel_share_enabled
                              ? 'Copy Link Again'
                              : 'Share Digital Copy'
                        }
                      />
                      {q?.standalone_cancel_share_enabled && (
                        <ActionBtn
                          onClick={() => window.open(cancelNoticeUrl(q.share_token), '_blank')}
                          icon={<Eye className="w-3 h-3" />}
                          label="View"
                        />
                      )}
                    </div>
                  </DocRow>
                )}

                {/* ══ Post-Completion ══════════════════════════════════════ */}
                <SectionHeader label="Post-Completion" />

                {/* ── Completion Certificate ── */}
                <DocRow
                  icon={<Award className="w-4 h-4 text-amber-500" />}
                  label="Completion Certificate"
                  status={certSigned ? 'complete' : certSent ? 'sent' : 'none'}
                  statusLabel={certSigned ? 'Signed' : certSent ? 'Awaiting Signature' : 'Not Sent'}
                >
                  <div className="flex flex-wrap gap-2">
                    {certSigned && (
                      <>
                        <ActionBtn
                          variant="primary"
                          onClick={handleViewSignedCertificate}
                          icon={<Eye className="w-3 h-3" />}
                          label="View Signed"
                        />
                        <ActionBtn
                          onClick={handleCopyCertLink}
                          icon={<Link className="w-3 h-3" />}
                          label="Copy Share Link"
                        />
                      </>
                    )}
                    <ActionBtn
                      variant={!certSent && !certSigned ? 'primary' : 'ghost'}
                      onClick={() => { onOpenCertPanel(fullQuote || selectedQuote); onClose(); }}
                      icon={<ExternalLink className="w-3 h-3" />}
                      label={certSigned ? 'Manage' : certSent ? 'Manage' : 'Send Certificate'}
                    />
                  </div>
                </DocRow>

                {/* ── Work Order ── */}
                <DocRow
                  icon={<ClipboardList className="w-4 h-4 text-blue-600" />}
                  label="Work Order"
                  status="none"
                  statusLabel="Generate"
                >
                  <div className="flex flex-wrap gap-2">
                    <ActionBtn
                      variant="primary"
                      onClick={() => { onOpenWorkOrderPanel(fullQuote || selectedQuote); onClose(); }}
                      icon={<ClipboardList className="w-3 h-3" />}
                      label="Generate Work Order"
                    />
                  </div>
                </DocRow>

                {/* ── Change Order ── */}
                <DocRow
                  icon={<FilePlus className="w-4 h-4 text-orange-500" />}
                  label="Change Order"
                  status={changeOrders.length > 0 ? 'complete' : 'none'}
                  statusLabel={changeOrders.length > 0 ? `${changeOrders.length} Item${changeOrders.length > 1 ? 's' : ''}` : 'None'}
                  dimmed={!invoice}
                >
                  {!invoice ? (
                    <p className="text-xs text-gray-400">No invoice linked — create an invoice first.</p>
                  ) : (
                    <div className="space-y-2">
                      {changeOrders.length > 0 && (
                        <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 text-xs">
                          {changeOrders.map((co: any) => (
                            <div key={co.id} className="flex items-center gap-2 px-3 py-2">
                              <span className="flex-1 text-gray-700 truncate">{co.description}</span>
                              <span className="font-semibold text-gray-900 shrink-0">
                                ${Number(co.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                              <button onClick={() => handleDeleteChangeOrder(co.id)} className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {showAddCo ? (
                        <div className="space-y-2 bg-orange-50 rounded-lg p-3 border border-orange-200">
                          <input
                            type="text"
                            placeholder='Description (e.g. "Gutter upgrade")'
                            value={newCoDesc}
                            onChange={e => setNewCoDesc(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-orange-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="Amount"
                              value={newCoAmount}
                              onChange={e => setNewCoAmount(e.target.value)}
                              className="flex-1 px-2.5 py-1.5 border border-orange-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                            />
                            <button
                              onClick={handleAddChangeOrder}
                              disabled={savingCo || !newCoDesc.trim() || !newCoAmount}
                              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                            >
                              {savingCo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              Save
                            </button>
                            <button onClick={() => setShowAddCo(false)} className="px-2 text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
                          </div>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <ActionBtn
                          onClick={() => setShowAddCo(v => !v)}
                          icon={<Plus className="w-3 h-3" />}
                          label="Add Item"
                        />
                        {changeOrders.length > 0 && (
                          <ActionBtn
                            onClick={handleDownloadChangeOrderPdf}
                            disabled={generatingPdf === 'co'}
                            icon={generatingPdf === 'co' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                            label="Download PDF"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </DocRow>

                {/* ── Invoice ── */}
                <DocRow
                  icon={<FileText className="w-4 h-4 text-blue-600" />}
                  label="Invoice"
                  status={invoicePaid ? 'complete' : invoiceStatus === 'sent' ? 'sent' : invoiceStatus === 'draft' ? 'unsigned' : 'none'}
                  statusLabel={invoicePaid ? 'Paid' : invoiceStatus === 'sent' ? 'Sent' : invoiceStatus === 'draft' ? 'Draft' : 'Not Created'}
                  dimmed={!invoice}
                >
                  {!invoice ? (
                    <p className="text-xs text-gray-400">No invoice found — create one from the Invoices section.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <ActionBtn
                        variant="primary"
                        onClick={handleOpenInvoiceEditor}
                        icon={<Pencil className="w-3 h-3" />}
                        label="Edit Invoice"
                      />
                      <ActionBtn
                        onClick={() => handleDownloadInvoicePdf('invoice')}
                        disabled={generatingPdf === 'invoice'}
                        icon={generatingPdf === 'invoice' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        label="Download PDF"
                      />
                    </div>
                  )}
                </DocRow>

                {/* ── Receipt ── */}
                <DocRow
                  icon={<Check className="w-4 h-4 text-green-600" />}
                  label="Receipt"
                  status={invoicePaid ? 'complete' : 'none'}
                  statusLabel={invoicePaid ? 'Available' : 'Not Available'}
                  dimmed={!invoicePaid}
                >
                  {invoicePaid && (
                    <ActionBtn
                      onClick={() => handleDownloadInvoicePdf('receipt')}
                      disabled={generatingPdf === 'receipt'}
                      icon={generatingPdf === 'receipt' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                      label="Download Receipt"
                    />
                  )}
                </DocRow>

              </div>
              </DocAccordion.Provider>

              {/* ── Pending documents summary ────────────────────────────────── */}
              {(() => {
                const pending: string[] = [];
                if (!isInsurance && !retailSigned && q?.signed_at) pending.push('Signed Quote (awaiting contractor sign-off)');
                if (!isInsurance && !retailSigned && !q?.signed_at) pending.push('Customer Agreement — not yet signed');
                if (isInsurance && !contingencySigned) pending.push('Contingency Agreement — not yet signed');
                if (!certSigned && !certSent && q?.status === 'signed') pending.push('Completion Certificate — not yet sent');
                if (!certSigned && certSent) pending.push('Completion Certificate — awaiting customer signature');
                if (!invoice) pending.push('Invoice — not yet created');
                if (invoice && !invoicePaid) pending.push('Invoice — payment not recorded');
                if (pending.length === 0) return null;
                return (
                  <div className="mx-4 mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <p className="text-xs font-semibold text-amber-800">
                        {pending.length} item{pending.length > 1 ? 's' : ''} need{pending.length === 1 ? 's' : ''} attention
                      </p>
                    </div>
                    <ul className="space-y-1">
                      {pending.map((item, i) => (
                        <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                          <span className="mt-0.5 shrink-0">·</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              {/* ── Share signed documents via email ────────────────────────── */}
              {fullQuote?.share_token && (
                <div className="mx-4 mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Share2 className="w-4 h-4 text-[#1e3a5f] shrink-0" />
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Share Documents via Email</p>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Send links to all signed documents for this project. Works for any email — insurance company, homeowner, adjuster, or colleague.
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="email"
                        placeholder={q?.customer?.email || 'recipient@example.com'}
                        value={shareEmail}
                        onChange={e => setShareEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleShareDocsByEmail()}
                        className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] bg-white"
                      />
                    </div>
                    <button
                      onClick={handleShareDocsByEmail}
                      disabled={sendingShareEmail || !shareEmail.trim()}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[#1e3a5f] text-white text-xs font-semibold rounded-lg hover:bg-[#162d4a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                    >
                      {sendingShareEmail ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Send
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {(retailSigned || contingencySigned) && (
                      <span className="text-[11px] text-gray-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> Signed quote included</span>
                    )}
                    {certSigned && (
                      <span className="text-[11px] text-gray-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> Completion certificate included</span>
                    )}
                    {!retailSigned && !contingencySigned && !certSigned && (
                      <span className="text-[11px] text-amber-600">No signed documents yet — email will still send quote link</span>
                    )}
                  </div>
                </div>
              )}
              </>
            )
          )}

          {/* ── Step: Invoice editor ── */}
          {step === 'invoice_editor' && invoice && (
            <div className="px-6 py-6 space-y-5">

              {/* Invoice summary */}
              <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Invoice</p>
                    <p className="text-sm font-bold text-gray-800">{invoice.invoice_number ?? '—'}</p>
                  </div>
                  <StatusBadge
                    status={invoice.paid_at ? 'complete' : invoice.status === 'sent' ? 'sent' : invoice.status === 'draft' ? 'unsigned' : 'none'}
                    label={invoice.paid_at ? 'Paid' : invoice.status === 'sent' ? 'Sent' : invoice.status === 'draft' ? 'Draft' : invoice.status ?? 'Unknown'}
                  />
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-base font-bold text-[#1e3a5f]">
                    ${invoiceLineItems.reduce((s: number, i: any) => s + Number(i.total || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {invoice.paid_at && (
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs text-gray-500">Paid</p>
                    <p className="text-xs text-green-700 font-medium">
                      {new Date(invoice.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>

              {/* Due date */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Due Date</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={editingDueDate}
                    onChange={e => setEditingDueDate(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] bg-white"
                  />
                  <button
                    onClick={handleSaveInvoiceDueDate}
                    disabled={savingInvoice}
                    className="px-3 py-2 bg-[#1e3a5f] text-white text-sm rounded-lg hover:bg-[#162d4a] disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                  >
                    {savingInvoice ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Save
                  </button>
                </div>
              </div>

              {/* Line items */}
              {invoiceLineItems.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Line Items</p>
                  <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 text-xs overflow-hidden">
                    {invoiceLineItems.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-2 px-3 py-2.5">
                        <span className={`flex-1 truncate ${item.display_only ? 'text-gray-400 italic' : 'text-gray-700'}`}>{item.description}</span>
                        {!item.display_only && (
                          <span className="font-semibold text-gray-900 shrink-0">
                            ${Number(item.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment section */}
              {invoice.paid_at ? (
                <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <p className="text-sm font-semibold text-green-800">Payment Recorded</p>
                  </div>
                  <p className="text-xs text-green-700">
                    Paid on {new Date(invoice.paid_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <ActionBtn
                      onClick={() => handleDownloadInvoicePdf('receipt')}
                      disabled={generatingPdf === 'receipt'}
                      icon={generatingPdf === 'receipt' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                      label="Download Receipt"
                    />
                    <button
                      onClick={handleUnmarkPaid}
                      className="text-xs text-red-500 hover:text-red-700 underline"
                    >
                      Revert payment
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Record Payment</p>

                  {/* Payment method */}
                  <div className="grid grid-cols-5 gap-1">
                    {(['check', 'cash', 'card', 'transfer', 'other'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setPaymentMethod(m)}
                        className={`py-2 px-1 rounded-lg text-xs font-medium text-center transition-colors ${
                          paymentMethod === m
                            ? 'bg-[#1e3a5f] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {m === 'check' ? 'Check' : m === 'cash' ? 'Cash' : m === 'card' ? 'Card' : m === 'transfer' ? 'Transfer' : 'Other'}
                      </button>
                    ))}
                  </div>

                  {/* Payment date */}
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Payment Date</label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={e => setPaymentDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] bg-white"
                    />
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Amount Received</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={paymentAmount}
                        onChange={e => setPaymentAmount(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] bg-white"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Notes (optional)</label>
                    <input
                      type="text"
                      value={paymentNotes}
                      onChange={e => setPaymentNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] bg-white"
                      placeholder="Check #1234, reference number, etc."
                    />
                  </div>

                  <button
                    onClick={handleMarkPaid}
                    disabled={markingPaid || !paymentDate}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-colors"
                  >
                    {markingPaid ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Mark as Paid
                  </button>
                </div>
              )}

              {/* Download invoice */}
              <div className="pt-1">
                <ActionBtn
                  onClick={() => handleDownloadInvoicePdf('invoice')}
                  disabled={generatingPdf === 'invoice'}
                  icon={generatingPdf === 'invoice' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  label="Download Invoice PDF"
                />
              </div>

            </div>
          )}

          {/* ── Step: Configure contingency send ── */}
          {step === 'configure_contingency' && q && (
            <div className="px-6 py-6 space-y-4">

              {/* Agreement preview accordion */}
              <button
                onClick={() => setShowContingencyPreview(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-medium text-indigo-800">Preview Agreement</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-indigo-500 transition-transform duration-200 ${showContingencyPreview ? 'rotate-180' : ''}`} />
              </button>

              {showContingencyPreview && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 max-h-64 overflow-y-auto space-y-3">
                  {[
                    ['1. Agreement to Proceed', 'Property Owner authorizes Contractor to proceed with work contingent upon insurance carrier approval and agreement to pay the approved scope.'],
                    ['2. Complete Performance', 'Contractor agrees to perform all work in its entirety per industry standards unless mutually agreed upon in writing. No verbal modifications shall be binding.'],
                    ['3. Right to Supplement', 'Contractor retains the right to identify and submit supplemental claims for omitted items. All approved supplements are incorporated at no additional out-of-pocket cost beyond the deductible.'],
                    ['4. Payment Terms', 'Property Owner agrees to remit all insurance proceeds received — including ACV, recoverable depreciation, and approved supplements — to Contractor per the payment schedule. The deductible is the sole responsibility of the Property Owner.'],
                    ['5. Change Orders', 'Any work beyond the insurance-approved scope requires a written change order signed by both parties prior to commencement.'],
                    ['6. Homeowner Cooperation', 'Property Owner agrees to cooperate with Contractor and carrier, provide timely property access, and promptly forward all insurance correspondence and payment checks.'],
                    ['7. Workmanship Warranty', 'Contractor warrants all labor and installation for one (1) year from substantial completion. Material warranties are per manufacturer terms.'],
                    ['8. Cancellation', 'Either party may cancel within three (3) business days of execution without penalty. After the rescission period, cancellation by the Property Owner after work has commenced may result in liability for costs incurred up to the date of cancellation.'],
                  ].map(([title, text]) => (
                    <div key={title}>
                      <p className="text-xs font-semibold text-indigo-900">{title}</p>
                      <p className="text-xs text-indigo-700 mt-0.5 leading-relaxed">{text}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-gray-200 bg-gray-50 divide-y divide-gray-100">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-4 h-4 rounded bg-indigo-500 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">Signed Contingency Agreement</p>
                      <p className="text-xs text-gray-500">
                        {fullQuote?.contingency_signed_by ? `Signed by ${fullQuote.contingency_signed_by}` : 'Customer signature included'}
                      </p>
                    </div>
                  </div>
                </div>

                {fullQuote?.contingency_cancel_signature_data ? (
                  <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                    <input type="checkbox" checked={includeCancel} onChange={e => setIncludeCancel(e.target.checked)} className="w-4 h-4 rounded accent-indigo-600" />
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">Include 3-Day Right to Cancel</p>
                        <p className="text-xs text-gray-500">Customer cancellation acknowledgment</p>
                      </div>
                    </div>
                  </label>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-4 h-4 rounded bg-indigo-500 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">3-Day Right to Cancel</p>
                        <p className="text-xs text-gray-500">Automatically included</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {editingEmail ? (
                <div className="bg-blue-50 rounded-xl px-4 py-3 space-y-2">
                  <p className="text-sm font-medium text-gray-800">Edit email address</p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="email"
                      value={emailDraft}
                      onChange={e => setEmailDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveEmail(); if (e.key === 'Escape') setEditingEmail(false); }}
                      autoFocus
                      className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="customer@email.com"
                    />
                    <button onClick={handleSaveEmail} disabled={savingEmail} className="px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                      {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                    </button>
                    <button onClick={() => setEditingEmail(false)} className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center gap-3">
                  <Send className="w-4 h-4 text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">Sending to</p>
                    <p className="text-xs text-gray-500 truncate">{effectiveEmail || 'No email on file'}</p>
                  </div>
                  <button onClick={() => { setEmailDraft(effectiveEmail); setEditingEmail(true); }} className="text-gray-400 hover:text-indigo-600 transition-colors shrink-0">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              )}

              {!effectiveEmail && !editingEmail && (
                <div className="flex items-start gap-2 bg-red-50 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">No customer email on file. Click the pencil icon above to add one.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — contingency view + send buttons */}
        {step === 'configure_contingency' && (
          <div className="shrink-0 border-t border-gray-200 px-6 py-4 bg-gray-50 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => handleContingencyPdf('view')}
                disabled={!!generatingPdf}
                className="flex-1 flex items-center justify-center gap-2 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 font-semibold py-3 px-4 rounded-xl transition-colors text-sm"
              >
                {generatingPdf === 'contingency-view' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                View Agreement
              </button>
              <button
                onClick={handleSendContingency}
                disabled={sending || !effectiveEmail}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-colors text-sm"
              >
                {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Send</>}
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center">Sends to {effectiveEmail || 'no email'}</p>
          </div>
        )}

      </div>
    </div>
    </>
  );
};

export default DocumentsWizard;

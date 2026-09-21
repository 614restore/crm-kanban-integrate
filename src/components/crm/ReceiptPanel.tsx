// Copied from QuoteMGR (quotes-customize-manage/src/components/ReceiptPanel.tsx)
// so payments, receipts and refunds work the same way in both apps.
import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Save, UserPlus, Check, RefreshCw, Lock, ChevronRight, Mail, AlertTriangle, ShieldCheck, ArrowLeftRight, Pencil, Loader2, Eye, Printer } from 'lucide-react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type PaymentMethod = 'cash' | 'check' | 'card' | 'other';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  check: 'Check',
  card: 'Card / Digital',
  credit_card: 'Credit Card',
  bank_transfer: 'Bank Transfer',
  zelle: 'Zelle',
  venmo: 'Venmo',
  other: 'Other',
};

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

interface PaymentRecord {
  id: string;
  receipt_number: string;
  amount: number;
  payment_method: string;
  note?: string | null;
  created_at: string;
  sent_at?: string | null;
  recorded_by?: string | null;
}

interface ReceiptPanelProps {
  companyId: string;
  userId: string;
  userRole?: string;
  existingPaymentId?: string;
  quote: {
    id: string;
    quote_number: string;
    project_description?: string;
    cover_page_title?: string;
    selected_tier?: string | null;
    include_better?: boolean;
    include_best?: boolean;
    completion_certificate_enabled?: boolean;
    good_total?: number;
    better_total?: number;
    best_total?: number;
    good_tier_name?: string | null;
    better_tier_name?: string | null;
    best_tier_name?: string | null;
    use_manual_totals?: boolean;
    manual_good_total?: number | null;
    manual_better_total?: number | null;
    manual_best_total?: number | null;
    customer_id?: string;
    customer?: {
      id: string;
      first_name: string;
      last_name: string;
      email?: string;
    };
  };
  company: {
    name: string;
    default_deposit_percent?: number | null;
    receipt_cc_emails?: string[] | null;
  };
  onClose: (paymentSaved?: boolean) => void;
}

export default function ReceiptPanel({ companyId, userId, userRole, quote, company, existingPaymentId, onClose }: ReceiptPanelProps) {
  const isResend = !!existingPaymentId;
  const canRefund = ['owner', 'admin', 'manager'].includes(userRole ?? '');

  const [quoteOptions, setQuoteOptions] = useState<{ name: string; subtotal: number }[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [quotePayments, setQuotePayments] = useState<PaymentRecord[]>([]);

  const [originalPayment, setOriginalPayment] = useState<PaymentRecord | null>(null);
  const [draftPayment, setDraftPayment] = useState<PaymentRecord | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Selected payment for receipt detail view
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [resendingPayment, setResendingPayment] = useState(false);

  // Inline edit state for an existing payment
  const [editingPayment, setEditingPayment] = useState(false);
  const [editMethod, setEditMethod] = useState<string>('cash');
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Refund modal
  const [showRefund, setShowRefund] = useState(false);
  const [refundNote, setRefundNote] = useState('');
  const [sendingRefund, setSendingRefund] = useState(false);

  // Completion certificate option
  const [includeCert, setIncludeCert] = useState(false);
  const [certPhotos, setCertPhotos] = useState<any[]>([]);
  const [certPhotosLoaded, setCertPhotosLoaded] = useState(false);
  const [selectedCertPhotoUrls, setSelectedCertPhotoUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: opts }, { data: pmts }] = await Promise.all([
        supabase.from('quote_options').select('name, subtotal').eq('quote_id', quote.id).order('sort_order'),
        supabase.from('payments')
          .select('id, amount, payment_method, note, receipt_number, sent_at, created_at, created_by')
          .eq('quote_id', quote.id)
          .order('created_at', { ascending: true }),
      ]);

      setQuoteOptions(opts ?? []);
      const payments = pmts ?? [];

      // Resolve recorder names
      const userIds = [...new Set((payments as any[]).map((p: any) => p.created_by).filter(Boolean))];
      const nameByUserId: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: members } = await supabase
          .from('team_members')
          .select('user_id, full_name')
          .in('user_id', userIds);
        for (const m of members ?? []) nameByUserId[(m as any).user_id] = (m as any).full_name;
      }

      const enriched: PaymentRecord[] = (payments as any[]).map(p => ({
        ...p,
        recorded_by: p.created_by ? (nameByUserId[p.created_by] ?? null) : null,
      }));

      setQuotePayments(enriched);

      if (isResend && existingPaymentId) {
        const orig = enriched.find(p => p.id === existingPaymentId) ?? enriched[enriched.length - 1];
        if (orig) setOriginalPayment(orig);
      } else {
        const draft = enriched.find(p => !p.sent_at);
        if (draft) setDraftPayment(draft);
      }

      setOptionsLoaded(true);
    };
    fetchData();
  }, [quote.id, existingPaymentId, isResend]);

  // Load cert photos when the checkbox is first checked
  useEffect(() => {
    if (!includeCert || certPhotosLoaded) return;
    supabase
      .from('quote_photos')
      .select('*')
      .eq('quote_id', quote.id)
      .order('sort_order')
      .then(({ data }) => {
        const rows = data ?? [];
        setCertPhotos(rows);
        setSelectedCertPhotoUrls(new Set(rows.map((p: any) => p.photo_url)));
        setCertPhotosLoaded(true);
      });
  }, [includeCert, certPhotosLoaded, quote.id]);

  const resolvedGood   = (quote.use_manual_totals && quote.manual_good_total   != null ? quote.manual_good_total   : quote.good_total)   ?? 0;
  const resolvedBetter = (quote.include_better !== false && (quote.use_manual_totals && quote.manual_better_total != null ? quote.manual_better_total : quote.better_total)) || 0;
  const resolvedBest   = (quote.include_best   !== false && (quote.use_manual_totals && quote.manual_best_total   != null ? quote.manual_best_total   : quote.best_total))   || 0;

  const activeTiers = [
    resolvedGood,
    resolvedBetter,
    resolvedBest,
  ].filter(v => v > 0);

  const quoteTotal = (() => {
    if (!optionsLoaded) return 0;
    const st = quote.selected_tier;
    if (quoteOptions.length > 0) {
      if (!st || st === 'all') return quoteOptions.reduce((s, o) => s + (o.subtotal ?? 0), 0);
      const match = quoteOptions.find(o => o.name.toLowerCase() === st!.toLowerCase());
      return match ? match.subtotal : quoteOptions.reduce((s, o) => s + (o.subtotal ?? 0), 0);
    }
    if (st === 'good') return resolvedGood;
    if (st === 'better') return resolvedBetter;
    if (st === 'best') return resolvedBest;
    // No tier selected — use the only active tier, or good as fallback
    return activeTiers.length === 1 ? activeTiers[0] : resolvedGood;
  })();

  // Tier rows for the Job Total card
  const tierRows = (() => {
    const st = quote.selected_tier;
    const rows: { name: string; total: number }[] = [];
    const tierNames = {
      good: quote.good_tier_name || 'Good',
      better: quote.better_tier_name || 'Better',
      best: quote.best_tier_name || 'Best',
    };
    if (quoteOptions.length > 0) {
      if (!st || st === 'all') return quoteOptions.map(o => ({ name: o.name, total: o.subtotal }));
      const match = quoteOptions.find(o => o.name.toLowerCase() === st!.toLowerCase());
      return match ? [{ name: match.name, total: match.subtotal }] : [];
    }
    if (!st || st === 'all') {
      if (resolvedGood > 0)   rows.push({ name: tierNames.good,   total: resolvedGood });
      if (resolvedBetter > 0) rows.push({ name: tierNames.better, total: resolvedBetter });
      if (resolvedBest > 0)   rows.push({ name: tierNames.best,   total: resolvedBest });
    } else if (st === 'good' && resolvedGood > 0) {
      rows.push({ name: tierNames.good, total: resolvedGood });
    } else if (st === 'better' && resolvedBetter > 0) {
      rows.push({ name: tierNames.better, total: resolvedBetter });
    } else if (st === 'best' && resolvedBest > 0) {
      rows.push({ name: tierNames.best, total: resolvedBest });
    }
    return rows;
  })();

  // Historical totals (all payments already in DB)
  const totalPaidHistorical = quotePayments.reduce((s, p) => s + (p.amount ?? 0), 0);
  const historicalRawBalance = quoteTotal > 0 ? quoteTotal - totalPaidHistorical : null;
  const historicalBalance = historicalRawBalance !== null ? Math.max(0, historicalRawBalance) : null;
  const overpayment = historicalRawBalance !== null && historicalRawBalance < 0 ? Math.abs(historicalRawBalance) : 0;

  // Entry-form balance (for new payment summary)
  const [amount, setAmount] = useState('');
  const amountEdited = useRef(false);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [note, setNote] = useState('');
  const [ccEmails, setCcEmails] = useState<string[]>(company.receipt_cc_emails?.filter(Boolean) ?? []);
  const [ccInput, setCcInput] = useState('');
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; full_name: string; email: string; role: string }>>([]);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const parsedAmount = parseFloat(amount.replace(/[^0-9.]/g, '')) || 0;
  const previouslyPaid = quotePayments.filter(p => p.id !== existingPaymentId).reduce((s, p) => s + (p.amount ?? 0), 0);
  const entryRawBalance = quoteTotal > 0 ? quoteTotal - previouslyPaid - parsedAmount : null;
  const entryBalance = entryRawBalance !== null ? Math.max(0, entryRawBalance) : null;
  const entryOverpayment = entryRawBalance !== null && entryRawBalance < 0 ? Math.abs(entryRawBalance) : 0;
  const remaining = quoteTotal > 0 ? Math.max(0, quoteTotal - totalPaidHistorical) : 0;

  const loadDraft = (draft: PaymentRecord) => {
    setAmount(draft.amount.toFixed(2));
    setMethod(draft.payment_method as PaymentMethod);
    setNote(draft.note ?? '');
    amountEdited.current = true;
    setDraftLoaded(true);
  };

  useEffect(() => {
    supabase.from('team_members').select('id, full_name, email, role')
      .eq('company_id', companyId).eq('is_active', true).order('full_name')
      .then(({ data }) => { if (data) setTeamMembers(data as any); });
  }, [companyId]);

  const toggleCC = (email: string) =>
    setCcEmails(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]);

  const addManualCC = () => {
    const t = ccInput.trim().toLowerCase();
    if (!t || !t.includes('@')) return;
    if (!ccEmails.includes(t)) setCcEmails(prev => [...prev, t]);
    setCcInput('');
  };

  const resolvedCustomerId = quote.customer?.id || quote.customer_id;
  const customerName = quote.customer ? `${quote.customer.first_name} ${quote.customer.last_name}` : 'Customer';
  const initials = quote.customer ? `${quote.customer.first_name[0]}${quote.customer.last_name[0]}` : '?';

  const [previewing, setPreviewing] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<{ id: string; action: 'preview' | 'send' } | null>(null);

  const paymentPayload = () => ({
    company_id: companyId,
    customer_id: resolvedCustomerId!,
    quote_id: quote.id,
    amount: parsedAmount,
    payment_method: method,
    note: note.trim() || undefined,
  });

  /**
   * Shows the receipt as the customer will receive it, without sending it or
   * recording the payment.
   *
   * The edge function returns the same html it would email, so the preview
   * cannot drift from the real thing the way a second template would.
   */
  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const body: Record<string, unknown> = isResend || draftLoaded
        ? {
            payment_id: (isResend ? (originalPayment?.id ?? existingPaymentId) : draftPayment?.id),
            company_id: companyId,
            to_email: quote.customer?.email ?? '',
            to_name: customerName,
            preview: true,
          }
        : { ...paymentPayload(), to_email: quote.customer?.email ?? '', to_name: customerName, preview: true };

      const { data, error } = await supabase.functions.invoke('send-receipt-email', { body });
      if (error) throw error;
      if (!data?.html) throw new Error(data?.error ?? 'Could not build the receipt');
      setPreviewHtml(data.html as string);
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not build the receipt preview');
    } finally {
      setPreviewing(false);
    }
  };

  /**
   * Preview or send one specific payment from the list.
   *
   * The form's own buttons only work for a payment being entered, or for the
   * one unsent draft — so once every payment had been sent there was no way to
   * look at a receipt or send it again. These act on whichever payment is
   * asked for, which is what makes both available at any time.
   */
  /**
   * The receipt the main buttons act on when no new payment is being entered.
   *
   * Receipts get lost — saved to a desktop and mislaid, or needed on screen to
   * show someone. Neither should require entering a payment first, so with
   * nothing typed the buttons fall back to the most recent receipt on the
   * quote rather than sitting disabled.
   */
  const latestReceipt: PaymentRecord | null =
    quotePayments.length > 0 ? quotePayments[quotePayments.length - 1] : null;
  const actingOnLatest = !isResend && !draftLoaded && parsedAmount <= 0 && !!latestReceipt;

  const previewExisting = async (p: PaymentRecord) => {
    setRowBusy({ id: p.id, action: 'preview' });
    try {
      const { data, error } = await supabase.functions.invoke('send-receipt-email', {
        body: {
          payment_id: p.id,
          company_id: companyId,
          to_email: quote.customer?.email ?? '',
          to_name: customerName,
          preview: true,
        },
      });
      if (error) throw error;
      if (!data?.html) throw new Error(data?.error ?? 'Could not build the receipt');
      setPreviewHtml(data.html as string);
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not build the receipt preview');
    } finally {
      setRowBusy(null);
    }
  };

  const sendExisting = async (p: PaymentRecord) => {
    const email = quote.customer?.email;
    if (!email) { toast.error('Customer has no email address on file'); return; }
    if (p.sent_at && !window.confirm(`Receipt #${p.receipt_number} was already sent. Send it again to ${email}?`)) return;

    setRowBusy({ id: p.id, action: 'send' });
    try {
      const { data, error } = await supabase.functions.invoke('send-receipt-email', {
        body: { payment_id: p.id, company_id: companyId, to_email: email, to_name: customerName, cc_emails: ccEmails },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.email_error ?? 'Failed to send receipt');
      toast.success(`Receipt #${p.receipt_number} sent to ${email}`);
      setQuotePayments(prev => prev.map(x => x.id === p.id ? { ...x, sent_at: new Date().toISOString() } : x));
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not send the receipt');
    } finally {
      setRowBusy(null);
    }
  };

  const handleSend = async () => {
    const email = quote.customer?.email;
    if (!email) { toast.error('Customer has no email address on file'); return; }
    if (!resolvedCustomerId) { toast.error('No customer linked to this quote'); return; }
    // Warn before recording an overpayment
    if (!isResend && !draftLoaded && entryOverpayment > 0) {
      const confirmed = window.confirm(
        `This payment of ${fmt(parsedAmount)} exceeds the remaining balance of ${fmt(Math.max(0, quoteTotal - previouslyPaid))} by ${fmt(entryOverpayment)}.\n\nAre you sure you want to record this overpayment?`
      );
      if (!confirmed) return;
    }

    setSending(true);
    try {
      let body: Record<string, unknown>;
      if (isResend) {
        body = { payment_id: originalPayment?.id ?? existingPaymentId, company_id: companyId, to_email: email, to_name: customerName, cc_emails: ccEmails };
      } else if (draftLoaded && draftPayment) {
        body = { payment_id: draftPayment.id, company_id: companyId, to_email: email, to_name: customerName, cc_emails: ccEmails };
      } else {
        if (parsedAmount <= 0) { toast.error('Enter an amount greater than $0'); return; }
        body = { ...paymentPayload(), to_email: email, to_name: customerName, cc_emails: ccEmails };
      }
      const { data, error } = await supabase.functions.invoke('send-receipt-email', { body });
      if (error) throw error;
      if (data?.payment_id && !data?.success) { toast.warning(`Receipt saved, but email failed: ${data.email_error ?? 'unknown error'}`); onClose(true); return; }
      if (!data?.payment_id) throw new Error(data?.email_error ?? 'Failed to save receipt');
      toast.success(`Receipt sent to ${email}${ccEmails.length ? ` + ${ccEmails.length} CC` : ''}`);

      if (includeCert && quote.completion_certificate_enabled) {
        try {
          const selectedPhotos = certPhotos
            .filter((p: any) => selectedCertPhotoUrls.has(p.photo_url))
            .map((p: any) => ({ photo_url: p.photo_url, caption: p.caption, location: p.location, notes: p.notes }));
          const { error: certErr } = await supabase.functions.invoke('send-completion-certificate', {
            body: {
              quote_id: quote.id,
              company_id: companyId,
              dashboard_url: window.location.origin,
              selected_photos: selectedPhotos,
            },
          });
          if (certErr) {
            toast.warning('Receipt sent, but completion certificate failed to send. Try resending from the cert panel.');
          } else {
            toast.success('Completion Certificate also sent.', { duration: 4000, icon: '🏅' });
          }
        } catch {
          toast.warning('Receipt sent, but completion certificate failed to send.');
        }
      }

      onClose(true);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send receipt email');
    } finally { setSending(false); }
  };

  const handleSaveOnly = async () => {
    if (parsedAmount <= 0) { toast.error('Enter an amount greater than $0'); return; }
    if (!resolvedCustomerId) { toast.error('No customer linked to this quote'); return; }
    if (entryOverpayment > 0) {
      const confirmed = window.confirm(
        `This payment of ${fmt(parsedAmount)} exceeds the remaining balance of ${fmt(Math.max(0, quoteTotal - previouslyPaid))} by ${fmt(entryOverpayment)}.\n\nAre you sure you want to record this overpayment?`
      );
      if (!confirmed) return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('save-receipt', { body: paymentPayload() });
      if (error) throw error;
      if (!data?.success) throw new Error('Save failed');
      toast.success(`Receipt ${data.receipt_number} saved to customer record`);
      onClose(true);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save receipt');
    } finally { setSaving(false); }
  };

  const openEditPayment = (p: PaymentRecord) => {
    setEditMethod(p.payment_method);
    setEditAmount(p.amount.toFixed(2));
    setEditNote(p.note ?? '');
    setEditingPayment(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedPayment) return;
    const newAmount = parseFloat(editAmount.replace(/[^0-9.]/g, ''));
    if (isNaN(newAmount) || newAmount <= 0) { toast.error('Enter a valid amount'); return; }
    setSavingEdit(true);
    try {
      const { error } = await supabase.from('payments')
        .update({ payment_method: editMethod, amount: newAmount, note: editNote.trim() || null })
        .eq('id', selectedPayment.id);
      if (error) throw error;
      // Refresh payments list
      const { data: fresh } = await supabase.from('payments')
        .select('id, amount, payment_method, note, receipt_number, sent_at, created_at, created_by')
        .eq('quote_id', quote.id).order('created_at', { ascending: true });
      if (fresh) setQuotePayments(fresh as any);
      const updated = (fresh as any[])?.find((p: any) => p.id === selectedPayment.id);
      if (updated) setSelectedPayment(updated);
      setEditingPayment(false);
      toast.success('Payment updated');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update payment');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleResendPayment = async (p: PaymentRecord) => {
    const email = quote.customer?.email;
    if (!email) { toast.error('No email on file'); return; }
    setResendingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-receipt-email', {
        body: { payment_id: p.id, company_id: companyId, to_email: email, to_name: customerName, cc_emails: [] },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.email_error ?? 'Failed to send receipt');
      toast.success(`Receipt #${p.receipt_number} resent to ${email}`);
      setSelectedPayment(null);
      // Refresh payments to update sent_at
      const { data: fresh } = await supabase.from('payments')
        .select('id, amount, payment_method, note, receipt_number, sent_at, created_at, created_by')
        .eq('quote_id', quote.id).order('created_at', { ascending: true });
      if (fresh) setQuotePayments(fresh as any);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to resend receipt');
    } finally { setResendingPayment(false); }
  };

  const handleSendRefund = async () => {
    const email = quote.customer?.email;
    if (!email) { toast.error('No customer email on file'); return; }
    setSendingRefund(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-refund-notice', {
        body: {
          company_id: companyId,
          to_email: email,
          to_name: customerName,
          refund_amount: overpayment,
          job_total: quoteTotal || null,
          total_paid: totalPaidHistorical,
          quote_number: quote.quote_number,
          note: refundNote.trim() || null,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Send failed');
      toast.success(`Refund notice for ${fmt(overpayment)} sent to ${email}`);
      setShowRefund(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send refund notice');
    } finally { setSendingRefund(false); }
  };

  // ─── Receipt detail view ───────────────────────────────────────────────────
  if (selectedPayment) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
        <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col">
          <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
            <button onClick={() => setSelectedPayment(null)} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
            <div className="flex-1">
              <h2 className="font-bold text-lg text-gray-900">Receipt #{selectedPayment.receipt_number}</h2>
              <p className="text-xs text-gray-500">{new Date(selectedPayment.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>
            {selectedPayment.sent_at
              ? <span className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full"><Mail className="w-3 h-3" /> Sent</span>
              : <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-3 py-1 rounded-full">Not sent</span>}
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
            {/* Amount prominent */}
            <div className="bg-[#1e3a5f] rounded-2xl p-5 text-center">
              <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-1">
                {METHOD_LABELS[editingPayment ? editMethod : selectedPayment.payment_method] ?? (editingPayment ? editMethod : selectedPayment.payment_method)}
              </p>
              <p className="text-4xl font-black text-white">
                {editingPayment ? fmt(parseFloat(editAmount.replace(/[^0-9.]/g, '')) || 0) : fmt(selectedPayment.amount)}
              </p>
            </div>

            {/* Edit form or detail view */}
            {editingPayment ? (
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 space-y-3">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Edit Payment</p>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Amount</label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-gray-500">$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={editAmount}
                      onChange={e => setEditAmount(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                  <div className="flex flex-wrap gap-2">
                    {(['cash', 'check', 'card', 'zelle', 'venmo', 'bank_transfer', 'other'] as const).map(m => (
                      <button key={m} type="button"
                        onClick={() => setEditMethod(m)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${editMethod === m ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200 hover:border-amber-400'}`}
                      >
                        {METHOD_LABELS[m] ?? m}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
                  <input
                    type="text"
                    value={editNote}
                    onChange={e => setEditNote(e.target.value)}
                    placeholder="e.g. check #1234"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 border border-gray-100">
                <div className="flex justify-between px-4 py-3 text-sm">
                  <span className="text-gray-500">Receipt #</span>
                  <span className="font-semibold text-gray-900">{selectedPayment.receipt_number}</span>
                </div>
                <div className="flex justify-between px-4 py-3 text-sm">
                  <span className="text-gray-500">Method</span>
                  <span className="font-semibold text-gray-900">{METHOD_LABELS[selectedPayment.payment_method] ?? selectedPayment.payment_method}</span>
                </div>
                <div className="flex justify-between px-4 py-3 text-sm">
                  <span className="text-gray-500">Date</span>
                  <span className="font-semibold text-gray-900">{new Date(selectedPayment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                {selectedPayment.recorded_by && (
                  <div className="flex justify-between px-4 py-3 text-sm">
                    <span className="text-gray-500">Recorded by</span>
                    <span className="font-semibold text-gray-900">{selectedPayment.recorded_by}</span>
                  </div>
                )}
                {selectedPayment.note && (
                  <div className="flex justify-between px-4 py-3 text-sm">
                    <span className="text-gray-500">Note</span>
                    <span className="font-semibold text-gray-900 text-right max-w-[60%]">{selectedPayment.note}</span>
                  </div>
                )}
                {selectedPayment.sent_at && (
                  <div className="flex justify-between px-4 py-3 text-sm">
                    <span className="text-gray-500">Sent</span>
                    <span className="font-semibold text-emerald-600">{new Date(selectedPayment.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-gray-100 space-y-2 flex-shrink-0">
            {editingPayment ? (
              <>
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl text-base transition-colors disabled:opacity-50"
                >
                  {savingEdit
                    ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Save className="w-5 h-5" />}
                  {savingEdit ? 'Saving…' : 'Save Changes'}
                </button>
                <button onClick={() => setEditingPayment(false)} className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50">
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => openEditPayment(selectedPayment)}
                  className="w-full flex items-center justify-center gap-2 bg-white border border-amber-300 text-amber-700 font-bold py-3 rounded-xl text-sm transition-colors hover:bg-amber-50"
                >
                  <RefreshCw className="w-4 h-4" /> Change Payment Method / Amount
                </button>
                {quote.customer?.email && (
                  <button
                    onClick={() => handleResendPayment(selectedPayment)}
                    disabled={resendingPayment}
                    className="w-full flex items-center justify-center gap-2 bg-[#ff6b35] hover:bg-[#e55a2b] text-white font-bold py-3.5 rounded-xl text-base transition-colors disabled:opacity-50"
                  >
                    {resendingPayment
                      ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Send className="w-5 h-5" />}
                    {resendingPayment ? 'Sending…' : 'Resend This Receipt'}
                  </button>
                )}
                <button onClick={() => setSelectedPayment(null)} className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50">
                  Back
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Refund modal ──────────────────────────────────────────────────────────
  if (showRefund) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
        <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col">
          <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0" style={{ background: '#312e81', borderRadius: '16px 16px 0 0' }}>
            <button onClick={() => setShowRefund(false)} className="p-2 hover:bg-white/10 rounded-lg">
              <X className="w-5 h-5 text-white" />
            </button>
            <div className="flex-1">
              <h2 className="font-bold text-lg text-white">Issue Refund</h2>
              <p className="text-xs text-indigo-200">Notify customer of refund</p>
            </div>
            <span className="bg-white/20 text-white text-sm font-bold px-3 py-1.5 rounded-lg">{fmt(overpayment)}</span>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
            {/* Prominent refund amount */}
            <div className="rounded-2xl p-6 text-center" style={{ background: '#ede9fe', border: '2px solid #a78bfa' }}>
              <ArrowLeftRight className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Refund Amount</p>
              <p className="text-5xl font-black" style={{ color: '#312e81' }}>{fmt(overpayment)}</p>
              <p className="text-sm text-indigo-600 mt-2">Customer overpaid — refund owed</p>
            </div>

            {/* Breakdown */}
            <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 border border-gray-100">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: '#312e81' }}>
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{customerName}</p>
                  {quote.customer?.email && <p className="text-xs text-gray-500">{quote.customer.email}</p>}
                </div>
              </div>
              {quoteTotal > 0 && (
                <div className="flex justify-between px-4 py-3 text-sm">
                  <span className="text-gray-500">Job Total</span>
                  <span className="font-semibold text-gray-900">{fmt(quoteTotal)}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-3 text-sm">
                <span className="text-gray-500">Total Paid</span>
                <span className="font-semibold text-emerald-600">{fmt(totalPaidHistorical)}</span>
              </div>
              <div className="flex justify-between px-4 py-3 text-sm bg-indigo-50">
                <span className="font-bold text-indigo-800">Refund Owed</span>
                <span className="font-bold text-indigo-800">{fmt(overpayment)}</span>
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Reason / Note (optional)</label>
              <textarea
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                rows={3}
                value={refundNote}
                onChange={e => setRefundNote(e.target.value)}
                placeholder="e.g. Overpayment on deposit — check to follow"
              />
            </div>
            <p className="text-xs text-gray-400 text-center leading-relaxed">
              Sending a refund notice emails the customer a document confirming the refund amount. The actual refund is issued separately via your preferred method.
            </p>
          </div>

          <div className="px-5 py-4 border-t border-gray-100 space-y-2 flex-shrink-0">
            {quote.customer?.email ? (
              <button
                onClick={handleSendRefund}
                disabled={sendingRefund}
                className="w-full flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-xl text-base transition-colors disabled:opacity-50"
                style={{ background: '#312e81' }}
              >
                {sendingRefund
                  ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Send className="w-5 h-5" />}
                {sendingRefund ? 'Sending…' : 'Send Refund Notice'}
              </button>
            ) : (
              <div className="w-full py-3.5 rounded-xl bg-gray-100 text-center text-sm text-gray-400">No email on file — cannot send notice</div>
            )}
            <button onClick={() => setShowRefund(false)} className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main panel ───────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-lg text-gray-900">Payments & Receipts</h2>
            <p className="text-xs text-gray-500 mt-0.5">{quote.quote_number} · {customerName}</p>
          </div>
          <button onClick={() => onClose()} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* ══════════════════════════════════════════════════
              FINANCIAL SUMMARY — always visible when quote exists
              ══════════════════════════════════════════════════ */}
          {(quoteTotal > 0 || quotePayments.length > 0) && (
            <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-md">

              {/* ── Row 1: JOB TOTAL (amber) ── */}
              <div style={{ background: '#92400e' }}>
                <div className="px-5 pt-4 pb-3 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#fcd34d' }}>Job Total</span>
                      <span className="text-xs font-semibold" style={{ color: '#fde68a' }}>{quote.quote_number}</span>
                      {quote.project_description && (
                        <span className="text-xs truncate" style={{ color: '#fde68a', opacity: 0.8 }}>{quote.project_description}</span>
                      )}
                    </div>
                    <p className="text-3xl font-black leading-none" style={{ color: '#fef3c7' }}>{fmt(quoteTotal)}</p>
                  </div>
                </div>
                {tierRows.length > 1 && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                    {tierRows.map((t, i) => (
                      <div key={t.name} className="flex justify-between items-center px-5 py-2" style={{ borderBottom: i < tierRows.length - 1 ? '1px solid rgba(255,255,255,0.07)' : undefined }}>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: i === 0 ? '#fbbf24' : i === 1 ? '#fcd34d' : '#fde68a' }} />
                          <span className="text-xs font-medium" style={{ color: '#fef3c7' }}>{t.name}</span>
                        </div>
                        <span className="text-xs font-bold" style={{ color: '#fef9c3' }}>{fmt(t.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Row 2: TOTAL PAID + BALANCE REMAINING (always shown) ── */}
              {(() => {
                const isOver = overpayment > 0;
                const isPaid = historicalBalance === 0 && !isOver;
                // "Past Due" used to fire the moment ANY payment existed while a
                // balance remained -- true of every ordinary in-progress deposit,
                // with no actual due date ever checked. There's no due-date field
                // on a quote to check against, so a remaining balance is just
                // "Balance Due" until real overdue tracking exists.
                const balBg = isPaid ? '#14532d' : isOver ? '#312e81' : '#c2410c';
                const balLabel = isPaid ? 'Paid in Full' : isOver ? 'Overpayment' : 'Balance Due';
                const balValue = isPaid ? '✓ Paid' : isOver ? `+${fmt(overpayment)}` : fmt(historicalBalance ?? quoteTotal);
                const balSub = isPaid ? 'No balance remaining' : isOver ? 'Customer is owed a refund' : 'Amount still owed';
                const balSubColor = isPaid ? '#bbf7d0' : isOver ? '#c7d2fe' : '#fed7aa';
                return (
                  <div className="grid grid-cols-2" style={{ borderTop: '3px solid rgba(0,0,0,0.15)' }}>
                    {/* Total Paid */}
                    <div className="p-4" style={{ background: '#065f46', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#6ee7b7' }}>Total Paid</p>
                      <p className="text-xl font-black text-white leading-none truncate">{fmt(totalPaidHistorical)}</p>
                      <p className="text-[10px] mt-1.5" style={{ color: '#a7f3d0' }}>
                        {quotePayments.length === 0 ? 'No payments yet' : `${quotePayments.length} payment${quotePayments.length !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                    {/* Balance */}
                    <div className="p-4 relative" style={{ background: balBg }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: balSubColor }}>{balLabel}</p>
                      <p className="text-xl font-black text-white leading-none truncate">{balValue}</p>
                      <p className="text-[10px] mt-1.5 font-semibold" style={{ color: balSubColor }}>{balSub}</p>
                      {isOver && (
                        canRefund ? (
                          <button onClick={() => { setRefundNote(''); setShowRefund(true); }}
                            className="mt-2 w-full flex items-center justify-center gap-1 py-1 rounded text-[10px] font-bold text-white"
                            style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)' }}>
                            <RefreshCw className="w-2.5 h-2.5" /> Issue Refund
                          </button>
                        ) : (
                          <div className="mt-2 flex items-center gap-1 justify-center py-1 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>
                            <Lock className="w-2.5 h-2.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
                            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Manager+ only</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ── Row 3: PAYMENTS RECEIVED list (always shown) ── */}
              <div style={{ borderTop: '1px solid #e5e7eb' }}>
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Payments Received</span>
                    {quotePayments.length > 0 && (
                      <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{quotePayments.length}</span>
                    )}
                  </div>
                </div>
                {quotePayments.length === 0 ? (
                  <div className="flex items-center gap-3 px-4 py-4 bg-white">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                    <p className="text-sm text-gray-400 italic">No payments recorded yet</p>
                  </div>
                ) : (
                  <div className="bg-white divide-y divide-gray-50">
                    {quotePayments.map(p => {
                      const canEdit = ['owner', 'admin', 'manager'].includes(userRole ?? '');
                      return (
                        <div key={p.id} className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors">
                          <button
                            onClick={() => setSelectedPayment(p)}
                            className="flex-1 flex items-center gap-3 text-left min-w-0"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900">#{p.receipt_number} · {METHOD_LABELS[p.payment_method] ?? p.payment_method}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                {p.recorded_by ? ` · ${p.recorded_by}` : ''}
                              </p>
                              {p.note && <p className="text-xs text-gray-400 italic mt-0.5 truncate">{p.note}</p>}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-base font-black text-emerald-600">{fmt(p.amount)}</p>
                              {p.sent_at && (
                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                  <Mail className="w-2.5 h-2.5" /> Sent
                                </span>
                              )}
                            </div>
                          </button>
                          {/* Available on every payment, sent or not: looking at
                              a receipt or sending it again should not depend on
                              catching it before it was first sent. */}
                          <button
                            onClick={() => void previewExisting(p)}
                            disabled={!!rowBusy}
                            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-xs font-semibold disabled:opacity-50"
                            title="Preview this receipt"
                          >
                            {rowBusy?.id === p.id && rowBusy.action === 'preview'
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Eye className="w-3 h-3" />}
                            View
                          </button>
                          {quote.customer?.email && (
                            <button
                              onClick={() => void sendExisting(p)}
                              disabled={!!rowBusy}
                              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[#1e3a5f] border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors text-xs font-semibold disabled:opacity-50"
                              title={p.sent_at ? 'Send this receipt again' : 'Send this receipt'}
                            >
                              {rowBusy?.id === p.id && rowBusy.action === 'send'
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Send className="w-3 h-3" />}
                              {p.sent_at ? 'Resend' : 'Send'}
                            </button>
                          )}
                          {canEdit ? (
                            <button
                              onClick={() => { setSelectedPayment(p); openEditPayment(p); }}
                              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-amber-600 border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors text-xs font-semibold"
                              title="Edit payment"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── DRAFT BANNER ──────────────────────────────────────── */}
          {!isResend && draftPayment && !draftLoaded && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">Saved Payment on File</p>
              <p className="text-sm text-amber-800 mb-3">
                {fmt(draftPayment.amount)} ({draftPayment.payment_method}) was saved but not yet emailed as receipt #{draftPayment.receipt_number}.
              </p>
              <div className="flex gap-2">
                {/* Loads the saved payment into the form, which is what makes
                    the send button usable: it is disabled while the amount is
                    zero, and coming back to an already-saved payment left the
                    form blank with no way to fill it. loadDraft existed for
                    this and was never wired to anything, so "Send Saved
                    Receipt" could not be reached at all. */}
                <button onClick={() => loadDraft(draftPayment)} className="flex-1 px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700">
                  Send This Receipt
                </button>
                <button onClick={() => setSelectedPayment(draftPayment)} className="px-3 py-2 rounded-lg border border-amber-300 text-amber-700 text-xs font-semibold hover:bg-amber-100">
                  View
                </button>
                <button onClick={() => setDraftPayment(null)} className="px-3 py-2 rounded-lg border border-amber-300 text-amber-700 text-xs font-semibold hover:bg-amber-100">
                  New
                </button>
              </div>
            </div>
          )}

          {!isResend && draftLoaded && draftPayment && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <p className="text-xs text-emerald-800 font-medium">Loaded receipt #{draftPayment.receipt_number} — review and send.</p>
            </div>
          )}

          {/* ── NEW PAYMENT FORM (hidden in resend mode) ──────────── */}
          {!isResend && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#ff6b35] flex items-center justify-center">
                  <Send className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#ff6b35]">Record New Payment</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Amount received</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                  <input
                    type="number" step="0.01" min="0"
                    className="w-full pl-7 pr-3 py-3 text-2xl font-bold text-[#1e3a5f] border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                    value={amount}
                    onChange={e => { amountEdited.current = true; setAmount(e.target.value); }}
                    placeholder="0.00"
                  />
                </div>
                {remaining > 0 && (
                  <div className="mt-2">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold mb-1.5">Quick amounts</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[25, 50, 75, 100].map(pct => {
                        const val = Math.round(remaining * pct) / 100;
                        return (
                          <button key={pct} type="button"
                            onClick={() => { amountEdited.current = true; setAmount(val.toFixed(2)); }}
                            className="flex flex-col items-center px-2 py-1.5 rounded-lg border border-gray-200 bg-white hover:border-[#1e3a5f] hover:bg-[#1e3a5f]/5 transition-colors">
                            <span className="text-[11px] font-bold text-[#1e3a5f]">{pct}%</span>
                            <span className="text-[10px] text-gray-500">{fmt(val)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Payment method</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['cash', 'check', 'card', 'other'] as PaymentMethod[]).map(m => (
                    <button key={m} onClick={() => setMethod(m)}
                      className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${method === m ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                      {METHOD_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Note (optional)</label>
                <input type="text"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                  value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. 50% down payment" />
              </div>

              {parsedAmount > 0 && (
                <div className={`rounded-xl p-4 space-y-1.5 border ${entryOverpayment > 0 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-200'}`}>
                  {quoteTotal > 0 && <>
                    <div className={`flex justify-between text-sm ${entryOverpayment > 0 ? 'text-red-700' : 'text-green-700'}`}><span>Project total</span><span>{fmt(quoteTotal)}</span></div>
                    {previouslyPaid > 0 && <div className={`flex justify-between text-sm ${entryOverpayment > 0 ? 'text-red-700' : 'text-green-700'}`}><span>Previously paid</span><span>− {fmt(previouslyPaid)}</span></div>}
                    <div className={`flex justify-between text-sm font-semibold rounded-lg px-2 py-1.5 ${entryOverpayment > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}><span>This payment</span><span>{fmt(parsedAmount)}</span></div>
                    {entryOverpayment > 0 ? (
                      <>
                        <div className="flex justify-between font-bold text-red-700 border-t border-red-200 pt-1.5">
                          <span>⚠️ Overpayment</span>
                          <span>+{fmt(entryOverpayment)}</span>
                        </div>
                        <p className="text-xs text-red-600 font-medium">This exceeds the remaining balance of {fmt(Math.max(0, quoteTotal - previouslyPaid))}. Reduce the amount or confirm before saving.</p>
                      </>
                    ) : (
                      <div className="flex justify-between font-bold text-green-800 border-t border-green-200 pt-1.5">
                        <span>Balance after saving</span>
                        <span>{entryBalance === 0 ? '✓ Paid in full' : fmt(entryBalance!)}</span>
                      </div>
                    )}
                  </>}
                  {quoteTotal === 0 && <div className="flex justify-between font-bold text-green-800"><span>Amount received</span><span className="text-xl">{fmt(parsedAmount)}</span></div>}
                </div>
              )}
            </div>
          )}

          {/* ── CC (compact, inline) ──────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">CC Copies</span>
              <button onClick={() => setShowTeamPicker(p => !p)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#1e3a5f] bg-blue-50 px-2.5 py-1.5 rounded-lg hover:bg-blue-100">
                <UserPlus className="w-3.5 h-3.5" /> Add team member
              </button>
            </div>
            {showTeamPicker && (
              <div className="border border-gray-200 rounded-xl mb-2 divide-y divide-gray-100 max-h-40 overflow-y-auto">
                {teamMembers.map(m => {
                  const sel = ccEmails.includes(m.email);
                  return (
                    <button key={m.id} onClick={() => toggleCC(m.email)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 ${sel ? 'bg-blue-50' : ''}`}>
                      <div className="w-7 h-7 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {(m.full_name ?? '').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.full_name}</p>
                        <p className="text-xs text-gray-500 truncate">{m.email}</p>
                      </div>
                      {sel && <Check className="w-4 h-4 text-[#1e3a5f] flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
            {ccEmails.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {ccEmails.map(email => (
                  <span key={email} className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-xs text-[#1e3a5f] font-medium">
                    {email} <button onClick={() => toggleCC(email)} className="text-gray-400 hover:text-red-500">×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input type="email"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none"
                value={ccInput} onChange={e => setCcInput(e.target.value)}
                placeholder="Or type an email address…" onKeyDown={e => e.key === 'Enter' && addManualCC()} />
              <button onClick={addManualCC} className="px-3 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-semibold hover:bg-[#2d5a8e]">Add</button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 space-y-2 flex-shrink-0">
          {quote.completion_certificate_enabled && quote.customer?.email && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
              <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeCert}
                  onChange={e => setIncludeCert(e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-600"
                />
                <span className="text-sm text-amber-800 font-medium">Also send Completion Certificate</span>
              </label>

              {includeCert && (
                <div className="px-3 pb-3 border-t border-amber-100">
                  {!certPhotosLoaded ? (
                    <div className="flex items-center gap-2 pt-2 text-xs text-amber-700">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading photos…
                    </div>
                  ) : certPhotos.length === 0 ? (
                    <p className="pt-2 text-xs text-amber-700">
                      No completion photos saved yet — add photos via "Completion Photos &amp; Cert" in the action menu.
                    </p>
                  ) : (
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-amber-800 font-medium">
                          {selectedCertPhotoUrls.size} of {certPhotos.length} photo{certPhotos.length !== 1 ? 's' : ''} selected
                        </span>
                        <div className="flex gap-3 text-xs font-medium">
                          <button
                            type="button"
                            onClick={() => setSelectedCertPhotoUrls(new Set(certPhotos.map((p: any) => p.photo_url)))}
                            className="text-amber-600 hover:text-amber-700"
                          >
                            All
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedCertPhotoUrls(new Set())}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            None
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {certPhotos.map((photo: any) => {
                          const selected = selectedCertPhotoUrls.has(photo.photo_url);
                          return (
                            <button
                              key={photo.photo_url}
                              type="button"
                              onClick={() => setSelectedCertPhotoUrls(prev => {
                                const next = new Set(prev);
                                if (next.has(photo.photo_url)) next.delete(photo.photo_url);
                                else next.add(photo.photo_url);
                                return next;
                              })}
                              className={`relative rounded overflow-hidden border-2 transition-all ${
                                selected ? 'border-amber-500' : 'border-gray-200 opacity-40'
                              }`}
                            >
                              <img src={photo.photo_url} alt={photo.caption || ''} className="w-full h-14 object-cover" />
                              <div className={`absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center ${
                                selected ? 'bg-amber-500' : 'bg-white border border-gray-300'
                              }`}>
                                {selected && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => actingOnLatest ? void previewExisting(latestReceipt!) : void handlePreview()}
            disabled={previewing || sending || saving || !!rowBusy || (!actingOnLatest && !isResend && !draftLoaded && parsedAmount <= 0)}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors disabled:opacity-50">
            {previewing || rowBusy?.action === 'preview' ? <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Eye className="w-4 h-4" />}
            {previewing || rowBusy?.action === 'preview'
              ? 'Building…'
              : actingOnLatest ? `Preview Receipt #${latestReceipt!.receipt_number}` : 'Preview Receipt'}
          </button>
          {quote.customer?.email && (
            <button
              onClick={() => actingOnLatest ? void sendExisting(latestReceipt!) : void handleSend()}
              disabled={sending || saving || !!rowBusy || (!actingOnLatest && !isResend && !draftLoaded && parsedAmount <= 0)}
              className="w-full flex items-center justify-center gap-2 bg-[#ff6b35] hover:bg-[#e55a2b] text-white font-bold py-3.5 rounded-xl text-base transition-colors disabled:opacity-50">
              {sending || rowBusy?.action === 'send' ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-5 h-5" />}
              {sending || rowBusy?.action === 'send'
                ? 'Sending…'
                : isResend ? 'Resend Receipt'
                : draftLoaded ? 'Send Saved Receipt'
                : actingOnLatest ? `Resend Receipt #${latestReceipt!.receipt_number}`
                : 'Save & Send Receipt'}
            </button>
          )}
          {/* Hidden once a saved payment is loaded: this always inserts a new
              payment, so offering it here would record the same money twice. */}
          {!isResend && !draftLoaded && (
            <button onClick={handleSaveOnly}
              disabled={saving || sending || parsedAmount <= 0}
              className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors disabled:opacity-50">
              {saving ? <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Without Sending'}
            </button>
          )}
        </div>
      </div>

      {/* ── Receipt preview ────────────────────────────────────────────────
           Portaled to body, and print unwinds the overlay: a fixed, clipped
           box collapses to zero height when printed, which is how the signed
           certificate ended up printing a blank sheet. ── */}
      {previewHtml && createPortal(
        <div className="receipt-preview-modal fixed inset-0 z-[80] bg-gray-900/50 flex items-center justify-center p-4">
          <style>{`
            @media print {
              body > *:not(.receipt-preview-modal) { display: none !important; }
              html, body { height: auto !important; overflow: visible !important; }
              .receipt-preview-modal {
                position: static !important; display: block !important;
                height: auto !important; max-height: none !important;
                overflow: visible !important; background: none !important; padding: 0 !important;
              }
              .receipt-preview-shell {
                box-shadow: none !important; border-radius: 0 !important;
                max-height: none !important; height: auto !important; width: 100% !important;
              }
              .receipt-preview-scroll { overflow: visible !important; height: auto !important; max-height: none !important; }
              .receipt-preview-bar { display: none !important; }
            }
          `}</style>
          <div className="receipt-preview-shell bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="receipt-preview-bar flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
              <div>
                <p className="font-semibold text-gray-900 text-sm">Receipt preview</p>
                <p className="text-xs text-gray-500">This is exactly what {customerName || 'the customer'} will receive. Nothing has been sent or recorded yet.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button onClick={() => setPreviewHtml(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="receipt-preview-scroll flex-1 overflow-y-auto bg-gray-50">
              <div
                className="mx-auto my-4 bg-white"
                style={{ maxWidth: 680 }}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { DollarSign, Link2, Loader2, X, Copy, Check, Mail, User } from 'lucide-react';
import { toast } from 'sonner';
import { toLocalDateString } from '@/lib/dates';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import {
  recordPayment,
  createStripePaymentLink,
  getStripeApiKey,
  sendPaymentReceipt,
  PAYMENT_METHOD_LABELS,
  type Payment,
  type RecordPaymentParams,
} from '../../services/paymentService';

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required — every payment must be tied to a contact */
  contactId: string;
  contactName: string;
  /** Optional email to pre-fill receipt field */
  contactEmail?: string;
  companyId: string;
  companyName?: string;
  workOrderId?: string;
  processorId: string;
  processorName: string;
  onPaymentRecorded: (payment: Payment) => void;
}

type PaymentMode = 'manual' | 'stripe_link';

// Manual methods include 'external' for payments processed in other systems
const MANUAL_METHODS: Array<{ value: Payment['payment_method']; label: string; hint?: string }> = [
  { value: 'cash',            label: 'Cash' },
  { value: 'check',           label: 'Check' },
  { value: 'credit_card',     label: 'Credit Card' },
  { value: 'ach',             label: 'ACH / Bank' },
  { value: 'insurance_check', label: 'Insurance Check' },
  { value: 'external',        label: 'External System', hint: 'Processed in Sage, QuickBooks, etc.' },
  { value: 'other',           label: 'Other' },
];

export default function PaymentModal({
  open,
  onOpenChange,
  contactId,
  contactName,
  contactEmail,
  companyId,
  companyName,
  workOrderId,
  processorId,
  processorName,
  onPaymentRecorded,
}: PaymentModalProps) {
  const [mode, setMode] = useState<PaymentMode>('manual');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Payment['payment_method']>('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(toLocalDateString());
  const [saving, setSaving] = useState(false);

  // Receipt state
  const [lastPayment, setLastPayment] = useState<Payment | null>(null);
  const [receiptEmail, setReceiptEmail] = useState(contactEmail || '');
  const [sendingReceipt, setSendingReceipt] = useState(false);
  const [receiptSent, setReceiptSent] = useState(false);

  // Stripe payment link state
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkRecorded, setLinkRecorded] = useState(false);

  const reset = () => {
    setMode('manual');
    setAmount('');
    setMethod('cash');
    setReferenceNumber('');
    setNotes('');
    setPaymentDate(toLocalDateString());
    setGeneratedLink(null);
    setLinkId(null);
    setLinkCopied(false);
    setLinkRecorded(false);
    setLastPayment(null);
    setReceiptEmail(contactEmail || '');
    setReceiptSent(false);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  // ── Manual payment ──────────────────────────────────────────────────────────
  const handleRecordManual = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!contactId) {
      toast.error('No contact selected — payment cannot be saved without a contact');
      return;
    }

    setSaving(true);
    try {
      const params: RecordPaymentParams = {
        contact_id: contactId,
        work_order_id: workOrderId,
        company_id: companyId,
        amount: parsedAmount,
        payment_method: method,
        reference_number: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        processed_by: processorId,
        processed_by_name: processorName,
        payment_date: new Date(paymentDate).toISOString(),
      };

      const payment = await recordPayment(params);
      setLastPayment(payment);
      toast.success(`$${parsedAmount.toFixed(2)} payment recorded for ${contactName}`);
      onPaymentRecorded(payment);
    } catch {
      toast.error('Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  // ── Send receipt ────────────────────────────────────────────────────────────
  const handleSendReceipt = async () => {
    if (!lastPayment || !receiptEmail.trim()) return;
    setSendingReceipt(true);
    try {
      await sendPaymentReceipt({
        toEmail: receiptEmail.trim(),
        contactName,
        companyName: companyName || 'Your Contractor',
        amount: lastPayment.amount,
        paymentMethod: lastPayment.payment_method,
        referenceNumber: lastPayment.reference_number,
        paymentDate: lastPayment.payment_date,
        notes: lastPayment.notes,
      });
      setReceiptSent(true);
      toast.success('Receipt sent to ' + receiptEmail.trim());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send receipt');
    } finally {
      setSendingReceipt(false);
    }
  };

  // ── Stripe payment link ─────────────────────────────────────────────────────
  const handleGenerateLink = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    setGeneratingLink(true);
    try {
      const stripeKey = await getStripeApiKey(companyId);
      if (!stripeKey) {
        toast.error('Stripe is not connected. Go to Settings → Integrations to connect it.');
        return;
      }

      const description = `Payment — ${contactName}`;
      const { url, id } = await createStripePaymentLink(parsedAmount, description, stripeKey);
      setGeneratedLink(url);
      setLinkId(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate payment link');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error('Copy failed — please copy the link manually');
    }
  };

  const handleRecordLinkPayment = async () => {
    if (!generatedLink || !linkId) return;
    const parsedAmount = parseFloat(amount);

    setSaving(true);
    try {
      const params: RecordPaymentParams = {
        contact_id: contactId,
        work_order_id: workOrderId,
        company_id: companyId,
        amount: parsedAmount,
        payment_method: 'stripe_payment_link',
        notes: notes.trim() || undefined,
        processed_by: processorId,
        processed_by_name: processorName,
        stripe_payment_link_url: generatedLink,
      };

      const payment = await recordPayment(params);
      setLastPayment(payment);
      setLinkRecorded(true);
      toast.success('Payment link recorded — customer will complete payment via Stripe');
      onPaymentRecorded(payment);
    } catch {
      toast.error('Failed to record payment link');
    } finally {
      setSaving(false);
    }
  };

  // ── Receipt panel (shown after any payment is recorded) ────────────────────
  const ReceiptPanel = () => (
    <div className="mt-5 bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Check size={16} className="text-emerald-600 flex-shrink-0" />
        <span className="text-sm font-bold text-emerald-800">Payment recorded for {contactName}</span>
      </div>
      <p className="text-xs text-emerald-700">Send the customer an email receipt:</p>
      <div className="flex gap-2">
        <input
          type="email"
          value={receiptEmail}
          onChange={(e) => setReceiptEmail(e.target.value)}
          placeholder="customer@email.com"
          className="flex-1 px-3 py-2 text-sm border border-emerald-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
        />
        <button
          onClick={handleSendReceipt}
          disabled={sendingReceipt || receiptSent || !receiptEmail.trim()}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl disabled:opacity-50 hover:bg-emerald-700 transition-colors"
        >
          {sendingReceipt ? (
            <Loader2 size={14} className="animate-spin" />
          ) : receiptSent ? (
            <Check size={14} />
          ) : (
            <Mail size={14} />
          )}
          {receiptSent ? 'Sent' : 'Send Receipt'}
        </button>
      </div>
      <button
        onClick={handleClose}
        className="w-full py-2 text-xs font-bold text-emerald-700 hover:text-emerald-900 transition-colors"
      >
        Close
      </button>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] overflow-y-auto pb-8">
        <SheetHeader className="mb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-bold">Record Payment</SheetTitle>
            <button onClick={handleClose} className="p-1 text-slate-400 hover:text-slate-700">
              <X size={20} />
            </button>
          </div>
          {/* Contact header — always visible so there's no confusion about who this is for */}
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl mt-1">
            <User size={14} className="text-blue-500 flex-shrink-0" />
            <span className="text-xs font-bold text-blue-800">{contactName}</span>
          </div>
        </SheetHeader>

        {/* If payment already recorded — show receipt panel */}
        {lastPayment && mode === 'manual' ? (
          <ReceiptPanel />
        ) : (
          <>
            {/* Mode toggle */}
            <div className="flex rounded-xl bg-slate-100 p-1 mb-5">
              <button
                onClick={() => setMode('manual')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                  mode === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                <DollarSign size={14} />
                Manual / External
              </button>
              <button
                onClick={() => setMode('stripe_link')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                  mode === 'stripe_link' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                <Link2 size={14} />
                Stripe Link
              </button>
            </div>

            {mode === 'manual' && (
              <p className="text-[11px] text-slate-400 mb-4 -mt-2">
                Use "External System" method if the payment was processed in Sage, QuickBooks, or another tool — it will still be recorded and tracked here.
              </p>
            )}

            {/* Amount (shared) */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-3 text-base font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {mode === 'manual' ? (
              <>
                {/* Payment method */}
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Method *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {MANUAL_METHODS.map((m) => (
                      <button
                        key={m.value}
                        onClick={() => setMethod(m.value)}
                        className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                          method === m.value
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {MANUAL_METHODS.find(m => m.value === method)?.hint && (
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      {MANUAL_METHODS.find(m => m.value === method)?.hint}
                    </p>
                  )}
                </div>

                {/* Date */}
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Payment Date *</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Reference */}
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Reference # <span className="font-normal text-slate-400">(check #, transaction ID, invoice #, etc.)</span>
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Notes */}
                <div className="mb-6">
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes..."
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <button
                  onClick={handleRecordManual}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
                  {saving ? 'Recording...' : 'Record Payment'}
                </button>
              </>
            ) : (
              <>
                {/* Notes for Stripe link */}
                <div className="mb-5">
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes..."
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                {!generatedLink ? (
                  <button
                    onClick={handleGenerateLink}
                    disabled={generatingLink}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {generatingLink ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                    {generatingLink ? 'Generating link...' : 'Generate Payment Link'}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Payment Link</p>
                      <p className="text-xs text-blue-600 break-all">{generatedLink}</p>
                    </div>

                    <button
                      onClick={handleCopyLink}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 text-white text-sm font-bold rounded-xl hover:bg-slate-900 transition-colors"
                    >
                      {linkCopied ? <Check size={16} /> : <Copy size={16} />}
                      {linkCopied ? 'Copied!' : 'Copy Link'}
                    </button>

                    {!linkRecorded ? (
                      <button
                        onClick={handleRecordLinkPayment}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
                        {saving ? 'Recording...' : 'Record & Mark Pending'}
                      </button>
                    ) : (
                      <>
                        <div className="flex items-center justify-center gap-2 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                          <Check size={16} className="text-emerald-600" />
                          <span className="text-sm font-bold text-emerald-700">Link recorded in timeline</span>
                        </div>
                        {lastPayment && <ReceiptPanel />}
                      </>
                    )}

                    <p className="text-[11px] text-slate-400 text-center">
                      Share this link with the customer. They pay on their phone — Stripe sends the receipt automatically.
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

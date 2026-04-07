import React, { useState } from 'react';
import { DollarSign, Link2, Loader2, X, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
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
  PAYMENT_METHOD_LABELS,
  type Payment,
  type RecordPaymentParams,
} from '../../services/paymentService';

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  companyId: string;
  workOrderId?: string;
  processorId: string;
  processorName: string;
  onPaymentRecorded: (payment: Payment) => void;
}

type PaymentMode = 'manual' | 'stripe_link';

const MANUAL_METHODS: Array<{ value: Payment['payment_method']; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'ach', label: 'ACH / Bank Transfer' },
  { value: 'insurance_check', label: 'Insurance Check' },
  { value: 'other', label: 'Other' },
];

export default function PaymentModal({
  open,
  onOpenChange,
  contactId,
  contactName,
  companyId,
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
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

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
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setGeneratedLink(null);
    setLinkId(null);
    setLinkCopied(false);
    setLinkRecorded(false);
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
      toast.success(`$${parsedAmount.toFixed(2)} payment recorded`);
      onPaymentRecorded(payment);
      handleClose();
    } catch {
      toast.error('Failed to record payment');
    } finally {
      setSaving(false);
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
      setLinkRecorded(true);
      toast.success('Payment link recorded — customer will complete payment via Stripe');
      onPaymentRecorded(payment);
    } catch {
      toast.error('Failed to record payment link');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto pb-8">
        <SheetHeader className="mb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-bold">Record Payment</SheetTitle>
            <button onClick={handleClose} className="p-1 text-slate-400 hover:text-slate-700">
              <X size={20} />
            </button>
          </div>
          <p className="text-xs text-slate-500">{contactName}</p>
        </SheetHeader>

        {/* Mode toggle */}
        <div className="flex rounded-xl bg-slate-100 p-1 mb-5">
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === 'manual'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            <DollarSign size={14} />
            Manual
          </button>
          <button
            onClick={() => setMode('stripe_link')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === 'stripe_link'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            <Link2 size={14} />
            Stripe Link
          </button>
        </div>

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
                Reference # <span className="font-normal text-slate-400">(check #, last 4, etc.)</span>
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
                {generatingLink ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Link2 size={16} />
                )}
                {generatingLink ? 'Generating link...' : 'Generate Payment Link'}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                    Payment Link
                  </p>
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
                  <div className="flex items-center justify-center gap-2 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <Check size={16} className="text-emerald-600" />
                    <span className="text-sm font-bold text-emerald-700">Link recorded in timeline</span>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 text-center">
                  Share this link with the customer. They pay on their phone — Stripe sends the receipt automatically.
                </p>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

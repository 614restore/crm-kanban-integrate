import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/authContext';
import { formatCurrency } from '@/lib/crmData';
import { toast } from 'sonner';
import { X, Plus, Trash2, Save, Send, DollarSign, Copy, CheckCircle2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChangeOrderItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ChangeOrder {
  id: string;
  company_id: string;
  contact_id: string;
  change_order_number: string;
  title: string;
  description: string | null;
  status: 'draft' | 'sent' | 'signed' | 'approved' | 'rejected';
  subtotal: number;
  tax: number;
  total: number;
  items: ChangeOrderItem[];
  sign_token: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  sent_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChangeOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  contactId: string;
  contactName: string;
  changeOrder?: ChangeOrder | null;
  companyId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function generateChangeOrderNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from('change_orders')
    .select('change_order_number')
    .eq('company_id', companyId)
    .like('change_order_number', `CO-${year}-%`);

  const count = (data?.length ?? 0) + 1;
  return `CO-${year}-${String(count).padStart(3, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChangeOrderModal({
  isOpen,
  onClose,
  onSave,
  contactId,
  contactName,
  changeOrder,
  companyId,
}: ChangeOrderModalProps) {
  const { profile } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [items, setItems] = useState<ChangeOrderItem[]>([
    { description: '', quantity: 1, unitPrice: 0, total: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [signLink, setSignLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const signLinkRef = useRef<HTMLInputElement>(null);

  // Populate form when editing an existing change order
  useEffect(() => {
    if (changeOrder) {
      setTitle(changeOrder.title);
      setDescription(changeOrder.description ?? '');
      setNotes(changeOrder.notes ?? '');
      setTaxRate(
        changeOrder.subtotal > 0
          ? parseFloat(((changeOrder.tax / changeOrder.subtotal) * 100).toFixed(4))
          : 0
      );
      setItems(
        changeOrder.items?.length
          ? changeOrder.items
          : [{ description: '', quantity: 1, unitPrice: 0, total: 0 }]
      );
      if (changeOrder.sign_token && changeOrder.status === 'sent') {
        setSignLink(`${window.location.origin}/sign-change-order/${changeOrder.sign_token}`);
      }
    } else {
      setTitle('');
      setDescription('');
      setNotes('');
      setTaxRate(0);
      setItems([{ description: '', quantity: 1, unitPrice: 0, total: 0 }]);
      setSignLink(null);
    }
    setCopied(false);
  }, [changeOrder, isOpen]);

  if (!isOpen) return null;

  // ── Calculated totals ──────────────────────────────────────────────────────

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  // ── Line item handlers ─────────────────────────────────────────────────────

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof ChangeOrderItem,
    value: string | number
  ) => {
    const newItems = [...items];
    if (field === 'description') {
      newItems[index].description = value as string;
    } else if (field === 'quantity') {
      newItems[index].quantity = Number(value) || 0;
      newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
    } else if (field === 'unitPrice') {
      newItems[index].unitPrice = Number(value) || 0;
      newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
    }
    setItems(newItems);
  };

  // ── Save helpers ───────────────────────────────────────────────────────────

  const buildPayload = (
    status: ChangeOrder['status'],
    signToken?: string,
    sentAt?: string
  ) => ({
    company_id: companyId,
    contact_id: contactId,
    title,
    description: description || null,
    status,
    subtotal,
    tax: taxAmount,
    total,
    items,
    notes: notes || null,
    created_by: profile?.id ?? null,
    ...(signToken !== undefined ? { sign_token: signToken } : {}),
    ...(sentAt !== undefined ? { sent_at: sentAt } : {}),
  });

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      if (changeOrder?.id) {
        const { error } = await supabase
          .from('change_orders')
          .update(buildPayload('draft'))
          .eq('id', changeOrder.id);
        if (error) throw error;
      } else {
        const number = await generateChangeOrderNumber(companyId);
        const { error } = await supabase
          .from('change_orders')
          .insert({ ...buildPayload('draft'), change_order_number: number });
        if (error) throw error;
      }
      toast.success('Change order saved as draft');
      onSave();
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save change order');
    } finally {
      setSaving(false);
    }
  };

  const handleSendForSignature = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      const token = changeOrder?.sign_token ?? generateToken();
      const sentAt = new Date().toISOString();
      const link = `${window.location.origin}/sign-change-order/${token}`;

      if (changeOrder?.id) {
        const { error } = await supabase
          .from('change_orders')
          .update(buildPayload('sent', token, sentAt))
          .eq('id', changeOrder.id);
        if (error) throw error;
      } else {
        const number = await generateChangeOrderNumber(companyId);
        const { error } = await supabase
          .from('change_orders')
          .insert({ ...buildPayload('sent', token, sentAt), change_order_number: number });
        if (error) throw error;
      }

      setSignLink(link);
      toast.success('Change order sent for signature');
      onSave();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send change order');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (!signLink) return;
    navigator.clipboard.writeText(signLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleClose = () => {
    setSignLink(null);
    onClose();
  };

  const isEditing = Boolean(changeOrder?.id);
  const isSigned = changeOrder?.status === 'signed';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Change Order' : 'New Change Order'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {contactName}
              {changeOrder?.change_order_number && (
                <span className="ml-2 font-medium text-gray-700">
                  · {changeOrder.change_order_number}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Signed banner */}
        {isSigned && (
          <div className="flex items-center gap-2 px-6 py-3 bg-green-50 border-b border-green-200 text-green-800 flex-shrink-0">
            <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
            <span className="font-medium">Signed ✓</span>
            {changeOrder.signed_by_name && (
              <span className="text-sm">by {changeOrder.signed_by_name}</span>
            )}
            {changeOrder.signed_at && (
              <span className="text-sm text-green-600 ml-auto">
                {new Date(changeOrder.signed_at).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            )}
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-6">

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Additional flashing repair"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe the scope of this change order..."
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
              />
            </div>

            {/* Line Items */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Line Items</label>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      placeholder="Description"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                    <input
                      type="number"
                      value={item.quantity || ''}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      placeholder="Qty"
                      min={0}
                      className="w-20 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-center"
                    />
                    <div className="relative w-32">
                      <DollarSign
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="number"
                        value={item.unitPrice || ''}
                        onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                        placeholder="Price"
                        min={0}
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="w-28 text-right font-medium text-gray-900">
                      {formatCurrency(item.total)}
                    </div>
                    {items.length > 1 && (
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddItem}
                className="mt-3 flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                <Plus size={16} />
                Add Line Item
              </button>
            </div>

            {/* Tax & Totals */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <div className="flex items-center gap-2">
                    <span>Tax</span>
                    <input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      min={0}
                      max={100}
                      step={0.01}
                      className="w-16 px-2 py-1 border border-gray-200 rounded text-center text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                    <span className="text-sm">%</span>
                  </div>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Additional notes or conditions..."
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
              />
            </div>

            {/* Sign link (shown after sending or if already sent) */}
            {signLink && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Signature Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={signLinkRef}
                    type="text"
                    readOnly
                    value={signLink}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700 outline-none select-all"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700 whitespace-nowrap"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 size={15} className="text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy size={15} />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3 flex-shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveDraft}
            disabled={saving || isSigned}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={18} />
            Save as Draft
          </button>
          <button
            onClick={handleSendForSignature}
            disabled={saving || isSigned}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
            Send for Signature
          </button>
        </div>

      </div>
    </div>
  );
}

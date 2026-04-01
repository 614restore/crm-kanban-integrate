import React, { useState } from 'react';
import { DollarSign, Calendar, CreditCard, Plus, X, Check } from 'lucide-react';
import { toast } from 'sonner';

export interface InvoicePayment {
  id: string;
  amount: number;
  paymentMethod: 'cash' | 'check' | 'credit_card' | 'ach' | 'insurance_check' | 'other';
  paymentDate: string;
  referenceNumber?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

interface PaymentHistoryProps {
  payments: InvoicePayment[];
  invoiceTotal: number;
  onAddPayment: (payment: Omit<InvoicePayment, 'id' | 'createdAt'>) => Promise<void>;
  onDeletePayment?: (paymentId: string) => Promise<void>;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: DollarSign },
  { value: 'check', label: 'Check', icon: Check },
  { value: 'credit_card', label: 'Credit Card', icon: CreditCard },
  { value: 'ach', label: 'ACH/Bank Transfer', icon: DollarSign },
  { value: 'insurance_check', label: 'Insurance Check', icon: Check },
  { value: 'other', label: 'Other', icon: DollarSign },
];

export default function PaymentHistory({
  payments,
  invoiceTotal,
  onAddPayment,
  onDeletePayment,
}: PaymentHistoryProps) {
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<InvoicePayment['paymentMethod']>('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = invoiceTotal - totalPaid;
  const isPaid = balanceDue <= 0;

  const handleAddPayment = async () => {
    const paymentAmount = parseFloat(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    if (paymentAmount > balanceDue) {
      toast.error(`Payment amount cannot exceed balance due ($${balanceDue.toFixed(2)})`);
      return;
    }

    setIsSaving(true);
    try {
      await onAddPayment({
        amount: paymentAmount,
        paymentMethod,
        paymentDate: new Date(paymentDate).toISOString(),
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      // Reset form
      setAmount('');
      setPaymentMethod('cash');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setReferenceNumber('');
      setNotes('');
      setShowAddPayment(false);
      toast.success('Payment recorded');
    } catch (error) {
      toast.error('Failed to record payment');
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getPaymentMethodLabel = (method: string) => {
    return PAYMENT_METHODS.find((m) => m.value === method)?.label || method;
  };

  return (
    <div className="space-y-4">
      {/* Payment Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Invoice Total</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(invoiceTotal)}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <p className="text-xs text-gray-500 mb-1">Total Paid</p>
          <p className="text-lg font-bold text-green-700">{formatCurrency(totalPaid)}</p>
        </div>
        <div className={`rounded-lg p-4 border ${isPaid ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
          <p className="text-xs text-gray-500 mb-1">Balance Due</p>
          <p className={`text-lg font-bold ${isPaid ? 'text-green-700' : 'text-orange-700'}`}>
            {formatCurrency(balanceDue)}
          </p>
        </div>
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Payment History</h4>
          <div className="space-y-2">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(payment.amount)}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                      {getPaymentMethodLabel(payment.paymentMethod)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(payment.paymentDate)}
                    </span>
                  </div>
                  {payment.referenceNumber && (
                    <p className="text-xs text-gray-500 mt-1">
                      Ref: {payment.referenceNumber}
                    </p>
                  )}
                  {payment.notes && (
                    <p className="text-xs text-gray-600 mt-1">{payment.notes}</p>
                  )}
                </div>
                {onDeletePayment && (
                  <button
                    onClick={() => onDeletePayment(payment.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Payment Button/Form */}
      {!isPaid && (
        <>
          {showAddPayment ? (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">Record Payment</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Amount *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    max={balanceDue}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Reference # (Check #, Last 4, etc.)
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional payment notes..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAddPayment}
                  disabled={isSaving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <DollarSign size={16} />
                  {isSaving ? 'Recording...' : 'Record Payment'}
                </button>
                <button
                  onClick={() => setShowAddPayment(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddPayment(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus size={18} />
              Record Payment
            </button>
          )}
        </>
      )}

      {/* Paid in Full Badge */}
      {isPaid && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <Check size={24} className="text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">Paid in Full</p>
            <p className="text-xs text-green-600">
              All payments received. Invoice is complete.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

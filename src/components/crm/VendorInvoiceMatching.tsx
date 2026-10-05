import React, { useState } from 'react';
import { Upload, CheckCircle, XCircle, AlertTriangle, FileText, DollarSign } from 'lucide-react';
import { MaterialOrder, MaterialOrderItem } from '@/lib/crmData';
import { toLocalDateString } from '@/lib/dates';

interface VendorInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  uploadedFile?: File;
  uploadedUrl?: string;
  items: MaterialOrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
}

interface InvoiceMatchingProps {
  materialOrder: MaterialOrder;
  onInvoiceUploaded?: (invoice: VendorInvoice) => void;
}

export function VendorInvoiceMatching({ materialOrder, onInvoiceUploaded }: InvoiceMatchingProps) {
  const [vendorInvoice, setVendorInvoice] = useState<VendorInvoice | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    // Simulate file upload and OCR processing
    // In production, this would call an API to process the invoice
    setTimeout(() => {
      // Mock parsed invoice data
      const mockInvoice: VendorInvoice = {
        id: crypto.randomUUID(),
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        invoiceDate: toLocalDateString(),
        uploadedFile: file,
        items: materialOrder.items.map(item => ({
          ...item,
          // Simulate slight price differences
          unitPrice: item.unitPrice * (0.95 + Math.random() * 0.1),
          total: item.total * (0.95 + Math.random() * 0.1),
        })),
        subtotal: materialOrder.subtotal * (0.95 + Math.random() * 0.1),
        tax: materialOrder.tax * (0.95 + Math.random() * 0.1),
        shipping: materialOrder.shipping * (0.95 + Math.random() * 0.1),
        total: materialOrder.total * (0.95 + Math.random() * 0.1),
      };

      setVendorInvoice(mockInvoice);
      setIsUploading(false);
      onInvoiceUploaded?.(mockInvoice);
    }, 2000);
  };

  const calculateVariance = (poAmount: number, invoiceAmount: number) => {
    const diff = invoiceAmount - poAmount;
    const percentDiff = poAmount > 0 ? (diff / poAmount) * 100 : 0;
    return { diff, percentDiff };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const totalVariance = vendorInvoice ? calculateVariance(materialOrder.total, vendorInvoice.total) : null;
  const isOvercharged = totalVariance && totalVariance.diff > 0;
  const isSignificantVariance = totalVariance && Math.abs(totalVariance.percentDiff) > 5;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">Vendor Invoice Matching</h3>
            <p className="text-indigo-100 text-sm">Compare PO vs Actual Invoice</p>
          </div>
          <FileText size={32} className="text-white/80" />
        </div>
      </div>

      {/* Upload Section */}
      {!vendorInvoice && (
        <div className="p-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors">
            <Upload size={48} className="mx-auto text-gray-400 mb-4" />
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Upload Vendor Invoice</h4>
            <p className="text-sm text-gray-600 mb-4">
              Upload the actual invoice from {materialOrder.supplierName} to compare against your PO
            </p>
            <label className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors">
              <Upload size={20} />
              {isUploading ? 'Processing...' : 'Choose File'}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
              />
            </label>
            <p className="text-xs text-gray-500 mt-2">Supports PDF, JPG, PNG</p>
          </div>

          {/* PO Summary */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h5 className="text-sm font-semibold text-gray-900 mb-3">Purchase Order Summary</h5>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">PO Number:</span>
                <span className="font-medium text-gray-900">{materialOrder.orderNumber || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Supplier:</span>
                <span className="font-medium text-gray-900">{materialOrder.supplierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">PO Total:</span>
                <span className="font-bold text-indigo-600">{formatCurrency(materialOrder.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparison View */}
      {vendorInvoice && (
        <div className="p-6 space-y-6">
          {/* Summary Alert */}
          {isSignificantVariance && (
            <div className={`p-4 rounded-lg border ${isOvercharged ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <div className="flex items-start gap-3">
                {isOvercharged ? (
                  <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <h5 className={`text-sm font-semibold mb-1 ${isOvercharged ? 'text-red-900' : 'text-green-900'}`}>
                    {isOvercharged ? '⚠️ Potential Overcharge Detected' : '✓ Invoice Under PO Amount'}
                  </h5>
                  <p className={`text-xs ${isOvercharged ? 'text-red-700' : 'text-green-700'}`}>
                    Invoice is {formatCurrency(Math.abs(totalVariance.diff))} {isOvercharged ? 'higher' : 'lower'} than PO
                    ({Math.abs(totalVariance.percentDiff).toFixed(1)}% variance)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Line Item Comparison */}
          <div>
            <h5 className="text-sm font-semibold text-gray-900 mb-3">Line Item Comparison</h5>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Item</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">PO Price</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Invoice Price</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-700">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {materialOrder.items.map((poItem, index) => {
                    const invoiceItem = vendorInvoice.items[index];
                    const variance = calculateVariance(poItem.total, invoiceItem.total);
                    const isItemOver = variance.diff > 0;
                    const isSignificant = Math.abs(variance.percentDiff) > 5;

                    return (
                      <tr key={poItem.id} className={isSignificant ? (isItemOver ? 'bg-red-50' : 'bg-green-50') : ''}>
                        <td className="px-4 py-3 text-gray-900">
                          {poItem.description}
                          <div className="text-xs text-gray-500">
                            {poItem.quantity} {poItem.unit}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(poItem.total)}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(invoiceItem.total)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className={`flex items-center justify-end gap-1 ${isItemOver ? 'text-red-600' : variance.diff < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                            {isItemOver ? <XCircle size={14} /> : variance.diff < 0 ? <CheckCircle size={14} /> : null}
                            <span className="font-medium">
                              {variance.diff >= 0 ? '+' : ''}{formatCurrency(variance.diff)}
                            </span>
                            <span className="text-xs">
                              ({variance.percentDiff >= 0 ? '+' : ''}{variance.percentDiff.toFixed(1)}%)
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Comparison */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h6 className="text-xs font-semibold text-gray-500 uppercase mb-3">Purchase Order</h6>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium text-gray-900">{formatCurrency(materialOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax:</span>
                  <span className="font-medium text-gray-900">{formatCurrency(materialOrder.tax)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping:</span>
                  <span className="font-medium text-gray-900">{formatCurrency(materialOrder.shipping)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-bold text-gray-900">Total:</span>
                  <span className="font-bold text-indigo-600">{formatCurrency(materialOrder.total)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
              <h6 className="text-xs font-semibold text-indigo-700 uppercase mb-3">Vendor Invoice</h6>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium text-gray-900">{formatCurrency(vendorInvoice.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax:</span>
                  <span className="font-medium text-gray-900">{formatCurrency(vendorInvoice.tax)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping:</span>
                  <span className="font-medium text-gray-900">{formatCurrency(vendorInvoice.shipping)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-indigo-200">
                  <span className="font-bold text-gray-900">Total:</span>
                  <span className={`font-bold ${isOvercharged ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(vendorInvoice.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              onClick={() => setVendorInvoice(null)}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Upload Different Invoice
            </button>
            <div className="flex items-center gap-3">
              {isOvercharged && (
                <button className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors">
                  Dispute Charges
                </button>
              )}
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                Approve & Pay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

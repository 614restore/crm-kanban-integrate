import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import SignaturePad from "@/components/ui/SignaturePad";

const API_BASE = "/api/document-handler?action=sign-change-order";

interface ChangeOrderItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface ChangeOrder {
  id: string;
  change_order_number: string;
  title: string;
  description?: string;
  total: number;
  subtotal: number;
  tax?: number;
  notes?: string;
  items?: ChangeOrderItem[];
  status: string;
  signed_by_name?: string;
  signed_at?: string;
  sign_token: string;
  companies?: {
    name: string;
    from_email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
}

export default function SignChangeOrder() {
  const { token } = useParams<{ token: string }>();
  const [changeOrder, setChangeOrder] = useState<ChangeOrder | null>(null);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [signedBy, setSignedBy] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}?token=${token}`)
      .then((res) => {
        if (!res.ok) throw new Error("Change order not found or link is invalid.");
        return res.json();
      })
      .then((data) => {
        setChangeOrder(data.changeOrder);
        setAlreadySigned(data.alreadySigned);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signedBy.trim()) { setSubmitError("Please enter your full name."); return; }
    if (!signatureData) { setSubmitError("Please provide your signature."); return; }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, signedBy: signedBy.trim(), signatureData }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to submit signature.");
      }
      setSuccess(true);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-sm">Loading change order…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-lg font-semibold text-gray-800 mb-2">Unable to Load Change Order</h1>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Change Order Signed!</h1>
          <p className="text-gray-500 text-sm">
            Thank you, <span className="font-medium text-gray-700">{signedBy}</span>. Your signature has been
            recorded and the change order has been approved.
          </p>
        </div>
      </div>
    );
  }

  if (alreadySigned && changeOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Already Signed</h1>
          <p className="text-gray-500 text-sm">
            Change order <span className="font-medium">#{changeOrder.change_order_number}</span> was already
            signed{changeOrder.signed_by_name ? ` by ${changeOrder.signed_by_name}` : ""}.
          </p>
        </div>
      </div>
    );
  }

  if (!changeOrder) return null;

  const company = changeOrder.companies;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              {company?.name && (
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                  {company.name}
                </p>
              )}
              <h1 className="text-2xl font-bold text-gray-900">{changeOrder.title}</h1>
              <p className="text-sm text-gray-500 mt-1">Change Order #{changeOrder.change_order_number}</p>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 whitespace-nowrap">
              Awaiting Signature
            </span>
          </div>
          {changeOrder.description && (
            <p className="mt-4 text-sm text-gray-600">{changeOrder.description}</p>
          )}
        </div>

        {/* Line Items */}
        {changeOrder.items && changeOrder.items.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Scope of Work</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Unit Price</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {changeOrder.items.map((item, i) => (
                  <tr key={i}>
                    <td className="px-6 py-3 text-gray-700">{item.description}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{fmt(item.unitPrice)}</td>
                    <td className="px-6 py-3 text-right font-medium text-gray-800">{fmt(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-gray-100 px-6 py-4 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span><span>{fmt(changeOrder.subtotal)}</span>
              </div>
              {changeOrder.tax != null && changeOrder.tax > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Tax</span><span>{fmt(changeOrder.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100 mt-2">
                <span>Change Order Total</span><span>{fmt(changeOrder.total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {changeOrder.notes && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-sm text-gray-600">
            <h3 className="font-semibold text-gray-700 mb-1">Notes</h3>
            <p className="whitespace-pre-wrap">{changeOrder.notes}</p>
          </div>
        )}

        {/* Signature Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800">Sign to Approve Change Order</h2>

          <div>
            <label htmlFor="signedBy" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="signedBy"
              type="text"
              value={signedBy}
              onChange={(e) => setSignedBy(e.target.value)}
              placeholder="Enter your full name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Signature <span className="text-red-500">*</span>
            </label>
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <SignaturePad
                onSave={(dataUrl) => setSignatureData(dataUrl)}
                onClear={() => setSignatureData(null)}
                width={560}
                height={180}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Draw your signature above using your mouse or finger.</p>
          </div>

          {submitError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors"
          >
            {submitting ? "Submitting…" : "Approve & Sign Change Order"}
          </button>

          <p className="text-xs text-center text-gray-400">
            By signing, you authorize the additional work and costs described in this change order.
          </p>
        </form>

        {/* Company footer */}
        {company && (
          <div className="text-center text-xs text-gray-400 pb-4 space-y-0.5">
            {company.name && <p className="font-medium text-gray-500">{company.name}</p>}
            {company.phone && <p>{company.phone}</p>}
            {company.from_email && <p>{company.from_email}</p>}
            {(company.address || company.city) && (
              <p>{[company.address, company.city, company.state, company.zip].filter(Boolean).join(", ")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

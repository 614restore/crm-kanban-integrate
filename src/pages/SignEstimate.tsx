import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import SignaturePad from "@/components/ui/SignaturePad";

const API_BASE = "https://crm-kanban-integrate.vercel.app/api/document-handler?action=sign-estimate";

interface EstimateItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Estimate {
  id: string;
  estimate_number: string;
  title: string;
  description?: string;
  total: number;
  subtotal: number;
  tax?: number;
  notes?: string;
  terms?: string;
  items?: EstimateItem[];
  status: string;
  signed_by?: string;
  accepted_at?: string;
  valid_until?: string;
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

export default function SignEstimate() {
  const { id } = useParams<{ id: string }>();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [signedBy, setSignedBy] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}?token=${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Estimate not found or link is invalid.");
        return res.json();
      })
      .then((data) => {
        setEstimate(data.estimate);
        setAlreadySigned(data.alreadySigned);
        // Track view and notify sender
        if (!data.alreadySigned) {
          fetch("https://crm-kanban-integrate.vercel.app/api/document-handler?action=track-view", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: id }),
          }).catch(() => {}); // Silent fail
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signedBy.trim()) {
      setSubmitError("Please enter your full name.");
      return;
    }
    if (!signatureData) {
      setSubmitError("Please provide your signature.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateId: estimate?.id,
          signedBy: signedBy.trim(),
          signatureData,
          token: id,
        }),
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
        <div className="text-gray-500 text-sm">Loading estimate…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-lg font-semibold text-gray-800 mb-2">Unable to Load Estimate</h1>
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
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Estimate Signed!</h1>
          <p className="text-gray-500 text-sm">
            Thank you, <span className="font-medium text-gray-700">{signedBy}</span>. Your signature has been
            recorded and the estimate has been accepted.
          </p>
        </div>
      </div>
    );
  }

  if (alreadySigned && estimate) {
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
            Estimate <span className="font-medium">#{estimate.estimate_number}</span> was already signed
            {estimate.signed_by ? ` by ${estimate.signed_by}` : ""}.
          </p>
        </div>
      </div>
    );
  }

  if (!estimate) return null;

  const company = estimate.companies;

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
              <h1 className="text-2xl font-bold text-gray-900">{estimate.title}</h1>
              <p className="text-sm text-gray-500 mt-1">Estimate #{estimate.estimate_number}</p>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 whitespace-nowrap">
              Awaiting Signature
            </span>
          </div>

          {estimate.description && (
            <p className="mt-4 text-sm text-gray-600">{estimate.description}</p>
          )}

          {estimate.valid_until && (
            <p className="mt-3 text-xs text-gray-400">
              Valid until{" "}
              <span className="text-gray-600 font-medium">
                {new Date(estimate.valid_until).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </p>
          )}
        </div>

        {/* Line Items */}
        {estimate.items && estimate.items.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Line Items</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Description
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Qty
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Unit Price
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {estimate.items.map((item, i) => (
                  <tr key={i}>
                    <td className="px-6 py-3 text-gray-700">{item.description}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{fmt(item.unit_price)}</td>
                    <td className="px-6 py-3 text-right font-medium text-gray-800">{fmt(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-gray-100 px-6 py-4 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{fmt(estimate.subtotal)}</span>
              </div>
              {estimate.tax != null && estimate.tax > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Tax</span>
                  <span>{fmt(estimate.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100 mt-2">
                <span>Total</span>
                <span>{fmt(estimate.total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Terms / Notes */}
        {(estimate.terms || estimate.notes) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4 text-sm text-gray-600">
            {estimate.terms && (
              <div>
                <h3 className="font-semibold text-gray-700 mb-1">Terms & Conditions</h3>
                <p className="whitespace-pre-wrap">{estimate.terms}</p>
              </div>
            )}
            {estimate.notes && (
              <div>
                <h3 className="font-semibold text-gray-700 mb-1">Notes</h3>
                <p className="whitespace-pre-wrap">{estimate.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Signature Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800">Sign to Accept</h2>

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
            {submitting ? "Submitting…" : "Accept & Sign Estimate"}
          </button>

          <p className="text-xs text-center text-gray-400">
            By signing, you agree to accept this estimate and its terms.
          </p>
        </form>

        {/* Footer */}
        {company && (
          <div className="text-center text-xs text-gray-400 pb-4 space-y-0.5">
            {company.name && <p className="font-medium text-gray-500">{company.name}</p>}
            {company.phone && <p>{company.phone}</p>}
            {company.from_email && <p>{company.from_email}</p>}
            {(company.address || company.city) && (
              <p>
                {[company.address, company.city, company.state, company.zip]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

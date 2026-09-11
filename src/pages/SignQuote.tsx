import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import SignaturePad from "@/components/ui/SignaturePad";

// Public, unauthenticated quote view + e-signature — the customer-facing
// counterpart to the web Quotes builder (Stage 1) and the QuoteMGR quote
// builder on mobile. Reads via the get_public_quote RPC (SECURITY DEFINER,
// keyed by share_token — no login, no service key on the client) and signs
// via sign_quote_customer, the same RPC the mobile app's on-site contingency
// signing already calls. Modeled on the existing /sign-estimate/:token page
// so the two share the same visual language.

interface QuoteLineItem {
  id: string;
  category: string;
  item_name: string;
  description: string | null;
  unit: string | null;
  quantity: number;
  good_price: number;
  better_price: number;
  best_price: number;
  applies_to_tier: string | null;
}

interface QuoteData {
  id: string;
  quote_number: string;
  status: string;
  project_type: string | null;
  project_description: string | null;
  cover_page_title: string | null;
  notes: string | null;
  good_total: number;
  better_total: number;
  best_total: number;
  show_good_tier: boolean;
  show_better_tier: boolean;
  show_best_tier: boolean;
  good_tier_name: string;
  better_tier_name: string;
  best_tier_name: string;
  show_line_item_prices: boolean;
  show_quantity: boolean;
  include_cancel_notice: boolean;
  valid_until: string | null;
  sent_at: string | null;
  signed_at: string | null;
  signed_by: string | null;
  contingency_enabled: boolean;
  insurance_company_name: string | null;
  claim_number: string | null;
  deductible_amount: number | null;
  show_financing: boolean;
  financing_note: string | null;
  include_custom_page: boolean;
  custom_page_title: string | null;
  custom_page_body: string | null;
}

interface Company {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  logo_url: string | null;
  quote_primary_color: string | null;
}

interface Customer {
  first_name: string;
  last_name: string;
}

type Tier = "good" | "better" | "best";

export default function SignQuote() {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<QuoteLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedTier, setSelectedTier] = useState<Tier>("good");
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ signedBy: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc("get_public_quote", { p_share_token: token });
        if (rpcError) throw rpcError;
        if (!data) throw new Error("Quote not found or the link is invalid.");
        setQuote(data.quote);
        setCompany(data.company);
        setCustomer(data.customer);
        setItems(data.line_items || []);
      } catch (err: any) {
        setError(err.message || "Unable to load this quote.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const brandColor = company?.quote_primary_color || "#2563eb";

  const availableTiers = useMemo(() => {
    if (!quote) return [] as Tier[];
    const t: Tier[] = ["good"];
    if (quote.show_better_tier) t.push("better");
    if (quote.show_best_tier) t.push("best");
    return t;
  }, [quote]);

  const tierLabel = (t: Tier) =>
    quote ? { good: quote.good_tier_name, better: quote.better_tier_name, best: quote.best_tier_name }[t] : t;
  const tierTotal = (t: Tier) =>
    quote ? { good: quote.good_total, better: quote.better_total, best: quote.best_total }[t] : 0;
  const tierPrice = (item: QuoteLineItem, t: Tier) =>
    ({ good: item.good_price, better: item.better_price, best: item.best_price }[t]);

  const visibleItems = items.filter((i) => !i.applies_to_tier || i.applies_to_tier === selectedTier);
  const itemsByCategory = visibleItems.reduce<Record<string, QuoteLineItem[]>>((acc, item) => {
    (acc[item.category] ||= []).push(item);
    return acc;
  }, {});

  const fmt = (n: number) => (n || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

  const txDate = quote?.sent_at ? new Date(quote.sent_at) : new Date();
  const cancelDeadline = (() => {
    const d = new Date(txDate);
    let bizDays = 0;
    while (bizDays < 3) {
      d.setDate(d.getDate() + 1);
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) bizDays++;
    }
    return d;
  })();
  const fmtDate = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signerName.trim()) { setSubmitError("Please enter your full name."); return; }
    if (!signatureData) { setSubmitError("Please provide your signature."); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("sign_quote_customer", {
        p_share_token: token,
        p_signer_name: signerName.trim(),
        p_signer_email: signerEmail.trim() || null,
        p_signature_data: signatureData,
        p_cancel_signature_data: quote?.include_cancel_notice ? signatureData : null,
        p_selected_tier: selectedTier,
        p_selected_sections: null,
        p_selected_upgrades: null,
        p_funding_preference: null,
      });
      if (rpcError) throw rpcError;
      if (data?.already_signed) {
        setSuccess({ signedBy: data.signed_by || signerName.trim() });
      } else {
        setSuccess({ signedBy: signerName.trim() });
      }
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit your signature.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-sm">Loading proposal…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-lg font-semibold text-gray-800 mb-2">Unable to Load Proposal</h1>
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
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Quote Signed!</h1>
          <p className="text-gray-500 text-sm">
            Thank you, <span className="font-medium text-gray-700">{success.signedBy}</span>. Your signature has
            been recorded{company ? ` and ${company.name} has been notified` : ""}.
          </p>
        </div>
      </div>
    );
  }

  if (quote?.status === "signed") {
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
            Quote <span className="font-medium">{quote.quote_number}</span> was already signed
            {quote.signed_by ? ` by ${quote.signed_by}` : ""}.
          </p>
        </div>
      </div>
    );
  }

  if (!quote) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 text-white" style={{ background: brandColor }}>
            <div className="flex items-center gap-3 mb-3">
              {company?.logo_url && (
                <img src={company.logo_url} alt={company.name} className="h-10 w-10 rounded object-contain bg-white p-1" />
              )}
              <p className="text-sm font-semibold uppercase tracking-wide opacity-90">{company?.name}</p>
            </div>
            <h1 className="text-2xl font-bold">{quote.cover_page_title || "Project Proposal"}</h1>
            <p className="text-sm opacity-90 mt-1">Quote #{quote.quote_number}</p>
          </div>
          <div className="p-6">
            {customer && (
              <p className="text-sm text-gray-500">
                Prepared for <span className="font-medium text-gray-800">{customer.first_name} {customer.last_name}</span>
              </p>
            )}
            {quote.project_description && (
              <p className="mt-3 text-sm text-gray-600">{quote.project_description}</p>
            )}
            {quote.valid_until && (
              <p className="mt-3 text-xs text-gray-400">
                Valid until{" "}
                <span className="text-gray-600 font-medium">
                  {new Date(quote.valid_until).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Tier picker */}
        {availableTiers.length > 1 && (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${availableTiers.length}, 1fr)` }}>
            {availableTiers.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTier(t)}
                className={`rounded-xl border-2 p-4 text-left transition-colors ${
                  selectedTier === t ? "border-current bg-white shadow-sm" : "border-gray-200 bg-white/60"
                }`}
                style={selectedTier === t ? { borderColor: brandColor, color: brandColor } : undefined}
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{tierLabel(t)}</div>
                <div className="text-xl font-bold mt-1" style={{ color: selectedTier === t ? brandColor : "#111827" }}>
                  {fmt(tierTotal(t))}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Line items */}
        {visibleItems.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Scope of Work</h2>
              <span className="text-lg font-bold" style={{ color: brandColor }}>{fmt(tierTotal(selectedTier))}</span>
            </div>
            {Object.entries(itemsByCategory).map(([category, catItems]) => (
              <div key={category} className="border-b border-gray-50 last:border-0">
                <div className="px-6 pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">{category}</div>
                {catItems.map((item) => (
                  <div key={item.id} className="px-6 py-2 flex items-start justify-between gap-4 text-sm">
                    <div>
                      <div className="text-gray-800">{item.item_name}</div>
                      {item.description && <div className="text-gray-400 text-xs mt-0.5">{item.description}</div>}
                    </div>
                    {quote.show_line_item_prices && (
                      <div className="text-gray-600 whitespace-nowrap font-medium">
                        {fmt(tierPrice(item, selectedTier) * (item.quantity || 0))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {quote.notes && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-sm text-gray-600">
            <h3 className="font-semibold text-gray-700 mb-1">Notes</h3>
            <p className="whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}

        {(quote.insurance_company_name || quote.claim_number) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-sm">
            <h3 className="font-semibold text-gray-700 mb-3">Insurance Claim</h3>
            <div className="grid grid-cols-2 gap-3">
              {quote.insurance_company_name && (
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Carrier</div>
                  <div className="text-gray-700">{quote.insurance_company_name}</div>
                </div>
              )}
              {quote.claim_number && (
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Claim #</div>
                  <div className="text-gray-700">{quote.claim_number}</div>
                </div>
              )}
              {quote.deductible_amount != null && (
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Deductible</div>
                  <div className="text-gray-700">{fmt(quote.deductible_amount)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {quote.show_financing && quote.financing_note && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-sm text-blue-900">
            <h3 className="font-semibold mb-1">Financing Available</h3>
            <p className="whitespace-pre-wrap">{quote.financing_note}</p>
          </div>
        )}

        {quote.include_custom_page && quote.custom_page_body && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-sm text-gray-600">
            {quote.custom_page_title && <h3 className="font-semibold text-gray-700 mb-1">{quote.custom_page_title}</h3>}
            <p className="whitespace-pre-wrap">{quote.custom_page_body}</p>
          </div>
        )}

        {quote.contingency_enabled && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-sm text-gray-600">
            <h3 className="font-semibold text-gray-700 mb-1">Contingency Agreement</h3>
            <p>
              This proposal includes a contingency agreement — work proceeds contingent on insurance claim
              approval, and your signature below also accepts that agreement.
            </p>
          </div>
        )}

        {/* 3-Day Right to Cancel */}
        {quote.include_cancel_notice && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm">
            <h3 className="font-bold text-amber-900 text-base mb-2">⚠️ 3-Day Right to Cancel</h3>
            <p className="text-amber-800 mb-4">
              You have the right to cancel this agreement within three (3) business days from the
              date of this transaction, without penalty or obligation. To cancel, you must notify{" "}
              <span className="font-semibold">{company?.name || "the contractor"}</span> in writing before the deadline below.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-lg p-3 border border-amber-100">
                <span className="text-xs text-amber-700 font-semibold uppercase tracking-wide block mb-1">Date of Transaction</span>
                <span className="font-medium text-gray-800 text-sm">{fmtDate(txDate)}</span>
              </div>
              <div className="bg-white rounded-lg p-3 border border-amber-200">
                <span className="text-xs text-amber-700 font-semibold uppercase tracking-wide block mb-1">Cancellation Deadline</span>
                <span className="font-bold text-gray-900 text-sm">{fmtDate(cancelDeadline)}</span>
              </div>
            </div>
            <p className="text-xs text-amber-700">Per FTC regulations (16 CFR Part 429). If you cancel, no cancellation fee may be charged.</p>
          </div>
        )}

        {/* Signature Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800">
            Sign to Accept — {tierLabel(selectedTier)} ({fmt(tierTotal(selectedTier))})
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="signedBy" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="signedBy" type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="signedEmail" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                id="signedEmail" type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Signature <span className="text-red-500">*</span>
            </label>
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <SignaturePad onSave={(dataUrl) => setSignatureData(dataUrl)} onClear={() => setSignatureData(null)} width={560} height={180} />
            </div>
            <p className="text-xs text-gray-400 mt-1">Draw your signature above using your mouse or finger.</p>
          </div>

          {submitError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{submitError}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-60"
            style={{ background: brandColor }}
          >
            {submitting ? "Submitting…" : `Accept & Sign — ${tierLabel(selectedTier)}`}
          </button>

          <p className="text-xs text-center text-gray-400">By signing, you agree to accept this proposal and its terms.</p>
        </form>

        {company && (
          <div className="text-center text-xs text-gray-400 pb-4 space-y-0.5">
            {company.name && <p className="font-medium text-gray-500">{company.name}</p>}
            {company.phone && <p>{company.phone}</p>}
            {company.email && <p>{company.email}</p>}
            {(company.address || company.city) && (
              <p>{[company.address, company.city, company.state, company.zip].filter(Boolean).join(", ")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

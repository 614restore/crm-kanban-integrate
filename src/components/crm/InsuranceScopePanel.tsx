import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Upload, Loader2, X, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/authContext';
import { formatCurrency } from '@/lib/crmData';
import { compressImage } from '@/lib/imageUtils';

/**
 * Upload the carrier's insurance scope of work, let the AI read it, then review the figures and apply
 * one as the customer's Project Value. The reading is done by the `read-insurance-scope` function, the
 * same one the mobile app calls, so a scope reads identically on both. Nothing is applied until a person
 * clicks Apply: the AI can misread a page, so the figures and where they were found are shown first.
 */

interface Evidence {
  label: string;
  amount: number;
  where: string;
}

interface Extracted {
  carrier?: string | null;
  claim_number?: string | null;
  line_item_subtotal?: number | null;
  overhead_and_profit?: number | null;
  sales_tax?: number | null;
  replacement_cost_value?: number | null;
  derived_replacement_cost_value?: number | null;
  recoverable_depreciation?: number | null;
  non_recoverable_depreciation?: number | null;
  actual_cash_value?: number | null;
  deductible?: number | null;
  net_claim_payment?: number | null;
  evidence?: Evidence[];
  confidence?: 'high' | 'medium' | 'low';
  notes?: string;
}

interface Scope {
  id: string;
  file_name: string;
  status: 'uploaded' | 'read' | 'failed' | 'applied';
  extracted: Extracted | null;
  total_rcv: number | null;
  error: string | null;
  applied_total: number | null;
  applied_label: string | null;
  created_at: string;
}

interface Props {
  contactId: string;
  companyId: string;
  /** The customer's Project Value now, so replacing a different one can be confirmed. */
  currentProjectValue?: number | null;
  /** Called after a figure is applied, so the page can show the new Project Value. */
  onApplied: (amount: number) => void;
}

const COLUMNS = 'id, file_name, status, extracted, total_rcv, error, applied_total, applied_label, created_at';

/** The figures a person can apply, in the order they are offered. RCV is the usual project total. */
const optionsFor = (x: Extracted) => {
  const out: { key: string; label: string; hint: string; amount: number }[] = [];
  const add = (key: string, label: string, hint: string, v?: number | null) => {
    if (typeof v === 'number' && v > 0) out.push({ key, label, hint, amount: v });
  };
  add('rcv', 'Replacement cost (RCV)', 'The full scope before depreciation and deductible', x.replacement_cost_value);
  add('derived', 'Line items + overhead & profit + tax', 'Added up from the parts, as the total was not printed', x.derived_replacement_cost_value);
  add('acv', 'Actual cash value (ACV)', 'RCV less depreciation', x.actual_cash_value);
  add('net', 'Net claim payment', 'What the carrier pays after depreciation and the deductible', x.net_claim_payment);
  return out;
};

export default function InsuranceScopePanel({ contactId, companyId, currentProjectValue, onApplied }: Props) {
  const { profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [review, setReview] = useState<Scope | null>(null);
  const [choice, setChoice] = useState('rcv');
  const [custom, setCustom] = useState('');
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('insurance_scopes')
      .select(COLUMNS)
      .eq('customer_id', contactId)
      .order('created_at', { ascending: false });
    if (!error) setScopes((data ?? []) as Scope[]);
    setLoading(false);
  }, [contactId]);

  useEffect(() => {
    load();
  }, [load]);

  const openReview = (scope: Scope) => {
    const opts = scope.extracted ? optionsFor(scope.extracted) : [];
    setChoice(opts[0]?.key ?? 'custom');
    setCustom('');
    setReview(scope);
  };

  const readScope = async (scopeId: string) => {
    setWorking('Reading the scope… this can take up to a minute.');
    try {
      const { data, error } = await supabase.functions.invoke('read-insurance-scope', { body: { scope_id: scopeId } });
      if (error) throw error;
      const result = data as { ok?: boolean; error?: string };
      await load();
      if (!result?.ok) {
        toast.error(result?.error ?? 'Could not read the scope. Try again.');
        return;
      }
      const { data: row } = await supabase.from('insurance_scopes').select(COLUMNS).eq('id', scopeId).single();
      if (row) openReview(row as Scope);
    } catch (err: any) {
      await load();
      toast.error(err?.message ?? 'Could not read the scope. Try again.');
    } finally {
      setWorking(null);
    }
  };

  const handleFile = async (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf && !file.type.startsWith('image/')) {
      toast.error('Upload a PDF or a photo of the scope.');
      return;
    }
    setWorking('Uploading…');
    try {
      // A photo of the scope paperwork goes through the same size cap as other
      // photos, but at a larger size than a damage photo: it is dense small
      // print that has to stay readable for the scope reader. PDFs are left alone.
      const toUpload = isPdf ? file : await compressImage(file, { maxSide: 2000, targetBytes: 700_000 });
      const baseName = toUpload.type === 'image/jpeg' && !isPdf
        ? file.name.replace(/\.[^.]+$/, '') + '.jpg'
        : file.name;
      const safeName = baseName.replace(/[^A-Za-z0-9._-]+/g, '_');
      const path = `${contactId}/insurance-scope/${Date.now()}-${safeName}`;
      const mime = toUpload.type || (isPdf ? 'application/pdf' : 'image/jpeg');
      const { error: upErr } = await supabase.storage.from('documents').upload(path, toUpload, { contentType: mime, upsert: false });
      if (upErr) throw upErr;

      const { data: row, error: insErr } = await supabase
        .from('insurance_scopes')
        .insert({
          company_id: companyId,
          customer_id: contactId,
          file_path: path,
          file_name: file.name,
          file_type: mime,
          file_size: toUpload.size,
          uploaded_by: profile?.id ?? null,
          uploaded_by_name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email || null,
        })
        .select('id')
        .single();
      if (insErr || !row) throw insErr ?? new Error('Could not save the upload.');
      await load();
      await readScope((row as { id: string }).id);
    } catch (err: any) {
      setWorking(null);
      toast.error(err?.message ?? 'Could not upload the scope.');
    }
  };

  const chosen = (): { amount: number; label: string } | null => {
    if (!review?.extracted) return null;
    if (choice === 'custom') {
      const n = parseFloat(custom);
      return Number.isFinite(n) && n > 0 ? { amount: n, label: 'Typed amount' } : null;
    }
    const opt = optionsFor(review.extracted).find((o) => o.key === choice);
    return opt ? { amount: opt.amount, label: opt.label } : null;
  };

  const apply = async () => {
    const picked = chosen();
    if (!review || !picked) {
      toast.error('Pick one of the figures, or type the amount.');
      return;
    }
    if (
      currentProjectValue &&
      Math.abs(currentProjectValue - picked.amount) > 0.005 &&
      !window.confirm(`Project Value is ${formatCurrency(currentProjectValue)} now. Replace it with ${formatCurrency(picked.amount)}?`)
    ) {
      return;
    }
    setApplying(true);
    try {
      const { error: custErr } = await supabase.from('customers').update({ project_value: picked.amount }).eq('id', contactId);
      if (custErr) throw custErr;
      await supabase
        .from('insurance_scopes')
        .update({
          status: 'applied',
          applied_total: picked.amount,
          applied_label: picked.label,
          applied_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', review.id);
      setReview(null);
      await load();
      onApplied(picked.amount);
      toast.success(`Project Value set to ${formatCurrency(picked.amount)}`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not apply.');
    } finally {
      setApplying(false);
    }
  };

  const x = review?.extracted ?? null;
  const opts = x ? optionsFor(x) : [];
  const conf = x?.confidence ?? 'low';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Insurance Scope of Work</h3>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!!working}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
        >
          <Upload size={16} /> Upload Scope
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void handleFile(f);
          }}
        />
      </div>
      <p className="text-sm text-gray-500 mt-1">
        Upload the carrier&apos;s scope or estimate (PDF or photo). The AI reads it and finds the claim total for you to review.
      </p>

      {working && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <Loader2 size={16} className="animate-spin" /> {working}
        </div>
      )}

      <div className="mt-3">
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : scopes.length === 0 ? (
          <p className="text-sm text-gray-400">No scope uploaded yet</p>
        ) : (
          scopes.map((s) => (
            <button
              key={s.id}
              onClick={() => (s.status === 'read' || s.status === 'applied' ? openReview(s) : void readScope(s.id))}
              disabled={!!working}
              className="w-full flex items-center gap-3 py-3 border-t border-gray-100 text-left hover:bg-gray-50 disabled:opacity-60"
            >
              <FileText size={18} className="text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{s.file_name}</p>
                <p className="text-xs text-gray-500">
                  {new Date(s.created_at).toLocaleDateString()} ·{' '}
                  {s.status === 'applied'
                    ? `Applied ${formatCurrency(Number(s.applied_total ?? 0))}`
                    : s.status === 'read'
                    ? s.total_rcv
                      ? `Read: ${formatCurrency(Number(s.total_rcv))}`
                      : 'Read'
                    : s.status === 'failed'
                    ? 'Could not read, click to try again'
                    : 'Uploaded, click to read'}
                </p>
              </div>
              <ChevronRight size={16} className="text-gray-400" />
            </button>
          ))
        )}
      </div>

      {review && x && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-start justify-between">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-gray-900">Review the scope</h3>
                <p className="text-sm text-gray-500 truncate">{review.file_name}</p>
              </div>
              <button onClick={() => setReview(null)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div
                className={`rounded-lg border p-3 text-sm ${
                  conf === 'high'
                    ? 'bg-green-50 border-green-200'
                    : conf === 'medium'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <p className="font-semibold text-gray-900">
                  {conf === 'high'
                    ? 'The AI is confident in these figures.'
                    : conf === 'medium'
                    ? 'The AI is fairly sure. Check the figures against the document.'
                    : 'The AI is not sure. Check every figure against the document before applying.'}
                </p>
                {x.notes && <p className="mt-1 text-gray-600">{x.notes}</p>}
              </div>

              {(x.carrier || x.claim_number) && (
                <p className="text-sm text-gray-500">
                  {[x.carrier, x.claim_number ? `Claim ${x.claim_number}` : ''].filter(Boolean).join(' · ')}
                </p>
              )}

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Use as Project Value</p>
                <div className="space-y-2">
                  {opts.map((o) => (
                    <label
                      key={o.key}
                      className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer ${
                        choice === o.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <input type="radio" name="scope-choice" checked={choice === o.key} onChange={() => setChoice(o.key)} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{o.label}</p>
                        <p className="text-xs text-gray-500">{o.hint}</p>
                      </div>
                      <span className="text-sm font-bold text-gray-900">{formatCurrency(o.amount)}</span>
                    </label>
                  ))}
                  <label
                    className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer ${
                      choice === 'custom' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <input type="radio" name="scope-choice" checked={choice === 'custom'} onChange={() => setChoice('custom')} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">A different amount</p>
                      {choice === 'custom' && (
                        <input
                          type="number"
                          autoFocus
                          value={custom}
                          onChange={(e) => setCustom(e.target.value)}
                          placeholder="0.00"
                          className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      )}
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Other figures found</p>
                <div className="space-y-1 text-sm">
                  {(
                    [
                      ['Line items', x.line_item_subtotal],
                      ['Overhead & profit', x.overhead_and_profit],
                      ['Sales tax', x.sales_tax],
                      ['Recoverable depreciation', x.recoverable_depreciation],
                      ['Non-recoverable depreciation', x.non_recoverable_depreciation],
                      ['Deductible', x.deductible],
                    ] as [string, number | null | undefined][]
                  )
                    .filter(([, v]) => typeof v === 'number')
                    .map(([label, v]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-gray-500">{label}</span>
                        <span className="font-medium text-gray-900">{formatCurrency(v as number)}</span>
                      </div>
                    ))}
                </div>
              </div>

              {!!x.evidence?.length && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Where the AI found them</p>
                  <ul className="space-y-1 text-xs text-gray-500">
                    {x.evidence.map((e, i) => (
                      <li key={i}>
                        {e.label}: {formatCurrency(Number(e.amount))} ({e.where})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setReview(null)} disabled={applying} className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 font-medium">
                Close
              </button>
              <button
                onClick={apply}
                disabled={applying}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {applying && <Loader2 size={16} className="animate-spin" />} Apply as Project Value
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

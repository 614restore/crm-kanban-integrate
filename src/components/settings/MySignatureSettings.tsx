import React, { useEffect, useState } from 'react';
import { PenLine, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/authContext';
import SignaturePad from '@/components/ui/SignaturePad';

// Each person draws their signature once. When a customer signs a quote that person
// created through the emailed link, it is applied as the countersignature straight
// away, and the homeowner receives the fully signed copy.
export default function MySignatureSettings() {
  const { user, profile } = useAuth();
  const uid = user?.id ?? profile?.id;
  const [signature, setSignature] = useState<string | null>(null);
  const [adoptedAt, setAdoptedAt] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyAuto, setCompanyAuto] = useState<boolean | null>(null);
  const canManageCompany = ['owner', 'admin', 'manager'].includes(profile?.role ?? '');

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase.from('team_members') as any)
        .select('signature_data, signature_adopted_at')
        .or(`id.eq.${uid},user_id.eq.${uid}`)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setSignature(data?.signature_data ?? null);
      setAdoptedAt(data?.signature_adopted_at ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [uid]);

  useEffect(() => {
    if (!profile?.company_id || !canManageCompany) return;
    (supabase.from('companies') as any)
      .select('auto_countersign_enabled')
      .eq('id', profile.company_id)
      .maybeSingle()
      .then(({ data }: any) => setCompanyAuto(data ? !!data.auto_countersign_enabled : null));
  }, [profile?.company_id, canManageCompany]);

  const toggleCompanyAuto = async () => {
    const next = !companyAuto;
    const { error } = await (supabase as any).rpc('set_company_auto_countersign', { p_enabled: next });
    if (error) { toast.error(error.message || 'Could not change the setting'); return; }
    setCompanyAuto(next);
    toast.success(next ? 'Automatic countersigning is on for your company' : 'Automatic countersigning is off');
  };

  const save = async (dataUrl: string | null) => {
    setSaving(true);
    try {
      const { data, error } = await (supabase as any).rpc('set_my_signature', { p_signature_data: dataUrl });
      if (error) throw error;
      setSignature(dataUrl);
      setAdoptedAt(dataUrl ? (data ?? new Date().toISOString()) : null);
      setDrawing(false);
      toast.success(dataUrl ? 'Signature saved' : 'Signature removed');
    } catch (err: any) {
      toast.error(err?.message || 'Could not save the signature');
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!window.confirm('Remove your saved signature? Quotes will no longer be countersigned automatically for you.')) return;
    void save(null);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <PenLine className="w-5 h-5 text-blue-600" /> My Signature
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Draw your signature once. When a customer signs a quote you created, it is applied as your
          countersignature automatically, the fully signed copy is sent to the homeowner, and the job is
          marked ready for the down payment.
        </p>
      </div>

      {canManageCompany && companyAuto !== null && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900">Countersign automatically for the company</p>
            <p className="text-sm text-gray-600 mt-1">
              When on, a customer's signature is countersigned right away with the saved signature of the
              person who created the quote. Each person still has to save their own signature below; anyone
              without one countersigns by hand.
            </p>
          </div>
          <button
            onClick={toggleCompanyAuto}
            role="switch"
            aria-checked={companyAuto}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${companyAuto ? 'bg-emerald-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${companyAuto ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : signature && !drawing ? (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="w-4 h-4" /> Automatic countersigning is on
          </div>
          <img src={signature} alt="Your saved signature" className="max-h-28 border border-gray-200 rounded-lg bg-white p-2" />
          {adoptedAt && (
            <p className="text-xs text-gray-500">Saved {new Date(adoptedAt).toLocaleString()}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setDrawing(true)}
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Redraw
            </button>
            <button
              onClick={remove}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <p className="text-sm text-gray-700">Sign in the box below, then tap Save.</p>
          <SignaturePad onSave={(dataUrl) => void save(dataUrl)} />
          <p className="text-xs text-gray-500">
            By saving, you agree that this signature may be applied automatically as your countersignature
            on quotes and agreements you create, once the customer has signed.
          </p>
          {signature && (
            <button onClick={() => setDrawing(false)} className="text-sm text-gray-600 underline">Cancel</button>
          )}
        </div>
      )}
    </div>
  );
}

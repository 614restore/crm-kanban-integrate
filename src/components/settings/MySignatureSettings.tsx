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

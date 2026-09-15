import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Camera, CheckCircle2, Upload, X, ChevronDown,
  Search, User, Calendar, ArrowLeft, Loader2, AlertTriangle,
  Home, Wind, CloudLightning, Minus,
} from 'lucide-react';
import { useCRM, useCurrentContact } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';

/* ─── Types ──────────────────────────────────────────────── */
type Elevation = 'North' | 'South' | 'East' | 'West' | 'Garage' | 'Detached';
const ELEVATIONS: Elevation[] = ['North', 'South', 'East', 'West', 'Garage', 'Detached'];

interface InspectionRecord {
  id: string;
  contact_id: string;
  user_id: string;
  status: string;
  data: {
    photoCounts: Record<string, number>;
    checklist: { roofAge: string; material: string; damageTypes: string[] };
    completedAt: string;
  } | null;
  created_at: string;
  contacts?: { first_name: string; last_name: string; address?: string };
}

interface ContactRow {
  id: string;
  first_name: string;
  last_name: string;
  address?: string;
}

/* ─── Helpers ──────────────────────────────────────────── */
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const totalPhotos = (counts: Record<string, number>) =>
  Object.values(counts).reduce((a, b) => a + b, 0);

/* ════════════════════════════════════════════════════════════
   InspectionsView — main component
════════════════════════════════════════════════════════════ */
export default function InspectionsView() {
  const { state, dispatch } = useCRM();
  const preselected = useCurrentContact();          // non-null when navigated from ContactDetail
  const { profile } = useAuth();

  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');

  // 'list' | 'new'
  const [panel, setPanel] = useState<'list' | 'new'>(() =>
    preselected ? 'new' : 'list'
  );

  /* ── fetch all inspections for this company ──────────── */
  const fetchInspections = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoadingList(true);
    try {
      const { data } = await supabase
        .from('inspections')
        .select('*, contacts(first_name, last_name, address)')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });
      setRecords((data as InspectionRecord[]) ?? []);
    } catch {
      setRecords([]);
    } finally {
      setLoadingList(false);
    }
  }, [profile?.company_id]);

  useEffect(() => { fetchInspections(); }, [fetchInspections]);

  /* ── filtered list ───────────────────────────────────── */
  const filtered = records.filter((r) => {
    const name = `${r.contacts?.first_name ?? ''} ${r.contacts?.last_name ?? ''}`.toLowerCase();
    const addr = (r.contacts?.address ?? '').toLowerCase();
    const q = search.toLowerCase();
    return !q || name.includes(q) || addr.includes(q);
  });

  return (
    <div className="h-full flex flex-col">
      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <ClipboardList size={22} className="text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Inspections</h1>
            <p className="text-xs text-gray-500">{records.length} inspection{records.length !== 1 ? 's' : ''} on file</p>
          </div>
        </div>
        <button
          onClick={() => setPanel('new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Camera size={16} />
          New Inspection
        </button>
      </div>

      {/* ── Body ─────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: inspection list */}
        <div className="w-full lg:w-[380px] flex flex-col border-r border-gray-100 bg-gray-50 overflow-y-auto">
          {/* Search */}
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or address…"
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
              />
            </div>
          </div>

          {loadingList ? (
            <div className="flex-1 flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center px-6">
              <ClipboardList size={40} className="text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No inspections yet</p>
              <p className="text-gray-400 text-sm mt-1">
                {search ? 'Try a different search.' : 'Click "New Inspection" to get started.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map(rec => (
                <InspectionListItem key={rec.id} rec={rec} />
              ))}
            </div>
          )}
        </div>

        {/* Right: new / empty state */}
        <div className="hidden lg:flex flex-1 flex-col overflow-y-auto">
          {panel === 'new' ? (
            <NewInspectionPanel
              preselectedContact={preselected ?? undefined}
              companyId={profile?.company_id ?? ''}
              userId={profile?.id ?? ''}
              onDone={() => { fetchInspections(); setPanel('list'); }}
              onCancel={() => setPanel('list')}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-16">
              <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                <ClipboardList size={36} className="text-blue-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Create an Inspection</h2>
              <p className="text-gray-500 max-w-sm mb-6">
                Document roof condition, upload photos by elevation, and record damage assessment — right from your desktop.
              </p>
              <button
                onClick={() => setPanel('new')}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Camera size={18} />
                Start New Inspection
              </button>
            </div>
          )}
        </div>

        {/* Mobile: new inspection takes full width */}
        {panel === 'new' && (
          <div className="lg:hidden absolute inset-0 bg-white z-10 overflow-y-auto">
            <NewInspectionPanel
              preselectedContact={preselected ?? undefined}
              companyId={profile?.company_id ?? ''}
              userId={profile?.id ?? ''}
              onDone={() => { fetchInspections(); setPanel('list'); }}
              onCancel={() => setPanel('list')}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Inspection list item
════════════════════════════════════════════════════════════ */
function InspectionListItem({ rec }: { rec: InspectionRecord }) {
  const name = rec.contacts
    ? `${rec.contacts.first_name} ${rec.contacts.last_name}`
    : 'Unknown Contact';
  const photos = rec.data?.photoCounts ? totalPhotos(rec.data.photoCounts) : 0;
  const damage = rec.data?.checklist?.damageTypes?.join(', ') || '—';
  const material = rec.data?.checklist?.material || '—';

  return (
    <div className="px-4 py-3 bg-white hover:bg-blue-50/40 transition-colors cursor-default">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{name}</p>
          {rec.contacts?.address && (
            <p className="text-xs text-gray-500 truncate">{rec.contacts.address}</p>
          )}
        </div>
        <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
          rec.status === 'completed'
            ? 'bg-green-100 text-green-700'
            : 'bg-yellow-100 text-yellow-700'
        }`}>
          {rec.status}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><Camera size={11} />{photos} photo{photos !== 1 ? 's' : ''}</span>
        <span className="flex items-center gap-1"><Home size={11} />{material}</span>
        <span className="flex items-center gap-1"><AlertTriangle size={11} />{damage}</span>
      </div>
      <p className="mt-1 text-[10px] text-gray-400 flex items-center gap-1">
        <Calendar size={10} /> {fmtDate(rec.created_at)}
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   New Inspection Panel
════════════════════════════════════════════════════════════ */
interface NewInspectionPanelProps {
  preselectedContact?: { id: string; first_name?: string; last_name?: string } | null;
  companyId: string;
  userId: string;
  onDone: () => void;
  onCancel: () => void;
}

function NewInspectionPanel({ preselectedContact, companyId, userId, onDone, onCancel }: NewInspectionPanelProps) {
  /* contact search */
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<ContactRow | null>(null);
  const [showContactDD, setShowContactDD] = useState(false);

  /* elevations */
  const [activeElev, setActiveElev] = useState<Elevation>('North');
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [uploadingElev, setUploadingElev] = useState<string | null>(null);

  /* checklist */
  const [step, setStep] = useState<'photos' | 'questions'>('photos');
  const [checklist, setChecklist] = useState({ roofAge: '', material: '', damageTypes: [] as string[] });

  /* submit */
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Pre-populate from ContactDetail navigation */
  useEffect(() => {
    if (preselectedContact) {
      setSelectedContact({
        id: preselectedContact.id,
        first_name: preselectedContact.first_name ?? '',
        last_name: preselectedContact.last_name ?? '',
      });
    }
  }, [preselectedContact]);

  /* load contacts for selector */
  useEffect(() => {
    if (!companyId) return;
    supabase
      .from('contacts')
      .select('id, first_name, last_name, address')
      .eq('company_id', companyId)
      .order('last_name')
      .then(({ data }) => setContacts((data ?? []) as ContactRow[]));
  }, [companyId]);

  const filteredContacts = contacts.filter(c => {
    const q = contactSearch.toLowerCase();
    return !q ||
      c.first_name.toLowerCase().includes(q) ||
      c.last_name.toLowerCase().includes(q) ||
      (c.address ?? '').toLowerCase().includes(q);
  });

  /* file upload */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedContact) return;
    e.target.value = '';
    setUploadingElev(activeElev);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/heic|heif/, 'jpg');
      // The shared backend has no 'documents' bucket; company files live in 'company-files'.
      const path = `${companyId}/${selectedContact.id}/inspection_${activeElev}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('company-files')
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from('company-files').getPublicUrl(path);

      // documents.uploaded_by references team_members.id, not the auth user id, so it is left empty.
      const { error: docErr } = await supabase.from('documents').insert({
        contact_id: selectedContact.id,
        company_id: companyId,
        name: `Inspection – ${activeElev} Elevation`,
        type: 'photo',
        url: publicUrl,
        size: file.size,
      } as any);
      if (docErr) throw docErr;

      setPhotoCounts(prev => ({ ...prev, [activeElev]: (prev[activeElev] || 0) + 1 }));
    } catch (err: any) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setUploadingElev(null);
    }
  };

  const toggleDamage = (type: string) => {
    setChecklist(prev => {
      if (type === 'None') return { ...prev, damageTypes: prev.damageTypes.includes('None') ? [] : ['None'] };
      const next = prev.damageTypes.filter(d => d !== 'None');
      return { ...prev, damageTypes: next.includes(type) ? next.filter(d => d !== type) : [...next, type] };
    });
  };

  const canProceed = Object.values(photoCounts).some(v => v > 0);
  const canSubmit = checklist.roofAge && checklist.material && checklist.damageTypes.length > 0;

  const handleSubmit = async () => {
    if (!selectedContact) return;
    setSubmitting(true);
    setError(null);
    try {
      const total = totalPhotos(photoCounts);
      const damage = checklist.damageTypes.join(', ') || 'None';

      /* timeline note */
      await supabase.from('communications').insert({
        contact_id: selectedContact.id,
        company_id: companyId,
        type: 'note',
        content: `📋 Desktop Inspection completed — ${total} photo${total !== 1 ? 's' : ''} uploaded\n\nElevations: ${
          Object.entries(photoCounts).filter(([, v]) => v > 0).map(([k, v]) => `${k}(${v})`).join(', ')
        }\n\nAge: ${checklist.roofAge || '—'} | Material: ${checklist.material || '—'} | Damage: ${damage}`,
        user_id: userId,
        direction: 'outbound',
      } as any);

      /* inspections row — one per contact; inspections has no unique contact_id to upsert on */
      const inspection = {
        contact_id: selectedContact.id,
        company_id: companyId,
        status: 'completed',
        data: { photoCounts, checklist, completedAt: new Date().toISOString() },
      };
      const { data: existing } = await (supabase.from('inspections') as any)
        .select('id')
        .eq('contact_id', selectedContact.id)
        .limit(1)
        .maybeSingle();
      const { error: inspErr } = existing
        ? await (supabase.from('inspections') as any).update(inspection).eq('id', existing.id)
        : await (supabase.from('inspections') as any).insert(inspection);
      if (inspErr) throw inspErr;

      onDone();
    } catch (err: any) {
      setError(err.message || 'Failed to save inspection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-white">
        <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={18} className="text-gray-500" />
        </button>
        <div>
          <h2 className="font-bold text-gray-900">New Inspection</h2>
          <p className="text-xs text-gray-500">Document roof condition and capture photos by elevation</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertTriangle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {/* ── Contact selector ──────────────────────────── */}
        <section>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Contact</label>
          {selectedContact ? (
            <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {selectedContact.first_name[0]}{selectedContact.last_name[0]}
                </div>
                <span className="font-medium text-gray-900">{selectedContact.first_name} {selectedContact.last_name}</span>
              </div>
              {!preselectedContact && (
                <button onClick={() => setSelectedContact(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={contactSearch}
                onChange={e => { setContactSearch(e.target.value); setShowContactDD(true); }}
                onFocus={() => setShowContactDD(true)}
                placeholder="Search contacts…"
                className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
              {showContactDD && filteredContacts.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-52 overflow-y-auto">
                  {filteredContacts.slice(0, 20).map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left transition-colors text-sm"
                      onMouseDown={() => { setSelectedContact(c); setContactSearch(''); setShowContactDD(false); }}
                    >
                      <User size={14} className="text-gray-400 shrink-0" />
                      <span>{c.first_name} {c.last_name}</span>
                      {c.address && <span className="text-gray-400 truncate text-xs ml-auto">{c.address}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Steps: photos → questions ─────────────────── */}
        {step === 'photos' && (
          <>
            {/* Elevation grid */}
            <section>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Elevation</label>
              <div className="grid grid-cols-3 gap-2">
                {ELEVATIONS.map(elev => {
                  const count = photoCounts[elev] || 0;
                  const active = activeElev === elev;
                  return (
                    <button
                      key={elev}
                      type="button"
                      onClick={() => setActiveElev(elev)}
                      className={`relative flex flex-col items-center justify-center py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                        active
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
                      }`}
                    >
                      <span>{elev}</span>
                      {count > 0 && (
                        <span className={`text-[10px] mt-0.5 font-bold ${active ? 'text-blue-600' : 'text-green-600'}`}>
                          {count} photo{count !== 1 ? 's' : ''}
                        </span>
                      )}
                      {count > 0 && (
                        <CheckCircle2 size={12} className="absolute top-1.5 right-1.5 text-green-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Upload area */}
            <section>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                {activeElev} Elevation — {photoCounts[activeElev] || 0} photo{(photoCounts[activeElev] || 0) !== 1 ? 's' : ''} captured
              </label>
              <label className={`block w-full cursor-pointer ${!selectedContact ? 'opacity-40 pointer-events-none' : ''}`}>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/heic"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={!selectedContact || !!uploadingElev}
                />
                <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 flex flex-col items-center gap-3 text-gray-400 hover:border-blue-300 hover:bg-blue-50/30 transition-colors">
                  {uploadingElev === activeElev ? (
                    <Loader2 size={32} className="animate-spin text-blue-500" />
                  ) : (
                    <Upload size={32} className="text-gray-300" />
                  )}
                  <div className="text-center">
                    <p className="font-semibold text-gray-600 text-sm">
                      {uploadingElev === activeElev ? 'Uploading…' : 'Click to upload or drag & drop'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {selectedContact ? 'JPG, PNG, HEIC supported' : 'Select a contact first'}
                    </p>
                  </div>
                </div>
              </label>
            </section>

            <button
              onClick={() => setStep('questions')}
              disabled={!canProceed || !selectedContact}
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Next: Inspection Questions →
            </button>
          </>
        )}

        {step === 'questions' && (
          <>
            <button
              onClick={() => setStep('photos')}
              className="text-sm text-blue-600 hover:underline flex items-center gap-1 -mb-2"
            >
              <ArrowLeft size={14} /> Back to photos
            </button>

            {/* Roof age */}
            <section>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Approximate Roof Age</label>
              <div className="grid grid-cols-4 gap-2">
                {['0–5 yrs', '5–10 yrs', '10–20 yrs', '20+ yrs'].map((opt, i) => {
                  const val = ['0-5', '5-10', '10-20', '20+'][i];
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setChecklist(c => ({ ...c, roofAge: val }))}
                      className={`py-3 rounded-xl text-xs font-semibold border-2 transition-all ${
                        checklist.roofAge === val
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Material */}
            <section>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Primary Roofing Material</label>
              <div className="grid grid-cols-4 gap-2">
                {['Shingle', 'Metal', 'Tile', 'Flat'].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setChecklist(c => ({ ...c, material: m }))}
                    className={`py-3 rounded-xl text-xs font-semibold border-2 transition-all ${
                      checklist.material === m
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </section>

            {/* Damage */}
            <section>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Damage Observed (select all that apply)</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Hail', icon: <CloudLightning size={14} /> },
                  { label: 'Wind', icon: <Wind size={14} /> },
                  { label: 'Wear', icon: <Home size={14} /> },
                  { label: 'None', icon: <Minus size={14} /> },
                ].map(({ label, icon }) => {
                  const active = checklist.damageTypes.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleDamage(label)}
                      className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-semibold border-2 transition-all ${
                        active
                          ? 'border-amber-400 bg-amber-50 text-amber-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-amber-300'
                      }`}
                    >
                      {icon}
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting || !selectedContact}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? <><Loader2 size={18} className="animate-spin" /> Saving…</> : <>
                <CheckCircle2 size={18} /> Submit Inspection to Timeline
              </>}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

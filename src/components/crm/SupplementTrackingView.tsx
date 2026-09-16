import React, { useState, useEffect } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Save,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Shield,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

type SupplementStatus = 'pending' | 'submitted' | 'approved' | 'denied' | 'partial';

interface Supplement {
  id: string;
  company_id: string;
  claim_id: string;
  supplement_number: string;
  description: string;
  amount_requested?: number;
  amount_approved?: number;
  status: SupplementStatus;
  submitted_date?: string;
  approved_date?: string;
  notes?: string;
  created_at: string;
  // joined
  claim_number?: string;
  insurance_company?: string;
}

interface InsuranceClaim {
  id: string;
  claim_number: string;
  insurance_company: string;
}

const STATUS_CONFIG: Record<SupplementStatus, { label: string; className: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-700', icon: Clock },
  submitted: { label: 'Submitted', className: 'bg-blue-100 text-blue-700', icon: FileText },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700', icon: CheckCircle },
  denied: { label: 'Denied', className: 'bg-red-100 text-red-700', icon: XCircle },
  partial: { label: 'Partial Approval', className: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
};

function StatusBadge({ status }: { status: SupplementStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.className}`}>
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}

const EMPTY_FORM = {
  claim_id: '',
  supplement_number: '',
  description: '',
  amount_requested: '',
  amount_approved: '',
  status: 'pending' as SupplementStatus,
  submitted_date: '',
  approved_date: '',
  notes: '',
};

interface SupplementTrackingViewProps {
  contactId?: string;
  contactName?: string;
}

export default function SupplementTrackingView({ contactId, contactName }: SupplementTrackingViewProps = {}) {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SupplementStatus | 'all'>('all');
  const [claimFilter, setClaimFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplement, setEditingSupplement] = useState<Supplement | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const companyId = state.companyId;

  // Pick up claim filter from session storage (set by InsuranceTrackingView)
  useEffect(() => {
    const savedFilter = sessionStorage.getItem('supplement_claim_filter');
    if (savedFilter) {
      setClaimFilter(savedFilter);
      sessionStorage.removeItem('supplement_claim_filter');
    }
  }, []);

  const loadData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const suppQuery = supabase
        .from('supplements')
        .select(`*, insurance_claims(claim_number, insurance_company, contact_id)`)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      let claimQuery = supabase
        .from('insurance_claims')
        .select('id, claim_number, insurance_company')
        .eq('company_id', companyId)
        .order('claim_number');

      if (contactId) claimQuery = claimQuery.eq('contact_id', contactId);

      const [suppRes, claimRes] = await Promise.all([suppQuery, claimQuery]);

      if (suppRes.error) throw suppRes.error;
      if (claimRes.error) throw claimRes.error;

      const claimIds = new Set((claimRes.data || []).map((c: any) => c.id));
      const mapped = (suppRes.data || [])
        .filter((row: any) => !contactId || claimIds.has(row.claim_id))
        .map((row: any) => ({
          ...row,
          claim_number: row.insurance_claims?.claim_number,
          insurance_company: row.insurance_claims?.insurance_company,
        }));
      setSupplements(mapped);
      setClaims(claimRes.data || []);
    } catch (err: any) {
      toast.error('Failed to load supplements: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [companyId, contactId]);

  const openCreate = () => {
    setEditingSupplement(null);
    setForm({ ...EMPTY_FORM, claim_id: claimFilter !== 'all' ? claimFilter : '' });
    setShowModal(true);
  };

  const openEdit = (supp: Supplement) => {
    setEditingSupplement(supp);
    setForm({
      claim_id: supp.claim_id,
      supplement_number: supp.supplement_number,
      description: supp.description,
      amount_requested: supp.amount_requested?.toString() ?? '',
      amount_approved: supp.amount_approved?.toString() ?? '',
      status: supp.status,
      submitted_date: supp.submitted_date ?? '',
      approved_date: supp.approved_date ?? '',
      notes: supp.notes ?? '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.claim_id || !form.supplement_number.trim() || !form.description.trim()) {
      toast.error('Claim, supplement number, and description are required');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        company_id: companyId,
        claim_id: form.claim_id,
        supplement_number: form.supplement_number.trim(),
        description: form.description.trim(),
        amount_requested: form.amount_requested ? parseFloat(form.amount_requested) : null,
        amount_approved: form.amount_approved ? parseFloat(form.amount_approved) : null,
        status: form.status,
        submitted_date: form.submitted_date || null,
        approved_date: form.approved_date || null,
        notes: form.notes.trim() || null,
      };

      if (editingSupplement) {
        const { error } = await withTimeout(
          supabase
            .from('supplements')
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', editingSupplement.id),
          10000, 'updateSupplement'
        );
        if (error) throw error;
        toast.success('Supplement updated');
      } else {
        const { error } = await withTimeout(
          supabase.from('supplements').insert(payload),
          10000, 'createSupplement'
        );
        if (error) throw error;
        toast.success('Supplement created');
      }

      setShowModal(false);
      loadData();
    } catch (err: any) {
      toast.error('Failed to save supplement: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await withTimeout(
        supabase.from('supplements').delete().eq('id', id),
        10000, 'deleteSupplement'
      );
      if (error) throw error;
      toast.success('Supplement deleted');
      setSupplements(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      toast.error('Failed to delete: ' + err.message);
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  const activeClaim = claimFilter !== 'all' ? claims.find(c => c.id === claimFilter) : null;

  const filtered = supplements.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      s.supplement_number.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      (s.claim_number ?? '').toLowerCase().includes(q) ||
      (s.insurance_company ?? '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchClaim = claimFilter === 'all' || s.claim_id === claimFilter;
    return matchSearch && matchStatus && matchClaim;
  });

  const totalRequested = filtered.reduce((sum, s) => sum + (s.amount_requested ?? 0), 0);
  const totalApproved = filtered.reduce((sum, s) => sum + (s.amount_approved ?? 0), 0);
  const approvedCount = filtered.filter(s => s.status === 'approved' || s.status === 'partial').length;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {activeClaim && (
              <button
                onClick={() => {
                  setClaimFilter('all');
                  dispatch({ type: 'GO_BACK' });
                }}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <AlertCircle size={24} className="text-orange-500" />
                <h1 className="text-xl font-semibold text-gray-900">Supplement Tracking</h1>
              </div>
              {activeClaim ? (
                <p className="text-sm text-blue-600 font-medium">
                  Claim {activeClaim.claim_number} — {activeClaim.insurance_company}
                </p>
              ) : (
                <p className="text-sm text-gray-500">
                  {contactName
                    ? `Supplements for ${contactName}`
                    : 'Track supplement requests across all claims'}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => dispatch({ type: 'SET_VIEW', payload: 'insurance-tracking' })}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
            >
              <Shield size={14} />
              Insurance Claims
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium"
            >
              <Plus size={16} />
              New Supplement
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-orange-600">{filtered.length}</p>
            <p className="text-xs text-orange-500">Total Supplements</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-700">${totalApproved.toLocaleString()}</p>
            <p className="text-xs text-green-600">Total Approved</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
            <p className="text-2xl font-bold text-gray-700">${totalRequested.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Total Requested</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search supplements..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <select
            value={claimFilter}
            onChange={e => setClaimFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="all">All Claims</option>
            {claims.map(c => (
              <option key={c.id} value={c.id}>{c.claim_number} — {c.insurance_company}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as SupplementStatus | 'all')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="all">All Statuses</option>
            {(Object.keys(STATUS_CONFIG) as SupplementStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Loading supplements...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <AlertCircle size={40} className="mb-2 opacity-30" />
            <p>{searchQuery || statusFilter !== 'all' || claimFilter !== 'all' ? 'No supplements match your filters' : 'No supplements yet'}</p>
            {!searchQuery && statusFilter === 'all' && (
              <button onClick={openCreate} className="mt-3 text-orange-500 hover:underline text-sm">Add first supplement</button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(supp => (
              <div key={supp.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{supp.supplement_number}</h3>
                      <StatusBadge status={supp.status} />
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5">{supp.description}</p>
                    {(supp.claim_number || supp.insurance_company) && (
                      <button
                        onClick={() => {
                          setClaimFilter(supp.claim_id);
                          dispatch({ type: 'SET_VIEW', payload: 'insurance-tracking' });
                        }}
                        className="flex items-center gap-1 mt-1 text-xs text-blue-600 hover:underline"
                      >
                        <Shield size={11} />
                        {supp.claim_number} — {supp.insurance_company}
                      </button>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                      {supp.amount_requested != null && (
                        <span className="flex items-center gap-1">
                          <DollarSign size={11} /> Requested: ${supp.amount_requested.toLocaleString()}
                        </span>
                      )}
                      {supp.amount_approved != null && (
                        <span className="flex items-center gap-1 text-green-700 font-medium">
                          <CheckCircle size={11} /> Approved: ${supp.amount_approved.toLocaleString()}
                        </span>
                      )}
                      {supp.submitted_date && (
                        <span className="flex items-center gap-1">
                          <Calendar size={11} /> Submitted: {new Date(supp.submitted_date).toLocaleDateString()}
                        </span>
                      )}
                      {supp.approved_date && (
                        <span className="flex items-center gap-1 text-green-600">
                          <Calendar size={11} /> Approved: {new Date(supp.approved_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(supp)}
                      className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(supp.id)}
                      className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {supp.notes && (
                  <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2 line-clamp-2">{supp.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">
                {editingSupplement ? 'Edit Supplement' : 'New Supplement Request'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Claim *</label>
                <select
                  value={form.claim_id}
                  onChange={e => setForm(f => ({ ...f, claim_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">Select a claim...</option>
                  {claims.map(c => (
                    <option key={c.id} value={c.id}>{c.claim_number} — {c.insurance_company}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplement # *</label>
                <input
                  type="text"
                  value={form.supplement_number}
                  onChange={e => setForm(f => ({ ...f, supplement_number: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="SUPP-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as SupplementStatus }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  {(Object.keys(STATUS_CONFIG) as SupplementStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="Describe the additional work or materials..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Requested</label>
                <div className="relative">
                  <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    value={form.amount_requested}
                    onChange={e => setForm(f => ({ ...f, amount_requested: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Approved</label>
                <div className="relative">
                  <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    value={form.amount_approved}
                    onChange={e => setForm(f => ({ ...f, amount_approved: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Submitted Date</label>
                <input
                  type="date"
                  value={form.submitted_date}
                  onChange={e => setForm(f => ({ ...f, submitted_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Approved Date</label>
                <input
                  type="date"
                  value={form.approved_date}
                  onChange={e => setForm(f => ({ ...f, approved_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="Additional notes..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium disabled:opacity-50"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : editingSupplement ? 'Update Supplement' : 'Create Supplement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-gray-900 mb-2">Delete Supplement?</h3>
            <p className="text-sm text-gray-500 mb-4">This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => handleDelete(showDeleteConfirm)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

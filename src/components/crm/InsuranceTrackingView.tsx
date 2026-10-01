import React, { useState, useEffect } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import { formatPhoneNumber, withTimeout } from '@/lib/utils';
import {
  Shield,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Save,
  Phone,
  Mail,
  DollarSign,
  Calendar,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { CLAIM_STORM_EVENT, formatLossDate, takePendingClaimStorm, type ClaimStorm } from '@/lib/claimStorm';

type ClaimStatus =
  | 'pending'
  | 'inspection_scheduled'
  | 'inspection_complete'
  | 'approved'
  | 'denied'
  | 'supplement_in_progress'
  | 'closed';

interface InsuranceClaim {
  id: string;
  company_id: string;
  contact_id?: string;
  project_id?: string;
  claim_number: string;
  insurance_company: string;
  adjuster_name?: string;
  adjuster_phone?: string;
  adjuster_email?: string;
  claim_amount?: number;
  approved_amount?: number;
  deductible?: number;
  status: ClaimStatus;
  inspection_date?: string;
  loss_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // joined
  contact_name?: string;
  supplement_count?: number;
}

const STATUS_CONFIG: Record<ClaimStatus, { label: string; className: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-700', icon: Clock },
  inspection_scheduled: { label: 'Inspection Scheduled', className: 'bg-blue-100 text-blue-700', icon: Calendar },
  inspection_complete: { label: 'Inspection Complete', className: 'bg-purple-100 text-purple-700', icon: CheckCircle },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700', icon: CheckCircle },
  denied: { label: 'Denied', className: 'bg-red-100 text-red-700', icon: XCircle },
  supplement_in_progress: { label: 'Supplement In Progress', className: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  closed: { label: 'Closed', className: 'bg-slate-100 text-slate-600', icon: CheckCircle },
};

function StatusBadge({ status }: { status: ClaimStatus }) {
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
  contact_id: '',
  claim_number: '',
  insurance_company: '',
  adjuster_name: '',
  adjuster_phone: '',
  adjuster_email: '',
  claim_amount: '',
  approved_amount: '',
  deductible: '',
  status: 'pending' as ClaimStatus,
  inspection_date: '',
  loss_date: '',
  notes: '',
};

interface InsuranceTrackingViewProps {
  contactId?: string;
  contactName?: string;
}

export default function InsuranceTrackingView({ contactId, contactName }: InsuranceTrackingViewProps = {}) {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingClaim, setEditingClaim] = useState<InsuranceClaim | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const companyId = state.companyId;

  // Load claims
  const loadClaims = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('insurance_claims')
        .select(`
          *,
          contacts(first_name, last_name),
          supplements(id)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (contactId) query = query.eq('contact_id', contactId);

      const { data, error } = await query;

      if (error) throw error;

      const mapped = (data || []).map((row: any) => ({
        ...row,
        contact_name: row.contacts
          ? `${row.contacts.first_name ?? ''} ${row.contacts.last_name ?? ''}`.trim()
          : undefined,
        supplement_count: row.supplements?.length ?? 0,
      }));
      setClaims(mapped);
    } catch (err: any) {
      toast.error('Failed to load insurance claims: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadClaims(); }, [companyId, contactId]);

  // A storm picked from the storm history. With no claim yet it starts one with that date of loss;
  // otherwise the user chooses which claim it belongs to.
  const [incomingStorm, setIncomingStorm] = useState<ClaimStorm | null>(null);
  const [applyingStormTo, setApplyingStormTo] = useState<string | null>(null);

  useEffect(() => {
    const pick = () => {
      const storm = takePendingClaimStorm();
      if (storm) setIncomingStorm(storm);
    };
    pick();
    window.addEventListener(CLAIM_STORM_EVENT, pick);
    return () => window.removeEventListener(CLAIM_STORM_EVENT, pick);
  }, []);

  const startClaimFromStorm = (storm: ClaimStorm) => {
    setEditingClaim(null);
    setForm({ ...EMPTY_FORM, loss_date: storm.lossDate, notes: `Storm: ${storm.summary}` });
    setShowModal(true);
    setIncomingStorm(null);
  };

  // No claims yet: go straight to a new one (once the list has loaded, so a claim is not missed).
  useEffect(() => {
    if (incomingStorm && !loading && claims.length === 0) startClaimFromStorm(incomingStorm);
  }, [incomingStorm, loading, claims.length]);

  const applyStormToClaim = async (claim: InsuranceClaim, storm: ClaimStorm) => {
    setApplyingStormTo(claim.id);
    try {
      const line = `Storm: ${storm.summary}`;
      const notes = claim.notes?.includes(storm.summary) ? claim.notes : [claim.notes, line].filter(Boolean).join('\n\n');
      const { error } = await withTimeout(
        supabase
          .from('insurance_claims')
          .update({ loss_date: storm.lossDate, notes, updated_at: new Date().toISOString() })
          .eq('id', claim.id),
        10000, 'setClaimStormDate'
      );
      if (error) throw error;
      toast.success(`Date of loss for ${claim.claim_number} set to ${formatLossDate(storm.lossDate)}`);
      setIncomingStorm(null);
      loadClaims();
    } catch (err: any) {
      toast.error('Could not update the claim: ' + err.message);
    } finally {
      setApplyingStormTo(null);
    }
  };

  const openCreate = () => {
    setEditingClaim(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (claim: InsuranceClaim) => {
    setEditingClaim(claim);
    setForm({
      contact_id: claim.contact_id ?? '',
      claim_number: claim.claim_number,
      insurance_company: claim.insurance_company,
      adjuster_name: claim.adjuster_name ?? '',
      adjuster_phone: claim.adjuster_phone ?? '',
      adjuster_email: claim.adjuster_email ?? '',
      claim_amount: claim.claim_amount?.toString() ?? '',
      approved_amount: claim.approved_amount?.toString() ?? '',
      deductible: claim.deductible?.toString() ?? '',
      status: claim.status,
      inspection_date: claim.inspection_date ?? '',
      loss_date: claim.loss_date ?? '',
      notes: claim.notes ?? '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.claim_number.trim() || !form.insurance_company.trim()) {
      toast.error('Claim number and insurance company are required');
      return;
    }
    // A claim belongs to a customer; inside a contact record that customer is fixed.
    const claimContactId = contactId || form.contact_id;
    if (!claimContactId) {
      toast.error('Choose the customer this claim is for');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        company_id: companyId,
        contact_id: claimContactId,
        claim_number: form.claim_number.trim(),
        insurance_company: form.insurance_company.trim(),
        adjuster_name: form.adjuster_name.trim() || null,
        adjuster_phone: form.adjuster_phone.trim() || null,
        adjuster_email: form.adjuster_email.trim() || null,
        claim_amount: form.claim_amount ? parseFloat(form.claim_amount) : null,
        approved_amount: form.approved_amount ? parseFloat(form.approved_amount) : null,
        deductible: form.deductible ? parseFloat(form.deductible) : null,
        status: form.status,
        inspection_date: form.inspection_date || null,
        loss_date: form.loss_date || null,
        notes: form.notes.trim() || null,
      };

      if (editingClaim) {
        const { error } = await withTimeout(
          supabase
            .from('insurance_claims')
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', editingClaim.id),
          10000, 'updateInsuranceClaim'
        );
        if (error) throw error;
        toast.success('Claim updated');
      } else {
        const { error } = await withTimeout(
          supabase.from('insurance_claims').insert(payload),
          10000, 'createInsuranceClaim'
        );
        if (error) throw error;
        toast.success('Claim created');
      }

      setShowModal(false);
      loadClaims();
    } catch (err: any) {
      toast.error('Failed to save claim: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await withTimeout(
        supabase.from('insurance_claims').delete().eq('id', id),
        10000, 'deleteInsuranceClaim'
      );
      if (error) throw error;
      toast.success('Claim deleted');
      setClaims(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      toast.error('Failed to delete: ' + err.message);
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  const filtered = claims.filter(c => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      c.claim_number.toLowerCase().includes(q) ||
      c.insurance_company.toLowerCase().includes(q) ||
      (c.contact_name ?? '').toLowerCase().includes(q) ||
      (c.adjuster_name ?? '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalApproved = claims.reduce((sum, c) => sum + (c.approved_amount ?? 0), 0);
  const totalClaimed = claims.reduce((sum, c) => sum + (c.claim_amount ?? 0), 0);
  const openClaims = claims.filter(c => !['denied', 'closed'].includes(c.status)).length;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Shield size={24} className="text-blue-600" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Insurance Tracking</h1>
              <p className="text-sm text-gray-500">
                {contactName
                  ? `Insurance claims for ${contactName}`
                  : 'Manage insurance claims and adjuster communications'}
              </p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={16} />
            New Claim
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{openClaims}</p>
            <p className="text-xs text-blue-600">Open Claims</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-700">${totalApproved.toLocaleString()}</p>
            <p className="text-xs text-green-600">Total Approved</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
            <p className="text-2xl font-bold text-gray-700">${totalClaimed.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Total Claimed</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search claims..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as ClaimStatus | 'all')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            {(Object.keys(STATUS_CONFIG) as ClaimStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Loading claims...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <Shield size={40} className="mb-2 opacity-30" />
            <p>{searchQuery || statusFilter !== 'all' ? 'No claims match your filters' : 'No insurance claims yet'}</p>
            {!searchQuery && statusFilter === 'all' && (
              <button onClick={openCreate} className="mt-3 text-blue-600 hover:underline text-sm">Add first claim</button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(claim => (
              <div key={claim.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{claim.claim_number}</h3>
                      <StatusBadge status={claim.status} />
                      {claim.supplement_count! > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                          {claim.supplement_count} supplement{claim.supplement_count !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-blue-700 mt-0.5">{claim.insurance_company}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                      {claim.contact_name && (
                        <span className="flex items-center gap-1">
                          <FileText size={11} /> {claim.contact_name}
                        </span>
                      )}
                      {claim.adjuster_name && (
                        <span>Adjuster: {claim.adjuster_name}</span>
                      )}
                      {claim.inspection_date && (
                        <span className="flex items-center gap-1">
                          <Calendar size={11} /> Inspection: {new Date(claim.inspection_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                      {claim.claim_amount != null && (
                        <span className="flex items-center gap-1">
                          <DollarSign size={11} /> Claimed: ${claim.claim_amount.toLocaleString()}
                        </span>
                      )}
                      {claim.approved_amount != null && (
                        <span className="flex items-center gap-1 text-green-700 font-medium">
                          <CheckCircle size={11} /> Approved: ${claim.approved_amount.toLocaleString()}
                        </span>
                      )}
                      {claim.deductible != null && (
                        <span>Deductible: ${claim.deductible.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        // Navigate to supplement tracking filtered by this claim
                        dispatch({ type: 'SET_VIEW', payload: 'supplement-tracking' });
                        sessionStorage.setItem('supplement_claim_filter', claim.id);
                      }}
                      className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg"
                      title="View Supplements"
                    >
                      <ExternalLink size={16} />
                    </button>
                    <button
                      onClick={() => openEdit(claim)}
                      className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(claim.id)}
                      className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {claim.notes && (
                  <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2 line-clamp-2">{claim.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">
                {editingClaim ? 'Edit Claim' : 'New Insurance Claim'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {!contactId && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                  <select
                    value={form.contact_id}
                    onChange={e => setForm(f => ({ ...f, contact_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">— Select customer —</option>
                    {[...state.contacts]
                      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.email || 'Unnamed contact'}
                          {c.address ? ` — ${c.address}` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Claim Number *</label>
                <input
                  type="text"
                  value={form.claim_number}
                  onChange={e => setForm(f => ({ ...f, claim_number: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="CLM-2024-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Company *</label>
                <input
                  type="text"
                  value={form.insurance_company}
                  onChange={e => setForm(f => ({ ...f, insurance_company: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="State Farm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as ClaimStatus }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {(Object.keys(STATUS_CONFIG) as ClaimStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loss Date</label>
                <input
                  type="date"
                  value={form.loss_date}
                  onChange={e => setForm(f => ({ ...f, loss_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adjuster Name</label>
                <input
                  type="text"
                  value={form.adjuster_name}
                  onChange={e => setForm(f => ({ ...f, adjuster_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adjuster Phone</label>
                <input
                  type="tel"
                  value={form.adjuster_phone}
                  onChange={e => setForm(f => ({ ...f, adjuster_phone: formatPhoneNumber(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="(555) 000-0000"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Adjuster Email</label>
                <input
                  type="email"
                  value={form.adjuster_email}
                  onChange={e => setForm(f => ({ ...f, adjuster_email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="adjuster@insurance.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Claimed</label>
                <p className="text-xs text-gray-500 mb-1">What you asked the insurer for</p>
                <div className="relative">
                  <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    value={form.claim_amount}
                    onChange={e => setForm(f => ({ ...f, claim_amount: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Approved by Insurer</label>
                <p className="text-xs text-gray-500 mb-1">What the adjuster approved — often lower</p>
                <div className="relative">
                  <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    value={form.approved_amount}
                    onChange={e => setForm(f => ({ ...f, approved_amount: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deductible</label>
                <div className="relative">
                  <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    value={form.deductible}
                    onChange={e => setForm(f => ({ ...f, deductible: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inspection Date</label>
                <input
                  type="date"
                  value={form.inspection_date}
                  onChange={e => setForm(f => ({ ...f, inspection_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : editingClaim ? 'Update Claim' : 'Create Claim'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Which claim does this storm belong to? */}
      {incomingStorm && claims.length > 0 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setIncomingStorm(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900">Add this storm to a claim</h3>
            <p className="mt-1 text-sm text-gray-600">{incomingStorm.summary}</p>
            <p className="mt-2 text-sm font-medium text-gray-900">Date of loss: {formatLossDate(incomingStorm.lossDate)}</p>
            <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
              {claims.map((claim) => {
                const replaces = !!claim.loss_date && claim.loss_date.slice(0, 10) !== incomingStorm.lossDate;
                return (
                  <button
                    key={claim.id}
                    type="button"
                    disabled={applyingStormTo !== null}
                    onClick={() => applyStormToClaim(claim, incomingStorm)}
                    className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-orange-300 hover:bg-orange-50/40 disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-gray-900">{claim.claim_number}</span>
                      <span className="text-xs text-gray-500">{claim.insurance_company}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {claim.loss_date
                        ? `Currently ${formatLossDate(claim.loss_date)}${replaces ? ' — will be replaced' : ' — already this date'}`
                        : 'No date of loss yet'}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => startClaimFromStorm(incomingStorm)} className="text-sm font-medium text-blue-600 hover:underline">
                Start a new claim with this storm
              </button>
              <button type="button" onClick={() => setIncomingStorm(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-gray-900 mb-2">Delete Claim?</h3>
            <p className="text-sm text-gray-500 mb-4">This will also delete all linked supplements. This cannot be undone.</p>
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

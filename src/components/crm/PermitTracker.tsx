import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCheck,
  AlertCircle,
  Calendar,
  Plus,
  Edit3,
  Trash2,
  Zap,
  Droplets,
  Home,
  HardHat,
  FileText,
  X,
  DollarSign,
  CheckCircle2,
  Clock,
  Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/authContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type PermitType = 'building' | 'electrical' | 'plumbing' | 'roofing' | 'other';
type PermitStatus =
  | 'not-required'
  | 'pending'
  | 'applied'
  | 'approved'
  | 'inspected'
  | 'closed'
  | 'expired'
  | 'denied';

interface Permit {
  id: string;
  company_id: string;
  contact_id: string;
  permit_number: string | null;
  permit_type: PermitType;
  issuing_authority: string | null;
  description: string | null;
  status: PermitStatus;
  applied_date: string | null;
  approved_date: string | null;
  expires_date: string | null;
  inspection_date: string | null;
  fee: number | null;
  notes: string | null;
}

type PermitFormData = Omit<Permit, 'id' | 'company_id' | 'contact_id'>;

interface PermitTrackerProps {
  contactId: string;
  companyId: string;
  readOnly?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PERMIT_TYPES: { value: PermitType; label: string }[] = [
  { value: 'building', label: 'Building' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'other', label: 'Other' },
];

const PERMIT_STATUSES: { value: PermitStatus; label: string }[] = [
  { value: 'not-required', label: 'Not Required' },
  { value: 'pending', label: 'Pending' },
  { value: 'applied', label: 'Applied' },
  { value: 'approved', label: 'Approved' },
  { value: 'inspected', label: 'Inspected' },
  { value: 'closed', label: 'Closed' },
  { value: 'expired', label: 'Expired' },
  { value: 'denied', label: 'Denied' },
];

const EMPTY_FORM: PermitFormData = {
  permit_number: '',
  permit_type: 'building',
  issuing_authority: '',
  description: '',
  status: 'pending',
  applied_date: '',
  approved_date: '',
  expires_date: '',
  inspection_date: '',
  fee: null,
  notes: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPermitTypeIcon(type: PermitType) {
  switch (type) {
    case 'building':    return <Home className="h-4 w-4" />;
    case 'electrical':  return <Zap className="h-4 w-4" />;
    case 'plumbing':    return <Droplets className="h-4 w-4" />;
    case 'roofing':     return <HardHat className="h-4 w-4" />;
    default:            return <FileText className="h-4 w-4" />;
  }
}

function getStatusBadgeClass(status: PermitStatus): string {
  switch (status) {
    case 'not-required': return 'bg-gray-100 text-gray-600';
    case 'pending':      return 'bg-yellow-100 text-yellow-700';
    case 'applied':      return 'bg-blue-100 text-blue-700';
    case 'approved':     return 'bg-green-100 text-green-700';
    case 'inspected':    return 'bg-teal-100 text-teal-700';
    case 'closed':       return 'bg-gray-100 text-gray-600';
    case 'expired':      return 'bg-red-100 text-red-700';
    case 'denied':       return 'bg-red-100 text-red-700';
  }
}

function getStatusIcon(status: PermitStatus) {
  switch (status) {
    case 'approved':
    case 'inspected':
    case 'closed':
      return <CheckCircle2 className="h-3 w-3" />;
    case 'expired':
    case 'denied':
      return <Ban className="h-3 w-3" />;
    case 'pending':
    case 'applied':
      return <Clock className="h-3 w-3" />;
    default:
      return null;
  }
}

function isDateWarning(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return d <= new Date(now.getTime() + thirtyDays);
}

function isDateExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PermitTracker({ contactId, companyId, readOnly }: PermitTrackerProps) {
  const { profile } = useAuth();
  const [permits, setPermits] = useState<Permit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPermit, setEditingPermit] = useState<Permit | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PermitFormData>(EMPTY_FORM);

  const effectiveCompanyId = companyId || profile?.company_id || '';

  // Load permits
  const loadPermits = useCallback(async () => {
    if (!effectiveCompanyId || !contactId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('permits')
        .select('*')
        .eq('company_id', effectiveCompanyId)
        .eq('contact_id', contactId)
        .order('applied_date', { ascending: false });

      if (error) throw error;
      setPermits((data as Permit[]) || []);
    } catch (err) {
      console.error('Error loading permits:', err);
      toast.error('Could not load permits');
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId, contactId]);

  useEffect(() => {
    loadPermits();
  }, [loadPermits]);

  // Open add form
  const openAddForm = () => {
    setEditingPermit(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  // Open edit form
  const openEditForm = (permit: Permit) => {
    setEditingPermit(permit);
    setForm({
      permit_number: permit.permit_number || '',
      permit_type: permit.permit_type,
      issuing_authority: permit.issuing_authority || '',
      description: permit.description || '',
      status: permit.status,
      applied_date: permit.applied_date || '',
      approved_date: permit.approved_date || '',
      expires_date: permit.expires_date || '',
      inspection_date: permit.inspection_date || '',
      fee: permit.fee,
      notes: permit.notes || '',
    });
    setShowForm(true);
  };

  // Save permit
  const savePermit = async () => {
    if (!effectiveCompanyId || !contactId) return;
    setSaving(true);
    try {
      const payload = {
        company_id: effectiveCompanyId,
        contact_id: contactId,
        permit_number: form.permit_number || null,
        permit_type: form.permit_type,
        issuing_authority: form.issuing_authority || null,
        description: form.description || null,
        status: form.status,
        applied_date: form.applied_date || null,
        approved_date: form.approved_date || null,
        expires_date: form.expires_date || null,
        inspection_date: form.inspection_date || null,
        fee: form.fee,
        notes: form.notes || null,
      };

      if (editingPermit) {
        const { error } = await supabase
          .from('permits')
          .update(payload)
          .eq('id', editingPermit.id);
        if (error) throw error;
        toast.success('Permit updated');
      } else {
        const { error } = await supabase
          .from('permits')
          .insert(payload);
        if (error) throw error;
        toast.success('Permit added');
      }

      setShowForm(false);
      await loadPermits();
    } catch (err) {
      console.error('Error saving permit:', err);
      toast.error('Failed to save permit');
    } finally {
      setSaving(false);
    }
  };

  // Delete permit
  const deletePermit = async (id: string) => {
    if (!window.confirm('Delete this permit?')) return;
    try {
      const { error } = await supabase.from('permits').delete().eq('id', id);
      if (error) throw error;
      toast.success('Permit deleted');
      setPermits(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('Error deleting permit:', err);
      toast.error('Failed to delete permit');
    }
  };

  // Form field helpers
  const setField = <K extends keyof PermitFormData>(key: K, value: PermitFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700">Permits</h3>
          {permits.length > 0 && (
            <span className="text-xs text-gray-400">({permits.length})</span>
          )}
        </div>
        {!readOnly && (
          <Button size="sm" variant="outline" onClick={openAddForm} className="h-7 text-xs gap-1">
            <Plus className="h-3 w-3" />
            Add Permit
          </Button>
        )}
      </div>

      {/* Permit cards */}
      {loading ? (
        <div className="text-xs text-gray-400 py-4 text-center">Loading permits…</div>
      ) : permits.length === 0 ? (
        <div className="text-xs text-gray-400 py-4 text-center border border-dashed rounded-md">
          No permits on record
        </div>
      ) : (
        <div className="space-y-2">
          {permits.map(permit => {
            const expiresWarning = isDateWarning(permit.expires_date);
            const expiresExpired = isDateExpired(permit.expires_date);

            return (
              <div
                key={permit.id}
                className="border border-gray-200 rounded-lg p-3 bg-white hover:border-gray-300 transition-colors"
              >
                {/* Top row: type icon + permit number + status + actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-gray-500 shrink-0">
                      {getPermitTypeIcon(permit.permit_type)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-800">
                          {PERMIT_TYPES.find(t => t.value === permit.permit_type)?.label}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">
                          {permit.permit_number || (
                            <span className="italic text-gray-400">Pending #</span>
                          )}
                        </span>
                      </div>
                      {permit.issuing_authority && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{permit.issuing_authority}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge className={`text-xs px-2 py-0.5 gap-1 flex items-center ${getStatusBadgeClass(permit.status)}`}>
                      {getStatusIcon(permit.status)}
                      {PERMIT_STATUSES.find(s => s.value === permit.status)?.label}
                    </Badge>
                    {!readOnly && (
                      <>
                        <button
                          onClick={() => openEditForm(permit)}
                          className="text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                          title="Edit"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deletePermit(permit.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-0.5"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Description */}
                {permit.description && (
                  <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{permit.description}</p>
                )}

                {/* Key dates + fee row */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  {permit.applied_date && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="h-3 w-3" />
                      <span>Applied: {formatDate(permit.applied_date)}</span>
                    </div>
                  )}
                  {permit.approved_date && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      <span>Approved: {formatDate(permit.approved_date)}</span>
                    </div>
                  )}
                  {permit.expires_date && (
                    <div className={`flex items-center gap-1 text-xs ${expiresExpired || expiresWarning ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                      {(expiresExpired || expiresWarning) ? (
                        <AlertCircle className="h-3 w-3" />
                      ) : (
                        <Calendar className="h-3 w-3" />
                      )}
                      <span>Expires: {formatDate(permit.expires_date)}</span>
                    </div>
                  )}
                  {permit.inspection_date && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <FileCheck className="h-3 w-3" />
                      <span>Inspection: {formatDate(permit.inspection_date)}</span>
                    </div>
                  )}
                  {permit.fee != null && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <DollarSign className="h-3 w-3" />
                      <span>${Number(permit.fee).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {permit.notes && (
                  <p className="text-xs text-gray-400 mt-1.5 italic line-clamp-2">{permit.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) setShowForm(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <FileCheck className="h-4 w-4" />
              {editingPermit ? 'Edit Permit' : 'Add Permit'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {/* Row 1: type + status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Permit Type</Label>
                <Select
                  value={form.permit_type}
                  onValueChange={v => setField('permit_type', v as PermitType)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERMIT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={v => setField('status', v as PermitStatus)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERMIT_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: permit number + issuing authority */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Permit Number</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="e.g. B-2024-0123"
                  value={form.permit_number || ''}
                  onChange={e => setField('permit_number', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Issuing Authority</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="e.g. City of Austin"
                  value={form.issuing_authority || ''}
                  onChange={e => setField('issuing_authority', e.target.value)}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input
                className="h-8 text-xs"
                placeholder="Brief description of work"
                value={form.description || ''}
                onChange={e => setField('description', e.target.value)}
              />
            </div>

            {/* Dates row 1: applied + approved */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Applied Date</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={form.applied_date || ''}
                  onChange={e => setField('applied_date', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Approved Date</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={form.approved_date || ''}
                  onChange={e => setField('approved_date', e.target.value)}
                />
              </div>
            </div>

            {/* Dates row 2: expires + inspection */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Expires Date</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={form.expires_date || ''}
                  onChange={e => setField('expires_date', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Inspection Date</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={form.inspection_date || ''}
                  onChange={e => setField('inspection_date', e.target.value)}
                />
              </div>
            </div>

            {/* Fee */}
            <div className="space-y-1">
              <Label className="text-xs">Fee ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="h-8 text-xs"
                placeholder="0.00"
                value={form.fee ?? ''}
                onChange={e => setField('fee', e.target.value === '' ? null : parseFloat(e.target.value))}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea
                className="text-xs resize-none"
                rows={2}
                placeholder="Additional notes…"
                value={form.notes || ''}
                onChange={e => setField('notes', e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(false)}
              className="h-8 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={savePermit}
              disabled={saving}
              className="h-8 text-xs"
            >
              {saving ? 'Saving…' : editingPermit ? 'Save Changes' : 'Add Permit'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

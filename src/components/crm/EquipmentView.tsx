import React, { useState, useEffect, useCallback } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import { toast } from 'sonner';
import { parseLocalDate } from '@/lib/dates';
import {
  Wrench,
  Truck,
  Cog,
  Plus,
  Edit3,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Loader2,
  X,
  Save,
  Package,
  Calendar,
  Tag,
  User,
  Briefcase,
  Search,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type EquipmentCategory = 'tool' | 'vehicle' | 'machinery' | 'other';
type EquipmentStatus = 'available' | 'in-use' | 'maintenance' | 'retired';

interface Equipment {
  id: string;
  company_id: string;
  name: string;
  category: EquipmentCategory;
  make: string | null;
  model: string | null;
  year: number | null;
  serial_number: string | null;
  license_plate: string | null;
  vin: string | null;
  status: EquipmentStatus;
  purchase_date: string | null;
  purchase_price: number | null;
  last_maintenance: string | null;
  next_maintenance: string | null;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface TeamProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  tool: 'Tool',
  vehicle: 'Vehicle',
  machinery: 'Machinery',
  other: 'Other',
};

const STATUS_LABELS: Record<EquipmentStatus, string> = {
  available: 'Available',
  'in-use': 'In Use',
  maintenance: 'Maintenance',
  retired: 'Retired',
};

const STATUS_COLORS: Record<EquipmentStatus, string> = {
  available: 'bg-green-100 text-green-700',
  'in-use': 'bg-blue-100 text-blue-700',
  maintenance: 'bg-yellow-100 text-yellow-700',
  retired: 'bg-gray-100 text-gray-500',
};

function CategoryIcon({ category, size = 20 }: { category: EquipmentCategory; size?: number }) {
  if (category === 'vehicle') return <Truck size={size} />;
  if (category === 'machinery') return <Cog size={size} />;
  if (category === 'tool') return <Wrench size={size} />;
  return <Package size={size} />;
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function isDueSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const diff = new Date(dateStr).getTime() - Date.now();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

const emptyForm = {
  name: '',
  category: 'tool' as EquipmentCategory,
  make: '',
  model: '',
  year: '',
  serial_number: '',
  license_plate: '',
  vin: '',
  status: 'available' as EquipmentStatus,
  purchase_date: '',
  purchase_price: '',
  last_maintenance: '',
  next_maintenance: '',
  assigned_to: '',
  notes: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function EquipmentView() {
  const { state } = useCRM();
  const { profile } = useAuth();

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [categoryFilter, setCategoryFilter] = useState<EquipmentCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningEquipment, setAssigningEquipment] = useState<Equipment | null>(null);
  const [assignContactId, setAssignContactId] = useState('');

  const effectiveCompanyId = profile?.company_id || state.companyId || null;

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadEquipment = useCallback(async () => {
    if (!effectiveCompanyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('company_id', effectiveCompanyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEquipment((data as Equipment[]) || []);
    } catch (err) {
      console.error('Error loading equipment:', err);
      toast.error('Failed to load equipment');
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId]);

  const loadTeamMembers = useCallback(async () => {
    if (!effectiveCompanyId) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('company_id', effectiveCompanyId);

      if (error) throw error;
      setTeamMembers((data as TeamProfile[]) || []);
    } catch (err) {
      console.error('Error loading team members:', err);
    }
  }, [effectiveCompanyId]);

  useEffect(() => {
    void loadEquipment();
    void loadTeamMembers();
  }, [loadEquipment, loadTeamMembers]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const filtered = equipment.filter((e) => {
    if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.name.toLowerCase().includes(q) ||
        (e.make ?? '').toLowerCase().includes(q) ||
        (e.model ?? '').toLowerCase().includes(q) ||
        (e.serial_number ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const maintenanceAlerts = equipment.filter(
    (e) => isOverdue(e.next_maintenance) || isDueSoon(e.next_maintenance)
  );

  const stats = {
    total: equipment.length,
    available: equipment.filter((e) => e.status === 'available').length,
    inUse: equipment.filter((e) => e.status === 'in-use').length,
    maintenanceDue: equipment.filter(
      (e) => isOverdue(e.next_maintenance) || isDueSoon(e.next_maintenance)
    ).length,
  };

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openAddModal = () => {
    setEditingEquipment(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (item: Equipment) => {
    setEditingEquipment(item);
    setFormData({
      name: item.name,
      category: item.category,
      make: item.make ?? '',
      model: item.model ?? '',
      year: item.year ? String(item.year) : '',
      serial_number: item.serial_number ?? '',
      license_plate: item.license_plate ?? '',
      vin: item.vin ?? '',
      status: item.status,
      purchase_date: item.purchase_date ?? '',
      purchase_price: item.purchase_price ? String(item.purchase_price) : '',
      last_maintenance: item.last_maintenance ?? '',
      next_maintenance: item.next_maintenance ?? '',
      assigned_to: item.assigned_to ?? '',
      notes: item.notes ?? '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Equipment name is required');
      return;
    }
    if (!effectiveCompanyId) {
      toast.error('No company context');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        company_id: effectiveCompanyId,
        name: formData.name.trim(),
        category: formData.category,
        make: formData.make || null,
        model: formData.model || null,
        year: formData.year ? parseInt(formData.year, 10) : null,
        serial_number: formData.serial_number || null,
        license_plate: formData.category === 'vehicle' ? (formData.license_plate || null) : null,
        vin: formData.category === 'vehicle' ? (formData.vin || null) : null,
        status: formData.status,
        purchase_date: formData.purchase_date || null,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        last_maintenance: formData.last_maintenance || null,
        next_maintenance: formData.next_maintenance || null,
        assigned_to: formData.assigned_to || null,
        notes: formData.notes || null,
      };

      if (editingEquipment) {
        const { data, error } = await withTimeout(
          supabase
            .from('equipment')
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', editingEquipment.id)
            .select()
            .single(),
          10000, 'updateEquipment'
        );

        if (error) throw error;
        setEquipment((prev) => prev.map((e) => (e.id === editingEquipment.id ? (data as Equipment) : e)));
        toast.success('Equipment updated');
      } else {
        const { data, error } = await withTimeout(
          supabase
            .from('equipment')
            .insert(payload)
            .select()
            .single(),
          10000, 'createEquipment'
        );

        if (error) throw error;
        setEquipment((prev) => [data as Equipment, ...prev]);
        toast.success('Equipment added');
      }

      setShowModal(false);
    } catch (err) {
      console.error('Error saving equipment:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save equipment');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: Equipment) => {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try {
      const { error } = await withTimeout(
        supabase.from('equipment').delete().eq('id', item.id),
        10000, 'deleteEquipment'
      );
      if (error) throw error;
      setEquipment((prev) => prev.filter((e) => e.id !== item.id));
      toast.success('Equipment deleted');
    } catch (err) {
      console.error('Error deleting equipment:', err);
      toast.error('Failed to delete equipment');
    }
  };

  const handleAssignToJob = async () => {
    if (!assigningEquipment || !assignContactId) {
      toast.error('Please select a contact/job');
      return;
    }
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('equipment')
          .update({ status: 'in-use', assigned_to: assignContactId, updated_at: new Date().toISOString() })
          .eq('id', assigningEquipment.id)
          .select()
          .single(),
        10000, 'assignEquipment'
      );

      if (error) throw error;
      setEquipment((prev) => prev.map((e) => (e.id === assigningEquipment.id ? (data as Equipment) : e)));
      toast.success(`${assigningEquipment.name} assigned to job`);
      setShowAssignModal(false);
      setAssigningEquipment(null);
      setAssignContactId('');
    } catch (err) {
      console.error('Error assigning equipment:', err);
      toast.error('Failed to assign equipment');
    }
  };

  const memberName = (id: string | null) => {
    if (!id) return null;
    const m = teamMembers.find((t) => t.id === id);
    return m ? (m.full_name || m.email || id) : id;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Equipment &amp; Assets</h2>
          <p className="text-gray-500 mt-1">Track tools, vehicles, and machinery</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Add Equipment
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'bg-gray-50 border-gray-200', text: 'text-gray-800' },
          { label: 'Available', value: stats.available, color: 'bg-green-50 border-green-200', text: 'text-green-700' },
          { label: 'In Use', value: stats.inUse, color: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
          { label: 'Maintenance Due', value: stats.maintenanceDue, color: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
            <div className={`text-2xl font-bold ${s.text}`}>{s.value}</div>
            <div className="text-sm text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Maintenance Alert Banner */}
      {maintenanceAlerts.length > 0 && (
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <AlertTriangle size={20} className="text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-800">Maintenance Alert</p>
            <p className="text-sm text-yellow-700 mt-0.5">
              {maintenanceAlerts.length} item{maintenanceAlerts.length > 1 ? 's' : ''} require
              {maintenanceAlerts.length === 1 ? 's' : ''} maintenance:{' '}
              {maintenanceAlerts.map((e) => e.name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search equipment..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['all', 'tool', 'vehicle', 'machinery'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                categoryFilter === cat
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as EquipmentStatus | 'all')}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="available">Available</option>
          <option value="in-use">In Use</option>
          <option value="maintenance">Maintenance</option>
          <option value="retired">Retired</option>
        </select>
      </div>

      {/* Equipment Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={32} className="animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Package size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">No equipment found</p>
          <p className="text-sm mt-1">Add your first item to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => {
            const overdue = isOverdue(item.next_maintenance);
            const dueSoon = !overdue && isDueSoon(item.next_maintenance);
            const assignedMember = memberName(item.assigned_to);

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => openEditModal(item)}
              >
                {/* Card header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                      <CategoryIcon category={item.category} size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 leading-tight">{item.name}</h3>
                      <span className="text-xs text-gray-400">{CATEGORY_LABELS[item.category]}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[item.status]}`}>
                    {STATUS_LABELS[item.status]}
                  </span>
                </div>

                {/* Make / Model / Year */}
                {(item.make || item.model || item.year) && (
                  <p className="text-sm text-gray-600 mb-1">
                    {[item.year, item.make, item.model].filter(Boolean).join(' ')}
                  </p>
                )}

                {/* Serial number */}
                {item.serial_number && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                    <Tag size={12} />
                    <span>S/N: {item.serial_number}</span>
                  </div>
                )}

                {/* Assigned to */}
                {assignedMember && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <User size={12} />
                    <span>{assignedMember}</span>
                  </div>
                )}

                {/* Next maintenance */}
                {item.next_maintenance && (
                  <div
                    className={`flex items-center gap-1.5 text-xs mb-3 ${
                      overdue ? 'text-red-600 font-semibold' : dueSoon ? 'text-yellow-600 font-medium' : 'text-gray-400'
                    }`}
                  >
                    {overdue ? <AlertTriangle size={12} /> : dueSoon ? <AlertTriangle size={12} /> : <Calendar size={12} />}
                    <span>
                      {overdue ? 'Overdue: ' : 'Next maintenance: '}
                      {parseLocalDate(item.next_maintenance).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div
                  className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.status === 'available' && (
                    <button
                      onClick={() => {
                        setAssigningEquipment(item);
                        setAssignContactId('');
                        setShowAssignModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <Briefcase size={13} />
                      Assign to Job
                    </button>
                  )}
                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => void handleDelete(item)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingEquipment ? 'Edit Equipment' : 'Add Equipment'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="e.g. Nail Gun, Ford F-250"
                />
              </div>

              {/* Category + Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value as EquipmentCategory }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                  >
                    <option value="tool">Tool</option>
                    <option value="vehicle">Vehicle</option>
                    <option value="machinery">Machinery</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value as EquipmentStatus }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                  >
                    <option value="available">Available</option>
                    <option value="in-use">In Use</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="retired">Retired</option>
                  </select>
                </div>
              </div>

              {/* Make / Model / Year */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                  <input
                    type="text"
                    value={formData.make}
                    onChange={(e) => setFormData((f) => ({ ...f, make: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="e.g. DeWalt"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData((f) => ({ ...f, model: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="e.g. DCN021D1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData((f) => ({ ...f, year: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="2023"
                    min="1900"
                    max="2100"
                  />
                </div>
              </div>

              {/* Serial Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                <input
                  type="text"
                  value={formData.serial_number}
                  onChange={(e) => setFormData((f) => ({ ...f, serial_number: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="Serial / Asset number"
                />
              </div>

              {/* Vehicle-only fields */}
              {formData.category === 'vehicle' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">License Plate</label>
                    <input
                      type="text"
                      value={formData.license_plate}
                      onChange={(e) => setFormData((f) => ({ ...f, license_plate: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      placeholder="ABC-1234"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">VIN</label>
                    <input
                      type="text"
                      value={formData.vin}
                      onChange={(e) => setFormData((f) => ({ ...f, vin: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      placeholder="17-character VIN"
                    />
                  </div>
                </div>
              )}

              {/* Purchase info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData((f) => ({ ...f, purchase_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price ($)</label>
                  <input
                    type="number"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData((f) => ({ ...f, purchase_price: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Maintenance dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Maintenance</label>
                  <input
                    type="date"
                    value={formData.last_maintenance}
                    onChange={(e) => setFormData((f) => ({ ...f, last_maintenance: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Next Maintenance</label>
                  <input
                    type="date"
                    value={formData.next_maintenance}
                    onChange={(e) => setFormData((f) => ({ ...f, next_maintenance: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Assigned to */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData((f) => ({ ...f, assigned_to: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                >
                  <option value="">— Unassigned —</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name || m.email || m.id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                  placeholder="Any additional notes..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {editingEquipment ? 'Save Changes' : 'Add Equipment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign to Job Modal */}
      {showAssignModal && assigningEquipment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Assign to Job</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Assigning <strong>{assigningEquipment.name}</strong> to a contact/job will set its
                status to <em>In Use</em>.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Contact / Job</label>
                <select
                  value={assignContactId}
                  onChange={(e) => setAssignContactId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                >
                  <option value="">— Select contact —</option>
                  {state.contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                      {c.address ? ` — ${c.address}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAssignToJob()}
                disabled={!assignContactId}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <CheckCircle size={16} />
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

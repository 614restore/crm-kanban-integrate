import React, { useState, useEffect } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { toast } from 'sonner';
import { Supplier } from '@/lib/crmData';
import { exportSuppliersToExcel } from '@/lib/exportUtils';
import {
  Store,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Save,
  Phone,
  Mail,
  MapPin,
  Globe,
  CreditCard,
  FileText,
  Building2,
  Download,
  Zap,
  CheckCircle2,
} from 'lucide-react';

// Popular roofing material suppliers
const POPULAR_SUPPLIERS = [
  {
    name: 'Roof Hub',
    website: 'https://www.roofhub.com',
    phone: '(877) 766-3482',
    email: 'orders@roofhub.com',
    paymentTerms: 'Net 30',
    notes: 'Online roofing materials distributor with nationwide delivery',
  },
  {
    name: 'Roof Link',
    website: 'https://www.rooflink.com',
    phone: '(800) 493-8665',
    email: 'support@rooflink.com',
    paymentTerms: 'Net 30',
    notes: 'Roofing materials supplier and distributor',
  },
  {
    name: 'ABC Supply',
    website: 'https://www.abcsupply.com',
    phone: '(888) 222-7831',
    email: 'customerservice@abcsupply.com',
    paymentTerms: 'Net 30',
    notes: 'One of the largest wholesale distributors of roofing materials',
  },
  {
    name: 'GAF Materials',
    website: 'https://www.gaf.com',
    phone: '(800) 223-1948',
    email: 'info@gaf.com',
    paymentTerms: 'Net 30',
    notes: 'Leading roofing manufacturer - shingles, TPO, and more',
  },
  {
    name: 'Owens Corning',
    website: 'https://www.owenscorning.com',
    phone: '(800) 438-7465',
    email: 'roofing@owenscorning.com',
    paymentTerms: 'Net 30',
    notes: 'Premium roofing shingles and materials manufacturer',
  },
  {
    name: 'Beacon Building Products',
    website: 'https://www.becn.com',
    phone: '(571) 323-3939',
    email: 'customercare@becn.com',
    paymentTerms: 'Net 30',
    notes: 'Exterior building products distributor',
  },
  {
    name: 'SRS Distribution',
    website: 'https://www.srs-residential.com',
    phone: '(888) 400-7663',
    email: 'info@srs-residential.com',
    paymentTerms: 'Net 30',
    notes: 'Residential roofing supply distributor',
  },
  {
    name: 'CertainTeed',
    website: 'https://www.certainteed.com',
    phone: '(800) 233-8990',
    email: 'certainteed@saint-gobain.com',
    paymentTerms: 'Net 30',
    notes: 'Building materials manufacturer - roofing, siding, insulation',
  },
];

export default function SuppliersView() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingBulk, setIsAddingBulk] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    website: '',
    accountNumber: '',
    paymentTerms: '',
    notes: '',
  });

  const effectiveCompanyId = profile?.company_id || state.companyId || null;

  // Load suppliers on mount
  useEffect(() => {
    const loadSuppliers = async () => {
      if (!effectiveCompanyId) return;
      const suppliers = await db.getSuppliers(effectiveCompanyId);
      // Convert to app format
      const appSuppliers: Supplier[] = suppliers.map(s => ({
        id: s.id,
        name: s.name,
        contactName: s.contact_name,
        email: s.email,
        phone: s.phone,
        address: s.address,
        city: s.city,
        state: s.state,
        zip: s.zip,
        website: s.website,
        accountNumber: s.account_number,
        paymentTerms: s.payment_terms,
        notes: s.notes,
        isActive: s.is_active,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      }));
      dispatch({ type: 'SET_SUPPLIERS', payload: appSuppliers });
    };
    void loadSuppliers();
  }, [effectiveCompanyId, dispatch]);

  const filteredSuppliers = state.suppliers.filter(
    (supplier) =>
      searchQuery === '' ||
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (supplier.contactName && supplier.contactName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const resetForm = () => {
    setFormData({
      name: '',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      website: '',
      accountNumber: '',
      paymentTerms: '',
      notes: '',
    });
    setEditingSupplier(null);
  };

  const handleAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setFormData({
      name: supplier.name,
      contactName: supplier.contactName || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      city: supplier.city || '',
      state: supplier.state || '',
      zip: supplier.zip || '',
      website: supplier.website || '',
      accountNumber: supplier.accountNumber || '',
      paymentTerms: supplier.paymentTerms || '',
      notes: supplier.notes || '',
    });
    setEditingSupplier(supplier);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Supplier name is required');
      return;
    }

    if (!effectiveCompanyId) {
      toast.error('No company context');
      return;
    }

    setIsSaving(true);

    try {
      if (editingSupplier) {
        // Update existing supplier
        const updated = await db.updateSupplier(editingSupplier.id, {
          name: formData.name,
          contact_name: formData.contactName || null,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          zip: formData.zip || null,
          website: formData.website || null,
          account_number: formData.accountNumber || null,
          payment_terms: formData.paymentTerms || null,
          notes: formData.notes || null,
        });

        if (!updated) {
          toast.error('Failed to update supplier');
          return;
        }

        const appSupplier: Supplier = {
          id: updated.id,
          name: updated.name,
          contactName: updated.contact_name,
          email: updated.email,
          phone: updated.phone,
          address: updated.address,
          city: updated.city,
          state: updated.state,
          zip: updated.zip,
          website: updated.website,
          accountNumber: updated.account_number,
          paymentTerms: updated.payment_terms,
          notes: updated.notes,
          isActive: updated.is_active,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
        };

        dispatch({ type: 'UPDATE_SUPPLIER', payload: appSupplier });
        toast.success('Supplier updated');
      } else {
        // Create new supplier
        const created = await db.createSupplier({
          company_id: effectiveCompanyId,
          name: formData.name,
          contact_name: formData.contactName || null,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          zip: formData.zip || null,
          website: formData.website || null,
          account_number: formData.accountNumber || null,
          payment_terms: formData.paymentTerms || null,
          notes: formData.notes || null,
          is_active: true,
        });

        if (!created) {
          toast.error('Failed to create supplier');
          return;
        }

        const appSupplier: Supplier = {
          id: created.id,
          name: created.name,
          contactName: created.contact_name,
          email: created.email,
          phone: created.phone,
          address: created.address,
          city: created.city,
          state: created.state,
          zip: created.zip,
          website: created.website,
          accountNumber: created.account_number,
          paymentTerms: created.payment_terms,
          notes: created.notes,
          isActive: created.is_active,
          createdAt: created.created_at,
          updatedAt: created.updated_at,
        };

        dispatch({ type: 'ADD_SUPPLIER', payload: appSupplier });
        toast.success('Supplier created');
      }

      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast.error('Failed to save supplier');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`Delete supplier "${supplier.name}"?`)) return;

    try {
      const success = await db.deleteSupplier(supplier.id);
      if (!success) {
        toast.error('Failed to delete supplier');
        return;
      }

      dispatch({ type: 'DELETE_SUPPLIER', payload: supplier.id });
      toast.success('Supplier deleted');
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast.error('Failed to delete supplier');
    }
  };

  const handleExport = () => {
    try {
      if (filteredSuppliers.length === 0) {
        toast.error('No suppliers to export');
        return;
      }
      exportSuppliersToExcel(filteredSuppliers);
      toast.success(`Exported ${filteredSuppliers.length} suppliers to Excel`);
    } catch (error) {
      console.error('Error exporting suppliers:', error);
      toast.error('Failed to export suppliers');
    }
  };

  const handleToggleSupplierSelection = (supplierName: string) => {
    setSelectedSuppliers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(supplierName)) {
        newSet.delete(supplierName);
      } else {
        newSet.add(supplierName);
      }
      return newSet;
    });
  };

  const handleAddPopularSuppliers = async () => {
    if (selectedSuppliers.size === 0) {
      toast.error('Please select at least one supplier');
      return;
    }

    if (!effectiveCompanyId) {
      toast.error('No company context');
      return;
    }

    setIsAddingBulk(true);

    try {
      const suppliersToAdd = POPULAR_SUPPLIERS.filter(s => selectedSuppliers.has(s.name));
      const existingNames = new Set(state.suppliers.map(s => s.name.toLowerCase()));
      
      let addedCount = 0;
      let skippedCount = 0;

      for (const supplierTemplate of suppliersToAdd) {
        // Skip if supplier already exists
        if (existingNames.has(supplierTemplate.name.toLowerCase())) {
          skippedCount++;
          continue;
        }

        const created = await db.createSupplier({
          company_id: effectiveCompanyId,
          name: supplierTemplate.name,
          contact_name: null,
          email: supplierTemplate.email || null,
          phone: supplierTemplate.phone || null,
          address: null,
          city: null,
          state: null,
          zip: null,
          website: supplierTemplate.website || null,
          account_number: null,
          payment_terms: supplierTemplate.paymentTerms || null,
          notes: supplierTemplate.notes || null,
          is_active: true,
        });

        if (created) {
          const appSupplier: Supplier = {
            id: created.id,
            name: created.name,
            contactName: created.contact_name,
            email: created.email,
            phone: created.phone,
            address: created.address,
            city: created.city,
            state: created.state,
            zip: created.zip,
            website: created.website,
            accountNumber: created.account_number,
            paymentTerms: created.payment_terms,
            notes: created.notes,
            isActive: created.is_active,
            createdAt: created.created_at,
            updatedAt: created.updated_at,
          };

          dispatch({ type: 'ADD_SUPPLIER', payload: appSupplier });
          addedCount++;
        }
      }

      if (addedCount > 0) {
        toast.success(`Added ${addedCount} supplier${addedCount > 1 ? 's' : ''}`);
      }
      if (skippedCount > 0) {
        toast.info(`Skipped ${skippedCount} existing supplier${skippedCount > 1 ? 's' : ''}`);
      }

      setShowQuickAddModal(false);
      setSelectedSuppliers(new Set());
    } catch (error) {
      console.error('Error adding popular suppliers:', error);
      toast.error('Failed to add suppliers');
    } finally {
      setIsAddingBulk(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Suppliers</h2>
          <p className="text-gray-500 mt-1">Manage your material suppliers and vendors</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Download size={18} />
            Export
          </button>
          <button
            onClick={() => setShowQuickAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-md"
          >
            <Zap size={18} />
            Add Popular Suppliers
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Add Supplier
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search suppliers..."
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
        />
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSuppliers.map((supplier) => (
          <div key={supplier.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Building2 size={24} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{supplier.name}</h3>
                  {supplier.contactName && (
                    <p className="text-sm text-gray-500">{supplier.contactName}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEdit(supplier)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Edit2 size={16} className="text-gray-500" />
                </button>
                <button
                  onClick={() => handleDelete(supplier)}
                  className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <Trash2 size={16} className="text-red-500" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {supplier.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone size={14} />
                  {supplier.phone}
                </div>
              )}
              {supplier.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail size={14} />
                  {supplier.email}
                </div>
              )}
              {supplier.address && (
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <MapPin size={14} className="mt-0.5" />
                  <span>
                    {supplier.address}
                    {supplier.city && `, ${supplier.city}`}
                    {supplier.state && `, ${supplier.state}`}
                    {supplier.zip && ` ${supplier.zip}`}
                  </span>
                </div>
              )}
              {supplier.website && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Globe size={14} />
                  <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {supplier.website}
                  </a>
                </div>
              )}
              {supplier.accountNumber && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CreditCard size={14} />
                  Account: {supplier.accountNumber}
                </div>
              )}
              {supplier.paymentTerms && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FileText size={14} />
                  {supplier.paymentTerms}
                </div>
              )}
            </div>

            {supplier.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-600">{supplier.notes}</p>
              </div>
            )}
          </div>
        ))}

        {filteredSuppliers.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Store size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">
              {searchQuery ? 'No suppliers found' : 'No suppliers added yet'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleAdd}
                className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Add your first supplier
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="ABC Building Supply"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="orders@supplier.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="123 Main Street"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="Dallas"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="TX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ZIP
                  </label>
                  <input
                    type="text"
                    value={formData.zip}
                    onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="75201"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="https://supplier.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="ACC-12345"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="Net 30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                  placeholder="Additional notes about this supplier..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save size={18} />
                {isSaving ? 'Saving...' : editingSupplier ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Popular Suppliers Modal */}
      {showQuickAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Add Popular Roofing Suppliers</h3>
                <p className="text-sm text-gray-500 mt-1">Select suppliers to add to your account</p>
              </div>
              <button
                onClick={() => {
                  setShowQuickAddModal(false);
                  setSelectedSuppliers(new Set());
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {POPULAR_SUPPLIERS.map((supplier) => {
                  const isSelected = selectedSuppliers.has(supplier.name);
                  const existingSupplier = state.suppliers.find(
                    s => s.name.toLowerCase() === supplier.name.toLowerCase()
                  );

                  return (
                    <div
                      key={supplier.name}
                      onClick={() => !existingSupplier && handleToggleSupplierSelection(supplier.name)}
                      className={`relative border-2 rounded-xl p-4 transition-all cursor-pointer ${
                        existingSupplier
                          ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                          : isSelected
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                      }`}
                    >
                      {/* Selection Indicator */}
                      <div className="absolute top-3 right-3">
                        {existingSupplier ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            <CheckCircle2 size={12} />
                            Added
                          </span>
                        ) : (
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected
                                ? 'bg-blue-600 border-blue-600'
                                : 'border-gray-300 bg-white'
                            }`}
                          >
                            {isSelected && <CheckCircle2 size={14} className="text-white" />}
                          </div>
                        )}
                      </div>

                      {/* Supplier Info */}
                      <div className="pr-10">
                        <h4 className="font-semibold text-gray-900 mb-2">{supplier.name}</h4>
                        
                        <div className="space-y-1.5">
                          {supplier.phone && (
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <Phone size={12} />
                              {supplier.phone}
                            </div>
                          )}
                          {supplier.email && (
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <Mail size={12} />
                              {supplier.email}
                            </div>
                          )}
                          {supplier.website && (
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <Globe size={12} />
                              <span className="truncate">{supplier.website}</span>
                            </div>
                          )}
                          {supplier.paymentTerms && (
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <CreditCard size={12} />
                              {supplier.paymentTerms}
                            </div>
                          )}
                        </div>

                        {supplier.notes && (
                          <p className="text-xs text-gray-500 mt-2 line-clamp-2">{supplier.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selection Info */}
              {selectedSuppliers.size > 0 && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>{selectedSuppliers.size}</strong> supplier{selectedSuppliers.size > 1 ? 's' : ''} selected
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={() => {
                  const availableSuppliers = POPULAR_SUPPLIERS.filter(
                    s => !state.suppliers.find(existing => 
                      existing.name.toLowerCase() === s.name.toLowerCase()
                    )
                  );
                  if (selectedSuppliers.size === availableSuppliers.length) {
                    setSelectedSuppliers(new Set());
                  } else {
                    setSelectedSuppliers(new Set(availableSuppliers.map(s => s.name)));
                  }
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {selectedSuppliers.size === POPULAR_SUPPLIERS.filter(
                  s => !state.suppliers.find(existing => 
                    existing.name.toLowerCase() === s.name.toLowerCase()
                  )
                ).length ? 'Deselect All' : 'Select All Available'}
              </button>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowQuickAddModal(false);
                    setSelectedSuppliers(new Set());
                  }}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={isAddingBulk}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPopularSuppliers}
                  disabled={isAddingBulk || selectedSuppliers.size === 0}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  <Zap size={18} />
                  {isAddingBulk ? 'Adding...' : `Add ${selectedSuppliers.size} Supplier${selectedSuppliers.size > 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { useFormDraft } from '@/lib/useFormDraft';
import { db } from '@/lib/database';
import { MaterialOrder, MaterialOrderItem } from '@/lib/crmData';
import { exportMaterialOrdersToExcel } from '@/lib/exportUtils';
import { uploadDocument, getDocumentSignedUrl } from '@/lib/storage';
import { logActivity } from '@/lib/activityLogger';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Save,
  Calendar,
  DollarSign,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  Building2,
  FileText,
  Download,
  ChevronDown,
  Upload,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Roofing Material Templates ──────────────────────────────────────────────
interface MaterialTemplate {
  name: string;
  items: Omit<MaterialOrderItem, 'id'>[];
}

const ROOFING_TEMPLATES: MaterialTemplate[] = [
  {
    name: 'Roof Replacement – Asphalt Shingle',
    items: [
      { description: 'Asphalt Shingles (30-yr architectural)', quantity: 30, unit: 'square', unitPrice: 120, total: 3600 },
      { description: 'Synthetic Underlayment (15 sq rolls)', quantity: 3, unit: 'roll', unitPrice: 85, total: 255 },
      { description: 'Ice & Water Shield', quantity: 2, unit: 'square', unitPrice: 95, total: 190 },
      { description: 'Ridge Cap Shingles', quantity: 2, unit: 'bundle', unitPrice: 55, total: 110 },
      { description: 'Starter Strip', quantity: 3, unit: 'bundle', unitPrice: 40, total: 120 },
      { description: 'Roofing Nails (1-3/4")', quantity: 5, unit: 'box', unitPrice: 18, total: 90 },
      { description: 'Drip Edge (10 ft)', quantity: 20, unit: 'piece', unitPrice: 6, total: 120 },
      { description: 'Pipe Boot Flashing (3")', quantity: 2, unit: 'each', unitPrice: 22, total: 44 },
      { description: 'Ventilation – Ridge Vent (10 ft)', quantity: 4, unit: 'piece', unitPrice: 28, total: 112 },
    ],
  },
  {
    name: 'Roof Replacement – Standing Seam Metal',
    items: [
      { description: 'Standing Seam Panels (24 ga, 16" wide)', quantity: 35, unit: 'square', unitPrice: 350, total: 12250 },
      { description: 'Metal Roofing Underlayment', quantity: 4, unit: 'roll', unitPrice: 110, total: 440 },
      { description: 'Ridge Cap (metal)', quantity: 5, unit: 'piece', unitPrice: 65, total: 325 },
      { description: 'Eave Trim', quantity: 10, unit: 'piece', unitPrice: 40, total: 400 },
      { description: 'Gable Trim', quantity: 8, unit: 'piece', unitPrice: 40, total: 320 },
      { description: 'Concealed Fastener Clips', quantity: 500, unit: 'each', unitPrice: 0.75, total: 375 },
      { description: 'Screws / Fasteners (box)', quantity: 3, unit: 'box', unitPrice: 28, total: 84 },
      { description: 'Sealant / Butyl Tape', quantity: 4, unit: 'roll', unitPrice: 22, total: 88 },
    ],
  },
  {
    name: 'Roof Replacement – Corrugated Metal',
    items: [
      { description: 'Corrugated Metal Panels (26 ga)', quantity: 35, unit: 'square', unitPrice: 180, total: 6300 },
      { description: 'Metal Roofing Underlayment', quantity: 4, unit: 'roll', unitPrice: 110, total: 440 },
      { description: 'Ridge Cap', quantity: 5, unit: 'piece', unitPrice: 45, total: 225 },
      { description: 'Eave Trim', quantity: 10, unit: 'piece', unitPrice: 30, total: 300 },
      { description: 'Exposed Screws w/ Neoprene Washer (250 ct)', quantity: 4, unit: 'box', unitPrice: 35, total: 140 },
      { description: 'Foam Closure Strips', quantity: 20, unit: 'each', unitPrice: 4, total: 80 },
      { description: 'Sealant', quantity: 2, unit: 'tube', unitPrice: 18, total: 36 },
    ],
  },
  {
    name: 'Roof Replacement – TPO Flat Roof',
    items: [
      { description: 'TPO Membrane (60 mil, 10 ft wide)', quantity: 4, unit: 'roll', unitPrice: 280, total: 1120 },
      { description: 'ISO Insulation Board (2")', quantity: 35, unit: 'square', unitPrice: 65, total: 2275 },
      { description: 'Cover Board (1/2" DensDeck)', quantity: 35, unit: 'square', unitPrice: 45, total: 1575 },
      { description: 'TPO Membrane Adhesive', quantity: 6, unit: 'gallon', unitPrice: 55, total: 330 },
      { description: 'TPO Edge Metal / Coping', quantity: 20, unit: 'piece', unitPrice: 30, total: 600 },
      { description: 'Drain Clamp / Drain Cover', quantity: 3, unit: 'each', unitPrice: 35, total: 105 },
      { description: 'Fasteners / Screws (box)', quantity: 2, unit: 'box', unitPrice: 28, total: 56 },
    ],
  },
  {
    name: 'Roof Replacement – Modified Bitumen',
    items: [
      { description: 'Mod-Bit Base Sheet (2 sq/roll)', quantity: 18, unit: 'roll', unitPrice: 65, total: 1170 },
      { description: 'Mod-Bit Cap Sheet (granulated)', quantity: 18, unit: 'roll', unitPrice: 90, total: 1620 },
      { description: 'Primer (gallon)', quantity: 4, unit: 'gallon', unitPrice: 50, total: 200 },
      { description: 'Roofing Nails', quantity: 2, unit: 'box', unitPrice: 18, total: 36 },
      { description: 'Drip Edge', quantity: 20, unit: 'piece', unitPrice: 6, total: 120 },
    ],
  },
];

// Status badge component
function StatusBadge({ status }: { status: MaterialOrder['status'] }) {
  const config = {
    pending: { label: 'Pending', className: 'bg-gray-100 text-gray-700', icon: Clock },
    ordered: { label: 'Ordered', className: 'bg-blue-100 text-blue-700', icon: FileText },
    delivered: { label: 'Delivered', className: 'bg-green-100 text-green-700', icon: CheckCircle },
    cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700', icon: XCircle },
  }[status];

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
      <Icon size={12} />
      {config.label}
    </span>
  );
}

export default function MaterialOrdersView() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<MaterialOrder['status'] | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<MaterialOrder | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [orderNumber, setOrderNumber] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [status, setStatus] = useState<MaterialOrder['status']>('pending');
  const [orderDate, setOrderDate] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [actualDeliveryDate, setActualDeliveryDate] = useState('');
  const [subtotal, setSubtotal] = useState('0');
  const [tax, setTax] = useState('0');
  const [shipping, setShipping] = useState('0');
  const [total, setTotal] = useState('0');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MaterialOrder['items']>([]);

  // Auto-save draft to localStorage (new records only)
  const matDraftKey = `material_order_draft_${profile?.company_id || 'unknown'}`;
  const matDraftData = useMemo(() => ({
    orderNumber, selectedSupplierId, selectedContactId, selectedJobId,
    selectedProjectId, status, orderDate, expectedDeliveryDate,
    tax, shipping, notes, items,
  }), [orderNumber, selectedSupplierId, selectedContactId, selectedJobId,
    selectedProjectId, status, orderDate, expectedDeliveryDate,
    tax, shipping, notes, items]);
  const { loadDraft: loadMatDraft, clearDraft: clearMatDraft } = useFormDraft(
    matDraftKey, matDraftData, { enabled: showModal && !editingOrder }
  );

  // Load material orders on mount
  useEffect(() => {
    loadMaterialOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMaterialOrders = async () => {
    if (!profile?.company_id) return;
    try {
      const materialOrders = await db.getMaterialOrders(profile.company_id);
      // Convert DB format to app format
      const appOrders: MaterialOrder[] = materialOrders.map(mo => ({
        id: mo.id,
        orderNumber: mo.order_number || '',
        supplierId: mo.supplier_id,
        supplierName: state.suppliers.find(s => s.id === mo.supplier_id)?.name || '',
        contactId: mo.contact_id,
        jobId: mo.job_id,
        status: mo.status as MaterialOrder['status'],
        orderDate: mo.order_date,
        expectedDeliveryDate: mo.expected_delivery_date,
        actualDeliveryDate: mo.actual_delivery_date,
        subtotal: Number(mo.subtotal || 0),
        tax: Number(mo.tax || 0),
        shipping: Number(mo.shipping || 0),
        total: Number(mo.total || 0),
        items: [], // Items loaded separately if needed
        notes: mo.notes,
        attachments: mo.attachments || [],
        createdBy: mo.created_by,
        createdAt: mo.created_at,
        updatedAt: mo.updated_at,
      }));
      dispatch({ type: 'SET_MATERIAL_ORDERS', payload: appOrders });
    } catch (error) {
      console.error('Error loading material orders:', error);
      toast.error('Failed to load material orders');
    }
  };

  const handleOpenModal = (order?: MaterialOrder) => {
    if (order) {
      setEditingOrder(order);
      setOrderNumber(order.orderNumber || '');
      setSelectedSupplierId(order.supplierId);
      setSelectedContactId(order.contactId || '');
      setSelectedJobId(order.jobId || '');
      setSelectedProjectId((order as any).projectId || order.jobId || '');
      setStatus(order.status);
      setOrderDate(order.orderDate || '');
      setExpectedDeliveryDate(order.expectedDeliveryDate || '');
      setActualDeliveryDate(order.actualDeliveryDate || '');
      setSubtotal(order.subtotal.toString());
      setTax(order.tax.toString());
      setShipping(order.shipping.toString());
      setTotal(order.total.toString());
      setNotes(order.notes || '');
      setAttachments(order.attachments || []);
      setItems(order.items || []);
    } else {
      const draft = loadMatDraft();
      if (draft) {
        setOrderNumber(draft.orderNumber || `MO-${Date.now().toString().slice(-6)}`);
        setSelectedSupplierId(draft.selectedSupplierId || '');
        setSelectedContactId(draft.selectedContactId || '');
        setSelectedJobId(draft.selectedJobId || '');
        setSelectedProjectId(draft.selectedProjectId || '');
        setStatus(draft.status || 'pending');
        setOrderDate(draft.orderDate || new Date().toISOString().split('T')[0]);
        setExpectedDeliveryDate(draft.expectedDeliveryDate || '');
        setTax(draft.tax || '0');
        setShipping(draft.shipping || '0');
        setNotes(draft.notes || '');
        const restoredItems = draft.items || [];
        setItems(restoredItems);
        if (restoredItems.length > 0) {
          const sub = restoredItems.reduce((s: number, i: any) => s + (i.total || 0), 0);
          setSubtotal(sub.toFixed(2));
          setTotal((sub + parseFloat(draft.tax || '0') + parseFloat(draft.shipping || '0')).toFixed(2));
        }
        toast.info('Draft restored — your previous material order was recovered.');
      } else {
        setOrderNumber(`MO-${Date.now().toString().slice(-6)}`);
        setOrderDate(new Date().toISOString().split('T')[0]);
      }
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    clearMatDraft();
    setShowModal(false);
    setEditingOrder(null);
    setOrderNumber('');
    setSelectedSupplierId('');
    setSelectedContactId('');
    setSelectedJobId('');
    setSelectedProjectId('');
    setStatus('pending');
    setOrderDate('');
    setExpectedDeliveryDate('');
    setActualDeliveryDate('');
    setSubtotal('0');
    setTax('0');
    setShipping('0');
    setTotal('0');
    setNotes('');
    setAttachments([]);
    setItems([]);
  };

  const recalcTotals = (newItems: MaterialOrderItem[]) => {
    const newSubtotal = newItems.reduce((sum, i) => sum + i.total, 0);
    setSubtotal(newSubtotal.toFixed(2));
    const newTotal = newSubtotal + parseFloat(tax || '0') + parseFloat(shipping || '0');
    setTotal(newTotal.toFixed(2));
  };

  const handleAddItem = () => {
    const newItem: MaterialOrderItem = {
      id: `item-${Date.now()}`,
      description: '',
      quantity: 1,
      unit: 'each',
      unitPrice: 0,
      total: 0,
    };
    const updated = [...items, newItem];
    setItems(updated);
    recalcTotals(updated);
  };

  const handleUpdateItem = (idx: number, field: keyof MaterialOrderItem, value: string | number) => {
    const updated = items.map((item, i) => {
      if (i !== idx) return item;
      const next = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        next.total = Number(next.quantity) * Number(next.unitPrice);
      }
      return next;
    });
    setItems(updated);
    recalcTotals(updated);
  };

  const handleRemoveItem = (idx: number) => {
    const updated = items.filter((_, i) => i !== idx);
    setItems(updated);
    recalcTotals(updated);
  };

  const handleLoadTemplate = (templateName: string) => {
    if (!templateName) return;
    const tpl = ROOFING_TEMPLATES.find(t => t.name === templateName);
    if (!tpl) return;
    const newItems: MaterialOrderItem[] = tpl.items.map((item, i) => ({
      ...item,
      id: `item-${Date.now()}-${i}`,
    }));
    setItems(newItems);
    recalcTotals(newItems);
    toast.success(`Loaded template: ${tpl.name}`);
  };

  const handleSave = async () => {
    if (!profile?.company_id || !profile?.id) return;
    
    if (!selectedSupplierId) {
      toast.error('Please select a supplier');
      return;
    }

    setIsSaving(true);

    try {
      const orderData = {
        company_id: profile.company_id,
        order_number: orderNumber,
        supplier_id: selectedSupplierId,
        contact_id: selectedContactId || undefined,
        job_id: selectedJobId || selectedProjectId || undefined,
        status,
        order_date: orderDate || new Date().toISOString().split('T')[0],
        expected_delivery_date: expectedDeliveryDate || undefined,
        actual_delivery_date: actualDeliveryDate || undefined,
        subtotal: parseFloat(subtotal) || 0,
        tax: parseFloat(tax) || 0,
        shipping: parseFloat(shipping) || 0,
        total: parseFloat(total) || 0,
        description: notes.trim() || '',
        notes: notes.trim() || undefined,
        created_by: profile.id,
      };

      if (editingOrder) {
        const updated = await db.updateMaterialOrder(editingOrder.id, orderData);
        if (updated) {
          const appOrder: MaterialOrder = {
            id: updated.id,
            orderNumber: updated.order_number || '',
            supplierId: updated.supplier_id,
            supplierName: state.suppliers.find(s => s.id === updated.supplier_id)?.name || '',
            contactId: updated.contact_id,
            jobId: updated.job_id,
            status: updated.status as MaterialOrder['status'],
            orderDate: updated.order_date,
            expectedDeliveryDate: updated.expected_delivery_date,
            actualDeliveryDate: updated.actual_delivery_date,
            subtotal: Number(updated.subtotal || 0),
            tax: Number(updated.tax || 0),
            shipping: Number(updated.shipping || 0),
            total: Number(updated.total || 0),
            items: items || [],
            notes: updated.notes,
            attachments: updated.attachments || [],
            createdBy: updated.created_by,
            createdAt: updated.created_at,
            updatedAt: updated.updated_at,
          };
          dispatch({ type: 'UPDATE_MATERIAL_ORDER', payload: appOrder });
          toast.success('Material order updated');
          // Audit trail — log to contact's timeline if linked to a contact
          if (updated.contact_id) {
            await logActivity({
              contactId: updated.contact_id,
              companyId: profile.company_id,
              userId: profile.id,
              content: `📦 Material order updated: Order #${updated.order_number || updated.id.slice(0, 6)} — Status: ${updated.status} — Total: $${Number(updated.total || 0).toFixed(2)}. Updated by: ${profile.full_name || profile.email || 'team member'}`,
            }).catch(() => {});
          }
          handleCloseModal();
        } else {
          toast.error('Failed to update order. Please try again.');
        }
      } else {
        const created = await db.createMaterialOrder(orderData);
        if (created) {
          const appOrder: MaterialOrder = {
            id: created.id,
            orderNumber: created.order_number || '',
            supplierId: created.supplier_id,
            supplierName: state.suppliers.find(s => s.id === created.supplier_id)?.name || '',
            contactId: created.contact_id,
            jobId: created.job_id,
            status: created.status as MaterialOrder['status'],
            orderDate: created.order_date,
            expectedDeliveryDate: created.expected_delivery_date,
            actualDeliveryDate: created.actual_delivery_date,
            subtotal: Number(created.subtotal || 0),
            tax: Number(created.tax || 0),
            shipping: Number(created.shipping || 0),
            total: Number(created.total || 0),
            items: items || [],
            notes: created.notes,
            attachments: created.attachments || [],
            createdBy: created.created_by,
            createdAt: created.created_at,
            updatedAt: created.updated_at,
          };
          dispatch({ type: 'ADD_MATERIAL_ORDER', payload: appOrder });
          toast.success('Material order created');
          // Audit trail — log to contact's timeline if linked to a contact
          if (created.contact_id) {
            await logActivity({
              contactId: created.contact_id,
              companyId: profile.company_id,
              userId: profile.id,
              content: `📦 Material order created: Order #${created.order_number || created.id.slice(0, 6)} — Supplier: ${state.suppliers.find(s => s.id === created.supplier_id)?.name || 'Unknown'} — Total: $${Number(created.total || 0).toFixed(2)}. Created by: ${profile.full_name || profile.email || 'team member'}`,
            }).catch(() => {});
          }
          handleCloseModal();
        }
      }
    } catch (error: any) {
      console.error('Error saving material order:', error);
      toast.error(error?.message || 'Failed to save material order');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (orderId: string) => {
    try {
      await db.deleteMaterialOrder(orderId);
      dispatch({ type: 'DELETE_MATERIAL_ORDER', payload: orderId });
      toast.success('Material order deleted');
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting material order:', error);
      toast.error('Failed to delete material order');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !profile?.company_id) return;
    setIsUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        const result = await uploadDocument(file, profile.company_id, selectedContactId || undefined);
        if (result.error) {
          toast.error(`Failed to upload ${file.name}: ${result.error}`);
        } else {
          newUrls.push(result.path || result.url);
          toast.success(`Uploaded ${file.name}`);
        }
      }
      setAttachments(prev => [...prev, ...newUrls]);
    } catch (err: any) {
      toast.error(`Upload error: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleViewAttachment = async (pathOrUrl: string) => {
    const url = await getDocumentSignedUrl(pathOrUrl);
    if (url) window.open(url, '_blank');
    else toast.error('Could not open file');
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleExport = () => {
    try {
      if (filteredOrders.length === 0) {
        toast.error('No material orders to export');
        return;
      }
      exportMaterialOrdersToExcel(filteredOrders);
      toast.success(`Exported ${filteredOrders.length} material orders to Excel`);
    } catch (error) {
      console.error('Error exporting material orders:', error);
      toast.error('Failed to export material orders');
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const updated = await db.updateMaterialOrder(orderId, {
        status: 'delivered',
        actual_delivery_date: today,
      });
      if (updated) {
        const appOrder: MaterialOrder = {
          id: updated.id,
          orderNumber: updated.order_number || '',
          supplierId: updated.supplier_id,
          supplierName: state.suppliers.find(s => s.id === updated.supplier_id)?.name || '',
          contactId: updated.contact_id,
          jobId: updated.job_id,
          status: updated.status as MaterialOrder['status'],
          orderDate: updated.order_date,
          expectedDeliveryDate: updated.expected_delivery_date,
          actualDeliveryDate: updated.actual_delivery_date,
          subtotal: Number(updated.subtotal || 0),
          tax: Number(updated.tax || 0),
          shipping: Number(updated.shipping || 0),
          total: Number(updated.total || 0),
          items: [],
          notes: updated.notes,
          createdBy: updated.created_by,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
        };
        dispatch({ type: 'UPDATE_MATERIAL_ORDER', payload: appOrder });
        toast.success('Material order marked as delivered');
      }
    } catch (error) {
      console.error('Error updating material order:', error);
      toast.error('Failed to update material order');
    }
  };

  // Helper functions
  const getSupplierName = (supplierId: string) => {
    const supplier = state.suppliers.find(s => s.id === supplierId);
    return supplier ? supplier.name : 'Unknown Supplier';
  };

  const getProjectName = (projectId?: string) => {
    if (!projectId) return undefined;
    const project = state.projects.find(p => p.id === projectId);
    return project ? project.name : undefined;
  };

  const getWorkOrderNumber = (workOrderId?: string) => {
    if (!workOrderId) return undefined;
    const workOrder = state.workOrders.find(wo => wo.id === workOrderId);
    return workOrder ? workOrder.workOrderNumber : undefined;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Filter material orders
  const filteredOrders = state.materialOrders.filter((order) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      (order.orderNumber && order.orderNumber.toLowerCase().includes(query)) ||
      order.supplierName.toLowerCase().includes(query) ||
      (order.notes && order.notes.toLowerCase().includes(query));
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: state.materialOrders.length,
    pending: state.materialOrders.filter(o => o.status === 'pending').length,
    ordered: state.materialOrders.filter(o => o.status === 'ordered').length,
    delivered: state.materialOrders.filter(o => o.status === 'delivered').length,
    totalSpent: state.materialOrders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + o.total, 0),
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
            <Package size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Material Orders</h1>
            <p className="text-sm text-gray-500">Track supplier orders and deliveries</p>
          </div>
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
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
          >
            <Plus size={20} />
            New Material Order
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Total Orders</span>
            <Package size={16} className="text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Pending</span>
            <Clock size={16} className="text-gray-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Ordered</span>
            <FileText size={16} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.ordered}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Delivered</span>
            <CheckCircle size={16} className="text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.delivered}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Total Spent</span>
            <DollarSign size={16} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalSpent)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by order number, supplier, project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="ordered">Ordered</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Package size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No material orders found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Get started by creating your first material order'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus size={20} />
              Create Material Order
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {order.supplierName}
                    </h3>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                    <span className="font-mono">{order.orderNumber}</span>
                    {order.items && order.items.length > 0 && (
                      <span className="text-purple-600 font-medium">{order.items.length} line item{order.items.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  {order.notes && (
                    <p className="text-sm text-gray-600">{order.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {order.status === 'ordered' && (
                    <button
                      onClick={() => handleMarkDelivered(order.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Mark as delivered"
                    >
                      <CheckCircle size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenModal(order)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(order.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Order Details Grid */}
              <div className="grid grid-cols-5 gap-4 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Order Date</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(order.orderDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Expected Delivery</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(order.expectedDeliveryDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Actual Delivery</p>
                  <p className="text-sm font-medium text-gray-900">
                    {order.actualDeliveryDate ? formatDate(order.actualDeliveryDate) : 'Pending'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Amount</p>
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(order.total)}</p>
                </div>
                {order.status === 'delivered' && order.actualDeliveryDate && order.expectedDeliveryDate && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Delivery Status</p>
                    <p className={`text-sm font-medium ${
                      new Date(order.actualDeliveryDate) <= new Date(order.expectedDeliveryDate)
                        ? 'text-green-600'
                        : 'text-orange-600'
                    }`}>
                      {new Date(order.actualDeliveryDate) <= new Date(order.expectedDeliveryDate)
                        ? 'On Time'
                        : 'Delayed'}
                    </p>
                  </div>
                )}
              </div>

              {/* Notes */}
              {order.notes && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{order.notes}</p>
                </div>
              )}

              {/* Delete Confirmation */}
              {showDeleteConfirm === order.id && (
                <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-800 mb-3">Are you sure you want to delete this material order?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(order.id)}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(null)}
                      className="px-3 py-1 bg-white text-gray-700 text-sm rounded border border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingOrder ? 'Edit Material Order' : 'New Material Order'}
                </h2>
                {!editingOrder && (
                  <div className="mt-2 flex items-center gap-2">
                    <ChevronDown size={14} className="text-gray-400" />
                    <select
                      onChange={(e) => handleLoadTemplate(e.target.value)}
                      defaultValue=""
                      className="text-sm border border-purple-300 rounded-lg px-3 py-1.5 text-purple-700 bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Load roofing template…</option>
                      {ROOFING_TEMPLATES.map(t => (
                        <option key={t.name} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order Number *
                  </label>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supplier *
                  </label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select a supplier</option>
                    {state.suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Link to Project (costs auto-roll up)
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => { setSelectedProjectId(e.target.value); setSelectedJobId(e.target.value); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">No project linked</option>
                    {state.projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.projectNumber} - {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as MaterialOrder['status'])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="ordered">Ordered</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Financial Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subtotal
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={subtotal}
                      onChange={(e) => {
                        setSubtotal(e.target.value);
                        const newTotal = parseFloat(e.target.value || '0') + parseFloat(tax || '0') + parseFloat(shipping || '0');
                        setTotal(newTotal.toFixed(2));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tax
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={tax}
                      onChange={(e) => {
                        setTax(e.target.value);
                        const newTotal = parseFloat(subtotal || '0') + parseFloat(e.target.value || '0') + parseFloat(shipping || '0');
                        setTotal(newTotal.toFixed(2));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Shipping
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={shipping}
                      onChange={(e) => {
                        setShipping(e.target.value);
                        const newTotal = parseFloat(subtotal || '0') + parseFloat(tax || '0') + parseFloat(e.target.value || '0');
                        setTotal(newTotal.toFixed(2));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={total}
                      onChange={(e) => setTotal(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50"
                      readOnly
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order Date
                  </label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={expectedDeliveryDate}
                    onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {(status === 'delivered' || actualDeliveryDate) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Actual Delivery Date
                    </label>
                    <input
                      type="date"
                      value={actualDeliveryDate}
                      onChange={(e) => setActualDeliveryDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Material Line Items
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 font-medium"
                  >
                    <Plus size={14} /> Add Item
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-600 w-1/2">Description</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600 w-16">Qty</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600 w-20">Unit</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600 w-24">Unit Price</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600 w-24">Total</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-gray-400">
                            No items yet. Load a template or add items manually.
                          </td>
                        </tr>
                      )}
                      {items.map((item, idx) => (
                        <tr key={item.id} className="border-t border-gray-100">
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleUpdateItem(idx, 'description', e.target.value)}
                              placeholder="Material description"
                              className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm text-right"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={item.unit}
                              onChange={(e) => handleUpdateItem(idx, 'unit', e.target.value)}
                              className="w-full px-1 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm"
                            >
                              {['each','square','bundle','roll','sheet','box','piece','gallon','tube','bag','pallet','linear ft','sq ft'].map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm text-right"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium text-gray-800">
                            ${item.total.toFixed(2)}
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-red-400 hover:text-red-600"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {items.length > 0 && (
                      <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                        <tr>
                          <td colSpan={4} className="px-3 py-2 text-right text-sm font-medium text-gray-600">Subtotal</td>
                          <td className="px-2 py-2 text-right font-semibold text-gray-900">${parseFloat(subtotal || '0').toFixed(2)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes / Special Instructions
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tracking numbers, delivery instructions, color choices, special notes..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attachments
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-purple-400 hover:text-purple-600 transition-colors disabled:opacity-50"
                >
                  <Upload size={16} />
                  {isUploading ? 'Uploading...' : 'Upload Files'}
                </button>
                {attachments.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {attachments.map((att, idx) => {
                      const name = att.split('/').pop() || att;
                      return (
                        <li key={idx} className="flex items-center gap-2 text-sm bg-gray-50 rounded px-2 py-1">
                          <FileText size={14} className="text-gray-400 shrink-0" />
                          <span className="flex-1 truncate text-gray-700">{decodeURIComponent(name)}</span>
                          <button type="button" onClick={() => handleViewAttachment(att)} className="text-blue-500 hover:text-blue-700">
                            <Eye size={14} />
                          </button>
                          <button type="button" onClick={() => handleRemoveAttachment(idx)} className="text-red-400 hover:text-red-600">
                            <X size={14} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                {isSaving ? 'Saving...' : 'Save Material Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

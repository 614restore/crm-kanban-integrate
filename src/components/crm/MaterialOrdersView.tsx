import React, { useState, useEffect } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { MaterialOrder } from '@/lib/crmData';
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
} from 'lucide-react';
import { toast } from 'sonner';

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
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<MaterialOrder['status']>('pending');
  const [orderDate, setOrderDate] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [actualDeliveryDate, setActualDeliveryDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('0');
  const [notes, setNotes] = useState('');

  // Load material orders on mount
  useEffect(() => {
    loadMaterialOrders();
  }, []);

  const loadMaterialOrders = async () => {
    if (!profile?.company_id) return;
    try {
      const materialOrders = await db.getMaterialOrders(profile.company_id);
      // Convert DB format to app format
      const appOrders: MaterialOrder[] = materialOrders.map(mo => ({
        id: mo.id,
        orderNumber: mo.order_number,
        supplierId: mo.supplier_id,
        supplierName: getSupplierName(mo.supplier_id),
        projectId: mo.project_id,
        projectName: getProjectName(mo.project_id),
        workOrderId: mo.work_order_id,
        workOrderNumber: getWorkOrderNumber(mo.work_order_id),
        description: mo.description,
        status: mo.status as MaterialOrder['status'],
        orderDate: mo.order_date,
        expectedDeliveryDate: mo.expected_delivery_date,
        actualDeliveryDate: mo.actual_delivery_date,
        totalAmount: Number(mo.total_amount),
        notes: mo.notes,
        receiptUrl: mo.receipt_url,
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
      setOrderNumber(order.orderNumber);
      setSelectedSupplierId(order.supplierId);
      setSelectedProjectId(order.projectId || '');
      setSelectedWorkOrderId(order.workOrderId || '');
      setDescription(order.description || '');
      setStatus(order.status);
      setOrderDate(order.orderDate || '');
      setExpectedDeliveryDate(order.expectedDeliveryDate || '');
      setActualDeliveryDate(order.actualDeliveryDate || '');
      setTotalAmount(order.totalAmount.toString());
      setNotes(order.notes || '');
    } else {
      // Generate order number
      const nextNumber = `MO-${Date.now().toString().slice(-6)}`;
      setOrderNumber(nextNumber);
      setOrderDate(new Date().toISOString().split('T')[0]);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingOrder(null);
    setOrderNumber('');
    setSelectedSupplierId('');
    setSelectedProjectId('');
    setSelectedWorkOrderId('');
    setDescription('');
    setStatus('pending');
    setOrderDate('');
    setExpectedDeliveryDate('');
    setActualDeliveryDate('');
    setTotalAmount('0');
    setNotes('');
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
        project_id: selectedProjectId || undefined,
        work_order_id: selectedWorkOrderId || undefined,
        description: description.trim() || undefined,
        status,
        order_date: orderDate || undefined,
        expected_delivery_date: expectedDeliveryDate || undefined,
        actual_delivery_date: actualDeliveryDate || undefined,
        total_amount: parseFloat(totalAmount) || 0,
        notes: notes.trim() || undefined,
        created_by: profile.id,
      };

      if (editingOrder) {
        const updated = await db.updateMaterialOrder(editingOrder.id, orderData);
        if (updated) {
          const appOrder: MaterialOrder = {
            id: updated.id,
            orderNumber: updated.order_number,
            supplierId: updated.supplier_id,
            supplierName: getSupplierName(updated.supplier_id),
            projectId: updated.project_id,
            projectName: getProjectName(updated.project_id),
            workOrderId: updated.work_order_id,
            workOrderNumber: getWorkOrderNumber(updated.work_order_id),
            description: updated.description,
            status: updated.status as MaterialOrder['status'],
            orderDate: updated.order_date,
            expectedDeliveryDate: updated.expected_delivery_date,
            actualDeliveryDate: updated.actual_delivery_date,
            totalAmount: Number(updated.total_amount),
            notes: updated.notes,
            receiptUrl: updated.receipt_url,
            createdBy: updated.created_by,
            createdAt: updated.created_at,
            updatedAt: updated.updated_at,
          };
          dispatch({ type: 'UPDATE_MATERIAL_ORDER', payload: appOrder });
          toast.success('Material order updated');
        }
      } else {
        const created = await db.createMaterialOrder(orderData);
        if (created) {
          const appOrder: MaterialOrder = {
            id: created.id,
            orderNumber: created.order_number,
            supplierId: created.supplier_id,
            supplierName: getSupplierName(created.supplier_id),
            projectId: created.project_id,
            projectName: getProjectName(created.project_id),
            workOrderId: created.work_order_id,
            workOrderNumber: getWorkOrderNumber(created.work_order_id),
            description: created.description,
            status: created.status as MaterialOrder['status'],
            orderDate: created.order_date,
            expectedDeliveryDate: created.expected_delivery_date,
            actualDeliveryDate: created.actual_delivery_date,
            totalAmount: Number(created.total_amount),
            notes: created.notes,
            receiptUrl: created.receipt_url,
            createdBy: created.created_by,
            createdAt: created.created_at,
            updatedAt: created.updated_at,
          };
          dispatch({ type: 'ADD_MATERIAL_ORDER', payload: appOrder });
          toast.success('Material order created');
        }
      }

      handleCloseModal();
    } catch (error) {
      console.error('Error saving material order:', error);
      toast.error('Failed to save material order');
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
          orderNumber: updated.order_number,
          supplierId: updated.supplier_id,
          supplierName: getSupplierName(updated.supplier_id),
          projectId: updated.project_id,
          projectName: getProjectName(updated.project_id),
          workOrderId: updated.work_order_id,
          workOrderNumber: getWorkOrderNumber(updated.work_order_id),
          description: updated.description,
          status: updated.status as MaterialOrder['status'],
          orderDate: updated.order_date,
          expectedDeliveryDate: updated.expected_delivery_date,
          actualDeliveryDate: updated.actual_delivery_date,
          totalAmount: Number(updated.total_amount),
          notes: updated.notes,
          receiptUrl: updated.receipt_url,
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
      order.orderNumber.toLowerCase().includes(query) ||
      order.supplierName.toLowerCase().includes(query) ||
      (order.projectName && order.projectName.toLowerCase().includes(query)) ||
      (order.description && order.description.toLowerCase().includes(query));
    
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
      .reduce((sum, o) => sum + o.totalAmount, 0),
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
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
        >
          <Plus size={20} />
          New Material Order
        </button>
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
                    {order.projectName && (
                      <span className="flex items-center gap-1">
                        <Building2 size={14} />
                        {order.projectName}
                      </span>
                    )}
                    {order.workOrderNumber && (
                      <span className="flex items-center gap-1">
                        <FileText size={14} />
                        {order.workOrderNumber}
                      </span>
                    )}
                  </div>
                  {order.description && (
                    <p className="text-sm text-gray-600">{order.description}</p>
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
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(order.totalAmount)}</p>
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
              <h2 className="text-xl font-bold text-gray-900">
                {editingOrder ? 'Edit Material Order' : 'New Material Order'}
              </h2>
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
                    Link to Project (Optional)
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">No project</option>
                    {state.projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.projectNumber} - {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Link to Work Order (Optional)
                  </label>
                  <select
                    value={selectedWorkOrderId}
                    onChange={(e) => setSelectedWorkOrderId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">No work order</option>
                    {state.workOrders
                      .filter(wo => !selectedProjectId || wo.projectId === selectedProjectId)
                      .map((workOrder) => (
                        <option key={workOrder.id} value={workOrder.id}>
                          {workOrder.workOrderNumber} - {workOrder.title}
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Amount *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
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

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description / Items Ordered
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="List materials ordered, quantities, specifications..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Internal Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tracking numbers, special instructions, issues..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
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

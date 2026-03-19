import React, { useState, useEffect, useRef } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { WorkOrder } from '@/lib/crmData';
import { exportWorkOrdersToExcel } from '@/lib/exportUtils';
import { SignaturePad } from './SignaturePad';
import { uploadDocument, getDocumentSignedUrl, formatFileSize } from '@/lib/storage';
import {
  Clipboard,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Save,
  Calendar,
  Clock,
  DollarSign,
  Users,
  CheckCircle,
  PlayCircle,
  Pause,
  XCircle,
  MapPin,
  Paperclip,
  ListChecks,
  FolderKanban,
  Download,
  PenLine,
  Upload,
  FileText,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';

// Status badge component
function StatusBadge({ status }: { status: WorkOrder['status'] }) {
  const config = {
    scheduled: { label: 'Scheduled', className: 'bg-blue-100 text-blue-700', icon: Calendar },
    in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-700', icon: PlayCircle },
    completed: { label: 'Completed', className: 'bg-green-100 text-green-700', icon: CheckCircle },
    cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700', icon: XCircle },
    on_hold: { label: 'On Hold', className: 'bg-orange-100 text-orange-700', icon: Pause },
  }[status];

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
      <Icon size={12} />
      {config.label}
    </span>
  );
}

// Priority badge component
function PriorityBadge({ priority }: { priority: WorkOrder['priority'] }) {
  const config = {
    low: { label: 'Low', className: 'bg-gray-100 text-gray-700' },
    medium: { label: 'Medium', className: 'bg-blue-100 text-blue-700' },
    high: { label: 'High', className: 'bg-orange-100 text-orange-700' },
    urgent: { label: 'Urgent', className: 'bg-red-100 text-red-700' },
  }[priority];

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

export default function WorkOrdersView() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkOrder['status'] | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingWorkOrder, setEditingWorkOrder] = useState<WorkOrder | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showSignModal, setShowSignModal] = useState<WorkOrder | null>(null);
  const [signerName, setSignerName] = useState('');

  // Form state
  const [workOrderNumber, setWorkOrderNumber] = useState('');
  const [title, setTitle] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<WorkOrder['status']>('scheduled');
  const [priority, setPriority] = useState<WorkOrder['priority']>('medium');
  const [scheduledDate, setScheduledDate] = useState('');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [estimatedHours, setEstimatedHours] = useState('');
  const [actualHours, setActualHours] = useState('');
  const [laborCost, setLaborCost] = useState('0');
  const [materialCost, setMaterialCost] = useState('0');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [workOrderState, setWorkOrderState] = useState('');
  const [zip, setZip] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load work orders when company is available (handles slow auth)
  useEffect(() => {
    if (profile?.company_id) loadWorkOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.company_id]);

  // Auto-fill location from selected contact (only when creating, not editing)
  useEffect(() => {
    if (!editingWorkOrder && selectedContactId) {
      const contact = state.contacts.find(c => c.id === selectedContactId);
      if (contact) {
        if (contact.address) setAddress(contact.address);
        if (contact.city) setCity(contact.city);
        if (contact.state) setWorkOrderState(contact.state);
        if (contact.zip) setZip(contact.zip);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContactId]);

  const loadWorkOrders = async () => {
    if (!profile?.company_id) return;
    try {
      const workOrders = await db.getWorkOrders(profile.company_id);
      // Convert DB format to app format
      const appWorkOrders: WorkOrder[] = workOrders.map(wo => ({
        id: wo.id,
        workOrderNumber: wo.work_order_number,
        projectId: wo.project_id,
        projectName: getProjectName(wo.project_id),
        contactId: wo.contact_id,
        contactName: getContactName(wo.contact_id),
        title: wo.title,
        description: wo.description,
        status: wo.status as WorkOrder['status'],
        priority: wo.priority as WorkOrder['priority'],
        scheduledDate: wo.scheduled_date,
        startedAt: wo.started_at,
        completedAt: wo.completed_at,
        assignedTo: wo.assigned_to || [],
        assignedToNames: (wo.assigned_to || []).map(id => getTeamMemberName(id)).filter(Boolean) as string[],
        estimatedHours: wo.estimated_hours ? Number(wo.estimated_hours) : undefined,
        actualHours: wo.actual_hours ? Number(wo.actual_hours) : undefined,
        laborCost: Number(wo.labor_cost),
        materialCost: Number(wo.material_cost),
        totalCost: Number(wo.total_cost),
        address: wo.address,
        city: wo.city,
        state: wo.state,
        zip: wo.zip,
        notes: wo.notes,
        attachments: wo.attachments || [],
        checklistItems: wo.checklist_items || [],
        signedBy: wo.signed_by,
        signatureData: wo.signature_data,
        createdBy: wo.created_by,
        createdAt: wo.created_at,
        updatedAt: wo.updated_at,
      }));
      dispatch({ type: 'SET_WORK_ORDERS', payload: appWorkOrders });
    } catch (error) {
      console.error('Error loading work orders:', error);
      toast.error('Failed to load work orders');
    }
  };

  const handleOpenModal = (workOrder?: WorkOrder) => {
    if (workOrder) {
      setEditingWorkOrder(workOrder);
      setWorkOrderNumber(workOrder.workOrderNumber);
      setTitle(workOrder.title);
      setSelectedProjectId(workOrder.projectId || '');
      setSelectedContactId(workOrder.contactId);
      setDescription(workOrder.description || '');
      setStatus(workOrder.status);      setPriority(workOrder.priority);
      setScheduledDate(workOrder.scheduledDate || '');
      setAssignedTo(workOrder.assignedTo);
      setEstimatedHours(workOrder.estimatedHours?.toString() || '');
      setActualHours(workOrder.actualHours?.toString() || '');
      setLaborCost(workOrder.laborCost.toString());
      setMaterialCost(workOrder.materialCost.toString());
      setAddress(workOrder.address || '');
      setCity(workOrder.city || '');
      setWorkOrderState(workOrder.state || '');
      setZip(workOrder.zip || '');
      setNotes(workOrder.notes || '');
      setAttachments(workOrder.attachments || []);
    } else {
      // Generate work order number for new work orders only
      const nextNumber = `WO-${Date.now().toString().slice(-6)}`;
      setWorkOrderNumber(nextNumber);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingWorkOrder(null);
    setWorkOrderNumber('');
    setTitle('');
    setSelectedProjectId('');
    setSelectedContactId('');
    setDescription('');
    setStatus('scheduled');
    setPriority('medium');
    setScheduledDate('');
    setAssignedTo([]);
    setEstimatedHours('');
    setActualHours('');
    setLaborCost('0');
    setMaterialCost('0');
    setAddress('');
    setCity('');
    setWorkOrderState('');
    setZip('');
    setNotes('');
    setAttachments([]);
  };

  const handleSave = async () => {
    if (!profile?.company_id || !profile?.id) return;
    
    if (!selectedContactId) {
      toast.error('Please select a customer');
      return;
    }
    if (!title.trim()) {
      toast.error('Please enter a work order title');
      return;
    }

    setIsSaving(true);

    try {
      const totalCost = (parseFloat(laborCost) || 0) + (parseFloat(materialCost) || 0);
      
      const workOrderData = {
        company_id: profile.company_id,
        work_order_number: workOrderNumber,
        project_id: selectedProjectId || undefined,
        contact_id: selectedContactId,
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        scheduled_date: scheduledDate || undefined,
        assigned_to: assignedTo.length > 0 ? assignedTo : [],
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        actual_hours: actualHours ? parseFloat(actualHours) : undefined,
        labor_cost: parseFloat(laborCost) || 0,
        material_cost: parseFloat(materialCost) || 0,
        total_cost: totalCost,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: workOrderState.trim() || undefined,
        zip: zip.trim() || undefined,
        notes: notes.trim() || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        created_by: profile.id,
      };

      if (editingWorkOrder) {
        const updated = await db.updateWorkOrder(editingWorkOrder.id, workOrderData);
        if (updated) {
          const appWorkOrder: WorkOrder = {
            id: updated.id,
            workOrderNumber: updated.work_order_number,
            projectId: updated.project_id,
            projectName: getProjectName(updated.project_id),
            contactId: updated.contact_id,
            contactName: getContactName(updated.contact_id),
            title: updated.title,
            description: updated.description,
            status: updated.status as WorkOrder['status'],
            priority: updated.priority as WorkOrder['priority'],
            scheduledDate: updated.scheduled_date,
            startedAt: updated.started_at,
            completedAt: updated.completed_at,
            assignedTo: updated.assigned_to || [],
            assignedToNames: (updated.assigned_to || []).map(id => getTeamMemberName(id)).filter(Boolean) as string[],
            estimatedHours: updated.estimated_hours ? Number(updated.estimated_hours) : undefined,
            actualHours: updated.actual_hours ? Number(updated.actual_hours) : undefined,
            laborCost: Number(updated.labor_cost),
            materialCost: Number(updated.material_cost),
            totalCost: Number(updated.total_cost),
            address: updated.address,
            city: updated.city,
            state: updated.state,
            zip: updated.zip,
            notes: updated.notes,
            attachments: updated.attachments || [],
            checklistItems: updated.checklist_items || [],
            createdBy: updated.created_by,
            createdAt: updated.created_at,
            updatedAt: updated.updated_at,
          };
          dispatch({ type: 'UPDATE_WORK_ORDER', payload: appWorkOrder });
          toast.success('Work order updated');
          handleCloseModal();
        } else {
          toast.error('Failed to update work order. Please try again.');
        }
      } else {
        const created = await db.createWorkOrder(workOrderData);
        if (created) {
          const appWorkOrder: WorkOrder = {
            id: created.id,
            workOrderNumber: created.work_order_number,
            projectId: created.project_id,
            projectName: getProjectName(created.project_id),
            contactId: created.contact_id,
            contactName: getContactName(created.contact_id),
            title: created.title,
            description: created.description,
            status: created.status as WorkOrder['status'],
            priority: created.priority as WorkOrder['priority'],
            scheduledDate: created.scheduled_date,
            startedAt: created.started_at,
            completedAt: created.completed_at,
            assignedTo: created.assigned_to || [],
            assignedToNames: (created.assigned_to || []).map(id => getTeamMemberName(id)).filter(Boolean) as string[],
            estimatedHours: created.estimated_hours ? Number(created.estimated_hours) : undefined,
            actualHours: created.actual_hours ? Number(created.actual_hours) : undefined,
            laborCost: Number(created.labor_cost),
            materialCost: Number(created.material_cost),
            totalCost: Number(created.total_cost),
            address: created.address,
            city: created.city,
            state: created.state,
            zip: created.zip,
            notes: created.notes,
            attachments: created.attachments || [],
            checklistItems: created.checklist_items || [],
            createdBy: created.created_by,
            createdAt: created.created_at,
            updatedAt: created.updated_at,
          };
          dispatch({ type: 'ADD_WORK_ORDER', payload: appWorkOrder });
          toast.success('Work order created');
          handleCloseModal();
        } else {
          toast.error('Failed to create work order. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error saving work order:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save work order');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (workOrderId: string) => {
    try {
      await db.deleteWorkOrder(workOrderId);
      dispatch({ type: 'DELETE_WORK_ORDER', payload: workOrderId });
      toast.success('Work order deleted');
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting work order:', error);
      toast.error('Failed to delete work order');
    }
  };

  const handleStartWork = async (workOrderId: string) => {
    try {
      const updated = await db.startWorkOrder(workOrderId);
      if (updated) {
        const appWorkOrder: WorkOrder = {
          id: updated.id,
          workOrderNumber: updated.work_order_number,
          projectId: updated.project_id,
          projectName: getProjectName(updated.project_id),
          contactId: updated.contact_id,
          contactName: getContactName(updated.contact_id),
          title: updated.title,
          description: updated.description,
          status: updated.status as WorkOrder['status'],
          priority: updated.priority as WorkOrder['priority'],
          scheduledDate: updated.scheduled_date,
          startedAt: updated.started_at,
          completedAt: updated.completed_at,
          assignedTo: updated.assigned_to || [],
          assignedToNames: (updated.assigned_to || []).map(id => getTeamMemberName(id)).filter(Boolean) as string[],
          estimatedHours: updated.estimated_hours ? Number(updated.estimated_hours) : undefined,
          actualHours: updated.actual_hours ? Number(updated.actual_hours) : undefined,
          laborCost: Number(updated.labor_cost),
          materialCost: Number(updated.material_cost),
          totalCost: Number(updated.total_cost),
          address: updated.address,
          city: updated.city,
          state: updated.state,
          zip: updated.zip,
          notes: updated.notes,
          attachments: updated.attachments || [],
          checklistItems: updated.checklist_items || [],
          createdBy: updated.created_by,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
        };
        dispatch({ type: 'UPDATE_WORK_ORDER', payload: appWorkOrder });
        toast.success('Work order started');
      }
    } catch (error) {
      console.error('Error starting work order:', error);
      toast.error('Failed to start work order');
    }
  };

  const handleCompleteWork = async (workOrderId: string, actualHours?: number) => {
    try {
      const updated = await db.completeWorkOrder(workOrderId, actualHours);
      if (updated) {
        const appWorkOrder: WorkOrder = {
          id: updated.id,
          workOrderNumber: updated.work_order_number,
          projectId: updated.project_id,
          projectName: getProjectName(updated.project_id),
          contactId: updated.contact_id,
          contactName: getContactName(updated.contact_id),
          title: updated.title,
          description: updated.description,
          status: updated.status as WorkOrder['status'],
          priority: updated.priority as WorkOrder['priority'],
          scheduledDate: updated.scheduled_date,
          startedAt: updated.started_at,
          completedAt: updated.completed_at,
          assignedTo: updated.assigned_to || [],
          assignedToNames: (updated.assigned_to || []).map(id => getTeamMemberName(id)).filter(Boolean) as string[],
          estimatedHours: updated.estimated_hours ? Number(updated.estimated_hours) : undefined,
          actualHours: updated.actual_hours ? Number(updated.actual_hours) : undefined,
          laborCost: Number(updated.labor_cost),
          materialCost: Number(updated.material_cost),
          totalCost: Number(updated.total_cost),
          address: updated.address,
          city: updated.city,
          state: updated.state,
          zip: updated.zip,
          notes: updated.notes,
          attachments: updated.attachments || [],
          checklistItems: updated.checklist_items || [],
          createdBy: updated.created_by,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
        };
        dispatch({ type: 'UPDATE_WORK_ORDER', payload: appWorkOrder });
        toast.success('Work order completed');
      }
    } catch (error) {
      console.error('Error completing work order:', error);
      toast.error('Failed to complete work order');
    }
  };

  const handleSignWorkOrder = async (signatureData: string) => {
    const workOrder = showSignModal;
    if (!workOrder || !profile?.company_id) return;
    const name = signerName.trim() || profile.id;
    try {
      const updated = await db.markWorkOrderSigned(workOrder.id, name, signatureData);
      if (updated) {
        const appWorkOrder: WorkOrder = {
          id: updated.id,
          workOrderNumber: updated.work_order_number,
          projectId: updated.project_id,
          contactId: updated.contact_id,
          contactName: state.contacts.find(c => c.id === updated.contact_id)
            ? `${state.contacts.find(c => c.id === updated.contact_id)!.firstName} ${state.contacts.find(c => c.id === updated.contact_id)!.lastName}`.trim()
            : '',
          title: updated.title,
          description: updated.description,
          status: updated.status as WorkOrder['status'],
          priority: updated.priority as WorkOrder['priority'],
          scheduledDate: updated.scheduled_date,
          startedAt: updated.started_at,
          completedAt: updated.completed_at,
          assignedTo: updated.assigned_to || [],
          assignedToNames: (updated.assigned_to || []).map(id => {
            const m = state.teamMembers?.find((tm: any) => tm.id === id);
            return m ? `${m.firstName} ${m.lastName}`.trim() : '';
          }).filter(Boolean) as string[],
          estimatedHours: updated.estimated_hours ? Number(updated.estimated_hours) : undefined,
          actualHours: updated.actual_hours ? Number(updated.actual_hours) : undefined,
          laborCost: Number(updated.labor_cost),
          materialCost: Number(updated.material_cost),
          totalCost: Number(updated.total_cost),
          address: updated.address,
          city: updated.city,
          state: updated.state,
          zip: updated.zip,
          notes: updated.notes,
          attachments: updated.attachments || [],
          checklistItems: updated.checklist_items || [],
          signedBy: updated.signed_by,
          signatureData: updated.signature_data,
          createdBy: updated.created_by,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
        };
        dispatch({ type: 'UPDATE_WORK_ORDER', payload: appWorkOrder });
        toast.success('Work order signed & completed');
        setShowSignModal(null);
        setSignerName('');
      }
    } catch (err: any) {
      toast.error(`Failed to save signature: ${err.message}`);
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
      if (filteredWorkOrders.length === 0) {
        toast.error('No work orders to export');
        return;
      }
      exportWorkOrdersToExcel(filteredWorkOrders);
      toast.success(`Exported ${filteredWorkOrders.length} work orders to Excel`);
    } catch (error) {
      console.error('Error exporting work orders:', error);
      toast.error('Failed to export work orders');
    }
  };

  // Helper functions
  const getContactName = (contactId: string) => {
    const contact = state.contacts.find(c => c.id === contactId);
    return contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown';
  };

  const getProjectName = (projectId?: string) => {
    if (!projectId) return undefined;
    const project = state.projects.find(p => p.id === projectId);
    return project ? project.name : undefined;
  };

  const getTeamMemberName = (memberId: string) => {
    const member = state.teamMembers.find(m => m.id === memberId);
    return member ? member.name : undefined;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not scheduled';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const toggleAssignee = (memberId: string) => {
    setAssignedTo(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  // Filter work orders
  const filteredWorkOrders = state.workOrders.filter((workOrder) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      workOrder.workOrderNumber.toLowerCase().includes(query) ||
      workOrder.title.toLowerCase().includes(query) ||
      workOrder.contactName.toLowerCase().includes(query) ||
      (workOrder.projectName && workOrder.projectName.toLowerCase().includes(query));
    
    const matchesStatus = statusFilter === 'all' || workOrder.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: state.workOrders.length,
    scheduled: state.workOrders.filter(wo => wo.status === 'scheduled').length,
    inProgress: state.workOrders.filter(wo => wo.status === 'in_progress').length,
    completed: state.workOrders.filter(wo => wo.status === 'completed').length,
    totalCost: state.workOrders.reduce((sum, wo) => sum + wo.totalCost, 0),
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
            <Clipboard size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
            <p className="text-sm text-gray-500">Schedule jobs and assign crews</p>
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
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all"
          >
            <Plus size={20} />
            New Work Order
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Total</span>
            <Clipboard size={16} className="text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Scheduled</span>
            <Calendar size={16} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.scheduled}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">In Progress</span>
            <PlayCircle size={16} className="text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Completed</span>
            <CheckCircle size={16} className="text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Total Cost</span>
            <DollarSign size={16} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalCost)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search work orders by number, title, customer, or project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All Statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="on_hold">On Hold</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Work Orders List */}
      {filteredWorkOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Clipboard size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No work orders found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Get started by creating your first work order'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus size={20} />
              Create Work Order
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredWorkOrders.map((workOrder) => (
            <div
              key={workOrder.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{workOrder.title}</h3>
                    <StatusBadge status={workOrder.status} />
                    <PriorityBadge priority={workOrder.priority} />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                    <span className="font-mono">{workOrder.workOrderNumber}</span>
                    <span className="flex items-center gap-1">
                      <Users size={14} />
                      {workOrder.contactName}
                    </span>
                    {workOrder.projectName && (
                      <span className="flex items-center gap-1">
                        <FolderKanban size={14} />
                        {workOrder.projectName}
                      </span>
                    )}
                    {workOrder.address && (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {workOrder.city}, {workOrder.state}
                      </span>
                    )}
                  </div>
                  {workOrder.description && (
                    <p className="text-sm text-gray-600">{workOrder.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {workOrder.status === 'scheduled' && (
                    <button
                      onClick={() => handleStartWork(workOrder.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Start work"
                    >
                      <PlayCircle size={18} />
                    </button>
                  )}
                  {workOrder.status === 'in_progress' && (
                    <>
                      <button
                        onClick={() => { setShowSignModal(workOrder); setSignerName(''); }}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Get signature & complete"
                      >
                        <PenLine size={18} />
                      </button>
                      <button
                        onClick={() => handleCompleteWork(workOrder.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Complete work"
                      >
                        <CheckCircle size={18} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleOpenModal(workOrder)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(workOrder.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Work Order Details Grid */}
              <div className="grid grid-cols-5 gap-4 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Scheduled</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(workOrder.scheduledDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Assigned To</p>
                  <p className="text-sm font-medium text-gray-900">
                    {workOrder.assignedToNames && workOrder.assignedToNames.length > 0
                      ? workOrder.assignedToNames.join(', ')
                      : 'Unassigned'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Est. Hours</p>
                  <p className="text-sm font-medium text-gray-900">
                    {workOrder.estimatedHours ? `${workOrder.estimatedHours}h` : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Labor Cost</p>
                  <p className="text-sm font-semibold text-green-600">{formatCurrency(workOrder.laborCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total Cost</p>
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(workOrder.totalCost)}</p>
                </div>
              </div>

              {/* Timestamps */}
              {(workOrder.startedAt || workOrder.completedAt) && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {workOrder.startedAt && (
                      <span>Started: {formatDateTime(workOrder.startedAt)}</span>
                    )}
                    {workOrder.completedAt && (
                      <span>Completed: {formatDateTime(workOrder.completedAt)}</span>
                    )}
                    {workOrder.actualHours && (
                      <span>Actual Hours: {workOrder.actualHours}h</span>
                    )}
                  </div>
                </div>
              )}

              {/* Signature Info */}
              {workOrder.signedBy && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                  <CheckCircle size={14} className="flex-shrink-0" />
                  <span>Signed by <strong>{workOrder.signedBy}</strong></span>
                  {workOrder.signatureData && (
                    <img src={workOrder.signatureData} alt="Signature" className="h-6 ml-2 rounded border border-emerald-200 bg-white" />
                  )}
                </div>
              )}

              {/* Delete Confirmation */}
              {showDeleteConfirm === workOrder.id && (
                <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-800 mb-3">Are you sure you want to delete this work order?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(workOrder.id)}
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingWorkOrder ? 'Edit Work Order' : 'New Work Order'}
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
                    Work Order Number *
                  </label>
                  <input
                    type="text"
                    value={workOrderNumber}
                    onChange={(e) => setWorkOrderNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Install new siding - north side"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer *
                  </label>
                  <select
                    value={selectedContactId}
                    onChange={(e) => setSelectedContactId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select a customer</option>
                    {state.contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.firstName} {contact.lastName}
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
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">No project</option>
                    {state.projects
                      .filter(p => !selectedContactId || p.contactId === selectedContactId)
                      .map((project) => (
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
                    onChange={(e) => setStatus(e.target.value as WorkOrder['status'])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as WorkOrder['priority'])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Scheduled Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Labor Cost
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={laborCost}
                    onChange={(e) => setLaborCost(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Material Cost
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={materialCost}
                    onChange={(e) => setMaterialCost(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {editingWorkOrder && status === 'completed' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Actual Hours
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={actualHours}
                      onChange={(e) => setActualHours(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                )}
              </div>

              {/* Crew Assignment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign Crew Members
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {state.teamMembers
                    .filter(m => m.isActive)
                    .map((member) => (
                      <label
                        key={member.id}
                        className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                          assignedTo.includes(member.id)
                            ? 'bg-green-50 border-green-500'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={assignedTo.includes(member.id)}
                          onChange={() => toggleAssignee(member.id)}
                          className="rounded text-green-600"
                        />
                        <span className="text-sm">{member.name}</span>
                      </label>
                    ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Work to be done, materials needed, special instructions..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>

              {/* Address */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Job Site Location</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={workOrderState}
                      onChange={(e) => setWorkOrderState(e.target.value)}
                      placeholder="OH"
                      maxLength={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Internal Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
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
                  className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-green-400 hover:text-green-600 transition-colors disabled:opacity-50"
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
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                {isSaving ? 'Saving...' : 'Save Work Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      {showSignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Sign & Complete Work Order</h2>
                <p className="text-sm text-gray-500 mt-0.5">{showSignModal.workOrderNumber} · {showSignModal.title}</p>
              </div>
              <button
                onClick={() => { setShowSignModal(null); setSignerName(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Signer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  placeholder="Full name of signer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Draw Signature
                </label>
                <p className="text-xs text-gray-500 mb-2">Draw your signature below to confirm work completion</p>
                <SignaturePad
                  onSave={dataUrl => {
                    if (!signerName.trim()) {
                      toast.error('Please enter the signer name before saving');
                      return;
                    }
                    handleSignWorkOrder(dataUrl);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

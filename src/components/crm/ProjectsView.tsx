import React, { useState, useEffect } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { Project } from '@/lib/crmData';
import { exportProjectsToExcel } from '@/lib/exportUtils';
import {
  FolderKanban,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Save,
  Calendar,
  DollarSign,
  User,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Pause,
  PlayCircle,
  MapPin,
  FileText,
  TrendingUp,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';

// Status badge component
function StatusBadge({ status }: { status: Project['status'] }) {
  const config = {
    planning: { label: 'Planning', className: 'bg-blue-100 text-blue-700', icon: Clock },
    scheduled: { label: 'Scheduled', className: 'bg-purple-100 text-purple-700', icon: Calendar },
    in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-700', icon: PlayCircle },
    on_hold: { label: 'On Hold', className: 'bg-orange-100 text-orange-700', icon: Pause },
    completed: { label: 'Completed', className: 'bg-green-100 text-green-700', icon: CheckCircle },
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

// Priority badge component
function PriorityBadge({ priority }: { priority: Project['priority'] }) {
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

export default function ProjectsView() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Project['status'] | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [projectNumber, setProjectNumber] = useState('');
  const [name, setName] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedEstimateId, setSelectedEstimateId] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Project['status']>('planning');
  const [priority, setPriority] = useState<Project['priority']>('medium');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [estimatedBudget, setEstimatedBudget] = useState('0');
  const [materialCostGoal, setMaterialCostGoal] = useState('0');
  const [subcontractorCostGoal, setSubcontractorCostGoal] = useState('0');
  const [laborCostGoal, setLaborCostGoal] = useState('0');
  const [otherCostGoal, setOtherCostGoal] = useState('0');
  const [materialCost, setMaterialCost] = useState('0');
  const [subcontractorCost, setSubcontractorCost] = useState('0');
  const [laborCost, setLaborCost] = useState('0');
  const [otherCost, setOtherCost] = useState('0');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [projectState, setProjectState] = useState('');
  const [zip, setZip] = useState('');
  const [projectManagerId, setProjectManagerId] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');

  // Load projects on mount
  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fill location from selected contact (only when creating, not editing)
  useEffect(() => {
    if (!editingProject && selectedContactId) {
      const contact = state.contacts.find(c => c.id === selectedContactId);
      if (contact) {
        if (contact.address) setAddress(contact.address);
        if (contact.city) setCity(contact.city);
        if (contact.state) setProjectState(contact.state);
        if (contact.zip) setZip(contact.zip);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContactId]);

  const loadProjects = async () => {
    if (!profile?.company_id) return;
    try {
      const projects = await db.getProjects(profile.company_id);
      // Convert DB format to app format
      const appProjects: Project[] = projects.map(p => ({
        id: p.id,
        projectNumber: p.project_number,
        name: p.name,
        contactId: p.contact_id,
        contactName: getContactName(p.contact_id),
        estimateId: p.estimate_id,
        description: p.description,
        status: p.status as Project['status'],
        priority: p.priority as Project['priority'],
        startDate: p.start_date,
        endDate: p.end_date,
        completedDate: p.completed_date,
        estimatedBudget: Number(p.estimated_budget),
        actualCost: Number(p.actual_cost),
        materialCostGoal: Number((p as any).material_cost_goal || 0),
        subcontractorCostGoal: Number((p as any).subcontractor_cost_goal || 0),
        salesRepPayGoal: Number((p as any).labor_cost_goal || 0),
        otherExpensesGoal: Number((p as any).other_cost_goal || 0),
        actualMaterialCost: Number((p as any).material_cost || 0),
        actualSubcontractorCost: Number((p as any).subcontractor_cost || 0),
        actualSalesRepPay: Number((p as any).labor_cost || 0),
        actualOtherExpenses: Number((p as any).other_cost || 0),
        address: p.address,
        city: p.city,
        state: p.state,
        zip: p.zip,
        projectManagerId: p.project_manager_id,
        projectManagerName: getTeamMemberName(p.project_manager_id),
        notes: p.notes,
        tags: p.tags || [],
        createdBy: p.created_by,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));
      dispatch({ type: 'SET_PROJECTS', payload: appProjects });
    } catch (error) {
      console.error('Error loading projects:', error);
      toast.error('Failed to load projects');
    }
  };

  const handleOpenModal = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setProjectNumber(project.projectNumber);
      setName(project.name);
      setSelectedContactId(project.contactId);
      setSelectedEstimateId(project.estimateId || '');
      setDescription(project.description || '');
      setStatus(project.status);
      setPriority(project.priority);
      setStartDate(project.startDate || '');
      setEndDate(project.endDate || '');
      setEstimatedBudget(project.estimatedBudget.toString());
      setMaterialCostGoal((project.materialCostGoal || 0).toString());
      setSubcontractorCostGoal((project.subcontractorCostGoal || 0).toString());
      setLaborCostGoal((project.salesRepPayGoal || 0).toString());
      setOtherCostGoal((project.otherExpensesGoal || 0).toString());
      setMaterialCost((project.actualMaterialCost || 0).toString());
      setSubcontractorCost((project.actualSubcontractorCost || 0).toString());
      setLaborCost((project.actualSalesRepPay || 0).toString());
      setOtherCost((project.actualOtherExpenses || 0).toString());
      setAddress(project.address || '');
      setCity(project.city || '');
      setProjectState(project.state || '');
      setZip(project.zip || '');
      setProjectManagerId(project.projectManagerId || '');
      setNotes(project.notes || '');
      setTags(project.tags?.join(', ') || '');
    } else {
      // Generate project number
      const nextNumber = `PRJ-${Date.now().toString().slice(-6)}`;
      setProjectNumber(nextNumber);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProject(null);
    setProjectNumber('');
    setName('');
    setSelectedContactId('');
    setSelectedEstimateId('');
    setDescription('');
    setStatus('planning');
    setPriority('medium');
    setStartDate('');
    setEndDate('');
    setEstimatedBudget('0');
    setMaterialCostGoal('0');
    setSubcontractorCostGoal('0');
    setLaborCostGoal('0');
    setOtherCostGoal('0');
    setMaterialCost('0');
    setSubcontractorCost('0');
    setLaborCost('0');
    setOtherCost('0');
    setAddress('');
    setCity('');
    setProjectState('');
    setZip('');
    setProjectManagerId('');
    setNotes('');
    setTags('');
  };

  const handleSave = async () => {
    if (!profile?.company_id || !profile?.id) {
      toast.error('No company/user context available. Please refresh and sign in again.');
      return;
    }
    
    if (!selectedContactId) {
      toast.error('Please select a customer');
      return;
    }
    if (!name.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    setIsSaving(true);

    try {
      const projectData = {
        company_id: profile.company_id,
        project_number: projectNumber,
        name: name.trim(),
        contact_id: selectedContactId,
        estimate_id: selectedEstimateId || undefined,
        description: description.trim() || undefined,
        status,
        priority,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        estimated_budget: parseFloat(estimatedBudget) || 0,
        actual_cost: (parseFloat(materialCost) || 0) + (parseFloat(subcontractorCost) || 0) + (parseFloat(laborCost) || 0) + (parseFloat(otherCost) || 0),
        material_cost_goal: parseFloat(materialCostGoal) || 0,
        subcontractor_cost_goal: parseFloat(subcontractorCostGoal) || 0,
        labor_cost_goal: parseFloat(laborCostGoal) || 0,
        other_cost_goal: parseFloat(otherCostGoal) || 0,
        material_cost: parseFloat(materialCost) || 0,
        subcontractor_cost: parseFloat(subcontractorCost) || 0,
        labor_cost: parseFloat(laborCost) || 0,
        other_cost: parseFloat(otherCost) || 0,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: projectState.trim() || undefined,
        zip: zip.trim() || undefined,
        project_manager_id: projectManagerId || undefined,
        notes: notes.trim() || undefined,
        tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        created_by: profile.id,
      };

      let saveSucceeded = false;

      if (editingProject) {
        const updated = await db.updateProject(editingProject.id, projectData);
        if (updated) {
          const appProject: Project = {
            id: updated.id,
            projectNumber: updated.project_number,
            name: updated.name,
            contactId: updated.contact_id,
            contactName: getContactName(updated.contact_id),
            estimateId: updated.estimate_id,
            description: updated.description,
            status: updated.status as Project['status'],
            priority: updated.priority as Project['priority'],
            startDate: updated.start_date,
            endDate: updated.end_date,
            completedDate: updated.completed_date,
            estimatedBudget: Number(updated.estimated_budget),
            actualCost: Number(updated.actual_cost),
            materialCostGoal: Number((updated as any).material_cost_goal || 0),
            subcontractorCostGoal: Number((updated as any).subcontractor_cost_goal || 0),
            salesRepPayGoal: Number((updated as any).labor_cost_goal || 0),
            otherExpensesGoal: Number((updated as any).other_cost_goal || 0),
            actualMaterialCost: Number((updated as any).material_cost || 0),
            actualSubcontractorCost: Number((updated as any).subcontractor_cost || 0),
            actualSalesRepPay: Number((updated as any).labor_cost || 0),
            actualOtherExpenses: Number((updated as any).other_cost || 0),
            address: updated.address,
            city: updated.city,
            state: updated.state,
            zip: updated.zip,
            projectManagerId: updated.project_manager_id,
            projectManagerName: getTeamMemberName(updated.project_manager_id),
            notes: updated.notes,
            tags: updated.tags || [],
            createdBy: updated.created_by,
            createdAt: updated.created_at,
            updatedAt: updated.updated_at,
          };
          dispatch({ type: 'UPDATE_PROJECT', payload: appProject });
          toast.success('Project updated');
          saveSucceeded = true;
        } else {
          toast.error('Failed to save project changes');
        }
      } else {
        const created = await db.createProject(projectData);
        if (created) {
          const appProject: Project = {
            id: created.id,
            projectNumber: created.project_number,
            name: created.name,
            contactId: created.contact_id,
            contactName: getContactName(created.contact_id),
            estimateId: created.estimate_id,
            description: created.description,
            status: created.status as Project['status'],
            priority: created.priority as Project['priority'],
            startDate: created.start_date,
            endDate: created.end_date,
            completedDate: created.completed_date,
            estimatedBudget: Number(created.estimated_budget),
            actualCost: Number(created.actual_cost),
            materialCostGoal: Number((created as any).material_cost_goal || 0),
            subcontractorCostGoal: Number((created as any).subcontractor_cost_goal || 0),
            salesRepPayGoal: Number((created as any).labor_cost_goal || 0),
            otherExpensesGoal: Number((created as any).other_cost_goal || 0),
            actualMaterialCost: Number((created as any).material_cost || 0),
            actualSubcontractorCost: Number((created as any).subcontractor_cost || 0),
            actualSalesRepPay: Number((created as any).labor_cost || 0),
            actualOtherExpenses: Number((created as any).other_cost || 0),
            address: created.address,
            city: created.city,
            state: created.state,
            zip: created.zip,
            projectManagerId: created.project_manager_id,
            projectManagerName: getTeamMemberName(created.project_manager_id),
            notes: created.notes,
            tags: created.tags || [],
            createdBy: created.created_by,
            createdAt: created.created_at,
            updatedAt: created.updated_at,
          };
          dispatch({ type: 'ADD_PROJECT', payload: appProject });
          toast.success('Project created');
          saveSucceeded = true;
        } else {
          toast.error('Failed to create project');
        }
      }

      if (saveSucceeded) {
        handleCloseModal();
      }
    } catch (error) {
      console.error('Error saving project:', error);
      toast.error('Failed to save project');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    try {
      await db.deleteProject(projectId);
      dispatch({ type: 'DELETE_PROJECT', payload: projectId });
      toast.success('Project deleted');
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    }
  };

  const handleExport = () => {
    try {
      if (filteredProjects.length === 0) {
        toast.error('No projects to export');
        return;
      }
      exportProjectsToExcel(filteredProjects);
      toast.success(`Exported ${filteredProjects.length} projects to Excel`);
    } catch (error) {
      console.error('Error exporting projects:', error);
      toast.error('Failed to export projects');
    }
  };

  // Helper functions
  const getContactName = (contactId: string) => {
    const contact = state.contacts.find(c => c.id === contactId);
    return contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown';
  };

  const getTeamMemberName = (memberId?: string) => {
    if (!memberId) return undefined;
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
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Filter projects
  const filteredProjects = state.projects.filter((project) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      project.projectNumber.toLowerCase().includes(query) ||
      project.name.toLowerCase().includes(query) ||
      project.contactName.toLowerCase().includes(query) ||
      (project.address && project.address.toLowerCase().includes(query));
    
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: state.projects.length,
    active: state.projects.filter(p => p.status === 'in_progress').length,
    scheduled: state.projects.filter(p => p.status === 'scheduled').length,
    completed: state.projects.filter(p => p.status === 'completed').length,
    totalBudget: state.projects.reduce((sum, p) => sum + p.estimatedBudget, 0),
    totalActual: state.projects.reduce((sum, p) => sum + p.actualCost, 0),
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
            <FolderKanban size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-sm text-gray-500">Manage customer projects and track progress</p>
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
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all"
          >
            <Plus size={20} />
            New Project
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Active Projects</span>
            <PlayCircle size={16} className="text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Scheduled</span>
            <Calendar size={16} className="text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.scheduled}</p>
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
            <span className="text-sm text-gray-500">Total Budget</span>
            <DollarSign size={16} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalBudget)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects by number, name, customer, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Statuses</option>
          <option value="planning">Planning</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In Progress</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Projects List */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <FolderKanban size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Get started by creating your first project'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus size={20} />
              Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                    <StatusBadge status={project.status} />
                    <PriorityBadge priority={project.priority} />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                    <span className="font-mono">{project.projectNumber}</span>
                    <span className="flex items-center gap-1">
                      <User size={14} />
                      {project.contactName}
                    </span>
                    {project.address && (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {project.city}, {project.state}
                      </span>
                    )}
                  </div>
                  {project.description && (
                    <p className="text-sm text-gray-600">{project.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenModal(project)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(project.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Project Details Grid */}
              <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Start Date</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(project.startDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">End Date</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(project.endDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Budget</p>
                  <p className="text-sm font-semibold text-indigo-600">{formatCurrency(project.estimatedBudget)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total Cost</p>
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(project.actualCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Profit</p>
                  <p className={`text-sm font-semibold ${project.estimatedBudget - project.actualCost >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(project.estimatedBudget - project.actualCost)}
                  </p>
                </div>
              </div>

              {/* Cost Breakdown */}
              {(project.actualMaterialCost || project.actualSubcontractorCost || project.actualSalesRepPay || project.actualOtherExpenses) ? (
                <div className="mt-3 bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cost Breakdown</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {[
                      { label: 'Materials', actual: project.actualMaterialCost, goal: project.materialCostGoal },
                      { label: 'Subcontractors', actual: project.actualSubcontractorCost, goal: project.subcontractorCostGoal },
                      { label: 'Labor / Payroll', actual: project.actualSalesRepPay, goal: project.salesRepPayGoal },
                      { label: 'Other', actual: project.actualOtherExpenses, goal: project.otherExpensesGoal },
                    ].filter(r => r.actual || r.goal).map(({ label, actual, goal }) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-gray-500">{label}</span>
                        <span className="font-medium text-gray-700">{formatCurrency(actual || 0)}{goal ? ` / ${formatCurrency(goal)}` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Budget Progress */}
              {project.estimatedBudget > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>Budget Used</span>
                    <span>{((project.actualCost / project.estimatedBudget) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        project.actualCost > project.estimatedBudget
                          ? 'bg-red-500'
                          : project.actualCost > project.estimatedBudget * 0.9
                          ? 'bg-orange-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((project.actualCost / project.estimatedBudget) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Delete Confirmation */}
              {showDeleteConfirm === project.id && (
                <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-800 mb-3">Are you sure you want to delete this project? This will also delete all associated work orders.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(project.id)}
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
                {editingProject ? 'Edit Project' : 'New Project'}
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
                    Project Number *
                  </label>
                  <input
                    type="text"
                    value={projectNumber}
                    onChange={(e) => setProjectNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Kitchen Remodel - Smith Residence"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer *
                  </label>
                  <select
                    value={selectedContactId}
                    onChange={(e) => setSelectedContactId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    Link to Estimate (Optional)
                  </label>
                  <select
                    value={selectedEstimateId}
                    onChange={(e) => setSelectedEstimateId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">No estimate</option>
                    {state.estimates
                      .filter(e => e.contactId === selectedContactId)
                      .map((estimate) => (
                        <option key={estimate.id} value={estimate.id}>
                          {estimate.estimateNumber} - {estimate.title}
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
                    onChange={(e) => setStatus(e.target.value as Project['status'])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="planning">Planning</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Project['priority'])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Budget
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={estimatedBudget}
                    onChange={(e) => setEstimatedBudget(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project Manager
                  </label>
                  <select
                    value={projectManagerId}
                    onChange={(e) => setProjectManagerId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">No manager assigned</option>
                    {state.teamMembers
                      .filter(m => m.isActive)
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Cost Breakdown</h3>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                  <div className="col-span-2 grid grid-cols-3 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide pb-1 border-b border-gray-200">
                    <span>Category</span><span className="text-right">Budgeted</span><span className="text-right">Actual</span>
                  </div>
                  {[
                    { label: 'Materials', goal: materialCostGoal, setGoal: setMaterialCostGoal, actual: materialCost, setActual: setMaterialCost },
                    { label: 'Subcontractors', goal: subcontractorCostGoal, setGoal: setSubcontractorCostGoal, actual: subcontractorCost, setActual: setSubcontractorCost },
                    { label: 'Labor / Payroll', goal: laborCostGoal, setGoal: setLaborCostGoal, actual: laborCost, setActual: setLaborCost },
                    { label: 'Other', goal: otherCostGoal, setGoal: setOtherCostGoal, actual: otherCost, setActual: setOtherCost },
                  ].map(({ label, goal, setGoal, actual, setActual }) => (
                    <div key={label} className="col-span-2 grid grid-cols-3 gap-2 items-center">
                      <span className="text-sm text-gray-700 font-medium">{label}</span>
                      <input type="number" min="0" step="0.01" value={goal} onChange={e => setGoal(e.target.value)}
                        placeholder="0.00" className="px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <input type="number" min="0" step="0.01" value={actual} onChange={e => setActual(e.target.value)}
                        placeholder="0.00" className="px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  ))}
                  <div className="col-span-2 grid grid-cols-3 gap-2 items-center border-t border-gray-200 pt-2 mt-1">
                    <span className="text-sm font-bold text-gray-900">Total Costs</span>
                    <span className="text-sm font-bold text-right text-gray-700">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                        [materialCostGoal, subcontractorCostGoal, laborCostGoal, otherCostGoal].reduce((s, v) => s + (parseFloat(v) || 0), 0)
                      )}
                    </span>
                    <span className="text-sm font-bold text-right text-gray-700">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                        [materialCost, subcontractorCost, laborCost, otherCost].reduce((s, v) => s + (parseFloat(v) || 0), 0)
                      )}
                    </span>
                  </div>
                  <div className="col-span-2 grid grid-cols-3 gap-2 items-center">
                    <span className="text-sm font-bold text-green-700">Est. Profit</span>
                    <span className="text-sm font-bold text-right text-green-600">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                        (parseFloat(estimatedBudget) || 0) - [materialCostGoal, subcontractorCostGoal, laborCostGoal, otherCostGoal].reduce((s, v) => s + (parseFloat(v) || 0), 0)
                      )}
                    </span>
                    <span className="text-sm font-bold text-right text-green-600">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                        (parseFloat(estimatedBudget) || 0) - [materialCost, subcontractorCost, laborCost, otherCost].reduce((s, v) => s + (parseFloat(v) || 0), 0)
                      )}
                    </span>
                  </div>
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
                  placeholder="Project details, scope of work, special requirements..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Address */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Project Location</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={projectState}
                      onChange={(e) => setProjectState(e.target.value)}
                      placeholder="OH"
                      maxLength={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Tags and Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="insurance claim, roof, siding"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Internal Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={1}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
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
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                {isSaving ? 'Saving...' : 'Save Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

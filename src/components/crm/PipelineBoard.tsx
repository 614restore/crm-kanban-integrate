import React, { useState } from 'react';
import { useCRM, useCurrentBoard, canCreateBoard, canEditBoard } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { toast } from 'sonner';
import OwnerPriorityBoard from './OwnerPriorityBoard';
import {
  Contact,
  KanbanBoard,
  KanbanColumn,
  CustomerStatus,
  statusLabels,
  formatCurrency,
  getContactFullName,
} from '@/lib/crmData';
import {
  Plus,
  MoreVertical,
  GripVertical,
  MapPin,
  DollarSign,
  Edit2,
  Trash2,
  ChevronDown,
  X,
  Save,
  Loader2,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  AlertTriangle,
  ArrowRight,
  Calendar,
  FileText,
  ClipboardList,
  Wrench,
  Package,
  CheckSquare,
  Receipt,
  MessageSquare,
  PenLine,
  Users,
  CheckCircle,
} from 'lucide-react';
import { getNextStep, setPendingContactTab, type NextStep } from '@/lib/nextStepActions';
import { fireAutomationEvent } from '@/lib/automationEngine';
import type { KanbanStatus } from '@/lib/kanbanStatuses';

const NEXT_STEP_ICONS: Record<string, React.ElementType> = {
  Calendar,
  FileText,
  ClipboardList,
  Wrench,
  Package,
  CheckSquare,
  Receipt,
  MessageSquare,
  PenLine,
  DollarSign,
  AlertTriangle,
  Users,
};


function getStageAlert(contact: Contact): { label: string; className: string } | null {
  const since = contact.statusChangedAt || contact.updatedAt || contact.createdAt;
  if (!since) return null;
  const days = Math.floor((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60 * 24));
  if (days >= 21) return { label: `${days}d`, className: 'bg-red-100 text-red-700 border border-red-300 animate-pulse' };
  if (days >= 14) return { label: `${days}d`, className: 'bg-orange-100 text-orange-700 border border-orange-300' };
  if (days >= 7)  return { label: `${days}d`, className: 'bg-yellow-100 text-yellow-700 border border-yellow-300' };
  return null;
}

function normalizePipelineStatus(rawStatus: string | undefined | null): CustomerStatus | undefined {
  if (!rawStatus) return undefined;
  const status = rawStatus.trim().toLowerCase();
  const aliases: Record<string, CustomerStatus> = {
    new_lead: 'lead',
    appointment_set: 'appt_set',
    inspection_scheduled: 'appt_set',
    inspection_complete: 'inspection_completed',
    signed_won: 'signed',
    paid: 'completed',
  };

  return (aliases[status] ?? (status as CustomerStatus));
}

export default function PipelineBoard() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const currentBoard = useCurrentBoard();

  const [draggedContact, setDraggedContact] = useState<Contact | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [showBoardSelector, setShowBoardSelector] = useState(false);
  const [showBoardEditor, setShowBoardEditor] = useState(false);
  const [editingBoard, setEditingBoard] = useState<KanbanBoard | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAllBoards, setShowAllBoards] = useState(false);
  const [showCombinedSales, setShowCombinedSales] = useState(false);
  const [showPriorityPanel, setShowPriorityPanel] = useState(false);

  const userRole = (state.currentUser?.role || profile?.role || 'owner') as any;
  const canCreate = canCreateBoard(userRole);
  const canEdit = canEditBoard(userRole);
  const effectiveCompanyId = profile?.company_id || state.companyId || null;

  const getColumnContacts = (column: KanbanColumn): Contact[] => {
    return state.contacts.filter((c) => normalizePipelineStatus(c.status) === column.status);
  };

  // Merge all sales-type boards into one deduplicated column list (by status)
  const combinedSalesColumns: KanbanColumn[] = (() => {
    const salesBoards = state.boards.filter((b) => b.type === 'sales');
    const seen = new Set<string>();
    const merged: KanbanColumn[] = [];
    for (const board of salesBoards) {
      for (const col of board.columns) {
        if (!seen.has(col.status)) {
          seen.add(col.status);
          merged.push(col);
        }
      }
    }
    return merged;
  })();

  const handleDragStart = (e: React.DragEvent, contact: Contact) => {
    setDraggedContact(contact);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, column: KanbanColumn) => {
    e.preventDefault();
    if (draggedContact && draggedContact.status !== column.status) {
      try {
        if (effectiveCompanyId) {
          await db.updateContact(draggedContact.id, { status: column.status, status_changed_at: new Date().toISOString() });
        }
        dispatch({
          type: 'UPDATE_CONTACT_STATUS',
          payload: { contactId: draggedContact.id, status: column.status },
        });
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            id: `notif-${Date.now()}`,
            type: 'success',
            title: 'Contact Updated',
            message: `${getContactFullName(draggedContact)} moved to ${column.title}`,
            timestamp: new Date().toISOString(),
            read: false,
          },
        });
        // Fire automation rules for manual board moves
        if (effectiveCompanyId) {
          fireAutomationEvent('contact_status_changed', effectiveCompanyId, {
            contactId: draggedContact.id,
            contactName: getContactFullName(draggedContact),
            contactEmail: draggedContact.email,
            oldStatus: draggedContact.status,
            newStatus: column.status,
          }).catch(() => {});
        }
      } catch (error) {
        console.error('Error updating contact status:', error);
        const msg = error instanceof Error ? error.message : 'Failed to move contact';
        toast.error(msg);
      }
    }
    setDraggedContact(null);
    setDragOverColumn(null);
  };

  const handleContactClick = (contactId: string) => {
    dispatch({ type: 'SELECT_CONTACT', payload: contactId });
  };

  const handleAcknowledgeClick = async (e: React.MouseEvent, contact: Contact) => {
    e.stopPropagation();
    try {
      if (effectiveCompanyId) {
        await db.updateContact(contact.id, { status: 'ordering_material', status_changed_at: new Date().toISOString() });
      }
      dispatch({
        type: 'UPDATE_CONTACT_STATUS',
        payload: { contactId: contact.id, status: 'ordering_material' },
      });
      toast.success(`${getContactFullName(contact)} acknowledged — ordering materials`);
      if (effectiveCompanyId) {
        fireAutomationEvent('contact_status_changed', effectiveCompanyId, {
          contactId: contact.id,
          contactName: getContactFullName(contact),
          contactEmail: contact.email,
          oldStatus: contact.status,
          newStatus: 'ordering_material',
        }).catch(() => {});
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to acknowledge';
      toast.error(msg);
    }
  };

  const handleNextStepClick = (e: React.MouseEvent, contact: Contact, nextStep: NextStep) => {
    e.stopPropagation();
    switch (nextStep.action) {
      case 'calendar':
        dispatch({ type: 'SET_PENDING_APPOINTMENT_CONTACT', payload: contact.id });
        dispatch({ type: 'SET_VIEW', payload: 'calendar' });
        break;
      case 'material-orders':
        dispatch({ type: 'SET_VIEW', payload: 'material-orders' });
        break;
      case 'crew-schedule':
        dispatch({ type: 'SET_VIEW', payload: 'crew-schedule' });
        break;
      case 'estimates':
        dispatch({ type: 'SET_VIEW', payload: 'estimates' });
        break;
      case 'invoice':
        dispatch({ type: 'TOGGLE_INVOICE_MODAL', payload: contact.id });
        break;
      case 'documents-tab':
        setPendingContactTab('documents');
        dispatch({ type: 'SELECT_CONTACT', payload: contact.id });
        break;
      case 'financial-tab':
        setPendingContactTab('financial');
        dispatch({ type: 'SELECT_CONTACT', payload: contact.id });
        break;
      case 'job-status-tab':
        setPendingContactTab('jobStatus');
        dispatch({ type: 'SELECT_CONTACT', payload: contact.id });
        break;
      case 'select':
      default:
        dispatch({ type: 'SELECT_CONTACT', payload: contact.id });
        break;
    }
  };

  const handleCreateBoard = () => {
    const stamp = Date.now();
    const newBoard: KanbanBoard = {
      id: `board-${stamp}`,
      name: 'New Board',
      type: 'custom',
      visibleTo: ['owner', 'manager', 'admin'],
      createdBy: state.currentUser?.id || 'unknown',
      isDefault: false,
      columns: [
        { id: `col-${stamp}-1`, title: 'Lead', status: 'lead', color: '#3b82f6', order: 0 },
        { id: `col-${stamp}-2`, title: 'Appt Set', status: 'appt_set', color: '#8b5cf6', order: 1 },
        { id: `col-${stamp}-3`, title: 'Signed', status: 'signed', color: '#22c55e', order: 2 },
      ],
    };
    setEditingBoard(newBoard);
    setShowBoardEditor(true);
  };

  const moveColumn = (fromIndex: number, toIndex: number) => {
    if (!editingBoard) return;
    if (toIndex < 0 || toIndex >= editingBoard.columns.length) return;
    const next = [...editingBoard.columns];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setEditingBoard({
      ...editingBoard,
      columns: next.map((col, index) => ({ ...col, order: index })),
    });
  };

  const handleSaveBoard = async () => {
    if (!editingBoard) return;
    if (!editingBoard.name.trim()) { toast.error('Board name is required'); return; }
    if (editingBoard.columns.length === 0) { toast.error('Add at least one column'); return; }
    setIsSaving(true);
    try {
      const isNewBoard = !state.boards.find((b) => b.id === editingBoard.id);
      const normalizedColumns = editingBoard.columns.map((col, index) => ({ ...col, order: index }));
      let savedBoard: KanbanBoard = { ...editingBoard, columns: normalizedColumns };
      if (effectiveCompanyId) {
        if (isNewBoard) {
          const created = await db.createKanbanBoard(
            { company_id: effectiveCompanyId, name: editingBoard.name, type: editingBoard.type, visible_to: editingBoard.visibleTo, created_by: profile?.id, is_default: false },
            normalizedColumns.map((col) => ({ title: col.title, status: col.status, color: col.color, sort_order: col.order }))
          );
          if (!created) { toast.error('Failed to create board'); return; }
          const boardWithColumns = await db.getKanbanBoardWithColumns(created.id, effectiveCompanyId);
          savedBoard = {
            id: created.id, name: created.name, type: created.type as KanbanBoard['type'],
            visibleTo: (created.visible_to || editingBoard.visibleTo) as KanbanBoard['visibleTo'],
            createdBy: created.created_by || profile?.id || 'unknown', isDefault: created.is_default,
            columns: boardWithColumns?.columns.map((col) => ({ id: col.id, title: col.title, status: col.status as CustomerStatus, color: col.color, order: col.sort_order })) || normalizedColumns,
          };
        } else {
          const updatedBoard = await db.updateKanbanBoard(editingBoard.id, { name: editingBoard.name, type: editingBoard.type, visible_to: editingBoard.visibleTo });
          if (!updatedBoard) { toast.error('Failed to update board'); return; }
          const replaced = await db.replaceKanbanColumns(editingBoard.id, normalizedColumns.map((col) => ({ title: col.title, status: col.status, color: col.color, sort_order: col.order })));
          if (!replaced) { toast.error('Failed to update board columns'); return; }
          const boardWithColumns = await db.getKanbanBoardWithColumns(editingBoard.id, effectiveCompanyId);
          savedBoard = {
            id: updatedBoard.id, name: updatedBoard.name, type: updatedBoard.type as KanbanBoard['type'],
            visibleTo: (updatedBoard.visible_to || editingBoard.visibleTo) as KanbanBoard['visibleTo'],
            createdBy: updatedBoard.created_by || editingBoard.createdBy, isDefault: updatedBoard.is_default,
            columns: boardWithColumns?.columns.map((col) => ({ id: col.id, title: col.title, status: col.status as CustomerStatus, color: col.color, order: col.sort_order })) || normalizedColumns,
          };
        }
      }
      if (isNewBoard) { dispatch({ type: 'ADD_BOARD', payload: savedBoard }); }
      else { dispatch({ type: 'UPDATE_BOARD', payload: savedBoard }); }
      dispatch({ type: 'SELECT_BOARD', payload: savedBoard.id });
      setShowBoardEditor(false);
      setEditingBoard(null);
      toast.success(isNewBoard ? 'Board created' : 'Board updated');
    } catch (error) {
      console.error('Error saving board:', error);
      toast.error('Failed to save board');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    if (state.boards.length <= 1) { toast.error('At least one board is required'); return; }
    if (!confirm('Are you sure you want to delete this board?')) return;
    try {
      if (effectiveCompanyId) {
        const deleted = await db.deleteKanbanBoard(boardId);
        if (!deleted) { toast.error('Failed to delete board'); return; }
      }
      const fallbackBoard = state.boards.find((b) => b.id !== boardId);
      dispatch({ type: 'DELETE_BOARD', payload: boardId });
      if (fallbackBoard) { dispatch({ type: 'SELECT_BOARD', payload: fallbackBoard.id }); }
      toast.success('Board deleted');
    } catch (error) {
      console.error('Error deleting board:', error);
      toast.error('Failed to delete board');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <div className="p-6 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setShowBoardSelector(!showBoardSelector)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {showAllBoards ? (
                  <><LayoutGrid size={16} className="text-indigo-600" /><span className="font-semibold text-indigo-700">All Boards</span></>
                ) : showCombinedSales ? (
                  <><Users size={16} className="text-blue-600" /><span className="font-semibold text-blue-700">Combined Sales</span></>
                ) : (
                  <span className="font-semibold text-gray-900">{currentBoard?.name || 'Select Board'}</span>
                )}
                <ChevronDown size={18} className="text-gray-500" />
              </button>

              {showBoardSelector && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50">
                  <div className="p-2 max-h-72 overflow-auto">
                    {state.boards.map((board) => (
                      <div key={board.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 group">
                        <button
                          onClick={() => { dispatch({ type: 'SELECT_BOARD', payload: board.id }); setShowAllBoards(false); setShowCombinedSales(false); setShowBoardSelector(false); }}
                          className="flex-1 text-left"
                        >
                          <span className={`font-medium ${!showAllBoards && !showCombinedSales && board.id === currentBoard?.id ? 'text-blue-600' : 'text-gray-700'}`}>{board.name}</span>
                          <span className="text-xs text-gray-400 ml-2 capitalize">{board.type}</span>
                        </button>
                        {canEdit && !board.isDefault && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); setEditingBoard(board); setShowBoardEditor(true); setShowBoardSelector(false); }} className="p-1 hover:bg-gray-200 rounded">
                              <Edit2 size={14} className="text-gray-500" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteBoard(board.id); }} className="p-1 hover:bg-red-100 rounded">
                              <Trash2 size={14} className="text-red-500" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-100 p-2">
                    <button
                      onClick={() => { setShowCombinedSales(true); setShowAllBoards(false); setShowBoardSelector(false); }}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors ${showCombinedSales ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      <Users size={16} /><span className="font-medium">Combined Sales View</span>
                    </button>
                    <button
                      onClick={() => { setShowAllBoards(true); setShowCombinedSales(false); setShowBoardSelector(false); }}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors ${showAllBoards ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      <LayoutGrid size={16} /><span className="font-medium">View All Boards</span>
                    </button>
                  </div>
                  {canCreate && (
                    <div className="border-t border-gray-100 p-2">
                      <button
                        onClick={() => { handleCreateBoard(); setShowBoardSelector(false); }}
                        className="w-full flex items-center gap-2 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Plus size={18} /><span className="font-medium">Create New Board</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="text-sm text-gray-500">{state.contacts.length} contacts in pipeline</div>
          </div>

          <div className="flex items-center gap-2">
            {/* ── Owner Priority Toggle ── */}
            <button
              onClick={() => setShowPriorityPanel(!showPriorityPanel)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                showPriorityPanel
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300'
              }`}
              title="Toggle Needs Attention panel"
            >
              <AlertTriangle size={15} />
              Needs Attention
            </button>
            <button
              onClick={() => dispatch({ type: 'TOGGLE_QUICK_ADD' })}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} /><span className="font-medium">Add Contact</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Owner Priority Panel ─────────────────────────────────── */}
      {showPriorityPanel && (
        <div className="border-b border-amber-100 bg-amber-50/40 max-h-80 overflow-y-auto">
          <OwnerPriorityBoard />
        </div>
      )}

      {/* ── Kanban Board ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto p-6 bg-gray-50">
        {showCombinedSales ? (
          <div className="flex gap-4 h-full min-w-max">
            {combinedSalesColumns.map((column) => {
              const contacts = getColumnContacts(column);
              const columnValue = contacts.reduce((sum, c) => {
                if (c.projectValue && c.projectValue > 0) return sum + c.projectValue;
                const bestEstimate = state.estimates.filter(e => e.contactId === c.id && e.status !== 'declined').reduce((max, e) => Math.max(max, Number(e.total || 0)), 0);
                return sum + bestEstimate;
              }, 0);
              return (
                <div
                  key={column.id}
                  className={`w-80 flex-shrink-0 flex flex-col bg-gray-100 rounded-xl transition-colors ${dragOverColumn === column.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
                  onDragOver={(e) => handleDragOver(e, column.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column)}
                >
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: column.color }} />
                      <h3 className="font-semibold text-gray-900">{column.title}</h3>
                      <span className="px-2 py-0.5 bg-gray-200 rounded-full text-xs font-medium text-gray-600">{contacts.length}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{formatCurrency(columnValue)}</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {contacts.map((contact) => {
                      const assignee = state.teamMembers.find((tm) => tm.id === contact.assignedTo);
                      const stageAlert = getStageAlert(contact);
                      return (
                        <div
                          key={contact.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, contact)}
                          onClick={() => handleContactClick(contact.id)}
                          className={`bg-white rounded-lg p-4 shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-all group ${draggedContact?.id === contact.id ? 'opacity-50' : ''}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <GripVertical size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                                <h4 className="font-medium text-gray-900 truncate">{getContactFullName(contact)}</h4>
                              </div>
                              {contact.projectType && <p className="text-sm text-gray-500 mt-1 truncate">{contact.projectType}</p>}
                            </div>
                            {assignee && <img src={assignee.avatar} alt={assignee.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" title={assignee.name} />}
                          </div>
                          <div className="mt-3 space-y-1.5">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <MapPin size={12} /><span className="truncate">{contact.city}, {contact.state}</span>
                            </div>
                            {contact.projectValue && (
                              <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
                                <DollarSign size={12} /><span>{formatCurrency(contact.projectValue)}</span>
                              </div>
                            )}
                          </div>
                          {contact.tags.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {contact.tags.slice(0, 2).map((tag) => (
                                <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{tag}</span>
                              ))}
                              {contact.tags.length > 2 && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">+{contact.tags.length - 2}</span>}
                            </div>
                          )}
                          {contact.inspectionCompleted && (
                            <div className="mt-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle size={10} />Inspection Complete
                              </span>
                            </div>
                          )}
                          {stageAlert && (
                            <div className="mt-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${stageAlert.className}`}>⚠ {stageAlert.label} in stage</span>
                            </div>
                          )}
                          {(() => {
                            const ns = getNextStep(contact.status as KanbanStatus);
                            if (!ns) return null;
                            const Icon = NEXT_STEP_ICONS[ns.iconName] || ArrowRight;
                            return (
                              <button
                                onClick={(e) => handleNextStepClick(e, contact, ns)}
                                className={`mt-3 w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-75 ${ns.bgColor} ${ns.textColor}`}
                              >
                                <Icon size={12} className="flex-shrink-0" />
                                <span className="truncate">{ns.label}</span>
                                <ArrowRight size={12} className="ml-auto flex-shrink-0 opacity-60" />
                              </button>
                            );
                          })()}
                        </div>
                      );
                    })}
                    {contacts.length === 0 && (
                      <div className="text-center py-8 text-gray-400"><p className="text-sm">No contacts</p></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : showAllBoards ? (
          <div className="flex flex-col gap-8 h-full">
            {state.boards.map((board) => (
              <div key={board.id}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <LayoutGrid size={16} className="text-indigo-500" />
                    <h2 className="font-bold text-gray-800 text-base">{board.name}</h2>
                    <span className="text-xs text-gray-400 capitalize">({board.type})</span>
                  </div>
                  <div className="flex-1 h-px bg-gray-200" />
                  <button onClick={() => { dispatch({ type: 'SELECT_BOARD', payload: board.id }); setShowAllBoards(false); }} className="text-xs text-blue-600 hover:underline">View only</button>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {board.columns.map((column) => {
                    const contacts = getColumnContacts(column);
                    const columnValue = contacts.reduce((sum, c) => {
                      if (c.projectValue && c.projectValue > 0) return sum + c.projectValue;
                      const bestEstimate = state.estimates.filter(e => e.contactId === c.id && e.status !== 'declined').reduce((max, e) => Math.max(max, Number(e.total || 0)), 0);
                      return sum + bestEstimate;
                    }, 0);
                    return (
                      <div
                        key={column.id}
                        className={`w-72 flex-shrink-0 flex flex-col bg-gray-100 rounded-xl transition-colors ${dragOverColumn === column.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
                        onDragOver={(e) => handleDragOver(e, column.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, column)}
                      >
                        <div className="p-3 border-b border-gray-200">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: column.color }} />
                            <h3 className="font-semibold text-gray-900 text-sm">{column.title}</h3>
                            <span className="px-1.5 py-0.5 bg-gray-200 rounded-full text-xs font-medium text-gray-600">{contacts.length}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{formatCurrency(columnValue)}</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-64">
                          {contacts.map((contact) => {
                            const assignee = state.teamMembers.find((tm) => tm.id === contact.assignedTo);
                            const stageAlert = getStageAlert(contact);
                            return (
                              <div
                                key={contact.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, contact)}
                                onClick={() => handleContactClick(contact.id)}
                                className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-100"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-gray-900 text-sm truncate">{getContactFullName(contact)}</p>
                                    {contact.projectValue ? <p className="text-xs font-semibold text-green-600">{formatCurrency(contact.projectValue)}</p> : null}
                                    {contact.address && <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 truncate"><MapPin size={10} />{contact.address}</p>}
                                  </div>
                                  {stageAlert && <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${stageAlert.className}`}>{stageAlert.label}</span>}
                                </div>
                                {contact.inspectionCompleted && (
                                  <div className="mt-1.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <CheckCircle size={9} />Inspection Complete
                                    </span>
                                  </div>
                                )}
                                {assignee && <p className="text-xs text-gray-400 mt-1">{assignee.name}</p>}
                                {(() => {
                                  const ns = getNextStep(contact.status as KanbanStatus);
                                  if (!ns) return null;
                                  const Icon = NEXT_STEP_ICONS[ns.iconName] || ArrowRight;
                                  return (
                                    <button
                                      onClick={(e) => handleNextStepClick(e, contact, ns)}
                                      className={`mt-2 w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold transition-opacity hover:opacity-75 ${ns.bgColor} ${ns.textColor}`}
                                    >
                                      <Icon size={10} className="flex-shrink-0" />
                                      <span className="truncate">{ns.label}</span>
                                      <ArrowRight size={10} className="ml-auto flex-shrink-0" />
                                    </button>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4 h-full min-w-max">
            {currentBoard?.columns.map((column) => {
              const contacts = getColumnContacts(column);
              const columnValue = contacts.reduce((sum, c) => {
                if (c.projectValue && c.projectValue > 0) return sum + c.projectValue;
                const bestEstimate = state.estimates.filter(e => e.contactId === c.id && e.status !== 'declined').reduce((max, e) => Math.max(max, Number(e.total || 0)), 0);
                return sum + bestEstimate;
              }, 0);
              return (
                <div
                  key={column.id}
                  className={`w-80 flex-shrink-0 flex flex-col bg-gray-100 rounded-xl transition-colors ${dragOverColumn === column.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
                  onDragOver={(e) => handleDragOver(e, column.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column)}
                >
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: column.color }} />
                        <h3 className="font-semibold text-gray-900">{column.title}</h3>
                        <span className="px-2 py-0.5 bg-gray-200 rounded-full text-xs font-medium text-gray-600">{contacts.length}</span>
                      </div>
                      <button
                        onClick={() => {
                          if (canEdit && currentBoard) { setEditingBoard(currentBoard); setShowBoardEditor(true); }
                          else { toast.info('Board editing requires manager, admin, or owner access'); }
                        }}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                      >
                        <MoreVertical size={16} className="text-gray-400" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{formatCurrency(columnValue)}</p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {contacts.map((contact) => {
                      const assignee = state.teamMembers.find((tm) => tm.id === contact.assignedTo);
                      const stageAlert = getStageAlert(contact);
                      return (
                        <div
                          key={contact.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, contact)}
                          onClick={() => handleContactClick(contact.id)}
                          className={`bg-white rounded-lg p-4 shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-all group ${draggedContact?.id === contact.id ? 'opacity-50' : ''}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <GripVertical size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                                <h4 className="font-medium text-gray-900 truncate">{getContactFullName(contact)}</h4>
                              </div>
                              {contact.projectType && <p className="text-sm text-gray-500 mt-1 truncate">{contact.projectType}</p>}
                            </div>
                            {assignee && <img src={assignee.avatar} alt={assignee.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" title={assignee.name} />}
                          </div>
                          <div className="mt-3 space-y-1.5">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <MapPin size={12} /><span className="truncate">{contact.city}, {contact.state}</span>
                            </div>
                            {contact.projectValue && (
                              <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
                                <DollarSign size={12} /><span>{formatCurrency(contact.projectValue)}</span>
                              </div>
                            )}
                          </div>
                          {contact.tags.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {contact.tags.slice(0, 2).map((tag) => (
                                <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{tag}</span>
                              ))}
                              {contact.tags.length > 2 && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">+{contact.tags.length - 2}</span>}
                            </div>
                          )}
                          {stageAlert && (
                            <div className="mt-2 flex items-center justify-between">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${stageAlert.className}`}>⚠ {stageAlert.label} in stage</span>
                            </div>
                          )}
                          {(() => {
                            const ns = getNextStep(contact.status as KanbanStatus);
                            if (!ns) return null;
                            const Icon = NEXT_STEP_ICONS[ns.iconName] || ArrowRight;
                            return (
                              <button
                                onClick={(e) => handleNextStepClick(e, contact, ns)}
                                className={`mt-3 w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-75 ${ns.bgColor} ${ns.textColor}`}
                              >
                                <Icon size={12} className="flex-shrink-0" />
                                <span className="truncate">{ns.label}</span>
                                <ArrowRight size={12} className="ml-auto flex-shrink-0 opacity-60" />
                              </button>
                            );
                          })()}
                          {currentBoard?.type === 'production' && column.status === 'signed' && (
                            <button
                              onClick={(e) => handleAcknowledgeClick(e, contact)}
                              className="mt-3 w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 hover:opacity-75 transition-opacity border border-amber-200"
                            >
                              <Package size={12} className="flex-shrink-0" />
                              <span className="truncate">Acknowledge & Order Materials</span>
                              <ArrowRight size={12} className="ml-auto flex-shrink-0 opacity-60" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {contacts.length === 0 && (
                      <div className="text-center py-8 text-gray-400"><p className="text-sm">No contacts</p></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Board Editor Modal ───────────────────────────────────── */}
      {showBoardEditor && editingBoard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">{state.boards.find((b) => b.id === editingBoard.id) ? 'Edit Board' : 'Create Board'}</h2>
              <button onClick={() => { setShowBoardEditor(false); setEditingBoard(null); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Board Name</label>
                <input
                  type="text"
                  value={editingBoard.name}
                  onChange={(e) => setEditingBoard({ ...editingBoard, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Columns</label>
                <div className="space-y-3">
                  {editingBoard.columns.map((col, index) => (
                    <div key={col.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex flex-col gap-1">
                        <button onClick={() => moveColumn(index, index - 1)} disabled={index === 0} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30" title="Move up"><ArrowUp size={12} className="text-gray-500" /></button>
                        <button onClick={() => moveColumn(index, index + 1)} disabled={index === editingBoard.columns.length - 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30" title="Move down"><ArrowDown size={12} className="text-gray-500" /></button>
                      </div>
                      <input type="color" value={col.color} onChange={(e) => { const next = [...editingBoard.columns]; next[index] = { ...col, color: e.target.value }; setEditingBoard({ ...editingBoard, columns: next }); }} className="w-8 h-8 rounded cursor-pointer" />
                      <input type="text" value={col.title} onChange={(e) => { const next = [...editingBoard.columns]; next[index] = { ...col, title: e.target.value }; setEditingBoard({ ...editingBoard, columns: next }); }} className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                      <select value={col.status} onChange={(e) => { const next = [...editingBoard.columns]; next[index] = { ...col, status: e.target.value as CustomerStatus }; setEditingBoard({ ...editingBoard, columns: next }); }} className="px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none">
                        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <button onClick={() => { if (editingBoard.columns.length <= 1) { toast.error('At least one column is required'); return; } const next = editingBoard.columns.filter((c) => c.id !== col.id).map((c, i) => ({ ...c, order: i })); setEditingBoard({ ...editingBoard, columns: next }); }} className="p-1.5 hover:bg-red-100 rounded transition-colors"><Trash2 size={16} className="text-red-500" /></button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { const newColumn: KanbanColumn = { id: `col-${Date.now()}`, title: 'New Column', status: 'lead', color: '#6366f1', order: editingBoard.columns.length }; setEditingBoard({ ...editingBoard, columns: [...editingBoard.columns, newColumn] }); }}
                  className="mt-3 flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus size={18} />Add Column
                </button>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => { setShowBoardEditor(false); setEditingBoard(null); }} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium">Cancel</button>
              <button onClick={handleSaveBoard} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50">
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}Save Board
              </button>
            </div>
          </div>
        </div>
      )}

      {showBoardSelector && <div className="fixed inset-0 z-40" onClick={() => setShowBoardSelector(false)} />}
    </div>
  );
}

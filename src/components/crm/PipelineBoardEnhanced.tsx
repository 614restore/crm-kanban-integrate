import React, { useState } from 'react';
import { useCRM, useCurrentBoard, canCreateBoard, canEditBoard } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { toast } from 'sonner';
import { fireAutomationEvent } from '@/lib/automationEngine';
import { handleAutoProgression } from '@/lib/progressionRules';
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
  Clock,
  UserX,
  Phone,
} from 'lucide-react';

interface ContactAlert {
  type: 'stale' | 'unassigned' | 'no-contact' | 'missing-value';
  label: string;
  icon: React.ReactNode;
  className: string;
  priority: number;
}

function getContactAlerts(contact: Contact): ContactAlert[] {
  const alerts: ContactAlert[] = [];
  const since = contact.statusChangedAt || contact.updatedAt || contact.createdAt;
  if (since) {
    const days = Math.floor((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60 * 24));
    if (days >= 21) {
      alerts.push({ type: 'stale', label: `${days}d`, icon: <Clock size={12} />, className: 'bg-red-100 text-red-700 border border-red-300', priority: 1 });
    } else if (days >= 14) {
      alerts.push({ type: 'stale', label: `${days}d`, icon: <Clock size={12} />, className: 'bg-orange-100 text-orange-700 border border-orange-300', priority: 2 });
    } else if (days >= 7) {
      alerts.push({ type: 'stale', label: `${days}d`, icon: <Clock size={12} />, className: 'bg-yellow-100 text-yellow-700 border border-yellow-300', priority: 3 });
    }
  }
  if (!contact.assignedTo) {
    alerts.push({ type: 'unassigned', label: 'No owner', icon: <UserX size={12} />, className: 'bg-purple-100 text-purple-700 border border-purple-300', priority: 2 });
  }
  if (!contact.phone1 && !contact.email) {
    alerts.push({ type: 'no-contact', label: 'No contact', icon: <Phone size={12} />, className: 'bg-amber-100 text-amber-700 border border-amber-300', priority: 3 });
  }
  if (!contact.projectValue && contact.status !== 'lead' && contact.status !== 'new') {
    alerts.push({ type: 'missing-value', label: 'No value', icon: <DollarSign size={12} />, className: 'bg-blue-100 text-blue-700 border border-blue-300', priority: 4 });
  }
  return alerts.sort((a, b) => a.priority - b.priority);
}

export default function PipelineBoardEnhanced() {
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
  const [showPriorityPanel, setShowPriorityPanel] = useState(false);

  const userRole = (state.currentUser?.role || profile?.role || 'owner') as any;
  const canCreate = canCreateBoard(userRole);
  const canEdit = canEditBoard(userRole);
  const effectiveCompanyId = profile?.company_id || state.companyId || null;

  const getColumnContacts = (column: KanbanColumn): Contact[] => state.contacts.filter((c) => c.status === column.status);

  const handleDragStart = (e: React.DragEvent, contact: Contact) => {
    setDraggedContact(contact);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDrop = async (e: React.DragEvent, column: KanbanColumn) => {
    e.preventDefault();
    if (draggedContact && draggedContact.status !== column.status) {
      const oldStatus = draggedContact.status;
      try {
        if (effectiveCompanyId) await db.updateContact(draggedContact.id, { status: column.status, status_changed_at: new Date().toISOString() });
        dispatch({ type: 'UPDATE_CONTACT_STATUS', payload: { contactId: draggedContact.id, status: column.status } });
        if (effectiveCompanyId) {
          fireAutomationEvent('contact_status_changed', effectiveCompanyId, {
            contactId: draggedContact.id,
            contactName: getContactFullName(draggedContact),
            contactEmail: draggedContact.email,
            oldStatus,
            newStatus: column.status,
          }).catch(() => {});
          handleAutoProgression(
            draggedContact.id,
            column.status,
            effectiveCompanyId,
            profile?.id || '',
            profile?.email || ''
          ).catch(() => {});
        }
      } catch (error) {
        toast.error('Failed to move contact');
      }
    }
    setDraggedContact(null);
    setDragOverColumn(null);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold text-gray-900">{currentBoard?.name || 'Pipeline'}</h2>
            <div className="text-sm text-gray-500">{state.contacts.length} contacts</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPriorityPanel(!showPriorityPanel)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${showPriorityPanel ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-amber-50'}`}>
              <AlertTriangle size={15} />Needs Attention
            </button>
            <button onClick={() => dispatch({ type: 'TOGGLE_QUICK_ADD' })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus size={18} />Add Contact
            </button>
          </div>
        </div>
      </div>

      {showPriorityPanel && <div className="border-b border-amber-100 bg-amber-50/40 max-h-80 overflow-y-auto"><OwnerPriorityBoard /></div>}

      <div className="flex-1 overflow-x-auto p-6 bg-gray-50">
        <div className="flex gap-4 h-full min-w-max">
          {currentBoard?.columns.map((column) => {
            const contacts = getColumnContacts(column);
            return (
              <div key={column.id} className={`w-80 flex-shrink-0 flex flex-col bg-gray-100 rounded-xl ${dragOverColumn === column.id ? 'ring-2 ring-blue-500' : ''}`} onDragOver={(e) => handleDragOver(e, column.id)} onDrop={(e) => handleDrop(e, column)}>
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: column.color }} />
                    <h3 className="font-semibold text-gray-900">{column.title}</h3>
                    <span className="px-2 py-0.5 bg-gray-200 rounded-full text-xs font-medium">{contacts.length}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {contacts.map((contact) => {
                    const alerts = getContactAlerts(contact);
                    const borderColor = alerts[0]?.type === 'stale' && alerts[0].priority === 1 ? 'border-l-red-500' : alerts[0]?.type === 'stale' && alerts[0].priority === 2 ? 'border-l-orange-500' : alerts[0]?.type === 'unassigned' ? 'border-l-purple-500' : 'border-gray-200';
                    return (
                      <div key={contact.id} draggable onDragStart={(e) => handleDragStart(e, contact)} onClick={() => dispatch({ type: 'SELECT_CONTACT', payload: contact.id })} className={`bg-white rounded-lg p-4 shadow-sm border cursor-pointer hover:shadow-md transition-all ${alerts.length > 0 ? `border-l-4 ${borderColor}` : 'border-gray-200'}`}>
                        <div className="flex items-start justify-between">
                          <h4 className="font-medium text-gray-900 truncate">{getContactFullName(contact)}</h4>
                        </div>
                        {contact.projectValue && <p className="text-xs text-green-600 font-medium mt-1">{formatCurrency(contact.projectValue)}</p>}
                        {alerts.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {alerts.slice(0, 2).map((alert, idx) => (
                              <span key={idx} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${alert.className}`}>{alert.icon}{alert.label}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

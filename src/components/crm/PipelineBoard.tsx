import React, { useState } from 'react';
import { useCRM, useCurrentBoard, canCreateBoard, canEditBoard } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import {
  Contact,
  KanbanBoard,
  KanbanColumn,
  CustomerStatus,
  statusLabels,
  formatCurrency,
  getTeamMemberById,
  getContactFullName,
} from '@/lib/crmData';
import {
  Plus,
  MoreVertical,
  GripVertical,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Calendar,
  Edit2,
  Trash2,
  ChevronDown,
  X,
  Save,
  Loader2,
} from 'lucide-react';

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

  const userRole = state.currentUser?.role || 'sales';
  const canCreate = canCreateBoard(userRole);
  const canEdit = canEditBoard(userRole);

  // Get contacts for each column
  const getColumnContacts = (column: KanbanColumn): Contact[] => {
    return state.contacts.filter((c) => c.status === column.status);
  };

  // Drag handlers
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
        // Update in database if user has company
        if (profile?.company_id) {
          await db.updateContact(draggedContact.id, { status: column.status });
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
      } catch (error) {
        console.error('Error updating contact status:', error);
      }
    }
    setDraggedContact(null);
    setDragOverColumn(null);
  };

  const handleContactClick = (contactId: string) => {
    dispatch({ type: 'SELECT_CONTACT', payload: contactId });
  };

  const handleCreateBoard = () => {
    const newBoard: KanbanBoard = {
      id: `board-${Date.now()}`,
      name: 'New Board',
      type: 'custom',
      visibleTo: ['owner', 'manager', 'admin'],
      createdBy: state.currentUser?.id || 'unknown',
      isDefault: false,
      columns: [
        { id: `col-${Date.now()}-1`, title: 'New', status: 'lead', color: '#3b82f6', order: 0 },
        { id: `col-${Date.now()}-2`, title: 'In Progress', status: 'in_progress', color: '#8b5cf6', order: 1 },
        { id: `col-${Date.now()}-3`, title: 'Done', status: 'completed', color: '#22c55e', order: 2 },
      ],
    };
    setEditingBoard(newBoard);
    setShowBoardEditor(true);
  };

  const handleSaveBoard = async () => {
    if (!editingBoard) return;

    setIsSaving(true);
    try {
      const isNewBoard = !state.boards.find((b) => b.id === editingBoard.id);

      if (profile?.company_id && isNewBoard) {
        // Create in database
        await db.createKanbanBoard(
          {
            company_id: profile.company_id,
            name: editingBoard.name,
            type: editingBoard.type,
            visible_to: editingBoard.visibleTo,
            created_by: profile.id,
            is_default: false,
          },
          editingBoard.columns.map((col) => ({
            title: col.title,
            status: col.status,
            color: col.color,
            sort_order: col.order,
          }))
        );
      }

      if (isNewBoard) {
        dispatch({ type: 'ADD_BOARD', payload: editingBoard });
      } else {
        dispatch({ type: 'UPDATE_BOARD', payload: editingBoard });
      }
      dispatch({ type: 'SELECT_BOARD', payload: editingBoard.id });
      setShowBoardEditor(false);
      setEditingBoard(null);
    } catch (error) {
      console.error('Error saving board:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    if (confirm('Are you sure you want to delete this board?')) {
      try {
        if (profile?.company_id) {
          await db.deleteKanbanBoard(boardId);
        }
        dispatch({ type: 'DELETE_BOARD', payload: boardId });
      } catch (error) {
        console.error('Error deleting board:', error);
      }
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Board Header */}
      <div className="p-6 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Board Selector */}
            <div className="relative">
              <button
                onClick={() => setShowBoardSelector(!showBoardSelector)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <span className="font-semibold text-gray-900">{currentBoard?.name || 'Select Board'}</span>
                <ChevronDown size={18} className="text-gray-500" />
              </button>

              {showBoardSelector && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50">
                  <div className="p-2">
                    {state.boards.map((board) => (
                      <div
                        key={board.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 group"
                      >
                        <button
                          onClick={() => {
                            dispatch({ type: 'SELECT_BOARD', payload: board.id });
                            setShowBoardSelector(false);
                          }}
                          className="flex-1 text-left"
                        >
                          <span
                            className={`font-medium ${
                              board.id === currentBoard?.id ? 'text-blue-600' : 'text-gray-700'
                            }`}
                          >
                            {board.name}
                          </span>
                          <span className="text-xs text-gray-400 ml-2 capitalize">{board.type}</span>
                        </button>
                        {canEdit && !board.isDefault && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingBoard(board);
                                setShowBoardEditor(true);
                                setShowBoardSelector(false);
                              }}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              <Edit2 size={14} className="text-gray-500" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteBoard(board.id);
                              }}
                              className="p-1 hover:bg-red-100 rounded"
                            >
                              <Trash2 size={14} className="text-red-500" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {canCreate && (
                    <div className="border-t border-gray-100 p-2">
                      <button
                        onClick={() => {
                          handleCreateBoard();
                          setShowBoardSelector(false);
                        }}
                        className="w-full flex items-center gap-2 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Plus size={18} />
                        <span className="font-medium">Create New Board</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="text-sm text-gray-500">
              {state.contacts.length} contacts in pipeline
            </div>
          </div>

          <button
            onClick={() => dispatch({ type: 'TOGGLE_QUICK_ADD' })}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            <span className="font-medium">Add Contact</span>
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-6 bg-gray-50">
        <div className="flex gap-4 h-full min-w-max">
          {currentBoard?.columns.map((column) => {
            const contacts = getColumnContacts(column);
            const columnValue = contacts.reduce((sum, c) => sum + (c.projectValue || 0), 0);

            return (
              <div
                key={column.id}
                className={`w-80 flex-shrink-0 flex flex-col bg-gray-100 rounded-xl transition-colors ${
                  dragOverColumn === column.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                }`}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column)}
              >
                {/* Column Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: column.color }}
                      />
                      <h3 className="font-semibold text-gray-900">{column.title}</h3>
                      <span className="px-2 py-0.5 bg-gray-200 rounded-full text-xs font-medium text-gray-600">
                        {contacts.length}
                      </span>
                    </div>
                    <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                      <MoreVertical size={16} className="text-gray-400" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{formatCurrency(columnValue)}</p>
                </div>

                {/* Column Content */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {contacts.map((contact) => {
                    const assignee = state.teamMembers.find(tm => tm.id === contact.assignedTo) || getTeamMemberById(contact.assignedTo);
                    return (
                      <div
                        key={contact.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, contact)}
                        onClick={() => handleContactClick(contact.id)}
                        className={`bg-white rounded-lg p-4 shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-all group ${
                          draggedContact?.id === contact.id ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <GripVertical
                                size={14}
                                className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab"
                              />
                              <h4 className="font-medium text-gray-900 truncate">
                                {getContactFullName(contact)}
                              </h4>
                            </div>
                            {contact.projectType && (
                              <p className="text-sm text-gray-500 mt-1 truncate">
                                {contact.projectType}
                              </p>
                            )}
                          </div>
                          {assignee && (
                            <img
                              src={assignee.avatar}
                              alt={assignee.name}
                              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                              title={assignee.name}
                            />
                          )}
                        </div>

                        <div className="mt-3 space-y-1.5">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <MapPin size={12} />
                            <span className="truncate">
                              {contact.city}, {contact.state}
                            </span>
                          </div>
                          {contact.projectValue && (
                            <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
                              <DollarSign size={12} />
                              <span>{formatCurrency(contact.projectValue)}</span>
                            </div>
                          )}
                        </div>

                        {contact.tags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {contact.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                            {contact.tags.length > 2 && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                +{contact.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {contacts.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-sm">No contacts</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Board Editor Modal */}
      {showBoardEditor && editingBoard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {state.boards.find((b) => b.id === editingBoard.id) ? 'Edit Board' : 'Create Board'}
              </h2>
              <button
                onClick={() => {
                  setShowBoardEditor(false);
                  setEditingBoard(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
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
                      <GripVertical size={16} className="text-gray-400 cursor-grab" />
                      <input
                        type="color"
                        value={col.color}
                        onChange={(e) => {
                          const newColumns = [...editingBoard.columns];
                          newColumns[index] = { ...col, color: e.target.value };
                          setEditingBoard({ ...editingBoard, columns: newColumns });
                        }}
                        className="w-8 h-8 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={col.title}
                        onChange={(e) => {
                          const newColumns = [...editingBoard.columns];
                          newColumns[index] = { ...col, title: e.target.value };
                          setEditingBoard({ ...editingBoard, columns: newColumns });
                        }}
                        className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                      <select
                        value={col.status}
                        onChange={(e) => {
                          const newColumns = [...editingBoard.columns];
                          newColumns[index] = { ...col, status: e.target.value as CustomerStatus };
                          setEditingBoard({ ...editingBoard, columns: newColumns });
                        }}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      >
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const newColumns = editingBoard.columns.filter((c) => c.id !== col.id);
                          setEditingBoard({ ...editingBoard, columns: newColumns });
                        }}
                        className="p-1.5 hover:bg-red-100 rounded transition-colors"
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const newColumn: KanbanColumn = {
                      id: `col-${Date.now()}`,
                      title: 'New Column',
                      status: 'lead',
                      color: '#6366f1',
                      order: editingBoard.columns.length,
                    };
                    setEditingBoard({
                      ...editingBoard,
                      columns: [...editingBoard.columns, newColumn],
                    });
                  }}
                  className="mt-3 flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus size={18} />
                  Add Column
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowBoardEditor(false);
                  setEditingBoard(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBoard}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Save Board
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close board selector */}
      {showBoardSelector && (
        <div className="fixed inset-0 z-40" onClick={() => setShowBoardSelector(false)} />
      )}
    </div>
  );
}

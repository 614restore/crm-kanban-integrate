import React, { useState } from 'react';
import { CheckCircle, Circle, Plus, X, User, Clock } from 'lucide-react';

export interface ChecklistItem {
  id: string;
  description: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
}

interface CompletionChecklistProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  currentUserId?: string;
  currentUserName?: string;
}

const DEFAULT_ITEMS: Omit<ChecklistItem, 'id'>[] = [
  { description: 'Magnet sweep completed', completed: false },
  { description: 'Yard cleaned and debris removed', completed: false },
  { description: 'All materials hauled away', completed: false },
  { description: 'Customer walkthrough completed', completed: false },
  { description: 'Final inspection passed', completed: false },
  { description: 'Site left clean and professional', completed: false },
];

export default function CompletionChecklist({
  items,
  onChange,
  currentUserId,
  currentUserName,
}: CompletionChecklistProps) {
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemText, setNewItemText] = useState('');

  // Initialize with default items if empty
  React.useEffect(() => {
    if (items.length === 0) {
      onChange(DEFAULT_ITEMS.map((item, idx) => ({ ...item, id: `check-${idx}` })));
    }
  }, []);

  const handleToggle = (itemId: string) => {
    const updatedItems = items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            completed: !item.completed,
            completedBy: !item.completed ? currentUserName || currentUserId : undefined,
            completedAt: !item.completed ? new Date().toISOString() : undefined,
          }
        : item
    );
    onChange(updatedItems);
  };

  const handleAddItem = () => {
    if (!newItemText.trim()) return;
    const newItem: ChecklistItem = {
      id: `check-${Date.now()}`,
      description: newItemText.trim(),
      completed: false,
    };
    onChange([...items, newItem]);
    setNewItemText('');
    setShowAddItem(false);
  };

  const handleRemoveItem = (itemId: string) => {
    onChange(items.filter((item) => item.id !== itemId));
  };

  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Completion Checklist</span>
          <span className="text-sm text-gray-600">
            {completedCount} of {totalCount} completed
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Checklist Items */}
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
              item.completed
                ? 'bg-green-50 border-green-200'
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <button
              onClick={() => handleToggle(item.id)}
              className="flex-shrink-0 mt-0.5"
            >
              {item.completed ? (
                <CheckCircle size={20} className="text-green-600" />
              ) : (
                <Circle size={20} className="text-gray-400 hover:text-gray-600" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <p
                className={`text-sm ${
                  item.completed
                    ? 'text-gray-600 line-through'
                    : 'text-gray-900 font-medium'
                }`}
              >
                {item.description}
              </p>
              {item.completed && (item.completedBy || item.completedAt) && (
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {item.completedBy && (
                    <span className="flex items-center gap-1">
                      <User size={12} />
                      {item.completedBy}
                    </span>
                  )}
                  {item.completedAt && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(item.completedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </div>

            {!DEFAULT_ITEMS.some((d) => d.description === item.description) && (
              <button
                onClick={() => handleRemoveItem(item.id)}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 rounded"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add Custom Item */}
      {showAddItem ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
            placeholder="Enter checklist item..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            autoFocus
          />
          <button
            onClick={handleAddItem}
            className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
          >
            Add
          </button>
          <button
            onClick={() => {
              setShowAddItem(false);
              setNewItemText('');
            }}
            className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAddItem(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Add Custom Item
        </button>
      )}

      {/* Completion Status */}
      {completedCount === totalCount && totalCount > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
          <span className="text-sm font-medium text-green-800">
            All checklist items completed! Work order is ready for final review.
          </span>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import {
  defaultPermissions,
  getUserPermissions,
  permissionCategoryLabels,
  permissionLevelLabels,
  permissionLevelOrder,
  type PermissionCategory,
  type PermissionLevel,
  type UserRole,
} from '../../lib/permissions';
import { Shield, Info, RotateCcw, Save, X } from 'lucide-react';

interface PermissionsEditorProps {
  userId: string;
  userName: string;
  role: UserRole;
  customPermissions?: Partial<Record<PermissionCategory, PermissionLevel>>;
  onSave: (permissions: Partial<Record<PermissionCategory, PermissionLevel>>) => Promise<void>;
  onClose: () => void;
}

export default function PermissionsEditor({
  userId,
  userName,
  role,
  customPermissions,
  onSave,
  onClose,
}: PermissionsEditorProps) {
  const [permissions, setPermissions] = useState<Partial<Record<PermissionCategory, PermissionLevel>>>(
    customPermissions || {}
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const currentPermissions = getUserPermissions(role, permissions);
  const defaultRolePermissions = defaultPermissions[role];

  const categories: PermissionCategory[] = [
    'users_roles',
    'contacts_leads',
    'jobs_workflows',
    'estimates_quotes',
    'contracts',
    'scheduling_calendar',
    'tasks_assignments',
    'photos_files',
    'materials_inventory',
    'invoicing',
    'payments',
    'reports_dashboards',
    'integrations',
    'communications',
    'settings_configs',
  ];

  const handlePermissionChange = (category: PermissionCategory, level: PermissionLevel) => {
    setPermissions((prev) => ({
      ...prev,
      [category]: level,
    }));
  };

  const handleResetCategory = (category: PermissionCategory) => {
    setPermissions((prev) => {
      const newPerms = { ...prev };
      delete newPerms[category];
      return newPerms;
    });
  };

  const handleResetAll = () => {
    setPermissions({});
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(permissions);
      onClose();
    } catch (error) {
      console.error('Failed to save permissions:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const isModified = (category: PermissionCategory) => {
    return permissions[category] !== undefined;
  };

  const hasAnyModifications = Object.keys(permissions).length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="text-blue-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">User Permissions</h2>
              <p className="text-sm text-gray-500">{userName} - {role}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Info Banner */}
        <div className="p-4 bg-blue-50 border-b border-blue-100">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="flex items-center gap-2 text-blue-900 text-sm font-medium"
          >
            <Info size={16} />
            Understanding Permissions
          </button>
          {showInfo && (
            <div className="mt-2 text-sm text-blue-800 space-y-1">
              <p><strong>Default:</strong> Permissions based on user's role</p>
              <p><strong>Custom:</strong> Override specific permissions for this user</p>
              <p><strong>Modified:</strong> Permissions that differ from role defaults (highlighted)</p>
            </div>
          )}
        </div>

        {/* Permissions Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {categories.map((category) => {
              const currentLevel = currentPermissions[category];
              const defaultLevel = defaultRolePermissions[category];
              const modified = isModified(category);

              return (
                <div
                  key={category}
                  className={`border rounded-lg p-4 ${
                    modified ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {permissionCategoryLabels[category]}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Default for {role}: <span className="font-medium">{permissionLevelLabels[defaultLevel]}</span>
                        {modified && (
                          <span className="ml-2 text-amber-600">• Modified</span>
                        )}
                      </p>
                    </div>
                    {modified && (
                      <button
                        onClick={() => handleResetCategory(category)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-amber-700 hover:bg-amber-100 rounded transition-colors"
                      >
                        <RotateCcw size={12} />
                        Reset
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {permissionLevelOrder.map((level) => (
                      <button
                        key={level}
                        onClick={() => handlePermissionChange(category, level)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          currentLevel === level
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {permissionLevelLabels[level]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
          <div>
            {hasAnyModifications && (
              <button
                onClick={handleResetAll}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
              >
                <RotateCcw size={18} />
                Reset All to Defaults
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            >
              <Save size={18} />
              {isSaving ? 'Saving...' : 'Save Permissions'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

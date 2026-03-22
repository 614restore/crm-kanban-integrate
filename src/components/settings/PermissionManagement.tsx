import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Users, 
  Settings, 
  Eye, 
  EyeOff, 
  Save, 
  RotateCcw, 
  Lock, 
  Unlock,
  AlertTriangle,
  CheckCircle,
  Info,
  Edit3,
  Plus,
  Trash2,
  Search
} from 'lucide-react';
import {
  usePermissions,
  UserRole,
  Permission,
  ResourceType,
  ActionType,
  DEFAULT_ROLES
} from '../../lib/permissions/PermissionProvider';
import { useAuth } from '../../lib/authContext';

interface FeatureToggle {
  id: string;
  name: string;
  description: string;
  resource: ResourceType;
  defaultEnabled: boolean;
  requiresRole: ('owner' | 'admin' | 'manager' | 'sales' | 'field')[];
  category: string;
}

const FEATURE_TOGGLES: FeatureToggle[] = [
  // Core CRM Features
  {
    id: 'contacts_management',
    name: 'Contact Management',
    description: 'Create, edit, and manage customer contacts',
    resource: 'contacts',
    defaultEnabled: true,
    requiresRole: ['owner', 'admin', 'manager', 'sales'],
    category: 'CRM Core'
  },
  {
    id: 'estimates_creation',
    name: 'Estimate Creation',
    description: 'Create and manage project estimates',
    resource: 'estimates',
    defaultEnabled: true,
    requiresRole: ['owner', 'admin', 'manager', 'sales'],
    category: 'CRM Core'
  },
  {
    id: 'invoice_management',
    name: 'Invoice Management',
    description: 'Generate and manage invoices',
    resource: 'invoices',
    defaultEnabled: true,
    requiresRole: ['owner', 'admin', 'manager'],
    category: 'Financial'
  },
  {
    id: 'payment_tracking',
    name: 'Payment Tracking',
    description: 'Track payments and financial transactions',
    resource: 'payments',
    defaultEnabled: true,
    requiresRole: ['owner', 'admin', 'manager'],
    category: 'Financial'
  },
  
  // Project Management
  {
    id: 'project_management',
    name: 'Project Management',
    description: 'Manage projects from start to completion',
    resource: 'projects',
    defaultEnabled: true,
    requiresRole: ['owner', 'admin', 'manager', 'sales', 'field'],
    category: 'Projects'
  },
  {
    id: 'calendar_scheduling',
    name: 'Calendar & Scheduling',
    description: 'Schedule appointments and manage calendar',
    resource: 'calendar',
    defaultEnabled: true,
    requiresRole: ['owner', 'admin', 'manager', 'sales', 'field'],
    category: 'Scheduling'
  },
  {
    id: 'advanced_scheduling',
    name: 'Advanced Scheduling',
    description: 'Resource scheduling and team coordination',
    resource: 'scheduling',
    defaultEnabled: false,
    requiresRole: ['owner', 'admin', 'manager'],
    category: 'Scheduling'
  },

  // Analytics & Reporting
  {
    id: 'basic_reports',
    name: 'Basic Reports',
    description: 'Generate basic business reports',
    resource: 'reports',
    defaultEnabled: true,
    requiresRole: ['owner', 'admin', 'manager'],
    category: 'Analytics'
  },
  {
    id: 'advanced_analytics',
    name: 'Advanced Analytics',
    description: 'Detailed analytics and business intelligence',
    resource: 'analytics',
    defaultEnabled: false,
    requiresRole: ['owner', 'admin'],
    category: 'Analytics'
  },
  
  // Lead Management
  {
    id: 'lead_source_management',
    name: 'Lead Source Management',
    description: 'Manage and track lead sources',
    resource: 'lead-sources',
    defaultEnabled: true,
    requiresRole: ['owner', 'admin', 'manager'],
    category: 'Lead Management'
  },
  
  // Team & Administration
  {
    id: 'team_management',
    name: 'Team Management',
    description: 'Manage team members and roles',
    resource: 'team',
    defaultEnabled: true,
    requiresRole: ['owner', 'admin'],
    category: 'Administration'
  },
  {
    id: 'company_settings',
    name: 'Company Settings',
    description: 'Configure company information and settings',
    resource: 'company',
    defaultEnabled: true,
    requiresRole: ['owner', 'admin'],
    category: 'Administration'
  },
  {
    id: 'integration_management',
    name: 'Integration Management',
    description: 'Manage third-party integrations',
    resource: 'integrations',
    defaultEnabled: false,
    requiresRole: ['owner', 'admin'],
    category: 'Administration'
  },
  
  // Documents & Communication
  {
    id: 'document_management',
    name: 'Document Management',
    description: 'Upload and manage documents',
    resource: 'documents',
    defaultEnabled: true,
    requiresRole: ['owner', 'admin', 'manager', 'sales'],
    category: 'Documents'
  },
  {
    id: 'communication_tools',
    name: 'Communication Tools',
    description: 'Email and SMS communication features',
    resource: 'communication',
    defaultEnabled: false,
    requiresRole: ['owner', 'admin', 'manager', 'sales'],
    category: 'Communication'
  },
  
  // Inventory & Operations
  {
    id: 'inventory_management',
    name: 'Inventory Management',
    description: 'Track materials and inventory',
    resource: 'inventory',
    defaultEnabled: false,
    requiresRole: ['owner', 'admin', 'manager'],
    category: 'Operations'
  }
];

const PermissionManagement: React.FC = () => {
  const { user, isAdminOrHigher, hasPermission, updatePermissions } = usePermissions();
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [customRoles, setCustomRoles] = useState<UserRole[]>([]);
  const [featureToggles, setFeatureToggles] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);

  // Check if user can manage permissions
  const canManagePermissions = isAdminOrHigher() && hasPermission('settings', 'admin');

  useEffect(() => {
    if (!companyId) return;
    loadFeatureToggles();
    loadCustomRoles();
  }, [companyId]);

  const loadFeatureToggles = () => {
    const saved = localStorage.getItem(`crm_feature_toggles_${companyId}`);
    if (saved) {
      setFeatureToggles(JSON.parse(saved));
    } else {
      // Initialize with default values
      const defaults = FEATURE_TOGGLES.reduce((acc, feature) => {
        acc[feature.id] = feature.defaultEnabled;
        return acc;
      }, {} as Record<string, boolean>);
      setFeatureToggles(defaults);
    }
  };

  const loadCustomRoles = () => {
    const saved = localStorage.getItem(`crm_custom_roles_${companyId}`);
    if (saved) {
      setCustomRoles(JSON.parse(saved));
    }
  };

  const saveFeatureToggles = () => {
    if (companyId) localStorage.setItem(`crm_feature_toggles_${companyId}`, JSON.stringify(featureToggles));
    // Update user permissions based on feature toggles
    updateUserPermissions();
    setHasUnsavedChanges(false);
  };

  const updateUserPermissions = () => {
    if (!user || !selectedRole) return;
    
    // Filter role permissions based on feature toggles
    const enabledFeatures = Object.entries(featureToggles)
      .filter(([_, enabled]) => enabled)
      .map(([featureId]) => featureId);
    
    const filteredPermissions = selectedRole.permissions.filter(permission => {
      const feature = FEATURE_TOGGLES.find(f => f.resource === permission.resource);
      return !feature || enabledFeatures.includes(feature.id);
    });

    updatePermissions(filteredPermissions);
  };

  const toggleFeature = (featureId: string) => {
    if (!canManagePermissions) return;
    
    setFeatureToggles(prev => ({
      ...prev,
      [featureId]: !prev[featureId]
    }));
    setHasUnsavedChanges(true);
  };

  const resetToDefaults = () => {
    const defaults = FEATURE_TOGGLES.reduce((acc, feature) => {
      acc[feature.id] = feature.defaultEnabled;
      return acc;
    }, {} as Record<string, boolean>);
    setFeatureToggles(defaults);
    setHasUnsavedChanges(true);
  };

  const categories = ['All', ...Array.from(new Set(FEATURE_TOGGLES.map(f => f.category)))];

  const filteredFeatures = FEATURE_TOGGLES.filter(feature => {
    const matchesSearch = feature.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         feature.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || feature.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (!canManagePermissions) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <Lock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Access Restricted</h3>
          <p className="text-gray-500">
            You need administrator privileges to manage system permissions and features.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Permission & Feature Management</h1>
            <p className="text-gray-600">
              Control which features are available to different user roles in your organization
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <div className="flex items-center gap-2 text-orange-600 text-sm">
                <AlertTriangle className="w-4 h-4" />
                Unsaved changes
              </div>
            )}
            <button
              onClick={resetToDefaults}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </button>
            <button
              onClick={saveFeatureToggles}
              disabled={!hasUnsavedChanges}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">Feature Management</h4>
              <p className="text-sm text-blue-800">
                Toggle features on/off to control what capabilities are available to users. 
                Changes will affect all users with roles that include these features.
                <span className="font-medium"> Remember to save your changes!</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search features..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredFeatures.map((feature) => {
          const isEnabled = featureToggles[feature.id];
          
          return (
            <div 
              key={feature.id} 
              className={`bg-white rounded-lg border-2 transition-all duration-200 ${
                isEnabled 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      isEnabled ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {isEnabled ? 
                        <CheckCircle className="w-5 h-5 text-green-600" /> : 
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                      }
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{feature.name}</h3>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {feature.category}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => toggleFeature(feature.id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isEnabled ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <p className="text-sm text-gray-600 mb-4">{feature.description}</p>

                <div className="border-t border-gray-200 pt-4">
                  <div className="text-xs text-gray-500 mb-2">Available to roles:</div>
                  <div className="flex flex-wrap gap-1">
                    {feature.requiresRole.map(role => (
                      <span 
                        key={role}
                        className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                          isEnabled 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-3 text-xs text-gray-500">
                  Status: <span className={`font-medium ${
                    isEnabled ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredFeatures.length === 0 && (
        <div className="text-center py-12">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No Features Found</h3>
          <p className="text-gray-500">
            Try adjusting your search criteria or category filter.
          </p>
        </div>
      )}

      {/* Summary Stats */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-lg font-medium text-gray-900">
                {Object.values(featureToggles).filter(Boolean).length}
              </div>
              <div className="text-sm text-gray-500">Features Enabled</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <EyeOff className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-lg font-medium text-gray-900">
                {Object.values(featureToggles).filter(v => !v).length}
              </div>
              <div className="text-sm text-gray-500">Features Disabled</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-lg font-medium text-gray-900">
                {FEATURE_TOGGLES.length}
              </div>
              <div className="text-sm text-gray-500">Total Features</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionManagement;
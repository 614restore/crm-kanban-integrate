import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/lib/authContext';

// Enhanced Permission System for TrussCTR CRM
export interface Permission {
  id: string;
  resource: ResourceType;
  actions: ActionType[];
}

export type ResourceType = 
  | 'contacts' 
  | 'estimates' 
  | 'invoices' 
  | 'calendar' 
  | 'reports' 
  | 'settings' 
  | 'team'
  | 'lead-sources'
  | 'projects'
  | 'payments'
  | 'documents'
  | 'integrations'
  | 'company'
  | 'analytics'
  | 'notifications'
  | 'inventory'
  | 'scheduling'
  | 'communication';

export type ActionType = 'read' | 'write' | 'delete' | 'admin' | 'approve' | 'export' | 'import';

export interface UserRole {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isCustom: boolean;
  level: 'owner' | 'admin' | 'manager' | 'sales' | 'field' | 'custom';
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  permissions?: Permission[]; // Additional user-specific permissions
}

// Permission Context
interface PermissionContextType {
  user: User | null;
  permissions: Permission[];
  hasPermission: (resource: ResourceType, action: ActionType) => boolean;
  hasAnyPermission: (resource: ResourceType, actions: ActionType[]) => boolean;
  hasAllPermissions: (resource: ResourceType, actions: ActionType[]) => boolean;
  canManageResource: (resource: ResourceType) => boolean;
  isOwner: () => boolean;
  isAdminOrHigher: () => boolean;
  isManagerOrHigher: () => boolean;
  updateUserRole: (roleId: string) => void;
  updatePermissions: (permissions: Permission[]) => void;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

// Default role configurations
// eslint-disable-next-line react-refresh/only-export-components
export const DEFAULT_ROLES: UserRole[] = [
  {
    id: 'owner',
    name: 'Owner',
    level: 'owner',
    description: 'Full access to all features and system administration',
    isCustom: false,
    permissions: [
      { id: 'all_contacts', resource: 'contacts', actions: ['read', 'write', 'delete', 'admin', 'export', 'import'] },
      { id: 'all_estimates', resource: 'estimates', actions: ['read', 'write', 'delete', 'admin', 'approve', 'export'] },
      { id: 'all_invoices', resource: 'invoices', actions: ['read', 'write', 'delete', 'admin', 'approve', 'export'] },
      { id: 'all_projects', resource: 'projects', actions: ['read', 'write', 'delete', 'admin', 'approve', 'export'] },
      { id: 'all_payments', resource: 'payments', actions: ['read', 'write', 'delete', 'admin', 'approve', 'export'] },
      { id: 'all_calendar', resource: 'calendar', actions: ['read', 'write', 'delete', 'admin', 'export'] },
      { id: 'all_reports', resource: 'reports', actions: ['read', 'write', 'delete', 'admin', 'export'] },
      { id: 'all_analytics', resource: 'analytics', actions: ['read', 'write', 'admin', 'export'] },
      { id: 'all_settings', resource: 'settings', actions: ['read', 'write', 'delete', 'admin'] },
      { id: 'all_team', resource: 'team', actions: ['read', 'write', 'delete', 'admin'] },
      { id: 'all_company', resource: 'company', actions: ['read', 'write', 'delete', 'admin'] },
      { id: 'all_lead_sources', resource: 'lead-sources', actions: ['read', 'write', 'delete', 'admin'] },
      { id: 'all_integrations', resource: 'integrations', actions: ['read', 'write', 'delete', 'admin'] },
      { id: 'all_documents', resource: 'documents', actions: ['read', 'write', 'delete', 'admin', 'export'] },
      { id: 'all_inventory', resource: 'inventory', actions: ['read', 'write', 'delete', 'admin', 'export'] },
      { id: 'all_scheduling', resource: 'scheduling', actions: ['read', 'write', 'delete', 'admin', 'export'] },
      { id: 'all_communication', resource: 'communication', actions: ['read', 'write', 'delete', 'admin'] },
      { id: 'all_notifications', resource: 'notifications', actions: ['read', 'write', 'admin'] }
    ]
  },
  {
    id: 'admin',
    name: 'Administrator',
    level: 'admin',
    description: 'Administrative access with user management capabilities',
    isCustom: false,
    permissions: [
      { id: 'admin_contacts', resource: 'contacts', actions: ['read', 'write', 'delete', 'export', 'import'] },
      { id: 'admin_estimates', resource: 'estimates', actions: ['read', 'write', 'delete', 'approve', 'export'] },
      { id: 'admin_invoices', resource: 'invoices', actions: ['read', 'write', 'delete', 'approve', 'export'] },
      { id: 'admin_projects', resource: 'projects', actions: ['read', 'write', 'delete', 'approve', 'export'] },
      { id: 'admin_payments', resource: 'payments', actions: ['read', 'write', 'approve', 'export'] },
      { id: 'admin_calendar', resource: 'calendar', actions: ['read', 'write', 'delete', 'export'] },
      { id: 'admin_reports', resource: 'reports', actions: ['read', 'write', 'export'] },
      { id: 'admin_analytics', resource: 'analytics', actions: ['read', 'export'] },
      { id: 'admin_settings', resource: 'settings', actions: ['read', 'write'] },
      { id: 'admin_team', resource: 'team', actions: ['read', 'write', 'delete'] },
      { id: 'admin_lead_sources', resource: 'lead-sources', actions: ['read', 'write', 'delete'] },
      { id: 'admin_integrations', resource: 'integrations', actions: ['read', 'write'] },
      { id: 'admin_documents', resource: 'documents', actions: ['read', 'write', 'delete', 'export'] },
      { id: 'admin_inventory', resource: 'inventory', actions: ['read', 'write', 'delete', 'export'] },
      { id: 'admin_scheduling', resource: 'scheduling', actions: ['read', 'write', 'delete', 'export'] },
      { id: 'admin_communication', resource: 'communication', actions: ['read', 'write', 'delete'] },
      { id: 'admin_notifications', resource: 'notifications', actions: ['read', 'write'] }
    ]
  },
  {
    id: 'manager',
    name: 'Project Manager',
    level: 'manager',
    description: 'Manage projects, estimates, and team coordination',
    isCustom: false,
    permissions: [
      { id: 'mgr_contacts', resource: 'contacts', actions: ['read', 'write', 'export'] },
      { id: 'mgr_estimates', resource: 'estimates', actions: ['read', 'write', 'approve', 'export'] },
      { id: 'mgr_invoices', resource: 'invoices', actions: ['read', 'write', 'export'] },
      { id: 'mgr_projects', resource: 'projects', actions: ['read', 'write', 'approve', 'export'] },
      { id: 'mgr_payments', resource: 'payments', actions: ['read', 'export'] },
      { id: 'mgr_calendar', resource: 'calendar', actions: ['read', 'write', 'export'] },
      { id: 'mgr_reports', resource: 'reports', actions: ['read', 'export'] },
      { id: 'mgr_analytics', resource: 'analytics', actions: ['read'] },
      { id: 'mgr_team', resource: 'team', actions: ['read'] },
      { id: 'mgr_lead_sources', resource: 'lead-sources', actions: ['read', 'write'] },
      { id: 'mgr_documents', resource: 'documents', actions: ['read', 'write', 'export'] },
      { id: 'mgr_inventory', resource: 'inventory', actions: ['read', 'write'] },
      { id: 'mgr_scheduling', resource: 'scheduling', actions: ['read', 'write', 'export'] },
      { id: 'mgr_communication', resource: 'communication', actions: ['read', 'write'] },
      { id: 'mgr_notifications', resource: 'notifications', actions: ['read'] }
    ]
  },
  {
    id: 'sales',
    name: 'Sales Representative',
    level: 'sales',
    description: 'Handle leads, estimates, and customer communication',
    isCustom: false,
    permissions: [
      { id: 'sales_contacts', resource: 'contacts', actions: ['read', 'write'] },
      { id: 'sales_estimates', resource: 'estimates', actions: ['read', 'write', 'export'] },
      { id: 'sales_invoices', resource: 'invoices', actions: ['read'] },
      { id: 'sales_projects', resource: 'projects', actions: ['read', 'write'] },
      { id: 'sales_payments', resource: 'payments', actions: ['read'] },
      { id: 'sales_calendar', resource: 'calendar', actions: ['read', 'write'] },
      { id: 'sales_reports', resource: 'reports', actions: ['read'] },
      { id: 'sales_lead_sources', resource: 'lead-sources', actions: ['read'] },
      { id: 'sales_documents', resource: 'documents', actions: ['read', 'write'] },
      { id: 'sales_scheduling', resource: 'scheduling', actions: ['read', 'write'] },
      { id: 'sales_communication', resource: 'communication', actions: ['read', 'write'] },
      { id: 'sales_notifications', resource: 'notifications', actions: ['read'] }
    ]
  },
  {
    id: 'field',
    name: 'Field Worker',
    level: 'field',
    description: 'Access job details and update project status',
    isCustom: false,
    permissions: [
      { id: 'field_contacts', resource: 'contacts', actions: ['read'] },
      { id: 'field_projects', resource: 'projects', actions: ['read', 'write'] },
      { id: 'field_calendar', resource: 'calendar', actions: ['read', 'write'] },
      { id: 'field_documents', resource: 'documents', actions: ['read'] },
      { id: 'field_inventory', resource: 'inventory', actions: ['read'] },
      { id: 'field_scheduling', resource: 'scheduling', actions: ['read', 'write'] },
      { id: 'field_notifications', resource: 'notifications', actions: ['read'] }
    ]
  }
];

// Permission Provider Component
export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  // Sync permissions from the real authenticated profile
  useEffect(() => {
    if (profile) {
      const roleId = profile.role || 'owner';
      const matchedRole = DEFAULT_ROLES.find(r => r.id === roleId) ?? DEFAULT_ROLES.find(r => r.id === 'owner')!;
      const syncedUser: User = {
        id: profile.id,
        email: profile.email,
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        role: matchedRole,
        isActive: profile.is_active !== false,
      };
      setUser(syncedUser);
      setPermissions(matchedRole.permissions);
    } else {
      setUser(null);
      setPermissions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role, profile?.is_active]);

  const hasPermission = (resource: ResourceType, action: ActionType): boolean => {
    if (!user || !user.isActive) return false;
    
    // Owners have all permissions
    if (user.role.level === 'owner') return true;

    return permissions.some(permission => 
      permission.resource === resource && permission.actions.includes(action)
    );
  };

  const hasAnyPermission = (resource: ResourceType, actions: ActionType[]): boolean => {
    return actions.some(action => hasPermission(resource, action));
  };

  const hasAllPermissions = (resource: ResourceType, actions: ActionType[]): boolean => {
    return actions.every(action => hasPermission(resource, action));
  };

  const canManageResource = (resource: ResourceType): boolean => {
    return hasPermission(resource, 'admin') || hasPermission(resource, 'write');
  };

  const isOwner = (): boolean => {
    return user?.role.level === 'owner';
  };

  const isAdminOrHigher = (): boolean => {
    return user?.role.level === 'owner' || user?.role.level === 'admin';
  };

  const isManagerOrHigher = (): boolean => {
    return ['owner', 'admin', 'manager'].includes(user?.role.level || '');
  };

  const updateUserRole = (roleId: string): void => {
    if (!user) return;
    
    const newRole = DEFAULT_ROLES.find(role => role.id === roleId);
    if (!newRole) return;

    const updatedUser = { ...user, role: newRole };
    setUser(updatedUser);
    setPermissions([...newRole.permissions, ...(updatedUser.permissions || [])]);
  };

  const updatePermissions = (newPermissions: Permission[]): void => {
    setPermissions(newPermissions);
    if (user) {
      setUser({ ...user, permissions: newPermissions });
    }
  };

  const contextValue: PermissionContextType = {
    user,
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canManageResource,
    isOwner,
    isAdminOrHigher,
    isManagerOrHigher,
    updateUserRole,
    updatePermissions
  };

  return (
    <PermissionContext.Provider value={contextValue}>
      {children}
    </PermissionContext.Provider>
  );
};

// Custom hook to use permissions
// eslint-disable-next-line react-refresh/only-export-components
export const usePermissions = (): PermissionContextType => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

// Permission checking utilities
export class PermissionChecker {
  static hasPermission(
    permissions: Permission[], 
    resource: ResourceType, 
    action: ActionType
  ): boolean {
    return permissions.some(permission => 
      permission.resource === resource && permission.actions.includes(action)
    );
  }

  static canAccess(
    userRole: UserRole, 
    resource: ResourceType, 
    requiredActions: ActionType[] = ['read']
  ): boolean {
    return requiredActions.every(action =>
      userRole.permissions.some(permission => 
        permission.resource === resource && permission.actions.includes(action)
      )
    );
  }

  static filterByPermission<T>(
    items: T[], 
    permissions: Permission[], 
    resource: ResourceType, 
    action: ActionType = 'read'
  ): T[] {
    const hasAccess = this.hasPermission(permissions, resource, action);
    return hasAccess ? items : [];
  }
}

// Permission-based route guard
// eslint-disable-next-line react-refresh/only-export-components
export const withPermission = (
  WrappedComponent: React.ComponentType<any>,
  requiredResource: ResourceType,
  requiredAction: ActionType = 'read'
) => {
  return (props: any) => {
    const { hasPermission } = usePermissions();
    
    if (!hasPermission(requiredResource, requiredAction)) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m0 0V9a6 6 0 1112 0v6" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
            <p className="text-gray-600">
              You don't have permission to access this feature. Contact your administrator for access.
            </p>
          </div>
        </div>
      );
    }
    
    return <WrappedComponent {...props} />;
  };
};

export default PermissionProvider;
import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  Plus, 
  Edit3, 
  Trash2, 
  MapPin, 
  Phone, 
  Mail, 
  Clock,
  Settings,
  Eye,
  EyeOff,
  Shield,
  UserPlus,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  AlertCircle,
  Target,
  Lock
} from 'lucide-react';
import { CompanySettings, CompanyAddress, TeamMember, TeamRole } from '../../lib/integrations/apiTypes';
import LeadSourceManagement from './LeadSourceManagement';
import PermissionManagement from './PermissionManagement';
import { useAuth } from '../../lib/authContext';

// Company & Team Management Main Component
const CompanyTeamSettings: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'company' | 'offices' | 'team' | 'roles' | 'leadSources' | 'permissions'>('company');
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [offices, setOffices] = useState<CompanyAddress[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [showModal, setShowModal] = useState<{
    type: 'office' | 'team' | 'role' | null;
    data?: any;
  }>({ type: null });

  useEffect(() => {
    if (profile?.company_id) loadCompanyData();
  }, [profile?.company_id]);

  const loadCompanyData = async () => {
    const cid = profile?.company_id;
    if (!cid) return;
    // Load from localStorage or API
    const savedCompany = localStorage.getItem(`crm_companySettings_${cid}`);
    const savedOffices = localStorage.getItem(`crm_companyOffices_${cid}`);
    const savedTeam = localStorage.getItem(`crm_teamMembers_${cid}`);
    const savedRoles = localStorage.getItem(`crm_teamRoles_${cid}`);

    if (savedCompany) setCompany(JSON.parse(savedCompany));
    if (savedOffices) setOffices(JSON.parse(savedOffices));
    if (savedTeam) setTeam(JSON.parse(savedTeam));
    if (savedRoles) setRoles(JSON.parse(savedRoles));

    // Initialize default roles if none exist
    if (!savedRoles) {
      const defaultRoles: TeamRole[] = [
        {
          id: 'admin',
          name: 'Administrator',
          description: 'Full access to all features and settings',
          permissions: [
            { id: 'all', resource: 'contacts', actions: ['read', 'write', 'delete', 'admin'] },
            { id: 'all', resource: 'estimates', actions: ['read', 'write', 'delete', 'admin'] },
            { id: 'all', resource: 'invoices', actions: ['read', 'write', 'delete', 'admin'] },
            { id: 'all', resource: 'calendar', actions: ['read', 'write', 'delete', 'admin'] },
            { id: 'all', resource: 'reports', actions: ['read', 'write', 'delete', 'admin'] },
            { id: 'all', resource: 'settings', actions: ['read', 'write', 'delete', 'admin'] },
            { id: 'all', resource: 'team', actions: ['read', 'write', 'delete', 'admin'] }
          ],
          isCustom: false
        },
        {
          id: 'manager',
          name: 'Project Manager',
          description: 'Manage projects, estimates, and team coordination',
          permissions: [
            { id: 'contacts', resource: 'contacts', actions: ['read', 'write'] },
            { id: 'estimates', resource: 'estimates', actions: ['read', 'write'] },
            { id: 'invoices', resource: 'invoices', actions: ['read', 'write'] },
            { id: 'calendar', resource: 'calendar', actions: ['read', 'write'] },
            { id: 'reports', resource: 'reports', actions: ['read'] },
            { id: 'team', resource: 'team', actions: ['read'] }
          ],
          isCustom: false
        },
        {
          id: 'sales',
          name: 'Sales Representative',
          description: 'Handle leads, estimates, and customer communication',
          permissions: [
            { id: 'contacts', resource: 'contacts', actions: ['read', 'write'] },
            { id: 'estimates', resource: 'estimates', actions: ['read', 'write'] },
            { id: 'calendar', resource: 'calendar', actions: ['read', 'write'] },
            { id: 'reports', resource: 'reports', actions: ['read'] }
          ],
          isCustom: false
        },
        {
          id: 'field',
          name: 'Field Worker',
          description: 'Access job details and update project status',
          permissions: [
            { id: 'contacts', resource: 'contacts', actions: ['read'] },
            { id: 'calendar', resource: 'calendar', actions: ['read', 'write'] }
          ],
          isCustom: false
        }
      ];
      setRoles(defaultRoles);
      localStorage.setItem(`crm_teamRoles_${cid}`, JSON.stringify(defaultRoles));
    }
  };

  const saveCompanyData = (data: any, key: string) => {
    const cid = profile?.company_id;
    if (!cid) return;
    localStorage.setItem(`crm_${key}_${cid}`, JSON.stringify(data));
  };

  const tabs = [
    { id: 'company', label: 'Company', icon: Building2 },
    { id: 'offices', label: 'Offices', icon: MapPin },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'roles', label: 'Roles', icon: Shield },
    { id: 'leadSources', label: 'Lead Sources', icon: Target },
    { id: 'permissions', label: 'Permissions', icon: Lock }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Company & Team Management</h1>
        <p className="text-gray-600">
          Manage your company information, office locations, team members, and access permissions.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200">
        {activeTab === 'company' && (
          <CompanyTab 
            company={company} 
            setCompany={(data) => {
              setCompany(data);
              saveCompanyData(data, 'companySettings');
            }}
            userRole={profile?.role}
          />
        )}

        {activeTab === 'offices' && (
          <OfficesTab 
            offices={offices}
            setOffices={(data) => {
              setOffices(data);
              saveCompanyData(data, 'companyOffices');
            }}
            onAddOffice={() => setShowModal({ type: 'office' })}
          />
        )}

        {activeTab === 'team' && (
          <TeamTab 
            team={team}
            roles={roles}
            offices={offices}
            setTeam={(data) => {
              setTeam(data);
              saveCompanyData(data, 'teamMembers');
            }}
            onAddMember={() => setShowModal({ type: 'team' })}
          />
        )}

        {activeTab === 'roles' && (
          <RolesTab 
            roles={roles}
            setRoles={(data) => {
              setRoles(data);
              saveCompanyData(data, 'teamRoles');
            }}
            onAddRole={() => setShowModal({ type: 'role' })}
          />
        )}

        {activeTab === 'leadSources' && (
          <LeadSourceManagement />
        )}

        {activeTab === 'permissions' && (
          <PermissionManagement />
        )}
      </div>

      {/* Modals */}
      {showModal.type === 'office' && (
        <OfficeModal
          office={showModal.data}
          onSave={(office) => {
            if (showModal.data) {
              const updated = offices.map(o => o.id === office.id ? office : o);
              setOffices(updated);
              saveCompanyData(updated, 'companyOffices');
            } else {
              const newOffice = { ...office, id: crypto.randomUUID() };
              const updated = [...offices, newOffice];
              setOffices(updated);
              saveCompanyData(updated, 'companyOffices');
            }
            setShowModal({ type: null });
          }}
          onClose={() => setShowModal({ type: null })}
        />
      )}

      {showModal.type === 'team' && (
        <TeamMemberModal
          member={showModal.data}
          roles={roles}
          offices={offices}
          onSave={(member) => {
            if (showModal.data) {
              const updated = team.map(m => m.id === member.id ? member : m);
              setTeam(updated);
              saveCompanyData(updated, 'teamMembers');
            } else {
              const newMember = { 
                ...member, 
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
                inviteStatus: 'pending' as const
              };
              const updated = [...team, newMember];
              setTeam(updated);
              saveCompanyData(updated, 'teamMembers');
            }
            setShowModal({ type: null });
          }}
          onClose={() => setShowModal({ type: null })}
        />
      )}

      {showModal.type === 'role' && (
        <RoleModal
          role={showModal.data}
          onSave={(role) => {
            if (showModal.data) {
              const updated = roles.map(r => r.id === role.id ? role : r);
              setRoles(updated);
              saveCompanyData(updated, 'teamRoles');
            } else {
              const newRole = { ...role, id: crypto.randomUUID(), isCustom: true };
              const updated = [...roles, newRole];
              setRoles(updated);
              saveCompanyData(updated, 'teamRoles');
            }
            setShowModal({ type: null });
          }}
          onClose={() => setShowModal({ type: null })}
        />
      )}
    </div>
  );
};

// Company Information Tab
const CompanyTab: React.FC<{ 
  company: CompanySettings | null; 
  setCompany: (company: CompanySettings) => void;
  userRole?: string;
}> = ({ company, setCompany, userRole }) => {
  const isOwner = userRole === 'owner';
  
  const [formData, setFormData] = useState(company || {
    id: crypto.randomUUID(),
    name: '',
    addresses: [],
    primaryOfficeId: '',
    timezone: 'America/New_York',
    businessHours: {
      monday: { isOpen: true, openTime: '08:00', closeTime: '17:00' },
      tuesday: { isOpen: true, openTime: '08:00', closeTime: '17:00' },
      wednesday: { isOpen: true, openTime: '08:00', closeTime: '17:00' },
      thursday: { isOpen: true, openTime: '08:00', closeTime: '17:00' },
      friday: { isOpen: true, openTime: '08:00', closeTime: '17:00' },
      saturday: { isOpen: false, openTime: '09:00', closeTime: '15:00' },
      sunday: { isOpen: false, openTime: '09:00', closeTime: '15:00' }
    },
    settings: {
      requireApprovalFor: [],
      maxEstimateAmount: 50000,
      defaultMarkup: 25,
      taxRate: 8.5
    }
  });

  const handleSave = () => {
    setCompany(formData);
  };

  return (
    <div className="p-6 space-y-6">
      {!isOwner && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <Lock className="text-amber-600 mt-0.5" size={20} />
          <div>
            <h4 className="font-medium text-amber-900">Owner Access Only</h4>
            <p className="text-sm text-amber-700 mt-1">
              Only company owners can edit company information. Contact your administrator to make changes.
            </p>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            disabled={!isOwner}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="TrussCTR Roofing"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Timezone
          </label>
          <select
            value={formData.timezone}
            onChange={(e) => setFormData({...formData, timezone: e.target.value})}
            disabled={!isOwner}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="America/New_York">Eastern Time</option>
            <option value="America/Chicago">Central Time</option>
            <option value="America/Denver">Mountain Time</option>
            <option value="America/Los_Angeles">Pacific Time</option>
          </select>
        </div>
      </div>

      {/* Business Hours */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Business Hours</h3>
        <div className="space-y-3">
          {Object.entries(formData.businessHours).map(([day, hours]) => (
            <div key={day} className="flex items-center gap-4">
              <div className="w-24">
                <span className="text-sm font-medium text-gray-700 capitalize">{day}</span>
              </div>
              <input
                type="checkbox"
                checked={hours.isOpen}
                onChange={(e) => setFormData({
                  ...formData,
                  businessHours: {
                    ...formData.businessHours,
                    [day]: { ...hours, isOpen: e.target.checked }
                  }
                })}
                disabled={!isOwner}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {hours.isOpen && (
                <>
                  <input
                    type="time"
                    value={hours.openTime}
                    onChange={(e) => setFormData({
                      ...formData,
                      businessHours: {
                        ...formData.businessHours,
                        [day]: { ...hours, openTime: e.target.value }
                      }
                    })}
                    disabled={!isOwner}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="time"
                    value={hours.closeTime}
                    onChange={(e) => setFormData({
                      ...formData,
                      businessHours: {
                        ...formData.businessHours,
                        [day]: { ...hours, closeTime: e.target.value }
                      }
                    })}
                    disabled={!isOwner}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Business Settings */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Business Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Estimate Amount (without approval)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={formData.settings.maxEstimateAmount}
                onChange={(e) => setFormData({
                  ...formData,
                  settings: { ...formData.settings, maxEstimateAmount: Number(e.target.value) }
                })}
                disabled={!isOwner}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Markup (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.settings.defaultMarkup}
              onChange={(e) => setFormData({
                ...formData,
                settings: { ...formData.settings, defaultMarkup: Number(e.target.value) }
              })}
              disabled={!isOwner}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tax Rate (%)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.settings.taxRate}
              onChange={(e) => setFormData({
                ...formData,
                settings: { ...formData.settings, taxRate: Number(e.target.value) }
              })}
              disabled={!isOwner}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!isOwner}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-400"
        >
          <CheckCircle className="w-4 h-4" />
          Save Company Settings
        </button>
      </div>
    </div>
  );
};

// Additional component stubs for the other tabs
const OfficesTab: React.FC<any> = ({ offices, onAddOffice }) => (
  <div className="p-6">
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-lg font-medium">Office Locations</h3>
      <button
        onClick={onAddOffice}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        <Plus className="w-4 h-4" />
        Add Office
      </button>
    </div>
    <div className="text-gray-500">Office management interface will be here</div>
  </div>
);

const TeamTab: React.FC<any> = ({ team, onAddMember }) => (
  <div className="p-6">
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-lg font-medium">Team Members</h3>
      <button
        onClick={onAddMember}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        <UserPlus className="w-4 h-4" />
        Invite Member
      </button>
    </div>
    <div className="text-gray-500">Team management interface will be here</div>
  </div>
);

const RolesTab: React.FC<any> = ({ roles, onAddRole }) => (
  <div className="p-6">
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-lg font-medium">User Roles & Permissions</h3>
      <button
        onClick={onAddRole}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        <Plus className="w-4 h-4" />
        Create Role
      </button>
    </div>
    <div className="text-gray-500">Role management interface will be here</div>
  </div>
);

// Modal stubs (to be implemented)
const OfficeModal: React.FC<any> = ({ onClose }) => <div>Office Modal</div>;
const TeamMemberModal: React.FC<any> = ({ onClose }) => <div>Team Member Modal</div>;
const RoleModal: React.FC<any> = ({ onClose }) => <div>Role Modal</div>;

export default CompanyTeamSettings;
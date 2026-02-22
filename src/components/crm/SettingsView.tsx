import React, { useState } from 'react';
import { useCRM, canManageLeadSources } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { LeadSource, defaultLeadSources } from '@/lib/crmData';
import {
  Settings,
  Building2,
  Users,
  Bell,
  Shield,
  CreditCard,
  Link,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Check,
  ExternalLink,
  Key,
  Database,
  Mail,
  MessageSquare,
  Calendar,
  FileText,
  User,
} from 'lucide-react';

type SettingsTab = 'company' | 'profile' | 'integrations' | 'notifications' | 'security' | 'billing' | 'api';

export default function SettingsView() {
  const { state, dispatch } = useCRM();
  const { profile, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const [newLeadSource, setNewLeadSource] = useState('');
  const [showAddLeadSource, setShowAddLeadSource] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
  });

  const userRole = state.currentUser?.role || 'sales';
  const canManageSources = canManageLeadSources(userRole);

  // Combine default and custom lead sources
  const allLeadSources = [...defaultLeadSources, ...state.leadSources.filter((ls) => ls.isCustom)];

  const handleAddLeadSource = () => {
    if (newLeadSource.trim()) {
      const newSource: LeadSource = {
        id: `ls-custom-${Date.now()}`,
        name: newLeadSource.trim(),
        isCustom: true,
        createdBy: state.currentUser?.id,
      };
      dispatch({ type: 'ADD_LEAD_SOURCE', payload: newSource });
      setNewLeadSource('');
      setShowAddLeadSource(false);
    }
  };

  const handleSaveProfile = async () => {
    if (profile) {
      await updateProfile({
        first_name: profileForm.first_name,
        last_name: profileForm.last_name,
      });
      setEditingProfile(false);
    }
  };

  const tabs = [
    { id: 'company', label: 'Company', icon: <Building2 size={18} /> },
    { id: 'profile', label: 'My Profile', icon: <User size={18} /> },
    { id: 'integrations', label: 'Integrations', icon: <Link size={18} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
    { id: 'security', label: 'Security', icon: <Shield size={18} /> },
    { id: 'billing', label: 'Billing', icon: <CreditCard size={18} /> },
    { id: 'api', label: 'API Access', icon: <Key size={18} /> },
  ];

  const integrations = [
    {
      name: 'QuickBooks',
      description: 'Sync invoices, payments, and financial data',
      icon: '💰',
      connected: false,
      category: 'Accounting',
    },
    {
      name: 'Twilio',
      description: 'Send and receive SMS messages',
      icon: '📱',
      connected: true,
      category: 'Communication',
    },
    {
      name: 'Google Calendar',
      description: 'Sync appointments and scheduling',
      icon: '📅',
      connected: true,
      category: 'Calendar',
    },
    {
      name: 'EagleView',
      description: 'Aerial roof measurements and reports',
      icon: '🦅',
      connected: false,
      category: 'Measurements',
    },
    {
      name: 'Stripe',
      description: 'Process payments and subscriptions',
      icon: '💳',
      connected: false,
      category: 'Payments',
    },
    {
      name: 'DocuSign',
      description: 'Electronic signatures for contracts',
      icon: '✍️',
      connected: false,
      category: 'Documents',
    },
    {
      name: 'ScopeMGR',
      description: 'Mobile app for photo and customer documentation',
      icon: '📸',
      connected: true,
      category: 'Field Tools',
    },
    {
      name: 'Zapier',
      description: 'Connect with 5,000+ apps',
      icon: '⚡',
      connected: false,
      category: 'Automation',
    },
  ];

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 px-3">Settings</h2>
        <nav className="space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        {activeTab === 'company' && (
          <div className="max-w-3xl space-y-8">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Company Profile</h3>
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <Building2 className="text-white" size={36} />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">StormCraft Roofing</h4>
                    <p className="text-gray-500">Premium roofing and restoration services</p>
                    <button className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
                      Change Logo
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name
                    </label>
                    <input
                      type="text"
                      defaultValue="StormCraft Roofing"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business Phone
                    </label>
                    <input
                      type="tel"
                      defaultValue="(555) 123-4567"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business Email
                    </label>
                    <input
                      type="email"
                      defaultValue="info@stormcraft.com"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input
                      type="url"
                      defaultValue="https://stormcraft.com"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    defaultValue="123 Business Park Drive, Dallas, TX 75201"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  Save Changes
                </button>
              </div>
            </div>

            {/* Lead Sources */}
            {canManageSources && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">Lead Sources</h3>
                  <button
                    onClick={() => setShowAddLeadSource(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium"
                  >
                    <Plus size={16} />
                    Add Source
                  </button>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {allLeadSources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            source.isCustom ? 'bg-purple-500' : 'bg-blue-500'
                          }`}
                        />
                        <span className="font-medium text-gray-900">{source.name}</span>
                        {source.isCustom && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                            Custom
                          </span>
                        )}
                      </div>
                      {source.isCustom && (
                        <button className="p-1.5 hover:bg-red-100 rounded transition-colors">
                          <Trash2 size={16} className="text-red-500" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {showAddLeadSource && (
                  <div className="mt-4 flex items-center gap-3">
                    <input
                      type="text"
                      value={newLeadSource}
                      onChange={(e) => setNewLeadSource(e.target.value)}
                      placeholder="Enter lead source name..."
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      autoFocus
                    />
                    <button
                      onClick={handleAddLeadSource}
                      className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setShowAddLeadSource(false);
                        setNewLeadSource('');
                      }}
                      className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="max-w-3xl space-y-8">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-6">My Profile</h3>
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {profile?.first_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
                    {profile?.last_name?.[0]?.toUpperCase() || ''}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">
                      {profile?.first_name && profile?.last_name 
                        ? `${profile.first_name} ${profile.last_name}`
                        : profile?.email || 'User'}
                    </h4>
                    <p className="text-gray-500">{profile?.email}</p>
                    <p className="text-sm text-gray-400 capitalize mt-1">{profile?.role || 'User'}</p>
                  </div>
                </div>

                {editingProfile ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          First Name
                        </label>
                        <input
                          type="text"
                          value={profileForm.first_name}
                          onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={profileForm.last_name}
                          onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleSaveProfile}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        <Save size={18} />
                        Save Changes
                      </button>
                      <button
                        onClick={() => setEditingProfile(false)}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setProfileForm({
                        first_name: profile?.first_name || '',
                        last_name: profile?.last_name || '',
                      });
                      setEditingProfile(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Edit2 size={18} />
                    Edit Profile
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="max-w-4xl">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Integrations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {integrations.map((integration) => (
                <div
                  key={integration.name}
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{integration.icon}</span>
                      <div>
                        <h4 className="font-semibold text-gray-900">{integration.name}</h4>
                        <span className="text-xs text-gray-400">{integration.category}</span>
                      </div>
                    </div>
                    {integration.connected && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <Check size={12} />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{integration.description}</p>
                  <button
                    className={`w-full py-2 rounded-lg font-medium transition-colors ${
                      integration.connected
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {integration.connected ? 'Manage' : 'Connect'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="max-w-3xl">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Notification Preferences</h3>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {[
                { label: 'New lead assigned', description: 'Get notified when a new lead is assigned to you', email: true, push: true },
                { label: 'Appointment reminders', description: 'Receive reminders before scheduled appointments', email: true, push: true },
                { label: 'Payment received', description: 'Get notified when a payment is received', email: true, push: false },
                { label: 'Invoice overdue', description: 'Alerts for overdue invoices', email: true, push: true },
                { label: 'Team mentions', description: 'When someone mentions you in a note or comment', email: false, push: true },
                { label: 'Weekly summary', description: 'Weekly performance and activity summary', email: true, push: false },
              ].map((item, index) => (
                <div key={index} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{item.label}</p>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked={item.email}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-600">Email</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked={item.push}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-600">Push</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="max-w-3xl space-y-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Security Settings</h3>
            
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Change Password</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  Update Password
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Two-Factor Authentication</h4>
              <p className="text-gray-500 mb-4">
                Add an extra layer of security to your account by enabling two-factor authentication.
              </p>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
                Enable 2FA
              </button>
            </div>
          </div>
        )}

        {activeTab === 'billing' && (
          <div className="max-w-3xl space-y-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Billing & Subscription</h3>
            
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-blue-200 text-sm">Current Plan</p>
                  <h4 className="text-2xl font-bold">Professional</h4>
                </div>
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">Active</span>
              </div>
              <p className="text-blue-100 mb-4">Unlimited users, all features, priority support</p>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold">
                  $199<span className="text-lg font-normal text-blue-200">/month</span>
                </p>
                <button className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors">
                  Manage Plan
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Payment Method</h4>
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center text-white text-xs font-bold">
                  VISA
                </div>
                <div>
                  <p className="font-medium text-gray-900">•••• •••• •••• 4242</p>
                  <p className="text-sm text-gray-500">Expires 12/2027</p>
                </div>
                <button className="ml-auto text-blue-600 hover:text-blue-700 font-medium text-sm">
                  Update
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="max-w-3xl space-y-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">API Access</h3>
            
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-900 mb-4">API Keys</h4>
              <p className="text-gray-500 mb-4">
                Use API keys to integrate StormCraft CRM with your custom applications and mobile apps.
              </p>
              <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm mb-4">
                <p className="text-gray-500 mb-1">Production Key</p>
                <p className="text-gray-900">sk_live_••••••••••••••••••••••••</p>
              </div>
              <div className="flex gap-3">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  Generate New Key
                </button>
                <button className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center gap-2">
                  <ExternalLink size={16} />
                  View Documentation
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Webhooks</h4>
              <p className="text-gray-500 mb-4">
                Configure webhooks to receive real-time notifications about events in your CRM.
              </p>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                Configure Webhooks
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { 
  Settings, 
  Building2, 
  Users, 
  Plug, 
  Bell, 
  Palette,
  Shield,
  Database,
  Mail,
  Calendar,
  FileText,
  DollarSign,
  BarChart3,
  HelpCircle,
  Wrench,
  Hammer,
} from 'lucide-react';
import { useCRM } from '@/lib/crmStore';

import IntegrationsSettings from './IntegrationsSettings';
import CompanyTeamSettings from './CompanyTeamSettings';
import BillingSettingsPage from './BillingSettings';
import { NotificationPreferences } from './NotificationPreferences';
import MaterialPricingSettings from './MaterialPricingSettings';

// Main Settings Component with Navigation
const MainSettings: React.FC = () => {
  const [activeSection, setActiveSection] = useState('company');

  const settingsSections = [
    {
      id: 'company',
      title: 'Company & Team',
      description: 'Company information, offices, team members, and roles',
      icon: Building2,
      component: CompanyTeamSettings
    },
    {
      id: 'integrations',
      title: 'Integrations',
      description: 'Connect external services and APIs',
      icon: Plug,
      component: IntegrationsSettings
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Email alerts, SMS notifications, and preferences',
      icon: Bell,
      component: NotificationPreferences
    },
    {
      id: 'appearance',
      title: 'Appearance',
      description: 'Theme, branding, and interface customization',
      icon: Palette,
      component: AppearanceSettings
    },
    {
      id: 'security',
      title: 'Security',
      description: 'Password policies, 2FA, and access controls',
      icon: Shield,
      component: SecuritySettings
    },
    {
      id: 'data',
      title: 'Data Management',
      description: 'Backup, import/export, and data retention',
      icon: Database,
      component: DataSettings
    },
    {
      id: 'communication',
      title: 'Communication',
      description: 'Email templates, SMS settings, and automation',
      icon: Mail,
      component: CommunicationSettings
    },
    {
      id: 'calendar',
      title: 'Calendar',
      description: 'Scheduling, availability, and calendar sync',
      icon: Calendar,
      component: CalendarSettings
    },
    {
      id: 'documents',
      title: 'Documents',
      description: 'Templates, contracts, and document automation',
      icon: FileText,
      component: DocumentSettings
    },
    {
      id: 'pricing',
      title: 'Material Pricing',
      description: 'Default unit rates for estimates — underlayment, ice & water, shingles, labor',
      icon: Hammer,
      component: MaterialPricingSettings,
    },
    {
      id: 'billing',
      title: 'Billing & Payments',
      description: 'Payment processing, invoicing, and accounting',
      icon: DollarSign,
      component: BillingSettings
    },
    {
      id: 'reporting',
      title: 'Reporting',
      description: 'Dashboard configuration and report settings',
      icon: BarChart3,
      component: ReportingSettings
    },
    {
      id: 'support',
      title: 'Help & Support',
      description: 'Documentation, tutorials, and support contacts',
      icon: HelpCircle,
      component: SupportSettings
    }
  ];

  const activeComponent = settingsSections.find(section => section.id === activeSection);
  const ActiveComponent = activeComponent?.component;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Settings Navigation Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Settings</h1>
              <p className="text-sm text-gray-600">Manage your CRM configuration</p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${
                  activeSection === section.id
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <div className={`p-2 rounded-md ${
                  activeSection === section.id
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-medium text-sm ${
                      activeSection === section.id
                        ? 'text-blue-900'
                        : 'text-gray-900'
                    }`}>
                      {section.title}
                    </h3>
                    {(section as any).comingSoon && (
                      <span className="text-[10px] font-medium bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full leading-none">
                        Soon
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${
                    activeSection === section.id
                      ? 'text-blue-700'
                      : 'text-gray-500'
                  }`}>
                    {section.description}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Quick Actions */}
        <div className="p-4 border-t border-gray-200 mt-auto">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Quick Actions</span>
            </div>
            <div className="space-y-2">
              <button disabled className="w-full text-left text-sm text-gray-400 cursor-not-allowed flex items-center justify-between">
                <span>Export Settings</span>
                <span className="text-[10px] bg-gray-200 text-gray-400 px-1.5 py-0.5 rounded-full">Soon</span>
              </button>
              <button disabled className="w-full text-left text-sm text-gray-400 cursor-not-allowed flex items-center justify-between">
                <span>Import Configuration</span>
                <span className="text-[10px] bg-gray-200 text-gray-400 px-1.5 py-0.5 rounded-full">Soon</span>
              </button>
              <button disabled className="w-full text-left text-sm text-gray-400 cursor-not-allowed flex items-center justify-between">
                <span>Reset to Defaults</span>
                <span className="text-[10px] bg-gray-200 text-gray-400 px-1.5 py-0.5 rounded-full">Soon</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-auto">
        {ActiveComponent ? (
          <ActiveComponent />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-medium text-gray-600 mb-2">
                Select a Settings Section
              </h2>
              <p className="text-gray-500">
                Choose a category from the sidebar to configure your CRM.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Placeholder components for settings sections
const NotificationSettings: React.FC = () => (
  <div className="p-6">
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Notification Settings</h1>
      <p className="text-gray-600 mb-8">Configure when and how you receive notifications.</p>
      
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Email Notifications</h2>
          <div className="space-y-4">
            {[
              'New leads assigned to me',
              'Estimate status changes',
              'Invoice payments received',
              'Calendar appointment reminders',
              'Team member updates'
            ].map((option) => (
              <label key={option} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">SMS Notifications</h2>
          <div className="space-y-4">
            {[
              'Urgent customer inquiries',
              'Job completion alerts',
              'Payment reminders'
            ].map((option) => (
              <label key={option} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const AppearanceSettings: React.FC = () => (
  <div className="p-6">
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Appearance Settings</h1>
      <p className="text-gray-600 mb-8">Customize the look and feel of your CRM.</p>
      
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Theme</h2>
          <div className="grid grid-cols-3 gap-4">
            {['Light', 'Dark', 'Auto'].map((theme) => (
              <div key={theme} className="relative">
                <input
                  type="radio"
                  name="theme"
                  value={theme.toLowerCase()}
                  defaultChecked={theme === 'Light'}
                  className="sr-only peer"
                />
                <div className="p-4 rounded-lg border border-gray-200 cursor-pointer peer-checked:border-blue-500 peer-checked:bg-blue-50">
                  <div className="text-center">
                    <div className={`w-16 h-12 mx-auto mb-2 rounded ${
                      theme === 'Light' ? 'bg-white border-2 border-gray-200' :
                      theme === 'Dark' ? 'bg-gray-900' :
                      'bg-gradient-to-r from-white to-gray-900'
                    }`} />
                    <span className="text-sm font-medium">{theme}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Company Branding</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Logo
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-lg mx-auto mb-4" />
                <p className="text-sm text-gray-600">Click to upload logo</p>
                <p className="text-xs text-gray-500">PNG, JPG up to 2MB</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const SecuritySettings: React.FC = () => (
  <div className="p-6">
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Security Settings</h1>
      <p className="text-gray-600 mb-8">Manage security policies and access controls.</p>
      
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Password Policy</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Require minimum 8 characters</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Require uppercase and lowercase letters</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Require numbers and special characters</span>
            </label>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Two-Factor Authentication</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">Enable 2FA for all team members</p>
              <p className="text-xs text-gray-500">Requires authentication app or SMS verification</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const DataSettings: React.FC = () => {
  const { state } = useCRM();

  const downloadCsv = (filename: string, rows: object[]) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(row =>
        headers.map(h => {
          const val = (row as any)[h] ?? '';
          const str = String(val).replace(/"/g, '""');
          return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
        }).join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAll = () => {
    downloadCsv('contacts.csv', state.contacts.map(c => ({
      Name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
      Email: c.email || '',
      Phone: c.phone || '',
      Status: c.status || '',
      Company: c.company || '',
      Address: c.address || '',
    })));
    downloadCsv('estimates.csv', state.estimates.map(e => ({
      Number: e.estimateNumber || '',
      Title: e.title || '',
      Status: e.status || '',
      Total: e.total || 0,
      Contact: e.contactName || '',
      Created: e.createdAt || '',
    })));
    downloadCsv('invoices.csv', state.invoices.map(inv => ({
      Number: inv.invoiceNumber || '',
      Status: inv.status || '',
      Amount: inv.amount || 0,
      Due: inv.dueDate || '',
      Contact: inv.contactName || '',
    })));
  };

  return (
  <div className="p-6">
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Data Management</h1>
      <p className="text-gray-600 mb-8">Backup, import, export, and manage your data.</p>
      
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Backup & Export</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={handleExportAll} className="p-4 border border-gray-300 rounded-lg text-left hover:bg-gray-50">
              <h3 className="font-medium text-gray-900">Export All Data</h3>
              <p className="text-sm text-gray-600 mt-1">Download contacts, estimates & invoices as CSV</p>
            </button>
            <button
              onClick={() => downloadCsv('contacts.csv', state.contacts.map(c => ({
                Name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
                Email: c.email || '',
                Phone: c.phone || '',
                Status: c.status || '',
                Company: c.company || '',
                Address: c.address || '',
                City: c.city || '',
                State: c.state || '',
              })))}
              className="p-4 border border-gray-300 rounded-lg text-left hover:bg-gray-50"
            >
              <h3 className="font-medium text-gray-900">Export Contacts</h3>
              <p className="text-sm text-gray-600 mt-1">Customer and lead information only</p>
            </button>
            <button
              onClick={() => downloadCsv('estimates.csv', state.estimates.map(e => ({
                Number: e.estimateNumber || '',
                Title: e.title || '',
                Status: e.status || '',
                Subtotal: e.amount || 0,
                Tax: e.tax || 0,
                Total: e.total || 0,
                Contact: e.contactName || '',
                Created: e.createdAt || '',
                ValidUntil: e.validUntil || '',
              })))}
              className="p-4 border border-gray-300 rounded-lg text-left hover:bg-gray-50"
            >
              <h3 className="font-medium text-gray-900">Export Estimates</h3>
              <p className="text-sm text-gray-600 mt-1">All estimates and project data</p>
            </button>
            <button
              onClick={() => downloadCsv('invoices.csv', state.invoices.map(inv => ({
                Number: inv.invoiceNumber || '',
                Status: inv.status || '',
                Amount: inv.amount || 0,
                Due: inv.dueDate || '',
                Contact: inv.contactName || '',
                PaidAt: inv.paidAt || '',
              })))}
              className="p-4 border border-gray-300 rounded-lg text-left hover:bg-gray-50"
            >
              <h3 className="font-medium text-gray-900">Export Invoices</h3>
              <p className="text-sm text-gray-600 mt-1">Billing and payment records</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

// Additional placeholder components for remaining settings sections
const CommunicationSettings: React.FC = () => <SettingsPlaceholder title="Communication Settings" />;
const CalendarSettings: React.FC = () => <SettingsPlaceholder title="Calendar Settings" />;
const DocumentSettings: React.FC = () => <SettingsPlaceholder title="Document Settings" />;
const BillingSettings: React.FC = () => <BillingSettingsPage />;
const ReportingSettings: React.FC = () => <SettingsPlaceholder title="Reporting Settings" />;
const SupportSettings: React.FC = () => <SettingsPlaceholder title="Help & Support" />;

const SettingsPlaceholder: React.FC<{ title: string }> = ({ title }) => (
  <div className="p-6">
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-gray-600 mb-2">Coming Soon</h2>
        <p className="text-gray-500">This settings section is currently under development.</p>
      </div>
    </div>
  </div>
);

export default MainSettings;
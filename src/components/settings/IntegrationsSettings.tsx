import React, { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  AlertCircle, 
  Loader2,
  Eye,
  EyeOff,
  TestTube,
  Cloud,
  CreditCard,
  Mail,
  Shield,
  MapPin,
  Calculator,
  Zap,
  Plus,
  Edit3,
  Link2
} from 'lucide-react';
import { BaseIntegration } from '../../lib/integrations/apiTypes';
import { integrationManager } from '../../lib/integrations/integrationManager';
import { supabase } from '../../lib/supabase';

// Integration Settings Main Component
const IntegrationsSettings: React.FC = () => {
  const [integrations, setIntegrations] = useState<Record<string, BaseIntegration[]>>({});
  const [selectedIntegration, setSelectedIntegration] = useState<BaseIntegration | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [qbBanner, setQbBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    initializeIntegrations();

    // Handle QuickBooks OAuth redirect params
    const params = new URLSearchParams(window.location.search);
    if (params.get('qb_connected') === '1') {
      setQbBanner({ type: 'success', message: 'QuickBooks connected successfully!' });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('qb_error')) {
      setQbBanner({ type: 'error', message: `QuickBooks connection failed: ${decodeURIComponent(params.get('qb_error')!)}` });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const initializeIntegrations = async () => {
    setLoading(true);
    try {
      await integrationManager.initializeIntegrations();
      // Load credentials from Supabase — localStorage only holds meta (no keys).
      // This ensures integrations show as configured in private browsers and
      // after dormancy, even when localStorage is empty or stale.
      await integrationManager.loadSavedIntegrationsAsync();
      const groupedIntegrations = integrationManager.getIntegrationsByCategory();
      setIntegrations(groupedIntegrations);
    } catch (error) {
      console.error('Failed to initialize integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleIntegration = async (id: string, enabled: boolean) => {
    try {
      await integrationManager.toggleIntegration(id, enabled);
      await initializeIntegrations();
    } catch (error) {
      console.error('Failed to toggle integration:', error);
    }
  };

  const handleConfigureIntegration = (integration: BaseIntegration) => {
    setSelectedIntegration(integration);
    setShowConfigModal(true);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'aerial-imagery': return <MapPin className="w-5 h-5" />;
      case 'payment-processing': return <CreditCard className="w-5 h-5" />;
      case 'weather': return <Cloud className="w-5 h-5" />;
      case 'accounting': return <Calculator className="w-5 h-5" />;
      case 'communication': return <Mail className="w-5 h-5" />;
      case 'security': return <Shield className="w-5 h-5" />;
      default: return <Zap className="w-5 h-5" />;
    }
  };

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'aerial-imagery': return 'Aerial Imagery & Measurements';
      case 'payment-processing': return 'Payment Processing';
      case 'weather': return 'Weather & Hail Tracking';
      case 'accounting': return 'Accounting & Finance';
      case 'communication': return 'Communication & Messaging';
      case 'security': return 'Security & Authentication';
      default: return category;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading integrations...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">API Integrations</h1>
        <p className="text-gray-600">
          Connect your CRM with essential business tools and services. Configure payment processing,
          aerial imagery, weather tracking, accounting, and communication services.
        </p>
      </div>

      {/* QuickBooks OAuth banner */}
      {qbBanner && (
        <div className={`mb-6 flex items-center gap-3 px-4 py-3 rounded-lg border ${
          qbBanner.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {qbBanner.type === 'success'
            ? <Check className="w-5 h-5 flex-shrink-0" />
            : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <span className="text-sm font-medium">{qbBanner.message}</span>
          <button onClick={() => setQbBanner(null)} className="ml-auto text-current opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Integration Categories */}
      <div className="space-y-8">
        {Object.entries(integrations).map(([category, categoryIntegrations]) => (
          <div key={category} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                {getCategoryIcon(category)}
                <h2 className="text-lg font-semibold text-gray-900">
                  {getCategoryTitle(category)}
                </h2>
                <span className="text-sm text-gray-500">
                  ({categoryIntegrations.filter(i => i.isEnabled).length} of {categoryIntegrations.length} enabled)
                </span>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categoryIntegrations.map((integration) => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    onToggle={handleToggleIntegration}
                    onConfigure={() => handleConfigureIntegration(integration)}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Configuration Modal */}
      {showConfigModal && selectedIntegration && (
        <IntegrationConfigModal
          integration={selectedIntegration}
          supabaseClient={supabase}
          onClose={() => {
            setShowConfigModal(false);
            setSelectedIntegration(null);
          }}
          onSave={async () => {
            await initializeIntegrations();
            setShowConfigModal(false);
            setSelectedIntegration(null);
          }}
        />
      )}
    </div>
  );
};

// Individual Integration Card
interface IntegrationCardProps {
  integration: BaseIntegration;
  onToggle: (id: string, enabled: boolean) => void;
  onConfigure: () => void;
}

const IntegrationCard: React.FC<IntegrationCardProps> = ({ integration, onToggle, onConfigure }) => {
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      await onToggle(integration.id, !integration.isEnabled);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className={`border border-gray-200 rounded-lg p-4 transition-all duration-200 ${
      integration.isEnabled ? 'ring-2 ring-blue-500/20 border-blue-200' : 'hover:border-gray-300'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">{integration.name}</h3>
          <p className="text-sm text-gray-600 mb-2">{integration.description}</p>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              getStatusColor(integration.status)
            }`}>
              {integration.status === 'connected' && <Check className="w-3 h-3 mr-1" />}
              {integration.status === 'error' && <AlertCircle className="w-3 h-3 mr-1" />}
              {integration.status === 'pending' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              {integration.status.charAt(0).toUpperCase() + integration.status.slice(1)}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={handleToggle}
            disabled={isToggling}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              integration.isEnabled ? 'bg-blue-600' : 'bg-gray-200'
            } ${isToggling ? 'opacity-50' : ''}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              integration.isEnabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
          <button
            onClick={onConfigure}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
          >
            {integration.isConfigured ? <Edit3 className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {integration.isConfigured ? 'Edit' : 'Setup'}
          </button>
        </div>
      </div>
      {integration.lastSync && (
        <div className="text-xs text-gray-500 border-t border-gray-100 pt-2">
          Last sync: {new Date(integration.lastSync).toLocaleDateString()}
        </div>
      )}
    </div>
  );
};

// Integration Configuration Modal
interface IntegrationConfigModalProps {
  integration: BaseIntegration;
  supabaseClient: any;
  onClose: () => void;
  onSave: () => void;
}

const IntegrationConfigModal: React.FC<IntegrationConfigModalProps> = ({ integration, supabaseClient, onClose, onSave }) => {
  const [credentials, setCredentials] = useState<Record<string, any>>(integration.credentials || {});
  const [settings, setSettings] = useState<Record<string, any>>(integration.settings || {});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [qbConnecting, setQbConnecting] = useState(false);

  const isQuickBooks = integration.id === 'quickbooks';
  const isQbConnected = integration.status === 'connected';

  const handleConnectQuickBooks = async () => {
    setQbConnecting(true);
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/quickbooks-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      const { authUri } = await res.json();
      if (authUri) {
        window.location.href = authUri;
      } else {
        throw new Error('No auth URI returned from server');
      }
    } catch (err) {
      alert(`Could not start QuickBooks connection: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setQbConnecting(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await integrationManager.testIntegration(integration.id, credentials, settings);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Test failed',
        timestamp: new Date().toISOString()
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await integrationManager.configureIntegration(integration.id, credentials, settings);
      onSave();
    } catch (error) {
      console.error('Failed to save integration:', error);
    } finally {
      setSaving(false);
    }
  };

  const renderConfigFields = () => {
    return getConfigFieldsForIntegration(integration.id).map((field) => (
      <div key={field.name}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {field.type === 'password' ? (
          <div className="relative">
            <input
              type={showPassword[field.name] ? 'text' : 'password'}
              value={credentials[field.name] || ''}
              onChange={(e) => setCredentials({...credentials, [field.name]: e.target.value})}
              placeholder={field.placeholder}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword({...showPassword, [field.name]: !showPassword[field.name]})}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword[field.name] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        ) : field.type === 'select' ? (
          <select
            value={credentials[field.name] || settings[field.name] || ''}
            onChange={(e) => {
              if (field.category === 'credential') {
                setCredentials({...credentials, [field.name]: e.target.value});
              } else {
                setSettings({...settings, [field.name]: e.target.value});
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select {field.label}</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        ) : (
          <input
            type={field.type || 'text'}
            value={credentials[field.name] || settings[field.name] || ''}
            onChange={(e) => {
              if (field.category === 'credential') {
                setCredentials({...credentials, [field.name]: e.target.value});
              } else {
                setSettings({...settings, [field.name]: e.target.value});
              }
            }}
            placeholder={field.placeholder}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        )}
        {field.help && (
          <p className="mt-1 text-sm text-gray-500">{field.help}</p>
        )}
      </div>
    ));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Configure {integration.name}</h3>
            <p className="text-sm text-gray-600 mt-1">{integration.description}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[calc(90vh-140px)] overflow-y-auto">
          {isQuickBooks ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-900">QuickBooks — Coming Soon</p>
                  <p className="text-sm text-blue-700 mt-0.5">QuickBooks sync is currently in development and will be available in a future update.</p>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                QuickBooks will use OAuth 2.0 for a secure connection — no passwords stored. Stay tuned for the full release.
              </p>
              <button
                disabled
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 text-gray-500 font-semibold rounded-lg cursor-not-allowed"
              >
                <Link2 className="w-4 h-4" /> Coming Soon
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {renderConfigFields()}
              {testResult && (
                <div className={`mt-6 p-4 rounded-lg ${
                  testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {testResult.success
                      ? <Check className="w-5 h-5 text-green-600" />
                      : <AlertCircle className="w-5 h-5 text-red-600" />}
                    <span className={`font-medium ${testResult.success ? 'text-green-900' : 'text-red-900'}`}>
                      {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                    </span>
                  </div>
                  <p className={`text-sm ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                    {testResult.message}
                  </p>
                  {testResult.details && (
                    <div className="mt-2 text-sm text-gray-600">
                      {Object.entries(testResult.details).map(([key, value]) => (
                        <div key={key}>{key}: {String(value)}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          {!isQuickBooks ? (
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          ) : <div />}
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-700 font-medium">
              {isQuickBooks ? 'Close' : 'Cancel'}
            </button>
            {!isQuickBooks && (
              <button
                onClick={handleSave}
                disabled={saving || !testResult?.success}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Configuration fields for each integration
const getConfigFieldsForIntegration = (integrationId: string) => {
  switch (integrationId) {
    case 'eagleview':
      return [
        { name: 'apiKey', label: 'API Key', type: 'password', required: true, category: 'credential', placeholder: 'Your EagleView API key' },
        { name: 'clientId', label: 'Client ID', type: 'text', required: true, category: 'credential', placeholder: 'Your EagleView Client ID' },
        { name: 'environment', label: 'Environment', type: 'select', required: true, category: 'credential', options: [
          { value: 'sandbox', label: 'Sandbox (Testing)' },
          { value: 'production', label: 'Production' }
        ]},
        { name: 'defaultReportType', label: 'Default Report Type', type: 'select', category: 'setting', options: [
          { value: 'standard', label: 'Standard Report' },
          { value: 'premium', label: 'Premium Report' }
        ]}
      ];
    case 'stripe':
      return [
        { name: 'publishableKey', label: 'Publishable Key', type: 'text', required: true, category: 'credential', placeholder: 'pk_test_...' },
        { name: 'secretKey', label: 'Secret Key', type: 'password', required: true, category: 'credential', placeholder: 'sk_test_...' },
        { name: 'webhookSecret', label: 'Webhook Secret', type: 'password', category: 'credential', placeholder: 'whsec_...' },
        { name: 'environment', label: 'Environment', type: 'select', required: true, category: 'credential', options: [
          { value: 'test', label: 'Test Mode' },
          { value: 'live', label: 'Live Mode' }
        ]},
        { name: 'currency', label: 'Default Currency', type: 'select', category: 'setting', options: [
          { value: 'usd', label: 'US Dollar' },
          { value: 'cad', label: 'Canadian Dollar' }
        ]}
      ];
    case 'twilio':
      return [
        { name: 'accountSid', label: 'Account SID', type: 'text', required: true, category: 'credential' },
        { name: 'authToken', label: 'Auth Token', type: 'password', required: true, category: 'credential' },
        { name: 'fromNumber', label: 'From Phone Number', type: 'tel', required: true, category: 'setting', placeholder: '+1234567890' }
      ];
    default:
      return [
        { name: 'apiKey', label: 'API Key', type: 'password', required: true, category: 'credential' }
      ];
  }
};

// Helper function to get status colors
const getStatusColor = (status: string) => {
  switch (status) {
    case 'connected': return 'text-green-600 bg-green-100';
    case 'disconnected': return 'text-gray-600 bg-gray-100';
    case 'error': return 'text-red-600 bg-red-100';
    case 'pending': return 'text-yellow-600 bg-yellow-100';
    default: return 'text-gray-600 bg-gray-100';
  }
};

export default IntegrationsSettings;

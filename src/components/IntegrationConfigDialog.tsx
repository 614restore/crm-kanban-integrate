// Integration Configuration Dialog Component
import React, { useState, useMemo } from 'react';
import { AlertCircle, Check, ExternalLink, Loader2, X } from 'lucide-react';
import { BaseIntegration } from '@/lib/integrations/apiTypes';
import { useAuth } from '@/lib/authContext';

interface IntegrationConfigDialogProps {
  integration: BaseIntegration & { credentialFields?: Record<string, any> };
  isOpen: boolean;
  onClose: () => void;
  onConfigure: (credentials: Record<string, any>, settings: Record<string, any>) => Promise<void>;
  onTest: (credentials: Record<string, any>) => Promise<{ success: boolean; message: string; details?: Record<string, any> }>;
}

// Define credential fields for each integration
const INTEGRATION_CONFIGS: Record<string, Array<{
  field: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'textarea' | 'number';
  required: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  help?: string;
}>> = {
  stripe: [
    { field: 'secretKey', label: 'Secret Key', type: 'password', required: true, placeholder: 'sk_live_...' },
    { field: 'publishableKey', label: 'Publishable Key', type: 'password', required: false, placeholder: 'pk_live_...' },
  ],
  quickbooks: [
    { field: 'accessToken', label: 'Access Token', type: 'password', required: true },
    { field: 'companyId', label: 'Company ID', type: 'text', required: true },
    {
      field: 'environment',
      label: 'Environment',
      type: 'select',
      required: true,
      options: [
        { label: 'Production', value: 'production' },
        { label: 'Sandbox', value: 'sandbox' },
      ],
    },
  ],
  twilio: [
    { field: 'accountSid', label: 'Account SID', type: 'password', required: true },
    { field: 'authToken', label: 'Auth Token', type: 'password', required: true },
    { field: 'fromNumber', label: 'From Phone Number', type: 'text', required: true, placeholder: '+1234567890' },
  ],
  eagleview: [
    { field: 'apiKey', label: 'API Key', type: 'password', required: true },
    { field: 'clientId', label: 'Client ID', type: 'text', required: true },
    {
      field: 'environment',
      label: 'Environment',
      type: 'select',
      required: true,
      options: [
        { label: 'Production', value: 'production' },
        { label: 'Sandbox', value: 'sandbox' },
      ],
    },
  ],
  openweather: [
    { field: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Your OpenWeather API key', help: 'Get your free API key at openweathermap.org/api' },
  ],
  hailtrace: [
    { field: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Your HailTrace API key', help: 'Get your API key at hailtrace.com — required to look up hail events on insurance contacts' },
    {
      field: 'environment',
      label: 'Environment',
      type: 'select',
      required: true,
      options: [
        { label: 'Production', value: 'production' },
        { label: 'Sandbox', value: 'sandbox' },
      ],
      help: 'Use Production for live hail data. Sandbox for testing only.',
    },
  ],
  roofr: [
    { field: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Your Roofr API key', help: 'Get your API key at app.roofr.com → Settings → Integrations' },
    {
      field: 'environment',
      label: 'Environment',
      type: 'select',
      required: true,
      options: [
        { label: 'Production', value: 'production' },
        { label: 'Sandbox', value: 'sandbox' },
      ],
      help: 'Use Production for live aerial reports. Sandbox for testing only.',
    },
  ],
  sendgrid: [
    { field: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'SG.xxxxxxxx', help: 'Create an API key at app.sendgrid.com → Settings → API Keys. Requires "Mail Send" permission.' },
    { field: 'fromEmail', label: 'From Email Address', type: 'text', required: true, placeholder: 'noreply@yourcompany.com', help: 'Must be a verified sender in your SendGrid account.' },
    { field: 'fromName', label: 'From Name', type: 'text', required: false, placeholder: 'TrussCTR Notifications' },
  ],
  square: [
    { field: 'accessToken', label: 'Access Token', type: 'password', required: true, placeholder: 'EAAAl...', help: 'Get your access token at developer.squareup.com → Applications → your app → Credentials.' },
    { field: 'locationId', label: 'Location ID', type: 'text', required: true, placeholder: 'Your Square location ID', help: 'Found in your Square Dashboard under Account & Settings → Locations.' },
    {
      field: 'environment',
      label: 'Environment',
      type: 'select',
      required: true,
      options: [
        { label: 'Production', value: 'production' },
        { label: 'Sandbox', value: 'sandbox' },
      ],
    },
  ],
  auth0: [
    { field: 'domain', label: 'Domain', type: 'text', required: true, placeholder: 'yourapp.us.auth0.com', help: 'Found in your Auth0 Dashboard → Applications → your app → Settings.' },
    { field: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'Auth0 Client ID' },
    { field: 'clientSecret', label: 'Client Secret', type: 'password', required: true, placeholder: 'Auth0 Client Secret' },
  ],
};

export function IntegrationConfigDialog({
  integration,
  isOpen,
  onClose,
  onConfigure,
  onTest,
}: IntegrationConfigDialogProps) {
  const [credentials, setCredentials] = useState<Record<string, any>>(integration.credentials || {});
  const [settings, setSettings] = useState<Record<string, any>>(integration.settings || {});
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qbConnecting, setQbConnecting] = useState(false);
  const { session } = useAuth();

  const handleQBConnect = async () => {
    setQbConnecting(true);
    try {
      const res = await fetch('/api/quickbooks-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get QuickBooks auth URL');
      window.open(data.authUri, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setQbConnecting(false);
    }
  };

  const configFields = useMemo(() => {
    return INTEGRATION_CONFIGS[integration.id] || [];
  }, [integration.id]);

  const handleCredentialChange = (field: string, value: any) => {
    setCredentials((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSettingChange = (field: string, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateCredentials = (): boolean => {
    for (const field of configFields) {
      if (field.required && !credentials[field.field]) {
        setError(`${field.label} is required`);
        return false;
      }
    }
    return true;
  };

  const handleTest = async () => {
    if (!validateCredentials()) return;

    setTestLoading(true);
    try {
      const result = await onTest(credentials);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      });
    } finally {
      setTestLoading(false);
    }
  };

  const handleConfigure = async () => {
    if (!validateCredentials()) return;

    setLoading(true);
    try {
      await onConfigure(credentials, settings);
      setError(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Configuration failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Configure {integration.name}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {testResult && (
            <div
              className={`p-3 border rounded-lg flex gap-3 ${
                testResult.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              {testResult.success ? (
                <Check size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`text-sm font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {testResult.message}
                </p>
                {testResult.success && testResult.message?.includes('details') && (
                  <p className="text-xs text-green-700 mt-1">Connection verified successfully</p>
                )}
              </div>
            </div>
          )}

          {/* QuickBooks: OAuth flow only — no manual tokens */}
          {integration.id === 'quickbooks' ? (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 font-medium mb-1">QuickBooks uses OAuth 2.0</p>
                <p className="text-sm text-blue-700">
                  Connect your QuickBooks account securely. You'll be redirected to Intuit to authorize access —
                  no passwords are stored in TrussCTR.
                </p>
              </div>
              {integration.isConfigured && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex gap-2">
                  <Check size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-700">QuickBooks is currently connected.</p>
                </div>
              )}
              <button
                onClick={handleQBConnect}
                disabled={qbConnecting}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#2CA01C] text-white rounded-lg hover:bg-[#239117] font-medium transition-colors disabled:opacity-60"
              >
                {qbConnecting ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                {integration.isConfigured ? 'Reconnect QuickBooks' : 'Connect QuickBooks'}
              </button>
              <p className="text-xs text-gray-500 text-center">
                After authorizing, close that window and refresh this page.
              </p>
            </div>
          ) : (
          /* Credential Fields */
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Credentials</label>
            {configFields.map((field) => (
              <div key={field.field}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-600">*</span>}
                </label>
                {field.type === 'select' ? (
                  <select
                    value={credentials[field.field] || ''}
                    onChange={(e) => handleCredentialChange(field.field, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    <option value="">Select {field.label}</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    value={credentials[field.field] || ''}
                    onChange={(e) => handleCredentialChange(field.field, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    rows={3}
                  />
                ) : (
                  <input
                    type={field.type}
                    value={credentials[field.field] || ''}
                    onChange={(e) => handleCredentialChange(field.field, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                )}
                {field.help && <p className="text-xs text-gray-500 mt-1">{field.help}</p>}
              </div>
            ))}
          </div>
          )}

          {/* Settings Section */}
          {Object.keys(settings).length > 0 && (
            <div className="space-y-3 border-t border-gray-200 pt-4">
              <label className="block text-sm font-medium text-gray-700">Settings</label>
              {/* Add setting fields here as needed */}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          {integration.id !== 'quickbooks' && (
            <>
              <button
                onClick={handleTest}
                disabled={testLoading || loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {testLoading && <Loader2 size={16} className="animate-spin" />}
                Test Connection
              </button>
              <button
                onClick={handleConfigure}
                disabled={loading || testLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Save Configuration
              </button>
            </>
          )}
          <button
            onClick={onClose}
            disabled={loading || testLoading}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {integration.id === 'quickbooks' ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default IntegrationConfigDialog;

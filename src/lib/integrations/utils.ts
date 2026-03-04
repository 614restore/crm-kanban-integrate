// Integration Utilities and Helpers
import { BaseIntegration } from './apiTypes';

/**
 * Format integration status for display
 */
export function formatIntegrationStatus(status: string): string {
  const statusMap: Record<string, string> = {
    connected: 'Connected',
    disconnected: 'Disconnected',
    error: 'Error',
    pending: 'Pending',
  };
  return statusMap[status] || status;
}

/**
 * Get status color for integration
 */
export function getIntegrationStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    connected: 'text-green-600 bg-green-50 border-green-200',
    disconnected: 'text-gray-600 bg-gray-50 border-gray-200',
    error: 'text-red-600 bg-red-50 border-red-200',
    pending: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  };
  return colorMap[status] || 'text-gray-600 bg-gray-50 border-gray-200';
}

/**
 * Check if integration is fully configured
 */
export function isIntegrationReady(integration: BaseIntegration): boolean {
  return integration.isEnabled && integration.isConfigured && integration.status === 'connected';
}

/**
 * Get recommended sync interval for integration type
 */
export function getRecommendedSyncInterval(category: string): number {
  const intervals: Record<string, number> = {
    'accounting': 60, // 1 hour
    'payment-processing': 30, // 30 minutes
    'communication': 120, // 2 hours
    'weather': 180, // 3 hours
    'aerial-imagery': 240, // 4 hours
    'security': 60, // 1 hour
  };
  return intervals[category] || 120;
}

/**
 * Validate integration credentials
 */
export function validateCredentials(
  integrationId: string,
  credentials: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  switch (integrationId) {
    case 'stripe':
      if (!credentials.secretKey) errors.push('Secret Key is required');
      if (!credentials.secretKey?.startsWith('sk_')) {
        errors.push('Invalid Stripe Secret Key format');
      }
      break;

    case 'quickbooks':
      if (!credentials.accessToken) errors.push('Access Token is required');
      if (!credentials.companyId) errors.push('Company ID is required');
      break;

    case 'twilio':
      if (!credentials.accountSid) errors.push('Account SID is required');
      if (!credentials.authToken) errors.push('Auth Token is required');
      if (!credentials.fromNumber) errors.push('From Phone Number is required');
      break;

    case 'eagleview':
      if (!credentials.apiKey) errors.push('API Key is required');
      if (!credentials.clientId) errors.push('Client ID is required');
      break;

    case 'openweather':
      if (!credentials.apiKey) errors.push('API Key is required');
      break;

    case 'hailtrace':
      if (!credentials.apiKey) errors.push('API Key is required');
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format last sync time for display
 */
export function formatLastSyncTime(lastSync?: string): string {
  if (!lastSync) return 'Never';

  const date = new Date(lastSync);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

/**
 * Get integration icon or emoji
 */
export function getIntegrationIcon(integrationId: string): string {
  const icons: Record<string, string> = {
    stripe: '💳',
    quickbooks: '💰',
    twilio: '📱',
    eagleview: '🦅',
    openweather: '🌤️',
    hailtrace: '⛈️',
  };
  return icons[integrationId] || '🔗';
}

/**
 * Build integration documentation URL
 */
export function getIntegrationDocUrl(integrationId: string): string {
  const docUrls: Record<string, string> = {
    stripe: 'https://stripe.com/docs',
    quickbooks: 'https://developer.intuit.com/app/developer/qbo/docs',
    twilio: 'https://www.twilio.com/docs',
    eagleview: 'https://developer.eagleview.com',
    openweather: 'https://openweathermap.org/api',
    hailtrace: 'https://www.hailtrace.com/api',
  };
  return docUrls[integrationId] || 'https://docs.example.com';
}

/**
 * Get integration setup difficulty
 */
export function getSetupDifficulty(integrationId: string): 'easy' | 'moderate' | 'hard' {
  const difficulty: Record<string, 'easy' | 'moderate' | 'hard'> = {
    twilio: 'easy',
    openweather: 'easy',
    stripe: 'moderate',
    quickbooks: 'moderate',
    eagleview: 'hard',
    hailtrace: 'hard',
  };
  return difficulty[integrationId] || 'moderate';
}

/**
 * Get placeholder descriptions for each field type
 */
export function getFieldPlaceholder(integrationId: string, fieldName: string): string | undefined {
  const placeholders: Record<string, Record<string, string>> = {
    stripe: {
      secretKey: 'sk_live_51234567890abcdefghijk',
      publishableKey: 'pk_live_51234567890abcdefghijk',
    },
    quickbooks: {
      companyId: '1234567890',
      accessToken: 'eyJlbmMiOiJBMTI4Q0JDLUhTMjU2IiwiYWxnIjoiZGlyIn0...',
    },
    twilio: {
      accountSid: 'AC0123456789abcdef0123456789abcde',
      fromNumber: '+1234567890',
    },
    eagleview: {
      apiKey: 'ev_live_abc123def456',
      clientId: 'client_123456789',
    },
  };

  return placeholders[integrationId]?.[fieldName];
}

export default {
  formatIntegrationStatus,
  getIntegrationStatusColor,
  isIntegrationReady,
  getRecommendedSyncInterval,
  validateCredentials,
  formatLastSyncTime,
  getIntegrationIcon,
  getIntegrationDocUrl,
  getSetupDifficulty,
  getFieldPlaceholder,
};

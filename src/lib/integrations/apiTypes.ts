// API Integration Types for TrussCTR CRM
// Comprehensive integration framework for roofing contractor business APIs

export interface BaseIntegration {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  isEnabled: boolean;
  isConfigured: boolean;
  lastSync?: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  credentials?: Record<string, any>;
  settings?: Record<string, any>;
}

export type IntegrationCategory = 
  | 'aerial-imagery'
  | 'payment-processing' 
  | 'weather'
  | 'accounting'
  | 'communication'
  | 'security'
  | 'project-management'
  | 'insurance'
  | 'mapping'
  | 'ai-assistant';

// EagleView Integration for Aerial Imagery
export interface EagleViewIntegration extends BaseIntegration {
  category: 'aerial-imagery';
  credentials: {
    apiKey: string;
    clientId: string;
    environment: 'sandbox' | 'production';
  };
  settings: {
    autoOrderReports: boolean;
    defaultReportType: 'premium' | 'standard';
    webhookUrl?: string;
  };
}

// Stripe Payment Processing
export interface StripeIntegration extends BaseIntegration {
  category: 'payment-processing';
  credentials: {
    publishableKey: string;
    secretKey: string;
    webhookSecret: string;
    environment: 'test' | 'live';
  };
  settings: {
    currency: string;
    captureMethod: 'automatic' | 'manual';
    paymentMethods: string[];
    enableRecurring: boolean;
  };
}

// Alternative Payment Processors
export interface PaymentProcessorIntegration extends BaseIntegration {
  category: 'payment-processing';
  provider: 'stripe' | 'square' | 'paypal' | 'authorize-net' | 'clover';
  credentials: Record<string, string>;
  settings: {
    currency: string;
    fees: {
      percentage: number;
      fixed: number;
    };
  };
}

// Weather APIs
export interface WeatherIntegration extends BaseIntegration {
  category: 'weather';
  provider: 'openweather' | 'weather-api' | 'accuweather';
  credentials: {
    apiKey: string;
  };
  settings: {
    units: 'metric' | 'imperial';
    alertThreshold: {
      windSpeed: number;
      precipitation: number;
      temperature: number;
    };
  };
}

// HailTrace for Hail Damage Tracking
export interface HailTraceIntegration extends BaseIntegration {
  category: 'weather';
  credentials: {
    apiKey: string;
    environment: 'sandbox' | 'production';
  };
  settings: {
    alertRadius: number; // miles
    autoCreateLeads: boolean;
    severityThreshold: 'minor' | 'moderate' | 'severe';
  };
}

// QuickBooks Accounting
export interface QuickBooksIntegration extends BaseIntegration {
  category: 'accounting';
  credentials: {
    clientId: string;
    clientSecret: string;
    accessToken: string;
    refreshToken: string;
    companyId: string;
    environment: 'sandbox' | 'production';
  };
  settings: {
    syncIntervalHours: number;
    autoCreateCustomers: boolean;
    autoCreateInvoices: boolean;
    defaultAccount: string;
  };
}

// Email Services
export interface EmailIntegration extends BaseIntegration {
  category: 'communication';
  provider: 'resend' | 'sendgrid' | 'mailgun' | 'ses' | 'office365' | 'gmail';
  credentials: {
    apiKey?: string;
    smtpHost?: string;
    smtpPort?: number;
    username?: string;
    password?: string;
  };
  settings: {
    fromName: string;
    fromEmail: string;
    replyToEmail: string;
    enableTracking: boolean;
    templates: {
      welcome: string;
      estimate: string;
      invoice: string;
      followUp: string;
    };
  };
}

// SMS/Text Services
export interface SMSIntegration extends BaseIntegration {
  category: 'communication';
  provider: 'twilio' | 'textmagic' | 'clicksend' | 'messagebird';
  credentials: {
    accountSid?: string;
    authToken?: string;
    apiKey?: string;
  };
  settings: {
    fromNumber: string;
    enableDeliveryReports: boolean;
    allowOptOut: boolean;
    templates: {
      appointment: string;
      estimate: string;
      completion: string;
    };
  };
}

// 2FA Security Providers
export interface TwoFactorIntegration extends BaseIntegration {
  category: 'security';
  provider: 'auth0' | 'okta' | 'firebase' | 'authy' | 'duo';
  credentials: {
    clientId: string;
    clientSecret: string;
    domain?: string;
  };
  settings: {
    requireFor: ('login' | 'sensitive-actions' | 'admin')[];
    method: 'sms' | 'email' | 'app' | 'all';
    backupCodes: boolean;
  };
}

// Team & Company Management
export interface CompanySettings {
  id: string;
  name: string;
  logo?: string;
  addresses: CompanyAddress[];
  primaryOfficeId: string;
  timezone: string;
  businessHours: BusinessHours;
  settings: {
    requireApprovalFor: ('estimates' | 'invoices' | 'payments')[];
    maxEstimateAmount: number;
    defaultMarkup: number;
    taxRate: number;
  };
}

export interface CompanyAddress {
  id: string;
  type: 'headquarters' | 'office' | 'warehouse';
  name: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
  isActive: boolean;
}

export interface BusinessHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface DayHours {
  isOpen: boolean;
  openTime: string; // HH:MM format
  closeTime: string; // HH:MM format
  breaks?: {
    start: string;
    end: string;
    description: string;
  }[];
}

export interface TeamMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: TeamRole;
  permissions: Permission[];
  officeId: string;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  inviteStatus: 'pending' | 'accepted' | 'expired';
}

export interface TeamRole {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isCustom: boolean;
}

export interface Permission {
  id: string;
  resource: 'contacts' | 'estimates' | 'invoices' | 'calendar' | 'reports' | 'settings' | 'team';
  actions: ('read' | 'write' | 'delete' | 'admin')[];
}

// Integration API Response Types
export interface IntegrationTestResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface IntegrationSyncResult {
  success: boolean;
  recordsProcessed: number;
  errors: string[];
  timestamp: string;
  duration: number; // milliseconds
}

// Webhook Types
export interface WebhookConfig {
  id: string;
  integrationId: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  lastDelivery?: string;
  failureCount: number;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, any>;
  timestamp: string;
  source: string;
}

// API Error Types
export interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  integration: string;
}

// AI Assistant Integration with Multi-Provider Support
export interface AIAssistantIntegration extends BaseIntegration {
  category: 'ai-assistant';
  credentials: {
    provider: 'openai' | 'anthropic' | 'google';
    apiKey: string;
    organizationId?: string;
    region?: string;
    userId: string;
    companyId: string;
  };
  settings: {
    model: string;
    maxTokens: number;
    temperature: number;
    systemPrompt: string;
    features: {
      customerSupport: boolean;
      emailDrafting: boolean;
      contractAnalysis: boolean;
      estimateReview: boolean;
      leadScoring: boolean;
    };
  };
  metadata?: {
    providedBy: string;
    approvedBy?: string;
    approvalDate?: string;
    usageCount?: number;
    lastUsed?: string;
  };
}

// Integration Templates
export const INTEGRATION_TEMPLATES: Record<string, Partial<BaseIntegration>> = {
  eagleview: {
    name: 'EagleView',
    description: 'Aerial imagery and roof measurements',
    category: 'aerial-imagery'
  },
  stripe: {
    name: 'Stripe',
    description: 'Payment processing and invoicing',
    category: 'payment-processing'
  },
  square: {
    name: 'Square',
    description: 'Payment processing and POS',
    category: 'payment-processing'
  },
  quickbooks: {
    name: 'QuickBooks',
    description: 'Accounting and financial management',
    category: 'accounting'
  },
  openweather: {
    name: 'OpenWeather',
    description: 'Weather data and forecasting',
    category: 'weather'
  },
  hailtrace: {
    name: 'HailTrace',
    description: 'Hail damage tracking and alerts',
    category: 'weather'
  },
  twilio: {
    name: 'Twilio',
    description: 'SMS and voice communication',
    category: 'communication'
  },
  sendgrid: {
    name: 'SendGrid',
    description: 'Email delivery and marketing',
    category: 'communication'
  },
  auth0: {
    name: 'Auth0',
    description: 'Identity and 2FA security',
    category: 'security'
  },
  aiassistant: {
    name: 'AI Assistant',
    description: 'OpenAI, Claude, or Gemini AI for business automation',
    category: 'ai-assistant'
  }
};
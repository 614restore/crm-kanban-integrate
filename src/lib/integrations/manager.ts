// Enhanced Integration Manager
import { BaseIntegration, IntegrationTestResult, IntegrationSyncResult, INTEGRATION_TEMPLATES } from './apiTypes';
import StripeIntegration from './stripe';
import QuickBooksIntegration from './quickbooks';
import TwilioIntegration from './twilio';
import EagleViewIntegration from './eagleview';
import { OpenWeatherIntegration, HailTraceIntegration } from './weather';

export class IntegrationManager {
  private integrations: Map<string, BaseIntegration> = new Map();
  private activeConnections: Map<string, any> = new Map();
  private webhookHandlers: Map<string, (...args: unknown[]) => void> = new Map();
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeIntegrations();
  }

  /**
   * Initialize all available integrations
   */
  private initializeIntegrations(): void {
    const savedIntegrations = this.loadSavedIntegrations();

    Object.entries(INTEGRATION_TEMPLATES).forEach(([id, template]) => {
      const existing = savedIntegrations.find((i) => i.id === id);
      if (existing) {
        this.integrations.set(id, existing);
      } else {
        this.integrations.set(id, {
          ...template,
          id,
          isEnabled: false,
          isConfigured: false,
          status: 'disconnected',
        } as BaseIntegration);
      }
    });
  }

  /**
   * Get all integrations
   */
  getAllIntegrations(): BaseIntegration[] {
    return Array.from(this.integrations.values());
  }

  /**
   * Get integrations grouped by category
   */
  getIntegrationsByCategory(): Record<string, BaseIntegration[]> {
    const grouped: Record<string, BaseIntegration[]> = {};

    for (const integration of this.integrations.values()) {
      if (!grouped[integration.category]) {
        grouped[integration.category] = [];
      }
      grouped[integration.category].push(integration);
    }

    return grouped;
  }

  /**
   * Get single integration
   */
  getIntegration(id: string): BaseIntegration | undefined {
    return this.integrations.get(id);
  }

  /**
   * Configure integration credentials and settings
   */
  async configureIntegration(
    id: string,
    credentials: Record<string, any>,
    settings: Record<string, any>
  ): Promise<boolean> {
    const integration = this.integrations.get(id);
    if (!integration) throw new Error(`Integration ${id} not found`);

    // Validate credentials
    const testResult = await this.testIntegration(id, credentials, settings);
    if (!testResult.success) {
      throw new Error(`Configuration test failed: ${testResult.message}`);
    }

    // Update integration
    integration.credentials = credentials;
    integration.settings = settings;
    integration.isConfigured = true;
    integration.status = 'connected';

    this.integrations.set(id, integration);
    await this.saveIntegrations();

    // Auto-connect if enabled
    if (integration.isEnabled) {
      await this.connectIntegration(id);
    }

    return true;
  }

  /**
   * Enable/disable integration
   */
  async toggleIntegration(id: string, enabled: boolean): Promise<void> {
    const integration = this.integrations.get(id);
    if (!integration) throw new Error(`Integration ${id} not found`);

    integration.isEnabled = enabled;

    if (enabled && integration.isConfigured) {
      await this.connectIntegration(id);
    } else {
      await this.disconnectIntegration(id);
    }

    this.integrations.set(id, integration);
    await this.saveIntegrations();
  }

  /**
   * Test integration connection
   */
  async testIntegration(
    id: string,
    credentials?: Record<string, any>,
    settings?: Record<string, any>
  ): Promise<IntegrationTestResult> {
    const testCredentials = credentials ?? this.integrations.get(id)?.credentials ?? {};
    const testSettings = settings ?? this.integrations.get(id)?.settings ?? {};

    try {
      switch (id) {
        case 'stripe':
          return await this.testStripe(testCredentials);
        case 'quickbooks':
          return await this.testQuickBooks(testCredentials);
        case 'twilio':
          return await this.testTwilio(testCredentials);
        case 'eagleview':
          return await this.testEagleView(testCredentials);
        case 'openweather':
          return await this.testOpenWeather(testCredentials);
        case 'hailtrace':
          return await this.testHailTrace(testCredentials);
        default:
          return {
            success: true,
            message: `${id} test not implemented, assuming success`,
            timestamp: new Date().toISOString(),
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Connect to integration
   */
  private async connectIntegration(id: string): Promise<void> {
    const integration = this.integrations.get(id);
    if (!integration?.credentials) return;

    try {
      let connection;

      switch (id) {
        case 'stripe':
          connection = new StripeIntegration(integration.credentials.secretKey);
          break;
        case 'quickbooks':
          connection = new QuickBooksIntegration(
            integration.credentials.accessToken,
            integration.credentials.companyId,
            integration.credentials.environment ?? 'production'
          );
          break;
        case 'twilio':
          connection = new TwilioIntegration(
            integration.credentials.accountSid,
            integration.credentials.authToken,
            integration.credentials.fromNumber
          );
          break;
        case 'eagleview':
          connection = new EagleViewIntegration(
            integration.credentials.apiKey,
            integration.credentials.clientId,
            integration.credentials.environment ?? 'production'
          );
          break;
        case 'openweather':
          connection = new OpenWeatherIntegration(integration.credentials.apiKey);
          break;
        case 'hailtrace':
          connection = new HailTraceIntegration(
            integration.credentials.apiKey,
            integration.credentials.environment ?? 'production'
          );
          break;
        default:
          return;
      }

      if (connection) {
        this.activeConnections.set(id, connection);
        integration.status = 'connected';
        integration.lastSync = new Date().toISOString();
      }
    } catch (error) {
      integration.status = 'error';
      console.error(`Failed to connect to ${id}:`, error);
    }
  }

  /**
   * Disconnect from integration
   */
  private async disconnectIntegration(id: string): Promise<void> {
    // Clear sync interval if exists
    const intervalId = this.syncIntervals.get(id);
    if (intervalId) {
      clearInterval(intervalId);
      this.syncIntervals.delete(id);
    }

    this.activeConnections.delete(id);
    const integration = this.integrations.get(id);
    if (integration) {
      integration.status = 'disconnected';
    }
  }

  /**
   * Test connections for individual integrations
   */
  private async testStripe(credentials: any): Promise<IntegrationTestResult> {
    if (!credentials?.secretKey) {
      return {
        success: false,
        message: 'Secret Key is required',
        timestamp: new Date().toISOString(),
      };
    }

    const stripe = new StripeIntegration(credentials.secretKey);
    return stripe.testConnection();
  }

  private async testQuickBooks(credentials: any): Promise<IntegrationTestResult> {
    if (!credentials?.accessToken || !credentials?.companyId) {
      return {
        success: false,
        message: 'Access Token and Company ID are required',
        timestamp: new Date().toISOString(),
      };
    }

    const qb = new QuickBooksIntegration(
      credentials.accessToken,
      credentials.companyId,
      credentials.environment ?? 'production'
    );
    return qb.testConnection();
  }

  private async testTwilio(credentials: any): Promise<IntegrationTestResult> {
    if (!credentials?.accountSid || !credentials?.authToken) {
      return {
        success: false,
        message: 'Account SID and Auth Token are required',
        timestamp: new Date().toISOString(),
      };
    }

    const twilio = new TwilioIntegration(credentials.accountSid, credentials.authToken, credentials.fromNumber);
    return twilio.testConnection();
  }

  private async testEagleView(credentials: any): Promise<IntegrationTestResult> {
    if (!credentials?.apiKey || !credentials?.clientId) {
      return {
        success: false,
        message: 'API Key and Client ID are required',
        timestamp: new Date().toISOString(),
      };
    }

    const eagleview = new EagleViewIntegration(
      credentials.apiKey,
      credentials.clientId,
      credentials.environment ?? 'production'
    );
    return eagleview.testConnection();
  }

  private async testOpenWeather(credentials: any): Promise<IntegrationTestResult> {
    if (!credentials?.apiKey) {
      return {
        success: false,
        message: 'API Key is required',
        timestamp: new Date().toISOString(),
      };
    }

    const openweather = new OpenWeatherIntegration(credentials.apiKey);
    return openweather.testConnection();
  }

  private async testHailTrace(credentials: any): Promise<IntegrationTestResult> {
    if (!credentials?.apiKey) {
      return {
        success: false,
        message: 'API Key is required',
        timestamp: new Date().toISOString(),
      };
    }

    const hailtrace = new HailTraceIntegration(credentials.apiKey, credentials.environment ?? 'production');
    return hailtrace.testConnection();
  }

  /**
   * Sync data from integration
   */
  async syncIntegration(id: string): Promise<IntegrationSyncResult> {
    const integration = this.integrations.get(id);
    if (!integration?.isEnabled) {
      throw new Error(`Integration ${id} is not enabled`);
    }

    const startTime = Date.now();

    try {
      let recordsProcessed = 0;

      switch (id) {
        case 'quickbooks':
          recordsProcessed = await this.syncQuickBooks();
          break;
        case 'eagleview':
          recordsProcessed = await this.syncEagleView();
          break;
        default:
          recordsProcessed = 0;
      }

      integration.lastSync = new Date().toISOString();
      await this.saveIntegrations();

      return {
        success: true,
        recordsProcessed,
        errors: [],
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        recordsProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Setup auto-sync for an integration
   */
  setupAutoSync(id: string, intervalMinutes: number = 60): void {
    // Clear existing interval
    const existingInterval = this.syncIntervals.get(id);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Setup new interval
    const intervalId = setInterval(async () => {
      try {
        await this.syncIntegration(id);
      } catch (error) {
        console.error(`Auto-sync failed for ${id}:`, error);
      }
    }, intervalMinutes * 60 * 1000);

    this.syncIntervals.set(id, intervalId);
  }

  private async syncQuickBooks(): Promise<number> {
    const connection = this.activeConnections.get('quickbooks') as QuickBooksIntegration | undefined;
    if (!connection) return 0;

    try {
      const result = await connection.syncCustomers();
      return result.recordsProcessed;
    } catch (error) {
      console.error('QuickBooks sync error:', error);
      return 0;
    }
  }

  private async syncEagleView(): Promise<number> {
    const connection = this.activeConnections.get('eagleview') as EagleViewIntegration | undefined;
    if (!connection) return 0;

    try {
      const result = await connection.listOrders(100);
      return result.orders?.length ?? 0;
    } catch (error) {
      console.error('EagleView sync error:', error);
      return 0;
    }
  }

  /**
   * Get integration health status
   */
  getIntegrationHealth(): Record<string, { status: string; lastCheck: string; errors: number }> {
    const health: Record<string, any> = {};

    for (const [id, integration] of this.integrations.entries()) {
      health[id] = {
        status: integration.status,
        lastCheck: integration.lastSync || 'Never',
        errors: 0,
      };
    }

    return health;
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(integration: string, event: any): Promise<void> {
    const handler = this.webhookHandlers.get(integration);
    if (handler) {
      await handler(event);
    }
  }

  /**
   * Register webhook handler
   */
  registerWebhookHandler(integration: string, handler: (...args: unknown[]) => void): void {
    this.webhookHandlers.set(integration, handler);
  }

  /**
   * Get active connection for an integration
   */
  getConnection(id: string): any {
    return this.activeConnections.get(id);
  }

  /**
   * Save integrations to storage
   */
  private async saveIntegrations(): Promise<void> {
    const integrations = Array.from(this.integrations.values());
    try {
      localStorage.setItem('crm_integrations', JSON.stringify(integrations));
    } catch (error) {
      console.warn('Failed to save integrations to localStorage:', error);
    }
  }

  /**
   * Load integrations from storage
   */
  private loadSavedIntegrations(): BaseIntegration[] {
    try {
      const saved = localStorage.getItem('crm_integrations');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.warn('Failed to load integrations from localStorage:', error);
      return [];
    }
  }

  /**
   * Reset all integrations
   */
  async resetAllIntegrations(): Promise<void> {
    this.integrations.clear();
    this.activeConnections.clear();
    this.syncIntervals.forEach((interval) => clearInterval(interval));
    this.syncIntervals.clear();
    localStorage.removeItem('crm_integrations');
    this.initializeIntegrations();
  }

  /**
   * Export integration status
   */
  exportStatus(): Record<string, any> {
    return {
      timestamp: new Date().toISOString(),
      integrations: Array.from(this.integrations.entries()).map(([id, integration]) => ({
        id,
        name: integration.name,
        status: integration.status,
        isEnabled: integration.isEnabled,
        isConfigured: integration.isConfigured,
        lastSync: integration.lastSync,
        category: integration.category,
      })),
    };
  }
}

// Singleton instance
export const integrationManager = new IntegrationManager();

export default integrationManager;

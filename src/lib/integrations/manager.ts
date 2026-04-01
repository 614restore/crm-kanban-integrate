// Enhanced Integration Manager
import { BaseIntegration, IntegrationTestResult, IntegrationSyncResult, INTEGRATION_TEMPLATES } from './apiTypes';
import { supabase } from '@/lib/supabase';
import StripeIntegration from './stripe';
import QuickBooksIntegration from './quickbooks';
import TwilioIntegration from './twilio';
import EagleViewIntegration from './eagleview';
import RoofrIntegration from './roofr';
import { OpenWeatherIntegration, HailTraceIntegration } from './weather';

export class IntegrationManager {
  private integrations: Map<string, BaseIntegration> = new Map();
  private activeConnections: Map<string, any> = new Map();
  private webhookHandlers: Map<string, (...args: unknown[]) => void> = new Map();
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeIntegrations();

    // Auto-reload credentials from Supabase whenever auth state changes
    // — covers sign-in, token refresh, and initial session on page load.
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        this.loadFromSupabase().catch(() => {});
      }
    });

    // Re-hydrate credentials when the tab regains focus after dormancy.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.loadFromSupabase().catch(() => {});
        }
      });
    }
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
        case 'roofr':
          return await this.testRoofr(testCredentials);
        case 'openweather':
          return await this.testOpenWeather(testCredentials);
        case 'hailtrace':
          return await this.testHailTrace(testCredentials);
        case 'sendgrid':
          return await this.testSendGrid(testCredentials);
        case 'square':
          return await this.testSquare(testCredentials);
        case 'auth0':
          return await this.testAuth0(testCredentials);
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
        case 'roofr':
          connection = new RoofrIntegration(integration.credentials.apiKey);
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
      return { success: false, message: 'Secret Key is required', timestamp: new Date().toISOString() };
    }
    const sk = credentials.secretKey as string;
    if (!sk.startsWith('sk_live_') && !sk.startsWith('sk_test_')) {
      return { success: false, message: 'Invalid Secret Key format — must start with sk_live_ or sk_test_', timestamp: new Date().toISOString() };
    }
    if (credentials.publishableKey && !String(credentials.publishableKey).startsWith('pk_')) {
      return { success: false, message: 'Invalid Publishable Key format — must start with pk_live_ or pk_test_', timestamp: new Date().toISOString() };
    }
    return {
      success: true,
      message: 'Stripe credentials saved. Connection verified on first transaction.',
      timestamp: new Date().toISOString(),
    };
  }

  private async testQuickBooks(_credentials: any): Promise<IntegrationTestResult> {
    // QuickBooks connects via OAuth — check if already connected in DB
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, message: 'Not authenticated', timestamp: new Date().toISOString() };
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();
      if (!profile?.company_id) return { success: false, message: 'Company not found', timestamp: new Date().toISOString() };
      const { data: company } = await supabase
        .from('companies').select('qb_refresh_token, qb_company_id').eq('id', profile.company_id).single();
      if (company?.qb_refresh_token) {
        return {
          success: true,
          message: 'QuickBooks connected via OAuth',
          details: { companyId: company.qb_company_id },
          timestamp: new Date().toISOString(),
        };
      }
      return {
        success: false,
        message: 'QuickBooks not connected. Use the "Connect QuickBooks" button to authorize via OAuth.',
        timestamp: new Date().toISOString(),
      };
    } catch {
      return { success: false, message: 'Failed to check QuickBooks connection', timestamp: new Date().toISOString() };
    }
  }

  private async testTwilio(credentials: any): Promise<IntegrationTestResult> {
    if (!credentials?.accountSid || !credentials?.authToken) {
      return { success: false, message: 'Account SID and Auth Token are required', timestamp: new Date().toISOString() };
    }
    if (!credentials.accountSid.startsWith('AC') || credentials.accountSid.length !== 34) {
      return { success: false, message: 'Invalid Account SID — must start with AC and be 34 characters', timestamp: new Date().toISOString() };
    }
    if (credentials.authToken.length !== 32) {
      return { success: false, message: 'Invalid Auth Token — must be 32 characters', timestamp: new Date().toISOString() };
    }
    if (credentials.fromNumber && !String(credentials.fromNumber).startsWith('+')) {
      return { success: false, message: 'From Number must be in E.164 format (e.g. +12025551234)', timestamp: new Date().toISOString() };
    }
    return {
      success: true,
      message: 'Twilio credentials saved. SMS sending will be verified on first message.',
      timestamp: new Date().toISOString(),
    };
  }

  private async testEagleView(credentials: any): Promise<IntegrationTestResult> {
    if (!credentials?.apiKey || !credentials?.clientId) {
      return { success: false, message: 'API Key and Client ID are required', timestamp: new Date().toISOString() };
    }
    if (!credentials?.environment) {
      return { success: false, message: 'Environment (Production or Sandbox) is required', timestamp: new Date().toISOString() };
    }
    return {
      success: true,
      message: 'EagleView credentials saved. Reports will be ordered when requested from a contact.',
      timestamp: new Date().toISOString(),
    };
  }

  private async testRoofr(credentials: any): Promise<IntegrationTestResult> {
    if (!credentials?.apiKey) {
      return { success: false, message: 'API Key is required', timestamp: new Date().toISOString() };
    }
    try {
      const roofr = new RoofrIntegration(credentials.apiKey);
      return await roofr.testConnection();
    } catch (err) {
      return {
        success: false,
        message: `Roofr connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Order a Roofr measurement report for a contact address.
   * Exposed so contact detail pages can call it directly:
   *   integrationManager.orderRoofrReport({ address, city, state, zip, contactId })
   */
  async orderRoofrReport(order: {
    address: string;
    city: string;
    state: string;
    zip: string;
    contactId?: string;
    reportType?: 'standard' | 'premium';
  }) {
    const roofr = this.activeConnections.get('roofr') as RoofrIntegration | undefined;
    if (!roofr) throw new Error('Roofr is not connected. Configure it in Settings → Integrations.');
    return roofr.orderReport(order);
  }

  /**
   * List Roofr reports, optionally filtered to a single contact.
   */
  async listRoofrReports(contactId?: string) {
    const roofr = this.activeConnections.get('roofr') as RoofrIntegration | undefined;
    if (!roofr) return [];
    return roofr.listReports(contactId);
  }

  private async testOpenWeather(credentials: any): Promise<IntegrationTestResult> {
    if (!credentials?.apiKey) {
      return { success: false, message: 'API Key is required', timestamp: new Date().toISOString() };
    }
    return {
      success: true,
      message: 'OpenWeather credentials saved. Weather data will be available on job sites.',
      timestamp: new Date().toISOString(),
    };
  }

  private async testHailTrace(credentials: any): Promise<IntegrationTestResult> {
    if (!credentials?.apiKey) {
      return { success: false, message: 'API Key is required', timestamp: new Date().toISOString() };
    }
    if (!credentials?.environment || !['production', 'sandbox'].includes(credentials.environment)) {
      return { success: false, message: 'Environment must be "production" or "sandbox"', timestamp: new Date().toISOString() };
    }
    return {
      success: true,
      message: 'HailTrace credentials saved. Hail events will be fetched from contact detail pages.',
      timestamp: new Date().toISOString(),
    };
  }

  private async testSendGrid(credentials: any): Promise<IntegrationTestResult> {
    if (!credentials?.apiKey) {
      return { success: false, message: 'API Key is required', timestamp: new Date().toISOString() };
    }
    if (!credentials.apiKey.startsWith('SG.')) {
      return { success: false, message: 'Invalid API Key — SendGrid keys start with "SG."', timestamp: new Date().toISOString() };
    }
    if (!credentials?.fromEmail) {
      return { success: false, message: 'From Email Address is required', timestamp: new Date().toISOString() };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(credentials.fromEmail)) {
      return { success: false, message: 'From Email Address is not valid', timestamp: new Date().toISOString() };
    }
    return {
      success: true,
      message: `SendGrid credentials saved. Emails will be sent from ${credentials.fromEmail}.`,
      timestamp: new Date().toISOString(),
    };
  }

  private async testSquare(credentials: any): Promise<IntegrationTestResult> {
    if (!credentials?.accessToken) {
      return { success: false, message: 'Access Token is required', timestamp: new Date().toISOString() };
    }
    if (!credentials?.locationId) {
      return { success: false, message: 'Location ID is required', timestamp: new Date().toISOString() };
    }
    if (!credentials?.environment) {
      return { success: false, message: 'Environment (Production or Sandbox) is required', timestamp: new Date().toISOString() };
    }
    return {
      success: true,
      message: 'Square credentials saved. Payment processing will be available on invoices.',
      timestamp: new Date().toISOString(),
    };
  }

  private async testAuth0(credentials: any): Promise<IntegrationTestResult> {
    if (!credentials?.domain || !credentials?.clientId || !credentials?.clientSecret) {
      return { success: false, message: 'Domain, Client ID, and Client Secret are all required', timestamp: new Date().toISOString() };
    }
    if (!credentials.domain.includes('.auth0.com') && !credentials.domain.includes('.')) {
      return { success: false, message: 'Domain should be in format: yourapp.us.auth0.com', timestamp: new Date().toISOString() };
    }
    return {
      success: true,
      message: 'Auth0 credentials saved.',
      timestamp: new Date().toISOString(),
    };
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
   * Load integrations from Supabase (async — call after auth is ready)
   */
  async loadFromSupabase(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();
      if (!profile?.company_id) return;

      const { data } = await supabase
        .from('company_integrations')
        .select('*')
        .eq('company_id', profile.company_id);

      if (data) {
        for (const row of data) {
          const integration = this.integrations.get(row.integration_type);
          if (integration) {
            integration.credentials = row.credentials || {};
            integration.settings = row.settings || {};
            integration.isEnabled = row.is_active ?? false;
            integration.isConfigured = true;
            integration.status = row.is_active ? 'connected' : 'disconnected';
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load integrations from Supabase:', error);
    }
  }

  /**
   * Save integrations to storage (Supabase + localStorage meta cache)
   */
  private async saveIntegrations(): Promise<void> {
    const integrations = Array.from(this.integrations.values());

    // Save only non-sensitive meta to localStorage as quick-start cache
    try {
      const meta = integrations.map(i => ({
        id: i.id, isEnabled: i.isEnabled, isConfigured: i.isConfigured,
        status: i.status, lastSync: i.lastSync,
      }));
      localStorage.setItem('crm_integrations_meta', JSON.stringify(meta));
    } catch {
      // ignore
    }

    // Save credentials to Supabase
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();
      if (!profile?.company_id) return;

      for (const integration of integrations) {
        if (!integration.isConfigured) continue;
        await supabase.from('company_integrations').upsert({
          company_id: profile.company_id,
          integration_type: integration.id,
          is_active: integration.isEnabled,
          credentials: integration.credentials || {},
          settings: integration.settings || {},
          updated_at: new Date().toISOString(),
        }, { onConflict: 'company_id,integration_type' });
      }
    } catch (error) {
      console.warn('Failed to save integrations to Supabase:', error);
    }
  }

  /**
   * Load integrations from storage (sync — meta only, no credentials)
   */
  private loadSavedIntegrations(): BaseIntegration[] {
    try {
      const saved = localStorage.getItem('crm_integrations_meta');
      if (saved) {
        // Meta only — credentials will be loaded async from Supabase
        return JSON.parse(saved).map((m: any) => ({ ...m, credentials: {}, settings: {} }));
      }
      // Backward compat: migrate old full-data localStorage entry
      const old = localStorage.getItem('crm_integrations');
      if (old) {
        const parsed = JSON.parse(old);
        // Strip credentials from old cache for security
        return parsed.map((i: any) => ({ ...i, credentials: {}, settings: {} }));
      }
      return [];
    } catch {
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
    localStorage.removeItem('crm_integrations_meta');
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

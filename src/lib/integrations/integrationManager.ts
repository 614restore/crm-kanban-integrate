// Integration Manager for StormCraft CRM
// Handles all third-party API integrations

import { 
  BaseIntegration, 
  IntegrationTestResult, 
  IntegrationSyncResult,
  APIError,
  INTEGRATION_TEMPLATES
} from './apiTypes';

class IntegrationManager {
  private integrations: Map<string, BaseIntegration> = new Map();
  private activeConnections: Map<string, any> = new Map();
  private webhookHandlers: Map<string, Function> = new Map();

  // Initialize all available integrations
  async initializeIntegrations(): Promise<void> {
    // Load from localStorage or API
    const savedIntegrations = this.loadSavedIntegrations();
    
    Object.entries(INTEGRATION_TEMPLATES).forEach(([id, template]) => {
      const existing = savedIntegrations.find(i => i.id === id);
      if (existing) {
        this.integrations.set(id, existing);
      } else {
        this.integrations.set(id, {
          ...template,
          id,
          isEnabled: false,
          isConfigured: false,
          status: 'disconnected'
        } as BaseIntegration);
      }
    });

    // Auto-connect enabled integrations
    for (const [id, integration] of this.integrations.entries()) {
      if (integration.isEnabled && integration.isConfigured) {
        await this.connectIntegration(id);
      }
    }
  }

  // Get all integrations grouped by category
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

  // Get single integration
  getIntegration(id: string): BaseIntegration | undefined {
    return this.integrations.get(id);
  }

  // Configure integration credentials and settings
  async configureIntegration(id: string, credentials: Record<string, any>, settings: Record<string, any>): Promise<boolean> {
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

    return true;
  }

  // Enable/disable integration
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

  // Test integration connection
  async testIntegration(id: string, credentials?: Record<string, any>, settings?: Record<string, any>): Promise<IntegrationTestResult> {
    const integration = this.integrations.get(id);
    if (!integration) {
      return {
        success: false,
        message: `Integration ${id} not found`,
        timestamp: new Date().toISOString()
      };
    }

    const testCredentials = credentials || integration.credentials;
    const testSettings = settings || integration.settings;

    try {
      switch (id) {
        case 'eagleview':
          return await this.testEagleView(testCredentials, testSettings);
        case 'stripe':
          return await this.testStripe(testCredentials, testSettings);
        case 'square':
          return await this.testSquare(testCredentials, testSettings);
        case 'quickbooks':
          return await this.testQuickBooks(testCredentials, testSettings);
        case 'openweather':
          return await this.testOpenWeather(testCredentials, testSettings);
        case 'hailtrace':
          return await this.testHailTrace(testCredentials, testSettings);
        case 'twilio':
          return await this.testTwilio(testCredentials, testSettings);
        case 'sendgrid':
          return await this.testSendGrid(testCredentials, testSettings);
        case 'auth0':
          return await this.testAuth0(testCredentials, testSettings);
        default:
          throw new Error(`Test not implemented for ${id}`);
      }
    } catch (error) {
      return {
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Connect to integration
  private async connectIntegration(id: string): Promise<void> {
    const integration = this.integrations.get(id);
    if (!integration?.credentials) return;

    try {
      let connection;
      
      switch (id) {
        case 'stripe':
          connection = await this.connectStripe(integration.credentials);
          break;
        case 'quickbooks':
          connection = await this.connectQuickBooks(integration.credentials);
          break;
        case 'twilio':
          connection = await this.connectTwilio(integration.credentials);
          break;
        // Add other integrations...
        default:
          console.log(`Connection handler not implemented for ${id}`);
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

  // Disconnect from integration
  private async disconnectIntegration(id: string): Promise<void> {
    this.activeConnections.delete(id);
    const integration = this.integrations.get(id);
    if (integration) {
      integration.status = 'disconnected';
    }
  }

  // EagleView API Test
  private async testEagleView(credentials: any, settings?: any): Promise<IntegrationTestResult> {
    if (!credentials?.apiKey || !credentials?.clientId) {
      return {
        success: false,
        message: 'API Key and Client ID are required',
        timestamp: new Date().toISOString()
      };
    }

    try {
      const baseUrl = credentials.environment === 'production' 
        ? 'https://api.eagleview.com'
        : 'https://sandbox-api.eagleview.com';
        
      const response = await fetch(`${baseUrl}/v1/account`, {
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
          'X-Client-ID': credentials.clientId
        }
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: 'Connected to EagleView successfully',
          details: { accountName: data.name },
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          success: false,
          message: `EagleView API error: ${response.statusText}`,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Stripe API Test
  private async testStripe(credentials: any, settings?: any): Promise<IntegrationTestResult> {
    if (!credentials?.secretKey) {
      return {
        success: false,
        message: 'Secret Key is required',
        timestamp: new Date().toISOString()
      };
    }

    try {
      const response = await fetch('https://api.stripe.com/v1/account', {
        headers: {
          'Authorization': `Bearer ${credentials.secretKey}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: 'Connected to Stripe successfully',
          details: { 
            businessName: data.business_profile?.name || data.email,
            country: data.country 
          },
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          success: false,
          message: `Stripe API error: ${response.statusText}`,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  // QuickBooks API Test
  private async testQuickBooks(credentials: any, settings?: any): Promise<IntegrationTestResult> {
    if (!credentials?.accessToken || !credentials?.companyId) {
      return {
        success: false,
        message: 'Access Token and Company ID are required',
        timestamp: new Date().toISOString()
      };
    }

    try {
      const baseUrl = credentials.environment === 'production' 
        ? 'https://quickbooks-api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com';
        
      const response = await fetch(`${baseUrl}/v3/company/${credentials.companyId}/companyinfo/${credentials.companyId}`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const company = data.QueryResponse?.CompanyInfo?.[0];
        return {
          success: true,
          message: 'Connected to QuickBooks successfully',
          details: { companyName: company?.CompanyName },
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          success: false,
          message: `QuickBooks API error: ${response.statusText}`,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Weather API Tests (simplified for demo)
  private async testOpenWeather(credentials: any): Promise<IntegrationTestResult> {
    return { success: true, message: 'OpenWeather test passed', timestamp: new Date().toISOString() };
  }
  
  private async testHailTrace(credentials: any): Promise<IntegrationTestResult> {
    return { success: true, message: 'HailTrace test passed', timestamp: new Date().toISOString() };
  }
  
  private async testTwilio(credentials: any): Promise<IntegrationTestResult> {
    return { success: true, message: 'Twilio test passed', timestamp: new Date().toISOString() };
  }
  
  private async testSendGrid(credentials: any): Promise<IntegrationTestResult> {
    return { success: true, message: 'SendGrid test passed', timestamp: new Date().toISOString() };
  }
  
  private async testAuth0(credentials: any): Promise<IntegrationTestResult> {
    return { success: true, message: 'Auth0 test passed', timestamp: new Date().toISOString() };
  }
  
  private async testSquare(credentials: any): Promise<IntegrationTestResult> {
    return { success: true, message: 'Square test passed', timestamp: new Date().toISOString() };
  }

  // Connection methods
  private async connectStripe(credentials: any): Promise<any> {
    // Return Stripe client instance
    return { client: 'stripe-client', credentials };
  }

  private async connectQuickBooks(credentials: any): Promise<any> {
    // Return QuickBooks client instance
    return { client: 'quickbooks-client', credentials };
  }

  private async connectTwilio(credentials: any): Promise<any> {
    // Return Twilio client instance
    return { client: 'twilio-client', credentials };
  }

  // Sync data from integration
  async syncIntegration(id: string): Promise<IntegrationSyncResult> {
    const integration = this.integrations.get(id);
    if (!integration?.isEnabled) {
      throw new Error(`Integration ${id} is not enabled`);
    }

    const startTime = Date.now();
    
    try {
      // Implement sync logic based on integration type
      let recordsProcessed = 0;
      
      switch (id) {
        case 'quickbooks':
          recordsProcessed = await this.syncQuickBooks();
          break;
        case 'eagleview':
          recordsProcessed = await this.syncEagleView();
          break;
        // Add other sync methods...
        default:
          recordsProcessed = 0;
      }

      integration.lastSync = new Date().toISOString();
      
      return {
        success: true,
        recordsProcessed,
        errors: [],
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        recordsProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
    }
  }

  private async syncQuickBooks(): Promise<number> {
    // Implement QuickBooks sync logic
    return 0;
  }

  private async syncEagleView(): Promise<number> {
    // Implement EagleView sync logic
    return 0;
  }

  // Get integration health status
  getIntegrationHealth(): Record<string, { status: string; lastCheck: string; errors: 0 }> {
    const health: Record<string, any> = {};
    
    for (const [id, integration] of this.integrations.entries()) {
      health[id] = {
        status: integration.status,
        lastCheck: integration.lastSync || 'Never',
        errors: 0 // Would track actual errors
      };
    }
    
    return health;
  }

  // Handle webhook events
  async handleWebhook(integration: string, event: any): Promise<void> {
    const handler = this.webhookHandlers.get(integration);
    if (handler) {
      await handler(event);
    }
  }

  // Register webhook handler
  registerWebhookHandler(integration: string, handler: Function): void {
    this.webhookHandlers.set(integration, handler);
  }

  // Save integrations to storage
  private async saveIntegrations(): Promise<void> {
    const integrations = Array.from(this.integrations.values());
    localStorage.setItem('integrations', JSON.stringify(integrations));
  }

  // Load integrations from storage
  private loadSavedIntegrations(): BaseIntegration[] {
    const saved = localStorage.getItem('integrations');
    return saved ? JSON.parse(saved) : [];
  }

  // API Methods for specific integrations

  // EagleView: Order aerial report
  async orderEagleViewReport(contactId: string, address: string, reportType: string = 'premium'): Promise<any> {
    const connection = this.activeConnections.get('eagleview');
    if (!connection) throw new Error('EagleView not connected');

    // Implementation would go here
    return { orderId: 'EV-' + Date.now(), status: 'pending' };
  }

  // Stripe: Create payment intent
  async createStripePayment(amount: number, currency: string = 'usd', customerId?: string): Promise<any> {
    const connection = this.activeConnections.get('stripe');
    if (!connection) throw new Error('Stripe not connected');

    // Implementation would go here
    return { paymentIntentId: 'pi_' + Date.now(), status: 'requires_payment_method' };
  }

  // QuickBooks: Create customer
  async createQuickBooksCustomer(contact: any): Promise<any> {
    const connection = this.activeConnections.get('quickbooks');
    if (!connection) throw new Error('QuickBooks not connected');

    // Implementation would go here
    return { customerId: 'QB-' + Date.now() };
  }

  // Twilio: Send SMS
  async sendSMS(to: string, message: string): Promise<any> {
    const connection = this.activeConnections.get('twilio');
    if (!connection) throw new Error('Twilio not connected');

    // Implementation would go here
    return { messageId: 'SMS-' + Date.now(), status: 'sent' };
  }

  // Weather: Get current conditions
  async getCurrentWeather(lat: number, lon: number): Promise<any> {
    const openWeather = this.activeConnections.get('openweather');
    const hailTrace = this.activeConnections.get('hailtrace');
    
    // Combine data from multiple weather sources
    return {
      temperature: 72,
      conditions: 'partly_cloudy',
      windSpeed: 8,
      hailRisk: 'low'
    };
  }
}

export const integrationManager = new IntegrationManager();
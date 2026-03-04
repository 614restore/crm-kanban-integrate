// Stripe Payment Processing Integration
import { StripeIntegration, IntegrationTestResult } from './apiTypes';

export const STRIPE_API_VERSION = '2023-10-16';

export class StripeIntegration {
  private apiKey: string;
  private baseUrl = 'https://api.stripe.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Test Stripe connection
   */
  async testConnection(): Promise<IntegrationTestResult> {
    try {
      const response = await fetch(`${this.baseUrl}/account`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        return {
          success: false,
          message: `Stripe API error: ${response.statusText}`,
          timestamp: new Date().toISOString(),
        };
      }

      const data = await response.json();
      return {
        success: true,
        message: 'Connected to Stripe successfully',
        details: {
          businessName: data.business_profile?.name || data.email,
          country: data.country,
          status: data.charges_enabled ? 'active' : 'pending',
          chargesEnabled: data.charges_enabled,
          defaultCurrency: data.default_currency,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Create a payment intent
   */
  async createPaymentIntent(amount: number, currency: string = 'usd', metadata?: Record<string, string>): Promise<any> {
    const params = new URLSearchParams();
    params.append('amount', Math.round(amount * 100).toString()); // Convert to cents
    params.append('currency', currency);
    params.append('payment_method_types[]', 'card');
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        params.append(`metadata[${key}]`, value);
      });
    }

    try {
      const response = await fetch(`${this.baseUrl}/payment_intents`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`Failed to create payment intent: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Create payment intent error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve a customer
   */
  async getCustomer(customerId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/customers/${customerId}`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to retrieve customer: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Get customer error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a customer
   */
  async createCustomer(email: string, name: string, metadata?: Record<string, string>): Promise<any> {
    const params = new URLSearchParams();
    params.append('email', email);
    params.append('name', name);
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        params.append(`metadata[${key}]`, value);
      });
    }

    try {
      const response = await fetch(`${this.baseUrl}/customers`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`Failed to create customer: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Create customer error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List payment intents
   */
  async listPaymentIntents(limit: number = 10): Promise<any> {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());

    try {
      const response = await fetch(`${this.baseUrl}/payment_intents?${params.toString()}`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to list payment intents: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`List payment intents error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create an invoice
   */
  async createInvoice(customerId: string, items: Array<{ price: string; quantity: number }>): Promise<any> {
    const params = new URLSearchParams();
    params.append('customer', customerId);

    items.forEach((item, index) => {
      params.append(`line_items[${index}][price]`, item.price);
      params.append(`line_items[${index}][quantity]`, item.quantity.toString());
    });

    try {
      const response = await fetch(`${this.baseUrl}/invoices`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`Failed to create invoice: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Create invoice error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Finalize an invoice
   */
  async finalizeInvoice(invoiceId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/invoices/${invoiceId}/finalize`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: '',
      });

      if (!response.ok) {
        throw new Error(`Failed to finalize invoice: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Finalize invoice error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List charges
   */
  async listCharges(limit: number = 10): Promise<any> {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());

    try {
      const response = await fetch(`${this.baseUrl}/charges?${params.toString()}`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to list charges: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`List charges error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildHeaders(): HeadersInit {
    const auth = Buffer.from(`${this.apiKey}:`).toString('base64');
    return {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_API_VERSION,
    };
  }
}

export default StripeIntegration;

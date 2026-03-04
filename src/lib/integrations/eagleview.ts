// EagleView Aerial Imagery Integration
import { IntegrationTestResult } from './apiTypes';

export class EagleViewIntegration {
  private apiKey: string;
  private clientId: string;
  private environment: 'sandbox' | 'production';
  private baseUrl: string;

  constructor(apiKey: string, clientId: string, environment: 'sandbox' | 'production' = 'production') {
    this.apiKey = apiKey;
    this.clientId = clientId;
    this.environment = environment;
    this.baseUrl = environment === 'production' ? 'https://api.eagleview.com' : 'https://sandbox-api.eagleview.com';
  }

  /**
   * Test EagleView connection
   */
  async testConnection(): Promise<IntegrationTestResult> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/account`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        return {
          success: false,
          message: `EagleView API error: ${response.statusText}`,
          timestamp: new Date().toISOString(),
        };
      }

      const data = await response.json();

      return {
        success: true,
        message: 'Connected to EagleView successfully',
        details: {
          accountName: data.account_name,
          accountStatus: data.status,
          availableCredits: data.credits_available,
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
   * Order an aerial report
   */
  async orderReport(
    address: string,
    reportType: 'standard' | 'premium' = 'standard',
    metadata?: Record<string, any>
  ): Promise<any> {
    const payload = {
      address,
      report_type: reportType,
      ...metadata,
    };

    try {
      const response = await fetch(`${this.baseUrl}/v1/orders`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to order report: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Order report error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(orderId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/orders/${orderId}`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to get order status: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Get order status error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List orders
   */
  async listOrders(limit: number = 20, offset: number = 0): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v1/orders?limit=${limit}&offset=${offset}`,
        {
          method: 'GET',
          headers: this.buildHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to list orders: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`List orders error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get account credits
   */
  async getAccountCredits(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/account/credits`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to get account credits: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Get account credits error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download report
   */
  async downloadReport(orderId: string, format: 'pdf' | 'json' = 'pdf'): Promise<Blob> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v1/orders/${orderId}/download?format=${format}`,
        {
          method: 'GET',
          headers: this.buildHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to download report: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      throw new Error(`Download report error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get report data
   */
  async getReportData(orderId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/orders/${orderId}/data`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to get report data: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Get report data error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for properties
   */
  async searchProperties(address: string, city: string, state: string, zip: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v1/properties/search?address=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&zip=${zip}`,
        {
          method: 'GET',
          headers: this.buildHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to search properties: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Search properties error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'X-Client-ID': this.clientId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }
}

export default EagleViewIntegration;

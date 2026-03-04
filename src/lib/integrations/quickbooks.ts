// QuickBooks Online Integration
import { IntegrationTestResult, IntegrationSyncResult } from './apiTypes';

export class QuickBooksIntegration {
  private accessToken: string;
  private companyId: string;
  private environment: 'sandbox' | 'production';
  private baseUrl: string;

  constructor(accessToken: string, companyId: string, environment: 'sandbox' | 'production' = 'production') {
    this.accessToken = accessToken;
    this.companyId = companyId;
    this.environment = environment;
    this.baseUrl = environment === 'production' 
      ? 'https://quickbooks.api.intuit.com/v2/company'
      : 'https://sandbox-quickbooks.api.intuit.com/v2/company';
  }

  /**
   * Test QuickBooks connection
   */
  async testConnection(): Promise<IntegrationTestResult> {
    try {
      const response = await fetch(`${this.baseUrl}/${this.companyId}/companyinfo/${this.companyId}`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        return {
          success: false,
          message: `QuickBooks API error: ${response.statusText}`,
          timestamp: new Date().toISOString(),
        };
      }

      const data = await response.json();
      const company = data.QueryResponse?.CompanyInfo?.[0];

      return {
        success: true,
        message: 'Connected to QuickBooks successfully',
        details: {
          companyName: company?.CompanyName,
          country: company?.Country,
          companyId: company?.Id,
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
   * Create a customer
   */
  async createCustomer(name: string, email: string, phone?: string): Promise<any> {
    const customerData = {
      DisplayName: name,
      PrimaryEmailAddr: { Address: email },
      PrimaryPhone: phone ? { FreeFormNumber: phone } : undefined,
    };

    try {
      const response = await fetch(`${this.baseUrl}/${this.companyId}/customer`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(customerData),
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
   * Query customers
   */
  async queryCustomers(limit: number = 10): Promise<any> {
    const query = `SELECT * FROM Customer MAXRESULTS ${limit}`;

    try {
      const response = await fetch(`${this.baseUrl}/${this.companyId}/query?query=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to query customers: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Query customers error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create an invoice
   */
  async createInvoice(customerId: string, items: Array<any>, dueDate?: string): Promise<any> {
    const invoiceData = {
      CustomerRef: { value: customerId },
      Line: items.map((item) => ({
        Amount: item.amount,
        Description: item.description,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: { value: item.itemId || '1' },
          Qty: item.quantity || 1,
          UnitPrice: item.unitPrice || item.amount,
        },
      })),
      DueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    try {
      const response = await fetch(`${this.baseUrl}/${this.companyId}/invoice`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(invoiceData),
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
   * Query invoices
   */
  async queryInvoices(limit: number = 10): Promise<any> {
    const query = `SELECT * FROM Invoice MAXRESULTS ${limit}`;

    try {
      const response = await fetch(`${this.baseUrl}/${this.companyId}/query?query=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to query invoices: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Query invoices error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send invoice
   */
  async sendInvoice(invoiceId: string, email: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.companyId}/invoice/${invoiceId}/send?sendTo=${encodeURIComponent(email)}`,
        {
          method: 'POST',
          headers: this.buildHeaders(),
          body: '',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to send invoice: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Send invoice error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a payment
   */
  async createPayment(customerId: string, invoiceId: string, amount: number, paymentMethod: string): Promise<any> {
    const paymentData = {
      CustomerRef: { value: customerId },
      TotalAmt: amount,
      Line: [
        {
          Amount: amount,
          LinkedTxn: [
            {
              TxnId: invoiceId,
              TxnType: 'Invoice',
            },
          ],
        },
      ],
      PaymentMethodRef: { value: paymentMethod },
    };

    try {
      const response = await fetch(`${this.baseUrl}/${this.companyId}/payment`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        throw new Error(`Failed to create payment: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Create payment error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sync customers from QuickBooks
   */
  async syncCustomers(): Promise<IntegrationSyncResult> {
    const startTime = Date.now();

    try {
      const result = await this.queryCustomers(100);
      const customers = result.QueryResponse?.Customer || [];

      return {
        success: true,
        recordsProcessed: customers.length,
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
   * Sync invoices from QuickBooks
   */
  async syncInvoices(): Promise<IntegrationSyncResult> {
    const startTime = Date.now();

    try {
      const result = await this.queryInvoices(100);
      const invoices = result.QueryResponse?.Invoice || [];

      return {
        success: true,
        recordsProcessed: invoices.length,
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

  private buildHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }
}

export default QuickBooksIntegration;

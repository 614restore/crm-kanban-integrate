// Twilio Communication Integration
import { IntegrationTestResult } from './apiTypes';

export class TwilioIntegration {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;
  private baseUrl = 'https://api.twilio.com/2010-04-01';

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = fromNumber;
  }

  /**
   * Test Twilio connection
   */
  async testConnection(): Promise<IntegrationTestResult> {
    try {
      const response = await fetch(`${this.baseUrl}/Accounts/${this.accountSid}.json`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        return {
          success: false,
          message: `Twilio API error: ${response.statusText}`,
          timestamp: new Date().toISOString(),
        };
      }

      const data = await response.json();

      return {
        success: true,
        message: 'Connected to Twilio successfully',
        details: {
          accountSid: data.sid,
          friendlyName: data.friendly_name,
          status: data.status,
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
   * Send an SMS message
   */
  async sendSMS(to: string, message: string, mediaUrls?: string[]): Promise<any> {
    const params = new URLSearchParams();
    params.append('From', this.fromNumber);
    params.append('To', to);
    params.append('Body', message);

    if (mediaUrls && mediaUrls.length > 0) {
      mediaUrls.forEach((url, index) => {
        params.append(`MediaUrl.${index + 1}`, url);
      });
    }

    try {
      const response = await fetch(`${this.baseUrl}/Accounts/${this.accountSid}/Messages.json`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`Failed to send SMS: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Send SMS error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send an MMS message
   */
  async sendMMS(to: string, message: string, mediaUrls: string[]): Promise<any> {
    return this.sendSMS(to, message, mediaUrls);
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageSid: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/Accounts/${this.accountSid}/Messages/${messageSid}.json`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to get message status: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Get message status error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List messages
   */
  async listMessages(limit: number = 20): Promise<any> {
    const params = new URLSearchParams();
    params.append('PageSize', limit.toString());

    try {
      const response = await fetch(`${this.baseUrl}/Accounts/${this.accountSid}/Messages.json?${params.toString()}`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to list messages: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`List messages error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Make a phone call
   */
  async makeCall(to: string, callbackUrl: string): Promise<any> {
    const params = new URLSearchParams();
    params.append('From', this.fromNumber);
    params.append('To', to);
    params.append('Url', callbackUrl);

    try {
      const response = await fetch(`${this.baseUrl}/Accounts/${this.accountSid}/Calls.json`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`Failed to make call: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Make call error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get voice usage
   */
  async getUsage(): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/Accounts/${this.accountSid}/Usage/Records.json?Category=calls&Category=messages`,
        {
          method: 'GET',
          headers: this.buildHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get usage: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Get usage error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a phone number
   */
  async searchAndBuyPhoneNumber(
    areaCode: string,
    voiceCapable: boolean = true,
    smsCapable: boolean = true
  ): Promise<any> {
    const params = new URLSearchParams();
    params.append('AreaCode', areaCode);
    if (voiceCapable) params.append('VoiceEnabled', 'true');
    if (smsCapable) params.append('SmsEnabled', 'true');

    try {
      const response = await fetch(
        `${this.baseUrl}/Accounts/${this.accountSid}/AvailablePhoneNumbers/US/Local.json?${params.toString()}`,
        {
          method: 'GET',
          headers: this.buildHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to search phone numbers: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Search phone numbers error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get incoming phone numbers
   */
  async getIncomingPhoneNumbers(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/Accounts/${this.accountSid}/IncomingPhoneNumbers.json`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to get phone numbers: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Get phone numbers error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a bulk message to multiple recipients
   */
  async sendBulkSMS(recipients: string[], message: string): Promise<any> {
    const results = [];

    for (const recipient of recipients) {
      try {
        const result = await this.sendSMS(recipient, message);
        results.push({ recipient, status: 'sent', sid: result.sid });
      } catch (error) {
        results.push({ recipient, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return {
      totalRequested: recipients.length,
      successful: results.filter((r) => r.status === 'sent').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    };
  }

  private buildHeaders(): HeadersInit {
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    return {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    };
  }
}

export default TwilioIntegration;

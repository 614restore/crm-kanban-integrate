// SendGrid Email Integration
import { IntegrationTestResult } from './apiTypes';

const SENDGRID_BASE_URL = 'https://api.sendgrid.com/v3';

export interface SendGridEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SendGridTemplate {
  id: string;
  name: string;
}

export class SendGridIntegration {
  private apiKey: string;
  private fromEmail: string;

  constructor(apiKey: string, fromEmail: string) {
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
  }

  /**
   * Test SendGrid connection by checking the authenticated user profile.
   */
  async testConnection(): Promise<IntegrationTestResult> {
    try {
      const response = await fetch(`${SENDGRID_BASE_URL}/user/profile`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (response.status === 401) {
        return {
          success: false,
          message: 'SendGrid API key is invalid or has been revoked.',
          timestamp: new Date().toISOString(),
        };
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { errors?: Array<{ message: string }> };
        const msg = body?.errors?.[0]?.message ?? response.statusText;
        return {
          success: false,
          message: `SendGrid API error: ${msg}`,
          timestamp: new Date().toISOString(),
        };
      }

      const data = await response.json() as { username?: string; email?: string };
      return {
        success: true,
        message: `Connected to SendGrid${data.username ? ` as ${data.username}` : ''}.`,
        details: {
          username: data.username,
          email: data.email,
          fromEmail: this.fromEmail,
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
   * Send a transactional email via SendGrid Mail Send API (v3).
   */
  async sendEmail(
    to: string | string[],
    subject: string,
    htmlBody: string,
    textBody?: string
  ): Promise<SendGridEmailResult> {
    const recipients = Array.isArray(to) ? to : [to];

    const payload = {
      personalizations: [
        {
          to: recipients.map((address) => ({ email: address })),
          subject,
        },
      ],
      from: { email: this.fromEmail },
      subject,
      content: [
        ...(textBody ? [{ type: 'text/plain', value: textBody }] : []),
        { type: 'text/html', value: htmlBody },
      ],
    };

    try {
      const response = await fetch(`${SENDGRID_BASE_URL}/mail/send`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(payload),
      });

      if (response.status === 429) {
        return {
          success: false,
          error: 'SendGrid rate limit exceeded. Please try again later.',
        };
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { errors?: Array<{ message: string }> };
        const msg = body?.errors?.[0]?.message ?? `SendGrid error ${response.status}`;
        return { success: false, error: msg };
      }

      // 202 Accepted — SendGrid returns the Message-ID in the X-Message-Id header.
      const messageId = response.headers.get('X-Message-Id') ?? undefined;
      return { success: true, messageId };
    } catch (error) {
      return {
        success: false,
        error: `Send failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Send an email using a Dynamic Template stored in SendGrid.
   */
  async sendEmailWithTemplate(
    to: string | string[],
    templateId: string,
    dynamicData: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    const recipients = Array.isArray(to) ? to : [to];

    const payload = {
      personalizations: [
        {
          to: recipients.map((address) => ({ email: address })),
          dynamic_template_data: dynamicData,
        },
      ],
      from: { email: this.fromEmail },
      template_id: templateId,
    };

    try {
      const response = await fetch(`${SENDGRID_BASE_URL}/mail/send`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(payload),
      });

      if (response.status === 429) {
        return { success: false, error: 'SendGrid rate limit exceeded. Please try again later.' };
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { errors?: Array<{ message: string }> };
        const msg = body?.errors?.[0]?.message ?? `SendGrid error ${response.status}`;
        return { success: false, error: msg };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Template send failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * List Dynamic Templates from the account.
   */
  async listTemplates(): Promise<SendGridTemplate[]> {
    try {
      const response = await fetch(
        `${SENDGRID_BASE_URL}/templates?generations=dynamic&page_size=200`,
        {
          method: 'GET',
          headers: this.buildHeaders(),
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as { result?: Array<{ id: string; name: string }> };
      return (data.result ?? []).map((t) => ({ id: t.id, name: t.name }));
    } catch {
      return [];
    }
  }

  private buildHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }
}

export default SendGridIntegration;

import { supabase } from './supabase';

export interface SendEmailPayload {
  to: string | string[];
  subject: string;
  html: string;
}

function getApiBaseUrl(): string | null {
  const configuredBase =
    (import.meta.env.VITE_EMAIL_API_BASE_URL as string | undefined)?.trim() ||
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

  if (configuredBase) {
    return configuredBase.replace(/\/$/, '');
  }

  const host = window.location.hostname;

  // Same-origin API works for local dev and Vercel hosting
  if (host === 'localhost' || host.endsWith('.vercel.app')) {
    return window.location.origin;
  }

  // GitHub Pages is static-only; require explicit API base URL config
  return null;
}

/**
 * Send an email via the server-side /api/send endpoint.
 * This is the legacy fallback path used when SendGrid is not configured.
 * Prefer `useEmail()` from `@/hooks/useEmail` in React components — it
 * automatically routes through SendGrid when the integration is active.
 */
export async function sendEmail(payload: SendEmailPayload, timeoutMs: number = 12000): Promise<unknown> {
  // Try SendGrid first if it is configured and active.
  // Import lazily to avoid circular dependencies and keep the bundle clean
  // when SendGrid is never used.
  try {
    const { integrationManager } = await import('./integrations/manager');
    const sg = integrationManager.getSendGrid();
    if (sg) {
      const result = await sg.sendEmail(payload.to, payload.subject, payload.html);
      if (result.success) {
        return { provider: 'sendgrid', messageId: result.messageId };
      }
      // Non-fatal — log and fall through to the server endpoint.
      console.warn('[emailApi] SendGrid failed, falling back to server endpoint:', result.error);
    }
  } catch {
    // If the integration manager is unavailable (SSR, test env, etc.), fall through silently.
  }

  // Fallback: server-side endpoint (SMTP or Resend).
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error('Email API is not configured. Set VITE_EMAIL_API_BASE_URL to your Vercel app URL.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token || '';

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ type: 'email', ...payload }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Email API timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (body as { error?: string; message?: string })?.error
      || (body as { error?: string; message?: string })?.message
      || `Email API failed (${response.status})`;
    throw new Error(message);
  }

  return body;
}

import { supabase } from './supabase';

export interface SendEmailPayload {
  to: string | string[];
  subject: string;
  html: string;
}

function getApiBaseUrl(): string | null {
  const { protocol, hostname } = window.location;
  // A deployed web build (preview, production or custom domain) serves /api from
  // its own origin, and the Content-Security-Policy only allows same-origin
  // calls — so never send it to a configured base on another domain.
  if ((protocol === 'https:' || protocol === 'http:') && hostname !== 'localhost'
      && hostname !== '127.0.0.1' && !hostname.endsWith('.github.io')) {
    return window.location.origin;
  }

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
 * Send an email via the server-side /api/send endpoint, which tries the company's SMTP, then its
 * SendGrid account, then the platform sender. The company's keys stay on the server.
 */
export async function sendEmail(payload: SendEmailPayload, timeoutMs: number = 12000): Promise<unknown> {
  return postToSendApi({ type: 'email', ...payload }, timeoutMs, 'Email API');
}

/**
 * POST to the server-side /api/send endpoint as the signed-in user. Texts, payment links and
 * email go through it so the company's Twilio, Stripe and SendGrid keys never reach the browser.
 * Throws with the server's own message when it refuses.
 */
export async function postToSendApi<T = unknown>(
  body: Record<string, unknown>,
  timeoutMs: number = 12000,
  label: string = 'Server',
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error(`${label} is not configured. Set VITE_EMAIL_API_BASE_URL to your Vercel app URL.`);
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
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }

  const reply = await response.json().catch(() => ({})) as { error?: string; message?: string };
  if (!response.ok) {
    // "Twilio not configured" comes with a message saying where to set it up; show that.
    const message = (reply.message && reply.error && /not configured/i.test(reply.error) ? reply.message : null)
      || reply.error
      || reply.message
      || `${label} failed (${response.status})`;
    throw new Error(message);
  }

  return reply as T;
}

/**
 * The reason a Supabase function call failed, in words. supabase-js reports any non-2xx reply as
 * "Edge Function returned a non-2xx status code", which hides what the function actually said (for
 * example "Email service not configured"). The reply's own error message is in the response body.
 */
export async function describeFunctionError(err: unknown): Promise<string> {
  const e = err as { message?: string; context?: { json?: () => Promise<{ error?: string } | null> } } | null;
  try {
    if (e?.context && typeof e.context.json === 'function') {
      const body = await e.context.json();
      if (body?.error) return String(body.error);
    }
  } catch {
    // The body was not JSON: fall back to the generic message.
  }
  return e?.message ?? 'Unknown error';
}

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

export async function sendEmail(payload: SendEmailPayload, timeoutMs: number = 12000) {
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
    const message = body?.error || body?.message || `Email API failed (${response.status})`;
    throw new Error(message);
  }

  return body;
}

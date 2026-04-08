// useEmail — unified email-sending hook.
//
// Provides a stable React callback that sends email through whatever backend
// is currently configured:
//   1. SendGrid  — if the SendGrid integration is active in company_integrations
//   2. Fallback  — server-side /api/send endpoint (SMTP or Resend)
//
// This hook is thin: `emailApi.sendEmail` already encapsulates the routing
// logic so that non-React callers (automationEngine, etc.) also benefit from
// the same upgrade path without violating the Rules of Hooks.

import { useCallback } from 'react';
import { sendEmail as _sendEmail, SendEmailPayload } from '@/lib/emailApi';

export type { SendEmailPayload };

export interface UseEmailReturn {
  /**
   * Send an email. Automatically routes through SendGrid when configured,
   * or falls back to the existing /api/send-email endpoint.
   *
   * @throws Error if sending fails on both paths.
   */
  sendEmail: (payload: SendEmailPayload) => Promise<unknown>;
}

export function useEmail(): UseEmailReturn {
  const sendEmail = useCallback(
    (payload: SendEmailPayload) => _sendEmail(payload),
    []
  );

  return { sendEmail };
}

export default useEmail;

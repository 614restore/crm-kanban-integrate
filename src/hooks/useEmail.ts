// useEmail — unified email-sending hook.
//
// Provides a stable React callback that sends email through the server-side
// /api/send endpoint, which tries the company's SMTP, then its SendGrid account
// (from company_integrations), then the platform sender.
//
// This hook is thin: `emailApi.sendEmail` already encapsulates the routing
// logic so that non-React callers (automationEngine, etc.) also benefit from
// the same upgrade path without violating the Rules of Hooks.

import { useCallback } from 'react';
import { sendEmail as _sendEmail, SendEmailPayload } from '@/lib/emailApi';

export type { SendEmailPayload };

export interface UseEmailReturn {
  /**
   * Send an email through /api/send.
   *
   * @throws Error if the server could not send it.
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

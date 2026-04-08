// useTwilio — hook for sending SMS via Twilio credentials stored in company_integrations.
//
// Loads accountSid, authToken, and fromNumber from Supabase (integration_type = 'twilio').
// Exposes sendSMS(to, message) which calls the Twilio Messages API directly using
// btoa() for auth (browser-safe; avoids Node's Buffer).
// On success, logs an 'sms' record to the communications table.

import { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

interface SendSMSParams {
  to: string;
  message: string;
  contactId?: string;
  companyId?: string;
}

export interface UseTwilioReturn {
  twilioEnabled: boolean;
  loadingCredentials: boolean;
  sendSMS: (params: SendSMSParams) => Promise<void>;
  isSending: boolean;
}

export function useTwilio(): UseTwilioReturn {
  const { profile } = useAuth();
  const [credentials, setCredentials] = useState<TwilioCredentials | null>(null);
  const [loadingCredentials, setLoadingCredentials] = useState(true);

  // Load Twilio credentials from company_integrations
  useEffect(() => {
    const companyId = profile?.company_id;
    if (!companyId) {
      setLoadingCredentials(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data } = await supabase
          .from('company_integrations')
          .select('credentials, is_active')
          .eq('company_id', companyId)
          .eq('integration_type', 'twilio')
          .single();

        if (!cancelled) {
          if (
            data?.is_active &&
            data.credentials?.accountSid &&
            data.credentials?.authToken &&
            data.credentials?.fromNumber
          ) {
            setCredentials({
              accountSid: data.credentials.accountSid,
              authToken: data.credentials.authToken,
              fromNumber: data.credentials.fromNumber,
            });
          } else {
            setCredentials(null);
          }
        }
      } catch {
        if (!cancelled) setCredentials(null);
      } finally {
        if (!cancelled) setLoadingCredentials(false);
      }
    })();

    return () => { cancelled = true; };
  }, [profile?.company_id]);

  const mutation = useMutation({
    mutationFn: async ({ to, message, contactId, companyId }: SendSMSParams) => {
      if (!credentials) {
        throw new Error('Twilio is not configured. Add credentials in Settings → Integrations.');
      }

      const { accountSid, authToken, fromNumber } = credentials;
      const authHeader = `Basic ${btoa(`${accountSid}:${authToken}`)}`;

      const params = new URLSearchParams();
      params.append('From', fromNumber);
      params.append('To', to);
      params.append('Body', message);

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: params.toString(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const twilioMessage = errorData?.message || response.statusText;
        throw new Error(`Failed to send SMS: ${twilioMessage}`);
      }

      const result = await response.json();

      // Log to communications table if contact context is provided
      if (contactId && companyId) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('communications').insert({
          contact_id: contactId,
          company_id: companyId,
          type: 'sms',
          direction: 'outbound',
          content: message,
          status: 'sent',
          created_by: user?.id ?? null,
          created_at: new Date().toISOString(),
        });
      }

      return result;
    },
    onSuccess: () => {
      toast.success('SMS sent successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send SMS');
    },
  });

  const sendSMS = useCallback(
    async (params: SendSMSParams) => {
      await mutation.mutateAsync(params);
    },
    [mutation]
  );

  return {
    twilioEnabled: !!credentials,
    loadingCredentials,
    sendSMS,
    isSending: mutation.isPending,
  };
}

export default useTwilio;

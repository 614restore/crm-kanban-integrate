// useTwilio — hook for sending SMS through the company's Twilio account.
//
// The Twilio keys stay on the server: this only asks whether Twilio is connected
// (get_my_integration_status, which returns no keys), and sendSMS posts to
// /api/send, which reads the keys, sends the text and logs it on the customer's
// thread. The browser used to load the Account SID and Auth Token and call Twilio
// itself, which put them in the hands of anyone signed in to the company.

import { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { postToSendApi } from '../lib/emailApi';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

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
  const [twilioEnabled, setTwilioEnabled] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState(true);

  // Whether Twilio is connected and switched on for the company
  useEffect(() => {
    const companyId = profile?.company_id;
    if (!companyId) {
      setLoadingCredentials(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_my_integration_status', { p_company_id: companyId });
        if (error) throw error;
        const twilio = ((data as Array<{ integration_id: string; enabled: boolean; configured: boolean }>) || [])
          .find((row) => row.integration_id === 'twilio');
        if (!cancelled) setTwilioEnabled(!!(twilio?.enabled && twilio.configured));
      } catch (error) {
        console.warn('[useTwilio] could not check the Twilio connection:', error);
        if (!cancelled) setTwilioEnabled(false);
      } finally {
        if (!cancelled) setLoadingCredentials(false);
      }
    })();

    return () => { cancelled = true; };
  }, [profile?.company_id]);

  const mutation = useMutation({
    mutationFn: async ({ to, message, contactId }: SendSMSParams) => {
      if (!twilioEnabled) {
        throw new Error('Twilio is not configured. Add credentials in Settings → Integrations.');
      }
      // The server logs the text on the customer's thread when it has the customer.
      return postToSendApi({ type: 'sms', to, body: message, contactId }, 15000, 'Text messaging');
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
    twilioEnabled,
    loadingCredentials,
    sendSMS,
    isSending: mutation.isPending,
  };
}

export default useTwilio;

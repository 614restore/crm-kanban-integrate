import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * QuickBooksCallback — handles the OAuth redirect from QuickBooks if the
 * redirect_uri is pointed here instead of /api/quickbooks-callback.
 *
 * In production the server-side /api/quickbooks-callback handler processes
 * the token exchange and redirects back to the app with ?qb_connected=1 or
 * ?qb_error=..., so this page acts as a fallback for any client-side redirect.
 */
export default function QuickBooksCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting to QuickBooks…');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const realmId = params.get('realmId');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      setStatus('error');
      setMessage(`QuickBooks denied access: ${error}`);
      setTimeout(() => navigate('/?tab=settings&section=integrations'), 3000);
      return;
    }

    if (!code || !realmId || !state) {
      // Possibly arrived here after the server already handled the callback —
      // just redirect to settings.
      navigate('/?tab=settings&section=integrations');
      return;
    }

    // Forward code + state + realmId to the server-side handler
    const exchangeToken = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = await fetch(`/api/quickbooks-callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}&realmId=${encodeURIComponent(realmId)}`, {
          method: 'GET',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          redirect: 'follow',
        });

        // The server handler returns a redirect — if fetch followed it and landed
        // on the settings page URL, we treat that as success.
        if (res.ok || res.redirected) {
          setStatus('success');
          setMessage('QuickBooks connected successfully!');
          setTimeout(() => navigate('/?tab=settings&section=integrations&qb_connected=1'), 1500);
        } else {
          const data = await res.json().catch(() => ({}));
          setStatus('error');
          setMessage(data.error || 'Failed to connect QuickBooks. Please try again.');
          setTimeout(() => navigate('/?tab=settings&section=integrations'), 3000);
        }
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Network error. Please try again.');
        setTimeout(() => navigate('/?tab=settings&section=integrations'), 3000);
      }
    };

    exchangeToken();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-lg p-10 max-w-md w-full text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-[#2CA01C] mx-auto" />
            <p className="text-lg font-semibold text-gray-800">{message}</p>
            <p className="text-sm text-gray-500">Please wait while we complete the connection…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-lg font-semibold text-gray-800">{message}</p>
            <p className="text-sm text-gray-500">Redirecting you back to settings…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <p className="text-lg font-semibold text-gray-800">Connection Failed</p>
            <p className="text-sm text-gray-600">{message}</p>
            <p className="text-sm text-gray-500">Redirecting you back to settings…</p>
          </>
        )}
      </div>
    </div>
  );
}

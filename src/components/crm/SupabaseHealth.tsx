import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function SupabaseHealth() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      setStatus('checking');
      const start = Date.now();
      try {
        // Try a lightweight select to verify connectivity and permissions
        const { data, error } = await supabase.from('companies').select('id').limit(1).maybeSingle();
        const ms = Date.now() - start;
        if (!mounted) return;
        if (error) {
          setStatus('error');
          setMessage(`${error.message} (${ms}ms)`);
        } else {
          setStatus('ok');
          setMessage(`OK (${ms}ms)`);
        }
      } catch (err: any) {
        const ms = Date.now() - start;
        if (!mounted) return;
        setStatus('error');
        setMessage(`${err?.message || String(err)} (${ms}ms)`);
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="text-sm text-gray-600 mt-3">
      <strong>Supabase:</strong>{' '}
      {status === 'checking' && <span>Checking…</span>}
      {status === 'ok' && <span className="text-green-600">Connected — {message}</span>}
      {status === 'error' && <span className="text-red-600">Error — {message}</span>}
      {status === 'idle' && <span>Idle</span>}
    </div>
  );
}

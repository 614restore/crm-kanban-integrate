import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';

interface BucketStatus {
  name: string;
  exists: boolean;
  accessible: boolean;
  error?: string;
}

export default function SupabaseHealth() {
  const [dbStatus, setDbStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [dbMessage, setDbMessage] = useState<string | null>(null);
  const [buckets, setBuckets] = useState<BucketStatus[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    const checkDatabase = async () => {
      setDbStatus('checking');
      const start = Date.now();
      try {
        const { data, error } = await supabase.from('companies').select('id').limit(1).maybeSingle();
        const ms = Date.now() - start;
        if (!mounted) return;
        
        if (error) {
          setDbStatus('error');
          setDbMessage(`${error.message} (${ms}ms)`);
        } else {
          setDbStatus('ok');
          setDbMessage(`Connected (${ms}ms)`);
        }
      } catch (err: any) {
        const ms = Date.now() - start;
        if (!mounted) return;
        setDbStatus('error');
        setDbMessage(`${err?.message || String(err)} (${ms}ms)`);
      }
    };

    const checkStorageBuckets = async () => {
      const requiredBuckets = ['avatars', 'company-logos', 'projectceo-documents'];
      const bucketResults: BucketStatus[] = [];

      for (const bucketName of requiredBuckets) {
        try {
          // Try to list files in the bucket (limit 1 to keep it lightweight)
          const { data, error } = await supabase.storage.from(bucketName).list('', { limit: 1 });
          
          if (error) {
            bucketResults.push({
              name: bucketName,
              exists: false,
              accessible: false,
              error: error.message,
            });
          } else {
            bucketResults.push({
              name: bucketName,
              exists: true,
              accessible: true,
            });
          }
        } catch (err: any) {
          bucketResults.push({
            name: bucketName,
            exists: false,
            accessible: false,
            error: err?.message || 'Unknown error',
          });
        }
      }

      if (mounted) {
        setBuckets(bucketResults);
      }
    };

    checkDatabase();
    checkStorageBuckets();
    
    const id = setInterval(() => {
      checkDatabase();
      checkStorageBuckets();
    }, 60_000); // Check every minute
    
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const allBucketsOk = buckets.every(b => b.accessible);
  const hasStorageIssues = buckets.some(b => !b.accessible);

  return (
    <div className="text-sm text-gray-600 mt-3">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-left hover:text-gray-900 transition-colors w-full"
      >
        <strong>Supabase Status:</strong>
        {dbStatus === 'checking' && (
          <span className="flex items-center gap-1">
            <Loader2 size={14} className="animate-spin" />
            Checking…
          </span>
        )}
        {dbStatus === 'ok' && !hasStorageIssues && (
          <span className="text-green-600 flex items-center gap-1">
            <CheckCircle size={14} />
            All Systems Operational
          </span>
        )}
        {dbStatus === 'ok' && hasStorageIssues && (
          <span className="text-yellow-600 flex items-center gap-1">
            <AlertCircle size={14} />
            Database OK, Storage Issues
          </span>
        )}
        {dbStatus === 'error' && (
          <span className="text-red-600 flex items-center gap-1">
            <XCircle size={14} />
            Connection Error
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-2 pl-4 space-y-2 border-l-2 border-gray-200">
          <div className="flex items-center gap-2">
            <strong>Database:</strong>
            {dbStatus === 'ok' ? (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle size={12} />
                {dbMessage}
              </span>
            ) : (
              <span className="text-red-600 flex items-center gap-1">
                <XCircle size={12} />
                {dbMessage}
              </span>
            )}
          </div>

          <div>
            <strong>Storage Buckets:</strong>
            <div className="mt-1 space-y-1">
              {buckets.map((bucket) => (
                <div key={bucket.name} className="flex items-center gap-2 text-xs pl-2">
                  {bucket.accessible ? (
                    <CheckCircle size={12} className="text-green-600" />
                  ) : (
                    <XCircle size={12} className="text-red-600" />
                  )}
                  <span className={bucket.accessible ? 'text-green-600' : 'text-red-600'}>
                    {bucket.name}
                  </span>
                  {bucket.error && (
                    <span className="text-red-500 text-xs">({bucket.error})</span>
                  )}
                </div>
              ))}
              {!allBucketsOk && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                  <strong>Fix:</strong> Create missing buckets in Supabase Dashboard → Storage
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

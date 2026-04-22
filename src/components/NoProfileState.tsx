import React, { useState, useEffect } from 'react';
import { Building2, RefreshCw, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function NoProfileState() {
  const { user, refreshProfile } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => { fetchCompanies(); }, []);

  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    const { data } = await supabase.from('companies').select('id, name').order('name').limit(20);
    setCompanies(data ?? []);
    setLoadingCompanies(false);
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await supabase.auth.signOut({ scope: 'local' });
      window.location.href = '/login';
    } catch {
      localStorage.clear();
      window.location.reload();
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchCompanies();
    await refreshProfile();
    setIsRefreshing(false);
  };

  const linkToCompany = async (companyId: string, companyName: string) => {
    setLinkingId(companyId);
    setStatusMsg(`Linking to ${companyName}…`);
    try {
      const payload = {
        id: user.id,
        company_id: companyId,
        email: user.email,
        first_name: user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'Owner',
        last_name: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
        role: 'owner',
        is_active: true,
      };

      const { error } = await (supabase.from('profiles') as any).insert(payload);

      if (error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          await (supabase.from('profiles') as any)
            .update({ company_id: companyId })
            .eq('id', user.id);
        } else {
          setStatusMsg(`Error: ${error.message}`);
          setLinkingId(null);
          return;
        }
      }

      setStatusMsg('Linked! Loading your dashboard…');
      await refreshProfile();
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
      setLinkingId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-50">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-20 w-20 bg-white rounded-[1.75rem] flex items-center justify-center shadow-xl border border-slate-100">
            <Building2 className="text-accent" size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-primary">Link Your Company</h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              Your account is active. Select your company below to finish setting up your profile.
            </p>
            <p className="text-[11px] text-slate-400 font-mono">{user?.email}</p>
          </div>
        </div>

        {statusMsg && (
          <div className="bg-accent/10 border border-accent/20 text-accent text-sm font-medium px-4 py-3 rounded-2xl text-center">
            {statusMsg}
          </div>
        )}

        <div className="card divide-y divide-slate-50">
          <div className="px-4 py-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Available Companies</p>
          </div>

          {loadingCompanies ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="text-accent animate-spin" />
            </div>
          ) : companies.length === 0 ? (
            <div className="px-4 py-8 text-center space-y-2">
              <p className="text-sm font-medium text-slate-600">No companies found</p>
              <p className="text-xs text-slate-400">Contact your company administrator to be invited.</p>
            </div>
          ) : (
            companies.map((c) => (
              <button
                key={c.id}
                onClick={() => linkToCompany(c.id, c.name)}
                disabled={!!linkingId}
                className="w-full px-4 py-4 flex items-center justify-between active:bg-slate-50 transition-colors disabled:opacity-60"
              >
                <span className="text-sm font-bold text-slate-700">{c.name}</span>
                {linkingId === c.id
                  ? <Loader2 size={16} className="text-accent animate-spin" />
                  : <ChevronRight size={16} className="text-slate-300" />}
              </button>
            ))
          )}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || loadingCompanies}
            className="w-full bg-accent text-white font-bold py-4 rounded-2xl shadow-lg shadow-accent/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Checking…' : 'Refresh'}
          </button>

          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="text-slate-400 text-xs font-bold uppercase tracking-widest py-2 hover:text-error transition-colors disabled:opacity-50"
          >
            {isSigningOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </div>
    </div>
  );
}

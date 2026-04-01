import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/authContext';
import {
    Building2,
    Lock,
    Eye,
    EyeOff,
    Loader2,
    ArrowRight,
    AlertCircle,
    CheckCircle
} from 'lucide-react';

export default function UpdatePassword() {
    const { user, profile, loading: authLoading, updateProfile } = useAuth();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [sessionCheckLoading, setSessionCheckLoading] = useState(true);
    const [sessionReady, setSessionReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const initializeRecoverySession = async () => {
            setSessionCheckLoading(true);
            setError(null);

            try {
                const url = new URL(window.location.href);
                const query = url.searchParams;
                const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

                const code = query.get('code');
                const tokenHash = query.get('token_hash') || hash.get('token_hash');
                const recoveryType = query.get('type') || hash.get('type');
                const accessToken = hash.get('access_token');
                const refreshToken = hash.get('refresh_token');

                if (code) {
                    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                    if (exchangeError) throw exchangeError;
                } else if (tokenHash && recoveryType === 'recovery') {
                    const { error: verifyError } = await supabase.auth.verifyOtp({
                        type: 'recovery',
                        token_hash: tokenHash,
                    });
                    if (verifyError) throw verifyError;
                } else if (accessToken && refreshToken) {
                    const { error: setSessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });
                    if (setSessionError) throw setSessionError;
                }

                let { data: { session } } = await supabase.auth.getSession();

                if (!session && (code || tokenHash || accessToken)) {
                    for (let attempt = 0; attempt < 3; attempt += 1) {
                        await new Promise((resolve) => setTimeout(resolve, 250));
                        const current = await supabase.auth.getSession();
                        session = current.data.session;
                        if (session) break;
                    }
                }

                if (!session) {
                    if (!cancelled) {
                        setSessionReady(false);
                        setError('No valid reset session found. Please request a new password reset link.');
                    }
                    return;
                }

                if (!cancelled) {
                    setSessionReady(true);
                }

                if (code || tokenHash || accessToken || window.location.hash.includes('access_token=')) {
                    window.history.replaceState({}, '', window.location.pathname);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setSessionReady(false);
                    setError(err?.message || 'Unable to verify reset session. Please request a new reset link.');
                }
            } finally {
                if (!cancelled) {
                    setSessionCheckLoading(false);
                }
            }
        };

        initializeRecoverySession();

        return () => {
            cancelled = true;
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!sessionReady) {
            setError('No valid reset session found. Please request a new password reset link.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        setLoading(true);
        try {
            const { error: updateUserError } = await supabase.auth.updateUser({ password });
            if (updateUserError) {
                const message = updateUserError.message?.toLowerCase() || '';
                const requiresServerFallback =
                    message.includes('secure password') ||
                    message.includes('reauthentication') ||
                    message.includes('reauth');
                const isForcedTempPasswordFlow = profile?.must_change_password === true;
                if (!requiresServerFallback || !isForcedTempPasswordFlow) {
                    throw updateUserError;
                }

                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) throw new Error('No active session. Please sign in again.');

                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const res = await fetch(`${supabaseUrl}/functions/v1/confirm-password-change`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({ password }),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.error || 'Failed to update password.');
                }
            }

            await updateProfile({ must_change_password: false });
            setSuccess('Password updated! Taking you to the app…');
            setTimeout(() => { window.location.reload(); }, 1500);
        } catch (err: any) {
            setError(err.message || 'Failed to update password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center p-4">
                <Loader2 className="animate-spin text-white" size={40} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Building2 size={28} className="text-white" />
                    </div>
                    <span className="text-2xl font-bold text-white tracking-tight">TrussCTR</span>
                </div>

                <div className="bg-white rounded-2xl shadow-2xl p-8">
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Set New Password</h2>
                        <p className="text-gray-500 mt-2 text-sm">
                            {user ? 'Choose a new password for your account.' : 'Your session is being verified…'}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                            <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
                            <p className="text-red-700 text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {success ? (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                            <CheckCircle className="text-green-500 flex-shrink-0" size={20} />
                            <p className="text-green-700 text-sm font-medium">{success}</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        autoFocus
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                        placeholder="Min. 8 characters"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                        placeholder="Re-enter new password"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || sessionCheckLoading || !sessionReady}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-sm"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : sessionCheckLoading ? (
                                    <><Loader2 className="animate-spin" size={18} />Verifying reset link…</>
                                ) : (
                                    <><ArrowRight size={18} />Set Password</>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
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
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [exchanging, setExchanging] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        // supabase.ts sets this flag from the raw URL *before* Supabase clears
        // the hash, so we can detect an implicit-flow recovery link even after
        // the hash is gone from window.location.
        const isPendingReset = sessionStorage.getItem('pending_password_reset') === 'true';
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        // PASSWORD_RECOVERY fires once Supabase finishes processing the
        // #access_token hash (implicit flow).
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session && isPendingReset)) {
                sessionStorage.removeItem('pending_password_reset');
                setExchanging(false);
            }
        });

        if (code) {
            // PKCE flow: exchange the one-time code for a session
            supabase.auth.exchangeCodeForSession(code)
                .then(({ error }) => {
                    if (error) {
                        setError('Invalid or expired reset link. Please request a new one.');
                        setExchanging(false);
                    }
                    // On success, onAuthStateChange SIGNED_IN fires above
                })
                .catch(() => {
                    setError('Invalid or expired reset link. Please request a new one.');
                    setExchanging(false);
                });
        } else if (isPendingReset) {
            // Implicit flow: Supabase is asynchronously processing the hash token.
            // Wait for PASSWORD_RECOVERY via onAuthStateChange, but add a 5s
            // fallback in case the event never fires (expired / already-used token).
            const timer = setTimeout(async () => {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    sessionStorage.removeItem('pending_password_reset');
                    setExchanging(false);
                } else {
                    setError('Invalid or expired reset link. Please request a new one.');
                    setExchanging(false);
                }
            }, 5000);
            return () => { clearTimeout(timer); subscription.unsubscribe(); };
        } else {
            // No recovery signal — check for a pre-existing session
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (!session) {
                    setError('No valid reset session found. Please request a new reset link.');
                }
                setExchanging(false);
            });
        }

        return () => subscription.unsubscribe();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                setError('No active session. Please log in again.');
                setLoading(false);
                return;
            }

            // Use confirm-password-change edge function — works for both the
            // temp-password flow (must_change_password flag) and Supabase
            // recovery links. Also clears must_change_password in the profile.
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const res = await fetch(`${supabaseUrl}/functions/v1/confirm-password-change`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ password }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data?.error || 'Failed to update password. Please try again.');
            } else {
                setSuccess('Password updated successfully! Redirecting...');
                setTimeout(() => {
                    try { sessionStorage.removeItem('pending_password_reset'); } catch (e) { console.warn('[UpdatePassword] sessionStorage cleanup failed:', e); }
                    window.location.href = window.location.origin + (import.meta.env.BASE_URL || '/');
                }, 2000);
            }
        } catch (err: any) {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

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
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-gray-900">Update Password</h2>
                        <p className="text-gray-500 mt-2">Enter a new secure password for your account</p>
                    </div>

                    {exchanging && (
                        <div className="flex justify-center py-8">
                            <Loader2 className="animate-spin text-blue-500" size={32} />
                        </div>
                    )}

                    {!exchanging && error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                            <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
                            <p className="text-red-700 text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {!exchanging && success && (
                        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                            <CheckCircle className="text-green-500 flex-shrink-0" size={20} />
                            <p className="text-green-700 text-sm font-medium">{success}</p>
                        </div>
                    )}

                    {!exchanging && !error && !success && (
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
                                        placeholder="••••••••"
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
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-sm"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <><ArrowRight size={18} />Update Password</>}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { supabase, isDemoMode } from '@/lib/supabase';
import { roleLabels, UserRole } from '@/lib/crmData';
import {
  Building2,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'reset';

export default function AuthPage() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState<UserRole>('sales');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteCompanyId, setInviteCompanyId] = useState<string | null>(null);

  // Check for invite parameters in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    const companyId = params.get('company');

    if (token && companyId) {
      setInviteToken(token);
      setInviteCompanyId(companyId);
      setMode('signup');

      // Fetch invite details
      supabase
        .from('invitations')
        .select('email, role, accepted, expires_at')
        .eq('token', token)
        .eq('company_id', companyId)
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            setError('Invalid invite link');
            return;
          }

          // Check if already accepted
          if (data.accepted) {
            setError('This invitation has already been used');
            return;
          }

          // Check if expired
          const expiresAt = new Date(data.expires_at);
          if (expiresAt < new Date()) {
            setError('This invitation has expired. Please request a new one.');
            return;
          }

          // Valid invitation
          setEmail(data.email);
          setRole(data.role as UserRole);
        });
    }
  }, []);

  // Demo mode auto-fill
  useEffect(() => {
    if (isDemoMode && !inviteToken) {
      setEmail('demo@example.com');
      setPassword('password');
    }
  }, [inviteToken]);

  const isAlreadyRegisteredError = (message?: string | null) => {
    if (!message) return false;
    const normalized = message.toLowerCase();
    return normalized.includes('user already registered') || normalized.includes('already registered');
  };

  const isTokenError = (message?: string | null) => {
    if (!message) return false;
    const normalized = message.toLowerCase();
    return normalized.includes('token') || normalized.includes('jwt') || normalized.includes('refresh_token');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          if (isTokenError(error.message)) {
            try {
              await supabase.auth.signOut({ scope: 'local' });
            } catch (signOutError) {
              console.warn('Failed to clear local auth session after token error:', signOutError);
            }
            setError('Your previous session expired. Please try signing in again.');
          } else {
            setError(error.message || 'Failed to sign in. Please check your credentials.');
          }
        }
      } else if (mode === 'signup') {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        
        // For invite signups, include company_id and role from invitation
        // For new company signups, omit role so authContext assigns 'owner'
        const signupMetadata: any = {
          first_name: firstName,
          last_name: lastName,
        };
        
        if (inviteCompanyId) {
          signupMetadata.company_id = inviteCompanyId;
          signupMetadata.role = role;
        } else if (companyName.trim()) {
          signupMetadata.company_name = companyName.trim();
        }
        
        const { error } = await signUp(email, password, signupMetadata);
        
        if (error) {
          if (isAlreadyRegisteredError(error.message)) {
            setMode('login');
            setError('This email is already registered. Please sign in or reset your password.');
          } else {
            setError(error.message || 'Failed to create account. Please try again.');
          }
        } else {
          // If signing up via invite, mark invitation as accepted
          if (inviteToken && inviteCompanyId) {
            try {
              await supabase
                .from('invitations')
                .update({ accepted: true })
                .eq('token', inviteToken)
                .eq('company_id', inviteCompanyId);

              setSuccess('Account created! You have been added to the team.');
            } catch (inviteError) {
              console.error('Error updating invite:', inviteError);
              // Account was still created successfully
              setSuccess('Account created! You have been added to the team.');
            }
          } else {
            setSuccess('Account created! Please check your email to verify your account.');
          }
          setMode('login');
        }
      } else if (mode === 'reset') {
        const { error } = await resetPassword(email);
        if (error) {
          setError(error.message || 'Failed to send reset email. Please try again.');
        } else {
          setSuccess('Password reset email sent! Check your inbox.');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Building2 size={28} className="text-white" />
            </div>
            <div>
              <span className="text-2xl font-bold text-white">TrussCTR</span>
              <p className="text-blue-200 text-sm italic">Restoration Management Simplified</p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <h1 className="text-5xl font-bold text-white leading-tight">
            The #1 CRM for
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              Roofing Contractors
            </span>
          </h1>
          <p className="text-xl text-slate-300 max-w-md">
            Track customers from first contact to final payment. Manage insurance claims, schedule
            jobs, and grow your business.
          </p>

          <div className="space-y-4">
            {[
              'Complete customer lifecycle tracking',
              'Insurance claim management',
              'Customizable Kanban boards',
              'Team collaboration & permissions',
              'QuickBooks & mobile app integration',
            ].map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <CheckCircle className="text-green-400" size={20} />
                <span className="text-slate-300">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-500 text-sm">
          Trusted by 500+ roofing companies across the nation
        </p>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center justify-center mb-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Building2 size={24} className="text-white" />
              </div>
              <span className="text-xl font-bold text-white">TrussCTR</span>
            </div>
            <p className="text-blue-200 text-sm italic">Restoration Management Simplified</p>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">
                {mode === 'login'
                  ? 'Welcome back'
                  : mode === 'signup'
                  ? 'Create your account'
                  : 'Reset your password'}
              </h2>
              <p className="text-gray-500 mt-2">
                {mode === 'login'
                  ? 'Sign in to access your CRM'
                  : mode === 'signup'
                  ? 'Start your 14-day free trial'
                  : 'Enter your email to receive a reset link'}
              </p>
              {mode === 'signup' && (
                <div className="mt-3 inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full">
                  <span>🎉</span>
                  <span>Subscribe within your trial — get <strong>50% off your first 3 months</strong></span>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                <CheckCircle className="text-green-500 flex-shrink-0" size={20} />
                <p className="text-green-700 text-sm">{success}</p>
              </div>
            )}

            {isDemoMode && mode === 'login' && !inviteToken && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="text-blue-500 flex-shrink-0" size={20} />
                  <p className="text-blue-800 font-medium text-sm">Demo Mode Active</p>
                </div>
                <div className="text-sm text-blue-700">
                  <p className="mb-1">Use these demo credentials to login:</p>
                  <div className="font-mono bg-blue-100 p-2 rounded text-xs">
                    <div>Email: <strong>demo@example.com</strong></div>
                    <div>Password: <strong>password</strong></div>
                  </div>
                </div>
              </div>
            )}

            {inviteToken && mode === 'signup' && (
              <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Mail className="text-indigo-500 flex-shrink-0" size={20} />
                  <p className="text-indigo-800 font-medium text-sm">
                    You've been invited to join a team! Complete signup to accept.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'signup' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <div className="relative">
                      <User
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        placeholder="John"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>
              )}

              {mode === 'signup' && !inviteToken && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name
                  </label>
                  <div className="relative">
                    <Building2
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      placeholder="Acme Roofing Co."
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
                    placeholder="you@company.com"
                    required
                    disabled={!!inviteToken}
                  />
                </div>
              </div>

              {mode !== 'reset' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'signup' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>

                  {inviteToken && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as UserRole)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
                        disabled={!!inviteToken}
                      >
                        {Object.entries(roleLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {mode === 'login' && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setMode('reset')}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    {mode === 'login'
                      ? 'Sign In'
                      : mode === 'signup'
                      ? 'Create Account'
                      : 'Send Reset Link'}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              {mode === 'login' ? (
                <p className="text-gray-600">
                  Don't have an account?{' '}
                  <button
                    onClick={() => {
                      setMode('signup');
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Sign up free
                  </button>
                </p>
              ) : (
                <p className="text-gray-600">
                  Already have an account?{' '}
                  <button
                    onClick={() => {
                      setMode('login');
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Sign in
                  </button>
                </p>
              )}
            </div>
          </div>

          <p className="text-center text-slate-400 text-sm mt-6">
            By signing up, you agree to our{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Terms of Service</a>
            {', '}
            <a href="/eula" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">EULA</a>
            {' and '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}

// Copied from QuoteMGR src/components/AIEstimatingPanel.tsx (read-only reference).
import React, { useEffect, useState } from 'react';
import { Sparkles, Brain, Zap, Settings, AlertCircle, CheckCircle, XCircle, Camera, Type } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface AIEstimatingPanelProps {
  companyId: string;
  /** TrussCTR: only owners and admins see and change the team key. Defaults to true, as in QuoteMGR. */
  canManageTeamKey?: boolean;
}

interface AIConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'groq';
  api_key: string;
  model: string;
  enabled: boolean;
  vision_provider?: 'openai' | 'anthropic' | 'google' | null;
  vision_api_key?: string | null;
  vision_model?: string | null;
}

const textProviders = [
  {
    id: 'groq',
    name: 'Groq',
    logo: '⚡',
    models: [
      { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B (Recommended)', cost: '$0.59/1M tokens' },
      { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B (Fastest)', cost: '$0.05/1M tokens' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', cost: '$0.24/1M tokens' },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B', cost: '$0.20/1M tokens' },
    ],
    website: 'https://console.groq.com/keys',
    description: 'Blazing fast inference — best for price suggestions & emails. No photo analysis.',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    logo: '🤖',
    models: [
      { id: 'gpt-5.4', name: 'GPT-5.4 (Recommended)', cost: '$1.25/1M tokens' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Faster)', cost: '$0.15/1M tokens' },
      { id: 'gpt-4o', name: 'GPT-4o', cost: '$5/1M tokens' },
    ],
    website: 'https://platform.openai.com/api-keys',
    description: 'Most popular and reliable AI — supports both text and photo analysis.',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    logo: '🧠',
    models: [
      { id: 'claude-sonnet-5', name: 'Claude Sonnet 5 (Recommended)', cost: '$3/1M tokens' },
      { id: 'claude-opus-5', name: 'Claude Opus 5 (Most Capable)', cost: '$5/1M tokens' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5 (Fastest)', cost: '$1/1M tokens' },
    ],
    website: 'https://console.anthropic.com/settings/keys',
    description: 'Advanced reasoning — supports both text and photo analysis.',
  },
  {
    id: 'google',
    name: 'Google Gemini',
    logo: '✨',
    models: [
      { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro (Most Capable)', cost: '$2–$18/1M tokens' },
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Recommended)', cost: '$0.30/1M tokens' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Budget)', cost: '$0.30/1M tokens' },
    ],
    website: 'https://aistudio.google.com/app/apikey',
    description: 'Cost-effective with generous free tier — supports both text and photo analysis.',
  },
];

const visionProviders = textProviders.filter(p => p.id !== 'groq');

const aiFeatures = [
  { icon: '📸', title: 'Photo Analysis', description: 'AI analyzes damage photos and suggests line items' },
  { icon: '📝', title: 'Smart Descriptions', description: 'Generate professional project descriptions automatically' },
  { icon: '💰', title: 'Price Suggestions', description: 'AI recommends realistic per-unit contractor pricing' },
  { icon: '🔍', title: 'Scope Detection', description: 'Identify missing items and suggest additions' },
  { icon: '📊', title: 'Material Calculations', description: 'Calculate quantities and waste factors intelligently' },
  { icon: '✉️', title: 'Email Drafts', description: 'Generate professional emails to send with quotes' },
];

const AIEstimatingPanel: React.FC<AIEstimatingPanelProps> = ({ companyId, canManageTeamKey = true }) => {
  // Company-wide config (admin-managed fallback)
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [textForm, setTextForm] = useState({
    provider: 'groq' as 'openai' | 'anthropic' | 'google' | 'groq',
    api_key: '',
    model: 'openai/gpt-oss-120b',
  });

  const [visionForm, setVisionForm] = useState({
    enabled: false,
    provider: 'google' as 'openai' | 'anthropic' | 'google',
    api_key: '',
    model: 'gemini-3.6-flash',
  });

  // Personal key (per-user — not shared with teammates)
  const [userConfig, setUserConfig] = useState<AIConfig | null>(null);
  const [editingUser, setEditingUser] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [userForm, setUserForm] = useState({
    provider: 'groq' as 'openai' | 'anthropic' | 'google' | 'groq',
    api_key: '',
    model: 'openai/gpt-oss-120b',
  });
  const [userVisionForm, setUserVisionForm] = useState({
    enabled: false,
    provider: 'google' as 'openai' | 'anthropic' | 'google',
    api_key: '',
    model: 'gemini-3.6-flash',
  });

  useEffect(() => {
    // The company key is readable by owners and admins only.
    if (canManageTeamKey) loadConfig(); else setLoading(false);
    loadUserConfig();
  }, [companyId, canManageTeamKey]);

  const loadUserConfig = async () => {
    const { data } = await supabase
      .from('user_ai_configs')
      .select('provider, api_key, model, enabled, vision_provider, vision_api_key, vision_model')
      .maybeSingle();
    if (data) {
      setUserConfig(data as AIConfig);
      setUserForm({ provider: data.provider as any, api_key: data.api_key, model: data.model });
      if (data.vision_provider) {
        setUserVisionForm({
          enabled: true,
          provider: data.vision_provider as any,
          api_key: data.vision_api_key || '',
          model: data.vision_model || 'gemini-3.6-flash',
        });
      }
    }
  };

  const handleSaveUserConfig = async () => {
    if (!userForm.api_key.trim()) {
      toast.error('Please enter an API key');
      return;
    }
    if (userVisionForm.enabled && !userVisionForm.api_key.trim()) {
      toast.error('Please enter an API key for photo analysis, or turn it off');
      return;
    }
    setSavingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) await supabase.auth.refreshSession();
      const { error } = await supabase.rpc('upsert_my_user_ai_config', {
        p_provider:        userForm.provider,
        p_api_key:         userForm.api_key.trim(),
        p_model:           userForm.model,
        p_enabled:         true,
        p_vision_provider: userVisionForm.enabled ? userVisionForm.provider : null,
        p_vision_api_key:  userVisionForm.enabled ? userVisionForm.api_key.trim() : null,
        p_vision_model:    userVisionForm.enabled ? userVisionForm.model : null,
      });
      if (error) throw error;
      toast.success('Personal AI config saved!');
      setEditingUser(false);
      await loadUserConfig();
    } catch (err: any) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleRemoveUserConfig = async () => {
    if (!confirm('Remove your personal AI config? The team default will be used instead.')) return;
    await supabase.from('user_ai_configs').delete().eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '');
    setUserConfig(null);
    setUserForm({ provider: 'groq', api_key: '', model: 'openai/gpt-oss-120b' });
    setUserVisionForm({ enabled: false, provider: 'google', api_key: '', model: 'gemini-3.6-flash' });
    toast.success('Personal config removed.');
  };

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_configurations')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data);
        setTextForm({
          provider: data.provider,
          api_key: data.api_key,
          model: data.model,
        });
        if (data.vision_provider) {
          setVisionForm({
            enabled: true,
            provider: data.vision_provider,
            api_key: data.vision_api_key || '',
            model: data.vision_model || 'gemini-3.6-flash',
          });
        }
      }
    } catch (err) {
      console.error('Failed to load AI config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!textForm.api_key.trim()) {
      toast.error('Please enter an API key for the text/pricing provider');
      return;
    }
    if (visionForm.enabled && !visionForm.api_key.trim()) {
      toast.error('Please enter an API key for the vision provider, or disable it');
      return;
    }

    setSaving(true);
    try {
      // Ensure we have a fresh, valid session before calling the RPC.
      // If the session is missing or expired, auth.uid() inside the SECURITY
      // DEFINER function returns NULL, which causes "Not authorized".
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      console.log('[AI Config] session user:', session?.user?.id, session?.user?.email, 'companyId:', companyId);
      if (sessionErr || !session) {
        console.warn('[AI Config] No session — attempting refresh');
        const { error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshErr) {
          toast.error('Your session has expired — please log out and log back in, then try again.');
          return;
        }
      }

      // Use SECURITY DEFINER RPC — the direct upsert goes through RLS WITH CHECK
      // which depends on auth.uid(). If auth.uid() is transiently NULL (session
      // mid-refresh), the check fails with "violates row-level security policy".
      // The RPC does the auth check manually and bypasses RLS entirely.
      const { error: saveError } = await supabase.rpc('upsert_my_ai_config', {
        p_company_id:      companyId,
        p_provider:        textForm.provider,
        p_api_key:         textForm.api_key,
        p_model:           textForm.model,
        p_enabled:         true,
        p_vision_provider: visionForm.enabled ? visionForm.provider : null,
        p_vision_api_key:  visionForm.enabled ? visionForm.api_key  : null,
        p_vision_model:    visionForm.enabled ? visionForm.model    : null,
      });

      if (saveError) {
        console.error('Supabase error:', saveError.message, saveError.code, saveError.details, saveError.hint);
        toast.error(`Failed to save: ${saveError.message || saveError.code || 'Unknown error'}`);
        return;
      }

      setConfig({
        company_id: companyId,
        provider: textForm.provider,
        api_key: textForm.api_key,
        model: textForm.model,
        enabled: true,
        vision_provider: visionForm.enabled ? visionForm.provider : null,
        vision_api_key: visionForm.enabled ? visionForm.api_key : null,
        vision_model: visionForm.enabled ? visionForm.model : null,
      } as any);
      toast.success('AI configuration saved!');
      setEditing(false);
    } catch (err: any) {
      console.error('Failed to save AI config:', err);
      toast.error(`Failed to save: ${err?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!config) return;
    try {
      const newEnabled = !config.enabled;
      const { error } = await supabase
        .from('ai_configurations')
        .update({ enabled: newEnabled })
        .eq('company_id', companyId);
      if (error) throw error;
      setConfig({ ...config, enabled: newEnabled });
      toast.success(newEnabled ? 'AI features enabled' : 'AI features disabled');
    } catch {
      toast.error('Failed to update configuration');
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Remove AI configuration?')) return;
    try {
      const { error } = await supabase.from('ai_configurations').delete().eq('company_id', companyId);
      if (error) throw error;
      setConfig(null);
      setTextForm({ provider: 'groq', api_key: '', model: 'openai/gpt-oss-120b' });
      setVisionForm({ enabled: false, provider: 'google', api_key: '', model: 'gemini-3.6-flash' });
      toast.success('AI configuration removed');
    } catch {
      toast.error('Failed to remove configuration');
    }
  };

  const selectedTextProvider = textProviders.find(p => p.id === textForm.provider);
  const selectedVisionProvider = visionProviders.find(p => p.id === visionForm.provider);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isConfigured = !!config?.enabled;
  const textProviderName = textProviders.find(p => p.id === config?.provider)?.name;
  const visionProviderName = visionProviders.find(p => p.id === config?.vision_provider)?.name;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">AI Estimating Assistant</h2>
          <p className="text-sm text-gray-500">Use AI to speed up quote creation and improve accuracy</p>
        </div>
      </div>

      {/* ── Personal API Key ────────────────────────────────────────────── */}
      <div className="border border-purple-200 rounded-xl overflow-hidden">
        <div className="bg-purple-50 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-purple-900">My Personal API Key</p>
            <p className="text-xs text-purple-600 mt-0.5">
              Your own key — used instead of the team default so rate limits stay separate
            </p>
          </div>
          {userConfig && !editingUser && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditingUser(true)}
                className="text-xs text-purple-600 hover:text-purple-800 font-medium px-2 py-1 rounded hover:bg-purple-100"
              >
                Change
              </button>
              <button
                onClick={handleRemoveUserConfig}
                className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        <div className="px-4 py-4 bg-white">
          {!editingUser && userConfig ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-gray-400" />
                    {textProviders.find(p => p.id === userConfig.provider)?.name} — {userConfig.model}
                  </p>
                  {userConfig.vision_provider ? (
                    <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                      <Camera className="w-3.5 h-3.5 text-gray-400" />
                      Photo analysis: {visionProviders.find(p => p.id === userConfig.vision_provider)?.name} — {userConfig.vision_model}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600 flex items-center gap-1.5 mt-0.5">
                      <Camera className="w-3.5 h-3.5" />
                      Photo analysis: not configured
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400">Your key takes priority over the team default</p>
            </div>
          ) : editingUser || !userConfig ? (
            <div className="space-y-4">
              {/* ── Text / Pricing provider ── */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5" /> Text &amp; Pricing AI <span className="text-red-400">Required</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {textProviders.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        const defaultModel = textProviders.find(x => x.id === p.id)?.models[0].id || '';
                        setUserForm(f => ({ ...f, provider: p.id as any, model: defaultModel, api_key: '' }));
                      }}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all ${
                        userForm.provider === p.id
                          ? 'border-purple-400 bg-purple-50 ring-1 ring-purple-300'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span>{p.logo}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                        {p.id === 'groq' && <p className="text-[10px] text-green-600 font-medium">Free</p>}
                      </div>
                    </button>
                  ))}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-gray-600">API Key</label>
                    <a
                      href={textProviders.find(p => p.id === userForm.provider)?.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                    >
                      Get key →
                    </a>
                  </div>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={userForm.api_key}
                    onChange={e => setUserForm(f => ({ ...f, api_key: e.target.value }))}
                    placeholder="Paste your API key…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Model</label>
                  <select
                    value={userForm.model}
                    onChange={e => setUserForm(f => ({ ...f, model: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none"
                  >
                    {textProviders.find(p => p.id === userForm.provider)?.models.map(m => (
                      <option key={m.id} value={m.id}>{m.name} — {m.cost}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Photo / Vision provider (optional) ── */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" /> Photo Analysis <span className="text-gray-400 font-normal normal-case">Optional</span>
                  </p>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userVisionForm.enabled}
                      onChange={e => setUserVisionForm(f => ({ ...f, enabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                  </label>
                </div>
                {userForm.provider === 'groq' && !userVisionForm.enabled && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                    Groq doesn't support photo analysis. Enable this to add a separate key for photo-based features (e.g. damage detection from job site photos).
                  </p>
                )}
                {userVisionForm.enabled && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      {visionProviders.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            const defaultModel = visionProviders.find(x => x.id === p.id)?.models[0].id || '';
                            setUserVisionForm(f => ({ ...f, provider: p.id as any, model: defaultModel, api_key: '' }));
                          }}
                          className={`flex flex-col gap-1 p-2.5 rounded-lg border text-left transition-all ${
                            userVisionForm.provider === p.id
                              ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span>{p.logo}</span>
                          <p className="text-[10px] font-semibold text-gray-800 leading-tight">{p.name}</p>
                        </button>
                      ))}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-gray-600">
                          {visionProviders.find(p => p.id === userVisionForm.provider)?.name} API Key
                        </label>
                        <a
                          href={visionProviders.find(p => p.id === userVisionForm.provider)?.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Get key →
                        </a>
                      </div>
                      <input
                        type="password"
                        value={userVisionForm.api_key}
                        onChange={e => setUserVisionForm(f => ({ ...f, api_key: e.target.value }))}
                        placeholder="Paste your vision API key…"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Model</label>
                      <select
                        value={userVisionForm.model}
                        onChange={e => setUserVisionForm(f => ({ ...f, model: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                      >
                        {visionProviders.find(p => p.id === userVisionForm.provider)?.models.map(m => (
                          <option key={m.id} value={m.id}>{m.name} — {m.cost}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveUserConfig}
                  disabled={savingUser}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {savingUser ? 'Saving…' : 'Save My Config'}
                </button>
                {editingUser && (
                  <button
                    onClick={() => setEditingUser(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {canManageTeamKey ? (
      <>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-semibold text-amber-900">Team default API key</p>
        <p className="text-sm text-amber-800 mt-1">
          Connect a team-wide key as a fallback for anyone who hasn't set a personal key. Also configures the optional vision provider for photo analysis.
        </p>
      </div>

      {/* Status Card */}
      <div className={`border rounded-xl p-5 ${isConfigured ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isConfigured ? (
              <>
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-gray-900">AI Features Active</p>
                  <div className="text-sm text-gray-600 space-y-0.5 mt-0.5">
                    <p className="flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5" />
                      Text: {textProviderName} — {config?.model}
                    </p>
                    {config?.vision_provider ? (
                      <p className="flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5" />
                        Vision: {visionProviderName} — {config?.vision_model}
                      </p>
                    ) : (
                      <p className="flex items-center gap-1.5 text-amber-600">
                        <Camera className="w-3.5 h-3.5" />
                        Vision: not configured (photos disabled)
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : config ? (
              <>
                <XCircle className="w-6 h-6 text-gray-400" />
                <div>
                  <p className="font-semibold text-gray-900">AI Features Disabled</p>
                  <p className="text-sm text-gray-600">Enable to start using AI assistance</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="w-6 h-6 text-gray-400" />
                <div>
                  <p className="font-semibold text-gray-900">Not Configured</p>
                  <p className="text-sm text-gray-600">Add your API key to get started</p>
                </div>
              </>
            )}
          </div>
          {config && (
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={config.enabled} onChange={handleToggleEnabled} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-1">Your API keys stay private</p>
          <p className="text-blue-800">
            Keys are stored securely in your account. AI requests go directly from your session — you only pay your provider for what you use.
          </p>
        </div>
      </div>

      {/* AI Features Grid */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-4">What AI Can Do:</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {aiFeatures.map((feature, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
              <div className="text-2xl">{feature.icon}</div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">{feature.title}</h4>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration Form */}
      {editing || !config ? (
        <div className="space-y-6">

          {/* ── SECTION 1: TEXT & PRICING AI (required — shown first) ── */}
          <div className="bg-white border border-purple-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Type className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-gray-900">Text &amp; Pricing AI</h3>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Required</span>
            </div>
            <p className="text-sm text-gray-500">
              Powers price suggestions, project descriptions, and email drafts.
              Compatible with <span className="font-medium text-gray-700">Groq</span> (fastest &amp; free), <span className="font-medium text-gray-700">OpenAI</span>, <span className="font-medium text-gray-700">Anthropic</span>, and <span className="font-medium text-gray-700">Google Gemini</span>.
            </p>

            <div className="space-y-3 pt-1">
              {/* Provider dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">AI Service</label>
                <select
                  value={textForm.provider}
                  onChange={(e) => {
                    const newProvider = e.target.value as any;
                    const defaultModel = textProviders.find(p => p.id === newProvider)?.models[0].id || '';
                    setTextForm({ ...textForm, provider: newProvider, model: defaultModel, api_key: '' });
                    if (newProvider === 'groq') {
                      setVisionForm(v => ({ ...v, enabled: true }));
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="">— Select a service —</option>
                  {textProviders.map(p => (
                    <option key={p.id} value={p.id}>{p.logo} {p.name}</option>
                  ))}
                </select>
                {textForm.provider === 'groq' && (
                  <p className="text-xs text-amber-700 mt-1 font-medium">⚡ Groq is text-only — enable Photo &amp; Video Analysis below for photo support.</p>
                )}
              </div>

              {/* API key — appears as soon as a provider is chosen */}
              {selectedTextProvider && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-gray-700">{selectedTextProvider.name} API Key</label>
                      <a
                        href={selectedTextProvider.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                      >
                        Get your key →
                      </a>
                    </div>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={textForm.api_key}
                      onChange={(e) => setTextForm({ ...textForm, api_key: e.target.value })}
                      placeholder={`Paste your ${selectedTextProvider.name} API key…`}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                    <select
                      value={textForm.model}
                      onChange={(e) => setTextForm({ ...textForm, model: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                    >
                      {selectedTextProvider.models.map((model) => (
                        <option key={model.id} value={model.id}>{model.name} — {model.cost}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── SECTION 2: PHOTO & VIDEO ANALYSIS (optional — shown second) ── */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Photo &amp; Video Analysis</h3>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Optional</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={visionForm.enabled}
                  onChange={(e) => setVisionForm({ ...visionForm, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <p className="text-sm text-gray-500">
              Analyzes damage photos to suggest line items, quantities, and damage types.
              Compatible with <span className="font-medium text-gray-700">Google Gemini</span>, <span className="font-medium text-gray-700">OpenAI</span>, and <span className="font-medium text-gray-700">Anthropic Claude</span>.
            </p>

            {visionForm.enabled && (
              <div className="space-y-3 pt-1">
                {/* Provider dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">AI Service</label>
                  <select
                    value={visionForm.provider}
                    onChange={(e) => {
                      const newProvider = e.target.value as any;
                      const defaultModel = visionProviders.find(p => p.id === newProvider)?.models[0].id || '';
                      setVisionForm({ ...visionForm, provider: newProvider, model: defaultModel, api_key: '' });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">— Select a service —</option>
                    {visionProviders.map(p => (
                      <option key={p.id} value={p.id}>{p.logo} {p.name}</option>
                    ))}
                  </select>
                </div>

                {/* API key — appears as soon as a provider is chosen */}
                {selectedVisionProvider && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-gray-700">{selectedVisionProvider.name} API Key</label>
                        <a
                          href={selectedVisionProvider.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                        >
                          Get your key →
                        </a>
                      </div>
                      <input
                        type="password"
                        value={visionForm.api_key}
                        onChange={(e) => setVisionForm({ ...visionForm, api_key: e.target.value })}
                        placeholder={`Paste your ${selectedVisionProvider.name} API key…`}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                      <select
                        value={visionForm.model}
                        onChange={(e) => setVisionForm({ ...visionForm, model: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {selectedVisionProvider.models.map((model) => (
                          <option key={model.id} value={model.id}>{model.name} — {model.cost}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            {config && (
              <button
                onClick={() => {
                  setEditing(false);
                  setTextForm({ provider: config.provider, api_key: config.api_key, model: config.model });
                  setVisionForm({
                    enabled: !!config.vision_provider,
                    provider: (config.vision_provider as any) || 'google',
                    api_key: config.vision_api_key || '',
                    model: config.vision_model || 'gemini-3.6-flash',
                  });
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Update Configuration
          </button>
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
          >
            Remove Configuration
          </button>
        </div>
      )}
      </>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-sm font-semibold text-gray-900">Team default API key</p>
          <p className="text-sm text-gray-600 mt-1">
            An owner or admin sets your team's key. Everyone without a personal key uses it. To keep your usage separate, add your own key above.
          </p>
        </div>
      )}
    </div>
  );
};

export default AIEstimatingPanel;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Building2, Save, Phone, Mail, Globe, MapPin, FileText, Shield, Upload, Check, DollarSign, Plus, Trash2, Edit2, Eye, X, ImageIcon, Search, Filter, Sparkles, ChevronDown, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { compressImage, COMPRESS_PRESETS, STORAGE_CACHE_CONTROL } from '@/lib/imageUtils';
import { toast } from 'sonner';
import { canHideBranding, normalizeTier } from '@/lib/planLimits';
import type { Company, CompanyPricing, TeamMember } from '@/data/quoteData';
import { isOwnerOrManager } from '@/lib/templateLibrary';
import { quoteProjectTemplates } from '@/data/quoteData';
import type { QuoteProjectTemplate } from '@/data/quoteData';
import AboutUsSettings from '@/components/AboutUsSettings';
import { suggestPricing, getAIConfig } from '@/lib/aiHelper';
import { DEFAULT_PRICE_LIST } from '@/data/defaultPricing';

interface CompanySetupProps {
  company: Company;
  user: TeamMember;
  onUpdate: (company: Company) => void;
}


const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const CompanySetup: React.FC<CompanySetupProps> = ({ company, onUpdate, user }) => {
  const [form, setForm] = useState<Company>({ ...company });
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'general' | 'about' | 'warranty' | 'pricing' | 'templates'>('general');

  // Auto-save refs
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedForm = useRef<string>(JSON.stringify({ ...company }));
  const isFirstRender = useRef(true);

  // Role checks
  const canManagePricing = isOwnerOrManager(user.role); // admin + manager can always edit
  const salesCanEdit = form.sales_can_edit_pricing === true; // company-level permission for salespeople
  const canEditPricing = canManagePricing || salesCanEdit; // combined check for price library actions
  const canEditCompanyInfo = canManagePricing; // only owner/admin/manager may edit core company fields

  // Owners/admins/managers can always edit company info — no unlock required for now.
  const infoUnlocked = canEditCompanyInfo;
  const protectedEditable = canEditCompanyInfo;

  // Members eligible to be the fallback signer. Only those who have adopted a
  // signature appear — offering someone without one would produce a setting
  // that silently does nothing.
  const [signerCandidates, setSignerCandidates] = useState<Array<{ id: string; full_name: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, full_name')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .not('signature_adopted_at', 'is', null)
        .order('full_name');
      if (!cancelled && data) setSignerCandidates(data as Array<{ id: string; full_name: string }>);
    })();
    return () => { cancelled = true; };
  }, [company.id]);

  // Price Library
  const [pricingItems, setPricingItems] = useState<CompanyPricing[]>([]);
  const [editingPricingId, setEditingPricingId] = useState<string | null>(null);
  const [newPricing, setNewPricing] = useState<Partial<CompanyPricing>>({
    category: '', item_name: '', description: '', unit: 'lot',
    good_price: 0, better_price: 0, best_price: 0, fixed_price: false,
  });
  const [newPricingFixed, setNewPricingFixed] = useState(false);
  const [newPricingFixedAmt, setNewPricingFixedAmt] = useState(0);

  // Search, filter, and AI for price library
  const [pricingSearch, setPricingSearch] = useState('');
  const [pricingCategoryFilter, setPricingCategoryFilter] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ low: number; mid: number; high: number; reasoning: string } | null>(null);
  const [seedingDefaults, setSeedingDefaults] = useState(false);

  // Branding preview modal
  const [showBrandingPreview, setShowBrandingPreview] = useState(false);

  // Template Prices tab
  const [selectedTemplateIdx, setSelectedTemplateIdx] = useState(0);
  // Local edits to template item prices before saving
  const [templateEdits, setTemplateEdits] = useState<Record<string, { good_price: number; better_price: number; best_price: number; fixed_price: boolean; fixedAmt: number }>>({});

  useEffect(() => {
    fetchPricingItems();
  }, [company.id]);

  // Re-fetch pricing whenever the user switches to the pricing tab so that
  // items imported via the "Import Prices" tab are immediately visible.
  useEffect(() => {
    if (activeTab === 'pricing') {
      fetchPricingItems();
      getAIConfig(company.id).then(cfg => setAiEnabled(!!cfg)).catch(() => setAiEnabled(false));
    }
  }, [activeTab]);

  const applyMailboxPreset = (provider: 'gmail' | 'outlook' | 'custom') => {
    if (provider === 'gmail') {
      setForm((current) => ({
        ...current,
        connected_mail_provider: 'gmail',
        email_send_mode: 'smtp',
        smtp_host: 'smtp.gmail.com',
        smtp_port: 465,
        smtp_secure: true,
      }));
      return;
    }

    if (provider === 'outlook') {
      setForm((current) => ({
        ...current,
        connected_mail_provider: 'outlook',
        email_send_mode: 'smtp',
        smtp_host: 'smtp.office365.com',
        smtp_port: 587,
        smtp_secure: false,
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      connected_mail_provider: 'custom',
      email_send_mode: 'smtp',
      smtp_host: current.smtp_host || '',
      smtp_port: current.smtp_port || 587,
      smtp_secure: current.smtp_secure ?? true,
    }));
  };

  const fetchPricingItems = async () => {
    const { data } = await supabase.from('company_pricing').select('*').eq('company_id', company.id).order('category').order('item_name');
    if (data) {
      setPricingItems(data as CompanyPricing[]);
      // Auto-seed the default price list for brand-new companies with no pricing yet
      if (data.length === 0) {
        await seedDefaultPricing(true);
      }
    }
  };

  const seedDefaultPricing = async (silent = false) => {
    if (seedingDefaults) return;
    setSeedingDefaults(true);
    try {
      // Skip items already in the price library (match by item_name)
      const existingNames = new Set(pricingItems.map(p => p.item_name));
      const toInsert = DEFAULT_PRICE_LIST.filter(item => !existingNames.has(item.item_name));

      if (toInsert.length === 0) {
        if (!silent) toast.info('All default items are already in your price library.');
        return;
      }

      const rows = toInsert.map(item => ({
        company_id: company.id,
        category: item.category,
        item_name: item.item_name,
        description: item.description,
        unit: item.unit,
        good_price: item.good_price,
        better_price: item.better_price,
        best_price: item.best_price,
        fixed_price: false,
        hidden_from_customer: item.hidden_from_customer ?? false,
        price_list_name: 'My Prices',
        list_enabled: true,
        sort_order: 0,
      }));

      // Insert in batches of 50 to stay within request limits
      const BATCH = 50;
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabase.from('company_pricing').insert(rows.slice(i, i + BATCH));
        if (error) throw error;
      }
      if (!silent) toast.success(`${toInsert.length} default prices added — customize as needed.`);
      await fetchPricingItems();
    } catch {
      if (!silent) toast.error('Failed to load default price list');
    } finally {
      setSeedingDefaults(false);
    }
  };

  const savePricingItem = async (item: Partial<CompanyPricing>, isFixed?: boolean, fixedAmt?: number) => {
    if (!item.category || !item.item_name) { toast.error('Category and item name are required'); return; }
    // If fixed-price mode, override all tier prices to the same value
    const resolvedFixed = isFixed ?? item.fixed_price ?? false;
    const price = resolvedFixed ? (fixedAmt ?? item.good_price ?? 0) : undefined;
    const goodPrice  = resolvedFixed ? price! : (item.good_price ?? 0);
    const betterPrice = resolvedFixed ? price! : (item.better_price ?? 0);
    const bestPrice  = resolvedFixed ? price! : (item.best_price ?? 0);
    if (item.id) {
      const { error } = await supabase.from('company_pricing').update({
        price_overridden: true,
        category: item.category, item_name: item.item_name,
        description: item.description || '', unit: item.unit || 'lot',
        good_price: goodPrice, better_price: betterPrice, best_price: bestPrice,
        fixed_price: resolvedFixed,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);
      if (error) { toast.error('Failed to update'); return; }
      toast.success('Price updated!');
    } else {
      const { error } = await supabase.from('company_pricing').insert({
        company_id: company.id, category: item.category, item_name: item.item_name,
        description: item.description || '', unit: item.unit || 'lot',
        good_price: goodPrice, better_price: betterPrice, best_price: bestPrice,
        fixed_price: resolvedFixed,
      });
      if (error) { toast.error('Failed to add item'); return; }
      toast.success('Price added!');
      setNewPricing({ category: '', item_name: '', description: '', unit: 'lot', good_price: 0, better_price: 0, best_price: 0, fixed_price: false });
      setNewPricingFixed(false);
      setNewPricingFixedAmt(0);
    }
    setEditingPricingId(null);
    fetchPricingItems();
  };

  const deletePricingItem = async (id: string) => {
    const { error } = await supabase.from('company_pricing').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Removed!');
    fetchPricingItems();
  };

  const handleSave = useCallback(async (formToSave = form, silent = false) => {
    // Block saves for non-privileged users and locked sessions on protected tabs
    if (!canEditCompanyInfo && (activeTab === 'general' || activeTab === 'about' || activeTab === 'warranty')) return;
    setSaving(true);
    if (silent) setAutosaveStatus('saving');
    try {
      const { error } = await supabase.from('companies').upsert({
        id: company.id,
        name: formToSave.name,
        email: formToSave.email,
        quote_sender_name: formToSave.quote_sender_name || null,
        quote_sender_email: formToSave.quote_sender_email || null,
        quote_reply_to_email: formToSave.quote_reply_to_email || null,
        email_send_mode: formToSave.email_send_mode || 'shared',
        connected_mail_provider: formToSave.connected_mail_provider || null,
        smtp_host: formToSave.smtp_host || null,
        smtp_port: formToSave.smtp_port ?? null,
        smtp_secure: formToSave.smtp_secure === true,
        smtp_username: formToSave.smtp_username || null,
        // Only overwrite smtp_password when the user explicitly typed something.
        // The parent company prop never includes it (security), so an empty/undefined
        // value here means "unchanged" — omit it from the upsert to avoid wiping it.
        ...(formToSave.smtp_password ? { smtp_password: formToSave.smtp_password } : {}),
        phone: formToSave.phone,
        address: formToSave.address,
        city: formToSave.city,
        state: formToSave.state,
        zip: formToSave.zip,
        logo_url: formToSave.logo_url,
        logo_zoom: formToSave.logo_zoom ?? 1,
        about_text: formToSave.about_text,
        warranty_text: formToSave.warranty_text,
        license_number: formToSave.license_number,
        website: formToSave.website,
        sales_can_edit_pricing: formToSave.sales_can_edit_pricing ?? false,
        default_deposit_percent: (formToSave as any).default_deposit_percent ?? null,
        payment_terms_text: (formToSave as any).payment_terms_text?.trim() || null,
        receipt_cc_emails: ((formToSave as any).receipt_cc_emails ?? []).filter(Boolean),
        receipt_footer_text: (formToSave as any).receipt_footer_text?.trim() || null,
        final_offer_enabled: formToSave.final_offer_enabled ?? false,
        final_offer_discount_pct: formToSave.final_offer_discount_pct ?? null,
        final_offer_days_threshold: formToSave.final_offer_days_threshold ?? 5,
        sales_can_send_final_offer: (formToSave as any).sales_can_send_final_offer ?? false,
        follow_up_message: (formToSave as any).follow_up_message?.trim() || null,
        signing_followup_enabled: (formToSave as any).signing_followup_enabled ?? false,
        auto_countersign_enabled: (formToSave as any).auto_countersign_enabled ?? false,
        default_signer_id: (formToSave as any).default_signer_id || null,
        signing_followup_deposit_pct: (formToSave as any).signing_followup_deposit_pct ?? 50,
        signing_followup_payment_methods: (formToSave as any).signing_followup_payment_methods ?? ['check', 'money_order', 'cashiers_check', 'credit_card', 'cash'],
        cost_recovery_clause_enabled: (formToSave as any).cost_recovery_clause_enabled ?? true,
        quote_primary_color: formToSave.quote_primary_color || '#1e3a5f',
        quote_secondary_color: formToSave.quote_secondary_color || '#0d1f3c',
        quote_accent_color: formToSave.quote_accent_color || '#ff6b35',
        quote_customer_layout: formToSave.quote_customer_layout || 'modern',
        enable_service_requests: formToSave.enable_service_requests ?? true,
        quote_watermark_url: formToSave.quote_watermark_url || null,
        quote_watermark_opacity: formToSave.quote_watermark_opacity ?? 0.08,
        quote_watermark_rotation: formToSave.quote_watermark_rotation ?? 'diagonal',
        quote_watermark_size: formToSave.quote_watermark_size ?? 0.55,
        hide_quotemgr_branding: formToSave.hide_quotemgr_branding ?? false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

      if (error) throw error;
      onUpdate({ ...formToSave });
      committedForm.current = JSON.stringify(formToSave);
      if (silent) {
        setAutosaveStatus('saved');
        setTimeout(() => setAutosaveStatus('idle'), 2500);
      } else {
        toast.success('Settings saved!');
      }
    } catch (err: any) {
      console.error('Company save error:', err);
      if (silent) {
        setAutosaveStatus('error');
        setTimeout(() => setAutosaveStatus('idle'), 3000);
      } else {
        toast.error(`Failed to save: ${err?.message || 'Unknown error'}`);
      }
    } finally {
      setSaving(false);
    }
  }, [company.id, onUpdate, canEditCompanyInfo, activeTab]);

  const [testingEmail, setTestingEmail] = useState<'sender' | 'delivery' | null>(null);

  /**
   * Sends a test email through one of the two mail paths.
   *
   * The edge function reads the saved company row rather than anything posted
   * from here — credentials should not make a round trip through the browser,
   * and a test is only meaningful against what a real quote send would use. So
   * pending edits are committed first; otherwise you would edit a field, test,
   * and be told about the previous value.
   */
  const handleSendTestEmail = async (mode: 'sender' | 'delivery') => {
    setTestingEmail(mode);
    try {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      if (JSON.stringify(form) !== committedForm.current) {
        await handleSave(form, true);
      }

      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: { company_id: company.id, mode },
      });

      // A non-2xx from the function surfaces as `error` with the useful part
      // (a rejected SMTP login, say) in data.error — report that, not "failed".
      const detail = (data as { error?: string } | null)?.error;
      if (error || detail || !(data as { ok?: boolean } | null)?.ok) {
        toast.error(detail || error?.message || 'Could not send the test email.', { duration: 10000 });
        return;
      }

      const res = data as { to: string; from: string; note?: string };
      toast.success(`Test email sent to ${res.to} from ${res.from}`, {
        description: res.note,
        duration: res.note ? 12000 : 6000,
      });
    } catch (err) {
      toast.error((err as Error)?.message || 'Could not send the test email.');
    } finally {
      setTestingEmail(null);
    }
  };

  // Auto-save: debounce 1.5s after any form change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const currentJson = JSON.stringify(form);
    if (currentJson === committedForm.current) return; // nothing changed

    setAutosaveStatus('idle');
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      handleSave(form, true);
    }, 1500);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [form, handleSave]);

  const handleLogoUpload = async (file: File) => {
    try {
      const compressed = await compressImage(file, COMPRESS_PRESETS.companyLogo);
      const fileName = `logo-${company.id}-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('quote-photos').upload(fileName, compressed, {
        contentType: 'image/jpeg',
        cacheControl: STORAGE_CACHE_CONTROL,
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('quote-photos').getPublicUrl(fileName);
      setForm({ ...form, logo_url: data.publicUrl });
      toast.success('Logo uploaded!');
    } catch (err: any) {
      console.error('Logo upload error:', err);
      toast.error('Failed to upload logo. Please try again.');
    }
  };

  const handleWatermarkUpload = async (file: File) => {
    try {
      const compressed = await compressImage(file, COMPRESS_PRESETS.companyLogo);
      const fileName = `watermark-${company.id}-${Date.now()}.png`;
      const { error } = await supabase.storage.from('quote-photos').upload(fileName, compressed, {
        contentType: 'image/jpeg',
        cacheControl: STORAGE_CACHE_CONTROL,
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('quote-photos').getPublicUrl(fileName);
      setForm({ ...form, quote_watermark_url: data.publicUrl });
      toast.success('Watermark uploaded!');
    } catch (err) {
      toast.error('Failed to upload watermark');
    }
  };

  const tabs = [
    { id: 'general' as const, label: 'General Info', icon: Building2 },
    { id: 'pricing' as const, label: 'Price Library', icon: DollarSign },
    { id: 'templates' as const, label: 'Template Prices', icon: FileText },
    { id: 'about' as const, label: 'About Page', icon: FileText },
    { id: 'warranty' as const, label: 'Warranty Page', icon: Shield },
  ];

  return (
    <>
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Company Setup</h1>
          <p className="text-gray-500 mt-1">Customize your company profile and document templates</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Autosave status pill */}
          {autosaveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              Saving…
            </span>
          )}
          {autosaveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <Check className="w-3.5 h-3.5" />
              Saved
            </span>
          )}
          {autosaveStatus === 'error' && (
            <span className="text-xs text-red-500 font-medium">Save failed</span>
          )}
          <button
            onClick={() => handleSave(form, false)}
            disabled={saving || (activeTab === 'general' && !canEditCompanyInfo)}
            className="flex items-center gap-2 bg-[#ff6b35] hover:bg-[#e55a2b] text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-orange-200 disabled:opacity-50"
          >
            {saving && autosaveStatus !== 'saving' ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
            Save
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-[#1e3a5f] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Company Logo</label>
              <div className="flex items-start gap-6">
                {/* Circular preview */}
                <div
                  className="relative w-24 h-24 rounded-full border-4 border-gray-200 overflow-hidden bg-gray-100 shrink-0 shadow-md"
                >
                  <img
                    src={form.logo_url || `${import.meta.env.BASE_URL}trussctr-logo.png`}
                    alt="Logo"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={form.logo_url ? {
                      transform: `scale(${form.logo_zoom ?? 1})`,
                      transformOrigin: 'center center',
                    } : { objectFit: 'contain', padding: '8px' }}
                  />
                </div>

                <div className="flex-1 space-y-3">
                  {!form.logo_url && (
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Upload your company logo — it appears on every quote you send.
                    </p>
                  )}
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors">
                    <Upload className="w-4 h-4" />
                    {form.logo_url ? 'Replace Logo' : 'Upload Logo'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
                  </label>

                  {form.logo_url && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Zoom: {Math.round((form.logo_zoom ?? 1) * 100)}%
                      </label>
                      <input
                        type="range"
                        min={0.5}
                        max={3}
                        step={0.05}
                        value={form.logo_zoom ?? 1}
                        onChange={(e) => setForm({ ...form, logo_zoom: parseFloat(e.target.value) })}
                        className="w-full accent-[#ff6b35]"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                        <span>Zoom out</span>
                        <span>Zoom in</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Adjust zoom to frame your logo perfectly in the circle.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quote Watermark */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quote Watermark</label>
              <p className="text-xs text-gray-500 mb-3">Upload your logo or any image to appear as a subtle watermark on every page of your quotes. PNG with transparency works best.</p>
              <div className="flex items-start gap-6">
                <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 overflow-hidden bg-gray-50 shrink-0 flex items-center justify-center">
                  {form.quote_watermark_url ? (
                    <img
                      src={form.quote_watermark_url}
                      alt="Watermark preview"
                      style={{
                        position: 'absolute',
                        top: '50%', left: '50%',
                        width: `${(form.quote_watermark_size ?? 0.55) * 100}%`,
                        height: `${(form.quote_watermark_size ?? 0.55) * 100}%`,
                        objectFit: 'contain',
                        opacity: form.quote_watermark_opacity ?? 0.08,
                        transform: `translate(-50%, -50%)${(form.quote_watermark_rotation ?? 'diagonal') === 'diagonal' ? ' rotate(-45deg)' : ''}`,
                        pointerEvents: 'none',
                      }}
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors">
                      <Upload className="w-4 h-4" />
                      Upload Image
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleWatermarkUpload(e.target.files[0])} />
                    </label>
                    {form.quote_watermark_url && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, quote_watermark_url: null })}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {form.quote_watermark_url && (
                    <>
                      {/* Rotation toggle */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, quote_watermark_rotation: 'diagonal' })}
                          className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${(form.quote_watermark_rotation ?? 'diagonal') === 'diagonal' ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                        >
                          ↗ Diagonal
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, quote_watermark_rotation: 'straight' })}
                          className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${form.quote_watermark_rotation === 'straight' ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                        >
                          → Straight
                        </button>
                      </div>
                      {/* Opacity slider */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Opacity: {Math.round((form.quote_watermark_opacity ?? 0.08) * 100)}%
                        </label>
                        <input
                          type="range"
                          min={0.03}
                          max={0.30}
                          step={0.01}
                          value={form.quote_watermark_opacity ?? 0.08}
                          onChange={(e) => setForm({ ...form, quote_watermark_opacity: parseFloat(e.target.value) })}
                          className="w-full accent-[#ff6b35]"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                          <span>Subtle</span>
                          <span>Visible</span>
                        </div>
                      </div>
                      {/* Size slider */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Size: {
                            (form.quote_watermark_size ?? 0.55) >= 1.30 ? 'Full page' :
                            (form.quote_watermark_size ?? 0.55) >= 0.90 ? `${Math.round((form.quote_watermark_size ?? 0.55) * 100)}% — Large` :
                            (form.quote_watermark_size ?? 0.55) >= 0.60 ? `${Math.round((form.quote_watermark_size ?? 0.55) * 100)}% — Medium` :
                            `${Math.round((form.quote_watermark_size ?? 0.55) * 100)}% — Small`
                          }
                        </label>
                        <input
                          type="range"
                          min={0.20}
                          max={1.40}
                          step={0.05}
                          value={form.quote_watermark_size ?? 0.55}
                          onChange={(e) => setForm({ ...form, quote_watermark_size: parseFloat(e.target.value) })}
                          className="w-full accent-[#ff6b35]"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                          <span>Small</span>
                          <span>Full page</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* White-label: hide the QuoteMGR attribution */}
            {(() => {
              const tier = normalizeTier((company as any).subscription_plan ?? (company as any).subscription_tier);
              const allowed = canHideBranding(tier);
              return (
                <div className={allowed ? '' : 'opacity-60'}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Document Footer</label>
                  <p className="text-xs text-gray-500 mb-3">
                    Quotes and documents carry a small &ldquo;Designed with QuoteMGR &amp; TrussCTR&rdquo; line in the footer.
                    {allowed
                      ? ' Your plan includes white-labelling, so you can remove it.'
                      : ' Removing it is part of white-labelling, included on the Business and Enterprise plans.'}
                  </p>
                  <label className={`inline-flex items-center gap-3 ${allowed ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                    <input
                      type="checkbox"
                      disabled={!allowed}
                      checked={!!form.hide_quotemgr_branding}
                      onChange={(e) => setForm({ ...form, hide_quotemgr_branding: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Hide &ldquo;Designed with QuoteMGR &amp; TrussCTR&rdquo; on customer documents</span>
                  </label>
                </div>
              );
            })()}

            {/* Manager-only: salesperson pricing permission */}
            {canManagePricing && (
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Allow salespeople to set personal price overrides</p>
                    <p className="text-xs text-gray-500 mt-0.5">When on, team members can adjust prices for their own quotes — changes only affect them, not the rest of the team. Owners and admins always control the company baseline.</p>
                  </div>
                  <div
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${form.sales_can_edit_pricing ? 'bg-[#ff6b35]' : 'bg-gray-300'}`}
                    onClick={() => setForm({ ...form, sales_can_edit_pricing: !form.sales_can_edit_pricing })}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${form.sales_can_edit_pricing ? 'left-5' : 'left-1'}`} />
                  </div>
                </div>
              </div>
            )}

            {/* Manager-only: Final Offer */}
            {canManagePricing && (
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Final Offer</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Lets your team send a one-time discounted offer to customers who have viewed
                      but not yet signed their quote — after a set number of days.
                    </p>
                  </div>
                  <div
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ml-4 ${form.final_offer_enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    onClick={() => setForm({ ...form, final_offer_enabled: !form.final_offer_enabled })}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${form.final_offer_enabled ? 'left-5' : 'left-1'}`} />
                  </div>
                </div>

                {form.final_offer_enabled && (
                  <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Discount Percentage</label>
                        <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden">
                          <input
                            type="number"
                            min={1}
                            max={50}
                            step={1}
                            value={form.final_offer_discount_pct ?? ''}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              setForm({ ...form, final_offer_discount_pct: isNaN(v) ? null : Math.min(50, Math.max(0, v)) });
                            }}
                            className="flex-1 px-3 py-2 text-sm outline-none bg-transparent"
                            placeholder="e.g. 10"
                          />
                          <span className="pr-3 text-sm text-gray-400">%</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Applied to all visible tier totals</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Days Before Available</label>
                        <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden">
                          <input
                            type="number"
                            min={1}
                            max={90}
                            step={1}
                            value={form.final_offer_days_threshold ?? ''}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              setForm({ ...form, final_offer_days_threshold: isNaN(v) ? null : Math.min(90, Math.max(1, v)) });
                            }}
                            className="flex-1 px-3 py-2 text-sm outline-none bg-transparent"
                            placeholder="5"
                          />
                          <span className="pr-3 text-sm text-gray-400">days</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">After quote is marked "Viewed"</p>
                      </div>
                    </div>

                    {/* Sales permission for final offer */}
                    <div className="flex items-start justify-between gap-4 pt-1 border-t border-gray-200">
                      <div>
                        <p className="text-xs font-semibold text-gray-700">Allow sales team to send Final Offers</p>
                        <p className="text-xs text-gray-400 mt-0.5">When off, only owners, admins, and managers can send Final Offers. Leave off to prevent accidental discounts.</p>
                      </div>
                      <div
                        className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ml-4 ${(form as any).sales_can_send_final_offer ? 'bg-emerald-500' : 'bg-gray-300'}`}
                        onClick={() => setForm({ ...form, sales_can_send_final_offer: !(form as any).sales_can_send_final_offer } as any)}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${(form as any).sales_can_send_final_offer ? 'left-5' : 'left-1'}`} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Needs-Attention Follow-Up Message */}
            {canManagePricing && (
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Follow-Up Message Template</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Default message used when sending a follow-up to customers who haven't responded. Use <code className="bg-gray-100 px-1 rounded text-[11px]">{'{first_name}'}</code> to insert the customer's first name.
                  </p>
                </div>
                <textarea
                  rows={4}
                  value={(form as any).follow_up_message ?? ''}
                  onChange={e => setForm({ ...form, follow_up_message: e.target.value } as any)}
                  placeholder="Hi {first_name}, just checking in — I wanted to see where things stand on your project…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-none"
                />
              </div>
            )}

            {/* Automatic countersigning */}
            {canManagePricing && (
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Countersign Automatically</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      When a customer signs a document you emailed them, immediately
                      countersign on the contractor's behalf using the signature the rep saved
                      in their profile — no waiting for someone to open the quote. Only
                      signatures a rep has drawn and adopted themselves are ever used.
                      Signing on site is unaffected: the rep is there, so they sign in person.
                    </p>
                  </div>
                  <div
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ml-4 ${(form as any).auto_countersign_enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    onClick={() => setForm({ ...form, auto_countersign_enabled: !(form as any).auto_countersign_enabled } as any)}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${(form as any).auto_countersign_enabled ? 'left-5' : 'left-1'}`} />
                  </div>
                </div>

                {(form as any).auto_countersign_enabled && (
                  <div className="pt-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Fallback Signer</label>
                    <select
                      value={(form as any).default_signer_id ?? ''}
                      onChange={e => setForm({ ...form, default_signer_id: e.target.value || null } as any)}
                      className="w-full max-w-sm px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                    >
                      <option value="">None — leave uncountersigned</option>
                      {signerCandidates.map(m => (
                        <option key={m.id} value={m.id}>{m.full_name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      Used when the rep who created the quote has no signature saved. Only
                      members who have adopted a signature are listed.
                    </p>
                    {signerCandidates.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        Nobody has saved a signature yet — add one under Profile → Signing Signature,
                        or quotes will simply stay awaiting countersignature as they do now.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Post-Signing Deposit Follow-Up */}
            {canManagePricing && (
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Post-Signing Deposit Instructions</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      When enabled, the signed-copy email sent to customers includes a deposit amount and accepted payment methods to get the project started.
                    </p>
                  </div>
                  <div
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ml-4 ${(form as any).signing_followup_enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    onClick={() => setForm({ ...form, signing_followup_enabled: !(form as any).signing_followup_enabled } as any)}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${(form as any).signing_followup_enabled ? 'left-5' : 'left-1'}`} />
                  </div>
                </div>

                {(form as any).signing_followup_enabled && (
                  <div className="space-y-4 pt-1">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Deposit Percentage</label>
                      <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden w-32">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          step={1}
                          value={(form as any).signing_followup_deposit_pct ?? 50}
                          onChange={e => {
                            const v = parseFloat(e.target.value);
                            setForm({ ...form, signing_followup_deposit_pct: isNaN(v) ? 50 : Math.min(100, Math.max(1, v)) } as any);
                          }}
                          className="flex-1 px-3 py-2 text-sm outline-none bg-transparent"
                          placeholder="50"
                        />
                        <span className="pr-3 text-sm text-gray-400">%</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Required deposit before work begins</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">Accepted Payment Methods</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'check', label: 'Check' },
                          { value: 'money_order', label: 'Money Order' },
                          { value: 'cashiers_check', label: "Cashier's Check" },
                          { value: 'credit_card', label: 'Credit Card' },
                          { value: 'cash', label: 'Cash' },
                          { value: 'zelle', label: 'Zelle' },
                          { value: 'venmo', label: 'Venmo' },
                          { value: 'other', label: 'Other' },
                        ].map(opt => {
                          const methods: string[] = (form as any).signing_followup_payment_methods ?? ['check', 'money_order', 'cashiers_check', 'credit_card', 'cash'];
                          const checked = methods.includes(opt.value);
                          return (
                            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = checked
                                    ? methods.filter(m => m !== opt.value)
                                    : [...methods, opt.value];
                                  setForm({ ...form, signing_followup_payment_methods: next } as any);
                                }}
                                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-sm text-gray-700">{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Post-Approval Cost-Recovery Clause */}
            {canManagePricing && (
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Post-Approval Cost-Recovery Clause</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      When enabled, the 3-Day Right to Cancel section includes an explanation of an administrative fee that applies specifically when insurance has approved repairs but work has not yet started and the contractor has incurred unrecoverable costs. Only managers and above can change this setting.
                    </p>
                  </div>
                  <div
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ml-4 ${(form as any).cost_recovery_clause_enabled !== false ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    onClick={() => setForm({ ...form, cost_recovery_clause_enabled: (form as any).cost_recovery_clause_enabled === false ? true : false } as any)}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${(form as any).cost_recovery_clause_enabled !== false ? 'left-5' : 'left-1'}`} />
                  </div>
                </div>
              </div>
            )}

            {/* Receipt Settings */}
            {canManagePricing && (
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Receipt Settings</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Configure defaults for payment receipts sent to homeowners.
                  </p>
                </div>

                {/* Default deposit % */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Default deposit % <span className="font-normal text-gray-400">(pre-fills receipt amount field)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden w-32">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        step={1}
                        placeholder="e.g. 50"
                        value={(form as any).default_deposit_percent ?? ''}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          setForm({ ...form, default_deposit_percent: isNaN(v) ? null : Math.min(100, Math.max(0, v))} as any);
                        }}
                        className="flex-1 px-3 py-2 text-sm outline-none"
                      />
                      <span className="px-2 text-gray-500 text-sm">%</span>
                    </div>
                    <p className="text-xs text-gray-400">Leave blank to pre-fill with full quote total</p>
                  </div>
                </div>

                {/* Quote payment terms */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Quote payment terms <span className="font-normal text-gray-400">(shown on the acceptance page and in the quote PDF)</span>
                  </label>
                  <textarea
                    rows={4}
                    placeholder={`e.g. A deposit of 50% is due prior to work beginning. The remaining balance is due upon satisfactory completion of all work described in this proposal.\n\nOr: Down payment terms to be discussed on a per-contract basis.`}
                    value={(form as any).payment_terms_text ?? ''}
                    onChange={e => setForm({ ...form, payment_terms_text: e.target.value || null } as any)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Leave blank to auto-generate: <span className="italic">"A deposit of [deposit %]% is due prior to commencement…"</span>
                  </p>
                </div>

                {/* Default CC emails */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Default CC recipients <span className="font-normal text-gray-400">(auto-copied on every receipt)</span>
                  </label>
                  <div className="space-y-2">
                    {((form as any).receipt_cc_emails ?? []).map((email: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="email"
                          value={email}
                          onChange={e => {
                            const updated = [...((form as any).receipt_cc_emails ?? [])];
                            updated[idx] = e.target.value;
                            setForm({ ...form, receipt_cc_emails: updated } as any);
                          }}
                          placeholder="email@example.com"
                          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                        />
                        <button
                          onClick={() => {
                            const updated = ((form as any).receipt_cc_emails ?? []).filter((_: string, i: number) => i !== idx);
                            setForm({ ...form, receipt_cc_emails: updated } as any);
                          }}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const current = (form as any).receipt_cc_emails ?? [];
                        setForm({ ...form, receipt_cc_emails: [...current, ''] } as any);
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#ff6b35] hover:text-[#e55a2b]"
                    >
                      + Add email address
                    </button>
                  </div>
                </div>

                {/* Receipt footer message */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Receipt footer message <span className="font-normal text-gray-400">(shown on every receipt, below the payment note)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. A deposit of 50% is due prior to work beginning. The remaining balance is due upon satisfactory completion. All payments made payable to [Company Name]."
                    value={(form as any).receipt_footer_text ?? ''}
                    onChange={e => setForm({ ...form, receipt_footer_text: e.target.value || null } as any)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">Leave blank to omit. Line breaks are preserved.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Primary Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#1e3a5f] bg-white">
                  <label className="relative flex items-center justify-center w-11 h-11 cursor-pointer border-r border-gray-200 flex-shrink-0 bg-gray-50 hover:bg-gray-100 transition-colors" title="Pick color">
                    <div className="w-5 h-5 rounded-md shadow-sm ring-1 ring-black/10" style={{ backgroundColor: form.quote_primary_color || '#1e3a5f' }} />
                    <input
                      type="color"
                      value={form.quote_primary_color || '#1e3a5f'}
                      onChange={(e) => setForm({ ...form, quote_primary_color: e.target.value })}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </label>
                  <input
                    type="text"
                    value={form.quote_primary_color || '#1e3a5f'}
                    onChange={(e) => setForm({ ...form, quote_primary_color: e.target.value })}
                    className="flex-1 px-3 py-2.5 outline-none text-sm bg-transparent font-mono"
                    placeholder="#1e3a5f"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Headers, text, badges</p>
              </div>
              {/* Secondary Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#1e3a5f] bg-white">
                  <label className="relative flex items-center justify-center w-11 h-11 cursor-pointer border-r border-gray-200 flex-shrink-0 bg-gray-50 hover:bg-gray-100 transition-colors" title="Pick color">
                    <div className="w-5 h-5 rounded-md shadow-sm ring-1 ring-black/10" style={{ backgroundColor: form.quote_secondary_color || '#0d1f3c' }} />
                    <input
                      type="color"
                      value={form.quote_secondary_color || '#0d1f3c'}
                      onChange={(e) => setForm({ ...form, quote_secondary_color: e.target.value })}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </label>
                  <input
                    type="text"
                    value={form.quote_secondary_color || '#0d1f3c'}
                    onChange={(e) => setForm({ ...form, quote_secondary_color: e.target.value })}
                    className="flex-1 px-3 py-2.5 outline-none text-sm bg-transparent font-mono"
                    placeholder="#0d1f3c"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Gradient end stops, dark panels</p>
              </div>
              {/* Accent Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Accent Color</label>
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#1e3a5f] bg-white">
                  <label className="relative flex items-center justify-center w-11 h-11 cursor-pointer border-r border-gray-200 flex-shrink-0 bg-gray-50 hover:bg-gray-100 transition-colors" title="Pick color">
                    <div className="w-5 h-5 rounded-md shadow-sm ring-1 ring-black/10" style={{ backgroundColor: form.quote_accent_color || '#ff6b35' }} />
                    <input
                      type="color"
                      value={form.quote_accent_color || '#ff6b35'}
                      onChange={(e) => setForm({ ...form, quote_accent_color: e.target.value })}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </label>
                  <input
                    type="text"
                    value={form.quote_accent_color || '#ff6b35'}
                    onChange={(e) => setForm({ ...form, quote_accent_color: e.target.value })}
                    className="flex-1 px-3 py-2.5 outline-none text-sm bg-transparent font-mono"
                    placeholder="#ff6b35"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Highlights, borders, stats bar</p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">Quote Branding Preview</p>
              <div className="rounded-xl overflow-hidden border border-gray-200">
                <div
                  className="h-14"
                  style={{
                    background: `linear-gradient(135deg, ${form.quote_secondary_color || '#0d1f3c'} 0%, ${form.quote_primary_color || '#1e3a5f'} 55%, ${form.quote_primary_color || '#1e3a5f'}cc 100%)`,
                    borderTop: `4px solid ${form.quote_accent_color || '#ff6b35'}`,
                  }}
                />
                <div className="flex items-center gap-3 p-4">
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: form.quote_primary_color || '#1e3a5f' }} title="Primary" />
                    <div className="w-7 h-7 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: form.quote_secondary_color || '#0d1f3c' }} title="Secondary" />
                    <div className="w-7 h-7 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: form.quote_accent_color || '#ff6b35' }} title="Accent" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{form.name || 'Your Company'}</p>
                    <p className="text-xs text-gray-500">Primary · Secondary · Accent</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Quote Layout */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-800 mb-1">Customer Quote Layout</p>
              <p className="text-xs text-gray-500 mb-3">Choose how customers see their quote when they open the link you send them.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, quote_customer_layout: 'modern' })}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${(form.quote_customer_layout || 'modern') === 'modern' ? 'border-[#1e3a5f] bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-900">✦ Modern PDF Layout</span>
                    {(form.quote_customer_layout || 'modern') === 'modern' && (
                      <span className="text-xs font-bold text-white bg-[#1e3a5f] px-2 py-0.5 rounded-full">Active</span>
                    )}
                  </div>
                  <div className="rounded-lg overflow-hidden border border-gray-100 mb-2">
                    <div className="h-3" style={{ background: `linear-gradient(135deg, ${form.quote_secondary_color || '#0d1f3c'}, ${form.quote_primary_color || '#1e3a5f'})` }} />
                    <div className="bg-gray-50 px-2 py-1.5 flex gap-1">
                      <div className="h-1.5 w-8 rounded bg-gray-300" />
                      <div className="h-1.5 w-12 rounded bg-gray-200" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">Full-page proposal with gradients, tier cards, and photo sections — matches the PDF exactly.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setForm({ ...form, quote_customer_layout: 'classic' })}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${form.quote_customer_layout === 'classic' ? 'border-[#ff6b35] bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-900">Classic Layout</span>
                    {form.quote_customer_layout === 'classic' && (
                      <span className="text-xs font-bold text-white bg-[#ff6b35] px-2 py-0.5 rounded-full">Active</span>
                    )}
                  </div>
                  <div className="rounded-lg overflow-hidden border border-gray-100 mb-2">
                    <div className="h-3 bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8e]" />
                    <div className="bg-white px-2 py-1.5 flex gap-1">
                      <div className="h-1.5 w-6 rounded bg-gray-200" />
                      <div className="h-1.5 w-10 rounded bg-gray-200" />
                      <div className="h-1.5 w-8 rounded bg-gray-200" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">Page-by-page tabbed view with Cover, Options, Photos, and Signature — the original layout.</p>
                </button>
              </div>

              {/* Preview button */}
              <button
                type="button"
                onClick={() => setShowBrandingPreview(true)}
                className="mt-1 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-sm font-semibold text-gray-600 hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition-colors"
              >
                <Eye size={15} />
                Preview Quote Layout
              </button>

              {/* Service Requests toggle */}
              <div className="mt-4 flex items-start justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Allow Customer Service Requests</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Shows a "Need something not listed?" input in the add-ons step so customers can request additional services before signing. Turn off if you'd rather skip this step entirely.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, enable_service_requests: !(form.enable_service_requests ?? true) })}
                  className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none ${(form.enable_service_requests ?? true) ? 'bg-[#1e3a5f]' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${(form.enable_service_requests ?? true) ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* ── Protected fields lock banner ─────────────────────────────────── */}
            {!canEditCompanyInfo && (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-sm text-amber-700">Company details can only be edited by owners, admins, and managers. Contact your manager to make changes.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={!protectedEditable}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                <input type="text" value={form.license_number || ''} onChange={(e) => setForm({ ...form, license_number: e.target.value })}
                  disabled={!protectedEditable}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={!protectedEditable}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
                  disabled={!protectedEditable}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input type="url" value={form.website || ''} onChange={(e) => setForm({ ...form, website: e.target.value })}
                  disabled={!protectedEditable}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="https://" />
              </div>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Quote Email Sender</p>
                <p className="text-xs text-gray-600 mt-1">
                  QuoteMGR will send quote emails using this sender name and email when the domain is allowed in Resend. If not, it falls back to the shared sender and uses your reply-to address.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sender Name</label>
                  <input
                    type="text"
                    value={form.quote_sender_name || ''}
                    onChange={(e) => setForm({ ...form, quote_sender_name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
                    placeholder={form.name || 'Your Company'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sender Email</label>
                  <input
                    type="email"
                    value={form.quote_sender_email || ''}
                    onChange={(e) => setForm({ ...form, quote_sender_email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
                    placeholder="quotes@yourdomain.com"
                  />
                  {form.email_send_mode === 'smtp' && form.smtp_username && form.quote_sender_email &&
                    form.quote_sender_email.trim().toLowerCase() !== form.smtp_username.trim().toLowerCase() && (
                    <p className="text-xs text-amber-600 mt-1.5 flex items-start gap-1">
                      <span>⚠️</span>
                      <span>This must match your Mailbox Username below. Outlook / Microsoft 365 will reject the email if they differ.</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reply-To Email</label>
                  <input
                    type="email"
                    value={form.quote_reply_to_email || ''}
                    onChange={(e) => setForm({ ...form, quote_reply_to_email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
                    placeholder={form.email || 'sales@yourdomain.com'}
                  />
                </div>
              </div>

              {/* Tests the shared sender, and reports whether your own From
                  address survived or fell back — a fallback send otherwise
                  looks identical to a successful one. */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => handleSendTestEmail('sender')}
                  disabled={testingEmail !== null}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-[#1e3a5f] text-[#1e3a5f] bg-white hover:bg-[#1e3a5f] hover:text-white transition-colors disabled:opacity-60 disabled:cursor-wait"
                >
                  {testingEmail === 'sender'
                    ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Sending…</>
                    : <><Mail className="w-4 h-4" /> Send test email</>}
                </button>
                <span className="text-xs text-gray-600">
                  Checks the sender name, address and reply-to. Sent to you{user?.email ? ` at ${user.email}` : ''}.
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Email Delivery</p>
                <p className="text-xs text-gray-600 mt-1">
                  Choose whether QuoteMGR should send quotes through the shared QuoteMGR sender or through your own connected mailbox.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, email_send_mode: 'shared' })}
                  className={`rounded-xl border px-4 py-3 text-left transition-colors ${form.email_send_mode !== 'smtp' ? 'border-[#1e3a5f] bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                >
                  <p className="text-sm font-semibold text-gray-900">QuoteMGR Mail</p>
                  <p className="text-xs text-gray-600 mt-1">Reliable default. Sends from the QuoteMGR sender and uses your reply-to email.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, email_send_mode: 'smtp', connected_mail_provider: form.connected_mail_provider || 'gmail' })}
                  className={`rounded-xl border px-4 py-3 text-left transition-colors ${form.email_send_mode === 'smtp' ? 'border-[#1e3a5f] bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                >
                  <p className="text-sm font-semibold text-gray-900">Connected Mailbox</p>
                  <p className="text-xs text-gray-600 mt-1">Use your own Gmail, Outlook, or custom SMTP mailbox to send the email directly.</p>
                </button>
              </div>

              {form.email_send_mode === 'smtp' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => applyMailboxPreset('gmail')}
                      className={`rounded-xl border px-4 py-3 text-left transition-colors ${form.connected_mail_provider === 'gmail' ? 'border-[#1e3a5f] bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <p className="text-sm font-semibold text-gray-900">Gmail</p>
                      <p className="text-xs text-gray-600 mt-1">Uses a Gmail app password.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyMailboxPreset('outlook')}
                      className={`rounded-xl border px-4 py-3 text-left transition-colors ${form.connected_mail_provider === 'outlook' ? 'border-[#1e3a5f] bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <p className="text-sm font-semibold text-gray-900">Outlook / Microsoft 365</p>
                      <p className="text-xs text-gray-600 mt-1">Uses SMTP credentials for your mailbox.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyMailboxPreset('custom')}
                      className={`rounded-xl border px-4 py-3 text-left transition-colors ${form.connected_mail_provider === 'custom' ? 'border-[#1e3a5f] bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <p className="text-sm font-semibold text-gray-900">Custom SMTP</p>
                      <p className="text-xs text-gray-600 mt-1">Use your own mail server details.</p>
                    </button>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-900">Setup Walkthrough</p>
                    {form.connected_mail_provider === 'gmail' && (
                      <div className="space-y-2 text-xs text-gray-600">
                        <p>1. Turn on 2-Step Verification in your Google account.</p>
                        <p>2. Create an App Password in Google Account Security.</p>
                        <p>3. Use your full Gmail address as the username and the 16-character app password below.</p>
                        <a className="text-[#1e3a5f] underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">Open Gmail App Passwords</a>
                      </div>
                    )}
                    {form.connected_mail_provider === 'outlook' && (
                      <div className="space-y-2 text-xs text-gray-600">
                        <p>1. Make sure SMTP AUTH is enabled for your mailbox in Microsoft 365 Admin.</p>
                        <p>2. Use your full Microsoft 365 email address as the Mailbox Username.</p>
                        <p>3. Use your mailbox password (or an app password if your tenant requires it).</p>
                        <p>4. <strong className="text-gray-800">Do not use secure SMTP</strong> — leave that checkbox unchecked. Office 365 uses port 587 with STARTTLS, not SSL.</p>
                        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 mt-1">
                          <p className="font-semibold text-amber-800">⚠️ Important: Sender Email must match Mailbox Username</p>
                          <p className="text-amber-700 mt-0.5">Microsoft 365 will block the email with a "SendAsDenied" error if the Sender Email (above) is different from the Mailbox Username. Both fields must be the exact same address unless you have "Send As" permission configured in M365 Admin.</p>
                        </div>
                        <a className="text-[#1e3a5f] underline" href="https://support.microsoft.com/en-us/account-billing/how-to-get-and-use-app-passwords-5896ed9b-4263-e681-128a-a6f2979a7944" target="_blank" rel="noreferrer">Open Microsoft App Password Help</a>
                      </div>
                    )}
                    {form.connected_mail_provider === 'custom' && (
                      <div className="space-y-2 text-xs text-gray-600">
                        <p>1. Enter the SMTP host, port, security mode, username, and password for your mail provider.</p>
                        <p>2. Use the mailbox that should appear as the sender when quotes are emailed.</p>
                        <p>3. Keep the reply-to email set if replies should go somewhere else.</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                      <input
                        type="text"
                        value={form.smtp_host || ''}
                        onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
                        placeholder="smtp.gmail.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
                      <input
                        type="number"
                        value={form.smtp_port ?? ''}
                        onChange={(e) => setForm({ ...form, smtp_port: e.target.value ? Number(e.target.value) : null })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
                        placeholder="465"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mailbox Username</label>
                      <input
                        type="text"
                        value={form.smtp_username || ''}
                        onChange={(e) => setForm({ ...form, smtp_username: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
                        placeholder="you@example.com"
                      />
                      {form.connected_mail_provider === 'outlook' && (
                        <p className="text-xs text-gray-500 mt-1.5">Must match the Sender Email in the section above. Outlook blocks sending as a different address.</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mailbox Password / App Password</label>
                      <input
                        type="password"
                        value={form.smtp_password || ''}
                        onChange={(e) => setForm({ ...form, smtp_password: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
                        placeholder={form.smtp_username ? '(password saved — type to change)' : '••••••••••••••••'}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-3 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.smtp_secure === true}
                      onChange={(e) => setForm({ ...form, smtp_secure: e.target.checked })}
                    />
                    Use secure SMTP connection
                  </label>
                </div>
              )}

              {/* With a connected mailbox this performs a real SMTP handshake,
                  so a wrong app password or blocked port is found here rather
                  than on a customer send. */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => handleSendTestEmail('delivery')}
                  disabled={testingEmail !== null}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-emerald-600 text-emerald-700 bg-white hover:bg-emerald-600 hover:text-white transition-colors disabled:opacity-60 disabled:cursor-wait"
                >
                  {testingEmail === 'delivery'
                    ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Sending…</>
                    : <><Mail className="w-4 h-4" /> Send test email</>}
                </button>
                <span className="text-xs text-gray-600">
                  {form.email_send_mode === 'smtp'
                    ? 'Signs in to your mailbox and sends through it, so a bad password shows up here.'
                    : 'Sends through the shared QuoteMGR sender.'}
                  {user?.email ? ` Sent to you at ${user.email}.` : ''}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
              <input type="text" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })}
                disabled={!protectedEditable}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input type="text" value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })}
                  disabled={!protectedEditable}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input type="text" value={form.state || ''} onChange={(e) => setForm({ ...form, state: e.target.value })}
                  disabled={!protectedEditable}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                <input type="text" value={form.zip || ''} onChange={(e) => setForm({ ...form, zip: e.target.value })}
                  disabled={!protectedEditable}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed" />
              </div>
            </div>
          </div>
        )}

        {/* Price Library Tab */}
        {activeTab === 'pricing' && (() => {
          // Derived category list for filter dropdown
          const allCategories = Array.from(new Set(pricingItems.map(i => i.category).filter(Boolean))).sort();

          // Filtered items based on search + category
          const searchLower = pricingSearch.toLowerCase();
          const filteredItems = pricingItems.filter(item => {
            const matchesCategory = !pricingCategoryFilter || item.category === pricingCategoryFilter;
            const matchesSearch = !pricingSearch || (
              item.item_name.toLowerCase().includes(searchLower) ||
              item.category.toLowerCase().includes(searchLower) ||
              (item.description || '').toLowerCase().includes(searchLower)
            );
            return matchesCategory && matchesSearch;
          });

          const handleAISuggest = async () => {
            if (!newPricing.item_name) { toast.error('Enter an item name first'); return; }
            setAiSuggesting(true);
            setAiSuggestion(null);
            try {
              const result = await suggestPricing(company.id, newPricing.item_name, 1, newPricing.unit || 'lot');
              setAiSuggestion({ low: result.low, mid: result.mid, high: result.high, reasoning: result.reasoning });
            } catch (err: any) {
              toast.error(err?.message || 'AI suggestion failed');
            } finally {
              setAiSuggesting(false);
            }
          };

          const applyAISuggestion = () => {
            if (!aiSuggestion) return;
            if (newPricingFixed) {
              setNewPricingFixedAmt(aiSuggestion.mid);
            } else {
              setNewPricing(p => ({ ...p, good_price: aiSuggestion.low, better_price: aiSuggestion.mid, best_price: aiSuggestion.high }));
            }
            setAiSuggestion(null);
            toast.success('AI prices applied — review and adjust as needed');
          };

          return (
            <div className="space-y-6">
              <div>
                <div className="flex items-start justify-between gap-4 mb-1">
                  <h3 className="text-lg font-semibold text-gray-900">Company Price Library</h3>
                  {canEditPricing && pricingItems.length > 0 && (
                    <button
                      onClick={() => {
                        if (window.confirm(`This will add all ${DEFAULT_PRICE_LIST.length} default items that aren't already in your price library. Existing items won't be changed. Continue?`)) {
                          seedDefaultPricing(false);
                        }
                      }}
                      disabled={seedingDefaults}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {seedingDefaults ? 'Loading…' : 'Load Default Price List'}
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-1">Save your standard pricing here. When you build a quote, these prices will automatically replace template defaults.</p>
                <p className="text-xs text-blue-600 mb-4">Includes all items imported via the Import Prices tab.</p>
                {!canEditPricing && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
                    <Shield className="w-4 h-4 text-amber-500 shrink-0" />
                    <p className="text-sm text-amber-700">Pricing is locked to view-only for your role. Contact your manager to enable editing.</p>
                  </div>
                )}
              </div>

              {/* Add new item form — only for users with edit permission */}
              {canEditPricing && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-700">Add New Item</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Category</label>
                      <input type="text" value={newPricing.category || ''} placeholder="e.g. Roofing"
                        list="existing-categories"
                        onChange={e => setNewPricing({ ...newPricing, category: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent outline-none" />
                      <datalist id="existing-categories">
                        {allCategories.map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Item Name</label>
                      <input type="text" value={newPricing.item_name || ''} placeholder="e.g. OSB Re-Decking"
                        onChange={e => { setNewPricing({ ...newPricing, item_name: e.target.value }); setAiSuggestion(null); }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Unit</label>
                      <input type="text" value={newPricing.unit || 'lot'}
                        onChange={e => setNewPricing({ ...newPricing, unit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Description</label>
                      <input type="text" value={newPricing.description || ''} placeholder="Optional"
                        onChange={e => setNewPricing({ ...newPricing, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent outline-none" />
                    </div>
                  </div>

                  {/* AI Suggestion — shown only when AI is connected */}
                  {aiEnabled && (
                    <div className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700">
                          <Sparkles className="w-3.5 h-3.5" />
                          AI Price Suggestion
                        </div>
                        <button
                          type="button"
                          onClick={handleAISuggest}
                          disabled={aiSuggesting || !newPricing.item_name}
                          className="flex items-center gap-1.5 px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          {aiSuggesting ? (
                            <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Thinking…</>
                          ) : (
                            <><Sparkles className="w-3 h-3" /> Suggest Prices</>
                          )}
                        </button>
                      </div>
                      {aiSuggestion && (
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="bg-white rounded-lg px-2 py-1.5 border border-purple-100">
                              <p className="text-gray-400 mb-0.5">Good (Low)</p>
                              <p className="font-bold text-emerald-600">${aiSuggestion.low.toFixed(2)}</p>
                            </div>
                            <div className="bg-white rounded-lg px-2 py-1.5 border border-purple-100">
                              <p className="text-gray-400 mb-0.5">Better (Mid)</p>
                              <p className="font-bold text-blue-600">${aiSuggestion.mid.toFixed(2)}</p>
                            </div>
                            <div className="bg-white rounded-lg px-2 py-1.5 border border-purple-100">
                              <p className="text-gray-400 mb-0.5">Best (High)</p>
                              <p className="font-bold text-amber-600">${aiSuggestion.high.toFixed(2)}</p>
                            </div>
                          </div>
                          <p className="text-xs text-purple-600 italic">{aiSuggestion.reasoning}</p>
                          <button
                            type="button"
                            onClick={applyAISuggestion}
                            className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            Apply These Prices
                          </button>
                        </div>
                      )}
                      {!aiSuggestion && !aiSuggesting && (
                        <p className="text-xs text-purple-500">Enter an item name above then click Suggest Prices to get AI-estimated Good / Better / Best pricing.</p>
                      )}
                    </div>
                  )}

                  {/* Fixed price toggle */}
                  <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2.5">
                    <div
                      className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${newPricingFixed ? 'bg-[#1e3a5f]' : 'bg-gray-300'}`}
                      onClick={() => setNewPricingFixed(v => !v)}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${newPricingFixed ? 'left-4' : 'left-0.5'}`} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-700">Fixed Price <span className="text-gray-400 font-normal">(same across Good, Better & Best)</span></p>
                      <p className="text-xs text-gray-400">Use for items like tear-off, permits, OSB, etc.</p>
                    </div>
                  </div>

                  {/* Price inputs */}
                  {newPricingFixed ? (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">🔒 Fixed Price (all tiers)</label>
                      <input type="number" min={0} step={0.01} value={newPricingFixedAmt}
                        onChange={e => setNewPricingFixedAmt(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-[#1e3a5f] rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none bg-blue-50" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {[{ label: 'Good Price', key: 'good_price' }, { label: 'Better Price', key: 'better_price' }, { label: 'Best Price', key: 'best_price' }].map(f => (
                        <div key={f.key}>
                          <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                          <input type="number" min={0} step={0.01}
                            value={(newPricing as any)[f.key] ?? 0}
                            onChange={e => setNewPricing({ ...newPricing, [f.key]: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent outline-none" />
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => savePricingItem(newPricing, newPricingFixed, newPricingFixedAmt)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#ff6b35] text-white text-sm font-semibold rounded-xl hover:bg-[#e55a2b] transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add to Library
                  </button>
                </div>
              )}

              {/* Search + Filter bar */}
              {pricingItems.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search items, categories, descriptions…"
                      value={pricingSearch}
                      onChange={e => setPricingSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
                    />
                    {pricingSearch && (
                      <button onClick={() => setPricingSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <select
                      value={pricingCategoryFilter}
                      onChange={e => setPricingCategoryFilter(e.target.value)}
                      className="appearance-none pl-9 pr-7 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none bg-white min-w-[160px]"
                    >
                      <option value="">All Categories</option>
                      {allCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Results summary */}
              {(pricingSearch || pricingCategoryFilter) && (
                <p className="text-xs text-gray-500 -mt-2">
                  Showing {filteredItems.length} of {pricingItems.length} items
                  {pricingCategoryFilter && <span> in <strong>{pricingCategoryFilter}</strong></span>}
                  {pricingSearch && <span> matching "<strong>{pricingSearch}</strong>"</span>}
                  <button onClick={() => { setPricingSearch(''); setPricingCategoryFilter(''); }} className="ml-2 text-[#ff6b35] hover:underline">Clear</button>
                </p>
              )}

              {/* Existing items */}
              {pricingItems.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <p className="text-sm text-gray-400">No prices saved yet.</p>
                  {canEditPricing && (
                    <button
                      onClick={() => seedDefaultPricing(false)}
                      disabled={seedingDefaults}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#ff6b35] text-white text-sm font-medium rounded-xl hover:bg-[#e55a25] disabled:opacity-50"
                    >
                      {seedingDefaults ? 'Loading default prices…' : `Load ${DEFAULT_PRICE_LIST.length}-Item Default Price List`}
                    </button>
                  )}
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-8 space-y-1">
                  <p className="text-sm text-gray-400">No items match your search.</p>
                  <button onClick={() => { setPricingSearch(''); setPricingCategoryFilter(''); }} className="text-xs text-[#ff6b35] hover:underline">Clear filters</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.map(item => (
                    <div key={item.id} className="border border-gray-100 rounded-xl p-4">
                      {editingPricingId === item.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <input type="text" defaultValue={item.category}
                              onChange={e => setPricingItems(prev => prev.map(p => p.id === item.id ? { ...p, category: e.target.value } : p))}
                              className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" placeholder="Category" />
                            <input type="text" defaultValue={item.item_name}
                              onChange={e => setPricingItems(prev => prev.map(p => p.id === item.id ? { ...p, item_name: e.target.value } : p))}
                              className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" placeholder="Item Name" />
                          </div>

                          {/* Fixed price toggle in edit mode */}
                          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
                            <div
                              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${item.fixed_price ? 'bg-[#1e3a5f]' : 'bg-gray-300'}`}
                              onClick={() => setPricingItems(prev => prev.map(p => p.id === item.id ? { ...p, fixed_price: !p.fixed_price } : p))}
                            >
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${item.fixed_price ? 'left-4' : 'left-0.5'}`} />
                            </div>
                            <p className="text-xs font-medium text-gray-700">Fixed Price <span className="text-gray-400 font-normal">(all tiers same)</span></p>
                          </div>

                          {item.fixed_price ? (
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">🔒 Fixed Price (all tiers)</label>
                              <input type="number" min={0} step={0.01} defaultValue={item.good_price}
                                onChange={e => {
                                  const v = parseFloat(e.target.value) || 0;
                                  setPricingItems(prev => prev.map(p => p.id === item.id ? { ...p, good_price: v, better_price: v, best_price: v } : p));
                                }}
                                className="w-full px-3 py-2 border border-[#1e3a5f] rounded-lg text-sm outline-none bg-blue-50" />
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-3">
                              {[{ label: 'Good', key: 'good_price' }, { label: 'Better', key: 'better_price' }, { label: 'Best', key: 'best_price' }].map(f => (
                                <div key={f.key}>
                                  <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                                  <input type="number" min={0} step={0.01} defaultValue={(item as any)[f.key]}
                                    onChange={e => setPricingItems(prev => prev.map(p => p.id === item.id ? { ...p, [f.key]: parseFloat(e.target.value) || 0 } : p))}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" />
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button onClick={() => savePricingItem(item)} className="px-4 py-2 bg-[#1e3a5f] text-white text-sm font-medium rounded-lg hover:bg-[#2d5a8e] transition-colors">Save</button>
                            <button onClick={() => setEditingPricingId(null)} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide">{item.category}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900">{item.item_name}</p>
                              {item.fixed_price && (
                                <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full font-medium">
                                  🔒 Fixed
                                </span>
                              )}
                            </div>
                            {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                            <div className="flex gap-4 mt-1">
                              {item.fixed_price ? (
                                <span className="text-xs text-gray-700 font-medium">🔒 ${item.good_price.toFixed(2)} — all tiers</span>
                              ) : (
                                <>
                                  <span className="text-xs text-emerald-600 font-medium">Good: ${item.good_price.toFixed(0)}</span>
                                  <span className="text-xs text-blue-600 font-medium">Better: ${item.better_price.toFixed(0)}</span>
                                  <span className="text-xs text-amber-600 font-medium">Best: ${item.best_price.toFixed(0)}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {canEditPricing && (
                            <div className="flex gap-2">
                              <button onClick={() => setEditingPricingId(item.id)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => deletePricingItem(item.id)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Template Prices Tab */}
        {activeTab === 'templates' && (() => {
          const selectedTemplate = quoteProjectTemplates[selectedTemplateIdx];
          const getKey = (cat: string, name: string) => `${cat}::${name}`;

          const getEdit = (cat: string, name: string, tmplGood: number, tmplBetter: number, tmplBest: number) => {
            const k = getKey(cat, name);
            if (templateEdits[k]) return templateEdits[k];
            const existing = pricingItems.find(p => p.category === cat && p.item_name === name);
            if (existing) return {
              good_price: existing.good_price,
              better_price: existing.better_price,
              best_price: existing.best_price,
              fixed_price: existing.fixed_price ?? false,
              fixedAmt: existing.good_price,
            };
            return { good_price: tmplGood, better_price: tmplBetter, best_price: tmplBest, fixed_price: false, fixedAmt: tmplGood };
          };

          const setEdit = (cat: string, name: string, patch: Partial<typeof templateEdits[string]>) => {
            const k = getKey(cat, name);
            const cur = getEdit(cat, name, 0, 0, 0);
            setTemplateEdits(prev => ({ ...prev, [k]: { ...cur, ...patch } }));
          };

          const saveItem = async (cat: string, name: string, unit: string, desc: string, tmplGood: number, tmplBetter: number, tmplBest: number) => {
            const edit = getEdit(cat, name, tmplGood, tmplBetter, tmplBest);
            const good = edit.fixed_price ? edit.fixedAmt : edit.good_price;
            const better = edit.fixed_price ? edit.fixedAmt : edit.better_price;
            const best = edit.fixed_price ? edit.fixedAmt : edit.best_price;
            const existing = pricingItems.find(p => p.category === cat && p.item_name === name);
            if (existing) {
              await supabase.from('company_pricing').update({ good_price: good, better_price: better, best_price: best, fixed_price: edit.fixed_price, price_overridden: true, updated_at: new Date().toISOString() }).eq('id', existing.id);
            } else {
              await supabase.from('company_pricing').insert({ company_id: company.id, category: cat, item_name: name, description: desc, unit, good_price: good, better_price: better, best_price: best, fixed_price: edit.fixed_price });
            }
            toast.success(`${name} saved!`);
            fetchPricingItems();
          };

          const saveAll = async () => {
            for (const item of selectedTemplate.lineItems) {
              await saveItem(item.category, item.item_name, item.unit, item.description, item.good_price, item.better_price, item.best_price);
            }
            toast.success('All items saved to Price Library!');
          };

          return (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Template Prices</h3>
                <p className="text-sm text-gray-500">Pick a template and set your company's prices for each item. Saved prices apply automatically when that template is loaded in a quote.</p>
              </div>

              {/* Template Picker */}
              <div className="flex flex-wrap gap-2">
                {quoteProjectTemplates.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedTemplateIdx(i); setTemplateEdits({}); }}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${i === selectedTemplateIdx ? 'bg-[#1e3a5f] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>

              {/* Item list */}
              <div className="space-y-2">
                {/* Header */}
                <div className="hidden lg:grid lg:grid-cols-12 gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1">
                  <div className="col-span-3">Item</div>
                  <div className="col-span-1">Unit</div>
                  <div className="col-span-1 text-center">Fixed</div>
                  <div className="col-span-2 text-emerald-600">Good</div>
                  <div className="col-span-2 text-blue-600">Better</div>
                  <div className="col-span-2 text-amber-600">Best</div>
                  <div className="col-span-1"></div>
                </div>

                {selectedTemplate.lineItems.map((item, idx) => {
                  const edit = getEdit(item.category, item.item_name, item.good_price, item.better_price, item.best_price);
                  const isOverridden = pricingItems.some(p => p.category === item.category && p.item_name === item.item_name);
                  const k = getKey(item.category, item.item_name);
                  const isDirty = !!templateEdits[k];

                  return (
                    <div key={idx} className={`border rounded-xl p-3 grid grid-cols-1 lg:grid-cols-12 gap-2 items-center text-sm transition-colors ${isOverridden ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white'}`}>
                      <div className="lg:col-span-3">
                        <p className="font-medium text-gray-900 text-xs">{item.item_name}</p>
                        <p className="text-gray-400 text-xs">{item.category}</p>
                        {isOverridden && !isDirty && <span className="text-xs text-blue-600 font-medium">✓ Overridden</span>}
                      </div>
                      <div className="lg:col-span-1 text-xs text-gray-500">{item.unit}</div>

                      {/* Fixed toggle */}
                      <div className="lg:col-span-1 flex justify-center">
                        <div
                          className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${edit.fixed_price ? 'bg-blue-600' : 'bg-gray-300'}`}
                          onClick={() => setEdit(item.category, item.item_name, { fixed_price: !edit.fixed_price, fixedAmt: edit.good_price })}
                          title="Fixed price (same across all tiers)"
                        >
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${edit.fixed_price ? 'left-4' : 'left-0.5'}`} />
                        </div>
                      </div>

                      {/* Price inputs */}
                      {edit.fixed_price ? (
                        <div className="lg:col-span-6 flex items-center gap-2">
                          <span className="text-xs text-blue-600 shrink-0">🔒 All tiers</span>
                          <input
                            type="number" min={0} step={0.01}
                            value={edit.fixedAmt}
                            onChange={e => setEdit(item.category, item.item_name, { fixedAmt: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1.5 border border-blue-300 rounded-lg text-xs text-center focus:ring-2 focus:ring-blue-400 outline-none bg-blue-50"
                          />
                        </div>
                      ) : (
                        <>
                          {[
                            { val: edit.good_price, field: 'good_price' as const, cls: 'border-emerald-200 bg-emerald-50/50 focus:ring-emerald-400', dflt: item.good_price },
                            { val: edit.better_price, field: 'better_price' as const, cls: 'border-blue-200 bg-blue-50/50 focus:ring-blue-400', dflt: item.better_price },
                            { val: edit.best_price, field: 'best_price' as const, cls: 'border-amber-200 bg-amber-50/50 focus:ring-amber-400', dflt: item.best_price },
                          ].map(({ val, field, cls, dflt }) => (
                            <div key={field} className="lg:col-span-2">
                              <input
                                type="number" min={0} step={0.01}
                                value={val}
                                placeholder={String(dflt)}
                                onChange={e => setEdit(item.category, item.item_name, { [field]: parseFloat(e.target.value) || 0 })}
                                className={`w-full px-2 py-1.5 border rounded-lg text-xs text-center focus:ring-2 outline-none ${cls}`}
                              />
                            </div>
                          ))}
                        </>
                      )}

                      {/* Save button */}
                      <div className="lg:col-span-1 flex justify-end">
                        <button
                          onClick={() => saveItem(item.category, item.item_name, item.unit, item.description, item.good_price, item.better_price, item.best_price)}
                          className="px-3 py-1.5 bg-[#1e3a5f] text-white rounded-lg text-xs font-medium hover:bg-[#2d5a8e] transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Save All */}
              <button
                onClick={saveAll}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                💾 Save All {selectedTemplate.lineItems.length} Items to Price Library
              </button>
            </div>
          );
        })()}

        {/* About Tab — owner/admin/manager only */}
        {activeTab === 'about' && (
          canEditCompanyInfo
            ? <AboutUsSettings company={company} onUpdate={onUpdate} />
            : (
              <div className="p-8 flex flex-col items-center gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
                  <Lock className="w-7 h-7 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-800">Owner, admin & manager only</h3>
                  <p className="text-sm text-gray-500 mt-1">The About Us page is company-wide content. Contact your manager to update it.</p>
                </div>
              </div>
            )
        )}

        {/* Warranty Tab — owner/admin/manager only */}
        {activeTab === 'warranty' && (
          canEditCompanyInfo
            ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Warranty Terms</h3>
                  <p className="text-sm text-gray-500 mb-4">This text will appear on the "Warranty" page of your estimates.</p>
                  <textarea
                    value={form.warranty_text || ''}
                    onChange={(e) => setForm({ ...form, warranty_text: e.target.value })}
                    rows={12}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none resize-none"
                    placeholder="Describe your warranty coverage, terms, conditions, and what is/isn't covered..."
                  />
                  <p className="text-xs text-gray-400 mt-1">{(form.warranty_text || '').length} characters</p>
                </div>
              </div>
            )
            : (
              <div className="p-8 flex flex-col items-center gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
                  <Lock className="w-7 h-7 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-800">Owner, admin & manager only</h3>
                  <p className="text-sm text-gray-500 mt-1">Warranty terms are company-wide content. Contact your manager to update them.</p>
                </div>
              </div>
            )
        )}
      </div>
    </div>

    {/* ── Branding Preview Modal ─────────────────────────────────────────────── */}
    {showBrandingPreview && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowBrandingPreview(false)}>
        <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
          {/* Modal header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-white border-b border-gray-100">
            <div>
              <p className="text-base font-bold text-gray-900">Quote Layout Preview</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {(form.quote_customer_layout || 'modern') === 'modern' ? '✦ Modern PDF Layout' : 'Classic Layout'} · Sample with your current colors
              </p>
            </div>
            <button onClick={() => setShowBrandingPreview(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X size={18} className="text-gray-500" />
            </button>
          </div>

          {(form.quote_customer_layout || 'modern') === 'modern' ? (
            /* ── Modern layout preview ── */
            <div className="pb-6">
              {/* Hero header */}
              <div
                className="px-6 py-8 relative"
                style={{
                  background: `linear-gradient(135deg, ${form.quote_secondary_color || '#0d1f3c'} 0%, ${form.quote_primary_color || '#1e3a5f'} 60%)`,
                  borderTop: `4px solid ${form.quote_accent_color || '#ff6b35'}`,
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: form.quote_accent_color || '#ff6b35' }}>Prepared proposal</p>
                    <div className="flex items-center gap-3 mb-3">
                      <img src={form.logo_url || `${import.meta.env.BASE_URL}trussctr-logo.png`} alt="logo" className="h-8 w-8 rounded-full object-cover border-2 border-white/30" />
                      <div>
                        <p className="text-white font-bold text-lg leading-tight">{form.name || 'Your Company'}</p>
                        <p className="text-white/60 text-xs">Exterior Project Proposal</p>
                      </div>
                    </div>
                    <p className="text-white text-xl font-bold mb-1">Asphalt Shingle Roof</p>
                    <p className="text-white/70 text-sm leading-relaxed">Full tear-off and re-roof with architectural shingles, ice &amp; water shield, and ventilation upgrade.</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-white/50 text-xs mb-1">Quote #</p>
                    <p className="text-white font-bold text-sm">QT-2024-001</p>
                  </div>
                </div>
                {/* Meta cards */}
                <div className="grid grid-cols-2 gap-2 mt-5">
                  {[
                    { label: 'Prepared For', value: 'John & Sarah Smith' },
                    { label: 'Prepared By', value: form.name || 'Your Company' },
                    { label: 'Proposal Date', value: new Date().toLocaleDateString() },
                    { label: 'Valid Until', value: new Date(Date.now() + 30 * 86400000).toLocaleDateString() },
                  ].map(card => (
                    <div key={card.label} className="rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(255,255,255,0.10)' }}>
                      <p className="text-white/50 text-xs mb-0.5">{card.label}</p>
                      <p className="text-white text-sm font-semibold">{card.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample scope section */}
              <div className="px-5 pt-5">
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: form.quote_primary_color || '#1e3a5f' }}>
                    <p className="text-white text-sm font-bold">Roofing</p>
                    <p className="text-white/70 text-xs">3 items</p>
                  </div>
                  {[
                    { name: 'Tear-off & Disposal', qty: '22 sq', good: '$880', better: '$880', best: '$880' },
                    { name: 'Architectural Shingles', qty: '22 sq', good: '$4,290', better: '$6,160', best: '$8,800' },
                    { name: 'Ice & Water Shield', qty: '4 sq', good: '$440', better: '$560', best: '$720' },
                  ].map((item, i) => (
                    <div key={i} className={`px-4 py-3 flex items-center justify-between ${i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.qty}</p>
                      </div>
                      <div className="flex gap-4 text-right">
                        <div><p className="text-xs text-gray-400">Good</p><p className="text-xs font-semibold text-gray-700">{item.good}</p></div>
                        <div><p className="text-xs font-semibold" style={{ color: form.quote_accent_color || '#ff6b35' }}>Better</p><p className="text-sm font-bold" style={{ color: form.quote_accent_color || '#ff6b35' }}>{item.better}</p></div>
                        <div><p className="text-xs text-gray-400">Best</p><p className="text-xs font-semibold text-gray-700">{item.best}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Investment / tier cards */}
              <div className="px-5 pt-4">
                <p className="text-base font-bold text-gray-900 mb-3 text-center">Investment Options</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Good', amount: '$18,400', highlight: false },
                    { label: 'Better', amount: '$22,800', highlight: true },
                    { label: 'Best', amount: '$28,500', highlight: false },
                  ].map(tier => (
                    <div
                      key={tier.label}
                      className="rounded-xl border-2 p-3 text-center"
                      style={tier.highlight
                        ? { borderColor: form.quote_accent_color || '#ff6b35', backgroundColor: `${form.quote_accent_color || '#ff6b35'}10` }
                        : { borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}
                    >
                      {tier.highlight && (
                        <span className="inline-block text-[10px] font-bold text-white px-2 py-0.5 rounded-full mb-1" style={{ backgroundColor: form.quote_accent_color || '#ff6b35' }}>
                          RECOMMENDED
                        </span>
                      )}
                      <p className="text-xs font-semibold text-gray-500 mb-1">{tier.label}</p>
                      <p className="text-lg font-bold" style={tier.highlight ? { color: form.quote_accent_color || '#ff6b35' } : { color: '#111827' }}>{tier.amount}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Color palette reference */}
              <div className="mx-5 mt-5 rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Applied Color Palette</p>
                <div className="flex items-center gap-4">
                  {[
                    { label: 'Primary', color: form.quote_primary_color || '#1e3a5f' },
                    { label: 'Secondary', color: form.quote_secondary_color || '#0d1f3c' },
                    { label: 'Accent', color: form.quote_accent_color || '#ff6b35' },
                  ].map(c => (
                    <div key={c.label} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full ring-1 ring-black/10 shadow-sm" style={{ backgroundColor: c.color }} />
                      <div>
                        <p className="text-xs font-semibold text-gray-700">{c.label}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{c.color}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ── Classic layout preview ── */
            <div className="pb-6">
              {/* Classic header strip */}
              <div
                className="px-6 py-5 flex items-start justify-between border-b-4"
                style={{ borderColor: form.quote_accent_color || '#ff6b35', backgroundColor: `${form.quote_primary_color || '#1e3a5f'}10` }}
              >
                <div className="flex items-center gap-3">
                  <img src={form.logo_url || `${import.meta.env.BASE_URL}trussctr-logo.png`} alt="logo" className="h-10 w-10 rounded object-contain" />
                  <div>
                    <p className="font-bold text-lg" style={{ color: form.quote_primary_color || '#1e3a5f' }}>{form.name || 'Your Company'}</p>
                    <p className="text-xs text-gray-500">{form.address || '123 Main St'} · {form.phone || '(555) 000-0000'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm" style={{ color: form.quote_primary_color || '#1e3a5f' }}>Quote #QT-2024-001</p>
                  <p className="text-xs text-gray-500">Date: {new Date().toLocaleDateString()}</p>
                  <p className="text-xs text-gray-500">Valid Until: {new Date(Date.now() + 30 * 86400000).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Parties */}
              <div className="grid grid-cols-2 gap-4 px-6 py-4">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: form.quote_accent_color || '#ff6b35' }}>Customer</p>
                  <p className="font-bold text-sm" style={{ color: form.quote_primary_color || '#1e3a5f' }}>John &amp; Sarah Smith</p>
                  <p className="text-xs text-gray-500">123 Oak Lane, Springfield IL 62701</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: form.quote_accent_color || '#ff6b35' }}>Project</p>
                  <p className="font-bold text-sm" style={{ color: form.quote_primary_color || '#1e3a5f' }}>Asphalt Shingle Roof</p>
                  <p className="text-xs text-gray-500">Full tear-off, architectural shingles, ventilation upgrade</p>
                </div>
              </div>

              {/* Sample table */}
              <div className="px-6">
                <p className="text-sm font-bold border-l-4 pl-2 mb-2" style={{ borderColor: form.quote_accent_color || '#ff6b35', color: form.quote_primary_color || '#1e3a5f' }}>Roofing</p>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: form.quote_primary_color || '#1e3a5f' }}>
                      <th className="text-left text-white px-3 py-2 w-1/2">Item</th>
                      <th className="text-left text-white px-2 py-2 w-1/6">Qty</th>
                      <th className="text-right text-white px-2 py-2">Better Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'Tear-off & Disposal', qty: '22 sq', price: '$880' },
                      { name: 'Architectural Shingles', qty: '22 sq', price: '$6,160' },
                      { name: 'Ice & Water Shield', qty: '4 sq', price: '$560' },
                    ].map((item, i) => (
                      <tr key={i} className={i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="px-3 py-1.5 font-medium text-gray-800">{item.name}</td>
                        <td className="px-2 py-1.5 text-gray-600">{item.qty}</td>
                        <td className="px-2 py-1.5 text-right font-semibold text-gray-800">{item.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tier totals */}
              <div className="grid grid-cols-3 gap-3 px-6 pt-4">
                {[
                  { label: 'Good', amount: '$18,400', bg: '#d1fae5', border: '#6ee7b7', text: '#065f46' },
                  { label: 'Better', amount: '$22,800', bg: '#dbeafe', border: '#93c5fd', text: '#1e40af' },
                  { label: 'Best', amount: '$28,500', bg: '#fef3c7', border: '#fcd34d', text: '#92400e' },
                ].map(tier => (
                  <div key={tier.label} className="rounded-lg text-center p-3" style={{ backgroundColor: tier.bg, border: `1px solid ${tier.border}` }}>
                    <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: tier.text }}>{tier.label}</p>
                    <p className="text-lg font-bold" style={{ color: '#1a1a1a' }}>{tier.amount}</p>
                  </div>
                ))}
              </div>

              {/* Color palette reference */}
              <div className="mx-6 mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Applied Color Palette</p>
                <div className="flex items-center gap-4">
                  {[
                    { label: 'Primary', color: form.quote_primary_color || '#1e3a5f' },
                    { label: 'Secondary', color: form.quote_secondary_color || '#0d1f3c' },
                    { label: 'Accent', color: form.quote_accent_color || '#ff6b35' },
                  ].map(c => (
                    <div key={c.label} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full ring-1 ring-black/10 shadow-sm" style={{ backgroundColor: c.color }} />
                      <div>
                        <p className="text-xs font-semibold text-gray-700">{c.label}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{c.color}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 flex justify-end">
            <button
              type="button"
              onClick={() => setShowBrandingPreview(false)}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: form.quote_primary_color || '#1e3a5f' }}
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default CompanySetup;

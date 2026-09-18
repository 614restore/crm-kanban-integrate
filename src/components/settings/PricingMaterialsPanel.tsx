// Settings → Pricing & Materials: QuoteMGR's price library, template prices,
// and materials & margin sections, copied from its SettingsHub as-is. This
// loads the company row those panels edit and reproduces SettingsHub's
// sub-tab layout and role gating, since QuoteMGR keeps them inline in one
// large component rather than as a standalone page.
import React, { useEffect, useState } from 'react';
import { FileSpreadsheet, Loader2, Lock, TrendingUp, Unlock, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { isOwnerOrManager } from '@/lib/templateLibrary';
import LaborRatesPanel from '@/components/LaborRatesPanel';
import PriceListImporter from '@/components/PriceListImporter';
import MaterialPreferencesPanel from '@/components/MaterialPreferencesPanel';
import TemplateManagerPanel from '@/components/TemplateManagerPanel';
import type { Company, TeamMember } from '@/data/quoteData';

const COMPANY_COLUMNS = [
  'id', 'name', 'sales_can_edit_pricing', 'material_preferences',
  'default_margin_percent', 'margin_locked', 'standard_price_list_name', 'supplement_rates',
].join(', ');

interface PricingMaterialsPanelProps {
  companyId: string;
  userId: string;
  userRole: string;
}

type PricingSubTab = 'library' | 'templates' | 'materials';

export default function PricingMaterialsPanel({ companyId, userId, userRole }: PricingMaterialsPanelProps) {
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<PricingSubTab>('library');

  const [marginPct, setMarginPct] = useState('50');
  const [marginLocked, setMarginLocked] = useState(false);
  const [savingMargin, setSavingMargin] = useState(false);
  const marginDirty = React.useRef(false);

  useEffect(() => {
    let cancelled = false;
    setCompany(null);
    setError(null);
    supabase
      .from('companies')
      .select(COMPANY_COLUMNS)
      .eq('id', companyId)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError || !data) {
          setError(loadError?.message || 'Company not found.');
          return;
        }
        const row = data as unknown as Company;
        setCompany(row);
        setMarginPct(String((row as any).default_margin_percent ?? 50));
        setMarginLocked((row as any).margin_locked ?? false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const saveMargin = async () => {
    if (!company) return;
    setSavingMargin(true);
    const pct = parseFloat(marginPct);
    const { error: saveError } = await supabase
      .from('companies')
      .update({ default_margin_percent: pct, margin_locked: marginLocked })
      .eq('id', company.id);
    setSavingMargin(false);
    if (saveError) {
      toast.error(saveError.message || 'Could not save margin settings');
      return;
    }
    setCompany({ ...company, default_margin_percent: pct, margin_locked: marginLocked } as Company);
    marginDirty.current = false;
    toast.success('Margin settings saved');
  };

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6 text-sm text-red-700">
        Could not load pricing settings: {error}
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-gray-500">
        <Loader2 size={16} className="animate-spin" /> Loading pricing settings…
      </div>
    );
  }

  const canManageTeamFeatures = isOwnerOrManager(userRole);
  // PriceListImporter only distinguishes owner/admin from everyone else, so
  // manager/salesperson/etc. all collapse to its 'member' bucket.
  const importerRole: 'owner' | 'admin' | 'member' =
    userRole === 'owner' || userRole === 'admin' ? userRole : 'member';
  // TemplateManagerPanel (like CompanySetup) only reads the role off the
  // member it is given.
  const templateRole = userRole as TeamMember['role'];

  // Salespeople with the company-level permission only get the importer for
  // their own price list, matching QuoteMGR's 'My Prices' tab.
  if (!canManageTeamFeatures) {
    if (!company.sales_can_edit_pricing) {
      return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-gray-500">
          Only owners, admins and managers can manage pricing here.
        </div>
      );
    }
    return (
      <div className="max-w-4xl">
        <PriceListImporter company={company} onCompanyUpdate={setCompany} userRole={importerRole} userId={userId} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="flex gap-1 border-b border-gray-100 mb-6">
        {([
          { id: 'library', label: 'Price Library' },
          { id: 'templates', label: 'Template Prices' },
          { id: 'materials', label: 'Materials & Margin' },
        ] as const).map((st) => (
          <button
            key={st.id}
            type="button"
            onClick={() => setSubTab(st.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              subTab === st.id
                ? 'border-[#1e3a5f] text-[#1e3a5f] bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {subTab === 'library' && (
        <div className="space-y-8">
          <LaborRatesPanel company={company} userRole={userRole} />
          <PriceListImporter company={company} onCompanyUpdate={setCompany} userRole={importerRole} userId={userId} />
        </div>
      )}

      {subTab === 'templates' && <TemplateManagerPanel companyId={company.id} userRole={templateRole} />}

      {subTab === 'materials' && (
        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-gray-400" />
              <h3 className="text-base font-semibold text-gray-900">Strike Materials</h3>
            </div>
            <MaterialPreferencesPanel
              companyId={company.id}
              initialPrefs={(company as any).material_preferences}
              onSaved={(prefs) => setCompany({ ...company, material_preferences: prefs } as Company)}
            />
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Target Profit Margin</h3>
                <p className="text-xs text-gray-500">
                  Stored as a reference for profitability tracking. Quote prices use your Price List rates — use the
                  ± adjust slider in Quote Builder to mark up a specific quote.
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Default margin %</label>
                <div className="flex items-center gap-3">
                  <div className="relative w-36">
                    <input
                      type="number"
                      min="0"
                      max="80"
                      value={marginPct}
                      onChange={(e) => {
                        setMarginPct(e.target.value);
                        marginDirty.current = true;
                      }}
                      className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
                      %
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Your target gross margin — stored for reference and reporting</p>
                </div>
                {parseFloat(marginPct) >= 50 && !isNaN(parseFloat(marginPct)) && (
                  <p className="text-xs text-amber-600 mt-1.5">
                    This also drives the mobile app&rsquo;s &ldquo;Sell Price&rdquo; toggle (sell = cost ÷ (1 −
                    margin)). At {marginPct}%, that multiplies material cost by{' '}
                    {(1 / (1 - Math.min(Math.max(parseFloat(marginPct), 0), 80) / 100)).toFixed(1)}×. Double-check
                    this is the number you mean.
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-start gap-3">
                  {marginLocked ? (
                    <Lock className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Unlock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {marginLocked ? 'Margin locked for team members' : 'Margin adjustment open to all users'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {marginLocked
                        ? 'Only owners and admins can change the default margin.'
                        : 'Any team member can adjust the default margin from Strike Mode.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMarginLocked((prev) => !prev);
                    marginDirty.current = true;
                  }}
                  className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
                    marginLocked ? 'bg-amber-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      marginLocked ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <button
                type="button"
                onClick={saveMargin}
                disabled={savingMargin}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white text-sm font-medium rounded-lg hover:bg-[#16304d] disabled:opacity-50"
              >
                {savingMargin ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                Save margin settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Home, Layers, Droplets, CheckCircle, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MaterialPreferences, TierMaterial } from '@/data/quoteData';
import { toast } from 'sonner';
import { BRAND_CATALOG, SHINGLE_BRANDS } from '@/components/LineItemEditor';

interface Props {
  companyId: string;
  initialPrefs?: MaterialPreferences | null;
  onSaved?: (prefs: MaterialPreferences) => void;
}

type TradeTab = 'roofing' | 'siding' | 'gutters';

// ── Product suggestion lists ──────────────────────────────────────────────────

// Every brand's shingle product is suggested for every tier — not just the
// tier that brand happens to label it as — so e.g. Atlas Pinnacle Pristine
// (Atlas's own "Better" product) can still be picked for the Good tier if
// that's how a given company actually uses it. The tier's own natural match
// across brands is listed first so the common case still comes up top.
const shingleSuggestionsForTier = (tier: 'good' | 'better' | 'best'): string[] => {
  const brands = Object.values(BRAND_CATALOG);
  const natural = brands.map(b => b.shingle[tier]);
  const others = (['good', 'better', 'best'] as const)
    .filter(t => t !== tier)
    .flatMap(t => brands.map(b => b.shingle[t]));
  return [...natural, ...others];
};

const SUGGESTIONS: Record<string, string[]> = {
  // Roofing shingles — every brand's Good/Better/Best product, all available
  // in every tier's box (see shingleSuggestionsForTier above).
  'rf-good':   shingleSuggestionsForTier('good'),
  'rf-better': shingleSuggestionsForTier('better'),
  'rf-best':   shingleSuggestionsForTier('best'),
  // Roofing supporting
  'underlayment':  ['GAF FeltBuster Synthetic', 'Owens Corning ProArmor', 'CertainTeed DiamondDeck', 'Henry BlueskinVP', 'Synthetic felt'],
  'ice_water':     ['GAF WeatherWatch', 'Grace Ice & Water Shield', 'CertainTeed WinterGuard', 'Henry Blueskin WB', 'Owens Corning WeatherLock'],
  'starter':       ['GAF ProStart Starter Strip', 'Owens Corning Starter Strip', 'CertainTeed SwiftStart', 'Atlas Starter Strip'],
  'ridge_cap':     ['GAF TimberTex Premium', 'GAF Seal-A-Ridge', 'Owens Corning RidgeCrest', 'CertainTeed Ridge Cap', 'Atlas StormMaster Ridge'],
  'drip_edge':     ['Aluminum drip edge', 'Galvanized steel drip edge', 'Painted aluminum drip edge', 'Copper drip edge'],
  // Siding
  'sd-good':   ['LP SmartSide Lap Siding', 'CertainTeed Monogram Vinyl', 'Mastic Home Exteriors', 'Georgia-Pacific Vinyl'],
  'sd-better': ['James Hardie HardiePlank', 'CertainTeed Fiber Cement', 'LP SmartSide ExpertFinish', 'Allura Fiber Cement'],
  'sd-best':   ['James Hardie HardieShake', 'Azek PVC Trim Board', 'LP SmartSide ExpertFinish Premium', 'Nichiha Illumination'],
  'house_wrap':    ['Tyvek HomeWrap', 'Typar HouseWrap', 'Barricade Building Wrap', 'Henry Blueskin VP160'],
  // Gutters
  'gt-material':   ['Aluminum', 'Copper', 'Steel', 'Galvanized steel', 'Vinyl'],
  'gt-style':      ['K-style', 'Half-round', 'Box', 'Fascia'],
  'gt-size':       ['5-inch', '6-inch', '4-inch', '7-inch'],
  'gt-color':      ['White', 'Brown', 'Musket Brown', 'Bronze', 'Charcoal', 'Black', 'Mill finish'],
};

// Finds which brand + product line a chosen shingle product belongs to, so a
// tier's supporting materials (underlayment, ice & water, ridge cap, starter,
// drip edge) can be auto-filled from that same brand — keeping a tier's
// accessories correlated to whichever manufacturer that tier actually uses.
const findBrandMatch = (product: string): { brandId: string; slot: 'good' | 'better' | 'best' } | null => {
  if (!product) return null;
  for (const [brandId, data] of Object.entries(BRAND_CATALOG)) {
    for (const slot of ['good', 'better', 'best'] as const) {
      if (data.shingle[slot] === product) return { brandId, slot };
    }
  }
  return null;
};

// When a tier's product changes to a recognized brand/product-line match,
// auto-fill that tier's still-empty supporting materials from the same brand
// + slot — never overwriting something the user already typed in themselves.
const applyBrandAutoFill = (prev: TierMaterial, next: TierMaterial): TierMaterial => {
  if (next.product === prev.product) return next;
  const match = findBrandMatch(next.product);
  if (!match) return next;
  const brand = BRAND_CATALOG[match.brandId];
  const slot = match.slot;
  return {
    ...next,
    underlayment: next.underlayment || brand.underlayment[slot],
    ice_water:    next.ice_water    || brand.ice_water[slot],
    starter:      next.starter      || brand.starter[slot],
    ridge_cap:    next.ridge_cap    || brand.ridge_cap[slot],
    drip_edge:    next.drip_edge    || brand.drip_edge[slot],
  };
};

// ── AutocompleteInput ─────────────────────────────────────────────────────────

const AutocompleteInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suggestions: string[];
  className?: string;
}> = ({ value, onChange, placeholder, suggestions, className = '' }) => {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = value.trim()
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase())
    : [];

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showDropdown = open && filtered.length > 0;
  const showChips = focused && !value && suggestions.length > 0;

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => { setFocused(true); setOpen(true); }}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent pr-7 ${className}`}
        />
        {value && (
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); onChange(''); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {showDropdown && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(s => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); onChange(s); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Suggestion chips (shown when field is empty + focused) */}
      {showChips && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.slice(0, 5).map(s => (
            <button
              key={s}
              type="button"
              onMouseDown={e => { e.preventDefault(); onChange(s); setFocused(false); }}
              className="px-2.5 py-1 bg-gray-100 hover:bg-indigo-100 text-gray-600 hover:text-indigo-700 text-xs rounded-full border border-gray-200 hover:border-indigo-300 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── TIER_COLORS ───────────────────────────────────────────────────────────────

const TIER_COLORS = {
  good:   { label: 'Good',   bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', ring: 'focus:ring-emerald-400' },
  better: { label: 'Better', bg: 'bg-blue-50',    border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-700',       ring: 'focus:ring-blue-400' },
  best:   { label: 'Best',   bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-700',     ring: 'focus:ring-amber-400' },
} as const;

// ── TierInput ─────────────────────────────────────────────────────────────────

const TierInput: React.FC<{
  tier: 'good' | 'better' | 'best';
  value: TierMaterial;
  onChange: (v: TierMaterial) => void;
  productSuggestionKey: string;
}> = ({ tier, value, onChange, productSuggestionKey }) => {
  const c = TIER_COLORS[tier];
  const suggestions = SUGGESTIONS[productSuggestionKey] ?? [];
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 space-y-3`}>
      <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full ${c.badge}`}>{c.label}</span>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Product / Brand Name</label>
        <AutocompleteInput
          value={value.product}
          onChange={v => onChange({ ...value, product: v })}
          placeholder={suggestions[0] ? `e.g. ${suggestions[0]}` : 'Enter product name'}
          suggestions={suggestions}
          className={`focus:ring-2 ${c.ring}`}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Warranty</label>
          <AutocompleteInput
            value={value.warranty || ''}
            onChange={v => onChange({ ...value, warranty: v })}
            placeholder="e.g. Lifetime, 30-year"
            suggestions={['Lifetime', '50-year', '30-year', '25-year', '20-year', '10-year', 'Limited Lifetime']}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
          <AutocompleteInput
            value={value.notes || ''}
            onChange={v => onChange({ ...value, notes: v })}
            placeholder="e.g. Class 4 impact"
            suggestions={['Class 4 impact rated', 'Class 3 impact rated', 'Energy Star rated', 'Designer series', 'Algae resistant', 'High wind rated']}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Price per Square <span className="font-normal text-gray-400">(target all-in rate, material + labor — every roofing line item is scaled proportionally to land on this total when measurements are applied)</span>
        </label>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={value.per_sq ?? ''}
            onChange={e => {
              const v = e.target.value === '' ? undefined : parseFloat(e.target.value);
              onChange({ ...value, per_sq: isNaN(v as number) ? undefined : v });
            }}
            placeholder="e.g. 550"
            className={`w-28 px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 ${c.ring} border-gray-200`}
          />
          <span className="text-xs text-gray-400">/ sq</span>
          {value.per_sq && value.per_sq > 0 && (
            <span className="text-xs text-gray-500 italic ml-1">
              e.g. 11 sq → ${(value.per_sq * 11).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ── SupportingInput ───────────────────────────────────────────────────────────

const SupportingInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  suggestionKey: string;
  placeholder?: string;
}> = ({ label, value, onChange, suggestionKey, placeholder }) => {
  const suggestions = SUGGESTIONS[suggestionKey] ?? [];
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <AutocompleteInput
        value={value}
        onChange={onChange}
        placeholder={placeholder ?? (suggestions[0] ? `e.g. ${suggestions[0]}` : '')}
        suggestions={suggestions}
      />
    </div>
  );
};

const EMPTY_TIER: TierMaterial = { product: '', warranty: '', notes: '' };

// Older saves kept one shared underlayment/ice&water/etc. for all three tiers
// (MaterialPreferences.roofing.underlayment etc). Fold those in as the
// starting value for any tier that doesn't yet have its own — new saves
// always write per-tier values going forward.
const hydrateRoofingTier = (tier: TierMaterial | undefined, flat: MaterialPreferences['roofing']): TierMaterial => ({
  ...(tier ?? EMPTY_TIER),
  underlayment: tier?.underlayment ?? flat?.underlayment ?? '',
  ice_water:    tier?.ice_water    ?? flat?.ice_water    ?? '',
  starter:      tier?.starter      ?? flat?.starter      ?? '',
  ridge_cap:    tier?.ridge_cap    ?? flat?.ridge_cap    ?? '',
  drip_edge:    tier?.drip_edge    ?? flat?.drip_edge    ?? '',
});

// ── Main component ────────────────────────────────────────────────────────────

const MaterialPreferencesPanel: React.FC<Props> = ({ companyId, initialPrefs, onSaved }) => {
  const [activeTab, setActiveTab] = useState<TradeTab>('roofing');
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Roofing state — each tier carries its own supporting materials
  const [rfGood,   setRfGood]   = useState<TierMaterial>(hydrateRoofingTier(initialPrefs?.roofing?.good,   initialPrefs?.roofing));
  const [rfBetter, setRfBetter] = useState<TierMaterial>(hydrateRoofingTier(initialPrefs?.roofing?.better, initialPrefs?.roofing));
  const [rfBest,   setRfBest]   = useState<TierMaterial>(hydrateRoofingTier(initialPrefs?.roofing?.best,   initialPrefs?.roofing));
  // Which tier's supporting materials are currently shown/edited
  const [supportingTier, setSupportingTier] = useState<'good' | 'better' | 'best'>('good');

  // Siding state
  const [sdGood,   setSdGood]   = useState<TierMaterial>(initialPrefs?.siding?.good   ?? EMPTY_TIER);
  const [sdBetter, setSdBetter] = useState<TierMaterial>(initialPrefs?.siding?.better ?? EMPTY_TIER);
  const [sdBest,   setSdBest]   = useState<TierMaterial>(initialPrefs?.siding?.best   ?? EMPTY_TIER);
  const [sdHouseWrap, setSdHouseWrap] = useState(initialPrefs?.siding?.house_wrap ?? '');

  // Gutters state
  const [gtMaterial, setGtMaterial] = useState(initialPrefs?.gutters?.material ?? '');
  const [gtStyle,    setGtStyle]    = useState(initialPrefs?.gutters?.style    ?? '');
  const [gtSize,     setGtSize]     = useState(initialPrefs?.gutters?.size     ?? '');
  const [gtColor,    setGtColor]    = useState(initialPrefs?.gutters?.color    ?? '');

  // Auto-save refs
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedPrefs = useRef<string>('');
  const isFirstRender = useRef(true);

  // Sync when parent updates
  useEffect(() => {
    if (!initialPrefs) return;
    setRfGood(hydrateRoofingTier(initialPrefs.roofing?.good,     initialPrefs.roofing));
    setRfBetter(hydrateRoofingTier(initialPrefs.roofing?.better, initialPrefs.roofing));
    setRfBest(hydrateRoofingTier(initialPrefs.roofing?.best,     initialPrefs.roofing));
    setSdGood(initialPrefs.siding?.good     ?? EMPTY_TIER);
    setSdBetter(initialPrefs.siding?.better ?? EMPTY_TIER);
    setSdBest(initialPrefs.siding?.best     ?? EMPTY_TIER);
    setSdHouseWrap(initialPrefs.siding?.house_wrap ?? '');
    setGtMaterial(initialPrefs.gutters?.material ?? '');
    setGtStyle(initialPrefs.gutters?.style ?? '');
    setGtSize(initialPrefs.gutters?.size ?? '');
    setGtColor(initialPrefs.gutters?.color ?? '');
  }, [initialPrefs]);

  const buildPrefs = useCallback((): MaterialPreferences => ({
    roofing: {
      good:   rfGood.product   ? rfGood   : undefined,
      better: rfBetter.product ? rfBetter : undefined,
      best:   rfBest.product   ? rfBest   : undefined,
      // Mirror the Good tier's supporting materials into the old flat fields
      // for anything not yet updated to read per-tier values (e.g. older
      // clients still on a previous build).
      underlayment: rfGood.underlayment || undefined,
      ice_water:    rfGood.ice_water     || undefined,
      starter:      rfGood.starter       || undefined,
      ridge_cap:    rfGood.ridge_cap     || undefined,
      drip_edge:    rfGood.drip_edge     || undefined,
    },
    siding: {
      good:   sdGood.product   ? sdGood   : undefined,
      better: sdBetter.product ? sdBetter : undefined,
      best:   sdBest.product   ? sdBest   : undefined,
      house_wrap: sdHouseWrap || undefined,
    },
    gutters: {
      material: gtMaterial || undefined,
      style:    gtStyle    || undefined,
      size:     gtSize     || undefined,
      color:    gtColor    || undefined,
    },
  }), [rfGood, rfBetter, rfBest,
      sdGood, sdBetter, sdBest, sdHouseWrap, gtMaterial, gtStyle, gtSize, gtColor]);

  const savePrefs = useCallback(async (prefs: MaterialPreferences, silent: boolean) => {
    if (silent) setAutosaveStatus('saving');
    try {
      const { error } = await supabase
        .from('companies')
        .update({ material_preferences: prefs })
        .eq('id', companyId);
      if (error) throw error;
      committedPrefs.current = JSON.stringify(prefs);
      onSaved?.(prefs);
      if (silent) {
        setAutosaveStatus('saved');
        setTimeout(() => setAutosaveStatus('idle'), 2500);
      } else {
        toast.success('Material preferences saved');
        setAutosaveStatus('saved');
        setTimeout(() => setAutosaveStatus('idle'), 2500);
      }
    } catch (err: any) {
      if (silent) {
        setAutosaveStatus('error');
        setTimeout(() => setAutosaveStatus('idle'), 3000);
      } else {
        toast.error(err.message || 'Failed to save preferences');
      }
    }
  }, [companyId, onSaved]);

  // Auto-save: debounce 1.5s after any change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      committedPrefs.current = JSON.stringify(buildPrefs());
      return;
    }
    const prefs = buildPrefs();
    const currentJson = JSON.stringify(prefs);
    if (currentJson === committedPrefs.current) return;

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => savePrefs(prefs, true), 1500);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [rfGood, rfBetter, rfBest,
      sdGood, sdBetter, sdBest, sdHouseWrap, gtMaterial, gtStyle, gtSize, gtColor]);

  const tabs: { id: TradeTab; label: string; icon: React.ElementType }[] = [
    { id: 'roofing', label: 'Roofing', icon: Home },
    { id: 'siding',  label: 'Siding',  icon: Layers },
    { id: 'gutters', label: 'Gutters', icon: Droplets },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Material Preferences</h2>
          <p className="text-sm text-gray-500 mt-1">
            Set your preferred products per trade and tier. Strike Mode uses these to auto-name line items and write product-specific descriptions.
          </p>
        </div>
        {/* Autosave status */}
        <div className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium mt-1">
          {autosaveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-gray-500">
              <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              Saving…
            </span>
          )}
          {autosaveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-emerald-600">
              <CheckCircle className="w-3.5 h-3.5" />
              Saved
            </span>
          )}
          {autosaveStatus === 'error' && (
            <span className="text-red-500">Save failed</span>
          )}
        </div>
      </div>

      {/* Trade tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === id ? 'bg-white text-[#1e3a5f] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Roofing */}
      {activeTab === 'roofing' && (() => {
        const tierState: Record<'good' | 'better' | 'best', [TierMaterial, (v: TierMaterial) => void]> = {
          good:   [rfGood,   setRfGood],
          better: [rfBetter, setRfBetter],
          best:   [rfBest,   setRfBest],
        };
        const [currentValue, setCurrentValue] = tierState[supportingTier];
        const brandMatch = findBrandMatch(currentValue.product);
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Primary Shingle — by Tier</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <TierInput tier="good"   value={rfGood}   onChange={v => setRfGood(applyBrandAutoFill(rfGood, v))}     productSuggestionKey="rf-good" />
                <TierInput tier="better" value={rfBetter} onChange={v => setRfBetter(applyBrandAutoFill(rfBetter, v))} productSuggestionKey="rf-better" />
                <TierInput tier="best"   value={rfBest}   onChange={v => setRfBest(applyBrandAutoFill(rfBest, v))}     productSuggestionKey="rf-best" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-gray-700">Supporting Materials</h3>
                <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
                  {(['good', 'better', 'best'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSupportingTier(t)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        supportingTier === t ? TIER_COLORS[t].badge : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {TIER_COLORS[t].label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                {currentValue.product
                  ? brandMatch
                    ? <>Correlated to <strong className="text-gray-500 font-medium">{SHINGLE_BRANDS.find(b => b.id === brandMatch.brandId)?.label}</strong> — change the {TIER_COLORS[supportingTier].label} product above to switch brands, or edit any field below manually.</>
                    : `These apply to the ${TIER_COLORS[supportingTier].label} tier's product ("${currentValue.product}").`
                  : `Set a ${TIER_COLORS[supportingTier].label} tier product above first, or fill these in manually.`}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <SupportingInput label="Underlayment"       value={currentValue.underlayment ?? ''} onChange={v => setCurrentValue({ ...currentValue, underlayment: v })} suggestionKey="underlayment" />
                <SupportingInput label="Ice & Water Shield" value={currentValue.ice_water ?? ''}     onChange={v => setCurrentValue({ ...currentValue, ice_water: v })}     suggestionKey="ice_water" />
                <SupportingInput label="Starter Strip"      value={currentValue.starter ?? ''}       onChange={v => setCurrentValue({ ...currentValue, starter: v })}       suggestionKey="starter" />
                <SupportingInput label="Ridge Cap"          value={currentValue.ridge_cap ?? ''}     onChange={v => setCurrentValue({ ...currentValue, ridge_cap: v })}     suggestionKey="ridge_cap" />
                <SupportingInput label="Drip Edge"          value={currentValue.drip_edge ?? ''}     onChange={v => setCurrentValue({ ...currentValue, drip_edge: v })}     suggestionKey="drip_edge" />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Siding */}
      {activeTab === 'siding' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Primary Siding Material — by Tier</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <TierInput tier="good"   value={sdGood}   onChange={setSdGood}   productSuggestionKey="sd-good" />
              <TierInput tier="better" value={sdBetter} onChange={setSdBetter} productSuggestionKey="sd-better" />
              <TierInput tier="best"   value={sdBest}   onChange={setSdBest}   productSuggestionKey="sd-best" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Supporting Materials</h3>
            <SupportingInput label="House Wrap / Weather Barrier" value={sdHouseWrap} onChange={setSdHouseWrap} suggestionKey="house_wrap" />
          </div>
        </div>
      )}

      {/* Gutters */}
      {activeTab === 'gutters' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Default Gutter Specifications</h3>
          <p className="text-xs text-gray-500">These defaults populate gutter line items in Fast Lane quotes. You can always override them per job.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <SupportingInput label="Material" value={gtMaterial} onChange={setGtMaterial} suggestionKey="gt-material" />
            <SupportingInput label="Style"    value={gtStyle}    onChange={setGtStyle}    suggestionKey="gt-style" />
            <SupportingInput label="Size"     value={gtSize}     onChange={setGtSize}     suggestionKey="gt-size" />
            <SupportingInput label="Color"    value={gtColor}    onChange={setGtColor}    suggestionKey="gt-color" />
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
        Changes save automatically · Preferences are shared across your whole company and used by Strike Mode &amp; Fast Lane.
      </p>
    </div>
  );
};

export default MaterialPreferencesPanel;

import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, DollarSign, Package, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  MaterialPricing,
  ICE_WATER_PRODUCTS,
  getPricingConfig,
  savePricingConfig,
  PRICING_DEFAULTS,
} from '@/lib/pricingConfig';

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PriceField({
  label,
  description,
  value,
  onChange,
  prefix = '$',
  suffix,
}: {
  label: string;
  description?: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
}) {
  const [raw, setRaw] = useState(fmt(value));
  useEffect(() => { setRaw(fmt(value)); }, [value]);
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {prefix && <span className="text-sm text-gray-400">{prefix}</span>}
        <input
          type="text"
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={() => {
            const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
            if (!isNaN(n)) { onChange(n); setRaw(fmt(n)); }
            else setRaw(fmt(value));
          }}
          className="w-24 px-2 py-1 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
      </div>
    </div>
  );
}

export default function MaterialPricingSettings() {
  const [config, setConfig] = useState<MaterialPricing>(getPricingConfig);
  const [dirty, setDirty] = useState(false);

  function update(patch: Partial<MaterialPricing>) {
    setConfig(prev => ({ ...prev, ...patch }));
    setDirty(true);
  }

  function handleSave() {
    savePricingConfig(config);
    setDirty(false);
    toast.success('Material prices saved — new estimates will use these rates.');
  }

  function handleReset() {
    setConfig({ ...PRICING_DEFAULTS });
    setDirty(true);
  }

  const activeProduct = ICE_WATER_PRODUCTS.find(p => p.id === config.iceWaterProductId) ?? ICE_WATER_PRODUCTS[1];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Material Pricing</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Default unit rates used when creating estimates from templates.
            {config.lastUpdated && (
              <span className="ml-1 text-gray-400">
                Last updated {new Date(config.lastUpdated).toLocaleDateString()}.
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            title="Reset to defaults"
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Save size={14} /> Save Prices
          </button>
        </div>
      </div>

      {/* Ice & Water — manufacturer selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Package size={16} className="text-blue-600" />
          <h3 className="font-semibold text-gray-900 text-sm">Ice & Water Shield</h3>
        </div>
        <div className="space-y-2 mb-3">
          {ICE_WATER_PRODUCTS.map(p => (
            <label
              key={p.id}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                config.iceWaterProductId === p.id
                  ? 'bg-blue-50 border-blue-300'
                  : 'border-gray-100 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="iceWaterProduct"
                value={p.id}
                checked={config.iceWaterProductId === p.id}
                onChange={() => update({ iceWaterProductId: p.id, iceWaterRate: p.price })}
                className="text-blue-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-500">
                  {p.lengthFt}′ × {p.widthIn}″ roll · {p.sqFtPerRoll} sq ft (~{(p.sqFtPerRoll / 100).toFixed(1)} squares) per roll
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-700">${fmt(p.price)}/roll</span>
            </label>
          ))}
        </div>
        {/* Price override for selected product */}
        <div className="pt-2 border-t border-gray-100">
          <PriceField
            label={`${activeProduct.name} — price per roll`}
            description="Override the default price if your supplier charges differently"
            value={config.iceWaterRate}
            onChange={v => update({ iceWaterRate: v })}
          />
        </div>
      </div>

      {/* Underlayment */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Package size={16} className="text-blue-600" />
          <h3 className="font-semibold text-gray-900 text-sm">Synthetic Underlayment</h3>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Standard roll (e.g. GAF Feltbuster, Atlas Summit Pro) covers ~10 squares.
        </p>
        <PriceField
          label="Price per roll"
          description="1 roll per 10 sq; qty auto-calculated from roof squares"
          value={config.underlaymentRate}
          onChange={v => update({ underlaymentRate: v })}
        />
        <PriceField
          label="Squares per roll"
          description="Adjust if your product covers a different area"
          value={config.underlaymentSqPerRoll}
          onChange={v => update({ underlaymentSqPerRoll: v })}
          prefix=""
          suffix="sq/roll"
        />
      </div>

      {/* Other materials */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign size={16} className="text-blue-600" />
          <h3 className="font-semibold text-gray-900 text-sm">Other Material & Labor Rates</h3>
        </div>
        <PriceField label="Tear-off & disposal" description="Per square" value={config.tearOffRate} onChange={v => update({ tearOffRate: v })} suffix="/sq" />
        <PriceField label="Decking repair" description="Per 4×8 sheet" value={config.deckingRate} onChange={v => update({ deckingRate: v })} suffix="/sheet" />
        <PriceField label="Drip edge (aluminum)" description="Per linear foot" value={config.dripEdgeRate} onChange={v => update({ dripEdgeRate: v })} suffix="/LF" />
        <PriceField label="Shingles (installed)" description="Per square" value={config.shingleRate} onChange={v => update({ shingleRate: v })} suffix="/sq" />
        <PriceField label="Ridge cap shingles" description="Per linear foot" value={config.ridgeCapRate} onChange={v => update({ ridgeCapRate: v })} suffix="/LF" />
        <PriceField label="Flashings kit" description="Step, counter, pipe boots — flat kit price" value={config.flashingKitRate} onChange={v => update({ flashingKitRate: v })} />
        <PriceField label="Ridge vent / ventilation" description="Per unit" value={config.ridgeVentRate} onChange={v => update({ ridgeVentRate: v })} suffix="/unit" />
        <PriceField label="Cleanup & haul-away" description="Flat per job" value={config.cleanupRate} onChange={v => update({ cleanupRate: v })} />
      </div>

      {/* Pricing update tip */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <RefreshCw size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-medium">Keep prices current</p>
          <p className="mt-0.5 text-amber-700">
            Supplier prices change seasonally. Update these rates before starting a busy season — all new estimates will automatically use the latest values. Existing saved estimates are not affected.
          </p>
        </div>
      </div>
    </div>
  );
}

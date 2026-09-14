// Copied from QuoteMGR src/components/PricingPresets.tsx (read-only reference).
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Bookmark, Check, Loader2, RotateCcw, Trash2 } from 'lucide-react';

/**
 * Private, named pricing snapshots.
 *
 * The company price list stays the starting point and the authority: every
 * quote opens on it, and an owner/admin editing it always wins. A preset is
 * one person's own shortcut back to numbers they already dialled in — nobody
 * else on the team can see or apply it, and "Back to company pricing" returns
 * the quote to the list at any time.
 *
 * Deliberately inert: saving changes nothing, applying touches only the quote
 * in front of you, deleting changes nothing else. The price list is never
 * written to from here.
 *
 * Prices are frozen into the preset rather than referenced, so "use the
 * pricing from that quote" keeps meaning the numbers it was saved with even
 * after the catalog moves on.
 */

export interface PresetPriceItem {
  category: string | null;
  item_name: string;
  unit: string | null;
  good_price: number;
  better_price: number;
  best_price: number;
  fixed_price?: boolean | null;
}

export interface PricingPreset {
  id: string;
  name: string;
  items: PresetPriceItem[];
  created_at: string;
}

interface Props {
  companyId: string;
  /** auth.users id — presets are private to this person. */
  userId: string;
  createdByMemberId?: string | null;
  /** Line items currently on the quote — the source for a new snapshot. */
  lineItems: Array<{
    category?: string | null;
    item_name?: string | null;
    unit?: string | null;
    good_price?: number | null;
    better_price?: number | null;
    best_price?: number | null;
    fixed_price?: boolean | null;
    is_divider?: boolean | null;
  }>;
  /** Applies the snapshot to the quote. Matching is by category + item name. */
  onApply: (items: PresetPriceItem[], presetName: string) => number;
  /** Puts the quote back on the company price list. */
  onRevert: () => number;
}

const keyOf = (category: string | null | undefined, itemName: string | null | undefined) =>
  `${(category ?? '').trim().toLowerCase()}::${(itemName ?? '').trim().toLowerCase()}`;

export const matchPresetItems = (
  presetItems: PresetPriceItem[],
): Map<string, PresetPriceItem> => {
  const byKey = new Map<string, PresetPriceItem>();
  for (const item of presetItems) byKey.set(keyOf(item.category, item.item_name), item);
  return byKey;
};

const PricingPresets: React.FC<Props> = ({ companyId, userId, createdByMemberId, lineItems, onApply, onRevert }) => {
  const [presets, setPresets] = useState<PricingPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  // Which preset is currently switched on for this quote. Session-only: the
  // prices themselves live on the quote's line items, so reopening it keeps the
  // numbers either way — this just shows which one is playing.
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('pricing_presets')
      .select('id, name, items, created_at')
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      // A missing table means the migration has not been applied yet. Say so
      // rather than showing an empty picker that looks like lost presets.
      toast.error(
        error.code === 'PGRST205'
          ? 'Saved pricing is not set up on this database yet.'
          : 'Could not load saved pricing',
      );
      return;
    }
    setPresets((data ?? []) as PricingPreset[]);
  }, [companyId, userId]);

  useEffect(() => { void load(); }, [load]);

  const snapshot = (): PresetPriceItem[] =>
    lineItems
      .filter(li => !li.is_divider && (li.item_name ?? '').trim())
      .map(li => ({
        category: li.category ?? null,
        item_name: (li.item_name ?? '').trim(),
        unit: li.unit ?? null,
        good_price: li.good_price ?? 0,
        better_price: li.better_price ?? 0,
        best_price: li.best_price ?? 0,
        fixed_price: li.fixed_price ?? false,
      }));

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error('Give this pricing a name'); return; }
    const items = snapshot();
    if (items.length === 0) { toast.error('This quote has no priced lines to save'); return; }

    setSaving(true);
    const { error } = await supabase.from('pricing_presets').insert({
      company_id: companyId,
      user_id: userId,
      name: trimmed,
      items,
      created_by: createdByMemberId ?? null,
    });
    setSaving(false);

    if (error) {
      toast.error(
        error.code === '23505'
          ? `You already have saved pricing called "${trimmed}"`
          : error.message || 'Could not save this pricing',
      );
      return;
    }
    toast.success(`Saved "${trimmed}" — ${items.length} priced lines`);
    setName('');
    setNaming(false);
    void load();
  };

  const handleApply = (preset: PricingPreset) => {
    const changed = onApply(preset.items ?? [], preset.name);
    if (changed > 0) setActiveId(preset.id);
    toast.success(
      changed > 0
        ? `"${preset.name}" on — ${changed} line${changed === 1 ? '' : 's'} repriced`
        : `Nothing on this quote matched "${preset.name}"`,
    );
  };

  const handleDelete = async (preset: PricingPreset) => {
    if (!confirm(`Delete saved pricing "${preset.name}"?\n\nQuotes already using these numbers keep them — nothing else changes.`)) return;
    const { error } = await supabase.from('pricing_presets').delete().eq('id', preset.id);
    if (error) { toast.error('Could not delete this pricing'); return; }
    // Deleting the preset does not un-apply it; the quote keeps the numbers it
    // already has, exactly as deleting a playlist leaves the song playing.
    if (activeId === preset.id) setActiveId(null);
    toast.success(`Deleted "${preset.name}"`);
    void load();
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-[#1e3a5f]" />
          <h4 className="text-sm font-semibold text-gray-800">Saved pricing</h4>
        </div>
        {!naming && (
          <button
            onClick={() => setNaming(true)}
            className="text-xs font-medium text-[#1e3a5f] hover:underline underline-offset-2"
          >
            Save this quote's pricing
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Your own shortcuts back to numbers you already dialled in — only you can see them.
        Quotes always start on the company price list, and applying a preset changes this quote
        only. The price list itself never moves.
      </p>

      <button
        onClick={() => {
          const restored = onRevert();
          setActiveId(null);
          toast.success(
            restored > 0
              ? `Back to company pricing on ${restored} line${restored === 1 ? '' : 's'}`
              : 'Already on company pricing',
          );
        }}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-[#1e3a5f] border border-gray-200 rounded-lg px-2.5 py-1.5"
      >
        <RotateCcw className="w-3.5 h-3.5" /> Back to company pricing
      </button>

      {naming && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleSave(); if (e.key === 'Escape') { setNaming(false); setName(''); } }}
            placeholder="Name it — e.g. Standard Architectural"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
          />
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-[#1e3a5f] text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </button>
          <button
            onClick={() => { setNaming(false); setName(''); }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : presets.length === 0 ? (
        <p className="text-xs text-gray-400">
          None saved yet. Price a quote the way you want it, then save it here to reuse — it stays private to you.
        </p>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {presets.map(preset => (
            <div
              key={preset.id}
              className={`flex items-center justify-between gap-3 px-3 py-2 ${activeId === preset.id ? 'bg-emerald-50' : ''}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate flex items-center gap-2">
                  {preset.name}
                  {activeId === preset.id && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                      On
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-gray-400">
                  {(preset.items ?? []).length} lines · saved {new Date(preset.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleApply(preset)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border ${
                    activeId === preset.id
                      ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" /> {activeId === preset.id ? 'Re-apply' : 'Use'}
                </button>
                <button
                  onClick={() => void handleDelete(preset)}
                  title="Delete saved pricing"
                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PricingPresets;

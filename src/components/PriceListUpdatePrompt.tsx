import React, { useEffect, useState } from 'react';
import { Package, X, Check, Loader2, ShieldCheck, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { DEFAULT_PRICE_LIST, PRICE_LIST_VERSION } from '@/data/defaultPricing';
import { SHIPPED_PRICE_BASELINES } from '@/data/priceListBaselines';
import type { Company } from '@/data/quoteData';

const priceKey = (g: number, b: number, x: number) => `${g}|${b}|${x}`;

/**
 * A row is safe to correct only if its current price is one this app shipped —
 * meaning it is untouched seed data. Anything else is the company's own number.
 */
const isUntouchedSeedPrice = (itemName: string, row: { good_price: number; better_price: number; best_price: number }) =>
  (SHIPPED_PRICE_BASELINES[itemName] ?? []).includes(priceKey(row.good_price, row.better_price, row.best_price));

const fmt = (n: number) =>
  n % 1 === 0 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`;

/** Single display price — shows one value if all tiers are equal, otherwise G/B/B breakdown. */
const PriceDisplay: React.FC<{ g: number; b: number; x: number; className?: string }> = ({ g, b, x, className = '' }) => {
  if (g === b && b === x) {
    return <span className={className}>{fmt(g)}</span>;
  }
  return (
    <span className={`text-xs ${className}`}>
      G {fmt(g)} · B {fmt(b)} · B {fmt(x)}
    </span>
  );
};

interface ConflictRow {
  /** DB row id */
  id: string;
  item_name: string;
  category: string;
  /** Company's current custom values */
  cur_good: number;
  cur_better: number;
  cur_best: number;
  /** New standard values */
  new_good: number;
  new_better: number;
  new_best: number;
  /** Whether user chose to accept the new price (default: keep theirs) */
  accept: boolean;
}

interface Props {
  company: Company;
  /** Only owners, admins, and managers may change the shared price library. */
  userRole: string;
}

const dismissKey = (companyId: string) =>
  `price_list_update_dismissed_${companyId}_${PRICE_LIST_VERSION}`;

/**
 * Offers to bring this company's library in step with the standard list.
 *
 * Step 1 — summary prompt: shows counts of new items, correctable prices,
 *   and customized prices. The user chooses "Yes, update" or "Not now."
 *
 * Step 2 (only when customized items exist) — review modal: lists each
 *   customized item with the company's current price and the new standard
 *   price side-by-side. The user toggles each one: keep their price or accept
 *   the update. Non-customized items are always updated automatically.
 */
const PriceListUpdatePrompt: React.FC<Props> = ({ company, userRole }) => {
  const [missingCount, setMissingCount] = useState(0);
  const [correctableCount, setCorrectableCount] = useState(0);
  const [protectedCount, setProtectedCount] = useState(0);
  const [targetList, setTargetList] = useState('My Prices');

  /** 'summary' = initial prompt, 'review' = per-item conflict review */
  const [step, setStep] = useState<'summary' | 'review'>('summary');
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  /** Rows where the company has a custom price that differs from the new standard. */
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);

  const canEditPricing = ['owner', 'admin', 'manager'].includes(userRole);

  useEffect(() => {
    if (!company?.id || !canEditPricing) return;
    if (localStorage.getItem(dismissKey(company.id)) === 'true') return;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('company_pricing')
        .select('id, item_name, price_list_name, list_enabled, good_price, better_price, best_price, price_overridden')
        .eq('company_id', company.id);
      if (error || !data || cancelled) return;

      if (data.length === 0) return;

      const existing = new Set(data.map((r: any) => r.item_name));
      const missing = DEFAULT_PRICE_LIST.filter(i => !existing.has(i.item_name));

      const byName = new Map(DEFAULT_PRICE_LIST.map(i => [i.item_name, i]));
      let correctable = 0;
      const customRows: ConflictRow[] = [];

      for (const row of data as any[]) {
        const def = byName.get(row.item_name);
        if (!def) continue;
        const same = priceKey(row.good_price, row.better_price, row.best_price)
          === priceKey(def.good_price, def.better_price, def.best_price);
        if (same) continue;

        const isCustom = row.price_overridden || !isUntouchedSeedPrice(row.item_name, row);
        if (isCustom) {
          customRows.push({
            id: row.id,
            item_name: row.item_name,
            category: row.category ?? '',
            cur_good: row.good_price,
            cur_better: row.better_price,
            cur_best: row.best_price,
            new_good: def.good_price,
            new_better: def.better_price,
            new_best: def.best_price,
            accept: false, // default: keep their price
          });
        } else {
          correctable++;
        }
      }

      if (missing.length === 0 && correctable === 0 && customRows.length === 0) return;

      const counts = new Map<string, number>();
      for (const row of data as any[]) {
        if (row.list_enabled === false) continue;
        const name = row.price_list_name || 'My Prices';
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      const busiest = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

      setTargetList(busiest ?? 'My Prices');
      setMissingCount(missing.length);
      setCorrectableCount(correctable);
      setProtectedCount(customRows.length);
      setConflicts(customRows);
      setOpen(true);
    })();
    return () => { cancelled = true; };
  }, [company?.id, canEditPricing]);

  const dismiss = () => {
    localStorage.setItem(dismissKey(company.id), 'true');
    setOpen(false);
  };

  /** Toggle a single conflict row between keep/accept. */
  const toggleConflict = (id: string) => {
    setConflicts(prev => prev.map(c => c.id === id ? { ...c, accept: !c.accept } : c));
  };

  const acceptAll = () => setConflicts(prev => prev.map(c => ({ ...c, accept: true })));
  const keepAll   = () => setConflicts(prev => prev.map(c => ({ ...c, accept: false })));

  /** Apply updates: auto-update non-custom rows, apply per-choice for custom rows, add missing items. */
  const handleApply = async (chosenConflicts: ConflictRow[]) => {
    setAdding(true);
    try {
      const { data, error: readErr } = await supabase
        .from('company_pricing')
        .select('id, item_name, good_price, better_price, best_price, price_overridden')
        .eq('company_id', company.id);
      if (readErr) throw readErr;

      const existing = new Set((data ?? []).map((r: any) => r.item_name));
      const byName = new Map(DEFAULT_PRICE_LIST.map(i => [i.item_name, i]));
      const conflictMap = new Map(chosenConflicts.map(c => [c.id, c]));

      let corrected = 0;
      let kept = 0;
      let overrideUpdated = 0;

      for (const row of (data ?? []) as any[]) {
        const def = byName.get(row.item_name);
        if (!def) continue;
        if (priceKey(row.good_price, row.better_price, row.best_price)
          === priceKey(def.good_price, def.better_price, def.best_price)) continue;

        const conflict = conflictMap.get(row.id);
        if (conflict) {
          // This is a customized row — respect the user's per-item choice.
          if (conflict.accept) {
            const { error } = await supabase
              .from('company_pricing')
              .update({
                good_price: def.good_price,
                better_price: def.better_price,
                best_price: def.best_price,
                price_overridden: false,
                updated_at: new Date().toISOString(),
              })
              .eq('id', row.id);
            if (error) throw error;
            overrideUpdated++;
          } else {
            kept++;
          }
          continue;
        }

        // Non-custom row: update if it's still at an old seed price.
        if (row.price_overridden || !isUntouchedSeedPrice(row.item_name, row)) { kept++; continue; }
        const { error } = await supabase
          .from('company_pricing')
          .update({
            good_price: def.good_price,
            better_price: def.better_price,
            best_price: def.best_price,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        if (error) throw error;
        corrected++;
      }

      const rows = DEFAULT_PRICE_LIST
        .filter(item => !existing.has(item.item_name))
        .map(item => ({
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
          price_list_name: targetList,
          list_enabled: true,
          price_overridden: false,
          sort_order: 0,
        }));

      const BATCH = 50;
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabase.from('company_pricing').insert(rows.slice(i, i + BATCH));
        if (error) throw error;
      }

      const parts: string[] = [];
      if (rows.length)        parts.push(`${rows.length} new item${rows.length === 1 ? '' : 's'} added`);
      if (corrected)          parts.push(`${corrected} price${corrected === 1 ? '' : 's'} updated`);
      if (overrideUpdated)    parts.push(`${overrideUpdated} customized price${overrideUpdated === 1 ? '' : 's'} updated`);
      if (kept)               parts.push(`${kept} of your price${kept === 1 ? '' : 's'} kept`);
      toast.success(parts.length ? `Price list updated — ${parts.join(', ')}.` : 'Your price list is already up to date.');
      dismiss();
    } catch (err: any) {
      toast.error('Could not update the price list: ' + (err?.message ?? 'unknown error'));
    } finally {
      setAdding(false);
    }
  };

  if (!open) return null;

  /* ─── Step 2: per-item conflict review ─────────────────────────────── */
  if (step === 'review') {
    const acceptCount = conflicts.filter(c => c.accept).length;
    const keepCount   = conflicts.length - acceptCount;

    return (
      <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
        <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-start gap-3 p-5 pb-3 flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-gray-900">Review your customized prices</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {conflicts.length} item{conflicts.length === 1 ? '' : 's'} have prices you set.
                Choose which to update — everything else updates automatically.
              </p>
            </div>
            <button onClick={dismiss} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg" title="Not now">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Bulk controls */}
          <div className="flex items-center gap-2 px-5 pb-2 flex-shrink-0">
            <button
              onClick={acceptAll}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2"
            >
              Update all
            </button>
            <span className="text-gray-300">·</span>
            <button
              onClick={keepAll}
              className="text-xs font-medium text-gray-500 hover:text-gray-700 underline underline-offset-2"
            >
              Keep all mine
            </button>
            <span className="flex-1" />
            <span className="text-xs text-gray-400">
              {acceptCount > 0 ? `${acceptCount} updating` : ''}
              {acceptCount > 0 && keepCount > 0 ? ' · ' : ''}
              {keepCount > 0 ? `${keepCount} keeping` : ''}
            </span>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center px-5 pb-1 flex-shrink-0">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Item</span>
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-right w-16">Your price</span>
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-right w-16">New price</span>
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center w-20">Action</span>
          </div>

          {/* Scrollable list */}
          <div className="overflow-y-auto flex-1 px-5 pb-3 space-y-1">
            {conflicts.map(c => (
              <div
                key={c.id}
                className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center rounded-xl px-3 py-2.5 transition-colors ${
                  c.accept
                    ? 'bg-blue-50 border border-blue-100'
                    : 'bg-gray-50 border border-gray-100'
                }`}
              >
                {/* Name + category */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.item_name}</p>
                  <p className="text-[11px] text-gray-400 truncate">{c.category}</p>
                </div>

                {/* Current (their) price */}
                <div className="text-right w-16">
                  <PriceDisplay
                    g={c.cur_good} b={c.cur_better} x={c.cur_best}
                    className={`text-sm font-semibold ${c.accept ? 'text-gray-400 line-through' : 'text-emerald-700'}`}
                  />
                </div>

                {/* New standard price */}
                <div className="text-right w-16">
                  <PriceDisplay
                    g={c.new_good} b={c.new_better} x={c.new_best}
                    className={`text-sm font-semibold ${c.accept ? 'text-blue-700' : 'text-gray-400'}`}
                  />
                </div>

                {/* Toggle */}
                <div className="flex justify-center w-20">
                  <button
                    onClick={() => toggleConflict(c.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                      c.accept
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {c.accept ? (
                      <><ToggleRight className="w-3.5 h-3.5" /> Update</>
                    ) : (
                      <><ToggleLeft className="w-3.5 h-3.5" /> Keep</>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-5 py-4 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={() => setStep('summary')}
              disabled={adding}
              className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={() => handleApply(conflicts)}
              disabled={adding}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1e3a5f] text-white text-sm font-semibold hover:bg-[#16304e] disabled:opacity-50"
            >
              {adding
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying…</>
                : <><Check className="w-4 h-4" /> Apply changes</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Step 1: summary prompt ────────────────────────────────────────── */
  const handleYesUpdate = () => {
    if (protectedCount > 0) {
      // There are customized items — show the review step first.
      setStep('review');
    } else {
      // Nothing customized — apply immediately.
      handleApply([]);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start gap-3 p-5 pb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900">Update your price list?</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              An updated material list is available for{' '}
              <span className="font-medium text-gray-700">{targetList}</span>.
            </p>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {missingCount > 0 && (
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  {missingCount} new material{missingCount === 1 ? '' : 's'} added
                </li>
              )}
              {correctableCount > 0 && (
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  {correctableCount} price{correctableCount === 1 ? '' : 's'} corrected to the current list
                </li>
              )}
              {protectedCount > 0 && (
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  {protectedCount} price{protectedCount === 1 ? '' : 's'} you customized — <span className="font-medium text-amber-700">you'll choose</span>
                </li>
              )}
            </ul>
          </div>
          <button onClick={dismiss} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg" title="Not now">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mx-5 mb-4 rounded-xl bg-emerald-50 border border-emerald-100 p-3 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-800 leading-relaxed">
            <span className="font-semibold">Your customized prices are protected.</span>{' '}
            {protectedCount > 0
              ? <>Items you've set a custom price on will be shown one by one — you decide each one individually.</>
              : <>Only items still at the original seeded price get updated. Anything you edited stays exactly as you left it.</>}
          </p>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={dismiss}
            disabled={adding}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Not now
          </button>
          <button
            onClick={handleYesUpdate}
            disabled={adding}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1e3a5f] text-white text-sm font-semibold hover:bg-[#16304e] disabled:opacity-50"
          >
            {adding
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
              : protectedCount > 0
                ? <><ChevronRight className="w-4 h-4" /> Review & update</>
                : <><Check className="w-4 h-4" /> Yes, update</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PriceListUpdatePrompt;

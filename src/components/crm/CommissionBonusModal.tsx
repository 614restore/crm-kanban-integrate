import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/crmData';

/**
 * Commission bonuses (contests and one-off adjustments). A bonus is a line on a job: a flat dollar amount, or extra
 * percentage points of the project total, with a reason ("June contest"). The bonuses on a job are added to its
 * commission under either method. A negative value takes commission off (a correction). Open it for one job to
 * see and remove that job's bonuses, or for all of a salesperson's listed jobs to give them the same bonus at once.
 * The database enforces who may do this and locks the bonuses once a job's commission is paid.
 */

export interface BonusJob {
  id: string;
  name: string;
  projectValue: number;
  /** Job costs entered so far, so a % of job profit can be previewed. */
  costsTotal: number;
}

interface Props {
  who: string;
  jobs: BonusJob[];
  onClose: () => void;
  onSaved: () => void;
}

interface Line {
  id: string;
  kind: 'flat' | 'percent' | 'percent_profit';
  value: number;
  reason: string | null;
}

export default function CommissionBonusModal({ who, jobs, onClose, onSaved }: Props) {
  const single = jobs.length === 1 ? jobs[0] : null;
  const [kind, setKind] = useState<'percent' | 'percent_profit' | 'flat'>('percent');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);

  const loadLines = useCallback(async () => {
    if (!single) return;
    const { data } = await supabase
      .from('commission_adjustments')
      .select('id, kind, value, reason')
      .eq('customer_id', single.id)
      .order('created_at');
    setLines((data ?? []) as Line[]);
  }, [single]);

  useEffect(() => {
    loadLines();
  }, [loadLines]);

  const n = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(n) && n !== 0 && (kind === 'flat' || Math.abs(n) <= 100);
  const amountFor = (k: string, v: number, j: BonusJob) =>
    k === 'percent' ? (j.projectValue * v) / 100 : k === 'percent_profit' ? (Math.max(j.projectValue - j.costsTotal, 0) * v) / 100 : v;
  const perJob = (j: BonusJob) => amountFor(kind, n, j);

  const add = async () => {
    if (!valid) {
      toast.error(kind === 'flat' ? 'Enter a dollar amount.' : 'Enter a percentage between -100 and 100.');
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from('commission_adjustments')
      .insert(jobs.map((j) => ({ customer_id: j.id, kind, value: n, reason: reason.trim() || null })));
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Bonus added to ${jobs.length} job${jobs.length === 1 ? '' : 's'}`);
    onSaved();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('commission_adjustments').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Bonus removed');
    onSaved();
  };

  const input = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {single ? `Bonus: ${single.name}` : `Bonus for ${who}'s ${jobs.length} jobs`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          {single && lines.length > 0 && (
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {lines.map((l) => (
                <div key={l.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-gray-800">
                      {l.kind === 'percent'
                        ? `${l.value > 0 ? '+' : ''}${l.value}% of project total`
                        : l.kind === 'percent_profit'
                        ? `${l.value > 0 ? '+' : ''}${l.value}% of job profit`
                        : `${l.value > 0 ? '+' : ''}${formatCurrency(Number(l.value))}`}
                      <span className="ml-2 text-gray-500">= {formatCurrency(amountFor(l.kind, Number(l.value), single))}</span>
                    </p>
                    {l.reason && <p className="text-xs text-gray-500">{l.reason}</p>}
                  </div>
                  <button onClick={() => remove(l.id)} className="text-gray-400 hover:text-red-600" title="Remove this bonus">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setKind('percent')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${kind === 'percent' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
            >
              Extra % of project total
            </button>
            <button
              onClick={() => setKind('percent_profit')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${kind === 'percent_profit' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
            >
              Extra % of job profit
            </button>
            <button
              onClick={() => setKind('flat')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${kind === 'flat' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
            >
              Flat amount ($)
            </button>
          </div>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            placeholder={kind === 'flat' ? 'Dollar amount, e.g. 250' : 'Extra percent, e.g. 1'}
            className={`${input} w-full`}
          />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (e.g. June contest)" className={`${input} w-full`} />
          {valid && (
            <p className="text-xs text-gray-500">
              {single
                ? `Adds ${formatCurrency(perJob(single))} to this job's commission.`
                : `Adds to each of ${jobs.length} jobs, ${formatCurrency(jobs.reduce((s, j) => s + perJob(j), 0))} in total.`}{' '}
              A negative number takes commission off.
            </p>
          )}
          {kind === 'percent_profit' && (
            <p className="text-xs text-gray-400">Job profit is the project total minus the job costs entered for it. It is an estimate until the costs are marked complete.</p>
          )}
          <p className="text-xs text-gray-400">Bonuses lock once the job&apos;s commission is marked paid. Take it back to Owed to change them.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
            Close
          </button>
          <button
            onClick={add}
            disabled={busy || !valid}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Add bonus
          </button>
        </div>
      </div>
    </div>
  );
}

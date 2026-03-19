code src/components/crm/OwnerPriorityBoard.tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface PriorityRow {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  project_value: number | null;
  assigned_to: string | null;
  updated_at: string;
  company_id: string;
  days_stale: number;
  alert_type: string;
  threshold_days: number;
  priority_score: number;
  concern: 'sales' | 'payment';
}

const borderColor = (row: PriorityRow) => {
  if (row.concern === 'payment') return 'border-l-4 border-red-500';
  if (row.status === 'estimate_viewed') return 'border-l-4 border-green-500';
  return 'border-l-4 border-amber-400';
};

const badgeLabel = (row: PriorityRow) => {
  if (row.concern === 'payment') return { label: 'OVERDUE', color: 'bg-red-100 text-red-700' };
  if (row.status === 'estimate_viewed') return { label: 'CALL NOW', color: 'bg-green-100 text-green-700 animate-pulse' };
  if (row.status === 'estimate_sent') return { label: 'STALE ESTIMATE', color: 'bg-amber-100 text-amber-700' };
  return { label: 'NO TOUCH', color: 'bg-amber-100 text-amber-700' };
};

const recommendedAction = (row: PriorityRow) => {
  if (row.concern === 'payment') return 'Send payment reminder';
  if (row.status === 'estimate_viewed') return 'Call now — they just looked';
  if (row.status === 'estimate_sent') return 'Follow up on estimate';
  return 'Make first contact';
};

export default function OwnerPriorityBoard() {
  const [rows, setRows] = useState<PriorityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [nudging, setNudging] = useState<string | null>(null);

  useEffect(() => {
    fetchPriority();
  }, []);

  async function fetchPriority() {
    setLoading(true);
    const { data, error } = await supabase
      .from('v_owner_priority')
      .select('*')
      .order('priority_score', { ascending: false });
    if (!error && data) setRows(data as PriorityRow[]);
    setLoading(false);
  }

  async function handleNudge(row: PriorityRow) {
    setNudging(row.id);
    // Placeholder — wire to Resend edge function when ready
    await new Promise(r => setTimeout(r, 800));
    alert(`Nudge sent to ${row.first_name} ${row.last_name}`);
    setNudging(null);
  }

  async function handleMoveStage(row: PriorityRow, newStatus: string) {
    await supabase
      .from('contacts')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    fetchPriority();
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-gray-400">
      Loading priority feed...
    </div>
  );

  if (rows.length === 0) return (
    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
      <span className="text-2xl mb-2">✅</span>
      <span>No stale jobs — pipeline is clean!</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-gray-800">
          Needs Attention <span className="ml-2 text-sm font-normal text-gray-400">{rows.length} item{rows.length !== 1 ? 's' : ''}</span>
        </h2>
        <button onClick={fetchPriority} className="text-xs text-blue-500 hover:underline">Refresh</button>
      </div>

      {rows.map(row => {
        const badge = badgeLabel(row);
        return (
          <div
            key={row.id}
            className={`bg-white rounded-lg shadow-sm p-4 flex flex-col gap-2 ${borderColor(row)}`}
          >
            {/* Top row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800">
                  {row.first_name} {row.last_name}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge.color}`}>
                  {badge.label}
                </span>
              </div>
              <span className="text-xs text-gray-400">Score: {row.priority_score}</span>
            </div>

            {/* Details row */}
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>
                💰 {row.project_value
                  ? `$${row.project_value.toLocaleString()}`
                  : <span className="text-amber-500">No value set</span>}
              </span>
              <span>🕐 {row.days_stale} day{row.days_stale !== 1 ? 's' : ''} stale</span>
              <span>👤 {row.assigned_to ?? <span className="text-red-400">Unassigned</span>}</span>
            </div>

            {/* Recommended action */}
            <div className="text-xs text-blue-600 font-medium">
              → {recommendedAction(row)}
            </div>

            {/* Actions row */}
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => handleNudge(row)}
                disabled={nudging === row.id}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {nudging === row.id ? 'Sending...' : '📨 Nudge'}
              </button>

              <select
                className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-600"
                defaultValue=""
                onChange={e => { if (e.target.value) handleMoveStage(row, e.target.value); }}
              >
                <option value="" disabled>Move Stage →</option>
                <option value="contacted">Contacted</option>
                <option value="estimate_sent">Estimate Sent</option>
                <option value="estimate_viewed">Estimate Viewed</option>
                <option value="signed">Signed</option>
                <option value="invoice_sent">Invoice Sent</option>
                <option value="complete">Complete</option>
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
}

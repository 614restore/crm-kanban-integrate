import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface PriorityRow {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  project_value: number | null;
  assigned_to: string | null;
  assigned_to_id: string | null;
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

  useEffect(() => { fetchPriority(); }, []);

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
    try {
      // Get current user info
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('You must be logged in to send a nudge');
        return;
      }

      // Get current user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) {
        alert('Unable to determine your company');
        return;
      }

      const nudgedByName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || user.email || 'Owner';

      // If contact is assigned, send nudge to assigned user
      if (row.assigned_to_id) {
        // Create notification for assigned user
        await supabase.from('notifications').insert({
          company_id: profile.company_id,
          user_id: row.assigned_to_id,
          type: 'info',
          title: `Reminder: Follow up with ${row.first_name} ${row.last_name}`,
          message: `${nudgedByName} is checking in: This contact has been stale for ${row.days_stale} days. Please schedule an appointment or update their status.`,
          related_id: row.id,
          related_type: 'contact',
          read: false,
        });

        // Log the nudge in communications
        await supabase.from('communications').insert({
          company_id: profile.company_id,
          contact_id: row.id,
          type: 'note',
          direction: 'internal',
          subject: 'Follow-up Reminder',
          content: `${nudgedByName} sent a reminder to ${row.assigned_to} to follow up with this contact.`,
          user_id: user.id,
        });

        alert(`✅ Nudge sent to ${row.assigned_to}!`);
      } else {
        // Contact is unassigned - notify all owners/admins
        const { data: owners } = await supabase
          .from('profiles')
          .select('id')
          .eq('company_id', profile.company_id)
          .in('role', ['owner', 'admin']);

        if (owners && owners.length > 0) {
          const notifications = owners.map(owner => ({
            company_id: profile.company_id,
            user_id: owner.id,
            type: 'warning',
            title: `Unassigned Stale Lead: ${row.first_name} ${row.last_name}`,
            message: `This contact has been stale for ${row.days_stale} days and is not assigned to anyone. Please assign and follow up.`,
            related_id: row.id,
            related_type: 'contact',
            read: false,
          }));

          await supabase.from('notifications').insert(notifications);
          alert(`✅ Nudge sent to ${owners.length} owner(s)/admin(s)!`);
        } else {
          alert('⚠️ No owners found to notify');
        }
      }
    } catch (error) {
      console.error('Error sending nudge:', error);
      alert('❌ Failed to send nudge. Please try again.');
    } finally {
      setNudging(null);
    }
  }

  async function handleMoveStage(row: PriorityRow, newStatus: string) {
    await supabase
      .from('contacts')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    fetchPriority();
  }

  if (loading) return <div className="flex items-center justify-center h-40 text-gray-400">Loading priority feed...</div>;

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
          <div key={row.id} className={`bg-white rounded-lg shadow-sm p-4 flex flex-col gap-2 ${borderColor(row)}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800">{row.first_name} {row.last_name}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
              </div>
              <span className="text-xs text-gray-400">Score: {row.priority_score}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>💰 {row.project_value ? `$${row.project_value.toLocaleString()}` : <span className="text-amber-500">No value set</span>}</span>
              <span>🕐 {row.days_stale} day{row.days_stale !== 1 ? 's' : ''} stale</span>
              <span>👤 {row.assigned_to ?? <span className="text-red-400">Unassigned</span>}</span>
            </div>
            <div className="text-sm text-gray-600 italic">{recommendedAction(row)}</div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleNudge(row)}
                disabled={nudging === row.id}
                className="px-3 py-1 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {nudging === row.id ? 'Sending...' : 'Nudge'}
              </button>
              {row.status === 'estimate_sent' && (
                <button
                  onClick={() => handleMoveStage(row, 'estimate_viewed')}
                  className="px-3 py-1 text-xs font-medium bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Mark Viewed
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
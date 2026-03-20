import React, { useState } from 'react';
import { Check, X, Minus, ChevronDown } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Cell = 'Y' | 'N' | string; // 'Y' = full, 'N' = no, string = partial/note

// ─── Column order (TrussCTR always first) ────────────────────────────────────
const COLS = ['TrussCTR', 'JobNimbus', 'AccuLynx', 'Roofr', 'Jobber', 'ServiceTitan'];

// ─── Pricing cards ───────────────────────────────────────────────────────────
const PRICING = [
  {
    name: 'TrussCTR',
    highlight: true,
    tag: '★ Best Value',
    plans: [
      { label: 'Starter (2 users)', price: '$29/mo' },
      { label: 'Pro (5 users)',     price: '$59/mo' },
      { label: 'Business (10)',     price: '$99/mo' },
      { label: 'Enterprise (∞)',   price: '$179/mo' },
    ],
    note: 'Flat rate — all users included',
    noteColor: '#86efac',
  },
  {
    name: 'JobNimbus',
    plans: [
      { label: 'Starter (1)',   price: '$25/mo' },
      { label: 'Pro (3)',       price: '$89/mo' },
      { label: '5 users',       price: '~$150/mo' },
      { label: 'Unlimited',     price: '$350+/mo' },
    ],
    note: '+$25–$35 per extra user',
    noteColor: '#fca5a5',
  },
  {
    name: 'AccuLynx',
    plans: [
      { label: 'Solo (1)',      price: '~$89/mo' },
      { label: '5 users',       price: '~$199/mo' },
      { label: '15 users',      price: '~$399/mo' },
      { label: 'Enterprise',    price: 'Custom' },
    ],
    note: '+~$30 per extra user',
    noteColor: '#fca5a5',
  },
  {
    name: 'Roofr',
    plans: [
      { label: 'Starter (1)',   price: '$89/mo' },
      { label: 'Pro (3)',        price: '$159/mo' },
      { label: 'Business (10)', price: '$299/mo' },
      { label: 'Enterprise',    price: 'Custom' },
    ],
    note: '+$30–$50 per extra user',
    noteColor: '#fca5a5',
  },
  {
    name: 'Jobber',
    plans: [
      { label: 'Core (1)',         price: '$49/mo' },
      { label: 'Connect (5)',      price: '$129/mo' },
      { label: 'Grow (unlimited)', price: '$249/mo' },
      { label: 'Enterprise',       price: 'Custom' },
    ],
    note: '+$29 per extra user (Core)',
    noteColor: '#fca5a5',
  },
  {
    name: 'ServiceTitan',
    plans: [
      { label: 'Essentials', price: '~$500/mo' },
      { label: 'The Works',  price: '~$800/mo' },
      { label: 'Enterprise', price: '$1,200+/mo' },
      { label: 'Starter',    price: 'N/A' },
    ],
    note: 'Min ~$500/mo — no starter plan',
    noteColor: '#fca5a5',
  },
];

// ─── Feature sections ─────────────────────────────────────────────────────────
//  Y = full ✔  |  N = not available ✘  |  string = partial / note
const SECTIONS = [
  {
    id: 'pricing',
    label: '💰 Pricing & Access',
    defaultOpen: true,
    rows: [
      { f: 'Starting monthly price',           v: ['$29–$179 flat', '$25+/user', '$89+/user', '$89+/mo', '$49+/user', '$500+/mo'] },
      { f: 'Flat rate — no per-user fees',     v: ['Y', 'N', 'N', 'N', 'N', 'N'] },
      { f: '14-day free trial',                v: ['Y', 'Y', 'Demo only', 'Y', 'Y', 'Demo only'] },
      { f: 'Built for roofing & restoration',  v: ['Y', 'Y', 'Y', 'Y', 'Partial', 'Partial'] },
    ],
  },
  {
    id: 'crm',
    label: '🏗️ CRM & Pipeline Management',
    defaultOpen: true,
    rows: [
      { f: 'Full CRM (contacts, leads, customers)',  v: ['Y', 'Y', 'Y', 'Y', 'Y', 'Y'] },
      { f: 'Kanban pipeline board',                  v: ['Y', 'Y', 'Y', 'Limited', 'Y', 'Y'] },
      { f: 'Lead source tracking',                   v: ['Y', 'Y', 'Y', 'Y', 'Limited', 'Y'] },
      { f: 'Full contact history (jobs, docs, comms)', v: ['Y', 'Y', 'Y', 'Limited', 'Y', 'Y'] },
      { f: 'Stale lead detection & AI scoring',      v: ['Y', 'N', 'N', 'N', 'N', 'N'] },
    ],
  },
  {
    id: 'insurance',
    label: '📋 Insurance & Claims',
    defaultOpen: true,
    rows: [
      { f: 'Insurance claim tracking per customer', v: ['Y', 'Add-on', 'Y', 'N', 'N', 'Limited'] },
      { f: 'Supplement tracking',                   v: ['Y', 'Limited', 'Y', 'N', 'N', 'N'] },
      { f: 'Claims linked to contacts & jobs',      v: ['Y', 'Limited', 'Partial', 'N', 'N', 'Partial'] },
      { f: 'Adjuster & insurance contact mgmt',     v: ['Y', 'Limited', 'Y', 'N', 'N', 'Partial'] },
    ],
  },
  {
    id: 'projects',
    label: '🔨 Work Orders & Projects',
    defaultOpen: false,
    rows: [
      { f: 'Work orders (multi-trade support)',         v: ['Y', 'Y', 'Y', 'Limited', 'Y', 'Y'] },
      { f: '17 job types (roofing, exterior, interior)', v: ['Y', 'N', 'Limited', 'N', 'N', 'Limited'] },
      { f: 'Change orders (AWO) built-in',              v: ['Y', 'N', 'Y', 'N', 'N', 'Y'] },
      { f: 'Subcontractor assignment & cost tracking',  v: ['Y', 'Limited', 'Limited', 'N', 'Y', 'Y'] },
      { f: 'Permit tracking',                           v: ['Y', 'N', 'Limited', 'N', 'N', 'Y'] },
      { f: 'Equipment & asset tracking',                v: ['Y', 'Limited', 'Limited', 'N', 'Y', 'Y'] },
    ],
  },
  {
    id: 'docs',
    label: '📄 Documents & Signatures',
    defaultOpen: false,
    rows: [
      { f: 'Estimate builder',                       v: ['Y', 'Y', 'Y', 'Y', 'Y', 'Y'] },
      { f: 'Digital signature capture',              v: ['Y', 'Y', 'Y', 'Y', 'Add-on', 'Y'] },
      { f: 'Contract template w/ signature blocks',  v: ['Y', 'Y', 'Y', 'Y', 'Limited', 'Y'] },
      { f: '3-Day FTC right-to-cancel notice',       v: ['Y', 'N', 'Limited', 'N', 'N', 'N'] },
      { f: 'Change order template',                  v: ['Y', 'N', 'Limited', 'N', 'N', 'Y'] },
      { f: 'Certificate of completion template',     v: ['Y', 'Limited', 'Limited', 'N', 'N', 'Y'] },
      { f: 'Per-customer document editing',          v: ['Y', 'Limited', 'Limited', 'Limited', 'N', 'Y'] },
    ],
  },
  {
    id: 'scheduling',
    label: '📅 Scheduling & Calendar',
    defaultOpen: false,
    rows: [
      { f: 'Appointment / inspection scheduling', v: ['Y', 'Y', 'Y', 'Limited', 'Y', 'Y'] },
      { f: 'Crew schedule management',            v: ['Y', 'Y', 'Y', 'N', 'Y', 'Y'] },
      { f: 'Month / week / day calendar view',    v: ['Y', 'Y', 'Y', 'Limited', 'Y', 'Y'] },
    ],
  },
  {
    id: 'financials',
    label: '💵 Estimates, Invoices & Financials',
    defaultOpen: false,
    rows: [
      { f: 'Invoice generation',                     v: ['Y', 'Y', 'Y', 'Y', 'Y', 'Y'] },
      { f: 'Expense tracking (13 categories)',        v: ['Y', 'Limited', 'Limited', 'N', 'Y', 'Y'] },
      { f: 'Labor vs sub cost breakdown',            v: ['Y', 'N', 'Limited', 'N', 'Limited', 'Y'] },
      { f: 'Profit margin calculations',             v: ['Y', 'Limited', 'Y', 'N', 'Y', 'Y'] },
      { f: 'Financial dashboard & analytics',        v: ['Y', 'Limited', 'Y', 'Limited', 'Y', 'Y'] },
      { f: 'QuickBooks integration',                 v: ['Y', 'Y', 'Y', 'Limited', 'Y', 'Y'] },
      { f: 'Material orders w/ roof templates',      v: ['Y', 'Limited', 'Y', 'Limited', 'N', 'Limited'] },
      { f: 'Supplier management (8 pre-loaded)',     v: ['Y', 'Limited', 'Limited', 'N', 'Limited', 'Y'] },
      { f: 'Excel / PDF export (35+ columns)',       v: ['Y', 'Limited', 'Limited', 'Limited', 'Limited', 'Y'] },
    ],
  },
  {
    id: 'team',
    label: '👥 Team Management & Reporting',
    defaultOpen: false,
    rows: [
      { f: 'Role-based permissions',           v: ['Y', 'Y', 'Y', 'Limited', 'Y', 'Y'] },
      { f: 'Individual sales rep metrics',     v: ['Y', 'Y', 'Y', 'N', 'Limited', 'Y'] },
      { f: 'Team performance dashboard',       v: ['Y', 'Y', 'Y', 'N', 'Limited', 'Y'] },
      { f: 'Company goal tracking',            v: ['Y', 'N', 'N', 'N', 'N', 'Limited'] },
      { f: 'Activity & audit logs',            v: ['Y', 'Limited', 'Limited', 'N', 'Limited', 'Y'] },
    ],
  },
  {
    id: 'comms',
    label: '💬 Communication & Automation',
    defaultOpen: false,
    rows: [
      { f: 'Communication hub (SMS, email, notes)', v: ['Y', 'Y', 'Y', 'Email only', 'Y', 'Y'] },
      { f: 'Automated follow-up workflows',          v: ['Y', 'Y', 'Y', 'Limited', 'Y', 'Y'] },
      { f: 'Professional email templates (8)',       v: ['Y', 'Y', 'Y', 'Limited', 'Y', 'Y'] },
      { f: 'Google review request (1-click)',        v: ['Y', 'Add-on', 'N', 'N', 'Add-on', 'N'] },
      { f: 'Customer satisfaction surveys',          v: ['Y', 'Add-on', 'N', 'N', 'Add-on', 'N'] },
    ],
  },
  {
    id: 'tech',
    label: '⚡ Technology & Integrations',
    defaultOpen: false,
    rows: [
      { f: 'Built-in AI assistant',            v: ['Y', 'Limited', 'N', 'N', 'N', 'Limited'] },
      { f: 'Mobile app / PWA (offline ready)', v: ['Y', 'Y', 'Y', 'Y', 'Y', 'Y'] },
      { f: 'Job-site photo capture',           v: ['Y', 'Y', 'Y', 'Y', 'Y', 'Y'] },
      { f: 'Offline data access',              v: ['Y', 'Limited', 'N', 'N', 'Limited', 'N'] },
      { f: 'EagleView aerial integration',     v: ['Y', 'Y', 'Limited', 'Y', 'N', 'Limited'] },
      { f: 'Row-level data security (RLS)',    v: ['Y', 'Limited', 'Limited', 'Limited', 'Limited', 'Y'] },
      { f: 'Multi-company / white label',      v: ['Y', 'N', 'N', 'N', 'N', 'Enterprise'] },
    ],
  },
];

// ─── "Why TrussCTR Wins" summary cards ───────────────────────────────────────
const WIN_CARDS = [
  { stat: 'Flat Rate',    desc: 'No per-user fees — competitors charge $25–$79 per seat' },
  { stat: '$29–$179',     desc: 'vs $500–$1,200+/mo for ServiceTitan at comparable team size' },
  { stat: 'Insurance',   desc: 'Built-in claim & supplement tracking — most competitors don\'t offer this' },
  { stat: 'All Features', desc: 'Every feature on every plan — no artificial feature-gating by tier' },
];

// ─── Cell renderer ────────────────────────────────────────────────────────────
function Cell({ val, isYou }: { val: Cell; isYou: boolean }) {
  if (val === 'Y') return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${isYou ? 'bg-amber-500/20' : 'bg-emerald-500/10'}`}>
      <Check className={`w-3.5 h-3.5 ${isYou ? 'text-amber-400' : 'text-emerald-400'}`} strokeWidth={3} />
    </span>
  );
  if (val === 'N') return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/10">
      <X className="w-3.5 h-3.5 text-red-400" strokeWidth={2.5} />
    </span>
  );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.68rem] font-semibold bg-slate-700/60 text-amber-300 leading-tight whitespace-nowrap">
      {val}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
const PlanComparisonChart: React.FC = () => {
  const [open, setOpen] = useState<Set<string>>(
    new Set(SECTIONS.filter(s => s.defaultOpen).map(s => s.id))
  );

  const toggle = (id: string) =>
    setOpen(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = (expand: boolean) =>
    setOpen(expand ? new Set(SECTIONS.map(s => s.id)) : new Set());

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#0b1120', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* ── Header ── */}
      <div className="px-6 pt-8 pb-6 text-center" style={{ background: 'linear-gradient(160deg, #0f1e3a 0%, #0b1120 100%)' }}>
        <div className="inline-flex items-center gap-2 mb-3">
          <img src="/trussctr-logo-shield.png" alt="TrussCTR" className="w-8 h-8 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <h2 className="text-2xl font-black tracking-tight" style={{ background: 'linear-gradient(90deg, #93c5fd, #c4a35a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            TrussCTR vs The Competition
          </h2>
          <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full text-slate-300" style={{ background: '#1e3a5f', border: '1px solid #2d5a8e' }}>2026</span>
        </div>
        <p className="text-sm" style={{ color: '#94a3b8' }}>Built exclusively for roofing &amp; restoration contractors — how do we stack up?</p>
      </div>

      <div className="px-4 pb-8 space-y-5">

        {/* ── Pricing cards ── */}
        <div>
          <p className="text-center text-[0.72rem] font-bold uppercase tracking-widest mb-3" style={{ color: '#64748b' }}>
            💰 Real-World Monthly Cost — 5-Person Team
          </p>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            {PRICING.map(card => (
              <div
                key={card.name}
                className="relative rounded-xl p-3 text-center"
                style={{
                  background: card.highlight ? 'linear-gradient(145deg, #0f2244, #111827)' : '#111827',
                  border: card.highlight ? '1px solid #c4a35a' : '1px solid #1e293b',
                  boxShadow: card.highlight ? '0 0 20px #c4a35a22' : undefined,
                }}
              >
                {card.tag && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[0.58rem] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full whitespace-nowrap"
                    style={{ background: 'linear-gradient(90deg, #c4a35a, #e8c87a)', color: '#0b1120' }}>
                    {card.tag}
                  </div>
                )}
                <div className="text-[0.8rem] font-bold mb-2 mt-1" style={{ color: card.highlight ? '#c4a35a' : '#94a3b8' }}>
                  {card.name}
                </div>
                <div className="space-y-1">
                  {card.plans.map(p => (
                    <div key={p.label} className="flex justify-between items-center rounded px-1.5 py-1 gap-1"
                      style={{ background: card.highlight ? '#0a1628' : '#0b1120' }}>
                      <span className="text-[0.65rem]" style={{ color: '#64748b' }}>{p.label}</span>
                      <span className="text-[0.65rem] font-bold" style={{ color: card.highlight ? '#86efac' : '#f87171' }}>{p.price}</span>
                    </div>
                  ))}
                </div>
                {card.note && (
                  <div className="mt-1.5 text-[0.62rem] font-semibold" style={{ color: card.noteColor }}>
                    {card.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Expand/collapse controls ── */}
        <div className="flex justify-center gap-2 flex-wrap">
          {[true, false].map(expand => (
            <button
              key={String(expand)}
              onClick={() => toggleAll(expand)}
              className="text-[0.75rem] font-semibold px-4 py-1.5 rounded-lg transition-colors"
              style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}
              onMouseOver={e => { (e.currentTarget).style.background = '#334155'; (e.currentTarget).style.color = '#e2e8f0'; }}
              onMouseOut={e => { (e.currentTarget).style.background = '#1e293b'; (e.currentTarget).style.color = '#94a3b8'; }}
            >
              {expand ? '▼ Expand All' : '▲ Collapse All'}
            </button>
          ))}
        </div>

        {/* ── Feature sections ── */}
        <div className="space-y-2">
          {SECTIONS.map(sec => {
            const isOpen = open.has(sec.id);
            return (
              <div key={sec.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e293b' }}>
                {/* Section header */}
                <button
                  onClick={() => toggle(sec.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                  style={{ background: '#111827' }}
                  onMouseOver={e => { (e.currentTarget).style.background = '#1a2744'; }}
                  onMouseOut={e => { (e.currentTarget).style.background = '#111827'; }}
                >
                  <span className="text-[0.82rem] font-bold tracking-wide" style={{ color: '#e2e8f0' }}>{sec.label}</span>
                  <ChevronDown
                    className="w-4 h-4 transition-transform duration-200 flex-shrink-0"
                    style={{ color: '#64748b', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </button>

                {/* Feature table */}
                {isOpen && (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse" style={{ minWidth: 700 }}>
                      <thead>
                        <tr style={{ background: '#0b1120', borderBottom: '1px solid #1e293b' }}>
                          <th className="text-left px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-wider" style={{ color: '#475569', minWidth: 220 }}>
                            Feature
                          </th>
                          {COLS.map((col, ci) => (
                            <th
                              key={col}
                              className="text-center px-3 py-2.5 text-[0.68rem] font-bold uppercase tracking-wider whitespace-nowrap"
                              style={{
                                color: ci === 0 ? '#c4a35a' : '#475569',
                                background: ci === 0 ? '#0f1e3a' : undefined,
                              }}
                            >
                              {col}
                              {ci === 0 && (
                                <span className="ml-1.5 text-[0.58rem] font-black px-1.5 py-0.5 rounded-full uppercase"
                                  style={{ background: '#c4a35a', color: '#0b1120' }}>
                                  You
                                </span>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sec.rows.map((row, ri) => (
                          <tr
                            key={ri}
                            style={{ borderBottom: '1px solid #1e293b' }}
                            onMouseOver={e => { (e.currentTarget).style.background = '#0f172a'; }}
                            onMouseOut={e => { (e.currentTarget).style.background = ''; }}
                          >
                            <td className="px-4 py-2.5 text-[0.78rem] font-medium" style={{ color: '#cbd5e1' }}>
                              {row.f}
                            </td>
                            {row.v.map((val, vi) => (
                              <td
                                key={vi}
                                className="px-3 py-2.5 text-center align-middle"
                                style={{ background: vi === 0 ? '#0f1e3a' : undefined }}
                              >
                                <Cell val={val} isYou={vi === 0} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Why TrussCTR Wins ── */}
        <div className="rounded-xl p-5" style={{ background: 'linear-gradient(135deg, #0f2244, #0b1120)', border: '1px solid #c4a35a33' }}>
          <h3 className="text-[0.9rem] font-bold mb-4" style={{ color: '#c4a35a' }}>💡 Why TrussCTR Wins</h3>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            {WIN_CARDS.map(c => (
              <div key={c.stat} className="rounded-lg p-3" style={{ background: '#111827', border: '1px solid #1e293b' }}>
                <div className="text-base font-black mb-1" style={{ color: '#c4a35a' }}>{c.stat}</div>
                <div className="text-[0.72rem] leading-relaxed" style={{ color: '#64748b' }}>{c.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Legend & footer ── */}
        <div className="text-center space-y-1.5">
          <div className="flex items-center justify-center gap-5 text-[0.72rem]" style={{ color: '#475569' }}>
            <span className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-400" strokeWidth={3} /> Included
            </span>
            <span className="flex items-center gap-1.5">
              <X className="w-3 h-3 text-red-400" /> Not available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-amber-300 font-semibold">Label</span> = Limited / Add-on
            </span>
          </div>
          <p className="text-[0.68rem]" style={{ color: '#334155' }}>
            © 2026 TrussCTR by 614 Restore LLC &nbsp;·&nbsp;
            Competitor pricing based on publicly available data as of March 2026. Subject to change.
          </p>
        </div>

      </div>
    </div>
  );
};

export default PlanComparisonChart;

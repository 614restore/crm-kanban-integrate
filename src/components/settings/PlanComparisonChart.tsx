import React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type CellVal = 'Y' | 'N' | '~';

// ─── Competitors ──────────────────────────────────────────────────────────────
const COLS = ['TrussCTR', 'JobNimbus', 'AccuLynx', 'Roofr', 'ServiceTitan'];

// ─── Feature rows ─────────────────────────────────────────────────────────────
// Y = Included  |  ~ = Partial/Add-on  |  N = Not Available
// highlight = true → row gets special callout styling
const ROWS: { label: string; v: CellVal[]; highlight?: boolean; badge?: string }[] = [
  { label: 'Contact CRM',            v: ['Y', 'Y', 'Y', '~', 'Y'] },
  { label: 'Pipeline / Kanban',      v: ['Y', 'Y', 'Y', 'N', 'Y'] },
  { label: 'Estimates & E-Sign',     v: ['Y', 'Y', 'Y', 'Y', 'Y'] },
  { label: 'Invoicing',              v: ['Y', 'Y', 'Y', 'Y', 'Y'] },
  {
    label: '📱 Full Mobile App',
    v: ['Y', '~', '~', 'N', '~'],
    highlight: true,
    badge: 'NOW LIVE',
  },
  { label: 'Mobile App — Free',      v: ['Y', 'N', 'N', 'Y', 'N'], highlight: true },
  { label: 'Project Mgmt',           v: ['Y', 'Y', 'Y', 'N', 'Y'] },
  { label: 'Work Orders',            v: ['Y', 'N', 'Y', 'N', 'Y'] },
  { label: 'Crew Scheduling',        v: ['Y', '~', '~', 'N', 'Y'] },
  { label: 'Commission Tracking',    v: ['Y', 'N', 'N', 'N', 'Y'] },
  { label: 'Insurance / Supplement', v: ['Y', 'Y', '~', '~', 'N'] },
  { label: 'Expense Tracking',       v: ['Y', 'N', 'N', 'N', 'Y'] },
  { label: 'Doc Templates',          v: ['Y', 'Y', 'Y', '~', 'Y'] },
  { label: 'Automations',            v: ['Y', '~', '~', 'N', 'Y'] },
  { label: 'AI Assistant',           v: ['Y', 'N', 'N', 'N', 'N'] },
  { label: 'Material Orders',        v: ['Y', 'N', 'N', 'N', 'Y'] },
  { label: 'Permit Tracker',         v: ['Y', 'N', 'N', 'N', 'Y'] },
  { label: 'Reports / Analytics',    v: ['Y', 'Y', 'Y', '~', 'Y'] },
  { label: 'No Add-On Fees',         v: ['Y', 'N', 'N', 'N', 'N'] },
  { label: 'No Setup Fee',           v: ['Y', 'N', 'N', 'Y', 'N'] },
];

// ─── Cell colors & symbols ────────────────────────────────────────────────────
const CELL_STYLE: Record<CellVal, { bg: string; hlBg: string; symbol: string }> = {
  Y:   { bg: '#0d9488', hlBg: '#0f766e', symbol: '✓' },
  '~': { bg: '#92400e', hlBg: '#a16207', symbol: '~' },
  N:   { bg: '#111827', hlBg: '#1a2235', symbol: '✗' },
};

// ─── Component ────────────────────────────────────────────────────────────────
const PlanComparisonChart: React.FC = () => {
  const LABEL_W  = 168;
  const CELL_W   = 88;
  const CELL_H   = 38;
  const HL_H     = 46;   // taller for highlighted rows
  const HEADER_H = 44;
  const GAP = 2;

  return (
    <div
      className="rounded-2xl overflow-hidden mt-8"
      style={{
        background: '#0b1120',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* ── Header ── */}
      <div className="px-6 pt-8 pb-4 text-center" style={{ background: 'linear-gradient(160deg, #0f1e3a 0%, #0b1120 100%)' }}>
        <h2
          className="text-2xl font-black tracking-tight mb-1"
          style={{ background: 'linear-gradient(90deg, #93c5fd, #c4a35a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          CRM Feature Comparison: TrussCTR vs Competitors
        </h2>
        <p className="text-xs mb-4" style={{ color: '#64748b' }}>
          Built exclusively for roofing &amp; restoration contractors — how do we stack up?
        </p>

        {/* ── Mobile App Callout Banner ── */}
        <div
          className="flex items-center justify-center gap-3 mx-auto mb-5 px-5 py-3 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, #0f2e1e 0%, #052e16 100%)',
            border: '1px solid #16a34a',
            maxWidth: 600,
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>📱</span>
          <div className="text-left">
            <p className="text-sm font-black" style={{ color: '#4ade80' }}>
              TrussCTR now has a full mobile app — included FREE on every plan
            </p>
            <p className="text-xs" style={{ color: '#86efac' }}>
              iOS &amp; Android · Real-time updates · Offline-ready · No extra charge
            </p>
          </div>
          <span
            className="text-[0.6rem] font-black px-2 py-0.5 rounded"
            style={{ background: '#16a34a', color: '#ffffff', whiteSpace: 'nowrap' }}
          >
            NOW LIVE
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-5 text-xs" style={{ color: '#94a3b8' }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3.5 h-3.5 rounded" style={{ background: '#0d9488' }} />
            ✓ Included
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3.5 h-3.5 rounded" style={{ background: '#92400e' }} />
            ~ Partial / Add-on
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3.5 h-3.5 rounded" style={{ background: '#111827', border: '1px solid #374151' }} />
            ✗ Not Available
          </span>
        </div>

        {/* Attribution */}
        <div className="flex items-center justify-end mt-2 pr-1">
          <span className="text-[0.6rem] font-semibold" style={{ color: '#475569' }}>
            Powered by <span className="font-black" style={{ color: '#6366f1' }}>✳ perplexity</span>
          </span>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="px-4 pb-8 overflow-x-auto">
        <div style={{ minWidth: LABEL_W + COLS.length * (CELL_W + GAP), display: 'inline-block', width: '100%' }}>

          {/* Column headers */}
          <div className="flex" style={{ paddingLeft: LABEL_W, gap: GAP, marginBottom: GAP }}>
            {COLS.map((col, ci) => (
              <div
                key={col}
                style={{
                  width: CELL_W,
                  height: HEADER_H,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  background: ci === 0 ? 'linear-gradient(145deg, #0f2244, #111827)' : '#111827',
                  border: ci === 0 ? '1px solid #c4a35a' : '1px solid #1e293b',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: ci === 0 ? '#c4a35a' : '#94a3b8',
                  textAlign: 'center',
                  letterSpacing: '0.02em',
                }}
              >
                {col}
              </div>
            ))}
          </div>

          {/* Feature rows */}
          {ROWS.map((row, ri) => {
            const isHL = !!row.highlight;
            const rowH = isHL ? HL_H : CELL_H;

            return (
              <div
                key={ri}
                className="flex items-center"
                style={{
                  gap: GAP,
                  marginBottom: GAP,
                  borderRadius: isHL ? 8 : 0,
                  background: isHL ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                  outline: isHL ? '1px solid rgba(16, 185, 129, 0.18)' : 'none',
                }}
              >
                {/* Feature label */}
                <div
                  style={{
                    width: LABEL_W,
                    flexShrink: 0,
                    fontSize: isHL ? '0.8rem' : '0.78rem',
                    fontWeight: isHL ? 700 : 500,
                    color: isHL ? '#34d399' : '#cbd5e1',
                    textAlign: 'right',
                    paddingRight: 12,
                    height: rowH,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 6,
                  }}
                >
                  <span>{row.label}</span>
                  {row.badge && (
                    <span
                      style={{
                        fontSize: '0.5rem',
                        fontWeight: 900,
                        background: '#16a34a',
                        color: '#fff',
                        borderRadius: 4,
                        padding: '1px 4px',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {row.badge}
                    </span>
                  )}
                </div>

                {/* Cells */}
                {row.v.map((val, ci) => {
                  const { bg, hlBg, symbol } = CELL_STYLE[val];
                  return (
                    <div
                      key={ci}
                      style={{
                        width: CELL_W,
                        height: rowH,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 6,
                        background: isHL ? hlBg : bg,
                        border: ci === 0 ? (isHL ? '1px solid #c4a35a88' : '1px solid #c4a35a33') : '1px solid transparent',
                        fontSize: val === '~' ? '1rem' : '1.1rem',
                        fontWeight: 900,
                        color: '#ffffff',
                        userSelect: 'none',
                      }}
                    >
                      {symbol}
                    </div>
                  );
                })}
              </div>
            );
          })}

        </div>
      </div>

      {/* ── Footer ── */}
      <div className="text-center pb-5">
        <p className="text-[0.65rem]" style={{ color: '#334155' }}>
          © 2026 TrussCTR by 614 Restore LLC &nbsp;·&nbsp;
          Competitor data sourced via Perplexity AI — publicly available information as of March 2026. Subject to change.
        </p>
      </div>
    </div>
  );
};

export default PlanComparisonChart;

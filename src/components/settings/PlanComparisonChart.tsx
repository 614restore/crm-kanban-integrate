import React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type CellVal = 'Y' | 'N' | '~';

// ─── Competitors ──────────────────────────────────────────────────────────────
const COLS = ['TrussCTR', 'JobNimbus', 'AccuLynx', 'Roofr', 'ServiceTitan'];

// ─── Feature rows ─────────────────────────────────────────────────────────────
// Y = Included  |  ~ = Partial/Add-on  |  N = Not Available
const ROWS: { label: string; v: CellVal[] }[] = [
  { label: 'Contact CRM',          v: ['Y', 'Y', 'Y', '~', 'Y'] },
  { label: 'Pipeline / Kanban',    v: ['Y', 'Y', 'Y', 'N', 'Y'] },
  { label: 'Estimates & E-Sign',   v: ['Y', 'Y', 'Y', 'Y', 'Y'] },
  { label: 'Invoicing',            v: ['Y', 'Y', 'Y', 'Y', 'Y'] },
  { label: 'Mobile App',           v: ['Y', '~', '~', 'N', '~'] },
  { label: 'Project Mgmt',         v: ['Y', 'Y', 'Y', 'N', 'Y'] },
  { label: 'Work Orders',          v: ['Y', 'N', 'Y', 'N', 'Y'] },
  { label: 'Crew Scheduling',      v: ['Y', '~', '~', 'N', 'Y'] },
  { label: 'Commission Tracking',  v: ['Y', 'N', 'N', 'N', 'Y'] },
  { label: 'Insurance / Supplement', v: ['Y', 'Y', '~', '~', 'N'] },
  { label: 'Expense Tracking',     v: ['Y', 'N', 'N', 'N', 'Y'] },
  { label: 'Doc Templates',        v: ['Y', 'Y', 'Y', '~', 'Y'] },
  { label: 'Automations',          v: ['Y', '~', '~', 'N', 'Y'] },
  { label: 'AI Assistant',         v: ['Y', 'N', 'N', 'N', 'N'] },
  { label: 'Material Orders',      v: ['Y', 'N', 'N', 'N', 'Y'] },
  { label: 'Permit Tracker',       v: ['Y', 'N', 'N', 'N', 'Y'] },
  { label: 'Reports / Analytics',  v: ['Y', 'Y', 'Y', '~', 'Y'] },
  { label: 'No Add-On Fees',       v: ['Y', 'N', 'N', 'N', 'N'] },
  { label: 'Mobile Included Free', v: ['Y', 'N', 'N', 'Y', 'N'] },
  { label: 'No Setup Fee',         v: ['Y', 'N', 'N', 'Y', 'N'] },
];

// ─── Cell colors & symbols ────────────────────────────────────────────────────
const CELL_STYLE: Record<CellVal, { bg: string; symbol: string }> = {
  Y:  { bg: '#0d9488', symbol: '✓' },   // teal
  '~': { bg: '#92400e', symbol: '~' },  // brown/amber
  N:  { bg: '#111827', symbol: '✗' },   // near-black
};

// ─── Component ────────────────────────────────────────────────────────────────
const PlanComparisonChart: React.FC = () => {
  const LABEL_W = 160;
  const CELL_W  = 88;
  const CELL_H  = 38;
  const HEADER_H = 44;
  const GAP = 2;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: '#0b1120',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* ── Header ── */}
      <div className="px-6 pt-8 pb-5 text-center" style={{ background: 'linear-gradient(160deg, #0f1e3a 0%, #0b1120 100%)' }}>
        <h2
          className="text-2xl font-black tracking-tight mb-1"
          style={{ background: 'linear-gradient(90deg, #93c5fd, #c4a35a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          CRM Feature Comparison: TrussCTR vs Competitors
        </h2>

        {/* Legend */}
        <div className="flex items-center justify-center gap-5 mt-3 text-sm" style={{ color: '#94a3b8' }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded" style={{ background: '#0d9488' }} />
            ✓ Included
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded" style={{ background: '#92400e' }} />
            ~ Partial / Add-on
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded" style={{ background: '#111827', border: '1px solid #374151' }} />
            ✗ Not Available
          </span>
        </div>

        {/* Attribution */}
        <div className="flex items-center justify-end mt-2 pr-2">
          <span className="text-[0.65rem] font-semibold" style={{ color: '#475569' }}>
            Powered by{' '}
            <span className="font-black" style={{ color: '#6366f1' }}>✳ perplexity</span>
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
          {ROWS.map((row, ri) => (
            <div
              key={ri}
              className="flex items-center"
              style={{ gap: GAP, marginBottom: GAP }}
            >
              {/* Feature label */}
              <div
                style={{
                  width: LABEL_W,
                  flexShrink: 0,
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  color: '#cbd5e1',
                  textAlign: 'right',
                  paddingRight: 12,
                  height: CELL_H,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                }}
              >
                {row.label}
              </div>

              {/* Cells */}
              {row.v.map((val, ci) => {
                const { bg, symbol } = CELL_STYLE[val];
                return (
                  <div
                    key={ci}
                    style={{
                      width: CELL_W,
                      height: CELL_H,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 6,
                      background: bg,
                      border: ci === 0 ? '1px solid #c4a35a33' : '1px solid transparent',
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
          ))}

        </div>
      </div>

      {/* ── Footer ── */}
      <div className="text-center pb-5">
        <p className="text-[0.68rem]" style={{ color: '#334155' }}>
          © 2026 TrussCTR by 614 Restore LLC &nbsp;·&nbsp;
          Competitor data sourced via Perplexity AI — based on publicly available information as of March 2026. Subject to change.
        </p>
      </div>
    </div>
  );
};

export default PlanComparisonChart;

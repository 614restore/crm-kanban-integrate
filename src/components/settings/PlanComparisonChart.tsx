import React, { useState } from 'react';

const COLS = ['TrussCTR', 'JobNimbus', 'AccuLynx', 'Roofr'];

type CellValue = 'Y' | 'N' | string;

interface SectionRow {
  feature: string;
  values: CellValue[];
}

interface Section {
  id: string;
  label: string;
  defaultOpen: boolean;
  rows: SectionRow[];
}

const Y = '✔';
const N = '✘';
const P = (t: string) => `~${t}`;

const SECTIONS: Section[] = [
  {
    id: 'pricing',
    label: '💰 Pricing & Access',
    defaultOpen: true,
    rows: [
      { feature: 'Starting Monthly Price', values: ['$29–$179/mo', P('$25/user'), P('$85/user'), '$89/mo'] },
      { feature: 'No Per-User Fee (flat rate)', values: [Y, N, N, N] },
      { feature: 'Free Trial / Demo Available', values: [Y, Y, P('Demo only'), Y] },
      { feature: 'Built for Small Roofing Teams', values: [Y, Y, P('Mid-large'), Y] },
    ],
  },
  {
    id: 'crm',
    label: '📋 CRM & Contact Management',
    defaultOpen: true,
    rows: [
      { feature: 'Full CRM (Contacts, Leads, Customers)', values: [Y, Y, Y, P('Basic')] },
      { feature: 'Kanban Pipeline Board', values: [Y, Y, Y, P('Limited')] },
      { feature: 'Job Status / Lead Progression Tracking', values: [Y, Y, Y, P('Basic')] },
      { feature: 'Customer Detail Page w/ Full History', values: [Y, Y, Y, P('Limited')] },
    ],
  },
  {
    id: 'insurance',
    label: '🏦 Insurance & Supplement Management',
    defaultOpen: true,
    rows: [
      { feature: 'Insurance Claim Tracking per customer', values: [Y, P('Add-on'), Y, N] },
      { feature: 'Supplement Tracking linked to claims', values: [Y, P('Limited'), Y, N] },
      { feature: 'Claims & Supplements Linked to Customer', values: [Y, P('Manual'), Y, N] },
      { feature: 'Adjuster & Insurance Contact Mgmt', values: [Y, P('Basic'), Y, N] },
    ],
  },
  {
    id: 'docs',
    label: '📄 Documents & Digital Signatures',
    defaultOpen: false,
    rows: [
      { feature: 'Proposal Template auto-fill', values: [Y, Y, Y, Y] },
      { feature: 'Contract Template w/ Signature Blocks', values: [Y, Y, Y, Y] },
      { feature: '3-Day Right to Cancel Notice (FTC)', values: [Y, N, P('Manual'), N] },
      { feature: 'Digital Signature Capture (on-screen)', values: [Y, Y, Y, Y] },
      { feature: 'Per-Customer Document Editing', values: [Y, P('Limited'), P('Limited'), P('Limited')] },
      { feature: 'Document Duplication & Delete', values: [Y, P('Basic'), P('Basic'), P('Basic')] },
      { feature: 'Document Upload (work orders, materials)', values: [Y, Y, Y, P('Basic')] },
    ],
  },
  {
    id: 'scheduling',
    label: '📅 Scheduling & Calendar',
    defaultOpen: false,
    rows: [
      { feature: 'Appointment / Inspection Scheduling', values: [Y, Y, Y, P('Limited')] },
      { feature: 'Crew Schedule Management', values: [Y, Y, Y, N] },
      { feature: 'Calendar View (month/week/day)', values: [Y, Y, Y, P('Basic')] },
    ],
  },
  {
    id: 'financials',
    label: '💵 Estimates, Invoices & Financials',
    defaultOpen: false,
    rows: [
      { feature: 'Estimate Builder', values: [Y, Y, Y, Y] },
      { feature: 'Invoice Generation', values: [Y, Y, Y, Y] },
      { feature: 'Financial Dashboard', values: [Y, P('Basic'), Y, P('Basic')] },
      { feature: 'Expense Tracking', values: [Y, P('Limited'), P('Limited'), N] },
      { feature: 'QuickBooks Integration', values: [Y, Y, Y, P('Limited')] },
      { feature: 'Material Orders w/ Pre-Built Roof Templates', values: [Y, P('Basic'), Y, P('Limited')] },
    ],
  },
  {
    id: 'team',
    label: '👥 Team Management & Reporting',
    defaultOpen: false,
    rows: [
      { feature: 'Team Member Management / Role Permissions', values: [Y, Y, Y, P('Basic')] },
      { feature: 'Individual Sales Rep Metrics', values: [Y, Y, Y, N] },
      { feature: 'Team Performance Dashboard', values: [Y, Y, Y, N] },
      { feature: 'Reports & Analytics / PDF Export', values: [Y, P('Limited'), Y, P('Basic')] },
    ],
  },
  {
    id: 'comms',
    label: '💬 Communication & Automation',
    defaultOpen: false,
    rows: [
      { feature: 'Communication Hub (SMS, Email, Notes)', values: [Y, Y, Y, P('Email only')] },
      { feature: 'Automated Follow-Up Workflows', values: [Y, Y, Y, P('Limited')] },
      { feature: 'Google Review Request (1-click)', values: [Y, P('Add-on'), N, N] },
      { feature: 'Customer Satisfaction Survey', values: [Y, P('Add-on'), N, N] },
    ],
  },
  {
    id: 'tech',
    label: '🔧 Technology & Integrations',
    defaultOpen: false,
    rows: [
      { feature: 'AI Assistant (built-in)', values: [Y, P('Basic'), N, N] },
      { feature: 'Mobile Friendly / Responsive', values: [Y, Y, Y, Y] },
      { feature: 'Photo Capture (job site photos)', values: [Y, Y, Y, Y] },
      { feature: 'Equipment & Asset Tracking', values: [Y, P('Limited'), P('Limited'), N] },
      { feature: 'Supplier Management', values: [Y, P('Basic'), P('Basic'), N] },
      { feature: 'API Access & Webhooks', values: [Y, P('Limited'), P('Limited'), N] },
      { feature: 'Multi-Company / White Label Ready', values: [Y, N, N, N] },
      { feature: 'Data Security (Row-Level)', values: [Y, P('Basic'), P('Basic'), P('Basic')] },
    ],
  },
];

const PRICING_CARDS = [
  {
    name: 'TrussCTR',
    highlight: true,
    plans: [
      { name: 'Starter (2)', price: '$29/mo' },
      { name: 'Pro (5)', price: '$59/mo' },
      { name: 'Business (10)', price: '$99/mo' },
      { name: 'Enterprise (∞)', price: '$179/mo' },
    ],
  },
  {
    name: 'JobNimbus',
    highlight: false,
    perUser: '+$25–$35 per extra user',
    plans: [
      { name: 'Starter (1)', price: '$25/mo' },
      { name: 'Pro (3)', price: '$85/mo' },
      { name: '5 users', price: '~$135/mo' },
      { name: 'Unlimited', price: '$350+/mo' },
    ],
  },
  {
    name: 'AccuLynx',
    highlight: false,
    perUser: '+~$30 per extra user',
    plans: [
      { name: 'Solo (1)', price: '~$89/mo' },
      { name: '5 users', price: '~$199/mo' },
      { name: '15 users', price: '~$399/mo' },
      { name: 'Enterprise', price: 'Custom' },
    ],
  },
  {
    name: 'Roofr',
    highlight: false,
    perUser: '+$30–$50 per extra user',
    plans: [
      { name: 'Starter (1)', price: '$89/mo' },
      { name: 'Pro (3)', price: '$159/mo' },
      { name: 'Business (10)', price: '$299/mo' },
      { name: 'Enterprise', price: 'Custom' },
    ],
  },
];

const WHY_WIN = [
  { val: 'Flat Rate', desc: 'No per-user fees ever — competitors charge $25–$79 per seat' },
  { val: '$29–$179', desc: 'vs $398–$800+/mo for ServiceTitan at comparable team size' },
  { val: 'Insurance', desc: 'Built-in claim & supplement tracking — competitors charge add-ons or don\'t offer it' },
  { val: 'All Features', desc: 'Every plan includes every feature — no feature-gating by tier' },
];

function CellDisplay({ val }: { val: CellValue }) {
  if (val === Y) return <span style={{ color: '#34d399', fontWeight: 700, fontSize: '1rem' }}>✔</span>;
  if (val === N) return <span style={{ color: '#f87171', fontSize: '1rem' }}>✘</span>;
  if (val.startsWith('~')) return <span style={{ color: '#fbbf24', fontSize: '0.75rem', fontWeight: 600 }}>{val.slice(1)}</span>;
  return <span style={{ color: '#cbd5e1' }}>{val}</span>;
}

const PlanComparisonChart: React.FC = () => {
  const initOpen = new Set(SECTIONS.filter(s => s.defaultOpen).map(s => s.id));
  const [openSections, setOpenSections] = useState<Set<string>>(initOpen);

  const toggle = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = (open: boolean) => {
    setOpenSections(open ? new Set(SECTIONS.map(s => s.id)) : new Set());
  };

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      background: '#0f172a',
      color: '#e2e8f0',
      borderRadius: 16,
      padding: '32px 20px 48px',
      marginTop: 32,
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 800,
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 6,
        }}>
          TrussCTR vs The Competition{' '}
          <span style={{
            display: 'inline-block',
            background: '#1e40af',
            color: '#93c5fd',
            fontSize: '0.68rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 999,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginLeft: 6,
            verticalAlign: 'middle',
            WebkitTextFillColor: '#93c5fd',
          }}>2026</span>
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
          Built exclusively for roofing &amp; restoration contractors — how do we stack up?
        </p>
      </div>

      {/* Pricing Cards */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{
          textAlign: 'center',
          fontSize: '0.85rem',
          fontWeight: 700,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 14,
        }}>💰 Real-World Monthly Cost for a 5-Person Team</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))',
          gap: 10,
        }}>
          {PRICING_CARDS.map((card) => (
            <div key={card.name} style={{
              background: card.highlight ? 'linear-gradient(135deg, #0f2040, #0f1d3d)' : '#1e293b',
              border: card.highlight ? '1px solid #3b82f6' : '1px solid #334155',
              boxShadow: card.highlight ? '0 0 0 2px #3b82f633' : undefined,
              borderRadius: 12,
              padding: '16px 12px',
              textAlign: 'center',
              position: 'relative',
            }}>
              {card.highlight && (
                <div style={{
                  position: 'absolute',
                  top: -10,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#3b82f6',
                  color: '#fff',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  padding: '2px 10px',
                  borderRadius: 999,
                  whiteSpace: 'nowrap',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>★ Best Value</div>
              )}
              <div style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: card.highlight ? '#60a5fa' : '#e2e8f0',
                marginBottom: 10,
              }}>{card.name}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {card.plans.map((plan) => (
                  <div key={plan.name} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: card.highlight ? '#0a1628' : '#0f172a',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: '0.72rem',
                  }}>
                    <span style={{ color: '#94a3b8' }}>{plan.name}</span>
                    <span style={{ fontWeight: 700, color: card.highlight ? '#34d399' : '#f87171' }}>{plan.price}</span>
                  </div>
                ))}
              </div>
              {card.perUser && (
                <div style={{ marginTop: 6, fontSize: '0.68rem', color: '#f87171', fontWeight: 600 }}>{card.perUser}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Expand/Collapse Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={() => toggleAll(true)}
          style={{
            padding: '7px 18px',
            background: '#1e293b',
            color: '#94a3b8',
            border: '1px solid #334155',
            borderRadius: 8,
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          onMouseOver={e => { (e.target as HTMLButtonElement).style.background = '#334155'; (e.target as HTMLButtonElement).style.color = '#e2e8f0'; }}
          onMouseOut={e => { (e.target as HTMLButtonElement).style.background = '#1e293b'; (e.target as HTMLButtonElement).style.color = '#94a3b8'; }}
        >▼ Expand All Features</button>
        <button
          onClick={() => toggleAll(false)}
          style={{
            padding: '7px 18px',
            background: '#1e293b',
            color: '#94a3b8',
            border: '1px solid #334155',
            borderRadius: 8,
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          onMouseOver={e => { (e.target as HTMLButtonElement).style.background = '#334155'; (e.target as HTMLButtonElement).style.color = '#e2e8f0'; }}
          onMouseOut={e => { (e.target as HTMLButtonElement).style.background = '#1e293b'; (e.target as HTMLButtonElement).style.color = '#94a3b8'; }}
        >▲ Collapse All</button>
      </div>

      {/* Feature Sections */}
      <div>
        {SECTIONS.map((sec) => {
          const isOpen = openSections.has(sec.id);
          return (
            <div key={sec.id} style={{
              border: '1px solid #1e293b',
              borderRadius: 12,
              marginBottom: 10,
              overflow: 'hidden',
            }}>
              <button
                onClick={() => toggle(sec.id)}
                style={{
                  width: '100%',
                  background: '#1e293b',
                  border: 'none',
                  color: '#e2e8f0',
                  padding: '12px 18px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  letterSpacing: '0.03em',
                }}
              >
                <span>{sec.label}</span>
                <span style={{
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                  fontSize: '0.75rem',
                  color: '#64748b',
                }}>▼</span>
              </button>
              {isOpen && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
                    <thead>
                      <tr style={{ background: '#0f172a' }}>
                        <th style={{
                          padding: '10px 12px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: '#64748b',
                          textAlign: 'left',
                          borderBottom: '1px solid #1e293b',
                          minWidth: 200,
                        }}>Feature</th>
                        {COLS.map((col, ci) => (
                          <th key={col} style={{
                            padding: '10px 12px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            textAlign: 'center',
                            borderBottom: '1px solid #1e293b',
                            whiteSpace: 'nowrap',
                            color: ci === 0 ? '#60a5fa' : '#64748b',
                            background: ci === 0 ? '#0f2040' : undefined,
                          }}>
                            <>
                              {col}
                              {ci === 0 && (
                                <span style={{
                                  display: 'inline-block',
                                  background: '#1e40af',
                                  color: '#93c5fd',
                                  fontSize: '0.6rem',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 999,
                                  marginLeft: 5,
                                  textTransform: 'uppercase',
                                }}>You</span>
                              )}
                            </>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sec.rows.map((row, ri) => (
                        <tr key={ri} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{
                            padding: '10px 12px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#e2e8f0',
                            textAlign: 'left',
                          }}>{row.feature}</td>
                          {row.values.map((val, vi) => (
                            <td key={vi} style={{
                              padding: '10px 12px',
                              fontSize: '0.82rem',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              background: vi === 0 ? '#0f2040' : undefined,
                            }}>
                              <CellDisplay val={val} />
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

      {/* Why TrussCTR Wins */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f22, #1e1b4b22)',
        border: '1px solid #1e40af44',
        borderRadius: 14,
        padding: '24px 28px',
        maxWidth: 960,
        margin: '24px auto 0',
      }}>
        <h2 style={{ color: '#60a5fa', fontSize: '1rem', marginBottom: 14 }}>💡 Why TrussCTR Wins</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}>
          {WHY_WIN.map((item) => (
            <div key={item.val} style={{ background: '#1e293b', borderRadius: 10, padding: 14 }}>
              <div style={{ color: '#34d399', fontSize: '1.3rem', fontWeight: 800 }}>{item.val}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: 4 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: 28, color: '#475569', fontSize: '0.75rem' }}>
        <p>
          © 2026 <span style={{ color: '#3b82f6' }}>TrussCTR</span> by 614 Restore LLC &nbsp;·&nbsp;
          Competitor data based on publicly available pricing as of March 2026. Subject to change.<br />
          ✔ Included &nbsp; ✘ Not available &nbsp; ~Partial/Add-on/Limited or requires upgrade.
        </p>
      </div>
    </div>
  );
};

export default PlanComparisonChart;

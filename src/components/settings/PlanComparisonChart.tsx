import React, { useState } from 'react';

// ─── Column definitions ────────────────────────────────────────────────────────
// Index 0 = TrussCTR (always highlighted)
const COLS = ['TrussCTR', 'JobNimbus', 'AccuLynx', 'Roofr', 'Jobber', 'ServiceTitan'];

type CellValue = 'Y' | 'N' | string;

interface SectionRow { feature: string; values: CellValue[]; }
interface Section { id: string; label: string; defaultOpen: boolean; rows: SectionRow[]; }

const Y = '✔';
const N = '✘';
const P = (t: string) => `~${t}`;   // Partial / limited / add-on

// ─── Feature Data ──────────────────────────────────────────────────────────────
// Each row.values array maps to COLS: [TrussCTR, JobNimbus, AccuLynx, Roofr, Jobber, ServiceTitan]
const SECTIONS: Section[] = [
  {
    id: 'pricing',
    label: '💰 Pricing & Access',
    defaultOpen: true,
    rows: [
      { feature: 'Starting Monthly Price',            values: ['$59/mo (2 users)',  P('$25/user/mo'), P('$89/user/mo'), '$89/mo (1 user)', '$49/mo (1 user)',  P('$398/mo+')] },
      { feature: 'No Per-User Fee (flat rate)',        values: [Y, N, N, N, N, N] },
      { feature: '5-User Real-World Cost',             values: ['$119/mo', P('$135/mo'), P('$199/mo'), P('$159/mo'), P('$149/mo'), P('$498/mo+')] },
      { feature: '15-User Real-World Cost',            values: ['$229/mo', P('$375/mo'), P('Custom'), P('$499/mo+'), P('$249/mo'), P('$598/mo+')] },
      { feature: 'Unlimited Users Tier Available',     values: ['$399/mo', P('$350+'), P('Custom'), P('Custom'), Y, P('Custom')] },
      { feature: 'Annual Discount (2 months free)',    values: [Y, Y, P('Custom'), Y, Y, N] },
      { feature: 'Free Trial Available',               values: [Y, Y, P('Demo only'), Y, Y, P('Demo only')] },
      { feature: 'No Implementation / Onboarding Fee', values: [Y, Y, Y, Y, Y, N] },
      { feature: 'Built for Roofing / Restoration',   values: [Y, Y, Y, Y, N, P('Partial')] },
    ],
  },
  {
    id: 'crm',
    label: '📋 CRM & Contact Management',
    defaultOpen: true,
    rows: [
      { feature: 'Full CRM (Contacts, Leads, Customers)', values: [Y, Y, Y, P('Basic'), Y, Y] },
      { feature: 'Kanban Pipeline Board',                  values: [Y, Y, Y, P('Limited'), P('Basic'), Y] },
      { feature: 'Job Status / Lead Progression',          values: [Y, Y, Y, P('Basic'), Y, Y] },
      { feature: 'Customer Full History Page',             values: [Y, Y, Y, P('Limited'), Y, Y] },
      { feature: 'Lead Source Tracking',                   values: [Y, Y, Y, P('Basic'), Y, Y] },
      { feature: 'Customer Portal / Client Hub',           values: [P('Basic'), P('Limited'), N, N, Y, Y] },
      { feature: 'Duplicate Contact Detection',            values: [Y, P('Basic'), P('Basic'), N, P('Basic'), Y] },
    ],
  },
  {
    id: 'insurance',
    label: '🏦 Insurance & Restoration',
    defaultOpen: true,
    rows: [
      { feature: 'Insurance Claim Tracking per Customer', values: [Y, P('Add-on'), Y, N, N, P('Limited')] },
      { feature: 'Supplement Tracking Linked to Claims',  values: [Y, P('Limited'), Y, N, N, N] },
      { feature: '17 Job Types (Roof, Exterior, Interior)', values: [Y, N, N, N, N, N] },
      { feature: 'Change Orders (AWO) Built-In',          values: [Y, N, P('Limited'), N, P('Basic'), Y] },
      { feature: 'Adjuster & Insurance Contact Mgmt',     values: [Y, P('Basic'), Y, N, N, P('Basic')] },
      { feature: 'Subcontractor Assignment & Cost Track', values: [Y, P('Limited'), P('Limited'), N, P('Limited'), Y] },
      { feature: 'Dynamic Job Specs by Trade Type',       values: [Y, N, N, N, N, N] },
      { feature: 'Ready-to-Invoice Status Tracking',      values: [Y, N, N, N, N, P('Basic')] },
      { feature: 'Work Orders (Multi-Trade)',              values: [Y, Y, Y, P('Basic'), Y, Y] },
    ],
  },
  {
    id: 'docs',
    label: '📄 Documents & Digital Signatures',
    defaultOpen: false,
    rows: [
      { feature: 'Document Templates (Professional)',       values: [Y, Y, Y, Y, Y, Y] },
      { feature: 'Proposal / Estimate Template Auto-Fill',  values: [Y, Y, Y, Y, Y, Y] },
      { feature: 'Contract Template w/ Signature Blocks',   values: [Y, Y, Y, Y, Y, Y] },
      { feature: '3-Day Right to Cancel Notice (FTC)',       values: [Y, N, P('Manual'), N, N, N] },
      { feature: 'Change Order Template',                    values: [Y, N, P('Manual'), N, P('Basic'), Y] },
      { feature: 'Certificate of Completion Template',       values: [Y, P('Limited'), P('Limited'), N, P('Basic'), Y] },
      { feature: 'Digital Signature Capture (Web + Mobile)', values: [Y, Y, Y, Y, Y, Y] },
      { feature: 'Per-Customer Document Editing',            values: [Y, P('Limited'), P('Limited'), P('Limited'), P('Limited'), Y] },
      { feature: 'Document Storage & Cloud Backup',          values: [Y, Y, Y, P('Basic'), Y, Y] },
      { feature: 'Document Upload (Photos, Materials)',      values: [Y, Y, Y, P('Basic'), Y, Y] },
    ],
  },
  {
    id: 'scheduling',
    label: '📅 Scheduling & Dispatch',
    defaultOpen: false,
    rows: [
      { feature: 'Appointment / Inspection Scheduling',  values: [Y, Y, Y, P('Limited'), Y, Y] },
      { feature: 'Crew Schedule Management',              values: [Y, Y, Y, N, Y, Y] },
      { feature: 'Calendar View (Month/Week/Day)',        values: [Y, Y, Y, P('Basic'), Y, Y] },
      { feature: 'Drag-and-Drop Dispatch Board',          values: [P('Basic'), P('Basic'), P('Basic'), N, Y, Y] },
      { feature: 'GPS Job Site Location / Tracking',      values: [Y, P('Limited'), Y, P('Basic'), Y, Y] },
      { feature: 'Route Optimization',                    values: [N, N, N, N, Y, Y] },
      { feature: 'On-My-Way Automated Customer Alerts',   values: [P('Basic'), P('Add-on'), N, N, Y, Y] },
    ],
  },
  {
    id: 'financials',
    label: '💵 Estimates, Invoices & Financials',
    defaultOpen: false,
    rows: [
      { feature: 'Estimate Builder',                     values: [Y, Y, Y, Y, Y, Y] },
      { feature: 'Invoice Generation',                   values: [Y, Y, Y, Y, Y, Y] },
      { feature: 'Flat-Rate / Pricebook Pricing',        values: [P('Basic'), P('Basic'), P('Basic'), N, P('Basic'), Y] },
      { feature: 'Financial / Revenue Dashboard',        values: [Y, P('Basic'), Y, P('Basic'), Y, Y] },
      { feature: 'Expense Tracking (13 Categories)',     values: [Y, P('Limited'), P('Limited'), N, P('Limited'), Y] },
      { feature: 'Separate Labor vs Subcontractor Cost', values: [Y, N, P('Limited'), N, N, Y] },
      { feature: 'Profit Margin Calculations',           values: [Y, P('Limited'), Y, N, Y, Y] },
      { feature: 'QuickBooks Integration',               values: [Y, Y, Y, P('Limited'), Y, Y] },
      { feature: 'Online Payment Collection',            values: [Y, Y, Y, Y, Y, Y] },
      { feature: 'Supplier Management (Pre-Loaded)',     values: [Y, P('Basic'), Y, P('Limited'), P('Basic'), Y] },
      { feature: 'Excel Export (35+ Columns)',           values: [Y, P('Limited'), P('Limited'), N, P('Limited'), Y] },
      { feature: 'Material Orders w/ Roof Templates',   values: [Y, P('Basic'), Y, P('Limited'), N, Y] },
      { feature: 'Membership / Service Agreement Mgmt', values: [N, N, N, N, P('Basic'), Y] },
    ],
  },
  {
    id: 'team',
    label: '👥 Team Management & Reporting',
    defaultOpen: false,
    rows: [
      { feature: 'Team Member Role Permissions',         values: [Y, Y, Y, P('Basic'), Y, Y] },
      { feature: 'Individual Sales Rep Metrics',         values: [Y, Y, Y, N, Y, Y] },
      { feature: 'Team Performance Dashboard',           values: [Y, Y, Y, N, Y, Y] },
      { feature: 'Reports & Analytics / PDF Export',     values: [Y, P('Limited'), Y, P('Basic'), Y, Y] },
      { feature: 'Custom Report Builder',                values: [P('Basic'), P('Basic'), Y, N, P('Basic'), Y] },
      { feature: 'Subcontractor / Crew Management',      values: [Y, P('Limited'), P('Limited'), N, P('Limited'), Y] },
    ],
  },
  {
    id: 'comms',
    label: '💬 Communication & Automation',
    defaultOpen: false,
    rows: [
      { feature: 'Communication Hub (SMS, Email, Notes)', values: [Y, Y, Y, P('Email only'), Y, Y] },
      { feature: 'Automated Follow-Up Workflows',          values: [Y, Y, Y, P('Limited'), Y, Y] },
      { feature: 'Two-Way SMS Messaging',                  values: [Y, P('Add-on'), P('Add-on'), N, P('Add-on'), Y] },
      { feature: 'Email Marketing / Campaigns',            values: [P('Basic'), P('Add-on'), P('Add-on'), N, P('Add-on'), P('Add-on')] },
      { feature: 'Google Review Request (1-Click)',         values: [Y, P('Add-on'), N, N, P('Add-on'), P('Add-on')] },
      { feature: 'Customer Satisfaction Survey',           values: [Y, P('Add-on'), N, N, P('Add-on'), P('Add-on')] },
      { feature: 'Notification / Alert System',            values: [Y, Y, Y, P('Basic'), Y, Y] },
    ],
  },
  {
    id: 'mobile',
    label: '📱 Mobile App (iOS & Android)',
    defaultOpen: true,
    rows: [
      { feature: 'Native iOS App',                         values: [Y, Y, Y, Y, Y, Y] },
      { feature: 'Native Android App',                     values: [Y, Y, Y, Y, Y, Y] },
      { feature: 'Offline Mode (No Internet Required)',     values: [Y, P('Limited'), P('Limited'), N, Y, Y] },
      { feature: 'Biometric Login (Face ID / Touch ID)',    values: [Y, Y, P('Limited'), N, Y, Y] },
      { feature: 'Full CRM Access on Mobile',              values: [Y, Y, Y, P('Basic'), Y, Y] },
      { feature: 'Estimate & Invoice Creation on Mobile',  values: [Y, Y, Y, Y, Y, Y] },
      { feature: 'Digital Signature Capture on Mobile',    values: [Y, Y, Y, Y, Y, Y] },
      { feature: 'Camera / Job Site Photo Capture',        values: [Y, Y, Y, Y, Y, Y] },
      { feature: 'Photo Annotation (Draw on Photos)',       values: [Y, P('Limited'), Y, P('Limited'), P('Limited'), Y] },
      { feature: 'Before/After Photo Reports',             values: [Y, N, Y, P('Limited'), N, Y] },
      { feature: 'Document Scanning (Phone Camera)',        values: [Y, N, N, N, N, P('Limited')] },
      { feature: 'Fraud Prevention Photo Capture',         values: [Y, N, N, N, N, N] },
      { feature: 'Inspection Report from Mobile',          values: [Y, P('Limited'), Y, P('Limited'), P('Limited'), Y] },
      { feature: 'PDF Generation On-Device',               values: [Y, P('Limited'), P('Limited'), N, P('Limited'), Y] },
      { feature: 'GPS Location on Jobs',                   values: [Y, P('Limited'), Y, P('Basic'), Y, Y] },
      { feature: 'Push Notifications',                     values: [Y, Y, Y, P('Limited'), Y, Y] },
      { feature: 'Calendar & Scheduling on Mobile',        values: [Y, Y, Y, P('Basic'), Y, Y] },
    ],
  },
  {
    id: 'tech',
    label: '🔧 Technology & Integrations',
    defaultOpen: false,
    rows: [
      { feature: 'AI Assistant (Built-In)',                values: [Y, P('Basic'), N, N, N, Y] },
      { feature: 'Mobile App + Web App Combo',             values: [Y, Y, Y, Y, Y, Y] },
      { feature: 'Equipment & Asset Tracking',             values: [Y, P('Limited'), P('Limited'), N, P('Limited'), Y] },
      { feature: 'API Access / Webhooks',                  values: [Y, P('Limited'), P('Limited'), N, Y, Y] },
      { feature: 'Aerial Measurement Integration',         values: [P('Limited'), P('Add-on'), Y, Y, N, Y] },
      { feature: 'EagleView / Hover Integration',          values: [Y, P('Add-on'), Y, Y, N, Y] },
      { feature: 'Multi-Company / White Label Ready',      values: [Y, N, N, N, N, N] },
      { feature: 'Data Security (Row-Level Isolation)',    values: [Y, P('Basic'), P('Basic'), P('Basic'), P('Basic'), Y] },
      { feature: 'Dedicated Mobile + Web Development',     values: [Y, Y, Y, P('Web-first'), Y, Y] },
    ],
  },
];

// ─── Pricing Cards ─────────────────────────────────────────────────────────────
const PRICING_CARDS = [
  {
    name: 'TrussCTR',
    highlight: true,
    badge: '★ Best Value',
    note: 'Flat rate — no per-user fees',
    plans: [
      { name: 'Starter (2 users)',   price: '$59/mo' },
      { name: 'Pro (5 users)',        price: '$119/mo' },
      { name: 'Business (15 users)', price: '$229/mo' },
      { name: 'Scale (∞)',           price: '$399/mo' },
    ],
  },
  {
    name: 'JobNimbus',
    highlight: false,
    note: 'Per-user pricing',
    plans: [
      { name: '1 user',       price: '~$25/mo' },
      { name: '3 users',      price: '~$85/mo' },
      { name: '5 users',      price: '~$135/mo' },
      { name: 'Unlimited',    price: '~$350+/mo' },
    ],
  },
  {
    name: 'AccuLynx',
    highlight: false,
    note: 'Per-user pricing',
    plans: [
      { name: 'Solo (1 user)',    price: '~$89/mo' },
      { name: 'Team (5 users)',   price: '~$199/mo' },
      { name: 'Large (15 users)', price: '~$399/mo' },
      { name: 'Enterprise',       price: 'Custom' },
    ],
  },
  {
    name: 'Roofr',
    highlight: false,
    note: 'CRM + measurements focus',
    plans: [
      { name: 'Starter (1 user)',     price: '$89/mo' },
      { name: 'Pro (3 users)',         price: '$159/mo' },
      { name: 'Business (10 users)',   price: '$299/mo' },
      { name: 'Enterprise',            price: 'Custom' },
    ],
  },
  {
    name: 'Jobber',
    highlight: false,
    note: 'General field service',
    plans: [
      { name: 'Core (1 user)',    price: '$49/mo' },
      { name: 'Connect (5 users)', price: '$149/mo' },
      { name: 'Grow (unlimited)',  price: '$249/mo' },
      { name: 'Enterprise',        price: 'Custom' },
    ],
  },
  {
    name: 'ServiceTitan',
    highlight: false,
    note: 'Enterprise only + onboarding fees',
    plans: [
      { name: 'Starter',    price: '~$398/mo' },
      { name: 'Essentials', price: '~$598/mo' },
      { name: 'The Works',  price: '~$798/mo' },
      { name: 'Enterprise', price: '$1,000+/mo' },
    ],
  },
];

// ─── Why TrussCTR Wins ─────────────────────────────────────────────────────────
const WHY_WIN = [
  { val: 'Flat Rate', desc: 'No per-user fees ever — competitors charge $25–$89/seat/mo' },
  { val: '5-User: $119', desc: 'vs $135–$498/mo for the same team size at competitors' },
  { val: '15-User: $229', desc: 'vs $375–$598/mo for growing teams — save hundreds per month' },
  { val: 'Web + Mobile', desc: 'Native mobile app + web platform included free in every plan' },
  { val: 'Insurance', desc: 'Built-in claim & supplement tracking — competitors charge add-ons or skip it' },
  { val: 'Fraud Photos', desc: 'Job-site fraud prevention photo capture — exclusive to TrussCTR' },
  { val: 'All Features', desc: 'Every plan includes every feature — no artificial feature gating by tier' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function CellDisplay({ val, isFirst }: { val: CellValue; isFirst: boolean }) {
  const baseStyle: React.CSSProperties = { fontSize: '0.82rem', textAlign: 'center' as const };
  if (val === Y) return <span style={{ ...baseStyle, color: isFirst ? '#34d399' : '#4ade80', fontWeight: 700, fontSize: '1rem' }}>✔</span>;
  if (val === N) return <span style={{ ...baseStyle, color: '#f87171', fontSize: '1rem' }}>✘</span>;
  if (val.startsWith('~')) return <span style={{ ...baseStyle, color: '#fbbf24', fontSize: '0.72rem', fontWeight: 600 }}>{val.slice(1)}</span>;
  return <span style={{ ...baseStyle, color: '#cbd5e1', fontSize: '0.78rem' }}>{val}</span>;
}

// ─── Component ─────────────────────────────────────────────────────────────────
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

  const toggleAll = (open: boolean) =>
    setOpenSections(open ? new Set(SECTIONS.map(s => s.id)) : new Set());

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      background: '#0f172a',
      color: '#e2e8f0',
      borderRadius: 16,
      padding: '32px 20px 48px',
      marginTop: 32,
    }}>

      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
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
          Built exclusively for roofing &amp; restoration contractors — Web + Native Mobile App included in every plan
        </p>
      </div>

      {/* ── Pricing Cards ── */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{
          textAlign: 'center',
          fontSize: '0.85rem',
          fontWeight: 700,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 14,
        }}>💰 Real-World Monthly Cost by Team Size</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))',
          gap: 10,
          maxWidth: 960,
          margin: '0 auto 10px',
        }}>
          {PRICING_CARDS.slice(0, 3).map(card => <PricingCard key={card.name} card={card} />)}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))',
          gap: 10,
          maxWidth: 960,
          margin: '0 auto',
        }}>
          {PRICING_CARDS.slice(3).map(card => <PricingCard key={card.name} card={card} />)}
        </div>
      </div>

      {/* ── 5-Person Cost Callout ── */}
      <div style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 28,
        maxWidth: 960,
        margin: '0 auto 28px',
      }}>
        <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8', marginBottom: 12, fontWeight: 600 }}>
          📊 5-User Team Monthly Cost Comparison
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
          {[
            { name: 'TrussCTR', price: '$59', highlight: true },
            { name: 'Jobber', price: '$149' },
            { name: 'JobNimbus', price: '~$135' },
            { name: 'Roofr', price: '$159' },
            { name: 'AccuLynx', price: '~$199' },
            { name: 'ServiceTitan', price: '~$498+' },
          ].map(item => (
            <div key={item.name} style={{ textAlign: 'center', minWidth: 80 }}>
              <div style={{
                background: item.highlight ? '#3b82f6' : '#334155',
                borderRadius: '4px 4px 0 0',
                height: item.highlight ? 40 : undefined,
                padding: item.highlight ? '8px 12px' : '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: item.highlight ? '#fff' : '#e2e8f0',
                whiteSpace: 'nowrap',
              }}>{item.price}</div>
              <div style={{
                background: '#0f172a',
                padding: '4px 2px',
                fontSize: '0.65rem',
                color: item.highlight ? '#60a5fa' : '#64748b',
                fontWeight: item.highlight ? 700 : 400,
              }}>{item.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Expand / Collapse Controls ── */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['Expand All', 'Collapse All'] as const).map(label => (
          <button
            key={label}
            onClick={() => toggleAll(label === 'Expand All')}
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
            onMouseOver={e => { (e.currentTarget.style.background = '#334155'); (e.currentTarget.style.color = '#e2e8f0'); }}
            onMouseOut={e => { (e.currentTarget.style.background = '#1e293b'); (e.currentTarget.style.color = '#94a3b8'); }}
          >
            {label === 'Expand All' ? '▼ Expand All Features' : '▲ Collapse All'}
          </button>
        ))}
      </div>

      {/* ── Feature Sections ── */}
      <div>
        {SECTIONS.map(sec => {
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
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
                    <thead>
                      <tr style={{ background: '#0f172a' }}>
                        <th style={{
                          padding: '10px 14px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: '#64748b',
                          textAlign: 'left',
                          borderBottom: '1px solid #1e293b',
                          minWidth: 220,
                        }}>Feature</th>
                        {COLS.map((col, ci) => (
                          <th key={col} style={{
                            padding: '10px 10px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            textAlign: 'center',
                            borderBottom: '1px solid #1e293b',
                            whiteSpace: 'nowrap',
                            color: ci === 0 ? '#60a5fa' : '#64748b',
                            background: ci === 0 ? '#0f2040' : undefined,
                            minWidth: 105,
                          }}>
                            {col}
                            {ci === 0 && (
                              <div style={{
                                fontSize: '0.56rem',
                                color: '#4ade80',
                                fontWeight: 700,
                                letterSpacing: '0.04em',
                                marginTop: 2,
                              }}>WEB + MOBILE ▲</div>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sec.rows.map((row, ri) => (
                        <tr key={ri} style={{
                          borderBottom: '1px solid #1e293b',
                          background: ri % 2 === 0 ? 'transparent' : '#0a0f1a',
                        }}>
                          <td style={{
                            padding: '9px 14px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#e2e8f0',
                            textAlign: 'left',
                          }}>{row.feature}</td>
                          {row.values.map((val, vi) => (
                            <td key={vi} style={{
                              padding: '9px 10px',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              background: vi === 0 ? '#0f2040' : undefined,
                            }}>
                              <CellDisplay val={val} isFirst={vi === 0} />
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
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f22, #1e1b4b22)',
        border: '1px solid #1e40af44',
        borderRadius: 14,
        padding: '24px 28px',
        maxWidth: 960,
        margin: '28px auto 0',
      }}>
        <h2 style={{ color: '#60a5fa', fontSize: '1rem', marginBottom: 14, textAlign: 'center' }}>
          💡 Why TrussCTR Wins
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 12,
        }}>
          {WHY_WIN.map(item => (
            <div key={item.val} style={{ background: '#1e293b', borderRadius: 10, padding: 14 }}>
              <div style={{ color: '#34d399', fontSize: '1.1rem', fontWeight: 800 }}>{item.val}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: 4 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ textAlign: 'center', marginTop: 28, color: '#475569', fontSize: '0.72rem' }}>
        <p>
          © 2026 <span style={{ color: '#3b82f6' }}>TrussCTR</span> by 614 Restore LLC &nbsp;·&nbsp;
          Competitor data based on publicly available pricing as of March 2026. Subject to change.<br />
          ✔ Included &nbsp; ✘ Not available &nbsp; ~ Partial / Add-on / Limited / requires upgrade
        </p>
      </div>
    </div>
  );
};

// ─── Pricing Card Sub-Component ────────────────────────────────────────────────
function PricingCard({ card }: { card: typeof PRICING_CARDS[number] }) {
  return (
    <div style={{
      background: card.highlight ? 'linear-gradient(135deg, #0f2040, #0f1d3d)' : '#1e293b',
      border: card.highlight ? '1px solid #3b82f6' : '1px solid #334155',
      boxShadow: card.highlight ? '0 0 0 2px #3b82f633' : undefined,
      borderRadius: 12,
      padding: '18px 14px 14px',
      textAlign: 'center',
      position: 'relative',
    }}>
      {card.badge && (
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
        }}>{card.badge}</div>
      )}
      <div style={{
        fontSize: '0.82rem',
        fontWeight: 700,
        color: card.highlight ? '#60a5fa' : '#e2e8f0',
        marginBottom: 4,
      }}>{card.name}</div>
      <div style={{
        fontSize: '0.65rem',
        color: '#64748b',
        marginBottom: 10,
        fontStyle: 'italic',
      }}>{card.note}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {card.plans.map(plan => (
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
    </div>
  );
}

export default PlanComparisonChart;

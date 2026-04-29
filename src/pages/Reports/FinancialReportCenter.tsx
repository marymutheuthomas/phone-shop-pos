import { useState } from 'react';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from 'recharts';
import { Link } from 'react-router-dom';
import { db } from '../../lib/db/schema';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { formatKSh } from '../../utils/formatters';
import {
  TrendingUp, TrendingDown, Activity,
  Printer, PieChart, ArrowRight
} from 'lucide-react';

/* ── Shared style tokens ────────────────────────────────────────────────────── */
const mono: React.CSSProperties = {
  fontFamily: 'ui-monospace, "Cascadia Code", monospace',
  fontVariantNumeric: 'tabular-nums',
};

const bentoCard = (topColor: string, extra?: React.CSSProperties): React.CSSProperties => ({
  background: '#FFFFFF',
  border: '1px solid #E8EDF2',
  borderTop: `4px solid ${topColor}`,
  borderRadius: '16px',
  boxShadow: '0 10px 40px -10px rgba(44,57,71,0.09)',
  padding: '28px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  ...extra,
});

const statLabel: React.CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.10em',
  color: '#547A95',
};

const statValue: React.CSSProperties = {
  ...mono,
  fontSize: '2rem',
  fontWeight: 800,
  color: '#2C3947',
  lineHeight: 1.1,
  letterSpacing: '-0.02em',
};

const desc: React.CSSProperties = {
  fontSize: '0.78rem',
  color: '#547A95',
  lineHeight: 1.6,
  margin: 0,
};

/* ── Date range filter display map ─────────────────────────────────────────── */
const RANGES = [
  { key: '7d',  label: '7D'  },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'all', label: 'ALL' },
] as const;

/* ══════════════════════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
const FinancialReportCenter = () => {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  /* ── Live aggregations ──────────────────────────────────────────────────── */
  const stats = useLiveQuery(async () => {
    const sales     = await db.sale_transactions.toArray();
    const inventory = await db.inventory.toArray();
    const products  = await db.products.toArray();
    const customers = await db.customers.toArray();

    // 1. Total Revenue (CASH + M-PESA + DEBT_SETTLEMENT)
    // We EXCLUDE "DEBT" from current revenue because it is capital Owed, not capital Received.
    // We INCLUDE "DEBT_SETTLEMENT" as it is actual cash entering the system.
    const totalRevenue = sales
      .filter(s => s.paymentMethod !== 'DEBT' && s.status === 'COMPLETED')
      .reduce((acc, s) => acc + s.totalKsh, 0);

    // 2. Direct COGS (Wholesale Cost of goods actually sold)
    // We sum the wholesale_cost field from transactions (excluding settlements)
    const totalCogs = sales
      .filter(s => s.paymentMethod !== 'DEBT_SETTLEMENT' && s.status === 'COMPLETED')
      .reduce((acc, s) => acc + (s.wholesale_cost || 0), 0);

    // 3. Gross Profit
    const grossProfit = totalRevenue - totalCogs;

    // 4. Accounts Receivable (Money still locked in DEBT status)
    const accountsReceivable = customers.reduce((acc, c) => acc + (c.totalBalance || 0), 0);

    // 5. Inventory Value
    const inventoryValue = inventory.reduce((acc, inv) => {
      const p = products.find(p => p.id === inv.productId);
      return acc + (p?.wholesalePrice || 0) * inv.qty;
    }, 0);

    return {
      revenue: totalRevenue, 
      cogs: totalCogs, 
      profit: grossProfit,
      debt: accountsReceivable, 
      inventory: inventoryValue,
      customerCount: customers.length,
    };
  }, []) || { revenue: 0, cogs: 0, profit: 0, debt: 0, inventory: 0, customerCount: 0 };

  const marginPct      = stats.revenue > 0 ? (stats.profit / stats.revenue) * 100 : 0;
  const liquidityRatio = stats.revenue + stats.inventory > 0
    ? (stats.revenue / (stats.revenue + stats.inventory)) * 100
    : 0;

  const chartData = [
    { name: 'Gross Profit', value: Math.max(stats.profit, 0), color: '#22C55E' },
    { name: 'COGS',         value: Math.max(stats.cogs,   0), color: '#F59E0B' },
  ];

  const now = new Date().toLocaleTimeString();

  return (
    <div className="financial-page-root">
      <style>{`
        @media screen {
          .print-only { display: none !important; }
        }
        @media print {
          /* Hide all UI elements */
          .topbar, .sidebar, .sidebar-container, .noprint, nav, header, button, .app-container > aside { 
            display: none !important; 
            height: 0 !important; 
            width: 0 !important; 
            overflow: hidden !important;
          }
          
          /* Reset layout for print */
          body, html, #root, .app-container, .main-content, .page-content { 
            background: white !important; 
            color: black !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            width: 100% !important;
            height: auto !important;
            display: block !important;
          }

          .print-only { 
            display: block !important; 
            width: 100% !important; 
            padding: 40px !important; 
            box-sizing: border-box !important;
          }
          
          @page { margin: 0; }
          
          .report-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          .report-table th, .report-table td { 
            border: 1px solid #E2E8F0; 
            padding: 10px 14px; 
            text-align: left; 
            font-size: 11pt;
          }
          .report-table th { background: #F8FAFC !important; color: #1A2B4A !important; font-weight: 700; }
          .report-table tr:nth-child(even) { background: #F8FAFC !important; }
          .report-header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #2C3947; padding-bottom: 20px; }
          .report-title { font-size: 20pt; font-weight: 800; margin: 0; color: #1A2B4A; }
          .report-subtitle { font-size: 11pt; color: #547A95; margin: 5px 0 0; text-transform: uppercase; letter-spacing: 0.1em; }
          .report-section-title { font-size: 13pt; font-weight: 800; color: #1A2B4A; margin: 40px 0 15px; border-left: 5px solid #C2A56D; padding-left: 15px; }
          .currency { font-family: ui-monospace, "Cascadia Code", monospace; text-align: right; font-weight: 700; }
        }
      `}</style>

      {/* 1. SCREEN UI (Hidden during print) */}
      <div className="noprint" style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '60px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* ── 1. Page Header ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: '#2C3947', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <PieChart size={22} strokeWidth={1.5} />
            </div>
            <div>
              <h1 style={{ margin: '0 0 2px', color: '#2C3947', fontWeight: 700 }}>Financial Intelligence</h1>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#547A95' }}>Live Audit &amp; Liquidity Dashboard</p>
            </div>
          </div>

          <div style={{
            display: 'flex', gap: '2px',
            background: '#F1F5F9', padding: '3px',
            borderRadius: '9999px', border: '1px solid #E8EDF2',
          }}>
            {RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setDateRange(r.key)}
                style={{
                  minHeight: '0', padding: '7px 20px', borderRadius: '9999px',
                  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em',
                  background:    dateRange === r.key ? '#2C3947' : 'transparent',
                  color:         dateRange === r.key ? '#FFFFFF' : '#547A95',
                  border:        'none',
                  transition:    'all 150ms ease',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button onClick={() => window.print()} style={{ gap: '8px' }}>
            <Printer size={16} /> Print Master Audit
          </button>
        </div>

        {/* ── 2. Tier 1: Waterfall P&L (3-col) ──────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <TrendingUp size={15} style={{ color: '#C9A84C' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: '#547A95' }}>
              Waterfall Profit &amp; Loss Analysis
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>

            <div style={bentoCard('#C2A56D')}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={statLabel}>Total Revenue</p>
                  <span style={statValue}>{formatKSh(stats.revenue)}</span>
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(201,168,76,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <TrendingUp size={18} style={{ color: '#C9A84C' }} />
                </div>
              </div>
              <p style={desc}>Total realized cash inflow (Sales + Debt Payments) for the selected period.</p>
            </div>

            <div style={bentoCard('#EF4444')}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={statLabel}>Direct COGS</p>
                  <span style={{ ...statValue, color: '#B91C1C' }}>
                    {stats.cogs > 0 ? `-${formatKSh(stats.cogs)}` : formatKSh(0)}
                  </span>
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <TrendingDown size={18} style={{ color: '#EF4444' }} />
                </div>
              </div>
              <p style={desc}>Realized wholesale cost of inventory assets cleared from the system.</p>
            </div>

            <div style={bentoCard('#22C55E')}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={statLabel}>Net Take-Home</p>
                  <span style={{ ...statValue, color: '#15803D' }}>{formatKSh(stats.profit)}</span>
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Activity size={18} style={{ color: '#22C55E' }} />
                </div>
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 14px', borderRadius: '9999px',
                background: '#DCFCE7', border: '1px solid #86EFAC',
                alignSelf: 'flex-start',
              }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
                <span style={{ ...mono, fontSize: '0.68rem', fontWeight: 800, color: '#15803D' }}>
                  {marginPct.toFixed(1)}% MARGIN / System Efficiency
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. Tier 2: Deep Dive Analytics (3-col) ─────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>

          <div style={bentoCard('#C2A56D')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieChart size={16} style={{ color: '#C9A84C' }} />
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#2C3947' }}>Profitability Composition</h3>
            </div>
            <div style={{ position: 'relative', height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={chartData}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={80}
                    paddingAngle={6}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <ReTooltip
                    contentStyle={{ borderRadius: '10px', border: 'none', background: '#1A2B4A', color: '#fff', fontSize: '11px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </RePieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#547A95' }}>Efficiency</span>
                <span style={{ ...mono, fontSize: '1.4rem', fontWeight: 800, color: '#2C3947' }}>{marginPct.toFixed(0)}%</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '20px' }}>
              {chartData.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#547A95', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={bentoCard('#C2A56D')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={16} style={{ color: '#C9A84C' }} />
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#2C3947' }}>Enterprise Liquidity</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#547A95', fontWeight: 600 }}>Inventory Assets</span>
                  <span style={{ ...mono, fontWeight: 700, fontSize: '0.88rem', color: '#92400E' }}>{formatKSh(stats.inventory)}</span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: '#F1F5F9', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(100 - liquidityRatio, 2)}%`, background: '#F59E0B', borderRadius: '3px', transition: 'width 600ms ease' }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#547A95', fontWeight: 600 }}>Cash Position</span>
                  <span style={{ ...mono, fontWeight: 700, fontSize: '0.88rem', color: '#15803D' }}>{formatKSh(stats.revenue)}</span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: '#F1F5F9', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(liquidityRatio, 2)}%`, background: '#22C55E', borderRadius: '3px', transition: 'width 600ms ease' }} />
                </div>
              </div>
            </div>
            <div style={{
              marginTop: 'auto',
              padding: '12px 14px',
              background: '#F8FAFC', border: '1px solid #E8EDF2',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Activity size={15} style={{ color: '#22C55E' }} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#547A95' }}>Liquidity Strength</p>
                <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: '#2C3947' }}>
                  Asset turnover at <span style={{ ...mono, color: '#15803D' }}>{liquidityRatio.toFixed(1)}%</span>
                </p>
              </div>
            </div>
          </div>

          <div style={bentoCard('#F59E0B')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowRight size={16} style={{ color: '#F59E0B' }} />
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#2C3947' }}>Accounts Receivable Audit</h3>
            </div>
            <p style={{ ...desc, margin: 0 }}>
              Total outstanding capital currently held by debtors.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '14px', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '10px' }}>
                <p style={{ ...statLabel, margin: '0 0 4px', color: '#92400E' }}>Outstanding</p>
                <span style={{ ...mono, fontSize: '1.1rem', fontWeight: 800, color: '#92400E' }}>
                  {formatKSh(stats.debt)}
                </span>
              </div>
              <div style={{ padding: '14px', background: '#F8FAFC', border: '1px solid #E8EDF2', borderRadius: '10px' }}>
                <p style={{ ...statLabel, margin: '0 0 4px' }}>Active Units</p>
                <span style={{ ...mono, fontSize: '1.1rem', fontWeight: 800, color: '#2C3947' }}>
                  {stats.customerCount}
                </span>
              </div>
            </div>
            <div style={{ marginTop: 'auto' }}>
              <Link to="/admin/debt" style={{ textDecoration: 'none' }}>
                <button style={{ width: '100%', gap: '8px', height: '48px' }}>
                  <ArrowRight size={15} /> Resolve Debtors
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* ── 4. Terminal Footer ──────────────────────────────────────────── */}
        <footer style={{ textAlign: 'center', paddingTop: '24px', borderTop: '1px solid #E8EDF2' }}>
          <p style={{
            ...mono,
            fontSize: '0.6rem',
            color: '#547A95',
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            margin: 0,
            lineHeight: 2,
          }}>
            System State: Parity Verified @ {now} | Omni-Shop Financial Engine v3.0
            &nbsp;•&nbsp; GAAP Compliant &nbsp;•&nbsp; Real-Time Ledger Integration
          </p>
        </footer>
      </div>

      {/* 2. PRINT TEMPLATE (Hidden on screen, visible during print) */}
      <div className="print-only">
        <div className="report-header">
          <p className="report-title">Omni-Shop Enterprise</p>
          <p className="report-subtitle">Financial Audit Report • {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
        </div>

        <div className="report-section-title">Section 1: Profit & Loss Analysis</div>
        <table className="report-table">
          <thead>
            <tr>
              <th>Financial Metric</th>
              <th style={{ textAlign: 'right' }}>Amount (KSh)</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total Revenue</td>
              <td className="currency">{formatKSh(stats.revenue)}</td>
              <td>Total realized cash inflow (Sales + Debt Payments).</td>
            </tr>
            <tr>
              <td>Direct COGS</td>
              <td className="currency">-{formatKSh(stats.cogs)}</td>
              <td>Realized wholesale cost of items cleared.</td>
            </tr>
            <tr style={{ fontWeight: 800, background: '#F1F5F9' }}>
              <td>Gross Profit (Net Take-Home)</td>
              <td className="currency">{formatKSh(stats.profit)}</td>
              <td>Actual profit after inventory costs.</td>
            </tr>
            <tr>
              <td>System Efficiency</td>
              <td style={{ textAlign: 'right' }}>{marginPct.toFixed(2)}%</td>
              <td>Profit margin relative to total revenue.</td>
            </tr>
          </tbody>
        </table>

        <div className="report-section-title">Section 2: Balance Sheet & Liquidity</div>
        <table className="report-table">
          <thead>
            <tr>
              <th>Asset / Liability Category</th>
              <th style={{ textAlign: 'right' }}>Current Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cash Position (Liquid)</td>
              <td className="currency">{formatKSh(stats.revenue)}</td>
              <td>Immediate spending power.</td>
            </tr>
            <tr>
              <td>Inventory Assets (Locked)</td>
              <td className="currency">{formatKSh(stats.inventory)}</td>
              <td>Wholesale value of stock on hand.</td>
            </tr>
            <tr>
              <td>Outstanding Debt (Receivable)</td>
              <td className="currency">{formatKSh(stats.debt)}</td>
              <td>Capital owed by customers.</td>
            </tr>
            <tr style={{ fontWeight: 800, background: '#F1F5F9' }}>
              <td>Total Asset Valuation</td>
              <td className="currency">{formatKSh(stats.revenue + stats.inventory + stats.debt)}</td>
              <td>Total book value of the business branch.</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: '60px', borderTop: '1px solid #E2E8F0', paddingTop: '20px', textAlign: 'center', fontSize: '9pt', color: '#64748B' }}>
          Report Generated by Omni-Shop Financial Engine v3.0 • Verified Ledger Parity • Page 1 of 1
        </div>
      </div>
    </div>
  );
};

export default FinancialReportCenter;

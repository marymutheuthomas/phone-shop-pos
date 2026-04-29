import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useForensics } from '../../hooks/useForensics';
import { ShieldCheck, TrendingUp, Ghost, Wifi } from 'lucide-react';
import { formatKSh } from '../../utils/formatters';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { db } from '../../lib/db/schema';

const mono: React.CSSProperties = {
  fontFamily: 'ui-monospace, "Cascadia Code", monospace',
  fontVariantNumeric: 'tabular-nums',
};

const TRENDS = [
  'Solar Home Lighting Systems',
  'Refurbished Enterprise Laptops',
  '2-in-1 Commercial Blenders',
  'M-Pesa Integrated Mobile Accessories',
];

/* ── Shared card shell ─────────────────────────────────────────────────────── */
const bentoCard = (topColor: string): React.CSSProperties => ({
  background: '#FFFFFF',
  border: '1px solid var(--surface-border)',
  borderTop: `4px solid ${topColor}`,
  borderRadius: 'var(--radius-lg)',
  boxShadow: '0 10px 40px -10px rgba(44,57,71,0.08)',
  display: 'flex',
  flexDirection: 'column',
});

/* ── Pulsing dot ───────────────────────────────────────────────────────────── */
const PulseDot = () => (
  <span style={{ position: 'relative', display: 'inline-flex', width: '10px', height: '10px', flexShrink: 0 }}>
    <span style={{
      position: 'absolute', inset: 0, borderRadius: '50%',
      background: '#22C55E', opacity: 0.5,
      animation: 'ping 1.4s cubic-bezier(0,0,0.2,1) infinite',
    }} />
    <span style={{ position: 'relative', width: '10px', height: '10px', borderRadius: '50%', background: '#22C55E' }} />
    <style>{`@keyframes ping { 75%,100%{transform:scale(2);opacity:0} }`}</style>
  </span>
);

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════════ */
export const TrendPulse = () => {
  const { user } = useAuth();
  const { detectPhantomInventory } = useForensics();
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (user) detectPhantomInventory(user.role === 'ADMIN', user.shopId).then(setAlerts);
    const iv = setInterval(() => {
      if (user) detectPhantomInventory(user.role === 'ADMIN', user.shopId).then(setAlerts);
    }, 5000);
    return () => clearInterval(iv);
  }, [user]);

  /* ── Live KPI data ─────────────────────────────────────────────────────── */
  const kpiData = useLiveQuery(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySales = await db.sale_transactions
      .filter(tx => new Date(tx.timestamp) >= today && tx.status !== 'PENDING')
      .toArray();
    const todayRevenue = todaySales.reduce((sum, tx) => sum + (tx.totalKsh || 0), 0);

    const productCount = await db.products.count();

    const customers = await db.customers.toArray();
    const totalDebt = customers.reduce((sum, c) => sum + (c.totalBalance || 0), 0);

    return { todayRevenue, productCount, totalDebt };
  }, []) || { todayRevenue: 0, productCount: 0, totalDebt: 0 };

  /* ── KPI card definitions ─────────────────────────────────────────────── */
  const kpis = [
    {
      label:    "Today's Revenue",
      value:    formatKSh(kpiData.todayRevenue),
      isNumeric: true,
    },
    {
      label:    'Total Active Products',
      value:    String(kpiData.productCount),
      isNumeric: true,
    },
    {
      label:    'Outstanding Debt',
      value:    formatKSh(kpiData.totalDebt),
      isNumeric: true,
    },
    {
      label:    'Network Link',
      value:    'Online',
      isNumeric: false,
      dot:      true,
    },
  ];

  return (
    <div style={{ marginTop: '28px' }}>

      {/* ── KPI Ribbon ────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
        gap: '20px',
        marginBottom: '24px',
      }}>
        {kpis.map((kpi, i) => (
          <div key={i} style={{ ...bentoCard('#C2A56D'), padding: '20px 24px', gap: '8px' }}>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.10em', color: '#547A95',
            }}>
              {kpi.label}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              {kpi.dot && <PulseDot />}
              <span style={{
                ...(kpi.isNumeric ? mono : {}),
                fontSize: '1.35rem', fontWeight: 800,
                color: '#2C3947',
                letterSpacing: kpi.isNumeric ? '-0.02em' : 'normal',
              }}>
                {kpi.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Bento Grid: Phantom Watch + Trend Core ────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: '24px',
      }}>

        {/* Card 1: Phantom Inventory Watch */}
        <div style={{ ...bentoCard('#22C55E'), padding: '28px', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <ShieldCheck size={20} style={{ color: '#16A34A' }} />
            </div>
            <h3 style={{ margin: 0, color: 'var(--navy)' }}>Phantom Inventory Watch</h3>
          </div>

          {alerts.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem', color: '#547A95', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>✓</span> No Internal Leakage Detected.
              </p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                All inventory vectors within normal thresholds.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '320px' }}>
              {alerts.map(a => (
                <div key={a.id} style={{ padding: '14px 16px', border: '1px solid #FCA5A5', borderLeft: '4px solid #EF4444', borderRadius: '8px', background: '#FFF1F1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--navy)' }}>{a.name}</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#B91C1C', background: '#FEE2E2', padding: '2px 8px', borderRadius: '12px' }}>High Risk</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span>Node: <strong style={{ color: 'var(--navy)' }}>{a.shopName}</strong></span>
                    <span style={mono}>Stock: {a.stockCount} units</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #FCA5A5', fontSize: '0.72rem' }}>
                    <span style={{ color: '#B91C1C' }}>0 sales in 48hrs</span>
                    <span style={{ ...mono, fontWeight: 700, color: '#B91C1C' }}>
                      Est. loss: {formatKSh(a.lostRevenueKsh)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 2: 2026 Trend Core */}
        <div style={{ ...bentoCard('#C2A56D'), padding: '28px', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(201,168,76,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <TrendingUp size={20} style={{ color: '#C9A84C' }} />
            </div>
            <h3 style={{ margin: 0, color: 'var(--navy)' }}>2026 Trend Core</h3>
          </div>

          <p style={{ margin: 0, fontSize: '0.875rem', color: '#547A95', lineHeight: 1.65 }}>
            Real-time velocity tracking of the Kenyan retail landscape, monitoring Jumia/Kilimall demand and regional SME growth vectors:
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {TRENDS.map(trend => (
              <span key={trend} style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px',
                background: '#F8FAFC', border: '1px solid #E2E8F0',
                borderRadius: '9999px',
                fontSize: '0.82rem', fontWeight: 500, color: '#2C3947',
                whiteSpace: 'nowrap',
              }}>
                <Ghost size={13} style={{ color: '#C2A56D', flexShrink: 0 }} />
                {trend}
              </span>
            ))}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
            <button style={{ width: '100%', gap: '8px' }}>
              <Wifi size={16} />
              Open Prediction Models
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendPulse;

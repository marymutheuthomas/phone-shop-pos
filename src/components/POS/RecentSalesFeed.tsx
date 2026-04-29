import { useState } from 'react';
import { db } from '../../lib/db/schema';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { useAuth } from '../../context/AuthContext';
import { formatKSh } from '../../utils/formatters';
import { Clock, ShoppingBag, CreditCard, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

const mono: React.CSSProperties = {
  fontFamily: 'ui-monospace, "Cascadia Code", monospace',
  fontVariantNumeric: 'tabular-nums',
};

export const RecentSalesFeed = () => {
  const { user } = useAuth();
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  const recentSales = useLiveQuery(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const txs = await db.sale_transactions
      .where('shopId').equals(user?.shopId || '')
      .filter(tx => new Date(tx.timestamp) >= today)
      .reverse()
      .limit(20)
      .toArray();

    const saleIds    = txs.map(t => t.id);
    const allItems   = await db.sale_items.where('saleId').anyOf(saleIds).toArray();
    const productIds = allItems.map(i => i.productId);
    const products   = await db.products.where('id').anyOf(productIds).toArray();

    return txs.map(tx => ({
      ...tx,
      items: allItems.filter(ai => ai.saleId === tx.id).map(ai => ({
        ...ai,
        product: products.find(p => p.id === ai.productId)
      }))
    }));
  }, [user?.shopId]) || [];

  return (
    <div>
      {/* Card header */}
      <div style={{
        padding: '18px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--surface-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShoppingBag size={18} style={{ color: 'var(--gold)' }} />
          <div>
            <h3 style={{ margin: 0 }}>Today's Activity</h3>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Real-time checkout stream</p>
          </div>
        </div>
        <span style={{ ...mono, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          {recentSales.length} transactions
        </span>
      </div>

      {/* ── Master Table ── */}
      <div style={{ overflowX: 'auto' }}>
        {recentSales.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px', gap: '10px', textAlign: 'center' }}>
            <Clock size={36} style={{ color: '#6B88A8', opacity: 0.4 }} />
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>No activity recorded for this shift yet.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', background: '#fff' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--surface-border)' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--text-muted)', background: '#fff', whiteSpace: 'nowrap' }}>Time</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--text-muted)', background: '#fff' }}>Items</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--text-muted)', background: '#fff' }}>Method</th>
                <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--text-muted)', background: '#fff', whiteSpace: 'nowrap' }}>Total</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--text-muted)', background: '#fff', whiteSpace: 'nowrap' }}>Status</th>
                <th style={{ padding: '14px 20px', width: '40px', background: '#fff' }}></th>
              </tr>
            </thead>
            <tbody>
              {recentSales.map(tx => {
                const isExpanded  = expandedSaleId === tx.id;
                const isDebt      = tx.method === 'DEBT';
                const isPending   = tx.status === 'PENDING';
                const itemSummary = tx.items.map(i => `${i.qty}× ${i.product?.name || 'Item'}`).join(', ');

                return (
                  <>
                    <tr
                      key={tx.id}
                      onClick={() => setExpandedSaleId(isExpanded ? null : tx.id)}
                      style={{
                        borderBottom: '1px solid var(--surface-border)',
                        cursor: 'pointer',
                        background: isExpanded ? 'rgba(26,43,74,0.02)' : '#fff',
                        transition: 'background 150ms ease',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F4F7FA'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = isExpanded ? 'rgba(26,43,74,0.02)' : '#fff'}
                    >
                      {/* Time */}
                      <td style={{ padding: '18px 20px', verticalAlign: 'middle', color: 'var(--text-muted)', ...mono, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      {/* Items summary */}
                      <td style={{ padding: '18px 20px', verticalAlign: 'middle', maxWidth: '260px' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--navy)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {itemSummary}
                        </p>
                        {isDebt && (
                          <p style={{ margin: 0, fontSize: '0.72rem', color: '#92400E' }}>{tx.customerName}</p>
                        )}
                      </td>

                      {/* Method */}
                      <td style={{ padding: '18px 20px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CreditCard size={13} style={{ color: isDebt ? '#92400E' : 'var(--text-muted)' }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isDebt ? '#92400E' : 'var(--text-secondary)' }}>
                            {tx.method}
                          </span>
                        </div>
                      </td>

                      {/* Total */}
                      <td style={{ padding: '18px 20px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <span style={{ ...mono, fontWeight: 700, fontSize: '0.9rem', color: 'var(--navy)' }}>
                          {formatKSh(tx.totalKsh)}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td style={{ padding: '18px 20px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: '20px',
                          fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                          background: isPending ? '#FEF3C7' : '#DCFCE7',
                          color:      isPending ? '#92400E' : '#15803D',
                          border: isPending ? '1px solid #FCD34D' : 'none',
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                        }}>
                          {isPending && <AlertCircle size={9} />}
                          {isPending ? 'Pending' : '✓ Done'}
                        </span>
                      </td>

                      {/* Expand toggle */}
                      <td style={{ padding: '18px 12px', verticalAlign: 'middle', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </td>
                    </tr>

                    {/* Expanded receipt */}
                    {isExpanded && (
                      <tr key={`${tx.id}-exp`} style={{ borderBottom: '1px solid var(--surface-border)', background: '#F8FAFC' }}>
                        <td colSpan={6} style={{ padding: '0 20px 16px 48px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                <th style={{ padding: '8px 0', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Product</th>
                                <th style={{ padding: '8px 0', textAlign: 'right', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Qty</th>
                                <th style={{ padding: '8px 0', textAlign: 'right', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Line Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tx.items.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                  <td style={{ padding: '8px 0', color: 'var(--navy)', fontWeight: 500 }}>{item.product?.name || 'Unknown'}</td>
                                  <td style={{ padding: '8px 0', textAlign: 'right', ...mono, color: 'var(--text-muted)' }}>{item.qty}</td>
                                  <td style={{ padding: '8px 0', textAlign: 'right', ...mono, fontWeight: 700, color: 'var(--navy)' }}>{formatKSh(item.unitPrice * item.qty)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td colSpan={2} style={{ padding: '10px 0 0', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Grand Total</td>
                                <td style={{ padding: '10px 0 0', textAlign: 'right', ...mono, fontWeight: 800, fontSize: '0.95rem', color: 'var(--navy)' }}>{formatKSh(tx.totalKsh)}</td>
                              </tr>
                            </tfoot>
                          </table>

                          {isDebt && (
                            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#92400E' }}>
                              <AlertCircle size={12} />
                              Debt record for {tx.customerName || 'Anonymous'}. Pending Admin verification.
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

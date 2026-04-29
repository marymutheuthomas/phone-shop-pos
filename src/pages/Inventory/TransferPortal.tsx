import { useState } from 'react';
import { db } from '../../lib/db/schema';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../hooks/useInventory';
import { formatKSh } from '../../utils/formatters';
import { Package, Truck, ArrowRight, CheckCircle, Clock, X } from 'lucide-react';

const mono: React.CSSProperties = {
  fontFamily: 'ui-monospace, "Cascadia Code", monospace',
  fontVariantNumeric: 'tabular-nums',
};

const TransferPortal = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { handleOutgoingTransfer, handleIncomingTransfer } = useInventory();

  const [selectedShop,    setSelectedShop]    = useState('shop_techkys');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [transferQty,     setTransferQty]     = useState(1);
  const [confirmQtys,     setConfirmQtys]     = useState<Record<string, number>>({});

  const products        = useLiveQuery(() => db.products.toArray(), []) || [];
  const pendingTransfers = useLiveQuery(() =>
    db.transfers.where('status').equals('PENDING').toArray(), []
  ) || [];

  const handleDispatch = async () => {
    if (!selectedProduct || transferQty < 1) return;
    try {
      await handleOutgoingTransfer(user!.id, user!.shopId, selectedShop, selectedProduct, transferQty);
      alert('Stock sent! Awaiting shop confirmation.');
      setTransferQty(1);
    } catch (err: any) { alert(err.message); }
  };

  const handleReceive = async (transferId: string) => {
    const verified = confirmQtys[transferId] || 0;
    const transfer = pendingTransfers.find(t => t.id === transferId);
    if (verified !== transfer?.qty) {
      alert(`Count mismatch: you entered ${verified} but the sender says ${transfer?.qty ?? 0}. Please double-check.`);
      return;
    }
    try {
      await handleIncomingTransfer(transferId, user!.id);
      alert('Stock received and added to inventory.');
    } catch (err: any) { alert(err.message); }
  };

  const visibleTransfers = pendingTransfers.filter(t => isAdmin ? true : t.toShopId === user?.shopId);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '60px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '14px',
          background: 'var(--navy)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <ArrowRight size={22} />
        </div>
        <div>
          <h1 style={{ marginBottom: '2px' }}>Move Stock</h1>
          <p style={{ fontSize: '0.82rem', margin: 0 }}>Send and receive items between different shop locations</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '32px', alignItems: 'start' }}>

        {/* ── Dispatch Form (Admin only) ───────────────────────────────── */}
        {isAdmin && (
          <div className="card" style={{ borderTop: '4px solid var(--gold)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
              <Truck size={18} style={{ color: 'var(--gold)' }} />
              <h3 style={{ margin: 0 }}>Send Stock to Another Shop</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label>Send To (Destination Shop)</label>
                <select style={{ height: '48px' }} value={selectedShop} onChange={e => setSelectedShop(e.target.value)}>
                  <option value="shop_techplanet">Tech Planet Main Shop</option>
                  <option value="shop_techkys">Techkys</option>
                  <option value="shop_brilliance">Brilliance Stationers</option>
                  <option value="shop_taf1">Taf 1</option>
                  <option value="shop_taf2">Taf 2</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label>Select Item</label>
                <select style={{ height: '48px' }} value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                  <option value="">-- Choose Product --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label>How Many? (Quantity)</label>
                <input
                  type="number" min="1"
                  value={transferQty}
                  onChange={e => setTransferQty(parseInt(e.target.value))}
                  style={{ height: '48px', ...mono }}
                />
              </div>

              <button onClick={handleDispatch} style={{ width: '100%', height: '48px', marginTop: '8px' }}>
                Send Stock Now
              </button>
            </div>
          </div>
        )}

        {/* ── Incoming Shipments ──────────────────────────────────────── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', borderTop: '4px solid var(--navy)' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={18} style={{ color: 'var(--gold)' }} />
            <h3 style={{ margin: 0 }}>Stock Coming In</h3>
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {visibleTransfers.length} pending
            </span>
          </div>

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {visibleTransfers.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: '12px' }}>
                <CheckCircle size={48} style={{ color: '#22C55E', opacity: 0.3 }} />
                <p style={{ margin: 0, color: 'var(--text-muted)', fontWeight: 600 }}>No incoming stock right now.</p>
              </div>
            ) : (
              visibleTransfers.map(transfer => {
                const p = products.find(prod => prod.id === transfer.productId);
                return (
                  <div key={transfer.id} style={{
                    padding: '20px',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '12px',
                    background: '#F8FAFC',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                      <div>
                        <h4 style={{ margin: '0 0 4px', color: 'var(--navy)', fontSize: '0.95rem' }}>{p?.name || 'Unknown Product'}</h4>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: '#547A95' }}>From: <strong>{transfer.fromShopId}</strong></p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ ...mono, fontSize: '1.4rem', fontWeight: 800, color: 'var(--navy)', lineHeight: 1 }}>
                          {transfer.qty}
                        </div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#547A95', textTransform: 'uppercase' }}>Units</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '16px', borderTop: '1px solid #E8EDF2' }}>
                      {!isAdmin && (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.75rem', color: '#547A95' }}>Confirm Received Count</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input
                                type="number"
                                placeholder="Count…"
                                value={confirmQtys[transfer.id] || ''}
                                onChange={e => setConfirmQtys({ ...confirmQtys, [transfer.id]: parseInt(e.target.value) })}
                                style={{ flex: 1, height: '44px', ...mono }}
                              />
                              <button onClick={() => handleReceive(transfer.id)} style={{ height: '44px', padding: '0 16px', fontSize: '0.8rem' }}>
                                Confirm Received
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                      {isAdmin && (
                         <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#92400E', fontSize: '0.75rem', fontWeight: 600 }}>
                           <Clock size={14} /> Waiting for {transfer.toShopId} to confirm.
                         </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferPortal;

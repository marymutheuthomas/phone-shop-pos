import { useState } from 'react';
import { Search, ShoppingBag, Terminal, CheckCircle, ShoppingCart } from 'lucide-react';
import Cart from '../../components/POS/Cart';
import { RecentSalesFeed } from '../../components/POS/RecentSalesFeed';
import { formatKSh } from '../../utils/formatters';
import { db } from '../../lib/db/schema';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { useAuth } from '../../context/AuthContext';

const POSDash = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const products = useLiveQuery(async () => {
    let items = await db.products.toArray();
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
      );
    }
    const inventory = user?.shopId
      ? await db.inventory.where('shopId').equals(user.shopId).toArray()
      : await db.inventory.toArray();
    return items.map(p => {
      const itemStock = inventory.find(inv => inv.productId === p.id);
      return { ...p, availableQty: itemStock ? itemStock.qty : 0 };
    });
  }, [searchQuery]) || [];

  const addToCart = async (productId: string) => {
    const inv = await db.inventory.where({ shopId: user!.shopId, productId }).first();
    if (!inv || inv.qty <= 0) {
      alert('❌ Out of stock. This product cannot be added to the cart.');
      return;
    }
    const existing = await db.active_cart.where({ productId }).first();
    if (existing) {
      if (existing.qty >= inv.qty) {
        alert(`⚠️ Only ${inv.qty} units available. Cannot add more.`);
        return;
      }
      await db.active_cart.update(existing.id!, { qty: existing.qty + 1 });
    } else {
      await db.active_cart.add({
        id: `cart_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        productId,
        qty: 1,
        priceType: 'RETAIL'
      } as any);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Page Header ───────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', maxWidth: '400px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'var(--navy)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <Terminal size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ marginBottom: '0', fontSize: 'clamp(1.25rem, 4vw, 1.75rem)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Checkout</h1>
            <p style={{ fontSize: '0.75rem', margin: 0, color: 'var(--text-muted)' }}>
              {user?.shopName} · {user?.name}
            </p>
          </div>
        </div>

        {/* Search bar */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flexGrow: 1, width: '100%', maxWidth: '500px' }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search SKU or Name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ 
              paddingLeft: '44px', 
              width: '100%',
              height: '48px',
              borderRadius: '12px',
              border: '1.5px solid var(--surface-border)'
            }}
          />
        </div>
      </div>

      {/* ── Main 2-col grid: Products | Cart ─────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(1, 1fr)',    /* mobile: single column */
        gap: '24px',
      }}
        className="pos-grid"
      >
        {/* Products Panel */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Panel header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--surface-border)',
            display: 'flex', alignItems: 'center', gap: '10px'
          }}>
            <ShoppingBag size={18} style={{ color: 'var(--gold)' }} />
            <h3 style={{ margin: 0 }}>Product Catalogue</h3>
            <span style={{
              marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 600,
              color: 'var(--text-muted)'
            }}>
              {products.length} items
            </span>
          </div>

          <div style={{ padding: '20px', overflowY: 'auto', maxHeight: 'calc(100vh - 320px)', minHeight: '400px' }}>
            {products.length === 0 ? (
              /* ── Empty State ── */
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '64px 24px', gap: '12px', textAlign: 'center'
              }}>
                <ShoppingCart size={48} style={{ color: '#6B88A8', opacity: 0.5 }} />
                <h3 style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Catalogue Empty</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                  Adjust your search or add new products to inventory.
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '12px'
              }}>
                {products.map(product => {
                  const lowStock   = product.availableQty > 0 && product.availableQty < 10;
                  const outOfStock = product.availableQty <= 0;
                  return (
                    <div
                      key={product.id}
                      onClick={() => !outOfStock && addToCart(product.id)}
                      style={{
                        background: '#fff',
                        border: `1.5px solid ${outOfStock ? '#E2E8F0' : lowStock ? '#F59E0B' : 'var(--surface-border)'}`,
                        borderRadius: 'var(--radius-md)',
                        padding: '16px',
                        cursor: outOfStock ? 'not-allowed' : 'pointer',
                        opacity: outOfStock ? 0.45 : 1,
                        transition: 'box-shadow var(--transition-fast), border-color var(--transition-fast)',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                      onMouseEnter={e => !outOfStock && ((e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '0.06em', color: 'var(--text-muted)'
                        }}>
                          {product.category}
                        </span>
                        {outOfStock && <CheckCircle size={14} style={{ color: '#EF4444' }} />}
                        {lowStock && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B', display: 'block' }} />}
                      </div>

                      <h3 style={{ margin: '0 0 4px', fontSize: '0.9rem', lineHeight: 1.3 }}>{product.name}</h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 14px' }}>SKU: {product.sku}</p>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {/* Price — monospace tabular */}
                        <span style={{
                          fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: '0.95rem', fontWeight: 700,
                          color: 'var(--navy)',
                        }}>
                          {formatKSh(product.basePrice)}
                        </span>

                        {/* Stock badge */}
                        <span style={{
                          padding: '3px 8px', borderRadius: '6px',
                          fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                          fontFamily: 'ui-monospace, monospace',
                          fontVariantNumeric: 'tabular-nums',
                          background: outOfStock ? '#FEE2E2' : product.availableQty > 20 ? '#DCFCE7' : '#FEF3C7',
                          color:      outOfStock ? '#B91C1C' : product.availableQty > 20 ? '#15803D' : '#92400E',
                        }}>
                          {outOfStock ? 'Sold Out' : `${product.availableQty} units`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart Panel */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Cart />
        </div>
      </div>

      {/* ── Recent Sales Feed ────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <RecentSalesFeed />
      </div>

      {/* ── Responsive breakpoint override ─────────────── */}
      <style>{`
        @media (min-width: 1024px) {
          .pos-grid {
            grid-template-columns: 2fr 1fr !important;
          }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .pos-grid {
            grid-template-columns: 1.5fr 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default POSDash;

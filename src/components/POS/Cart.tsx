import { useState } from 'react';
import { db } from '../../lib/db/schema';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import {
  Trash2, Plus, Minus, CreditCard,
  ShoppingCart, AlertCircle, CheckCircle2,
  Search, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCheckout } from '../../hooks/useCheckout';
import { formatKSh } from '../../utils/formatters';

type PaymentType = 'Cash' | 'M-Pesa' | 'Debt';

const mono: React.CSSProperties = {
  fontFamily: 'ui-monospace, "Cascadia Code", monospace',
  fontVariantNumeric: 'tabular-nums',
};

const Cart = () => {
  const { user }        = useAuth();
  const { processCheckout } = useCheckout(user?.shopId || 'shop_techplanet', user?.name || 'Unknown');

  // ── State ───────────────────────────────────────────────────────────────────
  const [isProcessing,       setIsProcessing]       = useState(false);
  const [checkoutModalOpen,  setCheckoutModalOpen]  = useState(false);
  const [paymentType,        setPaymentType]        = useState<PaymentType>('Cash');
  const [mpesaCode,          setMpesaCode]          = useState('');
  const [customerSearch,     setCustomerSearch]     = useState('');
  const [customerPhone,      setCustomerPhone]      = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [isNewCustomer,      setIsNewCustomer]      = useState(false);
  const [globalPriceMode,    setGlobalPriceMode]    = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');

  // ── Live Data ────────────────────────────────────────────────────────────────
  const { cartItems, matchingCustomers } = useLiveQuery(async () => {
    const items      = await db.active_cart.toArray();
    const productIds = items.map(i => i.productId);
    const products   = await db.products.where('id').anyOf(productIds).toArray();

    let customers: any[] = await db.customers
      .filter(c => c.isDebtEligible || (c.totalBalance && c.totalBalance > 0))
      .toArray();
    if (customerSearch.length > 0) {
      customers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.phone && c.phone.includes(customerSearch))
      );
    }

    return {
      cartItems: items.map(cartItem => ({
        cartItem,
        product: products.find(p => p.id === cartItem.productId),
      })),
      matchingCustomers: customers.sort((a, b) => (b.totalBalance || 0) - (a.totalBalance || 0))
    };
  }, [customerSearch]) || { cartItems: [], matchingCustomers: [] };

  const cartItemsResult = cartItems;

  // ── Mutations ────────────────────────────────────────────────────────────────
  const updateQty = async (id: string, delta: number) => {
    const item = await db.active_cart.get(id);
    if (!item) return;
    const newQty = item.qty + delta;
    if (newQty <= 0) await db.active_cart.delete(id);
    else             await db.active_cart.update(id, { qty: newQty });
  };

  const setGlobalMode = async (mode: 'RETAIL' | 'WHOLESALE') => {
    setGlobalPriceMode(mode);
    const items = await db.active_cart.toArray();
    for (const item of items) {
      await db.active_cart.update(item.id!, { priceType: mode });
    }
  };

  const togglePriceType = async (id: string, current: 'RETAIL' | 'WHOLESALE') => {
    await db.active_cart.update(id, { priceType: current === 'RETAIL' ? 'WHOLESALE' : 'RETAIL' });
  };

  const removeCartItem = async (id: string) => {
    await db.active_cart.delete(id);
  };

  // ── Totals ───────────────────────────────────────────────────────────────────
  const total = cartItemsResult.reduce(({ subtotal }, { cartItem, product }) => {
    if (!product) return { subtotal };
    const unitPrice = cartItem.priceType === 'WHOLESALE' ? product.wholesalePrice : product.basePrice;
    return { subtotal: subtotal + unitPrice * cartItem.qty };
  }, { subtotal: 0 }).subtotal;

  const hasWholesaleAny  = cartItemsResult.some(i => i.cartItem.priceType === 'WHOLESALE') || globalPriceMode === 'WHOLESALE';
  const requiresCustomer = paymentType === 'Debt' || hasWholesaleAny;
  const canCheckout      = !isProcessing && (
    (paymentType === 'Cash' && !hasWholesaleAny) ||
    (paymentType === 'M-Pesa' && mpesaCode.trim().length >= 4 && !hasWholesaleAny) ||
    (requiresCustomer && (selectedCustomerId || (isNewCustomer && customerSearch.trim() && customerPhone.trim())))
  );

  // ── Checkout handler ─────────────────────────────────────────────────────────
  const handleCheckout = async () => {
    if (paymentType === 'M-Pesa' && !mpesaCode) { alert('Enter the M-Pesa Reference Code.'); return; }
    if (requiresCustomer && !selectedCustomerId && !isNewCustomer) {
      alert('Select or create a customer for Debt/Wholesale transactions.'); return;
    }
    if (requiresCustomer && selectedCustomerId) {
      const cust = await db.customers.get(selectedCustomerId);
      if (cust && !cust.isDebtEligible && paymentType === 'Debt') { alert('Customer is NOT eligible for credit.'); return; }
    }

    setIsProcessing(true);
    try {
      let finalCustomerId = selectedCustomerId;
      if (requiresCustomer && isNewCustomer && customerSearch.trim()) {
        const newUid = crypto.randomUUID();
        await db.customers.add({
          id: newUid, name: customerSearch.trim(), phone: customerPhone.trim(),
          shopId: user?.shopId || 'shop_techplanet', isDebtEligible: false, totalBalance: 0, synced: 0
        });
        finalCustomerId = newUid;
      }

      const cartFormatted = cartItemsResult.map(({ cartItem, product }) => {
        const unitPrice = cartItem.priceType === 'WHOLESALE' ? product!.wholesalePrice : product!.basePrice;
        return { productId: cartItem.productId, qty: cartItem.qty, unitPrice, priceType: (cartItem.priceType || 'RETAIL') as 'RETAIL' | 'WHOLESALE' };
      });

      const methodMap: Record<PaymentType, 'CASH' | 'M-PESA' | 'DEBT'> = { Cash: 'CASH', 'M-Pesa': 'M-PESA', Debt: 'DEBT' };

      await processCheckout(cartFormatted, {
        method:        methodMap[paymentType],
        mpesaRef:      paymentType === 'M-Pesa' ? mpesaCode : undefined,
        customerId:    requiresCustomer ? finalCustomerId : undefined,
        customerName:  requiresCustomer ? customerSearch : undefined,
        customerPhone: requiresCustomer ? customerPhone : undefined,
        priceType:     hasWholesaleAny ? 'WHOLESALE' : 'RETAIL'
      });

      setCheckoutModalOpen(false);
      setMpesaCode(''); setSelectedCustomerId(''); setCustomerSearch(''); setCustomerPhone(''); setIsNewCustomer(false);
      setGlobalPriceMode('RETAIL');
      alert('Transaction complete!');
    } catch (err) {
      console.error(err);
      alert('Checkout failed.');
    } finally { setIsProcessing(false); }
  };

  const resetModal = () => {
    setCheckoutModalOpen(false);
    setPaymentType('Cash'); setMpesaCode('');
    setSelectedCustomerId(''); setCustomerSearch(''); setCustomerPhone(''); setIsNewCustomer(false);
  };

  // ── Payment method selector button style ─────────────────────────────────────
  const methodBtn = (method: PaymentType): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '6px', borderRadius: '10px',
    border: `2px solid ${paymentType === method ? 'var(--navy)' : 'var(--surface-border)'}`,
    background: paymentType === method ? 'rgba(26,43,74,0.06)' : '#fff',
    color: paymentType === method ? 'var(--navy)' : 'var(--text-muted)',
    fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
    transition: 'all 150ms ease', minHeight: '0', padding: '12px 8px',
  } as React.CSSProperties);

  // ════════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <>
      {/* ── LEAN CART SIDEBAR ─────────────────────────────────────────── */}
      <div style={{ 
        display: 'flex', flexDirection: 'column', height: '100%',
        border: globalPriceMode === 'WHOLESALE' ? '3px solid #C2A56D' : 'none',
        borderRadius: globalPriceMode === 'WHOLESALE' ? '16px' : '0',
        margin: globalPriceMode === 'WHOLESALE' ? '-3px' : '0', // Offset border width
        transition: 'all 200ms ease'
      }}>

        {/* ── HIGH-VISIBILITY PRICE TOGGLE ── */}
        <div style={{ padding: '12px 20px', background: '#F8FAFC', borderBottom: '1px solid var(--surface-border)' }}>
          <div style={{ 
            display: 'grid', gridTemplateColumns: '1fr 1fr', 
            background: '#F1F5F9', // bg-slate-100
            borderRadius: '12px', padding: '4px', height: '48px' // h-12
          }}>
            <button 
              onClick={() => setGlobalMode('RETAIL')}
              style={{
                borderRadius: '8px', border: 'none', minHeight: '0',
                background: globalPriceMode === 'RETAIL' ? '#2C3947' : 'transparent',
                color: globalPriceMode === 'RETAIL' ? '#fff' : '#547A95',
                fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em',
                transition: 'all 200ms ease'
              }}
            >
              RETAIL
            </button>
            <button 
              onClick={() => setGlobalMode('WHOLESALE')}
              style={{
                borderRadius: '8px', border: 'none', minHeight: '0',
                background: globalPriceMode === 'WHOLESALE' ? '#2C3947' : 'transparent',
                color: globalPriceMode === 'WHOLESALE' ? '#fff' : '#547A95',
                fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em',
                transition: 'all 200ms ease'
              }}
            >
              WHOLESALE
            </button>
          </div>
        </div>

        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--surface-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--navy)' }}>Ticket</h3>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {user?.name} · {user?.shopId}
            </p>
          </div>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'var(--navy)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShoppingCart size={16} />
          </div>
        </div>

        {/* Items list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {cartItemsResult.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '48px 24px', gap: '10px', textAlign: 'center'
            }}>
              <ShoppingCart size={44} style={{ color: '#6B88A8', opacity: 0.4 }} />
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cart is empty</p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Scan or tap a product to begin.
              </p>
            </div>
          ) : (
            cartItemsResult.map(({ cartItem, product }) => {
              if (!product) return null;
              const unitPrice = cartItem.priceType === 'WHOLESALE' ? product.wholesalePrice : product.basePrice;
              return (
                <div key={cartItem.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--surface-border)' }}>
                  {/* Name + remove */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: 'var(--navy)', lineHeight: 1.3 }}>{product.name}</p>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>{product.sku} · {product.category}</p>
                    </div>
                    <button
                      onClick={() => removeCartItem(cartItem.id!)}
                      style={{ minHeight: '28px', width: '28px', padding: 0, background: 'transparent', color: '#EF4444', flexShrink: 0 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Qty stepper + price */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--surface-raised)', borderRadius: '8px', padding: '3px' }}>
                      <button onClick={() => updateQty(cartItem.id!, -1)} style={{ minHeight: '26px', width: '26px', padding: 0, background: '#fff', border: '1px solid var(--surface-border)', borderRadius: '6px' }}><Minus size={11} /></button>
                      <span style={{ ...mono, width: '26px', textAlign: 'center', fontWeight: 700, fontSize: '0.85rem' }}>{cartItem.qty}</span>
                      <button onClick={() => updateQty(cartItem.id!, 1)} style={{ minHeight: '26px', width: '26px', padding: 0, background: '#fff', border: '1px solid var(--surface-border)', borderRadius: '6px' }}><Plus size={11} /></button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <button
                        onClick={() => togglePriceType(cartItem.id!, cartItem.priceType || 'RETAIL')}
                        style={{
                          minHeight: '20px', padding: '1px 6px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 700,
                          background: cartItem.priceType === 'WHOLESALE' ? '#DCFCE7' : 'transparent',
                          color:      cartItem.priceType === 'WHOLESALE' ? '#15803D' : 'var(--text-muted)',
                          border: `1px solid ${cartItem.priceType === 'WHOLESALE' ? '#86EFAC' : 'var(--surface-border)'}`,
                        }}
                      >
                        {cartItem.priceType === 'WHOLESALE' ? 'WS' : 'RTL'}
                      </button>
                      <span style={{ ...mono, fontWeight: 700, fontSize: '0.88rem', color: 'var(--navy)' }}>
                        {formatKSh(unitPrice * cartItem.qty)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: total + CTA */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--surface-border)', flexShrink: 0, background: '#fff' }}>
          {hasWholesaleAny && (
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#15803D', marginBottom: '8px', textAlign: 'center' }}>
              ✓ Wholesale Mode Active
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Total</span>
            <span style={{ ...mono, fontSize: '1.5rem', fontWeight: 800, color: 'var(--navy)', letterSpacing: '-0.02em' }}>
              {formatKSh(total)}
            </span>
          </div>

          <button
            onClick={() => cartItemsResult.length > 0 && setCheckoutModalOpen(true)}
            disabled={cartItemsResult.length === 0}
            style={{ width: '100%', gap: '8px' }}
          >
            <CreditCard size={17} />
            Proceed to Checkout
          </button>
        </div>
      </div>

      {/* ── CHECKOUT MODAL OVERLAY ─────────────────────────────────────── */}
      {checkoutModalOpen && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.50)',
          backdropFilter: 'blur(4px)',
          zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
        }}>
          <div className="card-raised" style={{
            width: '100%', maxWidth: '520px',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ margin: '0 0 2px' }}>Checkout</h2>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Select settlement method</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: '0 0 2px', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Payable</p>
                <span style={{ ...mono, fontWeight: 800, fontSize: '1.4rem', color: 'var(--navy)' }}>{formatKSh(total)}</span>
                {hasWholesaleAny && (
                  <p style={{ margin: 0, fontSize: '0.68rem', color: '#92400E', fontWeight: 600 }}>Broker Validation Required</p>
                )}
              </div>
            </div>

            {/* Payment method selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
              {(['Cash', 'M-Pesa', 'Debt'] as PaymentType[]).map(method => (
                <button
                  key={method}
                  onClick={() => {
                    setPaymentType(method);
                    setSelectedCustomerId(''); setMpesaCode('');
                    setCustomerSearch(''); setCustomerPhone(''); setIsNewCustomer(false);
                  }}
                  style={methodBtn(method)}
                >
                  <span style={{ fontSize: '1.4rem' }}>
                    {method === 'Cash' ? '💵' : method === 'M-Pesa' ? '📱' : '📋'}
                  </span>
                  <span>{method}</span>
                </button>
              ))}
            </div>

            {/* Conditional fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* M-Pesa code */}
              {paymentType === 'M-Pesa' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label>M-Pesa Confirmation Code</label>
                  <input
                    type="text"
                    placeholder="e.g. RK9D2XYZ"
                    value={mpesaCode}
                    onChange={e => setMpesaCode(e.target.value.toUpperCase())}
                    style={{ ...mono }}
                  />
                </div>
              )}

              {/* Debt: customer picker or new customer form */}
              {requiresCustomer && (
                <div style={{
                  padding: '16px', borderRadius: '10px',
                  border: '1.5px solid #FCD34D', background: '#FFFBEB',
                  display: 'flex', flexDirection: 'column', gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertCircle size={15} style={{ color: '#92400E' }} />
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#92400E' }}>Debtor Details</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setIsNewCustomer(!isNewCustomer); setSelectedCustomerId(''); }}
                      style={{
                        minHeight: '26px', padding: '0 10px', fontSize: '0.65rem', fontWeight: 700,
                        background: isNewCustomer ? '#FEF3C7' : 'transparent',
                        color: '#92400E', border: '1px solid #FCD34D', borderRadius: '6px',
                      }}
                    >
                      {isNewCustomer ? 'EXISTING' : '+ NEW CUSTOMER'}
                    </button>
                  </div>

                  {!isNewCustomer ? (
                    <>
                      <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input
                          type="text"
                          placeholder="Filter customers…"
                          value={customerSearch}
                          onChange={e => setCustomerSearch(e.target.value)}
                          style={{ paddingLeft: '36px' }}
                        />
                      </div>

                      <div style={{ maxHeight: '180px', overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--surface-border)', background: '#fff' }}>
                        {matchingCustomers.length === 0 ? (
                          <p style={{ padding: '16px', margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>No eligible debtors found.</p>
                        ) : (
                          matchingCustomers.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch(c.name); setCustomerPhone(c.phone || ''); }}
                              style={{
                                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '10px 14px', minHeight: '0', borderRadius: '0',
                                background: selectedCustomerId === c.id ? 'rgba(26,43,74,0.06)' : 'transparent',
                                borderLeft: selectedCustomerId === c.id ? '3px solid var(--navy)' : '3px solid transparent',
                                fontWeight: 400, color: 'var(--text-primary)',
                              }}
                            >
                              <div style={{ textAlign: 'left' }}>
                                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: 'var(--navy)' }}>{c.name}</p>
                                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.phone || 'No Phone'}</p>
                              </div>
                              <span style={{ ...mono, fontSize: '0.82rem', fontWeight: 700, color: '#92400E' }}>
                                {formatKSh(c.totalBalance || 0)}
                              </span>
                            </button>
                          ))
                        )}
                      </div>

                      {selectedCustomerId && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#15803D', fontWeight: 600 }}>
                          <CheckCircle2 size={14} /> Account selected: {customerSearch}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
                        <label>New Debtor Name</label>
                        <input type="text" placeholder="Full Name…" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
                        <label>Contact Phone</label>
                        <input type="text" placeholder="07…" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} style={mono} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action row */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={resetModal}
                style={{ flex: 1, background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--surface-border)' }}
              >
                <X size={16} /> Cancel
              </button>
              <button
                onClick={handleCheckout}
                disabled={!canCheckout}
                style={{ flex: 2, background: canCheckout ? 'var(--btn-navy)' : '#94A3B8', gap: '8px' }}
              >
                <CreditCard size={16} />
                {isProcessing ? 'Finalizing…' : 'Charge Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Cart;

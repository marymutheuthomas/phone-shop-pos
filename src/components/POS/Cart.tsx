import { useState } from 'react';
import { db } from '../../lib/db/schema';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { 
  Trash2, Plus, Minus, CreditCard, UserPlus, Search, 
  ShoppingCart, CheckCircle2, AlertCircle, Info 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCheckout } from '../../hooks/useCheckout';
import { formatKSh } from '../../utils/formatters';

type PaymentType = 'Cash' | 'M-Pesa' | 'Debt';

const Cart = () => {
  const { user } = useAuth();
  const { processCheckout } = useCheckout(user?.shopId || 'warehouse', user?.name || 'Unknown');

  // ── State ────────────────────────────────────────────────────────────────
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>('Cash');
  const [mpesaCode, setMpesaCode] = useState('');
  
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(''); 
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  const [imeiInputs, setImeiInputs] = useState<Record<number, string[]>>({});

  // ── Data Query ───────────────────────────────────────────────────────────
  const { cartItems, customers } = useLiveQuery(async () => {
    const items = await db.active_cart.toArray();
    const productIds = items.map(i => i.productId);
    const products = await db.products.where('id').anyOf(productIds).toArray();
    
    let matchedCustomers: any[] = [];
    if (customerSearch.length > 1) {
      matchedCustomers = await db.customers
        .filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
        .limit(5)
        .toArray();
    }

    return {
      cartItems: items.map(cartItem => ({
        cartItem,
        product: products.find(p => p.id === cartItem.productId),
      })),
      customers: matchedCustomers
    };
  }, [customerSearch]) || { cartItems: [], customers: [] };

  const cartItemsResult = cartItems;

  const updateQty = async (id: number, delta: number) => {
    const item = await db.active_cart.get(id);
    if (!item) return;
    const newQty = item.qty + delta;
    if (newQty <= 0) {
      await db.active_cart.delete(id);
      setImeiInputs(prev => { const ni = { ...prev }; delete ni[id]; return ni; });
    } else {
      await db.active_cart.update(id, { qty: newQty });
      setImeiInputs(prev => {
        const ni = { ...prev };
        if (ni[id] && ni[id].length > newQty) ni[id] = ni[id].slice(0, newQty);
        return ni;
      });
    }
  };

  const removeCartItem = async (id: number) => {
    await db.active_cart.delete(id);
    setImeiInputs(prev => { const ni = { ...prev }; delete ni[id]; return ni; });
  };

  const total = cartItemsResult.reduce(({ subtotal }, { cartItem, product }) => {
    if (!product) return { subtotal };
    const isWholesale = cartItem.qty >= product.wholesaleQtyThreshold;
    const unitPrice = isWholesale ? product.wholesalePrice : product.basePrice;
    return { subtotal: subtotal + unitPrice * cartItem.qty };
  }, { subtotal: 0 }).subtotal;

  const requiresCustomer = paymentType === 'Debt';

  const handleCheckout = async () => {
    if (paymentType === 'M-Pesa' && !mpesaCode) {
      alert('Please enter the M-Pesa Reference Code.');
      return;
    }

    if (requiresCustomer && !selectedCustomerId && !isNewCustomer) {
      alert('You MUST select or create a customer for Debt transactions.');
      return;
    }

    let missingImei = false;
    cartItemsResult.forEach(({ cartItem, product }) => {
      if (product?.requires_imei) {
        const provided = imeiInputs[cartItem.id!] || [];
        if (provided.filter(i => i && i.trim() !== '').length < cartItem.qty) {
          missingImei = true;
        }
      }
    });
    if (missingImei) {
      alert('All serial numbers (IMEIs) must be provided.');
      return;
    }

    setIsProcessing(true);
    try {
      let finalCustomerId = selectedCustomerId;

      if (requiresCustomer && isNewCustomer && customerSearch.trim()) {
        const newUid = crypto.randomUUID();
        await db.customers.add({
          id: newUid,
          name: customerSearch.trim(),
          shopId: user?.shopId || 'warehouse',
          synced: 0
        });
        finalCustomerId = newUid;
      }

      const cartFormatted = cartItemsResult.map(({ cartItem, product }) => {
        const isWholesale = cartItem.qty >= product!.wholesaleQtyThreshold;
        return {
          productId: cartItem.productId,
          qty: cartItem.qty,
          unitPrice: isWholesale ? product!.wholesalePrice : product!.basePrice,
          imeis: product!.requires_imei ? (imeiInputs[cartItem.id!] || []) : undefined,
        };
      });

      const methodMap: Record<PaymentType, 'CASH' | 'M-PESA' | 'DEBT'> = {
        Cash: 'CASH',
        'M-Pesa': 'M-PESA',
        Debt: 'DEBT',
      };

      await processCheckout(cartFormatted, {
        method: methodMap[paymentType],
        mpesaRef: paymentType === 'M-Pesa' ? mpesaCode : undefined,
        customerId: requiresCustomer ? finalCustomerId : undefined,
      });

      setCheckoutModalOpen(false);
      setMpesaCode('');
      setSelectedCustomerId('');
      setCustomerSearch('');
      setIsNewCustomer(false);
      setImeiInputs({});
      alert('Transaction Completed!');
    } catch (err) {
      console.error(err);
      alert('Checkout failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-[440px] bg-white border-l border-zinc-200 flex flex-col h-full shadow-2xl z-20 overflow-hidden relative">
      {/* Sidebar Header */}
      <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight leading-none">Register</h2>
          <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-2">{user?.name} @ {user?.shopId}</p>
        </div>
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
           <ShoppingCart className="text-white" size={20} />
        </div>
      </div>

      {/* Cart Content - Bordered Rows */}
      <div className="flex-1 overflow-y-auto pt-2">
        {cartItemsResult.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-10">
            <div className="w-24 h-24 bg-zinc-50 rounded-[2.5rem] flex items-center justify-center mb-6 border border-zinc-100">
                <ShoppingCart className="text-zinc-200" size={40} />
            </div>
            <h3 className="text-xl font-black text-zinc-900">Cart Empty</h3>
            <p className="text-sm text-zinc-400 font-medium mt-2 leading-relaxed">Touch products on the left to add them to this ticket.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 border-t border-zinc-100">
            {cartItemsResult.map(({ cartItem, product }) => {
              if (!product) return null;
              const isWholesale = cartItem.qty >= product.wholesaleQtyThreshold;
              const unitPrice = isWholesale ? product.wholesalePrice : product.basePrice;

              return (
                <div key={cartItem.id} className="p-6 bg-white hover:bg-zinc-50/50 transition-colors group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-zinc-900 text-base truncate">{product.name}</h4>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">
                        {product.sku} • {product.category}
                      </p>
                    </div>
                    <button 
                      onClick={() => removeCartItem(cartItem.id!)} 
                      className="w-12 h-12 -mt-2 -mr-2 rounded-2xl flex items-center justify-center text-zinc-200 hover:text-rose-500 hover:bg-rose-50 transition-all active:scale-90"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>

                  <div className="flex justify-between items-center mt-6">
                    <div className="flex items-center gap-1 bg-zinc-100 rounded-2xl p-1.5">
                      <button onClick={() => updateQty(cartItem.id!, -1)} className="w-12 h-12 flex items-center justify-center text-zinc-600 bg-white shadow-sm rounded-xl transition-all active:scale-95"><Minus size={18} /></button>
                      <span className="w-12 text-center font-black text-zinc-900 text-lg">{cartItem.qty}</span>
                      <button onClick={() => updateQty(cartItem.id!, 1)} className="w-12 h-12 flex items-center justify-center text-zinc-600 bg-white shadow-sm rounded-xl transition-all active:scale-95"><Plus size={18} /></button>
                    </div>
                    
                    <div className="text-right">
                      {isWholesale && (
                        <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase tracking-wider mb-1 inline-block">Wholesale Tier</span>
                      )}
                      <p className="font-black text-zinc-900 text-xl tracking-tighter">{formatKSh(unitPrice * cartItem.qty)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer / Summary Section */}
      <div className="p-10 bg-zinc-900 text-white shadow-[0_-20px_50px_rgba(0,0,0,0.2)]">
        <div className="mb-8">
            <div className="flex justify-between items-center mb-1">
                <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Total Balance</span>
                <span className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest italic opacity-50">Local Settlement</span>
            </div>
            <div className="flex items-baseline justify-between">
                <span className="text-6xl font-black tracking-tighter text-white">
                  {formatKSh(total).split('.')[0]}
                </span>
                <span className="text-indigo-400 font-black text-2xl">
                  .{formatKSh(total).split('.')[1] || '00'}
                </span>
            </div>
        </div>

        <button
          onClick={() => cartItemsResult.length > 0 && setCheckoutModalOpen(true)}
          disabled={cartItemsResult.length === 0}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-20 rounded-[1.5rem] font-black text-base uppercase tracking-[0.15em] transition-all shadow-2xl shadow-indigo-900/40 disabled:opacity-20 flex items-center justify-center gap-4 active:scale-[0.98] border-b-4 border-indigo-800"
        >
          <CreditCard size={24} />
          Finalize Transaction
        </button>
      </div>

      {/* Modern Checkout Modal */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-zinc-900/80 backdrop-blur-xl" onClick={() => setCheckoutModalOpen(false)} />
          <div className="relative w-full max-w-xl bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-10">
              <div className="flex items-center justify-between mb-10">
                <div>
                    <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Checkout</h2>
                    <p className="text-zinc-400 font-medium mt-1">Select your preferred settlement method</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Total Payable</p>
                    <p className="text-3xl font-black text-indigo-600">{formatKSh(total)}</p>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="grid grid-cols-3 gap-4 mb-10">
                {(['Cash', 'M-Pesa', 'Debt'] as PaymentType[]).map(method => (
                  <button key={method}
                    onClick={() => { 
                      setPaymentType(method); 
                      setSelectedCustomerId(''); 
                      setMpesaCode(''); 
                      setCustomerSearch('');
                      setIsNewCustomer(false);
                    }}
                    className={`flex flex-col items-center justify-center p-6 rounded-[2rem] border-2 transition-all gap-3 group
                      ${paymentType === method 
                        ? (method === 'Debt' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-indigo-600 bg-indigo-50 text-indigo-700')
                        : 'border-zinc-100 bg-zinc-50/50 text-zinc-400 hover:border-zinc-200'}`}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all
                        ${paymentType === method ? 'bg-white shadow-sm' : 'bg-zinc-100 group-hover:bg-white'}`}>
                        <span className="text-xl">{method === 'Cash' ? '💵' : method === 'M-Pesa' ? '📱' : '📋'}</span>
                    </div>
                    <span className="font-black text-xs uppercase tracking-widest">{method}</span>
                  </button>
                ))}
              </div>

              {/* Dynamic Context Fields */}
              <div className="space-y-6">
                {paymentType === 'M-Pesa' && (
                  <div className="animate-fade-in">
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">M-Pesa Confirmation Code</label>
                    <input type="text" placeholder="e.g. RK9D... " value={mpesaCode}
                      onChange={e => setMpesaCode(e.target.value.toUpperCase())}
                      className="w-full bg-zinc-50 border border-zinc-200 p-5 rounded-2xl font-black text-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none uppercase placeholder:text-zinc-200"
                    />
                  </div>
                )}

                {requiresCustomer && (
                  <div className="animate-fade-in space-y-4">
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Debtor Lookup</label>
                    <div className="relative">
                        <Search className="absolute left-5 top-5 text-zinc-300" size={20} />
                        <input type="text" placeholder="Name or phone number..." 
                          value={customerSearch}
                          onChange={e => {
                            setCustomerSearch(e.target.value);
                            if (selectedCustomerId) { setSelectedCustomerId(''); setIsNewCustomer(false); }
                          }}
                          className="w-full bg-zinc-50 border border-zinc-200 p-5 pl-14 rounded-2xl font-black text-zinc-900 focus:ring-2 focus:ring-amber-500 outline-none placeholder:text-zinc-200"
                        />
                    </div>

                    {customerSearch.length > 1 && !selectedCustomerId && !isNewCustomer && (
                      <div className="bg-white border border-zinc-100 rounded-3xl overflow-hidden shadow-2xl shadow-zinc-200/50 divide-y divide-zinc-50">
                        {customers.map(c => (
                          <button key={c.id} onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch(c.name); }}
                            className="w-full text-left p-5 hover:bg-zinc-50 flex justify-between items-center group transition-colors">
                            <span className="font-black text-zinc-900 group-hover:text-amber-600">{c.name}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-zinc-300 font-black uppercase tracking-widest">Linked Shop: {c.shopId}</span>
                                <CheckCircle2 className="text-zinc-200" size={16} />
                            </div>
                          </button>
                        ))}
                        <button onClick={() => setIsNewCustomer(true)}
                          className="w-full text-left p-5 bg-amber-50/50 hover:bg-amber-50 flex items-center gap-3 text-amber-600 font-black group transition-all">
                          <UserPlus size={18} />
                          <span className="text-sm">Create account for "{customerSearch}"</span>
                        </button>
                      </div>
                    )}

                    {selectedCustomerId && (
                      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-5 rounded-2xl">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="text-emerald-500" size={20} />
                            <span className="font-black text-emerald-700 text-sm">Account Linked: {customerSearch}</span>
                        </div>
                        <button onClick={() => { setSelectedCustomerId(''); setCustomerSearch(''); }} className="text-[10px] font-black text-emerald-800 uppercase tracking-widest hover:underline">Change</button>
                      </div>
                    )}
                    
                    {isNewCustomer && (
                      <div className="flex items-center justify-between bg-amber-50 border border-amber-100 p-5 rounded-2xl">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="text-amber-600" size={20} />
                            <span className="font-black text-amber-700 text-sm">New Registry: {customerSearch}</span>
                        </div>
                        <button onClick={() => setIsNewCustomer(false)} className="text-[10px] font-black text-amber-800 uppercase tracking-widest hover:underline">Cancel</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Grid */}
              <div className="grid grid-cols-2 gap-4 mt-12">
                <button onClick={() => setCheckoutModalOpen(false)}
                  className="p-5 rounded-2xl border border-zinc-100 text-zinc-400 font-black uppercase tracking-widest text-xs hover:bg-zinc-50 transition-all">
                  Cancel Transaction
                </button>
                <button onClick={handleCheckout}
                  disabled={isProcessing || (requiresCustomer && !selectedCustomerId && !isNewCustomer)}
                  className={`p-5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl
                    ${(requiresCustomer && !selectedCustomerId && !isNewCustomer) 
                      ? 'bg-zinc-100 text-zinc-300 cursor-not-allowed shadow-none' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'}`}
                >
                  {isProcessing ? 'Finalizing...' : 'Charge Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;

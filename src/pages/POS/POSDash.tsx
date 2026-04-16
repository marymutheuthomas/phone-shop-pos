import { useState } from 'react';
import { Search, ShoppingBag, Terminal, CheckCircle } from 'lucide-react';
import Cart from '../../components/POS/Cart';
import { formatKSh } from '../../utils/formatters';
import { db } from '../../lib/db/schema';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { useAuth } from '../../context/AuthContext';

const POSDash = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch products and their current quantity in our local inventory cache
  const products = useLiveQuery(async () => {
    let items = await db.products.toArray();
    
    // Filter by search query manually for flexibility
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    }

    const inventory = user?.shopId 
      ? await db.inventory.where('shopId').equals(user.shopId).toArray()
      : await db.inventory.toArray();
    
    // Map to include available stock
    return items.map(p => {
      const itemStock = inventory.find(inv => inv.productId === p.id);
      return {
        ...p,
        availableQty: itemStock ? itemStock.qty : 0
      };
    });
  }, [searchQuery]) || [];

  const addToCart = async (productId: string) => {
    // Check if it already exists in the cart
    const existing = await db.active_cart.where({ productId }).first();
    if (existing) {
      await db.active_cart.update(existing.id!, { qty: existing.qty + 1 });
    } else {
      await db.active_cart.add({ productId, qty: 1 });
    }
  };

  return (
    <div className="animate-fade-in h-[calc(100vh-100px)] flex flex-col gap-6 p-4">
      {/* Dynamic Dashboard Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-white shadow-xl shadow-zinc-200/50">
        <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-zinc-900 rounded-3xl flex items-center justify-center shadow-2xl">
                <Terminal className="text-white" size={24} />
            </div>
            <div>
                <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Vantage Terminal</h1>
                <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest leading-none mt-1">
                    Node: {user?.shopId} • Operator: {user?.name}
                </p>
            </div>
        </div>
        
        <div className="relative w-full md:w-96 flex items-center">
            <Search className="absolute left-6 text-zinc-400" size={18} />
            <input 
                type="text" 
                placeholder="Lookup SKU, Name or Category..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white border-2 border-zinc-100 h-16 pl-14 pr-6 rounded-2xl font-black text-zinc-900 outline-none focus:border-indigo-600 transition-all shadow-sm placeholder:text-zinc-200"
            />
        </div>
      </header>

      <div className="flex gap-6 h-full overflow-hidden">
        {/* Main Product Arena */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="bg-zinc-50 border border-zinc-200 rounded-[2.5rem] flex-1 p-8 overflow-y-auto relative">
            {products.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-zinc-100 rounded-3xl flex items-center justify-center mb-4">
                      <ShoppingBag className="text-zinc-300" size={32} />
                  </div>
                  <h3 className="text-lg font-black text-zinc-900">Catalogue Empty</h3>
                  <p className="text-zinc-400 text-sm font-medium mt-1">Adjust your search or add new products.</p>
               </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {products.map(product => {
                    const lowStock = product.availableQty < 10;
                    const outOfStock = product.availableQty <= 0;

                    return (
                        <div 
                        key={product.id} 
                        onClick={() => addToCart(product.id)}
                        className={`group relative p-6 bg-white border rounded-[2rem] transition-all duration-300 cursor-pointer overflow-hidden
                            ${outOfStock ? 'opacity-60 grayscale' : 'hover:scale-[1.03] hover:shadow-2xl hover:shadow-zinc-200 hover:border-indigo-600'}
                            ${lowStock && !outOfStock ? 'border-amber-100' : 'border-zinc-100'}`}
                        >
                        {/* Background Deco */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-zinc-50 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150" />
                        
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">{product.category}</span>
                                {lowStock && !outOfStock && <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />}
                                {outOfStock && <CheckCircle className="text-rose-500" size={16} />}
                            </div>

                            <h3 className="font-black text-zinc-900 leading-tight mb-2 h-10 line-clamp-2">{product.name}</h3>
                            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-4">SKU: {product.sku}</p>
                            
                            <div className="mt-8 pt-6 border-t border-zinc-50 flex justify-between items-end">
                                <div>
                                    <div className="text-2xl font-black text-indigo-600 tracking-tight">
                                        {formatKSh(product.basePrice)}
                                    </div>
                                    <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-1">
                                        WS: {formatKSh(product.wholesalePrice)}
                                    </div>
                                </div>
                                
                                <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider
                                    ${outOfStock ? 'bg-rose-50 text-rose-600' : product.availableQty > 20 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                    {outOfStock ? 'Sold Out' : `${product.availableQty} Units`}
                                </div>
                            </div>
                        </div>
                        </div>
                    );
                })}
                </div>
            )}
          </div>
        </div>

        {/* Integrated Cart Component */}
        <Cart />
      </div>
    </div>
  );
};

export default POSDash;

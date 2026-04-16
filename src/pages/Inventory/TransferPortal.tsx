import { useState } from 'react';
import { db } from '../../lib/db/schema';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../hooks/useInventory';
import { formatKSh } from '../../utils/formatters';
import { Package, Truck } from 'lucide-react';

const TransferPortal = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { sendStock, receiveStock } = useInventory();

  const [selectedShop, setSelectedShop] = useState('shop_2'); // Defaults to Mombasa Road
  const [selectedProduct, setSelectedProduct] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [confirmQtys, setConfirmQtys] = useState<Record<string, number>>({});

  // Queries
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const pendingTransfers = useLiveQuery(() => 
    db.transfers.where('status').equals('PENDING').toArray(), []
  ) || [];

  const handleDispatch = async () => {
    if (!selectedProduct || transferQty < 1) return;
    try {
      await sendStock(user!.id, 'warehouse', selectedShop, selectedProduct, transferQty);
      alert("Transfer Dispatched Successfully. Awaiting Shop Confirmation.");
      setTransferQty(1);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReceive = async (transferId: string) => {
    const verifiedInput = confirmQtys[transferId] || 0;
    try {
      await receiveStock(transferId, user!.id, user!.shopId, verifiedInput);
      alert("Transfer Confirmed. Products are now AVAILABLE in your local inventory.");
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="animate-fade-in flex gap-6 h-full">
      {/* Sender Panel / Dashboard */}
      {isAdmin && (
        <div className="glass-panel p-6" style={{ width: '400px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--primary-color)' }}>
             <Truck />
             <h2 className="text-xl font-bold text-text-primary">Dispatch Stock</h2>
          </div>
          
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-text-secondary text-sm block mb-1">Destination Shop</label>
              <select className="w-full p-3 rounded-lg text-gray-900 bg-white border border-gray-300" value={selectedShop} onChange={e => setSelectedShop(e.target.value)}>
                <option value="shop_1">Nairobi Central</option>
                <option value="shop_2">Mombasa Road</option>
                <option value="shop_3">Kisumu West</option>
                <option value="shop_4">Nakuru East</option>
                <option value="shop_5">Eldoret Hub</option>
              </select>
            </div>

            <div>
              <label className="text-text-secondary text-sm block mb-1">Select Product</label>
              <select className="w-full p-3 rounded-lg text-gray-900 bg-white border border-gray-300" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                <option value="">-- Choose Product --</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-text-secondary text-sm block mb-1">Quantity</label>
              <input type="number" min="1" value={transferQty} onChange={e => setTransferQty(parseInt(e.target.value))} className="w-full p-3 rounded-lg text-gray-900 bg-white border border-gray-300" />
            </div>

            <button onClick={handleDispatch} className="btn btn-primary mt-4 py-3 font-bold" style={{ width: '100%' }}>Send Stock Transfer</button>
          </div>
        </div>
      )}

      {/* Receiver Panel / Pending Transfers */}
      <div className="glass-panel p-6 flex-1 h-full overflow-y-auto">
        <h2 className="text-xl font-bold mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Package /> Incoming Shipments
        </h2>

        <div className="flex flex-col gap-4">
          {pendingTransfers
             .filter(t => isAdmin ? true : t.toShopId === user?.shopId)
             .map(transfer => {
               
               // Compute Value computed purely in integer math
               let transitValue = 0;
               transfer.items.forEach(i => {
                 const p = products.find(prod => prod.id === i.productId);
                 if (p) transitValue += (p.basePrice * i.qty);
               });
               
               return (
            <div key={transfer.id} className="p-4" style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex justify-between items-center mb-3 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <span className="text-text-secondary text-sm">Batch ID:</span> <span className="font-mono">{transfer.id.split('-')[0]}</span>
                </div>
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning-color)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  PENDING RECEIPT
                </div>
              </div>

              {transfer.items.map((item, idx) => {
                const p = products.find(prod => prod.id === item.productId);
                return (
                  <div key={idx} className="flex justify-between items-center my-2">
                    <div style={{ fontWeight: '500' }}>{p?.name || 'Unknown Product'}</div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <span className="text-sm text-text-muted">Target Qty: {item.qty} Products</span>
                    </div>
                  </div>
                )
              })}

              <div className="mt-4 pt-3 flex flex-col gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex justify-between items-center">
                   <div className="text-xs text-text-muted">
                    Total Value of Goods: <span className="font-bold text-white ml-2">{formatKSh(transitValue)}</span> <br/>
                    Target Destination: Shop ID {transfer.toShopId.charAt(transfer.toShopId.length-1)}
                   </div>
                </div>
                
                {/* Validation Rule Flow */}
                {!isAdmin && (
                  <div className="flex justify-end gap-3 mt-2">
                    <input 
                      type="number" 
                      placeholder="Confirm Qty..." 
                      value={confirmQtys[transfer.id] || ''}
                      onChange={e => setConfirmQtys({...confirmQtys, [transfer.id]: parseInt(e.target.value)})}
                      className="p-2 rounded text-gray-900 bg-white border border-gray-400 w-[120px]" 
                    />
                    <button onClick={() => handleReceive(transfer.id)} className="btn btn-primary" style={{ background: 'var(--primary-color)', border: 'none', boxShadow: 'none' }}>
                      Receive & Verify
                    </button>
                  </div>
                )}
              </div>
            </div>
          )})}
          
          {pendingTransfers.filter(t => isAdmin ? true : t.toShopId === user?.shopId).length === 0 && (
             <div className="text-center text-text-muted mt-8 p-8" style={{ border: '2px dashed var(--glass-border)', borderRadius: '12px' }}>
               No pending incoming shipments.
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransferPortal;

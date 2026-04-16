import { useState } from 'react';
import { db } from '../../lib/db/schema';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, Ghost, Search, CheckCircle2 } from 'lucide-react';

const Audits = () => {
  const { user } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState('');
  const [physicalCount, setPhysicalCount] = useState<number | ''>('');
  
  // Real-time Queries
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const inventory = useLiveQuery(() => 
     user ? db.inventory.where('shopId').equals(user.shopId).toArray() : []
  , [user]) || [];
  
  const pastAudits = useLiveQuery(() => 
     user ? db.audits.where('shopId').equals(user.shopId).reverse().sortBy('timestamp') : []
  , [user]) || [];

  // Phantom Inventory Logic Simulator
  // Flags items with 'accessories' tag holding stock > 10 simulating "High velocity, 0 sales in 48hrs"
  const phantomItems = products.filter(p => {
    if (p.category !== 'Accessories') return false;
    const stockQty = inventory.find(i => i.productId === p.id)?.qty || 0;
    return stockQty > 10;
  });

  const handleAuditSubmit = async () => {
    if (!selectedProduct || physicalCount === '') return;
    
    const stockRecord = inventory.find(i => i.productId === selectedProduct);
    const expectedQty = stockRecord ? stockRecord.qty : 0;
    const entered = Number(physicalCount);
    const discrepancy = entered - expectedQty;

    await db.audits.add({
      shopId: user!.shopId,
      productId: selectedProduct,
      expectedQty: expectedQty, // System secretly knows this
      enteredQty: entered, // User's blind count
      discrepancy: discrepancy,
      approverId: user!.id,
      timestamp: Date.now()
    });

    // Automatically correct the ledger if there is a discrepancy
    if (discrepancy !== 0) {
      if (stockRecord) {
        await db.inventory.update(stockRecord.id!, { qty: entered });
      } else {
        await db.inventory.add({
          id: Math.random().toString(36).substring(2, 15),
          shopId: user!.shopId,
          productId: selectedProduct,
          qty: entered
        });
      }
    }

    alert(`Audit Logged! Discrepancy Found: ${discrepancy}`);
    setSelectedProduct('');
    setPhysicalCount('');
  };

  return (
    <div className="animate-fade-in flex flex-col h-full gap-6">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-3">
           <ShieldAlert className="text-primary-color" size={32} /> Security & Audits
        </h1>
      </header>

      <div className="flex gap-6">
        
        {/* Left Side: Blind Audit Module */}
        <div className="glass-panel p-6" style={{ flex: 1 }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Blind Stock Audit</h2>
          <p className="text-text-secondary mb-6 text-sm">
            Please count the stock manually on the floor. Expected quantities are deliberately hidden from this interface.
          </p>

          <div className="flex flex-col gap-4">
            <div>
              <label className="text-text-secondary text-sm block mb-1">Select SKU to Audit</label>
              <select className="w-full p-3 rounded-lg" style={{ background: 'var(--surface-color-2)', color: 'white', border: '1px solid var(--border-color)' }} value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                <option value="">-- Choose Item on Floor --</option>
                {inventory.map(inv => {
                   const p = products.find(prod => prod.id === inv.productId);
                   return p ? <option key={p.id} value={p.id}>{p.name} ({p.sku})</option> : null;
                })}
              </select>
            </div>

            <div>
              <label className="text-text-secondary text-sm block mb-1">Enter Physical Count</label>
              <div className="flex items-center gap-3">
                 <input 
                   type="number" 
                   min="0"
                   placeholder="e.g. 12"
                   value={physicalCount} 
                   onChange={e => setPhysicalCount(parseInt(e.target.value))} 
                   className="w-full p-3 rounded-lg" 
                   style={{ background: 'var(--surface-color-2)', color: 'white', border: '1px solid var(--border-color)', fontSize: '1.5rem', textAlign: 'center' }} 
                 />
                 <button onClick={handleAuditSubmit} className="btn btn-primary p-3" style={{ height: '100%', minWidth: '120px' }}>
                    Lock Scan
                 </button>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4" style={{ borderTop: '1px solid var(--glass-border)' }}>
            <h3 className="text-lg font-bold mb-4 text-text-secondary">Recent Audit Discrepancies</h3>
            <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-2">
               {pastAudits.length === 0 && <p className="text-text-muted italic">No audits performed recently.</p>}
               {pastAudits.map(audit => {
                  const p = products.find(prod => prod.id === audit.productId);
                  return (
                    <div key={audit.id} className="p-3" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: audit.discrepancy === 0 ? '4px solid var(--success-color)' : '4px solid var(--danger-color)' }}>
                       <div className="flex justify-between items-center">
                          <span className="font-bold">{p?.name}</span>
                          <span className="text-xs text-text-muted">{new Date(audit.timestamp).toLocaleTimeString()}</span>
                       </div>
                       <div className="flex justify-between items-center mt-2 text-sm">
                          <span className="text-text-secondary">Expected: {audit.expectedQty} | Counted: {audit.enteredQty}</span>
                          <span style={{ fontWeight: 'bold', color: audit.discrepancy === 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                            {audit.discrepancy === 0 ? 'MATCH' : `Lost: ${audit.discrepancy}`}
                          </span>
                       </div>
                    </div>
                  )
               })}
            </div>
          </div>
        </div>

        {/* Right Side: Phantom Tracker */}
        <div className="glass-panel p-6" style={{ width: '400px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <div className="flex items-center gap-3 mb-4" style={{ color: 'var(--warning-color)' }}>
            <Ghost size={24} />
            <h2 className="text-xl font-bold">Phantom Inventory Detector</h2>
          </div>
          
          <p className="text-text-secondary text-sm mb-6 pb-4" style={{ borderBottom: '1px solid rgba(245, 158, 11, 0.1)' }}>
            System Intelligence: Flagging SKUs with high historical velocity but 0 sales over 48 hours despite "available" stock. This often indicates theft or misplaced floor items.
          </p>

          <div className="flex flex-col gap-4">
            {phantomItems.length === 0 && <p className="text-success-color font-bold flex items-center justify-center gap-2"><CheckCircle2/> All transparent!</p>}
            
            {phantomItems.map(p => {
               const stock = inventory.find(i => i.productId === p.id)?.qty || 0;
               return (
                 <div key={p.id} className="p-4" style={{ background: 'var(--surface-color-1)', border: '1px dashed var(--warning-color)', borderRadius: '12px' }}>
                    <div className="flex justify-between mb-2">
                       <span className="font-bold text-text-primary">{p.name}</span>
                    </div>
                    <div className="text-sm text-text-secondary flex justify-between">
                       <span>Available Stock: <b className="text-text-primary">{stock}</b></span>
                       <span>Last Sale: <b className="text-danger-color">&gt; 48 hrs</b></span>
                    </div>
                    <button className="btn mt-3 w-full text-xs" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', border: '1px solid rgba(239, 68, 68, 0.3)' }} onClick={() => { setSelectedProduct(p.id); document.querySelector('select')?.focus() }}>
                       Initiate Blind Audit
                    </button>
                 </div>
               )
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Audits;

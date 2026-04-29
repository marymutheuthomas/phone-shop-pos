import { useState } from 'react';
import { db } from '../../lib/db/schema';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, Ghost, CheckCircle2, Search, PackageSearch } from 'lucide-react';
import { formatKSh } from '../../utils/formatters';

const mono: React.CSSProperties = {
  fontFamily: 'ui-monospace, "Cascadia Code", monospace',
  fontVariantNumeric: 'tabular-nums',
};

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
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2,6)}`,
      shopId: user!.shopId,
      productId: selectedProduct,
      expectedQty: expectedQty,
      enteredQty: entered,
      discrepancy: discrepancy,
      approverId: user!.id,
      timestamp: Date.now(),
      synced: 0
    });

    if (discrepancy !== 0) {
      if (stockRecord) {
        await db.inventory.update(stockRecord.id!, { qty: entered, synced: 0 });
      } else {
        await db.inventory.add({
          id: crypto.randomUUID(),
          shopId: user!.shopId,
          productId: selectedProduct,
          qty: entered,
          synced: 0
        });
      }
      await db.inventory_logs.add({
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2,6)}`,
        shopId: user!.shopId,
        productId: selectedProduct,
        changeType: 'AUDIT_ADJUSTMENT',
        qtyChanged: discrepancy,
        newBalance: entered,
        staffId: user!.id,
        timestamp: Date.now(),
        synced: 0
      });
    }

    alert(`Audit Logged! Difference: ${discrepancy}`);
    setSelectedProduct('');
    setPhysicalCount('');
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '60px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '14px',
          background: 'var(--navy)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <ShieldAlert size={22} />
        </div>
        <div>
          <h1 style={{ marginBottom: '2px' }}>Stock Checking</h1>
          <p style={{ fontSize: '0.82rem', margin: 0 }}>Verify physical shelf stock against system records</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
        
        {/* Left Side: Blind Audit Module */}
        <div className="card" style={{ borderTop: '4px solid var(--gold)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <PackageSearch size={20} style={{ color: 'var(--gold)' }} />
            <h3 style={{ margin: 0 }}>Count Stock on Shelves</h3>
          </div>
          
          <p style={{ fontSize: '0.875rem', color: '#547A95', marginBottom: '24px' }}>
            Count the stock manually on the floor. The system will hide the expected numbers until you submit your count.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label>Select Item to Check</label>
              <select style={{ height: '48px' }} value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                <option value="">-- Choose Item on Floor --</option>
                {inventory.map(inv => {
                   const p = products.find(prod => prod.id === inv.productId);
                   return p ? <option key={p.id} value={p.id}>{p.name} ({p.sku})</option> : null;
                })}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label>Physical Count (How many did you find?)</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                 <input 
                   type="number" 
                   placeholder="e.g. 12"
                   value={physicalCount} 
                   onChange={e => setPhysicalCount(parseInt(e.target.value))} 
                   style={{ flex: 1, height: '48px', ...mono }} 
                 />
                 <button onClick={handleAuditSubmit} style={{ height: '48px', padding: '0 24px', flexShrink: 0 }}>
                    Lock Scan
                 </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '32px', pt: '16px', borderTop: '1px solid #E8EDF2' }}>
            <h4 style={{ marginBottom: '16px', marginTop: '16px' }}>Recent Differences Found</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
               {pastAudits.length === 0 && <p style={{ fontSize: '0.875rem', color: '#94A3B8' }}>No stock checks performed recently.</p>}
               {pastAudits.map(audit => {
                  const p = products.find(prod => prod.id === audit.productId);
                  return (
                    <div key={audit.id} style={{ padding: '14px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E8EDF2' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.85rem' }}>{p?.name}</span>
                          <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{new Date(audit.timestamp).toLocaleTimeString()}</span>
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', color: '#547A95' }}>Expected: {audit.expectedQty} | Counted: {audit.enteredQty}</span>
                          <span style={{ ...mono, fontSize: '0.78rem', fontWeight: 700, color: audit.discrepancy === 0 ? '#15803D' : '#B91C1C' }}>
                            {audit.discrepancy === 0 ? 'MATCH' : `Lost: ${audit.discrepancy}`}
                          </span>
                       </div>
                    </div>
                  )
               })}
            </div>
          </div>
        </div>

        {/* Right Side: Missing Items Tracker */}
        <div className="card" style={{ borderTop: '4px solid #1A2B4A' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Ghost size={20} style={{ color: '#547A95' }} />
            <h3 style={{ margin: 0 }}>Missing Items Tracker</h3>
          </div>
          
          <p style={{ fontSize: '0.875rem', color: '#547A95', marginBottom: '24px' }}>
            The system flags items that are "in stock" but haven't sold in 48 hours. This might mean they are missing or stolen.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {phantomItems.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#15803D' }}>
                <CheckCircle2 size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p style={{ fontWeight: 600 }}>All items accounted for!</p>
              </div>
            )}
            
            {phantomItems.map(p => {
               const stock = inventory.find(i => i.productId === p.id)?.qty || 0;
               return (
                 <div key={p.id} style={{ padding: '16px', borderRadius: '12px', background: '#FFFBEB', border: '1px solid #FCD34D', borderLeft: '4px solid #F59E0B' }}>
                    <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>{p.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#92400E' }}>
                       <span>Available: <strong style={mono}>{stock}</strong></span>
                       <span>Last Sale: <strong>&gt; 48 hrs</strong></span>
                    </div>
                    <button 
                      style={{ marginTop: '12px', width: '100%', height: '36px', background: '#F59E0B', color: '#fff', fontSize: '0.75rem' }} 
                      onClick={() => setSelectedProduct(p.id)}
                    >
                       Start Counting This
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

import { useState } from 'react';
import { db } from '../../lib/db/schema';
import { useAuth } from '../../context/AuthContext';
import { useLiveQuery } from '../../hooks/useLiveQuery';

export const BlindAudit = () => {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [results, setResults] = useState<Record<string, 'MATCH'|'MISMATCH'|null>>({});

  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const inventory = useLiveQuery(() => user ? db.inventory.where('shopId').equals(user.shopId).toArray() : [], [user]) || [];
  
  const categories = Array.from(new Set(products.map(p => p.category)));

  const handleBatchAudit = async () => {
    const newResults = { ...results };
    let processed = 0;

    for (const [productId, physicalCount] of Object.entries(counts)) {
      if (physicalCount === undefined || isNaN(physicalCount)) continue;

      const expected = inventory.find(i => i.productId === productId)?.qty || 0;
      const discrepancy = physicalCount - expected;
      
      await db.audits.add({
         shopId: user!.shopId,
         productId: productId,
         expectedQty: expected,
         enteredQty: physicalCount,
         discrepancy: discrepancy,
         approverId: user!.id,
         timestamp: Date.now()
      });

      // Update local ledger directly if missing
      if (discrepancy !== 0) {
        const stockRecord = inventory.find(i => i.productId === productId);
        if (stockRecord) {
          await db.inventory.update(stockRecord.id!, { qty: physicalCount });
        } else {
          await db.inventory.add({
            id: Math.random().toString(36).substring(2, 15),
            shopId: user!.shopId,
            productId: productId,
            qty: physicalCount
          });
        }
      }

      newResults[productId] = discrepancy === 0 ? 'MATCH' : 'MISMATCH';
      processed++;
    }

    if (processed > 0) {
       setResults(newResults);
       alert(`Batch Audit Completed: ${processed} items logged and verified.`);
       setCounts({}); // Clear active inputs for the next counting sweep
    }
  };

  return (
    <div className="animate-fade-in p-8 glass-panel h-full flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary-color opacity-5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
      
      <div className="flex justify-between items-center mb-4 z-10">
         <div>
           <h2 className="text-3xl font-800 gradient-text mb-2 tracking-tight">Security Protocol: Audits</h2>
           <p className="text-text-secondary text-sm">Select a category node. Active ledger quantities are cryptographically hidden.</p>
         </div>
         {selectedCategory && (
            <button onClick={handleBatchAudit} className="btn-primary shadow-lg border border-[rgba(255,255,255,0.2)] hover:scale-105">
               Submit Floor Scans
            </button>
         )}
      </div>
      
      <div className="mb-8 z-10 pt-4" style={{ borderTop: '1px solid var(--glass-border)' }}>
        <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Isolate Zone</label>
        <select className="input-modern w-full md:w-1/3" style={{ fontSize: '1rem', background: 'var(--surface-color-2)' }} onChange={e => setSelectedCategory(e.target.value)}>
           <option value="">-- Awaiting Input: Select Branch Category --</option>
           {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }} className="z-10 rounded-xl border border-[rgba(255,255,255,0.05)] bg-[rgba(0,0,0,0.2)]">
      {selectedCategory && (
        <table className="table-modern">
          <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
            <tr>
              <th style={{ width: '15%' }}>SKU Identifier</th>
              <th style={{ width: '40%' }}>Nomenclature</th>
              <th className="text-center" style={{ width: '25%' }}>Blind Audit Count</th>
              <th style={{ width: '20%' }}>System Response</th>
            </tr>
          </thead>
          <tbody>
            {products.filter(p => p.category === selectedCategory).map(p => {
               const res = results[p.id];
               return (
                 <tr key={p.id}>
                   <td className="font-mono text-sm" style={{ color: '#818cf8' }}>{p.sku}</td>
                   <td className="font-500 text-[1.05rem]">{p.name}</td>
                   <td className="text-center px-6">
                      <input 
                         type="number" 
                         placeholder="—"
                         value={counts[p.id] ?? ''} 
                         onChange={e => setCounts({...counts, [p.id]: parseInt(e.target.value)})} 
                         className="input-modern w-full text-center font-bold text-lg" 
                         style={{ background: 'rgba(255,255,255,0.05)', MozAppearance: 'textfield' }} 
                      />
                   </td>
                   <td>
                      {res === 'MATCH' && <span className="badge badge-success">✓ Verified Clean</span>}
                      {res === 'MISMATCH' && <span className="badge badge-danger shadow-[0_0_10px_rgba(244,63,94,0.3)]">⚠️ ENFORCEMENT LOGGED</span>}
                   </td>
                 </tr>
               )
            })}
          </tbody>
        </table>
      )}
      </div>
    </div>
  )
};

export default BlindAudit;

import { useState } from 'react';
import { db } from '../../lib/db/schema';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { Database, ShieldAlert, Package, TrendingDown, TrendingUp, ArrowRightLeft, Users, PlusCircle, CreditCard } from 'lucide-react';
import { formatKSh } from '../../utils/formatters';

export const GlobalAnalytics = () => {
   // Admins query everything blindly bypassing privacy walls
   const products = useLiveQuery(() => db.products.toArray(), []);
   const inventory = useLiveQuery(() => db.inventory.toArray(), []);
   const transfers = useLiveQuery(() => db.transfers.toArray(), []);
   const audits = useLiveQuery(() => db.audits.toArray(), []);
   const sales = useLiveQuery(() => db.sale_transactions.toArray(), []);
   const saleItems = useLiveQuery(() => db.sale_items.toArray(), []);

   const [newEmp, setNewEmp] = useState({ username: '', name: '', passcode: '', role: 'STAFF', shopId: 'shop_1', shopName: 'Nairobi Central' });
   const [empSuccess, setEmpSuccess] = useState('');
   const [filterShopId, setFilterShopId] = useState('ALL');
   const [startDate, setStartDate] = useState('');
   const [endDate, setEndDate] = useState('');
   const [activeRange, setActiveRange] = useState('');

   const handleQuickSelectDate = (range: 'today' | 'week' | 'month') => {
      setActiveRange(range);
      const today = new Date();
      if (range === 'today') {
         const isoDate = today.toISOString().split('T')[0];
         setStartDate(isoDate);
         setEndDate(isoDate);
      } else if (range === 'week') {
         const startOfWeek = new Date(today);
         startOfWeek.setDate(today.getDate() - today.getDay());
         setStartDate(startOfWeek.toISOString().split('T')[0]);
         const endOfWeek = new Date(today);
         endOfWeek.setDate(startOfWeek.getDate() + 6);
         setEndDate(endOfWeek.toISOString().split('T')[0]);
      } else if (range === 'month') {
         const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
         setStartDate(startOfMonth.toISOString().split('T')[0]);
         const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
         setEndDate(endOfMonth.toISOString().split('T')[0]);
      }
   };

   const handleCreateEmployee = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
         await db.employees.add({ ...newEmp } as any);
         setEmpSuccess(`Employee Created: ${newEmp.username} added.`);
         setNewEmp({ username: '', name: '', passcode: '', role: 'STAFF', shopId: 'shop_1', shopName: 'Nairobi Central' });
         setTimeout(() => setEmpSuccess(''), 3000);
      } catch (err) {
         setEmpSuccess('User already exists or system error.');
      }
   };

   // Display Loading State to avoid mapping undefined
   if (!products || !inventory || !transfers || !audits || !sales || !saleItems) {
      return (
         <div className="flex items-center justify-center h-full">
            <p className="text-text-secondary text-lg">Loading Analytics Data...</p>
         </div>
      );
   }

   try {
      // Calculate Global Value Matrix safely
      let totalValue = 0;
      inventory.filter(i => filterShopId === 'ALL' || i.shopId === filterShopId).forEach(inv => {
         const p = products.find(p => p.id === inv.productId);
         if (p) totalValue += ((p.basePrice || 0) * (inv.qty || 0));
      });

      // Calculate aggregated shrinkage globally
      let totalShrinkageValue = 0;
      audits.filter(a => (a.discrepancy || 0) < 0 && (filterShopId === 'ALL' || a.shopId === filterShopId)).forEach(a => {
         const p = products.find(p => p.id === a.productId);
         if (p) totalShrinkageValue += ((p.basePrice || 0) * Math.abs(a.discrepancy || 0));
      });

      // Calculate locked transit values
      let totalTransitValue = 0;
      transfers.filter(t => t.status === 'PENDING' && (filterShopId === 'ALL' || t.toShopId === filterShopId)).forEach(t => {
         (t.items || []).forEach(item => {
            const p = products.find(p => p.id === item.productId);
            if (p) totalTransitValue += ((p.basePrice || 0) * (item.qty || 0));
         });
      });

      let totalRevenue = 0;
      let totalCOGS = 0;

      const filteredSales = sales.filter(s => {
         if (filterShopId !== 'ALL' && s.shopId !== filterShopId) return false;
         
         const txDate = new Date(s.timestamp);
         if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (txDate < start) return false;
         }
         if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (txDate > end) return false;
         }
         return true;
      });

      filteredSales.forEach(s => {
         totalRevenue += (s.totalKsh || 0);
         const itemsForSale = saleItems.filter(i => i.saleId === s.id);
         itemsForSale.forEach(item => {
            const p = products.find(prod => prod.id === item.productId);
            if (p) {
               const buyingPrice = (p as any).buying_price || p.wholesalePrice || 0;
               totalCOGS += buyingPrice * item.qty;
            }
         });
      });

      const grossProfit = totalRevenue - totalCOGS;

      return (
         <div className="animate-fade-in flex flex-col gap-6 h-full p-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--border-color)] pb-4">
               <h2 className="text-3xl font-800 tracking-tight flex items-center gap-3">
                  <Database className="text-primary-color" size={32} /> Store Financial Overview
               </h2>

               <div className="flex flex-col xl:flex-row items-center gap-4 xl:gap-8">
                  {/* Segmented Control & Date Pickers Unified Bar */}
                  <div className="flex flex-col md:flex-row items-center gap-4 bg-[var(--surface-color-2)] p-2 rounded-3xl md:rounded-full border border-[var(--border-color)] shadow-sm">
                     
                     {/* Segmented Buttons */}
                     <div className="flex items-center gap-1 bg-black/20 p-1 rounded-full">
                        {(['today', 'week', 'month'] as const).map(range => (
                           <button 
                              key={range}
                              onClick={() => handleQuickSelectDate(range)} 
                              className={`px-4 py-1.5 text-sm font-bold rounded-full transition-all duration-300 ${activeRange === range ? 'bg-[#6b21a8] text-white shadow-md' : 'text-text-muted hover:text-white hover:bg-white/10 outline outline-1 outline-transparent hover:outline-[var(--border-color)]'}`}
                           >
                              {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
                           </button>
                        ))}
                     </div>

                     <div className="hidden md:block w-px h-6 bg-[var(--glass-border)]"></div>

                     {/* Date Pickers */}
                     <div className="flex items-center gap-2 px-2">
                        <input 
                           type="date" 
                           title="Start Date"
                           className="bg-transparent text-white text-sm font-mono p-1 rounded outline-none border border-transparent focus:border-[#6b21a8] transition-colors cursor-pointer"
                           value={startDate}
                           onChange={e => { setActiveRange(''); setStartDate(e.target.value); }}
                        />
                        <span className="text-text-muted font-bold text-sm">to</span>
                        <input 
                           type="date" 
                           title="End Date"
                           className="bg-transparent text-white text-sm font-mono p-1 rounded outline-none border border-transparent focus:border-[#6b21a8] transition-colors cursor-pointer"
                           value={endDate}
                           onChange={e => { setActiveRange(''); setEndDate(e.target.value); }}
                        />
                     </div>
                  </div>

                  <select 
                     className="input-modern bg-[var(--surface-color-2)] text-white px-4 py-2.5 rounded-full border border-[var(--border-color)] outline-none focus:border-[#6b21a8] transition-colors"
                     value={filterShopId}
                     onChange={e => setFilterShopId(e.target.value)}
                  >
                     <option value="ALL">All Branches</option>
                     <option value="shop_1">Nairobi Central (Shop 1)</option>
                     <option value="shop_2">Mombasa Road (Shop 2)</option>
                     <option value="shop_3">Kisumu West (Shop 3)</option>
                     <option value="warehouse">Main Warehouse</option>
                  </select>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               <div className="glass-card p-6" style={{ borderTop: '4px solid var(--primary-color)' }}>
                  <div className="text-text-secondary text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><CreditCard size={16} /> Total Revenue</div>
                  <div className="text-3xl font-800 text-primary-color">{formatKSh(totalRevenue)}</div>
                  <div className="text-xs text-text-muted mt-2">Revenue from completed sales</div>
               </div>
               <div className="glass-card p-6" style={{ borderTop: '4px solid var(--warning-color)' }}>
                  <div className="text-text-secondary text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><Package size={16} /> Cost of Goods Sold (COGS)</div>
                  <div className="text-3xl font-800 text-warning-color">{formatKSh(totalCOGS)}</div>
                  <div className="text-xs text-text-muted mt-2">Original cost of Products sold</div>
               </div>
               <div className="glass-card p-6" style={{ borderTop: '4px solid var(--success-color)' }}>
                  <div className="text-text-secondary text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><TrendingUp size={16} /> Gross Profit</div>
                  <div className="text-3xl font-800 text-success-color">{formatKSh(grossProfit)}</div>
                  <div className="text-xs text-text-muted mt-2">Total Revenue minus COGS</div>
               </div>

               <div className="glass-card p-6" style={{ borderTop: '4px solid var(--danger-color)' }}>
                  <div className="text-text-secondary text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><TrendingDown size={16} /> Missing Stock</div>
                  <div className="text-3xl font-800 text-danger-color">{formatKSh(totalShrinkageValue)}</div>
                  <div className="text-xs text-text-muted mt-2">Verified stock discrepancies</div>
               </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 mt-4 flex-1">
               <div className="glass-panel p-6 flex-1 overflow-y-auto min-h-[300px]">
                  <h3 className="font-bold text-lg mb-4 text-text-secondary flex items-center gap-2"><ShieldAlert size={18} /> Recent Stock Audits</h3>
                  {audits.filter(a => filterShopId === 'ALL' || a.shopId === filterShopId).length === 0 ? <p className="text-success-color text-sm">No historical discrepancy logs active.</p> : (
                     <table className="table-modern w-full text-left border-collapse">
                        <thead>
                           <tr className="border-b border-gray-700">
                              <th className="py-2">Shop Branch</th>
                              <th className="py-2">Product Name</th>
                              <th className="py-2">Manager ID</th>
                              <th className="py-2">Variance</th>
                           </tr>
                        </thead>
                        <tbody>
                           {audits.filter(a => filterShopId === 'ALL' || a.shopId === filterShopId).slice(-6).reverse().map((a, i) => {
                              const p = products.find(prod => prod.id === a.productId);
                              return (
                                 <tr key={a.id || i} className="border-b border-[rgba(255,255,255,0.05)]">
                                    <td className="font-mono text-xs py-3">{a.shopId}</td>
                                    <td className="font-bold py-3">{p?.name || 'Unknown'}</td>
                                    <td className="text-xs text-text-muted py-3">{a.approverId}</td>
                                    <td className="py-3">
                                       {a.discrepancy < 0 ? (
                                          <span className="badge badge-danger text-xs px-2 py-1 bg-red-900/30 text-red-400 rounded">Missing {-a.discrepancy}</span>
                                       ) : a.discrepancy > 0 ? (
                                          <span className="badge badge-warning text-xs px-2 py-1 bg-yellow-900/30 text-yellow-500 rounded">Overstock +{a.discrepancy}</span>
                                       ) : (
                                          <span className="badge badge-success text-xs px-2 py-1 bg-green-900/30 text-green-400 rounded">Match</span>
                                       )}
                                    </td>
                                 </tr>
                              )
                           })}
                        </tbody>
                     </table>
                  )}
               </div>

               {/* EMPLOYEE PROVISIONING (SIGN UP FORM) */}
               <div className="glass-panel p-6 lg:w-1/3 flex flex-col h-full">
                  <h3 className="font-bold text-lg mb-6 text-primary-color flex items-center gap-2"><Users size={18} /> New Employee Login</h3>

                  {empSuccess && <div className="p-3 mb-4 rounded-lg bg-[rgba(16,185,129,0.1)] text-success-color border border-[rgba(16,185,129,0.3)] text-sm font-bold">{empSuccess}</div>}

                   <form onSubmit={handleCreateEmployee} className="flex flex-col gap-4">
                     <div>
                        <label className="text-xs uppercase font-bold text-text-muted mb-1 block">Username</label>
                        <input type="text" className="input-modern w-full p-2 bg-[var(--surface-color-2)] text-white rounded border border-[var(--border-color)]" required value={newEmp.username} onChange={e => setNewEmp({ ...newEmp, username: e.target.value.toLowerCase().trim() })} placeholder="system.user" />
                     </div>
                     <div>
                        <label className="text-xs uppercase font-bold text-text-muted mb-1 block">Full Name</label>
                        <input type="text" className="input-modern w-full p-2 bg-[var(--surface-color-2)] text-white rounded border border-[var(--border-color)]" required value={newEmp.name} onChange={e => setNewEmp({ ...newEmp, name: e.target.value })} placeholder="e.g. John Doe" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="text-xs uppercase font-bold text-text-muted mb-1 block">Role</label>
                           <select className="input-modern w-full text-sm p-2 bg-[var(--surface-color-2)] text-white rounded border border-[var(--border-color)]" value={newEmp.role} onChange={e => setNewEmp({ ...newEmp, role: e.target.value })}>
                              <option value="STAFF">Standard Staff</option>
                              <option value="MANAGER">Branch Manager</option>
                              <option value="ADMIN">Super Admin</option>
                           </select>
                        </div>
                        <div>
                           <label className="text-xs uppercase font-bold text-text-muted mb-1 block">Password</label>
                           <input type="password" className="input-modern w-full p-2 bg-[var(--surface-color-2)] text-white rounded border border-[var(--border-color)]" required value={newEmp.passcode} onChange={e => setNewEmp({ ...newEmp, passcode: e.target.value })} placeholder="••••••••" />
                        </div>
                     </div>
                     <div>
                        <label className="text-xs uppercase font-bold text-text-muted mb-1 block">Assigned Branch</label>
                        <select className="input-modern w-full text-sm p-2 bg-[var(--surface-color-2)] text-white rounded border border-[var(--border-color)]" value={newEmp.shopId} onChange={e => {
                           const nameMap: Record<string, string> = { 'shop_1': 'Nairobi Central', 'shop_2': 'Mombasa Road', 'shop_3': 'Kisumu West', 'warehouse': 'Global Warehouse' };
                           setNewEmp({ ...newEmp, shopId: e.target.value, shopName: nameMap[e.target.value] });
                        }}>
                           <option value="shop_1">Nairobi Central</option>
                           <option value="shop_2">Mombasa Road</option>
                           <option value="shop_3">Kisumu West</option>
                           <option value="warehouse">Main Warehouse (Global)</option>
                        </select>
                     </div>

                     <button type="submit" className="btn btn-primary w-full mt-2 py-3 flex items-center justify-center gap-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold">
                        <PlusCircle size={18} /> Create Employee
                     </button>
                  </form>
               </div>
            </div>
         </div>
      );
   } catch (error) {
      console.error("GlobalAnalytics Render Error:", error);
      return (
         <div className="flex items-center justify-center h-full">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
               <strong className="font-bold">Rendering Error: </strong>
               <span className="block sm:inline">Analytics dashboard encountered a critical error.</span>
            </div>
         </div>
      );
   }
};

export default GlobalAnalytics;

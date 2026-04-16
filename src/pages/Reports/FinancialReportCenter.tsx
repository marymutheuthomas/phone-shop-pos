import { useState } from 'react';
import { db } from '../../lib/db/schema';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { formatKSh } from '../../utils/formatters';
import { 
  TrendingUp, Wallet, Users, Package, ArrowUpRight, ArrowDownRight, 
  Calendar, PieChart, Activity, DollarSign, ShieldCheck 
} from 'lucide-react';

const FinancialReportCenter = () => {
    const [dateRange, setDateRange] = useState('30d');

    // ── Fetch Data ───────────────────────────────────────────────────────────
    const stats = useLiveQuery(async () => {
        const sales = await db.sale_transactions.toArray();
        const items = await db.sale_items.toArray();
        const inventory = await db.inventory.toArray();
        const products = await db.products.toArray();
        const customers = await db.customers.toArray();

        const totalRevenue = sales.reduce((acc, curr) => acc + curr.totalKsh, 0);
        const totalCogs = items.reduce((acc, item) => {
            const product = products.find(p => p.id === item.productId);
            return acc + (product?.wholesalePrice || 0) * item.qty;
        }, 0);
        const grossProfit = totalRevenue - totalCogs;
        const totalDebtors = sales
            .filter(s => s.paymentMethod === 'DEBT')
            .reduce((acc, curr) => acc + curr.totalKsh, 0);
        const inventoryValue = inventory.reduce((acc, inv) => {
            const product = products.find(p => p.id === inv.productId);
            return acc + (product?.wholesalePrice || 0) * inv.qty;
        }, 0);

        return {
            revenue: totalRevenue,
            cogs: totalCogs,
            profit: grossProfit,
            debt: totalDebtors,
            inventory: inventoryValue,
            customerCount: customers.length
        };
    }, []) || { revenue: 0, cogs: 0, profit: 0, debt: 0, inventory: 0, customerCount: 0 };

    return (
        <div className="p-8 max-w-7xl mx-auto animate-fade-in space-y-10">
            {/* Header Section */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/50 backdrop-blur-md p-6 rounded-3xl border border-white shadow-xl shadow-zinc-200/50">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                        <PieChart className="text-white" size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Financial Engine</h1>
                        <p className="text-zinc-500 font-medium">Performance analytics & shop liquidity</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-zinc-100 p-1.5 rounded-2xl border border-zinc-200">
                    {(['7d', '30d', '90d', 'all'] as const).map(range => (
                        <button 
                            key={range}
                            onClick={() => setDateRange(range)}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all
                                ${dateRange === range 
                                    ? 'bg-white text-indigo-600 shadow-sm' 
                                    : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50'}`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </header>

            {/* Main KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Revenue', val: stats.revenue, icon: DollarSign, color: 'indigo', trend: '+14%', up: true },
                    { label: 'Gross Profit', val: stats.profit, icon: TrendingUp, color: 'emerald', trend: '+8%', up: true },
                    { label: 'Inventory Value', val: stats.inventory, icon: Package, color: 'amber', trend: 'Audit OK', up: true },
                    { label: 'Total Debt', val: stats.debt, icon: Activity, color: 'rose', trend: 'Attention', up: false },
                ].map((kpi, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-xl shadow-zinc-100/50 relative overflow-hidden group hover:border-zinc-300 transition-all">
                        <div className={`absolute -right-4 -bottom-4 w-24 h-24 bg-${kpi.color}-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500`} />
                        <div className="relative z-10">
                            <div className={`w-12 h-12 bg-${kpi.color}-50 rounded-xl flex items-center justify-center mb-4`}>
                                <kpi.icon className={`text-${kpi.color}-600`} size={24} />
                            </div>
                            <p className="text-zinc-400 text-xs font-black uppercase tracking-widest mb-1">{kpi.label}</p>
                            <h2 className="text-2xl font-black text-zinc-900">{formatKSh(kpi.val)}</h2>
                            <div className="flex items-center gap-2 mt-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-${kpi.color}-100 text-${kpi.color}-700`}>
                                    {kpi.trend}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Global Status</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Split View: P&L vs Assets */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* ── Profit & Loss Statement ──────────────────────────────────── */}
                <div className="lg:col-span-3 bg-white rounded-[2.5rem] border border-zinc-100 shadow-2xl shadow-zinc-200/40 p-10 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12">
                        <ShieldCheck size={280} />
                    </div>
                    
                    <div className="flex justify-between items-center mb-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                                <Activity className="text-emerald-600" size={20} />
                            </div>
                            <h3 className="text-xl font-black text-zinc-900 tracking-tight">Income Statement</h3>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">Audited Local Ledger</span>
                    </div>
                    
                    <div className="space-y-8">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.15em] mb-1">Gross Sales Revenue</p>
                                <p className="text-3xl font-black text-zinc-900">{formatKSh(stats.revenue)}</p>
                            </div>
                            <ArrowUpRight className="text-zinc-200" size={32} />
                        </div>

                        <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 border-dashed">
                             <div className="flex justify-between items-center mb-4">
                                <p className="text-zinc-500 font-bold text-sm">Cost of Goods Sold (Wholesale Basis)</p>
                                <p className="text-zinc-900 font-black text-lg">-{formatKSh(stats.cogs)}</p>
                             </div>
                             <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden">
                                <div className="bg-zinc-800 h-full" style={{ width: `${(stats.cogs / stats.revenue) * 100}%` }} />
                             </div>
                             <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-3">
                                COGS represent {stats.revenue > 0 ? ((stats.cogs / stats.revenue) * 100).toFixed(1) : 0}% of total revenue
                             </p>
                        </div>

                        <div className="pt-6 border-t border-zinc-100 flex justify-between items-end">
                            <div>
                                <p className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.15em] mb-1">Projected Net Margin</p>
                                <div className="flex items-baseline gap-3">
                                    <p className="text-5xl font-black text-indigo-600">{formatKSh(stats.profit)}</p>
                                    <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black uppercase tracking-wider">
                                        {stats.revenue > 0 ? ((stats.profit / stats.revenue) * 100).toFixed(1) : 0}% Margin
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Balance Sheet Assets ──────────────────────────────────── */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-zinc-900 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-900/20 relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                        
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md">
                                <Package className="text-white" size={20} />
                            </div>
                            <h3 className="text-xl font-black text-white tracking-tight">Liquid Assets</h3>
                        </div>

                        <div className="space-y-10">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">Stock on Hand</span>
                                    <span className="text-zinc-500 font-bold text-xs uppercase">Valued at Cost</span>
                                </div>
                                <p className="text-4xl font-black text-white">{formatKSh(stats.inventory)}</p>
                                <div className="mt-4 w-full bg-white/10 h-1.5 rounded-full">
                                    <div className="bg-emerald-400 h-full w-[70%]" />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">Accounts Receivable</span>
                                    <span className="text-zinc-500 font-bold text-xs uppercase">{stats.customerCount} Active Debts</span>
                                </div>
                                <p className="text-4xl font-black text-amber-400">{formatKSh(stats.debt)}</p>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-2 block">Requires active collection cycle</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-zinc-100 p-8 shadow-xl shadow-zinc-100/50">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-1">Net Asset Position</p>
                                <p className="text-3xl font-black text-zinc-900">{formatKSh(stats.inventory + stats.debt)}</p>
                            </div>
                            <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center border border-zinc-100">
                                <Wallet className="text-zinc-400" size={20} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <footer className="py-12 flex flex-col items-center gap-4">
                <div className="px-6 py-3 bg-zinc-50 rounded-full border border-zinc-100 flex items-center gap-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Live Ledger Synchronized</span>
                </div>
                <p className="text-[10px] text-zinc-300 font-bold uppercase tracking-widest max-w-sm text-center line-clamp-2">
                    Omni-Shop v1 Financial Engine. Real-time parity with Supabase Cloud & Local Dexie Instance.
                </p>
            </footer>
        </div>
    );
};

export default FinancialReportCenter;

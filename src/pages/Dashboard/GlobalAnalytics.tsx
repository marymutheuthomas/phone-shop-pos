import React, { useState } from 'react';
import { db } from '../../lib/db/schema';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import {
  Database, ShieldAlert, Package, Users,
  Zap, Printer, TrendingUp, UserPlus,
  X, Trash2, Edit3, Plus, Check
} from 'lucide-react';
import { RoleGuard } from '../../components/Auth/RoleGuard';
import { DataTable } from '../../components/Layout/DataTable';

const mono: React.CSSProperties = {
  fontFamily: 'ui-monospace, "Cascadia Code", monospace',
  fontVariantNumeric: 'tabular-nums',
};

const CountUp = ({ value, prefix = 'KSh ' }: { value: number; prefix?: string }) => (
  <span style={mono}>{prefix}{value.toLocaleString()}</span>
);

const STAT_COLORS = ['#1A2B4A', '#15803D', '#B91C1C', '#1D4ED8'] as const;

const th: React.CSSProperties = {
  padding: '14px 20px',
  textAlign: 'left',
  fontSize: '0.65rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.10em',
  color: '#547A95',
  background: '#fff',
  borderBottom: '2px solid #E8EDF2',
};
const td: React.CSSProperties = {
  padding: '16px 20px',
  verticalAlign: 'middle',
  borderBottom: '1px solid #E8EDF2',
  background: '#fff',
};

export const GlobalAnalytics = () => {
  const products  = useLiveQuery(() => db.products.toArray(), []);
  const inventory = useLiveQuery(() => db.inventory.toArray(), []);
  const transfers = useLiveQuery(() => db.transfers.toArray(), []);
  const audits    = useLiveQuery(() => db.audits.toArray(), []);
  const sales     = useLiveQuery(() => db.sale_transactions.toArray(), []);
  const saleItems = useLiveQuery(() => db.sale_items.toArray(), []);
  
  // ── User Management State ──────────────────────────────────────────────────
  const employees = useLiveQuery(() => db.employees.toArray(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newEmp, setNewEmp] = useState({
    username: '', name: '', passcode: '',
    role: 'EMPLOYEE', shopId: 'shop_techplanet', shopName: 'Tech Planet Main Shop'
  });
  const [empSuccess, setEmpSuccess] = useState('');

  const [filterShopId, setFilterShopId] = useState('ALL');
  const [startDate, setStartDate]       = useState('');
  const [endDate, setEndDate]           = useState('');
  const [activeRange, setActiveRange]   = useState('');

  const handleQuickSelectDate = (range: 'today' | 'week' | 'month') => {
    setActiveRange(range);
    const today = new Date();
    if (range === 'today') {
      const iso = today.toISOString().split('T')[0];
      setStartDate(iso); setEndDate(iso);
    } else if (range === 'week') {
      const s = new Date(today); s.setDate(today.getDate() - today.getDay());
      const e = new Date(s);     e.setDate(s.getDate() + 6);
      setStartDate(s.toISOString().split('T')[0]);
      setEndDate(e.toISOString().split('T')[0]);
    } else {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      const e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(s.toISOString().split('T')[0]);
      setEndDate(e.toISOString().split('T')[0]);
    }
  };

  const handleCreateOrUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await db.employees.update(editingId, {
          ...newEmp,
          synced: 0
        });
        setEmpSuccess('User profile updated successfully.');
      } else {
        await db.employees.add({
          ...newEmp,
          id: `emp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          synced: 0
        } as any);
        setEmpSuccess('New staff member added successfully.');
      }
      setNewEmp({ username: '', name: '', passcode: '', role: 'EMPLOYEE', shopId: 'shop_techplanet', shopName: 'Tech Planet Main Shop' });
      setEditingId(null);
      setIsModalOpen(false);
      setTimeout(() => setEmpSuccess(''), 5000);
    } catch {
      setEmpSuccess('Error: Operation failed (Username may already exist).');
    }
  };

  const handleEditClick = (emp: any) => {
    setEditingId(emp.id);
    setNewEmp({
      username: emp.username,
      name: emp.name,
      passcode: emp.passcode || '',
      role: emp.role,
      shopId: emp.shopId,
      shopName: emp.shopName
    });
    setIsModalOpen(true);
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Are you sure you want to remove this user? This action cannot be undone.')) return;
    await db.employees.delete(id);
  };

  if (!products || !inventory || !transfers || !audits || !sales || !saleItems) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <span style={{ color: 'var(--text-muted)' }}>Loading analytics…</span>
      </div>
    );
  }

  // ── Financials ──────────────────────────────────────────────────────────────
  let totalRevenue = 0, totalCOGS = 0, totalShrinkageValue = 0;

  audits
    .filter(a => (a.discrepancy || 0) < 0 && (filterShopId === 'ALL' || a.shopId === filterShopId))
    .forEach(a => {
      const p = products.find(p => p.id === a.productId);
      if (p) totalShrinkageValue += (p.basePrice || 0) * Math.abs(a.discrepancy || 0);
    });

  const filteredSales = sales.filter(s => {
    if (filterShopId !== 'ALL' && s.shopId !== filterShopId) return false;
    const d = new Date(s.timestamp);
    if (startDate && d < new Date(startDate)) return false;
    if (endDate   && d > new Date(endDate))   return false;
    return true;
  });

  filteredSales.forEach(s => {
    totalRevenue += s.totalKsh || 0;
    // Use wholesale_cost if available, otherwise fallback to buying_price/wholesalePrice
    totalCOGS += (s as any).wholesale_cost || 0;
    
    // Fallback for old transactions if wholesale_cost is missing
    if (!((s as any).wholesale_cost)) {
      saleItems.filter(i => i.saleId === s.id).forEach(item => {
        const p = products.find(prod => prod.id === item.productId);
        if (p) totalCOGS += ((p as any).buying_price || p.wholesalePrice || 0) * item.qty;
      });
    }
  });

  const netProfit = totalRevenue - totalCOGS;

  const stats = [
    { label: 'Revenue',       value: totalRevenue,        color: STAT_COLORS[0] },
    { label: 'Net Profit',    value: netProfit,           color: STAT_COLORS[1] },
    { label: 'Shrinkage',     value: totalShrinkageValue, color: STAT_COLORS[2] },
    { label: 'Projection',    value: 9245000,             color: STAT_COLORS[3] },
  ];

  const filterBtnBase: React.CSSProperties = {
    minHeight: '40px', padding: '0 18px', borderRadius: '8px',
    fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em',
    border: '1.5px solid var(--surface-border)',
    background: 'white', color: 'var(--text-secondary)', cursor: 'pointer',
    transition: 'all 150ms ease',
  };
  const filterBtnActive: React.CSSProperties = {
    ...filterBtnBase,
    background: 'var(--navy)', color: '#fff',
    borderColor: 'var(--navy)',
  };

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', paddingBottom: '60px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── 1. Header ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'var(--navy)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Database size={22} strokeWidth={1.5} />
          </div>
          <div>
            <h1 style={{ marginBottom: '2px' }}>Global Analytics</h1>
            <p style={{ fontSize: '0.82rem', margin: 0 }}>Enterprise Orchestration &amp; Intelligence</p>
          </div>
        </div>
        <button onClick={() => window.print()} style={{ gap: '8px', height: '48px', padding: '0 24px', borderRadius: '9999px' }}>
          <Printer size={18} /> Generate Report
        </button>
      </div>

      {/* ── 2. Filter Bar ──────────────────────────────────────────────── */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['today', 'week', 'month'] as const).map(r => (
            <button key={r} onClick={() => handleQuickSelectDate(r)}
              style={activeRange === r ? filterBtnActive : filterBtnBase}>
              {r.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            style={{ width: '160px', height: '40px' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            style={{ width: '160px', height: '40px' }} />
          <select value={filterShopId} onChange={e => setFilterShopId(e.target.value)}
            style={{ width: '220px', height: '40px' }}>
            <option value="ALL">All Shops</option>
            <option value="shop_techplanet">Tech Planet</option>
            <option value="shop_techkys">Techkys</option>
            <option value="shop_brilliance">Brilliance</option>
          </select>
        </div>
      </div>

      {/* ── 3. KPI Bento Grid ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {stats.map((stat, i) => (
          <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              {stat.label}
            </span>
            <div style={{ ...mono, fontSize: '1.6rem', fontWeight: 800, color: stat.color, lineHeight: 1.1 }}>
              <CountUp value={stat.value} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              <TrendingUp size={12} style={{ color: stat.color }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {filteredSales.length} transactions
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── 4. Analytics Tables ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '24px' }}>
        {/* Stock Vulnerabilities */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={18} style={{ color: 'var(--gold)' }} />
            <h3 style={{ margin: 0 }}>Vulnerability Matrix</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <DataTable
              data={products.filter(p => {
                const sum = inventory.filter(inv => inv.productId === p.id && (filterShopId === 'ALL' || inv.shopId === filterShopId)).reduce((s, v) => s + (v.qty || 0), 0);
                return p.reorderLevel !== undefined && sum <= p.reorderLevel;
              }).map(p => ({
                ...p,
                sum: inventory.filter(inv => inv.productId === p.id && (filterShopId === 'ALL' || inv.shopId === filterShopId)).reduce((s, v) => s + (v.qty || 0), 0)
              }))}
              emptyMessage="All stock levels healthy."
              columns={[
                { header: 'Product', render: p => <span style={{ fontWeight: 600 }}>{p.name}</span> },
                { header: 'Stock', align: 'right', render: p => <span style={{ ...mono, color: '#B91C1C', fontWeight: 700 }}>{p.sum}</span> },
                { header: 'Reorder At', align: 'right', render: p => <span style={mono}>{p.reorderLevel}</span> },
                { header: '⚡', align: 'center', render: () => <Zap size={14} style={{ color: '#F59E0B' }} /> },
              ]}
            />
          </div>
        </div>

        {/* Audit Logs */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={18} style={{ color: 'var(--gold)' }} />
            <h3 style={{ margin: 0 }}>Log Verification</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <DataTable
              data={audits.filter(a => filterShopId === 'ALL' || a.shopId === filterShopId).slice(-10).reverse()}
              emptyMessage="No active discrepancies."
              columns={[
                { header: 'Node', render: a => <span>{a.shopId?.split('_')[1]}</span> },
                { header: 'Product', render: a => <span>{products.find(p => p.id === a.productId)?.name || 'Unknown'}</span> },
                {
                  header: 'Variance', align: 'right',
                  render: a => (
                    <span style={{ ...mono, fontWeight: 700, color: (a.discrepancy ?? 0) < 0 ? '#B91C1C' : '#15803D' }}>
                      {(a.discrepancy ?? 0) > 0 ? '+' : ''}{a.discrepancy}
                    </span>
                  )
                },
              ]}
            />
          </div>
        </div>
      </div>

      {/* ── 5. User Management ─────────────────────────────────────────── */}
      <RoleGuard
        allowedRoles={['ADMIN']}
        fallback={<p style={{ padding: '40px 0', color: 'var(--text-muted)' }}>Unauthorized: Access Restricted</p>}
      >
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E8EDF2',
          borderTop: '4px solid #C2A56D',
          borderRadius: '16px',
          boxShadow: '0 10px 40px -10px rgba(44,57,71,0.08)',
          overflow: 'hidden',
        }}>
          {/* Control Bar */}
          <div style={{ padding: '24px 28px', borderBottom: '1px solid #E8EDF2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Users size={20} style={{ color: '#C9A84C' }} />
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1A2B4A' }}>User Management</h2>
            </div>
            <button 
              onClick={() => {
                setEditingId(null);
                setNewEmp({ username: '', name: '', passcode: '', role: 'EMPLOYEE', shopId: 'shop_techplanet', shopName: 'Tech Planet Main Shop' });
                setIsModalOpen(true);
              }}
              style={{ height: '48px', padding: '0 24px', borderRadius: '9999px', gap: '8px' }}
            >
              <Plus size={18} /> Add New User
            </button>
          </div>

          {empSuccess && (
            <div style={{
              margin: '20px 28px 0', padding: '12px 16px', borderRadius: '8px',
              background: empSuccess.startsWith('Error') ? '#FEE2E2' : '#DCFCE7',
              color:      empSuccess.startsWith('Error') ? '#B91C1C' : '#15803D',
              fontSize: '0.85rem', fontWeight: 600,
            }}>
              {empSuccess}
            </div>
          )}

          {/* User List Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th style={th}>Username</th>
                  <th style={th}>Full Name</th>
                  <th style={th}>Permissions</th>
                  <th style={th}>Assigned Shop</th>
                  <th style={{ ...th, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {(employees || []).map(emp => (
                  <tr key={emp.id} style={{ transition: 'background 120ms ease' }}>
                    <td style={td}><span style={{ ...mono, fontWeight: 700, color: '#1A2B4A' }}>{emp.username}</span></td>
                    <td style={td}>{emp.name}</td>
                    <td style={td}>
                      <span style={{ 
                        fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', 
                        padding: '4px 10px', borderRadius: '20px',
                        background: emp.role === 'ADMIN' ? '#DCFCE7' : emp.role === 'MANAGER' ? '#FEF3C7' : '#F1F5F9',
                        color: emp.role === 'ADMIN' ? '#15803D' : emp.role === 'MANAGER' ? '#92400E' : '#547A95'
                      }}>
                        {emp.role === 'ADMIN' ? 'Owner/Admin' : emp.role === 'MANAGER' ? 'Manager' : 'Staff'}
                      </span>
                    </td>
                    <td style={td}>{emp.shopName}</td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button 
                          onClick={() => handleEditClick(emp)}
                          style={{ height: '40px', width: '40px', padding: 0, background: 'transparent', color: '#547A95', border: '1.5px solid #E8EDF2', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Edit3 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteEmployee(emp.id)}
                          style={{ height: '40px', width: '40px', padding: 0, background: 'transparent', color: '#EF4444', border: '1.5px solid #FCA5A5', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Add/Edit User Modal ───────────────────────────────────────────── */}
        {isModalOpen && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(26,43,74,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '24px', backdropFilter: 'blur(4px)'
          }}>
            <div className="card-raised" style={{ width: '100%', maxWidth: '640px', borderTop: '4px solid #C2A56D', padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ margin: 0 }}>{editingId ? 'Edit Staff Member' : 'Add New Staff Member'}</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: '#547A95' }}>Provision access for a member of the shop team.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} style={{ minHeight: '36px', width: '36px', padding: 0, background: 'transparent', color: '#547A95', border: '1px solid #E8EDF2', borderRadius: '8px' }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateOrUpdateEmployee}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label>Username</label>
                    <input
                      required
                      placeholder="e.g. john.doe"
                      style={{ height: '48px' }}
                      value={newEmp.username}
                      onChange={e => setNewEmp({ ...newEmp, username: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label>Full Name</label>
                    <input
                      required
                      placeholder="e.g. John Doe"
                      style={{ height: '48px' }}
                      value={newEmp.name}
                      onChange={e => setNewEmp({ ...newEmp, name: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label>Password / PIN</label>
                    <input
                      required={!editingId}
                      type="password"
                      placeholder={editingId ? '•••••• (leave blank to keep current)' : '••••••'}
                      style={{ height: '48px' }}
                      value={newEmp.passcode}
                      onChange={e => setNewEmp({ ...newEmp, passcode: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label>Permissions</label>
                    <select 
                      style={{ height: '48px' }}
                      value={newEmp.role} 
                      onChange={e => setNewEmp({ ...newEmp, role: e.target.value })}
                    >
                      <option value="EMPLOYEE">Staff</option>
                      <option value="MANAGER">Manager</option>
                      <option value="ADMIN">Owner/Admin</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
                    <label>Assigned Shop</label>
                    <select 
                      style={{ height: '48px' }}
                      value={newEmp.shopId} 
                      onChange={e => setNewEmp({ ...newEmp, shopId: e.target.value, shopName: e.target.options[e.target.selectedIndex].text })}
                    >
                      <option value="shop_techplanet">Tech Planet Main Shop</option>
                      <option value="shop_techkys">Techkys</option>
                      <option value="shop_brilliance">Brilliance Stationers</option>
                      <option value="shop_taf1">Taf 1</option>
                      <option value="shop_taf2">Taf 2</option>
                    </select>
                  </div>

                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, height: '48px', background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid #E8EDF2' }}>Cancel</button>
                    <button type="submit" style={{ flex: 2, height: '48px', gap: '8px' }}>
                      {editingId ? <Check size={18} /> : <UserPlus size={18} />}
                      {editingId ? 'Save Changes' : 'Create User'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </RoleGuard>
    </div>
  );
};

export default GlobalAnalytics;

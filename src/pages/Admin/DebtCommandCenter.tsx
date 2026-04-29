import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/db/schema';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { useInventory } from '../../hooks/useInventory';
import { formatKSh } from '../../utils/formatters';
import {
  Clock, Search, Plus, X,
  CheckCircle2, XCircle, AlertCircle,
  UserCheck, Wallet, DollarSign
} from 'lucide-react';

const mono: React.CSSProperties = {
  fontFamily: 'ui-monospace, "Cascadia Code", monospace',
  fontVariantNumeric: 'tabular-nums',
};

const bentoCard = (topColor: string = '#C2A56D', extra?: React.CSSProperties): React.CSSProperties => ({
  background: '#FFFFFF',
  border: '1px solid #E8EDF2',
  borderTop: `4px solid ${topColor}`,
  borderRadius: '16px',
  boxShadow: '0 10px 40px -10px rgba(44,57,71,0.08)',
  padding: '24px',
  ...extra,
});

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '16px 28px',
  fontSize: '0.65rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: '#547A95',
  borderBottom: '1px solid #E8EDF2',
};

const td: React.CSSProperties = {
  padding: '20px 28px',
  borderBottom: '1px solid #E8EDF2',
  verticalAlign: 'middle'
};

const DebtCommandCenter = () => {
  const { user } = useAuth();
  const { handleDebtVerification, handleDebtReversal } = useInventory();

  // ── UI State ───────────────────────────────────────────────────────────────
  const [searchLedger, setSearchLedger] = useState('');
  const [searchVetting, setSearchVetting] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '', phone: '', creditLimit: '5000'
  });

  // ── Payment Modal State ───────────────────────────────────────────────────
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'M-PESA'>('CASH');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const data = useLiveQuery(async () => {
    const customers    = await db.customers.toArray();
    const pendingSales = await db.sale_transactions.where('status').equals('PENDING').toArray();

    const ledgerData = customers.filter(c => 
      c.name.toLowerCase().includes(searchLedger.toLowerCase()) || 
      (c.phone && c.phone.includes(searchLedger))
    ).sort((a, b) => (b.totalBalance || 0) - (a.totalBalance || 0));

    const vettingData = customers.filter(c => 
      c.name.toLowerCase().includes(searchVetting.toLowerCase()) || 
      (c.phone && c.phone.includes(searchVetting))
    );

    const totalPendingDebt = pendingSales.reduce((acc, s) => acc + s.totalKsh, 0);

    return {
      ledgerData,
      vettingData,
      pendingSales,
      totalPendingDebt,
      activeClients: customers.filter(c => (c.totalBalance || 0) > 0).length
    };
  }, [searchLedger, searchVetting]) || { ledgerData: [], vettingData: [], pendingSales: [], totalPendingDebt: 0, activeClients: 0 };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await db.customers.add({
        id: crypto.randomUUID(),
        shopId: user?.shopId || 'shop_techplanet',
        name: newCustomer.name,
        phone: newCustomer.phone,
        isDebtEligible: true,
        totalBalance: 0,
        synced: 0
      });
      setIsAddModalOpen(false);
      setNewCustomer({ name: '', phone: '', creditLimit: '5000' });
    } catch (err) { alert('Failed to add customer profile.'); }
  };

  const toggleDebtEligibility = async (id: string, current: boolean) => {
    await db.customers.update(id, { isDebtEligible: !current, synced: 0 });
  };

  const onVerify = async (saleId: string) => {
    try {
      await handleDebtVerification(saleId);
      alert('Debt verified successfully.');
    } catch (err: any) { alert(err.message); }
  };

  const onReject = async (saleId: string) => {
    if (!confirm('Reject this debt? Items will be restocked automatically.')) return;
    try {
      await handleDebtReversal(saleId, user?.name || 'Admin');
      alert('Debt rejected and stock restored.');
    } catch (err: any) { alert(err.message); }
  };

  const openPaymentModal = (customer: any) => {
    setSelectedCustomer(customer);
    setPaymentAmount(customer.totalBalance.toString());
    setPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !paymentAmount) return;
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    setIsProcessingPayment(true);
    try {
      await db.transaction('rw', [db.customers, db.debt_payments, db.sale_transactions], async () => {
        const newBalance = Math.max(0, (selectedCustomer.totalBalance || 0) - amount);
        
        // 1. Update customer balance
        await db.customers.update(selectedCustomer.id, {
          totalBalance: newBalance,
          synced: 0
        });

        // 2. Record payment settlement
        const paymentId = `pmt_${Date.now().toString(36)}`;
        await db.debt_payments.add({
          id: paymentId,
          customerId: selectedCustomer.id,
          amount: amount,
          method: paymentMethod,
          timestamp: Date.now(),
          synced: 0
        });

        // 3. Record as Debt Settlement transaction for financial reporting
        await db.sale_transactions.add({
          id: `txn_settle_${Date.now().toString(36)}`,
          shopId: user?.shopId || 'shop_techplanet',
          staffId: user?.id || 'admin',
          totalKsh: amount,
          wholesale_cost: 0,
          discountKsh: 0,
          paymentMethod: 'DEBT_SETTLEMENT',
          priceType: 'RETAIL',
          status: 'COMPLETED',
          timestamp: Date.now(),
          synced: 0,
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name
        } as any);
      });

      setPaymentModalOpen(false);
      setPaymentAmount('');
      alert('Payment recorded and ledger updated.');
    } catch (err) {
      console.error(err);
      alert('Failed to record payment.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const remainingBalance = selectedCustomer ? Math.max(0, (selectedCustomer.totalBalance || 0) - Number(paymentAmount || 0)) : 0;

  const now = new Date().toLocaleTimeString();

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', paddingBottom: '60px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* ── Page Header ────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ color: 'var(--navy)', fontWeight: 700, margin: 0 }}>Debt Command Center</h1>
        <p style={{ color: '#547A95', fontSize: '0.875rem', marginTop: '4px' }}>Unified enterprise liquidity and credit vetting orchestrator.</p>
      </div>

      {/* ── TIER 1: VERIFICATION PROTOCOLS (Metric Ribbon) ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <div style={bentoCard('#C2A56D')}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#547A95', margin: '0 0 8px' }}>Pending Debt</p>
          <div style={{ ...mono, fontSize: '2rem', fontWeight: 800, color: '#2C3947' }}>{formatKSh(data.totalPendingDebt)}</div>
        </div>

        <div style={bentoCard('#C2A56D')}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#547A95', margin: '0 0 8px' }}>Active Clients</p>
          <div style={{ ...mono, fontSize: '2rem', fontWeight: 800, color: '#2C3947' }}>{data.activeClients} Units</div>
        </div>

        <div style={bentoCard('#C2A56D')}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#547A95', margin: '0 0 8px' }}>System State</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 0 4px rgba(34,197,94,0.15)', animation: 'pulse 2s infinite' }} />
            <span style={{ ...mono, fontSize: '0.95rem', fontWeight: 700, color: '#2C3947' }}>Parity Verified @ {now}</span>
          </div>
          <style>{`@keyframes pulse { 0% { transform: scale(0.95); opacity: 0.5; } 70% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(0.95); opacity: 0.5; } }`}</style>
        </div>
      </div>

      {/* ── TIER 2: VETTING ENGINE (2-Column Grid) ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
        
        <div style={bentoCard('#C2A56D', { padding: 0 })}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8EDF2', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserCheck size={18} style={{ color: '#C9A84C' }} />
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#2C3947' }}>Customer Eligibility</h3>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <Search size={16} style={{ position: 'absolute', left: '14px', top: '16px', color: '#547A95', pointerEvents: 'none' }} />
              <input 
                type="text" placeholder="Search for vetting..." 
                value={searchVetting} onChange={e => setSearchVetting(e.target.value)}
                style={{ paddingLeft: '40px', width: '100%', height: '48px' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }}>
              {data.vettingData.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', borderRadius: '12px', border: '1px solid #E8EDF2', background: '#F8FAFC' }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontWeight: 700, color: '#1A2B4A', fontSize: '0.85rem' }}>{c.name}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#547A95' }}>{c.phone} · Bal: <span style={mono}>{formatKSh(c.totalBalance || 0)}</span></p>
                  </div>
                  <button 
                    onClick={() => toggleDebtEligibility(c.id, !!c.isDebtEligible)}
                    style={{ 
                      minHeight: '32px', padding: '0 12px', fontSize: '0.65rem', fontWeight: 700,
                      background: c.isDebtEligible ? '#DCFCE7' : '#FEE2E2',
                      color: c.isDebtEligible ? '#15803D' : '#B91C1C',
                      border: `1px solid ${c.isDebtEligible ? '#BBF7D0' : '#FECACA'}`
                    }}
                  >
                    {c.isDebtEligible ? 'ELIGIBLE' : 'LOCKED'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={bentoCard('#F59E0B', { padding: 0 })}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8EDF2', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={18} style={{ color: '#F59E0B' }} />
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#2C3947' }}>Pending Credit Sales</h3>
          </div>
          <div style={{ padding: '24px', minHeight: '300px' }}>
            {data.pendingSales.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
                <CheckCircle2 size={48} style={{ color: '#547A95', opacity: 0.2 }} />
                <p style={{ margin: 0, fontWeight: 600, color: '#547A95' }}>All Clear! No pending debt transactions.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {data.pendingSales.map(sale => (
                  <div key={sale.id} style={{ padding: '16px', borderRadius: '12px', background: '#FFFBEB', border: '1px solid #FCD34D', borderLeft: '4px solid #F59E0B' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <h4 style={{ margin: '0 0 2px', color: '#1A2B4A' }}>{sale.customerName}</h4>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#547A95' }}>By: {sale.staffId} · {new Date(sale.timestamp).toLocaleTimeString()}</p>
                      </div>
                      <span style={{ ...mono, fontWeight: 800, fontSize: '1.1rem', color: '#92400E' }}>{formatKSh(sale.totalKsh)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => onReject(sale.id)} style={{ flex: 1, background: 'transparent', color: '#B91C1C', border: '1.5px solid #FCA5A5', height: '36px' }}>
                        <XCircle size={14} /> Reject
                      </button>
                      <button onClick={() => onVerify(sale.id)} style={{ flex: 1, background: '#15803D', border: 'none', height: '36px' }}>
                        <CheckCircle2 size={14} /> Verify Debt
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: '24px', padding: '14px', borderRadius: '10px', background: '#FAFBFC', border: '1px solid #E8EDF2', display: 'flex', gap: '12px' }}>
              <AlertCircle size={16} style={{ color: '#C9A84C', flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#547A95', lineHeight: 1.5 }}>
                <strong>Policy Guard:</strong> Rejection cancels the debt and automatically restocks items. Verification commits to permanent ledger.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── TIER 3: MASTER CUSTOMER DEBT LEDGER ────────────────────────── */}
      <div style={bentoCard('#C2A56D', { padding: 0 })}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #E8EDF2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1A2B4A', fontWeight: 700 }}>Master Customer Debt Ledger</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ position: 'relative', width: '320px' }}>
              <Search size={16} style={{ position: 'absolute', left: '14px', top: '16px', color: '#547A95', pointerEvents: 'none' }} />
              <input 
                type="text" placeholder="Search debtors..." 
                value={searchLedger} onChange={e => setSearchLedger(e.target.value)}
                style={{ paddingLeft: '40px', width: '100%', height: '48px' }}
              />
            </div>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              style={{ gap: '8px', height: '48px', padding: '0 24px', borderRadius: '9999px' }}
            >
              <Plus size={16} /> Add Customer
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFBFC' }}>
                <th style={th}>Customer Name</th>
                <th style={th}>Phone</th>
                <th style={{ ...th, textAlign: 'right' }}>Current Balance</th>
                <th style={{ ...th, textAlign: 'center' }}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.ledgerData.map(c => {
                const balance = c.totalBalance || 0;
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #E8EDF2' }}>
                    <td style={{ ...td, fontWeight: 700, color: '#1A2B4A' }}>{c.name}</td>
                    <td style={{ ...td, color: '#547A95', ...mono }}>{c.phone || 'N/A'}</td>
                    <td style={{ ...td, textAlign: 'right', ...mono, fontWeight: 800, color: balance > 0 ? '#D97706' : '#15803D' }}>
                      {formatKSh(balance)}
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      {balance === 0 ? (
                        <span style={{ padding: '4px 12px', borderRadius: '20px', background: '#DCFCE7', color: '#15803D', fontSize: '0.7rem', fontWeight: 700 }}>CLEARED</span>
                      ) : (
                        <span style={{ padding: '4px 12px', borderRadius: '20px', background: '#FEF3C7', color: '#92400E', fontSize: '0.7rem', fontWeight: 700 }}>OUTSTANDING</span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button 
                        onClick={() => openPaymentModal(c)}
                        disabled={balance === 0}
                        style={{ 
                          height: '40px', padding: '0 16px', borderRadius: '8px', 
                          background: balance === 0 ? '#F1F5F9' : '#1A2B4A', 
                          color: balance === 0 ? '#94A3B8' : '#FFFFFF',
                          fontSize: '0.75rem', gap: '8px', cursor: balance === 0 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <Wallet size={14} /> Record Payment
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Record Payment Modal ─────────────────────────────────────── */}
      {paymentModalOpen && selectedCustomer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(26,43,74,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="card-raised" style={{ width: '100%', maxWidth: '480px', borderTop: '4px solid #1A2B4A', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ margin: 0 }}>Record Debt Payment</h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: '#547A95' }}>Settling balance for <strong>{selectedCustomer.name}</strong></p>
              </div>
              <button onClick={() => setPaymentModalOpen(false)} style={{ minHeight: '36px', width: '36px', padding: 0, background: 'transparent', color: '#547A95' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E8EDF2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: '#547A95' }}>Total Owed:</span>
                  <span style={{ ...mono, fontWeight: 700 }}>{formatKSh(selectedCustomer.totalBalance)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E8EDF2', paddingTop: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: '#547A95' }}>Remaining after payment:</span>
                  <span style={{ ...mono, fontWeight: 800, color: remainingBalance === 0 ? '#15803D' : '#D97706' }}>{formatKSh(remainingBalance)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label>Amount Paid (KSh)</label>
                <input 
                  required type="number" 
                  max={selectedCustomer.totalBalance}
                  value={paymentAmount} 
                  onChange={e => setPaymentAmount(e.target.value)} 
                  style={{ ...mono, height: '48px', fontSize: '1.2rem', fontWeight: 800 }} 
                  placeholder="0.00"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label>Payment Method</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button 
                    type="button" 
                    onClick={() => setPaymentMethod('CASH')}
                    style={{ height: '48px', background: paymentMethod === 'CASH' ? '#1A2B4A' : 'transparent', color: paymentMethod === 'CASH' ? '#fff' : '#547A95', border: '1px solid #E8EDF2' }}
                  >
                    CASH
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setPaymentMethod('M-PESA')}
                    style={{ height: '48px', background: paymentMethod === 'M-PESA' ? '#1A2B4A' : 'transparent', color: paymentMethod === 'M-PESA' ? '#fff' : '#547A95', border: '1px solid #E8EDF2' }}
                  >
                    M-PESA
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setPaymentModalOpen(false)} style={{ flex: 1, height: '48px', background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid #E8EDF2' }}>Cancel</button>
                <button type="submit" disabled={isProcessingPayment} style={{ flex: 2, height: '48px', gap: '8px' }}>
                  <DollarSign size={18} /> {isProcessingPayment ? 'Processing...' : 'Confirm Settlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Customer Modal ─────────────────────────────────────────── */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(26,43,74,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="card-raised" style={{ width: '100%', maxWidth: '600px', borderTop: '4px solid #C2A56D', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ margin: 0 }}>Add Customer Profile</h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: '#547A95' }}>Establish a new credit ledger for enterprise billing.</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} style={{ minHeight: '36px', width: '36px', padding: 0, background: 'transparent', color: '#547A95' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddCustomer} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
                <label>Customer Name</label>
                <input required type="text" placeholder="Full Name…" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} style={{ height: '48px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label>Phone/Contact</label>
                <input required type="text" placeholder="07... " value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} style={{ ...mono, height: '48px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label>Credit Limit (KSh)</label>
                <input required type="number" value={newCustomer.creditLimit} onChange={e => setNewCustomer({...newCustomer, creditLimit: e.target.value})} style={{ ...mono, height: '48px' }} />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ flex: 1, height: '48px', background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid #E8EDF2' }}>Cancel</button>
                <button type="submit" style={{ flex: 2, height: '48px' }}>Save Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebtCommandCenter;

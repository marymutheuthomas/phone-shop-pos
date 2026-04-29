import { useState } from 'react';
import {
  Package,
  Truck,
  PlusCircle,
  History,
  Hash,
  Activity,
  ClipboardList,
  Pencil,
  Trash2,
  X
} from 'lucide-react';
import { usePurchases } from '../../hooks/usePurchases';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/db/schema';
import { formatKSh } from '../../utils/formatters';
import { DataTable } from '../../components/Layout/DataTable';
import type { Purchase } from '../../lib/db/schema';

/* Monospace style shared across all numeric cells */
const mono: React.CSSProperties = {
  fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
  fontVariantNumeric: 'tabular-nums',
};

export default function PurchasesLedger() {
  const { user } = useAuth();
  const shopId = user?.shopId || 'warehouse';
  const { products, purchases, recordPurchase } = usePurchases(shopId);

  // ── Form State ─────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    productId: '',
    qty: '',
    unitCostKsh: '',
    supplierName: '',
    poNumber: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg]     = useState('');
  const [showForm, setShowForm]         = useState(false);

  // ── Edit/Delete State ──────────────────────────────────────────────────────
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productId || !formData.qty || !formData.unitCostKsh) {
      alert('Please fill in all required fields');
      return;
    }
    setIsSubmitting(true);
    try {
      await recordPurchase({
        productId:    formData.productId,
        qty:          parseFloat(formData.qty),
        unitCostKsh:  parseInt(formData.unitCostKsh),
        supplierName: formData.supplierName,
        poNumber:     formData.poNumber || 'PO-' + Date.now().toString().slice(-6),
        recordedBy:   user?.id || 'unknown-staff',
      });
      setSuccessMsg('Stock added successfully!');
      setFormData({ productId: '', qty: '', unitCostKsh: '', supplierName: '', poNumber: '' });
      setTimeout(() => setSuccessMsg(''), 3000);
      setShowForm(false);
    } catch (err) {
      console.error(err);
      alert('Failed to record stock-in');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setFormData({
      productId: purchase.productId,
      qty: purchase.qty.toString(),
      unitCostKsh: purchase.unitCostKsh.toString(),
      supplierName: purchase.supplierName || '',
      poNumber: purchase.poNumber || '',
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPurchase) return;
    setIsSubmitting(true);
    try {
      const qty = parseFloat(formData.qty);
      const unitCost = parseInt(formData.unitCostKsh);
      
      // Update purchase record
      await db.purchases.update(editingPurchase.id, {
        productId: formData.productId,
        qty: qty,
        unitCostKsh: unitCost,
        totalKsh: qty * unitCost,
        supplierName: formData.supplierName,
        poNumber: formData.poNumber,
        synced: 0
      });

      // Adjust inventory (Simplified: replace old with new)
      const inv = await db.inventory.where({ shopId, productId: editingPurchase.productId }).first();
      if (inv) {
        const delta = qty - editingPurchase.qty;
        await db.inventory.update(inv.id, { qty: inv.qty + delta });
      }

      setSuccessMsg('Record updated.');
      setIsEditOpen(false);
      setEditingPurchase(null);
      setFormData({ productId: '', qty: '', unitCostKsh: '', supplierName: '', poNumber: '' });
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to update record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const p = await db.purchases.get(deletingId);
      if (p) {
        // Reverse inventory
        const inv = await db.inventory.where({ shopId, productId: p.productId }).first();
        if (inv) {
          await db.inventory.update(inv.id, { qty: inv.qty - p.qty });
        }
        await db.purchases.delete(deletingId);
      }
      setSuccessMsg('Record deleted.');
      setIsDeleteOpen(false);
      setDeletingId(null);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to delete record');
    }
  };

  const getProductName = (id: string) =>
    products.find(p => p.id === id)?.name || 'Unknown Product';

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', paddingBottom: '48px' }}>

      {/* ── Page Header ─────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
        alignItems: 'center', gap: '16px', marginBottom: '28px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'var(--navy)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Activity size={22} />
          </div>
          <div>
            <h1 style={{ marginBottom: '2px' }}>Stock Receiving</h1>
            <p style={{ fontSize: '0.82rem', margin: 0 }}>
              Incoming stock for <strong>{user?.shopName}</strong>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {successMsg && (
            <div style={{
              padding: '8px 16px', borderRadius: '8px',
              background: '#DCFCE7', color: '#15803D',
              fontSize: '0.82rem', fontWeight: 600,
            }}>
              ✓ {successMsg}
            </div>
          )}
          <button onClick={() => setShowForm(!showForm)} style={{ height: '48px', padding: '0 24px' }}>
            {showForm ? 'Close Form' : '+ Add New Stock'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* ── Stock-In Form Card ───────────────────────── */}
        {showForm && (
          <div className="card animate-fadeIn">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
              <PlusCircle size={20} style={{ color: 'var(--gold)' }} />
              <h2 style={{ margin: 0 }}>Receive Goods</h2>
            </div>

            <form
              onSubmit={handleSubmit}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label>Supplier Name</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Truck size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    name="supplierName"
                    placeholder="e.g. Anker Global"
                    value={formData.supplierName}
                    onChange={handleInputChange}
                    required
                    style={{ paddingLeft: '40px', height: '48px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label>Product</label>
                <select
                  name="productId"
                  value={formData.productId}
                  onChange={handleInputChange}
                  required
                  style={{ height: '48px' }}
                >
                  <option value="">-- Choose Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label>Quantity</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Package size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="number"
                    name="qty"
                    placeholder="0"
                    value={formData.qty}
                    onChange={handleInputChange}
                    required
                    style={{ paddingLeft: '40px', height: '48px', ...mono }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label>Buying Price (Wholesale)</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '14px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', pointerEvents: 'none' }}>KSh</span>
                  <input
                    type="number"
                    name="unitCostKsh"
                    placeholder="1200"
                    value={formData.unitCostKsh}
                    onChange={handleInputChange}
                    required
                    style={{ paddingLeft: '48px', height: '48px', ...mono }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label>PO / Batch Number</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Hash size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    name="poNumber"
                    placeholder="Optional PO #"
                    value={formData.poNumber}
                    onChange={handleInputChange}
                    style={{ paddingLeft: '40px', height: '48px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="submit" disabled={isSubmitting} style={{ width: '100%', height: '48px' }}>
                  {isSubmitting ? 'Receiving…' : 'Record Purchase'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Ledger Table Card ────────────────────────── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '20px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid var(--surface-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <History size={18} style={{ color: 'var(--gold)' }} />
              <h3 style={{ margin: 0 }}>Receiving Log</h3>
            </div>
            <span style={{ ...mono, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {purchases.length} transactions
            </span>
          </div>

          {purchases.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '80px 24px', gap: '12px', textAlign: 'center'
            }}>
              <ClipboardList size={52} style={{ color: '#6B88A8', opacity: 0.45 }} />
              <h3 style={{ color: 'var(--text-muted)', fontWeight: 500 }}>No stock records yet</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                Use "Add New Stock" above to log your first receipt.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <DataTable<Purchase>
                data={purchases as Purchase[]}
                columns={[
                  {
                    header: 'Date',
                    render: p => (
                      <div style={{ lineHeight: 1.4 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--navy)' }}>
                          {new Date(p.timestamp).toLocaleDateString()}
                        </div>
                        <div style={{ ...mono, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(p.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ),
                  },
                  {
                    header: 'PO #',
                    render: p => (
                      <span style={{ ...mono, fontSize: '0.82rem', color: 'var(--navy)', fontWeight: 600 }}>
                        {p.poNumber}
                      </span>
                    ),
                  },
                  {
                    header: 'Supplier',
                    render: p => (
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {p.supplierName}
                      </span>
                    ),
                  },
                  {
                    header: 'Product',
                    render: p => (
                      <div style={{ lineHeight: 1.4 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--navy)' }}>
                          {getProductName(p.productId)}
                        </div>
                        <div style={{ ...mono, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {p.productId.slice(0, 8)}
                        </div>
                      </div>
                    ),
                  },
                  {
                    header: 'Qty',
                    align: 'right',
                    render: p => (
                      <span style={{ ...mono, fontWeight: 700, fontSize: '1rem', color: 'var(--navy)' }}>
                        {p.qty}
                      </span>
                    ),
                  },
                  {
                    header: 'Total Paid',
                    align: 'right',
                    render: p => (
                      <span style={{ ...mono, fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy)' }}>
                        {formatKSh(p.totalKsh)}
                      </span>
                    ),
                  },
                  {
                    header: 'Status',
                    align: 'center',
                    render: p => (
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px',
                        fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        background: p.synced === 1 ? '#DCFCE7' : '#FEF3C7',
                        color:      p.synced === 1 ? '#15803D' : '#92400E',
                        border: p.synced !== 1 ? '1px solid #FCD34D' : 'none',
                      }}>
                        {p.synced === 1 ? '✓ Cloud' : '⏳ Pending'}
                      </span>
                    ),
                  },
                  {
                    header: 'Actions',
                    align: 'center',
                    render: p => (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button 
                          onClick={() => openEditModal(p)}
                          style={{ minHeight: '32px', width: '32px', padding: 0, background: 'transparent', color: 'var(--text-muted)', border: '1px solid #E8EDF2', borderRadius: '8px' }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button 
                          onClick={() => { setDeletingId(p.id); setIsDeleteOpen(true); }}
                          style={{ minHeight: '32px', width: '32px', padding: 0, background: 'transparent', color: '#EF4444', border: '1px solid #FCA5A5', borderRadius: '8px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Modal ────────────────────────────────────────────────── */}
      {isEditOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(26,43,74,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="card-raised" style={{ width: '100%', maxWidth: '600px', borderTop: '4px solid #C2A56D', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>Edit Stock Record</h2>
              <button onClick={() => setIsEditOpen(false)} style={{ minHeight: '36px', width: '36px', padding: 0, background: 'transparent', color: 'var(--text-muted)', border: '1px solid #E8EDF2', borderRadius: '8px' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
                <label>Supplier</label>
                <input type="text" name="supplierName" value={formData.supplierName} onChange={handleInputChange} style={{ height: '48px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label>Quantity</label>
                <input type="number" name="qty" value={formData.qty} onChange={handleInputChange} style={{ height: '48px', ...mono }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label>Buying Price</label>
                <input type="number" name="unitCostKsh" value={formData.unitCostKsh} onChange={handleInputChange} style={{ height: '48px', ...mono }} />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsEditOpen(false)} style={{ flex: 1, height: '48px', background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid #E8EDF2' }}>Cancel</button>
                <button type="submit" style={{ flex: 2, height: '48px' }}>Update Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Modal ──────────────────────────────────────────────── */}
      {isDeleteOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(26,43,74,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="card-raised" style={{ width: '100%', maxWidth: '440px', borderTop: '4px solid #EF4444', padding: '32px', textAlign: 'center' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: '#FEE2E2', color: '#B91C1C', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={24} />
            </div>
            <h2 style={{ margin: '0 0 8px' }}>Delete Record?</h2>
            <p style={{ margin: '0 0 24px', color: '#547A95', fontSize: '0.875rem' }}>This will remove the stock entry and reverse the inventory count. This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setIsDeleteOpen(false)} style={{ flex: 1, height: '48px', background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid #E8EDF2' }}>Cancel</button>
              <button onClick={handleDelete} style={{ flex: 1, height: '48px', background: '#EF4444' }}>Delete Record</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

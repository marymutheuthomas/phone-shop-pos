import { useState, useEffect } from 'react';
import { db } from '../../lib/db/schema';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { useAuth } from '../../context/AuthContext';
import { useSyncEngine } from '../../hooks/useSyncEngine';
import { formatKSh } from '../../utils/formatters';
import { Search, Pencil, Trash2, Plus, X, PackageOpen } from 'lucide-react';

const mono: React.CSSProperties = {
  fontFamily: 'ui-monospace, "Cascadia Code", monospace',
  fontVariantNumeric: 'tabular-nums',
};

/* ── Shared table header cell style ──────────────────────────────────────── */
const th: React.CSSProperties = {
  padding: '8px 20px',
  textAlign: 'left',
  fontSize: '0.65rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.10em',
  color: '#547A95',
  background: '#fff',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid #E8EDF2',
};
const td: React.CSSProperties = {
  padding: '8px 20px',
  verticalAlign: 'middle',
  borderBottom: '1px solid #E8EDF2',
  background: '#fff',
};

/* ── Empty-form template ─────────────────────────────────────────────────── */
const emptyForm = {
  name: '',
  category: '',
  wholesalePrice: '',
  sellingPrice: '',
  initialStock: '',
  reorderLevel: '10',
};

/* ══════════════════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════════════════ */
const InventoryList = () => {
  const { user } = useAuth();
  useSyncEngine(user?.shopId || '');

  const isAdmin = user?.role === 'ADMIN';

  // ── UI State ────────────────────────────────────────────────────────────────
  const [search,          setSearch]         = useState('');
  const [refreshCounter,  setRefreshCounter] = useState(0);
  const [isAddOpen,       setIsAddOpen]      = useState(false);
  const [newProduct,      setNewProduct]     = useState(emptyForm);
  const [isEditOpen,      setIsEditOpen]     = useState(false);
  const [editingId,       setEditingId]      = useState<string | null>(null);
  const [editProduct,     setEditProduct]    = useState(emptyForm);
  const [deletingId,      setDeletingId]     = useState<string | null>(null);
  const [deletingName,    setDeletingName]   = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const loadProducts = () => setRefreshCounter(p => p + 1);
  useEffect(() => { loadProducts(); }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Live Query ───────────────────────────────────────────────────────────────
  const inventoryData = useLiveQuery(async () => {
    if (!user) return [];
    const products  = await db.products.toArray();
    const inventory = await db.inventory.where({ shopId: user.shopId }).toArray();
    return products.map(p => {
      const stock = inventory.find(inv => inv.productId === p.id);
      return { ...p, qty: stock ? stock.qty : 0 };
    }).filter(i =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.sku?.toLowerCase().includes(search.toLowerCase())
    );
  }, [user, search, refreshCounter]) || [];

  const lowStockCount = inventoryData.filter(i => i.qty <= (i.reorderLevel || 10)).length;

  // ── UI helpers ───────────────────────────────────────────────────────────────
  const openEditModal = (product: any) => {
    setEditingId(product.id);
    setEditProduct({
      name:           product.name,
      category:       product.category || '',
      sellingPrice:   product.basePrice?.toString() || '',
      wholesalePrice: product.wholesalePrice?.toString() || '',
      initialStock:   product.qty?.toString() || '0',
      reorderLevel:   product.reorderLevel?.toString() || '10',
    });
    setIsEditOpen(true);
  };

  const confirmDelete = (id: string, name: string) => {
    setDeletingId(id);
    setDeletingName(name);
  };

  // ── CRUD ─────────────────────────────────────────────────────────────────────
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newId = `prod_${Date.now().toString(36)}`;
      await db.products.add({
        id: newId,
        sku: `PRD-${Date.now().toString(36).toUpperCase()}`,
        name: newProduct.name,
        category: newProduct.category,
        basePrice: Number(newProduct.sellingPrice),
        wholesalePrice: Number(newProduct.wholesalePrice),
        reorderLevel: Number(newProduct.reorderLevel),
        tags: [],
        synced: 0,
      });
      await db.inventory.add({
        id: `inv_${Date.now().toString(36)}`,
        productId: newId,
        shopId: user?.shopId || 'shop_techplanet',
        qty: Number(newProduct.initialStock),
        synced: 0,
      } as any);
      await db.inventory_logs.add({
        id: `log_${Date.now().toString(36)}`,
        shopId: user?.shopId || 'shop_techplanet',
        productId: newId,
        changeType: 'PURCHASE',
        qtyChanged: Number(newProduct.initialStock),
        newBalance: Number(newProduct.initialStock),
        staffId: user?.id || 'unknown',
        timestamp: Date.now(),
        synced: 0,
      });
      loadProducts();
      setIsAddOpen(false);
      setNewProduct(emptyForm);
      showToast('Product added successfully!');
    } catch (err) {
      console.error('Dexie add failed:', err);
      showToast('Failed to add product.', 'error');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      const newQty   = Number(editProduct.initialStock);
      const invRecord = await db.inventory.where({ productId: editingId }).first();
      const oldQty   = invRecord?.qty ?? 0;
      const delta    = newQty - oldQty;
      await db.products.update(editingId, {
        name: editProduct.name,
        category: editProduct.category,
        basePrice: Number(editProduct.sellingPrice),
        wholesalePrice: Number(editProduct.wholesalePrice),
        reorderLevel: Number(editProduct.reorderLevel),
      });
      if (invRecord) await db.inventory.update(invRecord.id as any, { qty: newQty });
      if (delta !== 0) {
        await db.inventory_logs.add({
          id: `log_${Date.now().toString(36)}`,
          shopId: user?.shopId || 'shop_techplanet',
          productId: editingId,
          changeType: 'AUDIT_ADJUSTMENT',
          qtyChanged: delta,
          newBalance: newQty,
          staffId: user?.id || 'unknown',
          timestamp: Date.now(),
          synced: 0,
        });
      }
      loadProducts();
      setIsEditOpen(false);
      setEditingId(null);
      showToast('Product updated successfully!');
    } catch (err) {
      console.error('Dexie update failed:', err);
      showToast('Failed to update product.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await db.products.delete(deletingId);
      const invRecord = await db.inventory.where({ productId: deletingId }).first();
      if (invRecord) await db.inventory.delete(invRecord.id as any);
      await db.inventory_logs.where({ productId: deletingId }).delete();
      loadProducts();
      setDeletingId(null);
      showToast('Product deleted.');
    } catch (err) {
      console.error('Dexie delete failed:', err);
      showToast('Failed to delete product.', 'error');
    }
  };

  const renderFormFields = (
    data: typeof emptyForm,
    setter: React.Dispatch<React.SetStateAction<typeof emptyForm>>
  ) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
        <label>Product Name</label>
        <input required type="text" style={{ height: '48px' }}
          value={data.name} onChange={e => setter(s => ({ ...s, name: e.target.value }))}
          placeholder="e.g. Maize Bulk 90kg" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label>Category</label>
        <input required type="text" style={{ height: '48px' }}
          value={data.category} onChange={e => setter(s => ({ ...s, category: e.target.value }))}
          placeholder="e.g. Grains" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label>Stock Quantity</label>
        <input required type="number" min="0" style={{ ...mono, height: '48px' }}
          value={data.initialStock} onChange={e => setter(s => ({ ...s, initialStock: e.target.value }))}
          placeholder="0" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label>Wholesale Price (KSh)</label>
        <input required type="number" min="0" disabled={!isAdmin}
          style={{ ...mono, height: '48px', opacity: !isAdmin ? 0.5 : 1, cursor: !isAdmin ? 'not-allowed' : 'auto' }}
          value={data.wholesalePrice} onChange={e => setter(s => ({ ...s, wholesalePrice: e.target.value }))}
          placeholder="0.00" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label>Selling Price (KSh)</label>
        <input required type="number" min="0" disabled={!isAdmin}
          style={{ ...mono, height: '48px', opacity: !isAdmin ? 0.5 : 1, cursor: !isAdmin ? 'not-allowed' : 'auto' }}
          value={data.sellingPrice} onChange={e => setter(s => ({ ...s, sellingPrice: e.target.value }))}
          placeholder="0.00" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label>Reorder Level</label>
        <input required type="number" min="0" disabled={!isAdmin}
          style={{ height: '48px', opacity: !isAdmin ? 0.5 : 1, cursor: !isAdmin ? 'not-allowed' : 'auto' }}
          value={data.reorderLevel} onChange={e => setter(s => ({ ...s, reorderLevel: e.target.value }))}
          placeholder="10" />
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '60px' }}>

      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999,
          background: toast.type === 'success' ? '#16A34A' : '#DC2626',
          color: '#fff', padding: '10px 20px', borderRadius: '10px',
          fontWeight: 700, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}>
          {toast.type === 'success' ? '✓ ' : '✕ '}{toast.msg}
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <p style={{ margin: '0 0 2px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: '#547A95' }}>
          Node: {user?.shopId} — {user?.shopName}
        </p>
        <h1 style={{ margin: 0, color: '#2C3947' }}>Local Inventory</h1>
      </div>

      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E8EDF2',
        borderTop: '4px solid #C2A56D',
        borderRadius: '16px',
        boxShadow: '0 10px 40px -10px rgba(44,57,71,0.10)',
        overflow: 'hidden',
      }}>

        <div style={{ padding: '24px 28px', borderBottom: '1px solid #E8EDF2' }}>
          {lowStockCount > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '6px 14px', borderRadius: '20px',
              background: '#FEE2E2', color: '#B91C1C',
              fontSize: '0.75rem', fontWeight: 700,
              marginBottom: '16px',
            }}>
              <PackageOpen size={14} />
              {lowStockCount} {lowStockCount === 1 ? 'item' : 'items'} below reorder threshold — Restock Required
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={16} style={{ position: 'absolute', left: '14px', color: '#547A95', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search SKU or product name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: '40px', width: '100%', height: '48px' }}
              />
            </div>

            {isAdmin && (
              <button
                onClick={() => { setNewProduct(emptyForm); setIsAddOpen(true); }}
                style={{ flexShrink: 0, gap: '8px', height: '48px', padding: '0 24px', borderRadius: '9999px' }}
              >
                <Plus size={16} /> Add Product
              </button>
            )}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {inventoryData.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '64px 24px', gap: '12px', textAlign: 'center'
            }}>
              <PackageOpen size={48} style={{ color: '#547A95', opacity: 0.35 }} />
              <p style={{ margin: 0, fontWeight: 600, color: '#547A95', fontSize: '0.95rem' }}>
                No products found in local inventory.
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#94A3B8' }}>
                {search ? 'Try a different search term.' : 'Add your first product using the button above.'}
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th style={th}>Product</th>
                  <th style={th}>SKU</th>
                  <th style={th}>Category</th>
                  <th style={{ ...th, textAlign: 'right' }}>Wholesale</th>
                  <th style={{ ...th, textAlign: 'right' }}>Retail</th>
                  <th style={{ ...th, textAlign: 'center' }}>In Stock</th>
                  {isAdmin && <th style={{ ...th, textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {inventoryData.map(item => {
                  const isLow   = item.qty > 0 && item.qty <= (item.reorderLevel || 10);
                  const isOut   = item.qty <= 0;
                  return (
                    <tr
                      key={item.id}
                      style={{ transition: 'background 120ms ease' }}
                    >
                      <td style={td}>
                        <p style={{ margin: 0, fontWeight: 700, color: '#2C3947', fontSize: '0.875rem' }}>{item.name}</p>
                      </td>
                      <td style={td}>
                        <span style={{ ...mono, fontSize: '0.75rem', color: '#547A95' }}>{item.sku}</span>
                      </td>
                      <td style={td}>
                        <span style={{ fontSize: '0.82rem', color: '#547A95' }}>{item.category}</span>
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <span style={{ ...mono, fontWeight: 600, color: '#2C3947' }}>
                          {formatKSh(item.wholesalePrice || 0)}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <span style={{ ...mono, fontWeight: 700, color: '#2C3947' }}>
                          {formatKSh(item.basePrice || 0)}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{
                            ...mono,
                            display: 'inline-block',
                            padding: '3px 12px', borderRadius: '20px',
                            fontSize: '0.78rem', fontWeight: 700,
                            background: isOut  ? '#FEE2E2' : isLow ? '#FEF3C7' : '#DCFCE7',
                            color:      isOut  ? '#B91C1C' : isLow ? '#92400E' : '#15803D',
                          }}>
                            {item.qty} units
                          </span>
                        </div>
                      </td>
                      {isAdmin && (
                        <td style={{ ...td, textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
                            <button
                              onClick={() => openEditModal(item)}
                              className="btn-edit-ghost"
                              style={{
                                height: '36px', width: '36px', padding: 0,
                                background: '#F8FAFC', color: '#547A95',
                                border: '1px solid #E2E8F0', borderRadius: '10px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 200ms ease',
                                cursor: 'pointer'
                              }}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => confirmDelete(item.id, item.name)}
                              style={{
                                height: '36px', width: '36px', padding: 0,
                                background: '#FFF1F2', color: '#E11D48',
                                border: '1px solid #FECDD3', borderRadius: '10px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 200ms ease',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <style>{`
                            .btn-edit-ghost:hover {
                              background: #2C3947 !important;
                              color: #FFFFFF !important;
                              border-color: #2C3947 !important;
                            }
                          `}</style>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '12px 28px', borderTop: '1px solid #E8EDF2', background: '#FAFBFC' }}>
          <span style={{ fontSize: '0.72rem', color: '#547A95', fontWeight: 600 }}>
            {inventoryData.length} product{inventoryData.length !== 1 ? 's' : ''} · {user?.shopName}
          </span>
        </div>
      </div>

      {isAddOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(26,43,74,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '24px', backdropFilter: 'blur(4px)'
        }}>
          <div className="card-raised" style={{ width: '100%', maxWidth: '640px', borderTop: '4px solid #C2A56D', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>Add New Product</h2>
              <button onClick={() => setIsAddOpen(false)} style={{ minHeight: '36px', width: '36px', padding: 0, background: 'transparent', color: 'var(--text-muted)', border: '1px solid #E8EDF2', borderRadius: '8px' }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddProduct}>
              {renderFormFields(newProduct, setNewProduct)}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => setIsAddOpen(false)} style={{ height: '48px', padding: '0 24px', background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid #E8EDF2' }}>Cancel</button>
                <button type="submit" style={{ height: '48px', padding: '0 24px' }}>Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(26,43,74,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '24px', backdropFilter: 'blur(4px)'
        }}>
          <div className="card-raised" style={{ width: '100%', maxWidth: '640px', borderTop: '4px solid #C2A56D', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>Edit Product</h2>
              <button onClick={() => setIsEditOpen(false)} style={{ minHeight: '36px', width: '36px', padding: 0, background: 'transparent', color: 'var(--text-muted)', border: '1px solid #E8EDF2', borderRadius: '8px' }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleUpdate}>
              {renderFormFields(editProduct, setEditProduct)}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => setIsEditOpen(false)} style={{ height: '48px', padding: '0 24px', background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid #E8EDF2' }}>Cancel</button>
                <button type="submit" style={{ height: '48px', padding: '0 24px' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(26,43,74,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '24px', backdropFilter: 'blur(4px)'
        }}>
          <div className="card-raised" style={{ width: '100%', maxWidth: '440px', textAlign: 'center', borderTop: '4px solid #EF4444', padding: '32px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={22} style={{ color: '#B91C1C' }} />
            </div>
            <h2 style={{ margin: '0 0 8px' }}>Delete Product?</h2>
            <p style={{ margin: '0 0 24px', color: '#547A95', fontSize: '0.875rem' }}>
              You are about to permanently delete <strong style={{ color: '#2C3947' }}>"{deletingName}"</strong>. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setDeletingId(null)} style={{ flex: 1, height: '48px', background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid #E8EDF2' }}>
                Cancel
              </button>
              <button onClick={handleDelete} style={{ flex: 1, height: '48px', background: '#B91C1C' }}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryList;

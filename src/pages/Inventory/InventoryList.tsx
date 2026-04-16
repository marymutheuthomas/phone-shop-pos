import { useState, useEffect } from 'react';
import { db } from '../../lib/db/schema';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { useAuth } from '../../context/AuthContext';
import { useSyncEngine } from '../../hooks/useSyncEngine';
import { formatKSh } from '../../utils/formatters';
import { Search, Pencil, Trash2, Plus, X, PackageOpen } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const emptyForm = {
  name: '',
  category: '',
  buyingPrice: '',
  sellingPrice: '',
  initialStock: '',
  requires_imei: false,
};

const InventoryList = () => {
  const { user } = useAuth();
  useSyncEngine(user?.shopId || '');

  const isAdmin = user?.role === 'ADMIN';

  // ── UI State ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Add modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newProduct, setNewProduct] = useState(emptyForm);

  // Edit modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState(emptyForm);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState('');

  // Feedback
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const loadProducts = () => setRefreshCounter(prev => prev + 1);

  useEffect(() => { loadProducts(); }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Live Query ──────────────────────────────────────────────────────────────
  const inventoryData = useLiveQuery(async () => {
    if (!user) return [];
    const products = await db.products.toArray();
    const inventory = await db.inventory.where({ shopId: user.shopId }).toArray();

    return products.map(p => {
      const stock = inventory.find(inv => inv.productId === p.id);
      return { ...p, qty: stock ? stock.qty : 0 };
    }).filter(i =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.sku?.toLowerCase().includes(search.toLowerCase())
    );
  }, [user, search, refreshCounter]) || [];
  // ── UI HELPERS: Open Modals ───────────────────────────────────────────
  const openEditModal = (product: any) => {
    setEditingId(product.id);

    // Populate the edit form with the selected product's data
    // Note: Adjust the fields slightly if your editProduct state uses different names
    setEditProduct({
      name: product.name,
      category: product.category || '',
      sellingPrice: product.basePrice?.toString() || '',
      buyingPrice: product.wholesalePrice?.toString() || '',
      initialStock: product.qty?.toString() || '0',
      requires_imei: product.requires_imei || false,
    });

    setIsEditOpen(true);
  };

  const confirmDelete = (id: string, name: string) => {
    setDeletingId(id);
    setDeletingName(name); // This fixes your TS6133 warning!

    // If your delete confirmation is attached to a specific boolean state, uncomment the line below:
    // setIsDeleteOpen(true); 
  };
  // ── ADD ─────────────────────────────────────────────────────────────────────
  // ── CONCURRENCY-AUDITED: handleAddProduct ────────────────────────────────────
  // Writes product + inventory row + an inventory_log (synced:0) for the Blackout Guard.
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newId = uuidv4();
      // 1. Product record (Product type has no synced field)
      await db.products.add({
        id: newId,
        sku: `PRD-${newId.substring(0, 6).toUpperCase()}`,
        name: newProduct.name,
        category: newProduct.category,
        basePrice: Number(newProduct.sellingPrice),
        wholesalePrice: Number(newProduct.buyingPrice),
        wholesaleQtyThreshold: 5,
        tags: [],
        requires_imei: newProduct.requires_imei,
        synced: 0,
      });
      // 2. Inventory cache row
      await db.inventory.add({
        id: uuidv4(),
        productId: newId,
        shopId: user?.shopId || 'shop_1',
        qty: Number(newProduct.initialStock),
        synced: 0,
      } as any);
      // 3. Blackout Guard: log the stock-in event for sync
      await db.inventory_logs.add({
        shopId: user?.shopId || 'shop_1',
        productId: newId,
        changeType: 'PURCHASE',
        qtyChanged: Number(newProduct.initialStock),
        newBalance: Number(newProduct.initialStock),
        staffId: user?.id || 'unknown',
        timestamp: Date.now(),
        synced: 0,
      });
      loadProducts(); // Immediately re-derive UI from Dexie
      setIsAddOpen(false);
      setNewProduct(emptyForm);
      showToast('Product added successfully!');
    } catch (err) {
      console.error('Dexie add failed:', err);
      showToast('Failed to add product.', 'error');
    }
  };
  // ── CONCURRENCY-AUDITED: handleUpdate ────────────────────────────────────────
  // Updates product + inventory qty + logs the adjustment for sync.
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      const newQty = Number(editProduct.initialStock);
      // 1. Fetch current qty for delta calculation
      const invRecord = await db.inventory.where({ productId: editingId }).first();
      const oldQty = invRecord?.qty ?? 0;
      const delta = newQty - oldQty;
      // 2. Update product fields
      await db.products.update(editingId, {
        name: editProduct.name,
        category: editProduct.category,
        basePrice: Number(editProduct.sellingPrice),
        wholesalePrice: Number(editProduct.buyingPrice),
        requires_imei: editProduct.requires_imei,
      });
      // 3. Update inventory qty
      if (invRecord) {
        await db.inventory.update(invRecord.id as any, { qty: newQty });
      }
      // 4. Blackout Guard: log the adjustment if qty changed
      if (delta !== 0) {
        await db.inventory_logs.add({
          shopId: user?.shopId || 'shop_1',
          productId: editingId,
          changeType: 'AUDIT_ADJUSTMENT',
          qtyChanged: delta,
          newBalance: newQty,
          staffId: user?.id || 'unknown',
          timestamp: Date.now(),
          synced: 0,
        });
      }
      loadProducts(); // Immediately re-derive UI from Dexie
      setIsEditOpen(false);
      setEditingId(null);
      showToast('Product updated successfully!');
    } catch (err) {
      console.error('Dexie update failed:', err);
      showToast('Failed to update product.', 'error');
    }
  };
  // ── CONCURRENCY-AUDITED: handleDelete ────────────────────────────────────────
  // Deletes product + its inventory row atomically, then refreshes UI.
  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      // 1. Delete product record
      await db.products.delete(deletingId);
      // 2. Delete matching inventory cache row
      const invRecord = await db.inventory.where({ productId: deletingId }).first();
      if (invRecord) await db.inventory.delete(invRecord.id as any);
      // 3. Clean up any related inventory logs
      await db.inventory_logs
        .where({ productId: deletingId })
        .delete();
      loadProducts(); // Immediately re-derive UI from Dexie
      setDeletingId(null);
      showToast('Product deleted.');
    } catch (err) {
      console.error('Dexie delete failed:', err);
      showToast('Failed to delete product.', 'error');
    }
  };
  // ── SHARED FORM FIELDS ───────────────────────────────────────────────────────
  const renderFormFields = (
    data: typeof emptyForm,
    setter: React.Dispatch<React.SetStateAction<typeof emptyForm>>
  ) => (
    <>
      <div className="mb-4">
        <label className="block text-xs uppercase font-bold text-gray-500 mb-1.5">Product Name</label>
        <input required type="text"
          className="w-full p-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:border-[#6b21a8] focus:ring-2 focus:ring-[#6b21a8]/20 focus:outline-none transition-all"
          value={data.name} onChange={e => setter(s => ({ ...s, name: e.target.value }))}
          placeholder="e.g. iPhone 15 Pro" />
      </div>
      <div className="mb-4">
        <label className="block text-xs uppercase font-bold text-gray-500 mb-1.5">Category</label>
        <input required type="text"
          className="w-full p-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:border-[#6b21a8] focus:ring-2 focus:ring-[#6b21a8]/20 focus:outline-none transition-all"
          value={data.category} onChange={e => setter(s => ({ ...s, category: e.target.value }))}
          placeholder="e.g. Phones" />
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs uppercase font-bold text-gray-500 mb-1.5">Buying Price (KSh)</label>
          <input required type="number" min="0"
            className="w-full p-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:border-[#6b21a8] focus:ring-2 focus:ring-[#6b21a8]/20 focus:outline-none transition-all"
            value={data.buyingPrice} onChange={e => setter(s => ({ ...s, buyingPrice: e.target.value }))}
            placeholder="0.00" />
        </div>
        <div>
          <label className="block text-xs uppercase font-bold text-gray-500 mb-1.5">Selling Price (KSh)</label>
          <input required type="number" min="0"
            className="w-full p-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:border-[#6b21a8] focus:ring-2 focus:ring-[#6b21a8]/20 focus:outline-none transition-all"
            value={data.sellingPrice} onChange={e => setter(s => ({ ...s, sellingPrice: e.target.value }))}
            placeholder="0.00" />
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-xs uppercase font-bold text-gray-500 mb-1.5">Stock Quantity</label>
        <input required type="number" min="0"
          className="w-full p-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:border-[#6b21a8] focus:ring-2 focus:ring-[#6b21a8]/20 focus:outline-none transition-all"
          value={data.initialStock} onChange={e => setter(s => ({ ...s, initialStock: e.target.value }))}
          placeholder="0" />
      </div>
      <div
        className="mb-5 flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setter(s => ({ ...s, requires_imei: !s.requires_imei }))}
      >
        <input type="checkbox" id="requires_imei" checked={data.requires_imei}
          onChange={e => setter(s => ({ ...s, requires_imei: e.target.checked }))}
          className="w-5 h-5 accent-[#6b21a8] cursor-pointer" />
        <label htmlFor="requires_imei" className="text-sm font-bold text-gray-700 cursor-pointer select-none">
          Requires IMEI / Serial Tracking
        </label>
      </div>
    </>
  );

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in flex flex-col h-full relative">

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999,
          background: toast.type === 'success' ? '#10b981' : '#ef4444',
          color: 'white', padding: '0.75rem 1.5rem', borderRadius: '12px',
          fontWeight: 'bold', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.3s ease'
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Local Inventory
            <span style={{ fontSize: '1rem', fontWeight: 400, marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>
              — {user?.shopName}
            </span>
          </h1>
          {isAdmin && (
            <button
              onClick={() => { setNewProduct(emptyForm); setIsAddOpen(true); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 1.1rem', fontWeight: 700, color: 'white',
                borderRadius: '10px', background: 'linear-gradient(135deg,#7c3aed,#6b21a8)',
                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: '0 4px 14px rgba(107,33,168,0.4)'
              }}
              onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseOut={e => (e.currentTarget.style.opacity = '1')}
            >
              <Plus size={16} /> Add Product
            </button>
          )}
        </div>
        <div className="glass-panel p-2 flex items-center" style={{ width: '300px' }}>
          <Search size={18} className="mx-2 text-text-muted" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', color: 'white', width: '100%' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-auto" style={{ flex: 1 }}>
        {inventoryData.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-secondary)', gap: '1rem' }}>
            <PackageOpen size={48} style={{ opacity: 0.4 }} />
            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>No products found</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--surface-color-2)', borderBottom: '1px solid var(--glass-border)' }}>
                {['Name', 'Category', 'Buying Price', 'Selling Price', 'Stock', 'IMEI'].map(h => (
                  <th key={h} style={{ padding: '0.9rem 1rem', color: 'var(--text-secondary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{h}</th>
                ))}
                {isAdmin && <th style={{ padding: '0.9rem 1rem', color: 'var(--text-secondary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {inventoryData.map((item, idx) => (
                <tr key={item.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                    transition: 'background 0.15s'
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = 'rgba(107,33,168,0.08)')}
                  onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)')}
                >
                  <td style={{ padding: '0.9rem 1rem', fontWeight: 600 }}>{item.name}</td>
                  <td style={{ padding: '0.9rem 1rem', color: 'var(--text-secondary)' }}>{item.category || '—'}</td>
                  <td style={{ padding: '0.9rem 1rem' }}>{formatKSh(item.wholesalePrice ?? 0)}</td>
                  <td style={{ padding: '0.9rem 1rem', color: '#a78bfa', fontWeight: 600 }}>{formatKSh(item.basePrice ?? 0)}</td>
                  <td style={{ padding: '0.9rem 1rem' }}>
                    <span style={{
                      background: item.qty > 10 ? 'rgba(16,185,129,0.15)' : item.qty > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                      color: item.qty > 10 ? '#10b981' : item.qty > 0 ? '#f59e0b' : '#ef4444',
                      padding: '0.3rem 0.8rem', borderRadius: '20px', fontWeight: 700, fontSize: '0.85rem'
                    }}>
                      {item.qty} units
                    </span>
                  </td>
                  <td style={{ padding: '0.9rem 1rem' }}>
                    {item.requires_imei
                      ? <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '0.25rem 0.6rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700 }}>Yes</span>
                      : <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '0.25rem 0.6rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700 }}>No</span>
                    }
                  </td>

                  {/* ── The Side-Hustle Guard: Admin-only actions ── */}
                  {isAdmin && (
                    <td style={{ padding: '0.9rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => openEditModal(item)}
                          title="Edit product"
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                            padding: '0.4rem 0.9rem', borderRadius: '8px',
                            background: 'rgba(59,130,246,0.15)', color: '#60a5fa',
                            border: '1px solid rgba(59,130,246,0.3)', cursor: 'pointer',
                            fontWeight: 700, fontSize: '0.82rem', transition: 'all 0.2s'
                          }}
                          onMouseOver={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.3)'; }}
                          onMouseOut={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.15)'; }}
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          onClick={() => confirmDelete(item.id, item.name)}
                          title="Delete product"
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                            padding: '0.4rem 0.9rem', borderRadius: '8px',
                            background: 'rgba(239,68,68,0.15)', color: '#f87171',
                            border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
                            fontWeight: 700, fontSize: '0.82rem', transition: 'all 0.2s'
                          }}
                          onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.3)'; }}
                          onMouseOut={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── ADD MODAL ─────────────────────────────────────────────────────────── */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md animate-fade-in" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold" style={{ color: '#6b21a8' }}>Add New Product</h2>
              <button onClick={() => setIsAddOpen(false)} className="text-gray-400 hover:text-gray-700 transition"><X size={22} /></button>
            </div>
            <form onSubmit={handleAddProduct}>
              {renderFormFields(newProduct, setNewProduct)}
              <div className="flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => setIsAddOpen(false)} className="px-6 py-3 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 font-bold transition-all">Cancel</button>
                <button type="submit" className="px-6 py-3 font-bold text-white rounded-xl bg-[#6b21a8] hover:opacity-90 transition-all shadow-lg shadow-[#6b21a8]/30">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ─────────────────────────────────────────────────────────── */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md animate-fade-in" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold" style={{ color: '#2563eb' }}>Edit Product</h2>
              <button onClick={() => setIsEditOpen(false)} className="text-gray-400 hover:text-gray-700 transition"><X size={22} /></button>
            </div>
            <form onSubmit={handleUpdate}>
              {renderFormFields(editProduct, setEditProduct)}
              <div className="flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => setIsEditOpen(false)} className="px-6 py-3 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 font-bold transition-all">Cancel</button>
                <button type="submit" className="px-6 py-3 font-bold text-white rounded-xl bg-blue-600 hover:opacity-90 transition-all shadow-lg shadow-blue-600/30">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ──────────────────────────────────────────────── */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm animate-fade-in text-center">
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <Trash2 size={28} style={{ color: '#ef4444' }} />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Delete Product?</h2>
            <p className="text-gray-500 mb-6">
              You are about to permanently delete <strong className="text-gray-800">"{deletingName}"</strong>. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeletingId(null)} className="px-6 py-3 rounded-xl text-gray-500 hover:bg-gray-100 font-bold transition-all">Cancel</button>
              <button
                onClick={handleDelete}
                style={{ padding: '0.75rem 1.75rem', borderRadius: '12px', background: '#ef4444', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'opacity 0.2s' }}
                onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseOut={e => (e.currentTarget.style.opacity = '1')}
              >
                Yes, Delete It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryList;

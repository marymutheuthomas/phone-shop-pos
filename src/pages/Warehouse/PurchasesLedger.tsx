import { useState } from 'react';
import { 
  Package, 
  Truck, 
  Plus, 
  History, 
  Search, 
  PlusCircle, 
  ArrowUpRight,
  User,
  Hash,
  ClipboardList
} from 'lucide-react';
import { usePurchases } from '../../hooks/usePurchases';

// Hardcoded for Phase 8 demonstration - typically comes from Auth Context
const ACTIVE_SHOP_ID = '00000000-0000-0000-0000-000000000001';
const CURRENT_USER_NAME = 'Warehouse Admin';

export default function PurchasesLedger() {
  const { products, purchases, recordPurchase } = usePurchases(ACTIVE_SHOP_ID);
  
  // State for the form
  const [formData, setFormData] = useState({
    productId: '',
    qty: '',
    unitCostKsh: '',
    supplierName: '',
    poNumber: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

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
        productId: formData.productId,
        qty: parseFloat(formData.qty),
        unitCostKsh: parseInt(formData.unitCostKsh),
        supplierName: formData.supplierName,
        poNumber: formData.poNumber,
        recordedBy: CURRENT_USER_NAME
      });
      
      setSuccessMsg('Purchase recorded and inventory updated!');
      setFormData({
        productId: '',
        qty: '',
        unitCostKsh: '',
        supplierName: '',
        poNumber: ''
      });
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to save purchase');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProductName = (id: string) => {
    return products.find(p => p.id === id)?.name || 'Unknown Product';
  };

  return (
    <div className="page-inner animate-fade-in" style={{ paddingBottom: 'var(--space-2xl)' }}>
      {/* Header Section */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Procurement & Stock In</h1>
          <p className="page-subtitle">Receive inventory into the Main Warehouse</p>
        </div>
        {successMsg && (
          <div className="badge badge-success" style={{ padding: '8px 16px' }}>
            {successMsg}
          </div>
        )}
      </div>

      <div className="content-wide">
        {/* Top Section: The Form Card */}
        <div className="card" style={{ marginBottom: 'var(--space-xl)', padding: 'var(--space-xl)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', color: 'var(--primary-color)' }}>
            <PlusCircle size={24} />
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Log New Purchase</h2>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
            
            <div className="form-group">
              <label className="form-label">Supplier Name</label>
              <div className="search-bar" style={{ boxShadow: 'none' }}>
                <Truck size={18} className="search-icon" />
                <input 
                  type="text" 
                  name="supplierName"
                  placeholder="e.g. Grain Bulk Ltd" 
                  value={formData.supplierName}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Select Product</label>
              <select 
                className="form-select"
                name="productId"
                value={formData.productId}
                onChange={handleInputChange}
                required
              >
                <option value="">-- Choose Product --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Quantity (Units)</label>
              <div className="search-bar" style={{ boxShadow: 'none' }}>
                <Package size={18} className="search-icon" />
                <input 
                  type="number" 
                  name="qty"
                  placeholder="0.00" 
                  step="0.01"
                  value={formData.qty}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Unit Cost (KSh)</label>
              <div className="search-bar" style={{ boxShadow: 'none' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.8rem' }}>KSh</span>
                <input 
                  type="number" 
                  name="unitCostKsh"
                  placeholder="0" 
                  value={formData.unitCostKsh}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">PO Number</label>
              <div className="search-bar" style={{ boxShadow: 'none' }}>
                <Hash size={18} className="search-icon" />
                <input 
                  type="text" 
                  name="poNumber"
                  placeholder="e.g. PO-2024-001" 
                  value={formData.poNumber}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-group" style={{ justifyContent: 'flex-end', paddingTop: '1.4rem' }}>
              <button 
                type="submit" 
                className="btn btn-primary btn-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Recording...' : 'Save Purchase'}
                {!isSubmitting && <ArrowUpRight size={18} />}
              </button>
            </div>
          </form>
        </div>

        {/* Bottom Section: The Ledger */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 'var(--space-lg)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <History size={20} className="text-muted" />
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>Purchase History (Ledger)</h3>
            </div>
            <div className="badge badge-primary">Showing {purchases.length} Records</div>
          </div>

          <div className="table-scroll-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>PO #</th>
                  <th>Supplier</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Cost</th>
                  <th>Total Cost</th>
                  <th>Recorded By</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-muted)' }}>
                      No purchases found in the ledger.
                    </td>
                  </tr>
                ) : (
                  purchases.map((p) => (
                    <tr key={p.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(p.purchased_at).toLocaleDateString()}
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {new Date(p.purchased_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{p.po_number || '---'}</td>
                      <td>{p.supplier_name}</td>
                      <td style={{ fontWeight: 500 }}>{getProductName(p.product_id)}</td>
                      <td>{p.qty.toLocaleString()}</td>
                      <td>{p.unit_cost_ksh.toLocaleString()} KSh</td>
                      <td style={{ fontWeight: 700 }}>{p.total_ksh.toLocaleString()} KSh</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <User size={12} className="text-muted" />
                          <span style={{ fontSize: 'var(--text-xs)' }}>{p.recorded_by}</span>
                        </div>
                      </td>
                      <td>
                        {p.synced === 1 ? (
                          <span className="badge badge-success">Cloud</span>
                        ) : (
                          <span className="badge badge-warning">Local</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

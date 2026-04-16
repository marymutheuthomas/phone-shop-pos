import { useState } from 'react';
import { 
  Package, 
  Truck, 
  PlusCircle, 
  History, 
  ArrowUpRight,
  User,
  Hash,
  Activity
} from 'lucide-react';
import { usePurchases } from '../../hooks/usePurchases';
import { useAuth } from '../../context/AuthContext';
import { formatKSh } from '../../utils/formatters';

export default function PurchasesLedger() {
  const { user } = useAuth();
  const shopId = user?.shopId || 'warehouse';
  const { products, purchases, recordPurchase } = usePurchases(shopId);
  
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
        poNumber: formData.poNumber || 'PO-' + Date.now().toString().slice(-6),
        recordedBy: user?.name || 'Unknown User'
      });
      
      setSuccessMsg('Stock received successfully!');
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
      alert('Failed to record stock-in');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProductName = (id: string) => {
    return products.find(p => p.id === id)?.name || 'Unknown Product';
  };

  return (
    <div className="animate-fade-in p-2">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-800 text-white flex items-center gap-3">
            <Activity className="text-primary-color" size={32} />
            Procurement Ledger
          </h1>
          <p className="text-text-secondary mt-1">Receive products into: <span className="text-white font-bold">{user?.shopName}</span></p>
        </div>
        {successMsg && (
          <div className="badge badge-success animate-bounce p-3">
            {successMsg}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-8">
        {/* Form Section */}
        <div className="glass-panel p-8" style={{ borderTop: '4px solid var(--primary-color)' }}>
          <div className="flex items-center gap-3 mb-8 text-primary-color">
            <PlusCircle size={24} />
            <h2 className="text-xl font-bold uppercase tracking-wider">Record Incoming Stock</h2>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="form-group">
              <label className="form-label">Search Supplier</label>
              <div className="search-bar">
                <Truck size={18} className="search-icon" />
                <input 
                  type="text" 
                  name="supplierName"
                  placeholder="e.g. Anker Global" 
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
              <label className="form-label">Quantity</label>
              <div className="search-bar">
                <Package size={18} className="search-icon" />
                <input 
                  type="number" 
                  name="qty"
                  placeholder="0" 
                  value={formData.qty}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Unit Cost (KSh)</label>
              <div className="search-bar">
                <span className="text-text-muted font-bold ml-3 text-xs">KSh</span>
                <input 
                  type="number" 
                  name="unitCostKsh"
                  placeholder="1200" 
                  value={formData.unitCostKsh}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">PO / Batch Number</label>
              <div className="search-bar">
                <Hash size={18} className="search-icon" />
                <input 
                  type="text" 
                  name="poNumber"
                  placeholder="Optional PO#" 
                  value={formData.poNumber}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="flex items-end">
              <button 
                type="submit" 
                className="btn-primary w-full h-[52px] flex items-center justify-center gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Receiving...' : 'Receive Stock'}
                {!isSubmitting && <ArrowUpRight size={18} />}
              </button>
            </div>
          </form>
        </div>

        {/* Ledger Section */}
        <div className="glass-panel overflow-hidden p-0">
          <div className="p-6 border-b border-[var(--glass-border)] flex justify-between items-center bg-[rgba(255,255,255,0.02)]">
            <div className="flex items-center gap-3">
              <History size={20} className="text-text-muted" />
              <h3 className="font-bold text-lg">Purchase History</h3>
            </div>
            <span className="badge badge-primary">{purchases.length} Transactions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[rgba(255,255,255,0.03)] text-text-secondary uppercase text-[10px] tracking-widest font-bold">
                <tr>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">PO #</th>
                  <th className="px-6 py-4">Supplier</th>
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4">Qty</th>
                  <th className="px-6 py-4">Unit Cost</th>
                  <th className="px-6 py-4">Total Value</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--glass-border)]">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-text-muted italic">
                      No purchases recorded for this shop.
                    </td>
                  </tr>
                ) : (
                  purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-white font-medium">{new Date(p.timestamp).toLocaleDateString()}</div>
                        <div className="text-[10px] text-text-muted">{new Date(p.timestamp).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-primary-color">{p.poNumber}</td>
                      <td className="px-6 py-4 text-white">{p.supplierName}</td>
                      <td className="px-6 py-4">
                         <div className="text-white font-bold">{getProductName(p.productId)}</div>
                         <div className="text-[10px] text-text-muted uppercase">Inventory Record: {p.productId.slice(0,8)}</div>
                      </td>
                      <td className="px-6 py-4 text-white">{p.qty}</td>
                      <td className="px-6 py-4 text-text-secondary">{formatKSh(p.unitCostKsh)}</td>
                      <td className="px-6 py-4 text-success-color font-800">{formatKSh(p.totalKsh)}</td>
                      <td className="px-6 py-4 text-center">
                        {p.synced === 1 ? (
                          <span className="badge badge-success">Cloud</span>
                        ) : (
                          <span className="badge badge-warning animate-pulse">Pending</span>
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

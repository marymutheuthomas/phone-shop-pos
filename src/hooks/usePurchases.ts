import { useLiveQuery } from '../hooks/useLiveQuery';
import { db, type Purchase, type InventoryLog } from '../lib/db/schema';

export function usePurchases(shopId: string) {
  // Fetch products for dropdown
  const products = useLiveQuery(() => db.products.toArray()) || [];

  // Fetch purchases for this shop
  const purchases = useLiveQuery(
    async () => {
      const data = await db.purchases.where('shopId').equals(shopId).toArray();
      return data.sort((a, b) => b.timestamp - a.timestamp);
    },
    [shopId]
  ) || [];

  const recordPurchase = async (data: {
    productId: string;
    qty: number;
    unitCostKsh: number;
    supplierName: string;
    poNumber: string;
    recordedBy: string;
  }) => {
    const { productId, qty, unitCostKsh, supplierName, poNumber, recordedBy } = data;
    const now = Date.now();
    const purchaseId = `pur_${Date.now().toString(36)}`;

    return await db.transaction('rw', [db.purchases, db.inventory, db.inventory_logs], async () => {
      // 1. Insert Purchase
      const newPurchase: Purchase = {
        id: purchaseId,
        shopId,
        productId,
        recordedBy,
        qty,
        unitCostKsh,
        totalKsh: qty * unitCostKsh,
        supplierName,
        poNumber,
        timestamp: now,
        synced: 0
      };
      await db.purchases.add(newPurchase);

      // 2. Update Inventory
      const inv = await db.inventory.where({ shopId, productId }).first();
      let newBalance = qty;

      if (inv) {
        newBalance = inv.qty + qty;
        await db.inventory.update(inv.id, { qty: newBalance });
      } else {
        await db.inventory.add({
          id: `inv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2,6)}`,
          shopId,
          productId,
          qty,
          synced: 0
        });
      }

      // 3. Log Movement
      const newLog: InventoryLog = {
        id: `log_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
        shopId,
        productId,
        changeType: 'PURCHASE',
        qtyChanged: qty,
        newBalance,
        staffId: recordedBy,
        timestamp: now,
        synced: 0
      };
      await db.inventory_logs.add(newLog);

      return purchaseId;
    });
  };

  return {
    products,
    purchases,
    recordPurchase
  };
}

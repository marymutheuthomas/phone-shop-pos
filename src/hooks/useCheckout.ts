import { db, type SaleTransaction, type SaleItem, type InventoryLog } from '../lib/db/schema';

export function useCheckout(shopId: string, staffId: string) {
  
  const processCheckout = async (
    cartItems: { productId: string; qty: number; unitPrice: number; imeis?: string[] }[], 
    paymentDetails: { method: 'CASH' | 'M-PESA' | 'CARD' | 'DEBT'; mpesaRef?: string; customerId?: string }
  ) => {
    const now = Date.now();
    const saleId = crypto.randomUUID();
    const totalKsh = cartItems.reduce((acc, item) => acc + (item.unitPrice * item.qty), 0);

    return await db.transaction('rw', [db.sale_transactions, db.sale_items, db.inventory, db.inventory_logs, db.active_cart, db.product_items], async () => {
      
      // Step A: The Receipt (Header)
      const txn: SaleTransaction = {
        id: saleId,
        shopId,
        staffId,
        totalKsh,
        discountKsh: 0,
        paymentMethod: paymentDetails.method,
        mpesaRef: paymentDetails.mpesaRef,
        timestamp: now,
        synced: 0
      };
      await db.sale_transactions.add(txn);

      // Steps B, C, D: Process items
      for (const item of cartItems) {
        // Find current inventory to get cost_basis and current qty
        const inv = await db.inventory.where({ shopId, productId: item.productId }).first();
        const currentQty = inv?.qty || 0;
        const newQty = currentQty - item.qty;

        // Step B: Line Items
        const saleItem: SaleItem = {
          id: crypto.randomUUID(),
          saleId,
          productId: item.productId,
          qty: item.qty,
          salePriceKsh: item.unitPrice,
        };
        await db.sale_items.add(saleItem);

        // Step C: Stock Deduction
        if (inv) {
          await db.inventory.update(inv.id, { qty: newQty });
        } else {
          // If no inventory record exists, create one with negative stock
          await db.inventory.add({
            id: crypto.randomUUID(),
            shopId,
            productId: item.productId,
            qty: -item.qty,
          } as any);
        }

        // Handle IMEI tracking for serialized products
        if (item.imeis && item.imeis.length > 0) {
          for (const serial of item.imeis) {
            const imeiRecord = await db.product_items.where({ imei_serial: serial }).first();
            if (imeiRecord && imeiRecord.id) {
               await db.product_items.update(imeiRecord.id, { status: 'SOLD' });
            } else {
               await db.product_items.add({
                  productId: item.productId,
                  imei_serial: serial,
                  shopId,
                  status: 'SOLD'
               });
            }
          }
        }

        // Step D: Inventory Log (Audit Trail)
        const log: InventoryLog = {
          shopId,
          productId: item.productId,
          changeType: 'SALE',
          qtyChanged: -item.qty,
          newBalance: newQty,
          staffId,
          timestamp: now,
          synced: 0
        };
        await db.inventory_logs.add(log);
      }

      // Final Step: Clear the active cart
      await db.active_cart.clear();

      return saleId;
    });
  };

  return { processCheckout };
}

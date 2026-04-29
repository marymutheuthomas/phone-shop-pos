import { db, type SaleItem, type InventoryLog } from '../lib/db/schema';

export function useCheckout(shopId: string, staffId: string) {
  
  const processCheckout = async (
    cartItems: { productId: string; qty: number; unitPrice: number; priceType: 'RETAIL' | 'WHOLESALE' }[], 
    paymentDetails: { 
      method: 'CASH' | 'M-PESA' | 'CARD' | 'DEBT'; 
      mpesaRef?: string; 
      customerId?: string;
      customerName?: string;
      customerPhone?: string;
      priceType: 'RETAIL' | 'WHOLESALE';
    }
  ) => {
    const now = Date.now();
    const saleId = `txn_${Date.now().toString(36)}`;
    const totalKsh = cartItems.reduce((acc, item) => acc + (item.unitPrice * item.qty), 0);

    // ── Pre-flight stock validation ──────────────────────────────────────────
    for (const item of cartItems) {
      const inv = await db.inventory.where({ shopId, productId: item.productId }).first();
      const available = inv?.qty ?? 0;
      if (available <= 0) {
        const product = await db.products.get(item.productId);
        throw new Error(`"${product?.name ?? item.productId}" is out of stock and cannot be sold.`);
      }
      if (item.qty > available) {
        const product = await db.products.get(item.productId);
        throw new Error(`Insufficient stock for "${product?.name ?? item.productId}". Requested: ${item.qty}, Available: ${available}.`);
      }
    }

    let totalWholesaleCost = 0;
    for (const item of cartItems) {
      const product = await db.products.get(item.productId);
      if (product) {
        totalWholesaleCost += (product.wholesalePrice || 0) * item.qty;
      }
    }

    return await db.transaction('rw', [db.sale_transactions, db.sale_items, db.inventory, db.inventory_logs, db.active_cart, db.products], async () => {
      
      // Step A: The Receipt (Header)
      const txn: any = {
        id: saleId,
        shopId,
        staffId,
        totalKsh,
        wholesale_cost: totalWholesaleCost,
        discountKsh: 0,
        paymentMethod: paymentDetails.method,
        mpesaRef: paymentDetails.mpesaRef,
        customerId: paymentDetails.customerId,
        customerName: paymentDetails.customerName,
        customerPhone: paymentDetails.customerPhone,
        priceType: paymentDetails.priceType,
        status: paymentDetails.method === 'DEBT' ? 'PENDING' : 'COMPLETED',
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
        const itemIndex = cartItems.indexOf(item);
        const saleItem: SaleItem = {
          id: `si_${saleId}_${itemIndex}_${Math.random().toString(36).substring(2,5)}`,
          saleId,
          productId: item.productId,
          qty: item.qty,
          salePriceKsh: item.unitPrice,
          priceType: item.priceType,
        };
        await db.sale_items.add(saleItem);

        // Step C: Stock Deduction
        if (inv) {
          await db.inventory.update(inv.id, { qty: newQty });
        } else {
          // If no inventory record exists, create one with negative stock
          await db.inventory.add({
            id: `inv_${Date.now().toString(36)}`,
            shopId,
            productId: item.productId,
            qty: -item.qty,
            synced: 0
          } as any);
        }

        // Step D: Inventory Log (Audit Trail)
        const log: InventoryLog = {
          id: `log_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
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

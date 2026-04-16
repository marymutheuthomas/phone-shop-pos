import { db } from '../lib/db/schema';

export const useInventory = () => {
  const handleOutgoingTransfer = async (staffId: string, fromShopId: string, toShopId: string, productId: string, qty: number) => {
    // 1. Deduct from source inventory
    const fromInvArr = await db.inventory.where('shopId').equals(fromShopId).toArray();
    const sourceInv = fromInvArr.find(i => i.productId === productId);
    
    if (!sourceInv || sourceInv.qty < qty) {
      throw new Error(`Insufficient stock in ${fromShopId} to fulfill transfer!`);
    }

    const newBalance = sourceInv.qty - qty;
    await db.inventory.update(sourceInv.id!, { 
      qty: newBalance,
      synced: 0 // Blackout Guard
    });

    // 2. Create inventory_logs entry
    await db.inventory_logs.add({
      shopId: fromShopId,
      productId: productId,
      changeType: 'TRANSFER_OUT',
      qtyChanged: -Math.abs(qty),
      newBalance: newBalance,
      staffId: staffId,
      timestamp: Date.now(),
      synced: 0
    });

    // 3. Create transfers record
    await db.transfers.add({
      id: crypto.randomUUID(),
      productId,
      fromShopId,
      toShopId,
      qty,
      status: 'PENDING',
      timestamp: Date.now(),
      synced: 0
    });
  };

  const handleIncomingTransfer = async (transferId: string, staffId: string) => {
    const transfer = await db.transfers.get(transferId);
    if (!transfer) throw new Error("Transfer record missing.");
    if (transfer.status === 'COMPLETED') throw new Error("Transfer already completed.");

    // 1. Add qty to local inventory
    const shopInvArr = await db.inventory.where('shopId').equals(transfer.toShopId).toArray();
    const localInv = shopInvArr.find(i => i.productId === transfer.productId);
    
    let newBalance = transfer.qty;
    if (localInv) {
      newBalance = localInv.qty + transfer.qty;
      await db.inventory.update(localInv.id!, { 
        qty: newBalance,
        synced: 0 
      });
    } else {
      await db.inventory.add({
        id: crypto.randomUUID(),
        shopId: transfer.toShopId,
        productId: transfer.productId,
        qty: newBalance,
        synced: 0
      });
    }

    // 2. Create inventory_logs entry
    await db.inventory_logs.add({
      shopId: transfer.toShopId,
      productId: transfer.productId,
      changeType: 'TRANSFER_IN',
      qtyChanged: transfer.qty,
      newBalance: newBalance,
      staffId: staffId,
      timestamp: Date.now(),
      synced: 0
    });

    // 3. Update transfers status
    await db.transfers.update(transferId, {
      status: 'COMPLETED',
      synced: 0
    });
  };

  return { handleOutgoingTransfer, handleIncomingTransfer };
};

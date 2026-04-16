import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/db/supabaseClient';
import { db, type Customer } from '../lib/db/schema';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export function useSyncEngine(shopId: string) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const isSyncingRef = useRef(false);

  // 1. Sync Logic: PUSH local purchases to Cloud
  const pushPurchases = async () => {
    const unsynced = await db.purchases.where('synced').equals(0).toArray();
    if (unsynced.length === 0) return;

    const remotePayload = unsynced.map(p => ({
      id: p.id,
      shop_id: p.shopId,
      product_id: p.productId,
      recorded_by: p.recordedBy,
      qty: p.qty,
      unit_cost_ksh: p.unitCostKsh,
      total_ksh: p.totalKsh,
      supplier_name: p.supplierName,
      po_number: p.poNumber,
      purchased_at: new Date(p.timestamp).toISOString()
    }));

    const { error } = await supabase.from('purchases').upsert(remotePayload);
    if (error) {
      console.error('pushPurchases failed:', error.message);
      throw error;
    }

    await db.purchases.where('id').anyOf(unsynced.map(p => p.id)).modify({ synced: 1 });
  };

  // 1b. Sync Logic: PUSH local sales to Cloud
  const pushSales = async () => {
    const unsynced = await db.sale_transactions.where('synced').equals(0).toArray();
    if (unsynced.length === 0) return;

    for (const txn of unsynced) {
      // 1. Fetch items for this transaction
      const items = await db.sale_items.where('saleId').equals(txn.id).toArray();
      
      // 2. Prepare Transaction Header Payload
      const txnPayload = {
        id: txn.id,
        shop_id: txn.shopId,
        staff_id: txn.staffId,
        total_ksh: txn.totalKsh,
        discount_ksh: txn.discountKsh,
        payment_method: txn.paymentMethod,
        mpesa_ref: txn.mpesaRef,
        sale_at: new Date(txn.timestamp).toISOString()
      };

      // 3. Upsert Header
      const { error: txnError } = await supabase.from('sale_transactions').upsert(txnPayload);
      if (txnError) {
        console.error(`pushSales header failed for txn ${txn.id}:`, txnError.message);
        throw txnError;
      }

      // 4. Prepare and Upsert Items
      if (items.length > 0) {
        const itemsPayload = items.map(i => ({
          sale_id: i.saleId,
          product_id: i.productId,
          qty: i.qty,
          sale_price_ksh: i.salePriceKsh
        }));

        const { error: itemsError } = await supabase.from('sale_items').upsert(itemsPayload);
        if (itemsError) {
          console.error(`pushSales items failed for txn ${txn.id}:`, itemsError.message);
          throw itemsError;
        }
      }

      // 5. Mark txn as synced locally
      await db.sale_transactions.update(txn.id, { synced: 1 });
    }
  };

  // 2. Sync Logic: PUSH local logs to Cloud
  const pushInventoryLogs = async () => {
    const unsynced = await db.inventory_logs.where('synced').equals(0).toArray();
    if (unsynced.length === 0) return;

    const remotePayload = unsynced.map(l => ({
      shop_id: l.shopId,
      product_id: l.productId,
      change_type: l.changeType,
      quantity_changed: l.qtyChanged,
      new_balance: l.newBalance,
      staff_id: l.staffId,
      created_at: new Date(l.timestamp).toISOString()
    }));

    const { error } = await supabase.from('inventory_logs').insert(remotePayload);
    if (error) {
      console.error('pushInventoryLogs failed:', error.message);
      throw error;
    }

    const localIds = unsynced.map(l => l.id).filter((id): id is number => id !== undefined);
    await db.inventory_logs.where('id').anyOf(localIds).modify({ synced: 1 });
  };

  // Sync Logic: PUSH customers to Cloud (Debt Guard — offline names rush up)
  const pushCustomers = async () => {
    const unsynced = await db.customers.where('synced').equals(0).toArray();
    if (unsynced.length === 0) return;

    const remotePayload = unsynced.map((c: Customer) => ({
      id: c.id,
      name: c.name,
      phone: c.phone || null,
      email: c.email || null,
      shop_id: c.shopId,
    }));

    const { error } = await supabase.from('customers').upsert(remotePayload);
    if (error) {
      console.error('pushCustomers failed:', error.message);
      throw error;
    }

    await db.customers.where('id').anyOf(unsynced.map(c => c.id)).modify({ synced: 1 });
  };

  // PUSH Products (Local Creation → Cloud)
  const pushProducts = async () => {
    const unsynced = await db.products.where('synced').equals(0).toArray();
    if (unsynced.length === 0) return;
    const remotePayload = unsynced.map(p => ({
        id: p.id, sku: p.sku, name: p.name, category: p.category,
        retail_price_ksh: p.basePrice, wholesale_price: p.wholesalePrice,
        wholesale_threshold: p.wholesaleQtyThreshold, requires_imei: p.requires_imei
    }));
    const { error } = await supabase.from('products').upsert(remotePayload);
    if (error) { console.error('pushProducts failed:', error.message); throw error; }
    await db.products.where('id').anyOf(unsynced.map(p => p.id)).modify({ synced: 1 });
  };

  // PULL Products from Cloud
  const pullProducts = async () => {
    const { data, error } = await supabase.from('products').select('*');
    if (error) { console.error('pullProducts failed:', error.message); throw error; }
    if (data) {
      const products = data.map((p: any) => ({
        id: p.id, sku: p.sku, name: p.name, 
        basePrice: p.retail_price_ksh || p.base_price || 0,
        category: p.category, tags: p.tags || [],
        wholesaleQtyThreshold: p.wholesale_threshold || 5,
        wholesalePrice: p.wholesale_price || 0,
        synced: 1 as const
      }));
      await db.products.bulkPut(products);
    }
  };

  // PULL Inventory from Cloud
  const pullInventory = async () => {
    // 1. Blackout Guard: Never pull if we have local unsynced logs (prevent overwrite)
    const pendingLogs = await db.inventory_logs.where({ shopId, synced: 0 }).count();
    if (pendingLogs > 0) return;

    // 2. UUID Guard: Supabase 'shop_id' column is a UUID. 
    // If our local shopId is a slug (like 'warehouse'), skip sync to avoid 400 errors.
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
    if (!isUUID(shopId)) {
      console.warn(`Skipping pullInventory: '${shopId}' is not a valid UUID for Supabase sync.`);
      return;
    }

    const { data, error } = await supabase.from('inventory').select('*').eq('shop_id', shopId);
    if (error) {
      console.error('pullInventory failed:', error.message);
      throw error;
    }
    
    if (data) {
      const inventory = data.map((inv: any) => ({
        id: inv.id, productId: inv.product_id, shopId: inv.shop_id,
        qty: inv.qty, cost_basis_ksh: inv.cost_basis_ksh || 0, synced: 1 as const
      }));
      await db.inventory.bulkPut(inventory);
    }
  };

  const runSyncCycle = useCallback(async () => {
    if (isSyncingRef.current || !navigator.onLine) return;
    isSyncingRef.current = true;
    setStatus('syncing');
    try {
      await pushProducts();
      await pushPurchases();
      await pushSales();
      await pushInventoryLogs();
      await pushCustomers();
      await pullProducts();
      await pullInventory();
      setLastSyncedAt(new Date());
      setStatus('idle');
    } catch (err) {
      console.error('Sync failed:', err);
      setStatus('error');
    } finally {
      isSyncingRef.current = false;
      refreshPendingCount();
    }
  }, [shopId]);

  const refreshPendingCount = async () => {
    const prodCount = await db.products.where('synced').equals(0).count();
    const pCount = await db.purchases.where('synced').equals(0).count();
    const sCount = await db.sale_transactions.where('synced').equals(0).count();
    const lCount = await db.inventory_logs.where('synced').equals(0).count();
    const cCount = await db.customers.where('synced').equals(0).count();
    setPendingCount(prodCount + pCount + sCount + lCount + cCount);
  };

  useEffect(() => {
    const interval = setInterval(runSyncCycle, 30000);
    const countInterval = setInterval(refreshPendingCount, 5000);
    
    window.addEventListener('online', () => { setIsOnline(true); runSyncCycle(); });
    window.addEventListener('offline', () => setIsOnline(false));

    runSyncCycle();
    
    return () => {
      clearInterval(interval);
      clearInterval(countInterval);
    };
  }, [runSyncCycle]);

  return { status, lastSyncedAt, pendingCount, isOnline, triggerSync: runSyncCycle };
}

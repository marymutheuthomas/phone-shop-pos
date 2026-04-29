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

    const records = unsynced.map(p => ({
      id: String(p.id),
      shop_id: String(p.shopId),
      product_id: String(p.productId),
      recorded_by: p.recordedBy,
      qty: p.qty,
      unit_cost_ksh: p.unitCostKsh,
      total_ksh: p.totalKsh,
      supplier_name: p.supplierName,
      po_number: p.poNumber,
      purchased_at: new Date(p.timestamp).toISOString()
    }));

    console.log("📤 ATTEMPTING PUSH [purchases]:", records);
    const { error } = await supabase.from('purchases').upsert(records);
    if (error) {
      console.error("❌ SUPABASE REJECTED [purchases]:", error);
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
        id: String(txn.id),
        shop_id: String(txn.shopId),
        staff_id: String(txn.staffId),
        total_ksh: txn.totalKsh,
        discount_ksh: txn.discountKsh,
        payment_method: txn.paymentMethod,
        mpesa_ref: txn.mpesaRef,
        customer_name: txn.customerName,
        customer_phone: txn.customerPhone,
        price_type: txn.priceType || 'RETAIL',
        verification_status: txn.status || 'COMPLETED',
        sale_at: new Date(txn.timestamp).toISOString()
      };

      // 3. Upsert Header
      console.log("📤 ATTEMPTING PUSH [sale_transactions]:", txnPayload);
      const { error: txnError } = await supabase.from('sale_transactions').upsert(txnPayload);
      if (txnError) {
        console.error("❌ SUPABASE REJECTED [sale_transactions]:", txnError);
        throw txnError;
      }

      // 4. Prepare and Upsert Items
      if (items.length > 0) {
        const itemsPayload = items.map((i, idx) => ({
          id: i.id || `si_${txn.id}_${idx}`,
          sale_id: String(i.saleId),
          product_id: String(i.productId),
          qty: i.qty,
          sale_price_ksh: i.salePriceKsh,
          price_type: i.priceType || 'RETAIL'
        }));

        console.log("📤 ATTEMPTING PUSH [sale_items]:", itemsPayload);
        const { error: itemsError } = await supabase.from('sale_items').upsert(itemsPayload);
        if (itemsError) {
          console.error("❌ SUPABASE REJECTED [sale_items]:", itemsError);
          throw itemsError;
        }
      }

      // 5. Mark txn as synced locally
      await db.sale_transactions.update(txn.id, { synced: 1 });
    }
  };

  // 2. Sync Logic: PUSH local logs to Cloud
  const pushInventoryLogs = async () => {
    const allUnsynced = await db.inventory_logs.where('synced').equals(0).toArray();
    if (allUnsynced.length === 0) return;

    // 🛡️ Guard: strip zombie records (null ID or legacy shop_1)
    const validLegacyShops = ['shop_1'];
    const unsynced = allUnsynced.filter(l =>
      !!l.id &&
      !validLegacyShops.includes(l.shopId)
    );

    const zombieCount = allUnsynced.length - unsynced.length;
    if (zombieCount > 0) {
      console.warn(`🧹 Sync Guard: Skipping ${zombieCount} zombie inventory_log records (null ID or shop_1).`);
      // Delete zombies from local DB so they don't keep blocking sync
      const zombieIds = allUnsynced
        .filter(l => !l.id || validLegacyShops.includes(l.shopId))
        .map(l => l.id)
        .filter((id): id is string => !!id);
      if (zombieIds.length > 0) await db.inventory_logs.bulkDelete(zombieIds);
      await db.inventory_logs.filter(l => !l.id || validLegacyShops.includes(l.shopId)).delete();
    }

    if (unsynced.length === 0) return;

    const remotePayload = unsynced.map(l => ({
      id: String(l.id),
      shop_id: String(l.shopId),
      product_id: String(l.productId),
      change_type: l.changeType,
      quantity_changed: l.qtyChanged,
      new_balance: l.newBalance,
      staff_id: String(l.staffId),
      created_at: new Date(l.timestamp).toISOString()
    }));

    console.log("📤 ATTEMPTING PUSH [inventory_logs]:", remotePayload);
    const { error } = await supabase.from('inventory_logs').upsert(remotePayload);
    if (error) {
      console.error("❌ SUPABASE REJECTED [inventory_logs]:", error);
      throw error;
    }

    const localIds = unsynced.map(l => l.id).filter((id): id is string => id !== undefined);
    await db.inventory_logs.where('id').anyOf(localIds).modify({ synced: 1 });
  };

  // Sync Logic: PUSH customers to Cloud (Debt Guard — offline names rush up)
  const pushCustomers = async () => {
    const unsynced = await db.customers.where('synced').equals(0).toArray();
    if (unsynced.length === 0) return;

    const remotePayload = unsynced.map((c: Customer) => ({
      id: String(c.id),
      name: c.name,
      phone: c.phone || null,
      email: c.email || null,
      is_debt_eligible: c.isDebtEligible,
      total_balance: c.totalBalance,
      shop_id: String(c.shopId),
    }));

    console.log("📤 ATTEMPTING PUSH [customers]:", remotePayload);
    const { error } = await supabase.from('customers').upsert(remotePayload);
    if (error) {
      console.error("❌ SUPABASE REJECTED [customers]:", error);
      throw error;
    }

    await db.customers.where('id').anyOf(unsynced.map(c => c.id)).modify({ synced: 1 });
  };

  // PUSH Products (Local Creation → Cloud)
  const pushProducts = async () => {
    const unsynced = await db.products.where('synced').equals(0).toArray();
    if (unsynced.length === 0) return;
    const remotePayload = unsynced.map(p => ({
        id: String(p.id), sku: p.sku, name: p.name, category: p.category,
        retail_price_ksh: p.basePrice,
        wholesale_price_ksh: p.wholesalePrice,
        reorder_level: p.reorderLevel
    }));
    console.log('📦 Attempting to sync product payload:', remotePayload);
    const { error } = await supabase.from('products').upsert(remotePayload);
    if (error) {
      console.error("❌ SUPABASE REJECTED [products]:", error.message, '| Code:', error.code, '| Details:', error.details);
      throw error;
    }
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
        wholesalePrice: p.wholesale_price_ksh || p.wholesale_price || 0,
        reorderLevel: p.reorder_level || 10,
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

    // 2. Local-Cloud Sync: Pull inventory for the current active shop
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

  // PULL Customers (Admin updates eligibility/balance)
  const pullCustomers = async () => {
    const { data, error } = await supabase.from('customers').select('*');
    if (error) throw error;
    if (data) {
      const customers = data.map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        shopId: c.shop_id,
        isDebtEligible: c.is_debt_eligible,
        totalBalance: c.total_balance,
        synced: 1 as const
      }));
      await db.customers.bulkPut(customers);
    }
  };

  // PULL Sales (Admin updates status to COMPLETED/REJECTED)
  const pullSales = async () => {
    const { data, error } = await supabase.from('sale_transactions').select('*').eq('shop_id', shopId);
    if (error) throw error;
    if (data) {
      for (const txn of data) {
        // Only update status if it changed to prevent overwriting local edits (though sales are mostly immutable except status)
        await db.sale_transactions.where('id').equals(txn.id).modify({
          status: txn.verification_status,
          synced: 1
        });
      }
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
      await pullCustomers();
      await pullSales();
      setLastSyncedAt(new Date());
      setStatus('idle');
    } catch (err: any) {
      console.error('❌ Sync failed:', err.message || err, '| Code:', err.code, '| Details:', err.details);
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
    
    const counts = { 
      products: prodCount, 
      purchases: pCount, 
      sales: sCount, 
      logs: lCount, 
      customers: cCount 
    };

    if (prodCount + pCount + sCount + lCount + cCount > 0) {
      console.log("🔍 DIAGNOSTIC: Unsynced counts:", counts);
    }

    setPendingCount(prodCount + pCount + sCount + lCount + cCount);
  };

  useEffect(() => {
    // FORCE RESET: One-time re-sync for relaxed schema
    const resetSync = async () => {
      const resetKey = 'sync_realigned_v2'; // Bumped version to force re-flush
      if (!localStorage.getItem(resetKey)) {
        console.log("🚀 SYNC ALIGNMENT: Resetting local synced flags for full re-sync...");
        // Clear all synced flags to force re-uploading everything with string alignment
        await db.products.where('synced').equals(1).modify({ synced: 0 });
        await db.purchases.where('synced').equals(1).modify({ synced: 0 });
        await db.sale_transactions.where('synced').equals(1).modify({ synced: 0 });
        await db.inventory_logs.where('synced').equals(1).modify({ synced: 0 });
        await db.customers.where('synced').equals(1).modify({ synced: 0 });
        
        localStorage.setItem(resetKey, 'true');
        console.log("✅ Sync flags cleared. Starting full re-sync...");
        runSyncCycle();
      }
    };
    resetSync();

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

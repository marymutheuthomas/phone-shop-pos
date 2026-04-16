import { db } from './schema';
import type { Product, InventoryCache } from './schema';

export async function initializeMockData() {
  try {
    // Check if our specific Phase 5 product is missing. 
    // If it is, that means the Phase 2 data is locked in and blocking the new injects!
    const oraimoExists = await db.products.where('sku').equals('ORA-SMART-RNG').count();
    
    if (oraimoExists === 0) {
      console.log("Phase 2 database detected. Wiping local tables for Phase 5 restructuring...");
      await db.products.clear();
      await db.inventory.clear();
      await db.transfers.clear();
      await db.active_cart.clear();
      await db.sales_queue.clear();
    } else {
      console.log("OmniShopDB already fully populated for Phase 5.");
      return; 
    }

    // Injecting 2026 logic explicitly requested (OWS, Qi2.2, Smart Rings, 140W GaN)
    const products: Product[] = [
      { id: Math.random().toString(36).substring(2, 15), sku: 'ANK-NANO-140W', name: 'Anker Nano 140W GaN Charger', basePrice: 15000, wholesaleQtyThreshold: 5, wholesalePrice: 13000, tags: ['charger', 'GaN', '140W'], category: 'Chargers' },
      { id: Math.random().toString(36).substring(2, 15), sku: 'PIS-IDOCK-QI2.2', name: 'Pisen iDock Qi2.2 AI Charging Station', basePrice: 22000, wholesaleQtyThreshold: 3, wholesalePrice: 19000, tags: ['charger', 'Qi2'], category: 'Chargers' },
      { id: Math.random().toString(36).substring(2, 15), sku: 'ORA-SMART-RNG', name: 'Oraimo Smart Ring', basePrice: 12000, wholesaleQtyThreshold: 10, wholesalePrice: 9500, tags: ['wearable', 'smart ring'], category: 'Wearables' },
      { id: Math.random().toString(36).substring(2, 15), sku: 'OWS-FREEBUDS', name: 'OWS Pro Open-Ear Earbuds', basePrice: 25000, wholesaleQtyThreshold: 5, wholesalePrice: 21000, tags: ['audio', 'OWS'], category: 'Audio' }
    ];

    await db.products.bulkAdd(products);

    // Initial injection solely for the Warehouse
    // The previous implementation used 'main-warehouse-1' but the TransferPortal tests 'warehouse'.
    const inventory: InventoryCache[] = products.map(p => ({
      id: Math.random().toString(36).substring(2, 15),
      productId: p.id,
      shopId: 'warehouse',  
      qty: p.sku === 'ORA-SMART-RNG' ? 200 : 50 
    }));

    await db.inventory.bulkAdd(inventory);
    
    // Seed Nairobi Central (shop_1) with 10 trendy items to strictly trigger the phantom alert
    const nairobiInventory: InventoryCache[] = products.map(p => ({
      id: Math.random().toString(36).substring(2, 15),
      productId: p.id,
      shopId: 'shop_1', // Nairobi Central
      qty: (p.sku === 'ORA-SMART-RNG' || p.sku === 'ANK-NANO-140W') ? 10 : 0 
    }));
    await db.inventory.bulkAdd(nairobiInventory);

    // Seed an empty record for Kisumu West
    const kisumuInventory: InventoryCache[] = products.map(p => ({
      id: Math.random().toString(36).substring(2, 15),
      productId: p.id,
      shopId: 'shop_3', // Kisumu West
      qty: 0 
    }));
    await db.inventory.bulkAdd(kisumuInventory);

    // Initial Core Employee Provisioning
    const employeeExists = await db.employees.count();
    if (employeeExists === 0) {
      await db.employees.bulkAdd([
        { username: 'admin', passcode: 'admin123', name: 'System Administrator', role: 'ADMIN', shopId: 'warehouse', shopName: 'Global Warehouse' },
        { username: 'manager', passcode: 'manager123', name: 'Mwangi (Manager)', role: 'MANAGER', shopId: 'shop_1', shopName: 'Nairobi Central' },
        { username: 'staff', passcode: 'staff123', name: 'Amina (Cashier)', role: 'STAFF', shopId: 'shop_2', shopName: 'Mombasa Road' }
      ]);
    }

    console.log("Mock data successfully seeded into OmniShopDB.");
  } catch (error) {
    console.error("Failed to seed mock data:", error);
  }
}

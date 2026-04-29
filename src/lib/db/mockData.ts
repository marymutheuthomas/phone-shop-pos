import { db } from './schema';
import type { Product, InventoryCache, Shop } from './schema';

export async function initializeMockData() {
  try {
    // Check if our new fast charger exists
    const seedExists = await db.products.where('sku').equals('CHR-20W-FAST').count();
    
    if (seedExists === 0) {
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

    // Injecting Phone Shop items
    const products: Product[] = [
      { id: 'prod_1', sku: 'CHR-20W-FAST', name: '20W Fast Charger', basePrice: 1500, wholesalePrice: 1200, reorderLevel: 10, tags: ['charger', 'fast'], category: 'Chargers', synced: 0 },
      { id: 'prod_2', sku: 'CAS-SIL-BLK', name: 'Silicone Case - Black', basePrice: 500, wholesalePrice: 350, reorderLevel: 10, tags: ['case', 'silicone'], category: 'Accessories', synced: 0 },
      { id: 'prod_3', sku: 'SCR-PRO-GLS', name: 'Tempered Glass Screen Protector', basePrice: 400, wholesalePrice: 250, reorderLevel: 10, tags: ['screen protector', 'glass'], category: 'Accessories', synced: 0 },
      { id: 'prod_4', sku: 'CBL-USB-C-1M', name: '1m USB-C Cable', basePrice: 800, wholesalePrice: 600, reorderLevel: 10, tags: ['cable', 'usb-c'], category: 'Cables', synced: 0 }
    ];

    await db.products.bulkPut(products);

    // Seed the 5 real shop locations
    const shops: Shop[] = [
      { id: 'shop_techplanet',  name: 'Tech Planet Main Shop',  synced: 0 },
      { id: 'shop_techkys',    name: 'Techkys',                 synced: 0 },
      { id: 'shop_brilliance', name: 'Brilliance Stationers',  synced: 0 },
      { id: 'shop_taf1',       name: 'Taf 1',                  synced: 0 },
      { id: 'shop_taf2',       name: 'Taf 2',                  synced: 0 },
    ];
    await db.shops.bulkPut(shops);

    // Seed shop_techplanet
    const techPlanetInventory: InventoryCache[] = products.map((p, index) => ({
      id: `inv_techplanet_${index}`,
      productId: p.id,
      shopId: 'shop_techplanet',
      qty: 20,
      synced: 0
    }));
    await db.inventory.bulkPut(techPlanetInventory);

    // Initial Core Employee Provisioning
    const employeeExists = await db.employees.count();
    if (employeeExists === 0) {
      await db.employees.bulkPut([
        { id: 'emp_1', username: 'admin', passcode: 'admin123', name: 'System Administrator', role: 'ADMIN', shopId: 'shop_techplanet', shopName: 'Tech Planet Main Shop' },
        { id: 'emp_2', username: 'employee', passcode: 'employee123', name: 'Cashier', role: 'EMPLOYEE', shopId: 'shop_techplanet', shopName: 'Tech Planet Main Shop' }
      ]);
    }

    // Seed some Customers
    const customerCount = await db.customers.count();
    if (customerCount === 0) {
      await db.customers.bulkPut([
        { id: 'cust_1', name: 'John Doe', phone: '0712345678', shopId: 'shop_techplanet', isDebtEligible: true, totalBalance: 0, synced: 0 },
        { id: 'cust_2', name: 'Jane Smith', phone: '0722334455', shopId: 'shop_techplanet', isDebtEligible: false, totalBalance: 0, synced: 0 },
        { id: 'cust_3', name: 'Brilliance Manager', phone: '0733445566', shopId: 'shop_brilliance', isDebtEligible: true, totalBalance: 5000, synced: 0 },
      ]);
    }

    console.log("Mock data successfully seeded into OmniShopDB.");
  } catch (error) {
    console.error("Failed to seed mock data:", error);
  }
}

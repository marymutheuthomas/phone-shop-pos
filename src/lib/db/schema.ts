import Dexie from 'dexie';
import type { Table } from 'dexie';

export interface Product {
  id: string;
  sku: string;
  name: string;
  basePrice: number;
  wholesaleQtyThreshold: number;
  wholesalePrice: number;
  tags: string[];
  category: string;
  requires_imei?: boolean;
  synced?: number;
}

export interface ProductItem {
  id?: number | string;
  productId: string;
  imei_serial: string;
  shopId: string;
  status: 'IN_STOCK' | 'SOLD';
}

export interface InventoryCache {
  id: string;
  productId: string;
  shopId: string;
  qty: number;
  synced: 0 | 1;
}

export interface SaleTransaction {
  id: string;
  shopId: string;
  staffId: string;
  totalKsh: number;
  discountKsh: number;
  paymentMethod: 'CASH' | 'M-PESA' | 'CARD' | 'DEBT';
  mpesaRef?: string;
  timestamp: number;
  synced: 0 | 1;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  qty: number;
  salePriceKsh: number;
}

export interface ActiveCart {
  id?: number;
  productId: string;
  qty: number;
}

export interface SalesQueueTask {
  id?: number;
  payload: any;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed';
}

export interface Transfer {
  id: string;
  productId: string;
  fromShopId: string;
  toShopId: string;
  qty: number;
  status: 'PENDING' | 'COMPLETED';
  timestamp: number;
  synced: 0 | 1;
}

export interface AuditRecord {
  id?: number;
  shopId: string;
  productId: string;
  expectedQty: number;
  enteredQty: number;
  discrepancy: number;
  approverId: string;
  timestamp: number;
}

export interface Employee {
  id?: number;
  username: string;
  name: string;
  role: 'STAFF' | 'MANAGER' | 'ADMIN';
  shopId: string;
  shopName: string;
  passcode: string;
}

export interface Customer {
  id: string;        // UUID
  name: string;
  phone?: string;
  email?: string;
  shopId: string;
  synced: 0 | 1;   // Blackout Guard flag
}

export interface Purchase {
  id: string;
  shopId: string;
  productId: string;
  recordedBy: string;
  qty: number;
  unitCostKsh: number;
  totalKsh: number;
  supplierName: string | null;
  poNumber: string | null;
  timestamp: number;
  synced: 0 | 1;
}

export interface InventoryLog {
  id?: number;
  shopId: string;
  productId: string;
  changeType: 'PURCHASE' | 'SALE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'AUDIT_ADJUSTMENT';
  qtyChanged: number;
  newBalance: number;
  staffId: string;
  timestamp: number;
  synced: 0 | 1;
}

export class OmniShopDatabase extends Dexie {
  products!: Table<Product, string>;
  product_items!: Table<ProductItem, string | number>;
  inventory!: Table<InventoryCache, string>;
  active_cart!: Table<ActiveCart, number>;
  sales_queue!: Table<SalesQueueTask, number>;
  transfers!: Table<Transfer, string>;
  audits!: Table<AuditRecord, number>;
  employees!: Table<Employee, number>;
  purchases!: Table<Purchase, string>;
  inventory_logs!: Table<InventoryLog, number>;
  sale_transactions!: Table<SaleTransaction, string>;
  sale_items!: Table<SaleItem, string>;
  customers!: Table<Customer, string>;

  constructor() {
    super('OmniShopDB');
    this.version(10).stores({
      products: 'id, sku, category, *tags, synced',
      product_items: '++id, productId, imei_serial, shopId, status',
      inventory_logs: '++id, shopId, productId, changeType, timestamp, synced, [shopId+synced]',
      active_cart: '++id, productId',
      sales_queue: '++id, status',
      transfers: 'id, productId, fromShopId, toShopId, status, synced',
      audits: '++id, shopId, productId, timestamp',
      employees: '++id, username, role',
      purchases: 'id, shopId, productId, synced, timestamp',
      inventory: '++id, shopId, productId, synced',
      sale_transactions: 'id, shopId, staffId, synced, timestamp',
      sale_items: 'id, saleId, productId',
      customers: 'id, shopId, synced, phone'
    });
  }
}

export const db = new OmniShopDatabase();

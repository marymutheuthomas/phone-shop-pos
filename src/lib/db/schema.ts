import Dexie from 'dexie';
import type { Table } from 'dexie';

export interface Product {
  id: string;
  sku: string;
  name: string;
  basePrice: number;
  wholesalePrice: number;
  reorderLevel: number;
  tags: string[];
  category: string;
  synced?: number;
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
  wholesale_cost?: number; // Added for profit calculation
  discountKsh: number;
  paymentMethod: 'CASH' | 'M-PESA' | 'CARD' | 'DEBT' | 'DEBT_SETTLEMENT';
  mpesaRef?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  priceType: 'RETAIL' | 'WHOLESALE';
  status: 'COMPLETED' | 'PENDING' | 'REJECTED';
  timestamp: number;
  synced: 0 | 1;
}

export interface DebtPayment {
  id: string;
  customerId: string;
  amount: number;
  method: 'CASH' | 'M-PESA';
  timestamp: number;
  synced: 0 | 1;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  qty: number;
  salePriceKsh: number;
  priceType: 'RETAIL' | 'WHOLESALE';
}

export interface ActiveCart {
  id: string;
  productId: string;
  qty: number;
  priceType: 'RETAIL' | 'WHOLESALE';
}

export interface SalesQueueTask {
  id: string;
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
  id: string;
  shopId: string;
  productId: string;
  expectedQty: number;
  enteredQty: number;
  discrepancy: number;
  approverId: string;
  timestamp: number;
  synced: 0 | 1;
}

export interface Employee {
  id: string;
  username: string;
  name: string;
  role: 'EMPLOYEE' | 'ADMIN' | 'MANAGER';
  shopId: string;
  shopName: string;
  passcode: string;
}

export interface Shop {
  id: string;
  name: string;
  synced: 0 | 1;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  shopId: string;
  isDebtEligible: boolean;
  totalBalance: number;
  synced: 0 | 1;
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
  id: string;
  shopId: string;
  productId: string;
  changeType: 'PURCHASE' | 'SALE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'AUDIT_ADJUSTMENT' | 'REVERSAL';
  qtyChanged: number;
  newBalance: number;
  staffId: string;
  timestamp: number;
  synced: 0 | 1;
}

export class OmniShopDatabase extends Dexie {
  shops!: Table<Shop, string>;
  products!: Table<Product, string>;
  inventory!: Table<InventoryCache, string>;
  active_cart!: Table<ActiveCart, string>;
  sales_queue!: Table<SalesQueueTask, string>;
  transfers!: Table<Transfer, string>;
  audits!: Table<AuditRecord, string>;
  employees!: Table<Employee, string>;
  purchases!: Table<Purchase, string>;
  inventory_logs!: Table<InventoryLog, string>;
  sale_transactions!: Table<SaleTransaction, string>;
  sale_items!: Table<SaleItem, string>;
  customers!: Table<Customer, string>;
  debt_payments!: Table<DebtPayment, string>;

  constructor() {
    super('OmniShopDB');
    this.version(17).stores({
      shops: 'id, name, synced',
      products: 'id, sku, category, *tags, synced',
      inventory_logs: 'id, shopId, productId, changeType, timestamp, synced, [shopId+synced]',
      active_cart: 'id, productId',
      sales_queue: 'id, status',
      transfers: 'id, productId, fromShopId, toShopId, status, synced',
      audits: 'id, shopId, productId, timestamp',
      employees: 'id, username, role',
      purchases: 'id, shopId, productId, synced, timestamp',
      inventory: 'id, shopId, productId, synced, [shopId+productId]',
      sale_transactions: 'id, shopId, staffId, status, synced, timestamp',
      sale_items: 'id, saleId, productId',
      customers: 'id, shopId, synced, phone, isDebtEligible',
      debt_payments: 'id, customerId, timestamp, synced'
    });
  }
}

export const db = new OmniShopDatabase();


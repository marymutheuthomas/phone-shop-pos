import Dexie from 'dexie';
import type { Table } from 'dexie';

export interface Product {
  id: string; 
  sku: string;
  name: string;
  basePrice: number; // Integer (KSh)
  wholesalePrice: number; // Integer (KSh)
  tags: string[];
  category: string;
}

export interface InventoryCache {
  id: string;
  productId: string;
  shopId: string;
  qty: number;
}

export interface SyncQueueTask {
  id?: number; // auto-increment local id
  type: 'sale' | 'audit' | 'transfer';
  payload: any;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed';
}

export class AppLocalDatabase extends Dexie {
  products!: Table<Product, string>;
  inventoryCache!: Table<InventoryCache, string>;
  syncQueue!: Table<SyncQueueTask, number>;

  constructor() {
    super('OmniShopLocalDB');
    this.version(1).stores({
      products: 'id, sku, category, *tags', // Indexed by id, sku, category, and an array of tags (for flexible search)
      inventoryCache: 'id, productId, shopId',
      syncQueue: '++id, type, status'
    });
  }
}

export const localDb = new AppLocalDatabase();

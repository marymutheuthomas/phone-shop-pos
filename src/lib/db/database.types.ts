/**
 * database.types.ts
 * ------------------
 * TypeScript types mirroring the Supabase PostgreSQL schema.
 * These are used by the supabaseClient to provide end-to-end type safety.
 *
 * Financial rule: all KSh amounts are INTEGER (whole shillings).
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type UserRole = 'super_admin' | 'shop_manager' | 'staff';
export type PaymentMethod = 'cash' | 'mpesa' | 'credit';
export type SaleStatus = 'completed' | 'voided' | 'refunded';
export type TransferStatus = 'pending' | 'in_transit' | 'received' | 'rejected';

export interface Database {
  public: {
    Tables: {
      shops: {
        Row: {
          id: string;
          name: string;
          location: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['shops']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['shops']['Insert']>;
      };

      users: {
        Row: {
          id: string;
          shop_id: string | null;
          full_name: string;
          role: UserRole;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };

      products: {
        Row: {
          id: string;
          sku: string;
          name: string;
          category: string | null;
          unit: string;
          retail_price_ksh: number; // INTEGER
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
      };

      inventory: {
        Row: {
          id: string;
          shop_id: string;
          product_id: string;
          qty_on_hand: number;
          reorder_level: number;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['inventory']['Row'], 'id' | 'updated_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['inventory']['Insert']>;
      };

      purchases: {
        Row: {
          id: string;
          shop_id: string;
          product_id: string;
          recorded_by: string;
          qty: number;
          unit_cost_ksh: number; // INTEGER
          total_ksh: number;     // INTEGER
          supplier_name: string | null;
          notes: string | null;
          purchased_at: string;
          synced: boolean;
        };
        Insert: Omit<Database['public']['Tables']['purchases']['Row'], 'id' | 'purchased_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['purchases']['Insert']>;
      };

      sales_transactions: {
        Row: {
          id: string;
          shop_id: string;
          cashier_id: string;
          total_ksh: number;    // INTEGER
          discount_ksh: number; // INTEGER
          tax_ksh: number;      // INTEGER
          payment_method: PaymentMethod;
          status: SaleStatus;
          sold_at: string;
          synced: boolean;
        };
        Insert: Omit<Database['public']['Tables']['sales_transactions']['Row'], 'id' | 'sold_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['sales_transactions']['Insert']>;
      };

      sale_items: {
        Row: {
          id: string;
          sales_transaction_id: string;
          product_id: string;
          qty: number;
          unit_price_ksh: number; // INTEGER
          line_total_ksh: number; // INTEGER
        };
        Insert: Omit<Database['public']['Tables']['sale_items']['Row'], 'id'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['sale_items']['Insert']>;
      };

      transfers: {
        Row: {
          id: string;
          from_shop_id: string;
          to_shop_id: string;
          product_id: string;
          qty: number;
          initiated_by: string;
          status: TransferStatus;
          notes: string | null;
          created_at: string;
          received_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['transfers']['Row'], 'id' | 'created_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['transfers']['Insert']>;
      };

      audits: {
        Row: {
          id: string;
          shop_id: string;
          product_id: string;
          audited_by: string;
          counted_qty: number;
          system_qty: number;
          variance: number;  // generated column (counted - system)
          notes: string | null;
          audited_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audits']['Row'], 'id' | 'variance' | 'audited_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['audits']['Insert']>;
      };
    };

    Functions: {
      get_my_role:    { Args: Record<never, never>; Returns: UserRole; };
      get_my_shop_id: { Args: Record<never, never>; Returns: string; };
      is_super_admin: { Args: Record<never, never>; Returns: boolean; };
    };
  };
}

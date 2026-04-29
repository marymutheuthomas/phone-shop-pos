-- Phase 8: Inventory Logs & Stock Movement
-- Run this in your Supabase SQL Editor

-- Create the ENUM for inventory change types
DO $$ BEGIN
    CREATE TYPE inventory_change_type AS ENUM (
      'PURCHASE', 
      'SALE', 
      'TRANSFER_IN', 
      'TRANSFER_OUT', 
      'AUDIT_ADJUSTMENT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create the inventory_logs table
CREATE TABLE IF NOT EXISTS inventory_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  change_type inventory_change_type NOT NULL,
  quantity_changed DECIMAL(12,2) NOT NULL, -- allow negatives
  new_balance DECIMAL(12,2) NOT NULL,
  staff_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;

-- Staff can read their own shop; Admin can read all
DROP POLICY IF EXISTS "Staff can view logs for their own shop" ON inventory_logs;
CREATE POLICY "Staff can view logs for their own shop"
ON inventory_logs
FOR SELECT
USING (
  staff_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'admin' OR profiles.shop_id = inventory_logs.shop_id)
  )
);

DROP POLICY IF EXISTS "Admins can manage logs" ON inventory_logs;
CREATE POLICY "Admins can manage logs"
ON inventory_logs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_inventory_logs_shop_product ON inventory_logs(shop_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created_at ON inventory_logs(created_at DESC);

-- =============================================================
-- OMNI-SHOP v1  —  Complete Supabase PostgreSQL Schema
-- Run this entire script in: Supabase Dashboard > SQL Editor
-- Financial rule: ALL KSh amounts stored as INTEGER (whole shillings)
-- =============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- 0. CUSTOM ROLES / AUTH HELPERS
-- =============================================================

-- We store a user's role + shop_id in auth.users app_metadata
-- Example app_metadata: { "role": "super_admin" }
--                   or: { "role": "shop_manager", "shop_id": "<uuid>" }
--                   or: { "role": "staff",         "shop_id": "<uuid>" }

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role',
    'staff'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_shop_id()
RETURNS UUID AS $$
  SELECT (
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'shop_id'
  )::UUID;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT public.get_my_role() = 'super_admin';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================================
-- 1. SHOPS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.shops (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  location    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

-- Super admins: full access
CREATE POLICY "shops_super_admin_all"
  ON public.shops FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Shop staff: can only read their own shop
CREATE POLICY "shops_staff_select_own"
  ON public.shops FOR SELECT
  USING (id = public.get_my_shop_id());

-- =============================================================
-- 2. USERS (Profile extension of auth.users)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id     UUID REFERENCES public.shops(id),
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('super_admin', 'shop_manager', 'staff')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_super_admin_all"
  ON public.users FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Users can read & update their own profile
CREATE POLICY "users_read_own"
  ON public.users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =============================================================
-- 3. PRODUCTS  (Master Catalog — managed by Super Admin)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku              TEXT UNIQUE NOT NULL,
  name             TEXT NOT NULL,
  category         TEXT,
  unit             TEXT NOT NULL DEFAULT 'pcs',   -- pcs, kg, litre, etc.
  retail_price_ksh INTEGER NOT NULL DEFAULT 0,      -- KSh whole shillings
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_super_admin_all"
  ON public.products FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- All authenticated users can read the master catalog
CREATE POLICY "products_authenticated_read"
  ON public.products FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- =============================================================
-- 4. INVENTORY  (Per-shop stock levels)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.inventory (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id       UUID NOT NULL REFERENCES public.shops(id),
  product_id    UUID NOT NULL REFERENCES public.products(id),
  qty_on_hand   INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, product_id)
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_super_admin_all"
  ON public.inventory FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "inventory_shop_staff_select"
  ON public.inventory FOR SELECT
  USING (shop_id = public.get_my_shop_id());

CREATE POLICY "inventory_shop_manager_write"
  ON public.inventory FOR ALL
  USING (
    shop_id = public.get_my_shop_id()
    AND public.get_my_role() IN ('shop_manager')
  )
  WITH CHECK (
    shop_id = public.get_my_shop_id()
    AND public.get_my_role() IN ('shop_manager')
  );

-- =============================================================
-- 5. PURCHASES  (Stock-In Ledger)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.purchases (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id),
  product_id      UUID NOT NULL REFERENCES public.products(id),
  recorded_by     UUID NOT NULL REFERENCES public.users(id),
  qty             INTEGER NOT NULL,
  unit_cost_ksh   INTEGER NOT NULL,   -- KSh per unit
  total_ksh       INTEGER NOT NULL,   -- qty * unit_cost_ksh
  supplier_name   TEXT,
  notes           TEXT,
  purchased_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced          BOOLEAN NOT NULL DEFAULT false   -- local offline marker
);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchases_super_admin_all"
  ON public.purchases FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "purchases_shop_staff_select"
  ON public.purchases FOR SELECT
  USING (shop_id = public.get_my_shop_id());

CREATE POLICY "purchases_shop_staff_insert"
  ON public.purchases FOR INSERT
  WITH CHECK (shop_id = public.get_my_shop_id());

-- =============================================================
-- 6. SALES TRANSACTIONS  (Receipt header)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.sales_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id),
  cashier_id      UUID NOT NULL REFERENCES public.users(id),
  total_ksh       INTEGER NOT NULL DEFAULT 0,   -- KSh
  discount_ksh    INTEGER NOT NULL DEFAULT 0,
  tax_ksh         INTEGER NOT NULL DEFAULT 0,
  payment_method  TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'mpesa', 'credit')),
  status          TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'voided', 'refunded')),
  sold_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced          BOOLEAN NOT NULL DEFAULT false   -- local offline marker
);

ALTER TABLE public.sales_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_super_admin_all"
  ON public.sales_transactions FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "sales_shop_staff_select"
  ON public.sales_transactions FOR SELECT
  USING (shop_id = public.get_my_shop_id());

CREATE POLICY "sales_shop_staff_insert"
  ON public.sales_transactions FOR INSERT
  WITH CHECK (shop_id = public.get_my_shop_id());

-- =============================================================
-- 7. SALE ITEMS  (Line items per receipt)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.sale_items (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_transaction_id  UUID NOT NULL REFERENCES public.sales_transactions(id) ON DELETE CASCADE,
  product_id            UUID NOT NULL REFERENCES public.products(id),
  qty                   INTEGER NOT NULL,
  unit_price_ksh        INTEGER NOT NULL,  -- KSh at time of sale
  line_total_ksh        INTEGER NOT NULL   -- qty * unit_price_ksh
);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- Inherit access via parent transaction's shop_id
CREATE POLICY "sale_items_super_admin_all"
  ON public.sale_items FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "sale_items_shop_staff_select"
  ON public.sale_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_transactions st
      WHERE st.id = sale_items.sales_transaction_id
        AND st.shop_id = public.get_my_shop_id()
    )
  );

CREATE POLICY "sale_items_shop_staff_insert"
  ON public.sale_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales_transactions st
      WHERE st.id = sale_items.sales_transaction_id
        AND st.shop_id = public.get_my_shop_id()
    )
  );

-- =============================================================
-- 8. TRANSFERS  (HQ → Shop stock movements)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.transfers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_shop_id    UUID NOT NULL REFERENCES public.shops(id),
  to_shop_id      UUID NOT NULL REFERENCES public.shops(id),
  product_id      UUID NOT NULL REFERENCES public.products(id),
  qty             INTEGER NOT NULL,
  initiated_by    UUID NOT NULL REFERENCES public.users(id),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'received', 'rejected')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at     TIMESTAMPTZ
);

ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfers_super_admin_all"
  ON public.transfers FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Shop staff can see transfers TO or FROM their shop
CREATE POLICY "transfers_shop_staff_select"
  ON public.transfers FOR SELECT
  USING (
    from_shop_id = public.get_my_shop_id()
    OR to_shop_id = public.get_my_shop_id()
  );

CREATE POLICY "transfers_shop_manager_insert"
  ON public.transfers FOR INSERT
  WITH CHECK (
    from_shop_id = public.get_my_shop_id()
    AND public.get_my_role() = 'shop_manager'
  );

-- Allow receiving shop to mark as received
CREATE POLICY "transfers_shop_manager_update"
  ON public.transfers FOR UPDATE
  USING (
    to_shop_id = public.get_my_shop_id()
    AND public.get_my_role() = 'shop_manager'
  );

-- =============================================================
-- 9. AUDITS  (Blind stock counts)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.audits (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id),
  product_id      UUID NOT NULL REFERENCES public.products(id),
  audited_by      UUID NOT NULL REFERENCES public.users(id),
  counted_qty     INTEGER NOT NULL,
  system_qty      INTEGER NOT NULL,
  variance        INTEGER GENERATED ALWAYS AS (counted_qty - system_qty) STORED,
  notes           TEXT,
  audited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audits_super_admin_all"
  ON public.audits FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "audits_shop_manager_all"
  ON public.audits FOR ALL
  USING (
    shop_id = public.get_my_shop_id()
    AND public.get_my_role() IN ('shop_manager')
  )
  WITH CHECK (
    shop_id = public.get_my_shop_id()
    AND public.get_my_role() IN ('shop_manager')
  );

-- =============================================================
-- 10. TRIGGERS — auto-update updated_at timestamps
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_shops
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_products
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_inventory
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================
-- 11. SEED DATA: Default Super Admin shop
-- =============================================================
INSERT INTO public.shops (id, name, location)
VALUES ('00000000-0000-0000-0000-000000000001', 'HQ Warehouse', 'Nairobi')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- END OF SCHEMA
-- =============================================================

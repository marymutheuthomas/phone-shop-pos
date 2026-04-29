-- 1. Update Customers table for Debt Eligibility
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS is_debt_eligible BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS total_balance NUMERIC DEFAULT 0;

-- 2. Update Sale Transactions table for Verification Status
-- Note: customer_name and customer_phone might already exist, but we ensure they do
ALTER TABLE sale_transactions 
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'COMPLETED',
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- 3. Ensure verification_status has correct default for new debt records
-- (Wait, the logic is usually handled by the application, but we can add a check constraint if needed)
-- ALTER TABLE sale_transactions ADD CONSTRAINT valid_status CHECK (verification_status IN ('COMPLETED', 'PENDING', 'REJECTED'));

-- 4. Update Inventory Logs to support REVERSAL type
-- If change_type is an ENUM, we need to add 'REVERSAL' to it.
-- Check if it's a text column first. If it's an enum, use the following:
-- DO $$ BEGIN
--     ALTER TYPE change_type_enum ADD VALUE 'REVERSAL';
-- EXCEPTION
--     WHEN duplicate_object THEN null;
-- END $$;
-- Assuming it's TEXT for flexibility as per previous alignment.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://icpwiudqeaarwwdfedjr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljcHdpdWRxZWFhcnd3ZGZlZGpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3ODQwNjAsImV4cCI6MjA5MTM2MDA2MH0.zgNfdrUpeyZlTaZr2xhJgJp-sRfzUgJZEXp0AU31RJs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function probe() {
  const tables = ['products', 'purchases', 'sale_transactions', 'sale_items', 'inventory_logs', 'customers'];
  const results = {};

  for (const table of tables) {
    console.log(`Probing table: ${table}`);
    let testData = {};
    if (table === 'products') testData = { id: 'test-id', sku: 'test-sku', name: 'test-name' };
    else if (table === 'purchases') testData = { id: 'test-id', shop_id: 'test-shop', product_id: 'test-prod', qty: 1, unit_cost_ksh: 1, total_ksh: 1 };
    else if (table === 'sale_transactions') testData = { id: 'test-id', shop_id: 'test-shop', staff_id: 'test-staff', total_ksh: 1, payment_method: 'CASH' };
    else if (table === 'sale_items') testData = { sale_id: 'test-sale', product_id: 'test-prod', qty: 1, sale_price_ksh: 1 };
    else if (table === 'inventory_logs') testData = { shop_id: 'test-shop', product_id: 'test-prod', change_type: 'PURCHASE', quantity_changed: 1, new_balance: 1, staff_id: 'test-staff' };
    else if (table === 'customers') testData = { id: 'test-id', name: 'test-name', shop_id: 'test-shop' };

    const { error } = await supabase.from(table).insert([testData]);
    if (error) {
      console.log(`Table ${table} error: ${error.code} - ${error.message} (${error.details})`);
    } else {
      console.log(`Table ${table} accepted string ID.`);
      // Clean up
      await supabase.from(table).delete().match(testData);
    }
  }
}

probe();

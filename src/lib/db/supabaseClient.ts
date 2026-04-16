import { createClient } from '@supabase/supabase-js';

// Retrieve Vite environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ── SAFETY GUARD ───────────────────────────────────────────────────────────
// This prevents the "supabaseUrl is required" crash and provides a clear warning
if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '⚠️ Supabase Connection Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing from your .env file.' +
    '\nActions: Ensure your .env file contains these variables and restart your dev server (npm run dev).'
  );
}

// Export a single, authenticated instance. 
// If variables are missing, we pass empty strings but the warning above informs the user why.
// Note: createClient will throw if url is exactly an empty string, so we provide a fallback for the type system.
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder-key');

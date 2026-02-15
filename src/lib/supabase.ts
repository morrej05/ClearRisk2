import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing required Supabase environment variables:', {
    VITE_SUPABASE_URL: supabaseUrl ? 'set' : 'MISSING',
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? 'set' : 'MISSING',
  });
  throw new Error(
    'Supabase configuration error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env file'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Dev helper for console debugging
if (import.meta.env.DEV) {
  (window as any).supabase = supabase;
}

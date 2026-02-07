import { createClient } from '@supabase/supabase-js';
import { DEV_ENV } from '../devEnv';

console.log('🔥 SUPABASE FILE LOADED');

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  (import.meta.env.DEV ? DEV_ENV.SUPABASE_URL : '');

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (import.meta.env.DEV ? DEV_ENV.SUPABASE_ANON_KEY : '');

console.log('🔥 SUPABASE VALUES', {
  url: supabaseUrl,
  hasAnonKey: !!supabaseAnonKey,
  mode: import.meta.env.MODE,
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Supabase config missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or DEV_ENV in Bolt).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

if (import.meta.env.DEV) {
  (window as any).supabase = supabase;
}

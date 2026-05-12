import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
}

// Ensure private instance variable to check against double initialization if needed
let supabaseInstance: any = null;

const createSupabaseClient = () => {
  if (supabaseInstance) return supabaseInstance;

  if (supabaseUrl && supabaseAnonKey) {
    supabaseInstance = createClient<any>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return supabaseInstance;
  }

  return new Proxy({} as any, {
    get: () => {
      throw new Error('Supabase client is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the AI Studio Secrets panel.');
    }
  });
};

export const supabase = createSupabaseClient();

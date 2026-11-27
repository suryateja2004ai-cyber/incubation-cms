// src/lib/supabase.js
// Supabase completely removed - All backend operations powered exclusively by Neon PostgreSQL

export function getSupabaseConfig() {
  return {
    supabaseUrl: '',
    supabasePublishableKey: '',
    isConfigured: false,
  };
}

// Safe stub for any lingering legacy imports
const createNoopBuilder = () => {
  const handler = {
    get: (target, prop) => {
      if (prop === 'then') return (resolve) => resolve({ data: [], error: null });
      return (...args) => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
};

export const supabase = {
  from: () => createNoopBuilder(),
  rpc: () => Promise.resolve({ data: null, error: null }),
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    signOut: () => Promise.resolve({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
};

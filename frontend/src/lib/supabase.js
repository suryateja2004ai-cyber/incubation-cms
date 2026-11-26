// src/lib/supabase.js
// Centralized Supabase Client initialized exclusively via environment variables
// Never store hardcoded credentials in source code!

import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL);

const supabasePublishableKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_PUBLISHABLE_KEY);

if (!supabaseUrl || !supabasePublishableKey) {
  console.error(
    '[Supabase Configuration] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY environment variable. ' +
    'Please configure them in your .env.local file or Cloudflare Pages environment variables.'
  );
}

const resolvedSupabaseUrl = supabaseUrl || 'https://placeholder.supabase.co';
const resolvedSupabaseKey = supabasePublishableKey || 'placeholder-anon-key';

export function getSupabaseConfig() {
  const isConfigured =
    Boolean(supabaseUrl && supabasePublishableKey) &&
    !resolvedSupabaseUrl.includes('placeholder.supabase.co') &&
    resolvedSupabaseKey !== 'placeholder-anon-key';

  return {
    supabaseUrl: resolvedSupabaseUrl,
    supabasePublishableKey: resolvedSupabaseKey,
    isConfigured,
  };
}

export const supabase = createClient(resolvedSupabaseUrl, resolvedSupabaseKey);
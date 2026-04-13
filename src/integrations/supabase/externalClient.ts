import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const EXTERNAL_SUPABASE_URL = "https://jfiyvvigvknfemqfnucl.supabase.co";
const EXTERNAL_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmaXl2dmlndmtuZmVtcWZudWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNDU2MzgsImV4cCI6MjA5MDkyMTYzOH0.Pb1f5_vlaqG16ONMRO3FQsOtyBby6nVFfA_26KSI4ik";

export const supabase = createClient<Database>(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

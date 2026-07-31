import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import {
  createInstrumentedFetch,
  setOperationalErrorAccessToken,
} from "@/lib/operationalErrorReporting";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: createInstrumentedFetch(globalThis.fetch.bind(globalThis)),
  },
});

void supabase.auth.getSession().then(({ data }) => {
  setOperationalErrorAccessToken(data.session?.access_token);
});

supabase.auth.onAuthStateChange((_event, session) => {
  setOperationalErrorAccessToken(session?.access_token);
});

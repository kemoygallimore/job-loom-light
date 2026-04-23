import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  company_id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, profile: null, role: null, loading: true,
  signOut: async () => {},
  refreshAuth: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialSessionChecked, setInitialSessionChecked] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    // First, restore session from storage before subscribing to changes
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setInitialSessionChecked(true);
    });

    // Subscribe to subsequent auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Don't do anything until the initial session check is done
    if (!initialSessionChecked) return;

    if (!user) {
      setProfile(null);
      setRole(null);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      const [{ data: profileData }, { data: roleData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      ]);

      setProfile(profileData as Profile | null);
      setRole(roleData?.role ?? null);
      setLoading(false);
    };

    fetchProfile();
  }, [user, initialSessionChecked, refreshTick]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRole(null);
  };

  const refreshAuth = async () => {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setUser(data.session?.user ?? null);
    setRefreshTick((n) => n + 1);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, loading, signOut, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { subscribeToUnauthorizedSession } from "@/lib/authSessionEvents";

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
  sessionExpired: boolean;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, profile: null, role: null, loading: true,
  sessionExpired: false,
  signOut: async () => {},
  refreshAuth: async () => {},
  clearSessionExpired: () => {},
});

export const useAuth = () => useContext(AuthContext);

function isDefinitiveSessionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; code?: unknown };
  return candidate.status === 401 ||
    candidate.status === 403 ||
    candidate.code === "session_not_found" ||
    candidate.code === "bad_jwt" ||
    candidate.code === "refresh_token_not_found";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [initialSessionChecked, setInitialSessionChecked] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const recoveryPromise = useRef<Promise<void> | null>(null);
  const userId = user?.id;

  const clearAuthenticatedState = useCallback(() => {
    setSession(null);
    setUser(null);
    setProfile(null);
    setRole(null);
  }, []);

  const expireSession = useCallback(async () => {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // React state still needs to recover if browser storage cleanup fails.
    } finally {
      clearAuthenticatedState();
      setSessionExpired(true);
    }
  }, [clearAuthenticatedState]);

  const recoverUnauthorizedSession = useCallback(() => {
    if (recoveryPromise.current) return recoveryPromise.current;

    const recovery = (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (data.user) return;
        if (isDefinitiveSessionError(error)) await expireSession();
      } catch {
        // A network failure is not proof that the session was revoked.
        // Keep the current browser signed in and retry on the next request.
      }
    })().finally(() => {
      recoveryPromise.current = null;
    });

    recoveryPromise.current = recovery;
    return recovery;
  }, [expireSession]);

  useEffect(() => {
    let active = true;
    let unsubscribeAuth: (() => void) | undefined;

    const initialize = async () => {
      const { data: { session: storedSession } } = await supabase.auth.getSession();
      if (!active) return;

      if (!storedSession) {
        clearAuthenticatedState();
        setInitialSessionChecked(true);
      } else {
        try {
          const { data, error } = await supabase.auth.getUser();
          if (!active) return;

          if (data.user) {
            setSession(storedSession);
            setUser(data.user);
            setSessionExpired(false);
          } else if (isDefinitiveSessionError(error)) {
            await expireSession();
          } else {
            // Preserve a locally valid session during a temporary Auth/network outage.
            setSession(storedSession);
            setUser(storedSession.user);
          }
        } catch {
          if (!active) return;
          // A rejected fetch is also a temporary validation failure.
          setSession(storedSession);
          setUser(storedSession.user);
        }
        if (active) setInitialSessionChecked(true);
      }

      if (!active) return;
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
        setUser((currentUser) => currentUser?.id === newSession?.user?.id
          ? currentUser
          : newSession?.user ?? null);
        if (newSession) setSessionExpired(false);
      });
      unsubscribeAuth = () => subscription.unsubscribe();
    };

    void initialize();

    return () => {
      active = false;
      unsubscribeAuth?.();
    };
  }, [clearAuthenticatedState, expireSession]);

  useEffect(() => subscribeToUnauthorizedSession(() => {
    void recoverUnauthorizedSession();
  }), [recoverUnauthorizedSession]);

  useEffect(() => {
    // Don't do anything until the initial session check is done
    if (!initialSessionChecked) return;

    if (!userId) {
      setProfile(null);
      setRole(null);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      const [{ data: profileData }, { data: roleData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      ]);

      setProfile(profileData as Profile | null);
      setRole(roleData?.role ?? null);
      setLoading(false);
    };

    fetchProfile();
    // Depend on user.id (primitive) rather than the user object so that a
    // refreshed-but-identical user does not re-trigger profile fetches.
  }, [userId, initialSessionChecked, refreshTick]);

  const signOut = async () => {
    setSessionExpired(false);
    try {
      await supabase.auth.signOut({ scope: "local" });
    } finally {
      clearAuthenticatedState();
    }
  };

  const refreshAuth = async () => {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setUser(data.session?.user ?? null);
    setRefreshTick((n) => n + 1);
  };

  const clearSessionExpired = () => setSessionExpired(false);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      role,
      loading,
      sessionExpired,
      signOut,
      refreshAuth,
      clearSessionExpired,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

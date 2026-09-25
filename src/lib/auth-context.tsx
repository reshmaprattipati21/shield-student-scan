import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
};

export function isAdminEmail(email: string) {
  const e = email.trim().toLowerCase();
  return e.startsWith("admin@") || e === "admin@scamshield.com";
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  refreshSession: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("[Auth] Failed to refresh session:", error.message);
      setSession(null);
      return null;
    }
    setSession(data.session);
    return data.session;
  };

  useEffect(() => {
    let ignore = false;

    const syncSession = async () => {
      const next = await refreshSession();
      if (!ignore) {
        setSession(next ?? null);
        setLoading(false);
      }
    };

    syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (ignore) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[Auth] Sign-out failed:", error.message);
      throw error;
    }
    setSession(null);
    setLoading(false);
  };

  const user = session?.user ?? null;

  return <Ctx.Provider value={{ user, session, loading, signOut, refreshSession }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

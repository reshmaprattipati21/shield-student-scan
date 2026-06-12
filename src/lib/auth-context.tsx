import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type LocalUser = {
  id: string;
  email: string;
  isAdmin: boolean;
  created_at: string;
};

type AuthCtx = {
  user: (User | LocalUser) | null;
  session: Session | null;
  localUser: LocalUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const LOCAL_KEY = "scamshield:local-user:v1";
const LOCAL_EVENT = "scamshield:local-user-change";

export function isAdminEmail(email: string) {
  const e = email.trim().toLowerCase();
  return e.startsWith("admin@") || e === "admin@scamshield.com";
}

export function setLocalUser(email: string): LocalUser {
  const user: LocalUser = {
    id: `local-${btoa(email).replace(/=/g, "")}`,
    email,
    isAdmin: isAdminEmail(email),
    created_at: new Date().toISOString(),
  };
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent(LOCAL_EVENT));
  return user;
}

export function clearLocalUser() {
  window.localStorage.removeItem(LOCAL_KEY);
  window.dispatchEvent(new CustomEvent(LOCAL_EVENT));
}

function readLocalUser(): LocalUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  localUser: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [localUser, setLU] = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    setLU(readLocalUser());
    const onChange = () => setLU(readLocalUser());
    window.addEventListener(LOCAL_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener(LOCAL_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const signOut = async () => {
    clearLocalUser();
    await supabase.auth.signOut().catch(() => {});
  };

  const user = session?.user ?? localUser ?? null;

  return (
    <Ctx.Provider value={{ user, session, localUser, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);

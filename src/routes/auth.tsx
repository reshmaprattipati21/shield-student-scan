import { createFileRoute, useRouter, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: (s: Record<string, unknown>) => ({ redirect: (s.redirect as string) || "/reports" }),
  head: () => ({ meta: [{ title: "Sign in — ScamShield" }] }),
});

function AuthPage() {
  const { user } = useAuth();
  const router = useRouter();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.navigate({ to: search.redirect });
  }, [user, router, search.redirect]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/reports` },
        });
        if (error) throw error;
        toast.success("Account created! Check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally { setLoading(false); }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/reports" });
    if (result.error) toast.error("Google sign-in failed");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-8">
        <div className="flex justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary"><Shield className="h-6 w-6" /></div>
        </div>
        <h1 className="text-2xl font-bold text-center">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="text-sm text-muted-foreground text-center mt-1">{mode === "signin" ? "Sign in to access community reports" : "Join ScamShield to report and review scams"}</p>

        <Button type="button" variant="secondary" className="w-full mt-6" onClick={google}>
          Continue with Google
        </Button>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input type="password" placeholder="Password (min 6)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="mt-4 text-sm text-muted-foreground hover:text-foreground w-full text-center">
          {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

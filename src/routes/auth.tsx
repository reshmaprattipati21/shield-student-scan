import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInWithOAuth } from "@/integrations/supabase/auth";
import { toast } from "sonner";
import { useAuth, isAdminEmail } from "@/lib/auth-context";
import { seedMockHistoryIfEmpty } from "@/lib/scan-history";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: (s: Record<string, unknown>) => ({ redirect: (s.redirect as string) || "" }),
  head: () => ({ meta: [{ title: "Sign in — ScamShield" }] }),
});

const DEMO_EMAIL = "admin@scamshield.com";
const DEMO_PASSWORD = "admin123";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthPage() {
  const { user } = useAuth();
  const router = useRouter();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const routeFor = (mail: string) => search.redirect || (isAdminEmail(mail) ? "/reports" : "/");

  useEffect(() => {
    if (user) {
      const mail = (user as { email?: string }).email ?? "";
      router.navigate({ to: search.redirect || (isAdminEmail(mail) ? "/reports" : "/") });
    }
  }, [user, router, search.redirect]);

  const completeLogin = (mail: string, kind: "signin" | "signup") => {
    seedMockHistoryIfEmpty();
    toast.success(kind === "signup" ? "Account created — welcome!" : "Welcome back");
    router.navigate({ to: routeFor(mail) });
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const mail = email.trim();
    if (!EMAIL_RE.test(mail)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: mail,
          password: password,
        });
        if (error) throw error;
        toast.success("Check your email for the confirmation link!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: mail,
          password: password,
        });
        if (error) throw error;
        completeLogin(mail, mode);
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const oauth = async (provider: "google" | "apple") => {
    const result = await signInWithOAuth(provider, { redirect_uri: window.location.origin + "/" });
    if ("error" in result && result.error) toast.error(`${provider} sign-in failed`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div
        className="w-full max-w-md rounded-2xl p-8 backdrop-blur-xl border transition-all duration-500"
        style={{
          background: "linear-gradient(160deg, rgba(19,28,46,0.92), rgba(11,15,25,0.85))",
          borderColor: "color-mix(in oklab, var(--cyber-cyan) 38%, transparent)",
          boxShadow:
            "0 0 0 1px color-mix(in oklab, var(--cyber-cyan) 18%, transparent), 0 20px 60px -20px color-mix(in oklab, var(--cyber-cyan) 45%, transparent), inset 0 1px 0 color-mix(in oklab, var(--cyber-cyan) 14%, transparent)",
        }}
      >
        <div className="flex justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/40 shadow-[0_0_24px_-4px_color-mix(in_oklab,var(--cyber-cyan)_70%,transparent)]">
            <Shield className="h-6 w-6" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center tracking-tight">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-muted-foreground text-center mt-1">
          {mode === "signin"
            ? "Sign in with any email to access your dashboard"
            : "Join ScamShield to report and review scams"}
        </p>

        <div className="grid grid-cols-2 gap-2 mt-6">
          <Button type="button" variant="secondary" onClick={() => oauth("google")}>
            Google
          </Button>
          <Button type="button" variant="secondary" onClick={() => oauth("apple")}>
            Apple
          </Button>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submitEmail} className="space-y-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Password (min 6)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-sm text-muted-foreground hover:text-foreground w-full text-center pt-1 transition-colors duration-200"
          >
            {mode === "signin"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

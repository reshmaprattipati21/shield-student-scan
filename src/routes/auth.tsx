import { createFileRoute, useRouter } from "@tanstack/react-router";
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

type Method = "email" | "phone";

function AuthPage() {
  const { user } = useAuth();
  const router = useRouter();
  const search = Route.useSearch();
  const [method, setMethod] = useState<Method>("email");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.navigate({ to: search.redirect });
  }, [user, router, search.redirect]);

  const submitEmail = async (e: React.FormEvent) => {
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

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      setOtpSent(true);
      toast.success("Code sent. Check your phone.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send code");
    } finally { setLoading(false); }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
      if (error) throw error;
      toast.success("Signed in");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally { setLoading(false); }
  };

  const oauth = async (provider: "google" | "apple") => {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/reports" });
    if (result.error) toast.error(`${provider} sign-in failed`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-8">
        <div className="flex justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary"><Shield className="h-6 w-6" /></div>
        </div>
        <h1 className="text-2xl font-bold text-center">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="text-sm text-muted-foreground text-center mt-1">{mode === "signin" ? "Sign in to access community reports" : "Join ScamShield to report and review scams"}</p>

        <div className="grid grid-cols-2 gap-2 mt-6">
          <Button type="button" variant="secondary" onClick={() => oauth("google")}>Google</Button>
          <Button type="button" variant="secondary" onClick={() => oauth("apple")}>Apple</Button>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
        </div>

        <div className="flex gap-1 p-1 rounded-md bg-muted mb-4">
          <button
            type="button"
            onClick={() => { setMethod("email"); setOtpSent(false); }}
            className={`flex-1 text-sm py-1.5 rounded ${method === "email" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >Email</button>
          <button
            type="button"
            onClick={() => { setMethod("phone"); setOtpSent(false); }}
            className={`flex-1 text-sm py-1.5 rounded ${method === "phone" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >Phone</button>
        </div>

        {method === "email" ? (
          <form onSubmit={submitEmail} className="space-y-3">
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Password (min 6)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
            <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-sm text-muted-foreground hover:text-foreground w-full text-center pt-1">
              {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </form>
        ) : !otpSent ? (
          <form onSubmit={sendOtp} className="space-y-3">
            <Input type="tel" placeholder="Phone (e.g. +15551234567)" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending…" : "Send code"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">Include country code with +</p>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-3">
            <Input type="text" inputMode="numeric" placeholder="6-digit code" value={otp} onChange={(e) => setOtp(e.target.value)} required />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying…" : "Verify & sign in"}
            </Button>
            <button type="button" onClick={() => { setOtpSent(false); setOtp(""); }} className="text-sm text-muted-foreground hover:text-foreground w-full text-center">
              Use a different number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

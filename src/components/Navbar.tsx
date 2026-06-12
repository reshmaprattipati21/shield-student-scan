import { Link, useRouter } from "@tanstack/react-router";
import { Shield, LogOut, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { ScanHistoryDrawer } from "@/components/ScanHistoryDrawer";

export function Navbar() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: "/auth" });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[color-mix(in_oklab,var(--cyber-cyan)_18%,transparent)] bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30 shadow-[0_0_16px_-2px_color-mix(in_oklab,var(--cyber-cyan)_50%,transparent)]">
            <Shield className="h-5 w-5" />
          </div>
          <span>Scam<span className="text-primary">Shield</span></span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link to="/url-checker" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition" activeProps={{ className: "px-3 py-2 text-sm text-primary" }}>
            URL
          </Link>
          <Link to="/text-scanner" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition" activeProps={{ className: "px-3 py-2 text-sm text-primary" }}>
            Message
          </Link>
          <Link to="/pdf-analyzer" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition" activeProps={{ className: "px-3 py-2 text-sm text-primary" }}>
            PDF
          </Link>
          <Link to="/reports" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition" activeProps={{ className: "px-3 py-2 text-sm text-primary" }}>
            Feed
          </Link>
          <ScanHistoryDrawer
            trigger={
              <button className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition inline-flex items-center gap-1.5">
                <History className="h-4 w-4" /> Scan History
              </button>
            }
          />
          {user ? (
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="ml-2">
              <LogOut className="h-4 w-4 mr-2" />Sign out
            </Button>
          ) : (
            <Button asChild size="sm" className="ml-2">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

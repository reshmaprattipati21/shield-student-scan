import {
  Link2,
  MessageSquareText,
  FileText,
  History,
  ShieldCheck,
  ShieldAlert,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useScanHistory, type ScanType } from "@/lib/scan-history";
import { useAuth } from "@/lib/auth-context";

const ICONS: Record<ScanType, typeof Link2> = {
  url: Link2,
  text: MessageSquareText,
  pdf: FileText,
};

const LABELS: Record<ScanType, string> = {
  url: "URL",
  text: "Message",
  pdf: "PDF",
};

function badgeFor(risk: string, score: number) {
  const r = risk.toLowerCase();
  if (r === "high")
    return {
      cls: "bg-destructive/15 text-destructive border-destructive/40",
      label: `${score}% High Risk`,
      Icon: ShieldAlert,
    };
  if (r === "medium-high")
    return {
      cls: "bg-orange-500/15 text-orange-300 border-orange-400/40",
      label: `${score}% Medium-High`,
      Icon: AlertTriangle,
    };
  if (r === "medium")
    return {
      cls: "bg-amber-500/15 text-amber-300 border-amber-400/40",
      label: `${score}% Medium`,
      Icon: Shield,
    };
  return {
    cls: "bg-emerald-500/15 text-emerald-300 border-emerald-400/40",
    label: `Safe`,
    Icon: ShieldCheck,
  };
}

export function ScanHistoryPanel() {
  const { user } = useAuth();
  const { items } = useScanHistory(12, user?.id);

  return (
    <aside
      className="rounded-2xl p-5 backdrop-blur-md"
      style={{
        background: "linear-gradient(160deg, rgba(19,28,46,0.92), rgba(11,15,25,0.88))",
        border: "1px solid color-mix(in oklab, var(--cyber-cyan) 30%, transparent)",
        boxShadow: "0 18px 50px -20px color-mix(in oklab, var(--cyber-cyan) 45%, transparent)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
          <History className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-semibold text-sm tracking-tight">Your Scan History</h3>
          <p className="text-xs text-muted-foreground">Recent scams caught across all modules</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          No scans yet. Run your first scan to start building your history.
        </div>
      ) : (
        <ul className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {items.map((it) => {
            const Icon = ICONS[it.scan_type] ?? Link2;
            const b = badgeFor(it.risk, it.score);
            return (
              <li
                key={it.id}
                className="flex items-center gap-3 rounded-xl p-3 transition-colors"
                style={{
                  background: "rgba(11,18,32,0.7)",
                  border: "1px solid color-mix(in oklab, var(--cyber-cyan) 16%, transparent)",
                }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs uppercase tracking-[0.18em] text-cyan-300/70">
                    {LABELS[it.scan_type]}
                  </div>
                  <div className="text-sm font-medium truncate" title={it.target}>
                    {it.target}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(it.created_at), { addSuffix: true })}
                  </div>
                  {it.flags && it.flags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {it.flags.map((f, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded border border-orange-400/40 bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-300"
                        >
                          <AlertTriangle className="h-2.5 w-2.5" /> {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${b.cls}`}
                >
                  <b.Icon className="h-3 w-3" /> {b.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

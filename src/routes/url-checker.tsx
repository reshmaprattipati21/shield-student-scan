import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Link2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { BackToDashboard } from "@/components/BackToDashboard";
import { CyberBg } from "@/components/CyberBg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadarRing } from "@/components/RadarRing";
import { RiskGauge } from "@/components/RiskGauge";
import { scanUrl, type UrlScan } from "@/lib/scan-engine";

export const Route = createFileRoute("/url-checker")({
  component: UrlChecker,
  head: () => ({ meta: [{ title: "URL Checker — ScamShield" }, { name: "description", content: "Paste a suspicious URL and get a risk score based on domain age and typosquatting checks." }] }),
});

function UrlChecker() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<UrlScan | null>(null);
  const [loading, setLoading] = useState(false);

  const onCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    setTimeout(() => { setResult(scanUrl(url.trim())); setLoading(false); }, 800);
  };

  return (
    <div>
      <CyberBg />
      <Navbar />
      <BackToDashboard />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-start justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Link2 className="h-5 w-5" /></div>
              <h1 className="text-3xl font-bold tracking-tight">URL Threat Scanner</h1>
            </div>
            <p className="text-muted-foreground">Paste a suspicious internship or job offer link. Live AI shielding active.</p>
          </div>
          <div className="hidden md:block"><RadarRing size={120} label="AI Shield" /></div>
        </div>

        <form onSubmit={onCheck} className="glass rounded-2xl p-6">
          <label className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">Target URL</label>
          <div className="mt-2 flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example-careers.xyz/intern-apply"
              className="flex-1"
            />
            <Button type="submit" disabled={loading} className="btn-neon-hover">
              {loading ? "Scanning…" : "Run scan"}
            </Button>
          </div>
        </form>

        {result && (
          <div className="mt-6 space-y-4">
            <div className="glass rounded-2xl px-5 py-3 flex items-center gap-3">
              <span className="text-xs uppercase tracking-[0.2em] text-cyan-300/80 shrink-0">Analyzed URL</span>
              <span className="text-sm font-mono text-foreground truncate" title={result.domain}>{result.domain}</span>
            </div>
            <div className="grid gap-6 md:grid-cols-[300px_1fr]">
              <div className="glass rounded-2xl p-6 flex items-center justify-center min-h-[220px]">
                <RiskGauge score={result.score} risk={result.risk} />
              </div>
              <div className="glass rounded-2xl p-6">
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-300/80 mb-3">Threat signals</div>
                <ul className="space-y-2">
                  {result.signals.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      {s.bad
                        ? <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        : <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />}
                      <span className={s.bad ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

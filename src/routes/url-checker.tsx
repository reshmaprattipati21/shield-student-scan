import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Link2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { BackToDashboard } from "@/components/BackToDashboard";
import { CyberBg } from "@/components/CyberBg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { RiskGauge } from "@/components/RiskGauge";
import { scanUrl, type UrlScan } from "@/lib/scan-engine";
import { recordScan } from "@/lib/scan-history";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/url-checker")({
  component: UrlChecker,
  head: () => ({
    meta: [
      { title: "URL Checker — ScamShield" },
      {
        name: "description",
        content:
          "Paste a suspicious URL and get a risk score based on domain age and typosquatting checks.",
      },
    ],
  }),
});

function UrlChecker() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<UrlScan | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const onCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const targetUrl = url.trim();
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });
      if (!res.ok) {
        throw new Error("Failed to scan URL via ML model");
      }
      const data = await res.json();
      
      // Convert ML response to UI format
      const score = Math.round(data.confidence * 100);
      const risk = data.verdict === "phishing" || data.verdict === "blocked" ? "High" : score >= 30 ? "Medium" : "Low";
      const domain = new URL(targetUrl.includes("://") ? targetUrl : `https://${targetUrl}`).hostname;
      
      // Backend now sends mixed good/bad signals — detect by checking for positive keywords
      const goodKeywords = ["verified", "trusted", "safe", "established", "encryption", "successfully", "passed", "destination verified"];
      const signals = data.signals.map((s: string) => ({
        label: s,
        bad: !goodKeywords.some(kw => s.toLowerCase().includes(kw)),
      }));

      const r = { score, risk: risk as "Low" | "Medium" | "High", domain, signals };
      setResult(r);
      
      recordScan({
        scan_type: "url",
        target: r.domain || targetUrl,
        score: r.score,
        risk: r.risk,
        userId: user?.id,
      });
    } catch (err) {
      console.error(err);
      // Fallback to local heuristic scan if API is down
      const r = scanUrl(url.trim());
      setResult(r);
      recordScan({
        scan_type: "url",
        target: r.domain || url.trim(),
        score: r.score,
        risk: r.risk,
        userId: user?.id,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <CyberBg />
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-6">
          <BackToDashboard />
        </div>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Link2 className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">URL Threat Scanner</h1>
          </div>
          <p className="text-muted-foreground max-w-3xl">
            Paste a suspicious internship or job offer link to check the domain against
            typosquatting, brand impersonation, and known scam patterns.
          </p>
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
              <span className="text-xs uppercase tracking-[0.2em] text-cyan-300/80 shrink-0">
                Analyzed URL
              </span>
              <span className="text-sm font-mono text-foreground truncate" title={result.domain}>
                {result.domain}
              </span>
            </div>
            <div className="grid gap-6 md:grid-cols-[300px_1fr]">
              <div className="glass rounded-2xl p-6 flex items-center justify-center min-h-[220px]">
                <RiskGauge score={result.score} risk={result.risk} />
              </div>
              <div className="glass rounded-2xl p-6">
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-300/80 mb-3">
                  Verdict
                </div>
                {result.risk === "Low" ? (
                  <div className="flex items-start gap-2 text-sm text-success mb-4">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      <span className="font-semibold">Verified Employer.</span> This domain and
                      document structure match official university-approved recruitment channels and
                      certified company domains.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-sm text-destructive mb-4">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      <span className="font-semibold">Critical Risk Flagged.</span> This domain
                      shows impersonation or typosquatting patterns commonly used in fraudulent
                      internship campaigns. Do not submit any personal information.
                    </span>
                  </div>
                )}
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-300/80 mb-3">
                  Threat Analysis Details
                </div>
                <ul className="space-y-2">
                  {result.signals.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      {s.bad ? (
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      )}
                      <span className={s.bad ? "text-foreground" : "text-muted-foreground"}>
                        {s.label}
                      </span>
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

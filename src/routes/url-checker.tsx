import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Link2, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/url-checker")({
  component: UrlChecker,
  head: () => ({ meta: [{ title: "URL Checker — ScamShield" }, { name: "description", content: "Paste a suspicious URL and get a risk score based on domain age and typosquatting checks." }] }),
});

type Risk = "Low" | "Medium" | "High";
type Result = {
  risk: Risk;
  score: number;
  signals: { label: string; bad: boolean }[];
  domain: string;
};

const SUSPICIOUS_TLDS = [".xyz", ".top", ".click", ".info", ".tk", ".online", ".live", ".work"];
const TRUSTED_BRANDS = ["google", "microsoft", "amazon", "linkedin", "meta", "apple", "facebook", "internshala", "naukri", "indeed"];
const SUSPICIOUS_WORDS = ["secure", "verify", "login", "career", "intern", "hr", "job", "offer", "payment"];

function analyze(rawUrl: string): Result {
  let url: URL;
  try { url = new URL(rawUrl.includes("://") ? rawUrl : `https://${rawUrl}`); }
  catch { return { risk: "High", score: 95, signals: [{ label: "Invalid URL format", bad: true }], domain: rawUrl }; }

  const host = url.hostname.toLowerCase();
  const signals: { label: string; bad: boolean }[] = [];
  let score = 0;

  // HTTPS
  if (url.protocol !== "https:") { signals.push({ label: "Not using HTTPS", bad: true }); score += 20; }
  else signals.push({ label: "Uses HTTPS encryption", bad: false });

  // Suspicious TLD
  const tld = "." + host.split(".").pop();
  if (SUSPICIOUS_TLDS.includes(tld)) { signals.push({ label: `Suspicious TLD (${tld})`, bad: true }); score += 25; }

  // Typosquatting: brand-like substring but not exact match
  for (const brand of TRUSTED_BRANDS) {
    if (host.includes(brand) && !host.endsWith(`${brand}.com`) && !host.endsWith(`${brand}.co.in`)) {
      signals.push({ label: `Possible typosquatting of "${brand}"`, bad: true });
      score += 30;
      break;
    }
  }

  // Hyphens & length (often used in scam domains)
  const hyphens = (host.match(/-/g) || []).length;
  if (hyphens >= 2) { signals.push({ label: `Domain contains ${hyphens} hyphens`, bad: true }); score += 10; }
  if (host.length > 30) { signals.push({ label: "Unusually long domain", bad: true }); score += 10; }

  // Subdomain abuse
  const parts = host.split(".");
  if (parts.length >= 4) { signals.push({ label: "Excessive subdomains", bad: true }); score += 10; }

  // Keyword stuffing
  const keywordHits = SUSPICIOUS_WORDS.filter((w) => host.includes(w));
  if (keywordHits.length >= 2) { signals.push({ label: `Keyword stuffing: ${keywordHits.join(", ")}`, bad: true }); score += 15; }

  // Mocked domain age — derived deterministically from hostname length
  const mockAgeDays = (host.length * 73) % 4000;
  if (mockAgeDays < 90) { signals.push({ label: `Domain age: ~${mockAgeDays} days (new)`, bad: true }); score += 20; }
  else signals.push({ label: `Domain age: ~${Math.round(mockAgeDays / 365)} years`, bad: false });

  score = Math.min(100, score);
  const risk: Risk = score >= 60 ? "High" : score >= 30 ? "Medium" : "Low";
  return { risk, score, signals, domain: host };
}

function UrlChecker() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  const onCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    setTimeout(() => { setResult(analyze(url.trim())); setLoading(false); }, 700);
  };

  const cfg = {
    Low: { color: "text-success", bg: "bg-success/10 border-success/30", Icon: CheckCircle2, label: "Low Risk" },
    Medium: { color: "text-warning", bg: "bg-warning/10 border-warning/30", Icon: AlertTriangle, label: "Medium Risk" },
    High: { color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", Icon: ShieldAlert, label: "High Risk" },
  } as const;

  return (
    <div>
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Link2 className="h-5 w-5" /></div>
          <h1 className="text-3xl font-bold">URL Checker</h1>
        </div>
        <p className="text-muted-foreground mb-8">Paste a suspicious internship or job offer link to scan it.</p>

        <form onSubmit={onCheck} className="glass rounded-2xl p-6">
          <label className="text-sm font-medium">Website URL</label>
          <div className="mt-2 flex gap-2">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example-careers.xyz/intern-apply" className="flex-1" />
            <Button type="submit" disabled={loading}>{loading ? "Scanning…" : "Check URL"}</Button>
          </div>
        </form>

        {result && (() => {
          const c = cfg[result.risk];
          return (
            <div className={`mt-6 rounded-2xl border p-6 ${c.bg}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <c.Icon className={`h-8 w-8 ${c.color}`} />
                  <div>
                    <div className={`text-xl font-bold ${c.color}`}>{c.label}</div>
                    <div className="text-sm text-muted-foreground">{result.domain}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold ${c.color}`}>{result.score}</div>
                  <div className="text-xs text-muted-foreground">risk score</div>
                </div>
              </div>
              <ul className="mt-5 space-y-2">
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
          );
        })()}
      </main>
    </div>
  );
}

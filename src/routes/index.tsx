import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Link2, MessageSquareText, Users, FileText, Activity, ArrowRight, Building2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { CyberBg } from "@/components/CyberBg";
import { Button } from "@/components/ui/button";
import { RadarRing } from "@/components/RadarRing";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "ScamShield — Cyber Command Center for Job Scam Detection" },
      { name: "description", content: "Detect fake internships and job scams: URL threat scanner, message analyzer, offer letter PDF scanner, and live community fraud feed." },
    ],
  }),
});

type Feed = { id: string; company_name: string; platform: string; created_at: string };

function Index() {
  const [tab, setTab] = useState<"overview" | "scan" | "feed">("overview");
  const [feed, setFeed] = useState<Feed[]>([]);

  useEffect(() => {
    supabase.from("scam_reports").select("id, company_name, platform, created_at").order("created_at", { ascending: false }).limit(8)
      .then(({ data }) => setFeed(data ?? []));
  }, []);

  return (
    <div>
      <CyberBg />
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pb-20">
        {/* Hero */}
        <section className="pt-14 pb-10">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-cyan-200/90">
                <Activity className="h-3.5 w-3.5 text-primary animate-pulse" /> AI Shield · online
              </div>
              <h1 className="mt-5 text-5xl md:text-6xl font-bold tracking-tight">
                Cyber Command Center<br />
                <span className="bg-gradient-to-r from-primary to-[#22D3EE] bg-clip-text text-transparent">for Job Scam Detection.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
                Scan suspicious links, decode shady messages, x-ray offer letter PDFs, and tap into a live community fraud feed — all from one neon-lit dashboard.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="lg" className="btn-neon-hover"><Link to="/url-checker">Run a scan <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                <Button asChild size="lg" variant="secondary" className="btn-neon-hover"><Link to="/reports">View fraud feed</Link></Button>
              </div>
            </div>
            <div className="hidden md:block"><RadarRing size={180} label="Threat radar" /></div>
          </div>
        </section>

        {/* Tabs */}
        <div className="glass rounded-2xl p-1.5 inline-flex gap-1 mb-6">
          {(["overview", "scan", "feed"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm rounded-xl transition-all duration-500 ${
                tab === t
                  ? "bg-primary/15 text-primary ring-1 ring-primary/40 shadow-[0_0_18px_-4px_color-mix(in_oklab,var(--cyber-cyan)_60%,transparent)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "overview" ? "Overview" : t === "scan" ? "Scan Hub" : "Reports Feed"}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <section className="grid gap-6 md:grid-cols-3">
            <MetricCard icon={Shield} label="Detection accuracy" value="98%" tone="green" />
            <MetricCard icon={Activity} label="Live scans today" value="1,247" tone="cyan" />
            <MetricCard icon={Building2} label="Community reports" value={String(feed.length || 0) + "+"} tone="amber" />
            <FeatureCard icon={Link2} title="URL Threat Scanner" desc="Domain age, typosquatting, TLD spoofing — instant risk score." to="/url-checker" />
            <FeatureCard icon={MessageSquareText} title="Offer Message Analyzer" desc="Inline-highlights scam phrasing in WhatsApp / Telegram / email." to="/text-scanner" />
            <FeatureCard icon={FileText} title="Offer Letter PDF X-Ray" desc="Drag & drop a PDF — flags risky clauses and bogus fees." to="/pdf-analyzer" />
          </section>
        )}

        {tab === "scan" && (
          <section className="grid gap-6 md:grid-cols-3">
            <FeatureCard icon={Link2} title="URL Threat Scanner" desc="Animated risk gauge with critical-token detection." to="/url-checker" />
            <FeatureCard icon={MessageSquareText} title="Message Analyzer" desc="Glowing inline highlights of scam phrases." to="/text-scanner" />
            <FeatureCard icon={FileText} title="PDF Offer Letter" desc="Loading orbit while scanning document rules." to="/pdf-analyzer" />
          </section>
        )}

        {tab === "feed" && (
          <section className="glass rounded-2xl p-4 max-h-[70vh] overflow-y-auto">
            {feed.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">No community reports yet.</p>
            ) : (
              <ul className="divide-y divide-cyan-400/10">
                {feed.map((r) => (
                  <li key={r.id} className="p-4 flex items-center justify-between gap-3 hover:bg-cyan-400/5 transition-all duration-500">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center shrink-0"><Building2 className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{r.company_name}</div>
                        <div className="text-xs text-muted-foreground">on {r.platform} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</div>
                      </div>
                    </div>
                    <Link to="/reports" className="text-xs text-primary hover:underline">Open feed →</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc, to }: { icon: typeof Shield; title: string; desc: string; to: string }) {
  return (
    <Link to={to} className="group glass rounded-2xl p-6 transition-all duration-500 hover:-translate-y-1 hover:border-[color-mix(in_oklab,var(--cyber-cyan)_70%,transparent)] hover:shadow-[0_20px_50px_-20px_color-mix(in_oklab,var(--cyber-cyan)_60%,transparent)]">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-semibold text-lg">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
      <div className="mt-4 inline-flex items-center text-sm text-primary group-hover:gap-2 gap-1 transition-all">
        Launch <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: typeof Shield; label: string; value: string; tone: "green" | "cyan" | "amber" }) {
  const toneClass = tone === "green" ? "text-glow-green" : tone === "amber" ? "text-glow-amber" : "text-primary";
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-cyan-300/80">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className={`mt-3 text-4xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

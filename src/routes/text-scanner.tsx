import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MessageSquareText, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/text-scanner")({
  component: TextScanner,
  head: () => ({ meta: [{ title: "Text Scanner — ScamShield" }, { name: "description", content: "Paste WhatsApp, Telegram or email text to flag scam language." }] }),
});

const RULES: { phrase: string; weight: number; reason: string }[] = [
  { phrase: "pay upfront", weight: 30, reason: "Asks for upfront payment" },
  { phrase: "registration fee", weight: 25, reason: "Charges a registration fee" },
  { phrase: "security deposit", weight: 25, reason: "Asks for a security deposit" },
  { phrase: "deposit required", weight: 25, reason: "Requires a deposit" },
  { phrase: "crypto payment", weight: 30, reason: "Requests crypto payment" },
  { phrase: "bitcoin", weight: 20, reason: "Mentions Bitcoin payment" },
  { phrase: "usdt", weight: 20, reason: "Mentions USDT (crypto)" },
  { phrase: "telegram task", weight: 30, reason: "Classic 'Telegram task' scam pattern" },
  { phrase: "join our telegram", weight: 15, reason: "Redirects to Telegram group" },
  { phrase: "whatsapp +", weight: 10, reason: "Anonymous WhatsApp contact" },
  { phrase: "work from home guaranteed", weight: 20, reason: "Unrealistic WFH guarantee" },
  { phrase: "earn ₹", weight: 15, reason: "Guaranteed earnings claim" },
  { phrase: "earn rs", weight: 15, reason: "Guaranteed earnings claim" },
  { phrase: "earn daily", weight: 15, reason: "Daily earning promise" },
  { phrase: "no experience required", weight: 10, reason: "No-experience high-pay claim" },
  { phrase: "limited slots", weight: 10, reason: "Artificial urgency" },
  { phrase: "act fast", weight: 10, reason: "Pressure tactic" },
  { phrase: "selected for internship", weight: 10, reason: "Unsolicited selection notice" },
  { phrase: "share your aadhaar", weight: 25, reason: "Asks for sensitive personal ID" },
  { phrase: "send your bank", weight: 25, reason: "Asks for bank details" },
];

type Hit = { phrase: string; reason: string; weight: number };

function scan(text: string) {
  const lower = text.toLowerCase();
  const hits: Hit[] = [];
  let score = 0;
  for (const r of RULES) {
    if (lower.includes(r.phrase)) { hits.push(r); score += r.weight; }
  }
  score = Math.min(100, score);
  const risk: "Low" | "Medium" | "High" = score >= 50 ? "High" : score >= 20 ? "Medium" : "Low";
  return { risk, score, hits };
}

function TextScanner() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ReturnType<typeof scan> | null>(null);

  const onScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setResult(scan(text));
  };

  const cfg = {
    Low: { color: "text-success", bg: "bg-success/10 border-success/30", Icon: CheckCircle2, label: "Looks Safe" },
    Medium: { color: "text-warning", bg: "bg-warning/10 border-warning/30", Icon: AlertTriangle, label: "Be Cautious" },
    High: { color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", Icon: ShieldAlert, label: "Likely Scam" },
  } as const;

  return (
    <div>
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><MessageSquareText className="h-5 w-5" /></div>
          <h1 className="text-3xl font-bold">Text Scanner</h1>
        </div>
        <p className="text-muted-foreground mb-8">Paste a message from WhatsApp, Telegram, or email to scan for scam indicators.</p>

        <form onSubmit={onScan} className="glass rounded-2xl p-6">
          <label className="text-sm font-medium">Message text</label>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="Paste the suspicious message here…" className="mt-2 resize-none" />
          <Button type="submit" className="mt-4">Scan message</Button>
        </form>

        {result && (() => {
          const c = cfg[result.risk];
          return (
            <div className={`mt-6 rounded-2xl border p-6 ${c.bg}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <c.Icon className={`h-8 w-8 ${c.color}`} />
                  <div className={`text-xl font-bold ${c.color}`}>{c.label}</div>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold ${c.color}`}>{result.score}</div>
                  <div className="text-xs text-muted-foreground">risk score</div>
                </div>
              </div>
              {result.hits.length === 0 ? (
                <p className="mt-5 text-sm text-muted-foreground">No known scam phrases detected. Still verify the sender independently.</p>
              ) : (
                <>
                  <div className="mt-5 text-sm font-medium">Flagged signals ({result.hits.length})</div>
                  <ul className="mt-2 space-y-2">
                    {result.hits.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        <span><span className="font-medium">{h.reason}</span> <span className="text-muted-foreground">— matched "{h.phrase}"</span></span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          );
        })()}
      </main>
    </div>
  );
}

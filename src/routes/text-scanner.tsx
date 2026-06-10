import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MessageSquareText, AlertTriangle } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { BackToDashboard } from "@/components/BackToDashboard";
import { CyberBg } from "@/components/CyberBg";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { RiskGauge } from "@/components/RiskGauge";
import { scanText, type TextScan } from "@/lib/scan-engine";

export const Route = createFileRoute("/text-scanner")({
  component: TextScanner,
  head: () => ({ meta: [{ title: "Text Scanner — ScamShield" }, { name: "description", content: "Paste WhatsApp, Telegram or email text to flag scam language." }] }),
});

function Highlighted({ text, hits }: { text: string; hits: TextScan["hits"] }) {
  const segments = useMemo(() => {
    if (!hits.length) return [{ text, hit: false }];
    const sorted = [...hits].sort((a, b) => a.index - b.index);
    const out: { text: string; hit: boolean }[] = [];
    let cursor = 0;
    for (const h of sorted) {
      if (h.index < cursor) continue; // overlap, skip
      if (h.index > cursor) out.push({ text: text.slice(cursor, h.index), hit: false });
      out.push({ text: text.slice(h.index, h.index + h.length), hit: true });
      cursor = h.index + h.length;
    }
    if (cursor < text.length) out.push({ text: text.slice(cursor), hit: false });
    return out;
  }, [text, hits]);

  return (
    <div className="glass rounded-2xl p-5 text-sm whitespace-pre-wrap leading-relaxed">
      {segments.map((s, i) =>
        s.hit ? <span key={i} className="scam-hit">{s.text}</span> : <span key={i}>{s.text}</span>
      )}
    </div>
  );
}

function TextScanner() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<TextScan | null>(null);

  const onScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setResult(scanText(text));
  };

  return (
    <div>
      <CyberBg />
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-6"><BackToDashboard /></div>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><MessageSquareText className="h-5 w-5" /></div>
            <h1 className="text-3xl font-bold tracking-tight">Offer Message Analyzer</h1>
          </div>
          <p className="text-muted-foreground max-w-3xl">Paste a recruiter message from WhatsApp, Telegram, SMS, or email to flag scam phrasing, upfront payment requests, and pressure tactics.</p>
        </div>

        <form onSubmit={onScan} className="glass rounded-2xl p-6">
          <label className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">Message body</label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Paste the suspicious message here…"
            className="mt-2 resize-none"
          />
          <Button type="submit" className="mt-4 btn-neon-hover">Scan message</Button>
        </form>

        {result && (
          <div className="mt-6 grid gap-6 md:grid-cols-[300px_1fr]">
            <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center">
              <RiskGauge score={result.score} risk={result.risk} />
              <div className="mt-3 text-xs text-muted-foreground uppercase tracking-[0.2em]">{result.hits.length} signal(s)</div>
            </div>
            <div className="space-y-4">
              <div className="glass rounded-2xl p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-300/80 mb-2">Verdict</div>
                {result.hits.length === 0 ? (
                  <div className="flex items-start gap-2 text-sm text-success">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 opacity-0" />
                    <span><span className="font-semibold">Verified Employer.</span> This message uses language consistent with legitimate, university-approved recruitment channels.</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span><span className="font-semibold">Critical Risk Flagged.</span> The message requests an upfront security deposit for hardware or training, which violates standard corporate recruitment policies.</span>
                  </div>
                )}
              </div>
              <Highlighted text={text} hits={result.hits} />
              {result.hits.length > 0 && (
                <div className="glass rounded-2xl p-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-cyan-300/80 mb-3">Flagged phrases</div>
                  <ul className="space-y-2">
                    {result.hits.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        <span><span className="font-medium">{h.reason}</span> <span className="text-muted-foreground">— "{h.phrase}"</span></span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

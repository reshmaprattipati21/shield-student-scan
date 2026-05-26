import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Bot, MessageSquare, Send, ShieldAlert, X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chatAssistant } from "@/lib/chat.functions";

type Msg = {
  id: string;
  role: "user" | "bot";
  content: string;
  danger?: boolean;
  ts: number;
};

const SCAM_KEYWORDS: { keywords: string[]; label: string }[] = [
  { keywords: ["urgent payment", "pay urgently", "pay now", "pay immediately"], label: "urgent payment" },
  { keywords: ["work from home scam", "wfh guaranteed", "work from home guaranteed"], label: "work-from-home scam" },
  { keywords: ["unrealistic salary", "earn ₹", "earn rs", "earn daily", "earn $500 a day", "lakhs per month guaranteed"], label: "unrealistic salary" },
  { keywords: ["no company website", "no website", "can't find website"], label: "no company website" },
  { keywords: ["fake certificate", "certificate scam", "buy certificate"], label: "fake certificate" },
  { keywords: ["pay upfront", "send money", "transfer money", "pay money", "paying money"], label: "upfront payment" },
  { keywords: ["telegram task", "telegram job", "telegram recruiter", "join telegram"], label: "Telegram task" },
  { keywords: ["deposit", "security deposit", "refundable deposit", "registration fee", "processing fee", "training fee", "kyc fee"], label: "deposit / fee" },
  { keywords: ["whatsapp recruiter", "whatsapp hr", "whatsapp +", "whatsapp job", "whatsapp offer"], label: "WhatsApp recruiter" },
  { keywords: ["crypto", "usdt", "bitcoin", "wallet payment", "crypto payout"], label: "crypto payout" },
];

function detectThreats(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const t of SCAM_KEYWORDS) {
    if (t.keywords.some((k) => lower.includes(k))) hits.push(t.label);
  }
  return Array.from(new Set(hits));
}

function dangerReply(threats: string[]): string {
  const list = threats.map((t) => `• ${t}`).join("\n");
  return (
    `🚨 HIGH RISK DETECTED — this matches known scam patterns (${threats.join(", ")}).\n\n` +
    `Legitimate employers never ask candidates for money, deposits, KYC fees, crypto payouts, or to perform "tasks" on Telegram/WhatsApp.\n\n` +
    `Threat signals:\n${list}\n\n` +
    `Immediate steps:\n` +
    `1. Do NOT pay anything. Stop all transfers.\n` +
    `2. Stop sharing personal data (Aadhaar, PAN, bank, OTPs).\n` +
    `3. Screenshot the chat, recruiter profile, and any links.\n` +
    `4. Block and report the contact on the platform.\n` +
    `5. Run the URL/message through ScamShield's URL Checker & Text Scanner.\n` +
    `6. Report it on ScamShield's Crowdsourced Reports so other students are warned.\n` +
    `7. If money was sent in India, file at cybercrime.gov.in or call 1930 within 24h.`
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const QUICK_ACTIONS = [
  { label: "Verify Internship", prompt: "How do I verify if an internship offer is real?", route: "/url-checker" as const },
  { label: "Detect Fake News", prompt: "How do I identify fake news articles?" },
  { label: "Report Scam", prompt: "I want to report a scam I received.", route: "/reports" as const },
  { label: "Help", prompt: "What can you help me with?" },
];

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const callChat = useServerFn(chatAssistant);
  const navigate = useNavigate();

  // Initialize welcome message client-side only to avoid SSR hydration mismatch on timestamps
  useEffect(() => {
    setMessages([
      {
        id: uid(),
        role: "bot",
        ts: Date.now(),
        content:
          "👋 Hi! I'm ScamShield AI — your security assistant.\n\nAsk me about a job offer, a recruiter message, a news article, or paste anything suspicious. I'll help you spot scams and fake news.",
      },
    ]);
  }, []);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, sending]);

  const send = async (textArg?: string) => {
    const text = (textArg ?? input).trim();
    if (!text || sending) return;
    setInput("");

    const userMsg: Msg = { id: uid(), role: "user", content: text, ts: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);

    const threats = detectThreats(text);
    if (threats.length > 0) {
      setMessages((m) => [
        ...m,
        { id: uid(), role: "bot", danger: true, ts: Date.now(), content: dangerReply(threats) },
      ]);
      return;
    }

    setSending(true);
    try {
      const history = next.slice(-12).map((m) => ({
        role: m.role === "bot" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      }));
      const result = await callChat({ data: { messages: history } });
      if (result.ok) {
        setMessages((m) => [...m, { id: uid(), role: "bot", ts: Date.now(), content: result.reply }]);
      } else {
        setMessages((m) => [
          ...m,
          { id: uid(), role: "bot", ts: Date.now(), content: `⚠️ ${result.error}` },
        ]);
      }
    } catch (err) {
      console.error(err);
      setMessages((m) => [
        ...m,
        { id: uid(), role: "bot", ts: Date.now(), content: "⚠️ I couldn't reach the assistant. Check your connection and try again." },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open ScamShield AI Assistant"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full glass flex items-center justify-center text-primary btn-neon-hover"
        style={{
          boxShadow:
            "0 0 0 1px color-mix(in oklab, var(--cyber-cyan) 55%, transparent), 0 0 28px color-mix(in oklab, var(--cyber-cyan) 55%, transparent)",
        }}
      >
        <span
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, color-mix(in oklab, var(--cyber-cyan) 35%, transparent) 0%, transparent 70%)",
            animation: "pulseGlowGreen 2s ease-in-out infinite",
          }}
        />
        {open ? <X className="relative z-10 h-6 w-6" /> : <MessageSquare className="relative z-10 h-6 w-6" />}
      </button>

      {/* Chat window */}
      {open && (
        <div
          className="fixed bottom-24 right-4 sm:right-6 z-50 w-[min(400px,calc(100vw-2rem))] h-[min(620px,calc(100vh-8rem))] glass rounded-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300"
          style={{
            boxShadow:
              "0 0 0 1px color-mix(in oklab, var(--cyber-cyan) 35%, transparent), 0 20px 60px -20px color-mix(in oklab, var(--cyber-cyan) 45%, transparent)",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[color-mix(in_oklab,var(--cyber-cyan)_20%,transparent)]">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-primary/15 text-primary ring-1 ring-primary/40">
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                ScamShield AI <Sparkles className="h-3 w-3 text-primary" />
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Online · scam &amp; fake-news engine
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollerRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={[
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-primary/15 text-foreground border border-primary/30"
                      : m.danger
                        ? "border text-foreground"
                        : "bg-muted/40 text-foreground border border-border",
                  ].join(" ")}
                  style={
                    m.danger
                      ? {
                          background: "color-mix(in oklab, var(--cyber-crimson) 14%, transparent)",
                          borderColor: "color-mix(in oklab, var(--cyber-crimson) 55%, transparent)",
                          boxShadow: "0 0 24px color-mix(in oklab, var(--cyber-crimson) 28%, transparent)",
                        }
                      : undefined
                  }
                >
                  {m.danger && (
                    <div className="flex items-center gap-1.5 mb-1.5 text-xs font-semibold text-glow-red">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      SECURITY ALERT
                    </div>
                  )}
                  {m.content}
                </div>
                <div className="text-[10px] text-muted-foreground/60 mt-1 px-1">{formatTime(m.ts)}</div>
              </div>
            ))}

            {sending && (
              <div className="flex items-start">
                <div className="bg-muted/40 border border-border rounded-2xl px-3.5 py-2.5 text-[13px] inline-flex items-center gap-2 text-muted-foreground">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                  Analyzing…
                </div>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="px-3 pb-2 flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.label}
                disabled={sending}
                onClick={() => {
                  if (a.route) navigate({ to: a.route });
                  send(a.prompt);
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg border border-[color-mix(in_oklab,var(--cyber-cyan)_30%,transparent)] text-cyan-200/90 hover:bg-primary/10 hover:border-primary/60 transition disabled:opacity-50"
              >
                {a.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 pt-1 border-t border-[color-mix(in_oklab,var(--cyber-cyan)_20%,transparent)]">
            <div className="glass-input rounded-xl flex items-center gap-2 px-3 py-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask about a job, news article, or paste a message…"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/70"
                disabled={sending}
              />
              <Button size="icon" onClick={() => send()} disabled={!input.trim() || sending} className="h-8 w-8 rounded-lg">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <div className="mt-1.5 text-[10px] text-muted-foreground/70 text-center">
              AI-assisted · always verify before acting on suggestions
            </div>
          </div>
        </div>
      )}
    </>
  );
}

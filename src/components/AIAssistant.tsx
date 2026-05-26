import { useEffect, useRef, useState } from "react";
import { Bot, MessageSquare, Send, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Msg = { role: "user" | "bot"; content: string; danger?: boolean };

const TRIGGERS: { keywords: string[]; label: string }[] = [
  { keywords: ["pay money", "paying money", "pay upfront", "send money", "transfer money"], label: "upfront payment" },
  { keywords: ["telegram task", "telegram job", "telegram recruiter", "join telegram"], label: "Telegram task" },
  { keywords: ["deposit", "security deposit", "refundable deposit", "registration fee", "processing fee", "training fee", "kyc fee"], label: "deposit / fee" },
  { keywords: ["whatsapp recruiter", "whatsapp hr", "whatsapp +", "whatsapp job", "whatsapp offer"], label: "WhatsApp recruiter" },
  { keywords: ["crypto", "usdt", "bitcoin", "wallet payment", "crypto payout"], label: "crypto payout" },
];

function detectThreats(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const t of TRIGGERS) {
    if (t.keywords.some((k) => lower.includes(k))) hits.push(t.label);
  }
  return Array.from(new Set(hits));
}

function buildReply(text: string): Msg {
  const threats = detectThreats(text);
  if (threats.length > 0) {
    const list = threats.map((t) => `• ${t}`).join("\n");
    return {
      role: "bot",
      danger: true,
      content:
        `🚨 HIGH RISK DETECTED — this matches a known scam pattern (${threats.join(", ")}).\n\n` +
        `Legitimate employers NEVER ask candidates for money, deposits, KYC fees, crypto payouts, or to perform "tasks" on Telegram/WhatsApp.\n\n` +
        `Threat signals:\n${list}\n\n` +
        `Immediate steps:\n` +
        `1. Do NOT pay anything. Stop all transfers.\n` +
        `2. Stop sharing personal data (Aadhaar, PAN, bank, OTPs).\n` +
        `3. Screenshot the chat, recruiter profile, and any links.\n` +
        `4. Block and report the contact on the platform.\n` +
        `5. Run the URL/message through ScamShield's URL Checker & Text Scanner.\n` +
        `6. Report on ScamShield's Crowdsourced Reports so other students are warned.\n` +
        `7. If money was sent in India, file at cybercrime.gov.in or call 1930 within 24h.`,
    };
  }
  const lower = text.toLowerCase();
  if (/(hello|hi|hey)\b/.test(lower)) {
    return { role: "bot", content: "Hi! I'm the ScamShield AI Assistant. Paste any suspicious job offer, recruiter message, or URL and I'll assess the risk." };
  }
  if (lower.includes("how") && lower.includes("verify")) {
    return {
      role: "bot",
      content:
        "To verify a job offer:\n• Check the company's official careers page (not a link the recruiter sent).\n• Confirm the recruiter on LinkedIn with a real history.\n• Reject any offer requiring upfront payment.\n• Run the URL through the URL Checker and the message through the Text Scanner.",
    };
  }
  return {
    role: "bot",
    content:
      "No critical scam keywords found in that snippet. Still treat unknown offers cautiously — verify the company via official channels, never pay to be hired, and never share OTPs or bank details. Want me to scan a specific URL or message? Paste it here.",
  };
}

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "bot",
      content:
        "👋 I'm ScamShield AI. Ask me about a job offer, paste a recruiter message, or describe what they're asking for. I'll flag scam patterns instantly.",
    },
  ]);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const userMsg: Msg = { role: "user", content: text };
    const reply = buildReply(text);
    setMessages((m) => [...m, userMsg, reply]);
    setInput("");
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
          className="absolute inset-0 rounded-full"
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
          className="fixed bottom-24 right-6 z-50 w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-8rem))] glass rounded-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300"
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
              <div className="text-sm font-semibold text-foreground">ScamShield AI Assistant</div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Online · threat engine active
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
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
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
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[color-mix(in_oklab,var(--cyber-cyan)_20%,transparent)]">
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
                placeholder="Ask about a job offer or paste a message…"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/70"
              />
              <Button size="icon" onClick={send} disabled={!input.trim()} className="h-8 w-8 rounded-lg">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-1.5 text-[10px] text-muted-foreground/70 text-center">
              Rule-based threat detection · not a replacement for human judgment
            </div>
          </div>
        </div>
      )}
    </>
  );
}

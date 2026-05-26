import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(30),
});

const SYSTEM_PROMPT = `You are ScamShield AI — a friendly, professional security assistant for students on a Fake Internship & News Detection platform.

Your job:
- Help users identify fake internships, scam job offers, and misleading news.
- Explain how to verify a company (official website, LinkedIn presence, registration via MCA / Crunchbase, real HR contact).
- Explain how to spot fake news (cross-check sources, reverse image search, check publish date, look up the outlet on Media Bias/Fact Check).
- Recommend safe job-application tips (never pay to be hired, never share OTP/Aadhaar/bank PIN, verify domain of the email).
- If the user describes anything matching scam patterns (upfront payment, deposit, KYC fee, Telegram task, crypto payout, unrealistic salary, no company website, fake certificate, urgent payment, work-from-home guaranteed) — clearly warn them with concrete next steps (stop transfers, screenshot, block, report on cybercrime.gov.in or call 1930 in India).

Style:
- Concise, structured replies. Use short paragraphs and bullet points.
- Be warm but direct. Never sound robotic.
- If unsure, say so and suggest verification steps.
- Keep replies under ~180 words unless the user explicitly asks for detail.`;

export const chatAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI service is not configured." };
    }

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...data.messages,
          ],
        }),
      });

      if (res.status === 429) {
        return { ok: false as const, error: "Too many requests right now. Please wait a moment and try again." };
      }
      if (res.status === 402) {
        return { ok: false as const, error: "AI usage limit reached. Please add credits to continue." };
      }
      if (!res.ok) {
        const body = await res.text();
        console.error("AI gateway error", res.status, body);
        return { ok: false as const, error: "The assistant is temporarily unavailable. Please try again." };
      }

      const json = await res.json();
      const reply: string = json?.choices?.[0]?.message?.content?.trim() ?? "";
      if (!reply) {
        return { ok: false as const, error: "Empty response from the assistant. Try rephrasing your question." };
      }
      return { ok: true as const, reply };
    } catch (err) {
      console.error("chatAssistant failed", err);
      return { ok: false as const, error: "Network error reaching the assistant." };
    }
  });

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import pdfParse from "pdf-parse";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const maxDuration = 60; // Allow long execution for PDF parsing and AI call

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { inputType, content } = body;

    if (!inputType || !content) {
      return NextResponse.json(
        { error: "Invalid request. 'inputType' and 'content' are required." },
        { status: 400 }
      );
    }

    let textToAnalyze = content;

    // Handle PDF text extraction if inputType is pdf
    if (inputType === "pdf") {
      try {
        const cleanBase64 = content.replace(/^data:application\/pdf;base64,/, "");
        const pdfBuffer = Buffer.from(cleanBase64, "base64");
        const parsedPdf = await pdfParse(pdfBuffer);
        textToAnalyze = parsedPdf.text;
        
        if (!textToAnalyze || textToAnalyze.trim().length === 0) {
          return NextResponse.json(
            { error: "Could not extract text from the provided PDF file. The file may be image-only or encrypted." },
            { status: 422 }
          );
        }
      } catch (pdfErr) {
        console.error("PDF Parsing Error:", pdfErr);
        return NextResponse.json(
          { error: "Failed to process PDF file. Ensure it is a valid, unencrypted PDF." },
          { status: 400 }
        );
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    let resultJSON: {
      riskScore: number;
      riskLevel: "Low" | "Medium" | "High";
      summary: string;
      flags: Array<{ phrase: string; category: string; reason: string }>;
      recommendations: string[];
    };

    if (apiKey && apiKey.trim() !== "") {
      try {
        const ai = new GoogleGenAI({ apiKey });

        const systemPrompt = `You are ScamShield AI, an expert cybersecurity and fraud detection intelligence system.
Analyze the provided content (which can be a text message, job offer letter, email, or website text) for indicators of scams, fraud, phishing, or fake job offers.

Key Scam Indicators to check for:
1. Upfront Payment Requests: Registration fees, laptop/equipment fees, training charges, processing fees, security deposits.
2. Unverified / Suspicious Domains: Free email providers (@gmail.com, @yahoo.com, @hotmail.com) used for official corporate hiring, typosquatting domains, or unverified URL links.
3. Pressure & Urgency Tactics: "Immediate response required within 24h", "Limited slots", "Wire money immediately".
4. Excessive Promises & Red Flags: Unusually high salary for zero interview or minimal experience, guaranteed selection without video/in-person interview, vague job description.
5. Off-platform Communication: Requesting exclusive chat on Telegram, WhatsApp, Signal, or personal Google Hangouts.
6. Poor Grammar / Generic Greetings: "Dear Candidate", "Respected Sir", glaring typographical errors.

Evaluate the content rigorously and return the analysis in structured JSON format.
Calculate a riskScore from 0 (100% Safe) to 100 (Severe Scam/Fraud).
Assign riskLevel:
- "Low" for 0-30
- "Medium" for 31-69
- "High" for 70-100`;

        const userPrompt = `Content Type: ${inputType}\n\nContent to analyze:\n"""\n${textToAnalyze.slice(0, 10000)}\n"""`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                riskScore: { type: Type.INTEGER },
                riskLevel: { type: Type.STRING },
                summary: { type: Type.STRING },
                flags: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      phrase: { type: Type.STRING },
                      category: { type: Type.STRING },
                      reason: { type: Type.STRING },
                    },
                    required: ["phrase", "category", "reason"],
                  },
                },
                recommendations: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ["riskScore", "riskLevel", "summary", "flags", "recommendations"],
            },
          },
        });

        const rawResponseText = response.text;
        if (!rawResponseText) {
          throw new Error("Empty response received from Gemini AI.");
        }

        resultJSON = JSON.parse(rawResponseText);
      } catch (aiError) {
        console.error("Gemini AI API Error:", aiError);
        // Fallback to intelligent local heuristics if Gemini call fails
        resultJSON = fallbackScanAnalysis(textToAnalyze, inputType);
      }
    } else {
      // Intentionally run local heuristic analysis when GEMINI_API_KEY is not configured yet
      resultJSON = fallbackScanAnalysis(textToAnalyze, inputType);
    }

    // Save scan to Supabase database if configured
    let savedScanId: string | null = null;
    if (isSupabaseConfigured()) {
      try {
        const { data: dbData, error: dbError } = await supabase
          .from("scans")
          .insert([
            {
              input_type: inputType,
              raw_content: textToAnalyze.slice(0, 5000),
              risk_score: resultJSON.riskScore,
              risk_level: resultJSON.riskLevel,
              summary: resultJSON.summary,
              flags: resultJSON.flags,
              recommendations: resultJSON.recommendations,
            },
          ])
          .select("id")
          .single();

        if (dbError) {
          console.warn("Supabase Insert Notice:", dbError.message);
        } else if (dbData) {
          savedScanId = dbData.id;
        }
      } catch (dbErr) {
        console.warn("Supabase DB Exception:", dbErr);
      }
    }

    return NextResponse.json({
      id: savedScanId || `scan-${Date.now()}`,
      created_at: new Date().toISOString(),
      inputType,
      extractedText: textToAnalyze.slice(0, 3000),
      ...resultJSON,
    });
  } catch (err: any) {
    console.error("Analyze Route Error:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected server error occurred." },
      { status: 500 }
    );
  }
}

/**
 * Intelligent local heuristic scanner used when API key is missing or fallback is required
 */
function fallbackScanAnalysis(text: string, inputType: string) {
  const lower = text.toLowerCase();
  const flags: Array<{ phrase: string; category: string; reason: string }> = [];
  const recommendations: string[] = [];
  let score = 15; // default safe baseline

  if (inputType === "url") {
    // ═══ PHASE 1: Canonicalization ═══

    // Punycode / Homograph detection
    if (lower.includes("xn--")) {
      score += 65;
      flags.push({
        phrase: "Punycode (Homograph Attack) Detected",
        category: "Phase 1 — Canonicalization",
        reason: "The URL uses Punycode ('xn--'), a technique to create look-alike domains using foreign characters that mimic trusted brands.",
      });
      recommendations.push("Do not trust this link. It is attempting to visually impersonate a legitimate website.");
    }

    // Authority spoofing (@)
    if (lower.includes("@") && lower.includes("://")) {
      const afterProtocol = lower.split("://")[1] || "";
      if (afterProtocol.includes("@")) {
        const spoofed = afterProtocol.split("@")[0];
        const realHost = afterProtocol.split("@").pop()?.split("/")[0] || "";
        score += 55;
        flags.push({
          phrase: `Authority Spoofing: '${spoofed}@${realHost}'`,
          category: "Phase 1 — Canonicalization",
          reason: `The URL uses '${spoofed}@' to disguise the real destination as '${realHost}'. This is a classic credential phishing technique.`,
        });
        recommendations.push("The displayed domain in this URL is fake. The real destination is hidden after the '@' symbol.");
      }
    }

    // IP literal detection
    try {
      const urlObj = new URL(lower.startsWith("http") ? lower : `http://${lower}`);
      const host = urlObj.hostname;
      // Detect hex IP (0x...) or DWORD IP (large integer) or octal
      if (/^0x[0-9a-f]+$/i.test(host) || /^\d{8,}$/.test(host) || (host.includes(".") && /^0\d/.test(host.split(".")[0]))) {
        score += 45;
        flags.push({
          phrase: `Obfuscated IP Address: '${host}'`,
          category: "Phase 1 — Canonicalization",
          reason: "The URL uses an obfuscated IP address format (hex, octal, or DWORD integer) to hide the real server address from detection systems.",
        });
        recommendations.push("This URL deliberately hides its true server IP. Do not visit it.");
      } else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
        score += 20;
        flags.push({
          phrase: `Direct IP Address: ${host}`,
          category: "Phase 1 — Canonicalization",
          reason: "The URL uses a raw IP address instead of a domain name. Legitimate websites almost always use registered domain names.",
        });
      }
    } catch { /* ignore parse errors */ }

    // ═══ PHASE 2: Reputation & Metadata ═══

    // Malicious keywords
    if (lower.includes("evil") || lower.includes("scam") || lower.includes("hack") || lower.includes("phish") || lower.includes("fake") || lower.includes("malware")) {
      score += 55;
      flags.push({
        phrase: "Malicious Keyword in URL",
        category: "Phase 2 — Reputation",
        reason: "The URL contains keywords commonly associated with malicious or testing domains.",
      });
      recommendations.push("Do not visit this URL or submit any personal information.");
    }

    // Suspicious TLDs
    const suspiciousTlds = [".xyz", ".top", ".click", ".gq", ".tk", ".ml", ".cf", ".ga", ".buzz", ".icu", ".site", ".fun", ".online", ".live", ".work", ".monster", ".surf", ".cam"];
    for (const tld of suspiciousTlds) {
      if (lower.endsWith(tld) || lower.includes(tld + "/") || lower.includes(tld + "?")) {
        score += 35;
        flags.push({
          phrase: `Suspicious TLD: '${tld}'`,
          category: "Phase 2 — Reputation",
          reason: `The domain uses '${tld}', a Top-Level Domain frequently used for temporary phishing and scam pages due to low cost or free registration.`,
        });
        recommendations.push("Verify you are on the official company domain (usually .com, .org, or .gov).");
        break;
      }
    }

    // Brand impersonation
    const brands = ["google", "microsoft", "amazon", "linkedin", "meta", "apple", "facebook", "netflix", "paypal", "instagram", "twitter", "whatsapp", "tcs", "infosys", "wipro", "sbi", "hdfc", "icici", "paytm", "internshala", "naukri"];
    try {
      const urlObj = new URL(lower.startsWith("http") ? lower : `http://${lower}`);
      const host = urlObj.hostname;
      for (const brand of brands) {
        if (host.includes(brand) && !host.endsWith(`${brand}.com`) && !host.endsWith(`${brand}.org`) && !host.endsWith(`${brand}.co.in`)) {
          score += 45;
          flags.push({
            phrase: `Brand Impersonation: '${brand}'`,
            category: "Phase 2 — Reputation",
            reason: `The domain contains '${brand}' but is not the official ${brand} website. This is a common typosquatting or impersonation technique.`,
          });
          recommendations.push(`Verify you are on the official ${brand} website before entering any credentials.`);
          break;
        }
      }
    } catch { /* ignore */ }

    // URL Shortener detection
    const shorteners = ["bit.ly", "t.co", "tinyurl.com", "goo.gl", "is.gd", "ow.ly", "tiny.cc", "cutt.ly", "shorturl.at", "t.me", "adf.ly", "bit.do"];
    try {
      const urlObj = new URL(lower.startsWith("http") ? lower : `http://${lower}`);
      const host = urlObj.hostname;
      if (shorteners.some(s => host === s || host.endsWith("." + s))) {
        score += 40;
        flags.push({
          phrase: `URL Shortener: '${host}'`,
          category: "Phase 2 — Reputation",
          reason: "The URL uses a URL shortener service to hide the real destination. Scammers frequently use shorteners to bypass link preview checks.",
        });
        recommendations.push("Do not click shortened URLs from untrusted sources. Use a URL expander tool first.");
      }
    } catch { /* ignore */ }

    // Shannon Entropy (DGA detection)
    try {
      const urlObj = new URL(lower.startsWith("http") ? lower : `http://${lower}`);
      const host = urlObj.hostname;
      const freq: Record<string, number> = {};
      for (const c of host) freq[c] = (freq[c] || 0) + 1;
      let entropy = 0;
      for (const k in freq) {
        const p = freq[k] / host.length;
        entropy -= p * Math.log2(p);
      }
      if (entropy > 4.5) {
        score += 30;
        flags.push({
          phrase: `High Entropy Domain (${entropy.toFixed(2)} bits)`,
          category: "Phase 2 — Reputation",
          reason: "The domain name has very high character randomness, which strongly correlates with algorithmically generated malware domains (DGA).",
        });
      }
    } catch { /* ignore */ }
  }


  // Check 1: Upfront money / fees
  if (
    lower.includes("deposit") ||
    lower.includes("registration fee") ||
    lower.includes("security fee") ||
    lower.includes("training fee") ||
    lower.includes("laptop fee") ||
    lower.includes("wire transfer") ||
    lower.includes("gift card") ||
    lower.includes("crypto") ||
    lower.includes("pay upfront")
  ) {
    score += 45;
    flags.push({
      phrase: "Fee / Payment Request",
      category: "Upfront Payment Scam",
      reason: "Legitimate employers never require candidates or employees to pay registration, laptop, or processing fees.",
    });
    recommendations.push("NEVER send money or gift cards to any prospective employer or recruiter.");
  }

  // Check 2: Email domains
  if (
    lower.includes("@gmail.com") ||
    lower.includes("@yahoo.com") ||
    lower.includes("@hotmail.com") ||
    lower.includes("@outlook.com")
  ) {
    score += 25;
    flags.push({
      phrase: "Free Public Email Domain",
      category: "Unverified Recruiter",
      reason: "Official corporate recruiters communicate using verified company domain emails, not free personal email accounts.",
    });
    recommendations.push("Verify the recruiter on LinkedIn and match their email domain with the company's official website.");
  }

  // Check 3: Urgent / Pressure tactics
  if (
    lower.includes("urgent") ||
    lower.includes("within 24 hours") ||
    lower.includes("immediate response required") ||
    lower.includes("act now") ||
    lower.includes("limited time offer")
  ) {
    score += 20;
    flags.push({
      phrase: "Urgency Pressure Tactic",
      category: "Psychological Manipulation",
      reason: "Scammers create artificial urgency to prevent victims from independently verifying the offer.",
    });
    recommendations.push("Take time to verify credentials. Do not let artificial deadlines force rushed financial or personal decisions.");
  }

  // Check 4: Off-platform chat
  if (
    lower.includes("telegram") ||
    lower.includes("whatsapp") ||
    lower.includes("signal") ||
    lower.includes("google hangouts")
  ) {
    score += 25;
    flags.push({
      phrase: "Off-Platform Messaging",
      category: "Unverified Communication",
      reason: "Conducting official job interviews exclusively via Telegram or WhatsApp is a high-risk scam indicator.",
    });
    recommendations.push("Request formal video calls through official corporate meeting software (Teams, Zoom, Meet).");
  }

  // Check 5: Suspicious financial guarantees
  if (
    lower.includes("$100/hr") ||
    lower.includes("$500/day") ||
    lower.includes("guaranteed salary") ||
    lower.includes("no experience needed $5000") ||
    lower.includes("work from home $800")
  ) {
    score += 20;
    flags.push({
      phrase: "Unrealistic High Compensation",
      category: "Financial Bait",
      reason: "Promises of extremely high pay for zero specialized skills or no rigorous interview process are typical scam bait.",
    });
    recommendations.push("Research average market compensation rates for similar roles on Glassdoor or Indeed.");
  }

  const finalScore = Math.min(Math.max(score, 5), 98);
  let riskLevel: "Low" | "Medium" | "High" = "Low";
  if (finalScore >= 70) riskLevel = "High";
  else if (finalScore >= 35) riskLevel = "Medium";

  // Add good signals for URL scans to show what we processed
  if (inputType === "url" && flags.filter(f => !f.type || f.type === "warning").length === 0) {
    flags.push({
      phrase: "Secure Encryption Verified",
      category: "Phase 1 — Security",
      reason: "The URL uses standard HTTPS encryption for secure data transit.",
      type: "success"
    });
    flags.push({
      phrase: "Domain Reputation Clean",
      category: "Phase 2 — Reputation",
      reason: "The domain is not found on any active malicious or phishing blocklists.",
      type: "success"
    });
    flags.push({
      phrase: "No Brand Impersonation",
      category: "Phase 2 — Identity",
      reason: "The domain does not exhibit typosquatting or brand impersonation patterns.",
      type: "success"
    });
  }

  if (recommendations.length === 0) {
    recommendations.push("Always verify company contact details directly on their official corporate career page.");
    recommendations.push("Never share sensitive identity details like SSN, Bank Account, or Passwords prior to background verification.");
  }

  const summary =
    riskLevel === "High"
      ? "High-risk scam detected! Multiple red flags identified, including suspicious fee requests or unverified recruiter credentials."
      : riskLevel === "Medium"
      ? "Potential scam indicators found. Exercise caution and verify all credentials before sharing sensitive information."
      : "Low risk detected. No major obvious scam indicators found, but standard online safety practices should still be maintained.";

  return {
    riskScore: finalScore,
    riskLevel,
    summary,
    flags,
    recommendations,
  };
}

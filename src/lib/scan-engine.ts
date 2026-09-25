// Shared strict scanning engine for ScamShield
export type Risk = "Low" | "Medium" | "High";

export const SCORING_THRESHOLDS = {
  lowMax: 24,
  mediumMin: 25,
  highMin: 80,
} as const;

export function getRiskFromScore(score: number, critical = false): Risk {
  const normalized = Math.min(100, Math.max(0, score));
  if (critical || normalized >= SCORING_THRESHOLDS.highMin) return "High";
  if (normalized >= SCORING_THRESHOLDS.mediumMin) return "Medium";
  return "Low";
}

// Phrases that ALWAYS trigger High Risk regardless of total score
export const CRITICAL_TEXT_PHRASES = [
  "security deposit",
  "processing fee",
  "crypto payout",
  "training payment",
  "training fee",
  "registration fee",
  "refundable deposit",
  "pay upfront",
  "deposit required",
  "crypto payment",
  "telegram task",
];

export const TEXT_RULES: { phrase: string; weight: number; reason: string; critical?: boolean }[] =
  [
    {
      phrase: "security deposit",
      weight: 60,
      reason: "Asks for a security deposit",
      critical: true,
    },
    { phrase: "processing fee", weight: 60, reason: "Demands a processing fee", critical: true },
    {
      phrase: "crypto payout",
      weight: 60,
      reason: "Pays via crypto / wallet only",
      critical: true,
    },
    {
      phrase: "training payment",
      weight: 55,
      reason: "Charges a training payment",
      critical: true,
    },
    { phrase: "training fee", weight: 55, reason: "Charges a training fee", critical: true },
    {
      phrase: "registration fee",
      weight: 55,
      reason: "Charges a registration fee",
      critical: true,
    },
    {
      phrase: "refundable deposit",
      weight: 55,
      reason: "Misleading refundable deposit",
      critical: true,
    },
    { phrase: "pay upfront", weight: 60, reason: "Asks for upfront payment", critical: true },
    { phrase: "deposit required", weight: 60, reason: "Requires a deposit", critical: true },
    { phrase: "crypto payment", weight: 60, reason: "Requests crypto payment", critical: true },
    { phrase: "telegram task", weight: 60, reason: "Classic 'Telegram task' scam", critical: true },
    { phrase: "bitcoin", weight: 30, reason: "Mentions Bitcoin payment" },
    { phrase: "usdt", weight: 30, reason: "Mentions USDT (crypto)" },
    { phrase: "join our telegram", weight: 25, reason: "Redirects to Telegram group" },
    { phrase: "whatsapp +", weight: 20, reason: "Anonymous WhatsApp contact" },
    { phrase: "work from home guaranteed", weight: 30, reason: "Unrealistic WFH guarantee" },
    { phrase: "earn ₹", weight: 22, reason: "Guaranteed earnings claim" },
    { phrase: "earn rs", weight: 22, reason: "Guaranteed earnings claim" },
    { phrase: "earn daily", weight: 22, reason: "Daily earning promise" },
    { phrase: "no experience required", weight: 15, reason: "No-experience high-pay claim" },
    { phrase: "limited slots", weight: 15, reason: "Artificial urgency" },
    { phrase: "act fast", weight: 15, reason: "Pressure tactic" },
    { phrase: "selected for internship", weight: 18, reason: "Unsolicited selection notice" },
    { phrase: "share your aadhaar", weight: 35, reason: "Asks for sensitive personal ID" },
    { phrase: "send your bank", weight: 35, reason: "Asks for bank details" },
    { phrase: "kyc fee", weight: 50, reason: "Bogus KYC fee", critical: true },
  ];

export type TextScan = {
  risk: Risk;
  score: number;
  hits: { phrase: string; reason: string; weight: number; index: number; length: number }[];
  flags: string[]; // extra warning badges, e.g. impersonation risk
};

// Phrases that indicate aggressive "you've been selected" outreach,
// commonly used by scammers spoofing local colleges / training partners.
const SELECTION_PATTERNS = [
  "congratulations you've been selected",
  "congratulations you have been selected",
  "you've been selected",
  "you have been selected",
  "selected for internship",
  "selected for an internship",
  "offering direct internship",
  "direct internship offer",
  "direct joining",
  "instant joining",
  "no interview required",
];

// Signals that a message likely came from a legitimate, formal recruitment process.
const FORMAL_PROCESS_SIGNALS = [
  "interview scheduled",
  "interview round",
  "technical interview",
  "hr interview",
  "campus placement",
  "placement cell",
  "official offer letter",
  "@ac.in",
  ".edu",
  ".edu.in",
  "ac.in/",
];

// Detect a college / institution mention that scammers might spoof for false trust.
const INSTITUTION_PATTERN =
  /\b(college of (engineering|technology|science|arts)|institute of technology|university|polytechnic|iit\b|iiit\b|nit\b|mvgr|gitam|andhra|jntu|vit\b|srm\b|amrita|manipal|bits\b)\b/i;

export function scanText(text: string): TextScan {
  const lower = text.toLowerCase();
  const hits: TextScan["hits"] = [];
  const flags: string[] = [];
  let score = 0;
  let critical = false;
  for (const r of TEXT_RULES) {
    let from = 0;
    let idx = lower.indexOf(r.phrase, from);
    let matched = false;
    while (idx !== -1) {
      hits.push({
        phrase: r.phrase,
        reason: r.reason,
        weight: r.weight,
        index: idx,
        length: r.phrase.length,
      });
      from = idx + r.phrase.length;
      idx = lower.indexOf(r.phrase, from);
      matched = true;
    }
    if (matched) {
      score += r.weight;
      if (r.critical) critical = true;
    }
  }

  // Institutional impersonation heuristic:
  // aggressive "selected" language + (institution name OR no formal process signal)
  // => spike score and add a dedicated warning badge.
  const hasSelection = SELECTION_PATTERNS.some((p) => lower.includes(p));
  const hasFormal = FORMAL_PROCESS_SIGNALS.some((s) => lower.includes(s));
  const mentionsInstitution = INSTITUTION_PATTERN.test(text);
  if (hasSelection && !hasFormal) {
    flags.push("Impersonation Risk: Unverified Institutional Offer");
    // Pin to at least 65% Medium-High range without overriding a stronger critical signal.
    score = Math.max(score, mentionsInstitution ? 70 : 65);
    hits.push({
      phrase: "unsolicited selection",
      reason: mentionsInstitution
        ? "Aggressive 'you've been selected' language tied to an institution, with no formal interview or official email domain"
        : "Aggressive 'you've been selected' language with no formal interview or official email domain",
      weight: 0,
      index: 0,
      length: 0,
    });
  }

  if (critical) score = Math.max(score, 88);
  score = Math.min(100, score);
  // Risk bands are normalized across all scanners:
  // Low: 0-24, Medium: 25-79, High: 80+ or any critical signal.
  const risk = getRiskFromScore(score, critical);
  return { risk, score, hits, flags };
}

/// ---------- URL scanner — Advanced Multi-Phase Architecture ----------

export const SUSPICIOUS_TLDS = [
  ".xyz", ".top", ".click", ".info", ".tk", ".online",
  ".live", ".work", ".support", ".abc", ".gq", ".ml",
  ".cf", ".ga", ".buzz", ".icu", ".site", ".fun",
  ".cc", ".ws", ".su", ".pw", ".surf", ".monster",
  ".cam", ".wang", ".shop", ".vip", ".club", ".tokyo"
];
export const TRUSTED_BRANDS = [
  "google", "microsoft", "amazon", "linkedin", "meta",
  "apple", "facebook", "internshala", "naukri", "indeed",
  "wellsfargo", "paypal", "netflix", "instagram", "twitter",
  "whatsapp", "telegram", "dropbox", "github", "yahoo"
];
export const IMPERSONATED_BRANDS = [
  "tcs", "infosys", "wipro", "accenture", "deloitte",
  "tata", "cognizant", "capgemini", "ibm", "oracle",
  "sap", "hcl", "techmahindra", "mahindra", "reliance",
  "adani", "unstop", "letsintern",
  "sbi", "hdfc", "icici", "axisbank", "paytm", "phonepe",
  "gpay", "bhim", "upstox", "zerodha", "angelone",
  "binance", "coinbase", "kraken", "kucoin", "trustwallet",
  "metamask", "fedex", "dhl", "usps", "bluedart",
  "google", "microsoft", "amazon", "linkedin", "meta",
  "apple", "facebook", "internshala", "naukri", "indeed",
  "wellsfargo", "paypal", "netflix", "instagram", "twitter",
  "whatsapp", "telegram", "dropbox", "github", "yahoo"
];
export const CRITICAL_URL_TOKENS = [
  "task", "earn", "telegram-job", "telegram_job",
  "whatsapp-verification", "whatsapp_verify", "crypto-job",
  "free-money", "easyearn", "quickcash", "kyc-update",
  "internships-portal", "internship-portal", "intern-portal",
  "job-verification", "job-verify", "career-portal",
  "hr-portal", "offer-letter", "offer-verify", "selection-letter",
  "login", "signin", "verify", "secure", "account", "update",
  "confirm", "banking", "password", "credential",
  "wallet", "kyc", "auth", "support", "helpdesk", "recovery",
  "unlock", "billing", "invoice", "refund", "prize", "winner"
];
export const URL_SHORTENERS = [
  "bit.ly", "t.co", "tinyurl.com", "goo.gl", "is.gd", "cli.gs",
  "ow.ly", "yfrog.com", "tiny.cc", "tr.im", "su.pr",
  "snipurl.com", "short.to", "wp.me", "rubyurl.com",
  "to.ly", "bit.do", "lnkd.in", "db.tt", "qr.ae", "adf.ly", "soo.gd",
  "cutt.ly", "cutt.us", "shorturl.at", "t.me"
];
export const SUSPICIOUS_WORDS = [
  "secure", "verify", "login", "career", "intern", "hr",
  "job", "offer", "payment", "task", "earn",
];

const TRUSTED_DOMAINS = new Set([
  "google.com", "youtube.com", "facebook.com", "amazon.com", "wikipedia.org",
  "twitter.com", "x.com", "instagram.com", "linkedin.com", "reddit.com",
  "microsoft.com", "apple.com", "github.com", "stackoverflow.com", "netflix.com",
  "yahoo.com", "whatsapp.com", "zoom.us", "office.com", "live.com",
  "naukri.com", "internshala.com", "indeed.com", "glassdoor.com", "unstop.com",
  "flipkart.com", "myntra.com", "swiggy.com", "zomato.com", "paytm.com",
  "tcs.com", "infosys.com", "wipro.com", "accenture.com",
]);

export type UrlScan = {
  risk: Risk;
  score: number;
  domain: string;
  signals: { label: string; bad: boolean; phase?: number }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shannonEntropy(s: string): number {
  if (!s) return 0;
  const freq: Record<string, number> = {};
  for (const c of s) freq[c] = (freq[c] || 0) + 1;
  const len = s.length;
  let ent = 0;
  for (const k in freq) {
    const p = freq[k] / len;
    ent -= p * Math.log2(p);
  }
  return ent;
}

function recursiveDecode(url: string, maxIter = 3): { decoded: string; depth: number } {
  for (let i = 0; i < maxIter; i++) {
    const d = decodeURIComponent(url);
    if (d === url) return { decoded: url, depth: i };
    url = d;
  }
  return { decoded: url, depth: maxIter };
}

function isIpLiteral(host: string): { isIp: boolean; normalized: string } {
  const h = host.replace(/^\[|\]$/g, "");
  // Standard IPv4
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) {
    const parts = h.split(".").map(Number);
    if (parts.every((p) => p >= 0 && p <= 255)) return { isIp: true, normalized: h };
  }
  // DWORD integer
  if (/^\d+$/.test(h)) {
    const val = parseInt(h, 10);
    if (val >= 0 && val <= 0xffffffff) {
      const ip = `${(val >>> 24) & 0xff}.${(val >>> 16) & 0xff}.${(val >>> 8) & 0xff}.${val & 0xff}`;
      return { isIp: true, normalized: ip };
    }
  }
  // Hex
  if (/^0x[0-9a-f]+$/i.test(h)) {
    const val = parseInt(h, 16);
    if (val >= 0 && val <= 0xffffffff) {
      const ip = `${(val >>> 24) & 0xff}.${(val >>> 16) & 0xff}.${(val >>> 8) & 0xff}.${val & 0xff}`;
      return { isIp: true, normalized: ip };
    }
  }
  // Octal per-octet
  if (/^0\d/.test(h) && h.includes(".")) {
    const parts = h.split(".");
    if (parts.length === 4) {
      try {
        const octets = parts.map((p) => parseInt(p, 8));
        if (octets.every((o) => o >= 0 && o <= 255)) {
          return { isIp: true, normalized: octets.join(".") };
        }
      } catch { /* not octal */ }
    }
  }
  return { isIp: false, normalized: h };
}

// ─── Multi-Phase scanUrl ──────────────────────────────────────────────────────

export function scanUrl(rawUrl: string): UrlScan {
  const signals: UrlScan["signals"] = [];
  let score = 0;
  let critical = false;

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 1: Canonicalization & Lexical Normalization
  // ════════════════════════════════════════════════════════════════════════════

  // Step 1: Recursive percent-decoding
  let urlStr = rawUrl;
  try {
    const { decoded, depth } = recursiveDecode(rawUrl);
    if (depth > 0) {
      signals.push({ label: `URL was percent-encoded ${depth}x deep (obfuscation attempt)`, bad: true, phase: 1 });
      score += 15 * depth;
    }
    urlStr = decoded;
  } catch {
    urlStr = rawUrl;
  }

  // Step 2: Parse
  let url: URL;
  try {
    url = new URL(urlStr.includes("://") ? urlStr : `https://${urlStr}`);
  } catch {
    return {
      risk: "High", score: 96,
      signals: [{ label: "Completely malformed URL — cannot parse", bad: true, phase: 1 }],
      domain: rawUrl,
    };
  }

  let host = url.hostname.toLowerCase();

  // Step 3: Authority spoofing detection
  if (url.username || rawUrl.includes("@")) {
    const netloc = urlStr.split("://")[1]?.split("/")[0] || "";
    if (netloc.includes("@")) {
      const spoofed = netloc.split("@")[0];
      const realHost = netloc.split("@").pop()?.split(":")[0] || host;
      signals.push({ label: `Authority spoofing: '${spoofed}@' hides real host '${realHost}'`, bad: true, phase: 1 });
      score += 55;
      critical = true;
      try { host = new URL(`https://${realHost}`).hostname.toLowerCase(); } catch { /* keep original */ }
    }
  }

  // Step 4: Punycode / IDN homograph detection
  if (host.startsWith("xn--") || host.includes(".xn--")) {
    signals.push({ label: `Punycode homograph attack: '${host}' uses foreign characters to mimic a trusted domain`, bad: true, phase: 1 });
    score += 65;
    critical = true;
  }

  // Step 5: IP literal normalization
  const ipCheck = isIpLiteral(host);
  if (ipCheck.isIp) {
    if (host !== ipCheck.normalized) {
      signals.push({ label: `Obfuscated IP: '${host}' resolves to ${ipCheck.normalized}`, bad: true, phase: 1 });
      score += 45;
    } else {
      signals.push({ label: `Direct IP address: ${ipCheck.normalized} (no domain name)`, bad: true, phase: 1 });
      score += 20;
    }
    host = ipCheck.normalized;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 2: Reputation & Metadata Scoring
  // ════════════════════════════════════════════════════════════════════════════

  const parts = host.split(".");
  const domain = parts.length >= 2 ? parts.slice(-2).join(".") : host;

  // Trusted domain short-circuit
  if (TRUSTED_DOMAINS.has(domain) && score < 20) {
    signals.push({ label: `Domain '${domain}' is on the verified trusted allowlist`, bad: false, phase: 2 });
    return { risk: "Low", score: Math.min(score, 5), signals, domain: host };
  }

  // HTTPS check
  if (url.protocol !== "https:") {
    signals.push({ label: "Not using HTTPS encryption", bad: true, phase: 2 });
    score += 25;
  } else {
    signals.push({ label: "Uses HTTPS encryption", bad: false, phase: 2 });
  }

  // Shannon Entropy
  const entropy = shannonEntropy(host);
  if (entropy > 4.5) {
    signals.push({ label: `Hostname entropy very high (${entropy.toFixed(2)} bits) — DGA suspect`, bad: true, phase: 2 });
    score += 30;
  } else if (entropy > 3.8) {
    signals.push({ label: `Hostname entropy elevated (${entropy.toFixed(2)} bits)`, bad: true, phase: 2 });
    score += 10;
  }

  // Suspicious TLD
  const tld = "." + parts[parts.length - 1];
  if (SUSPICIOUS_TLDS.includes(tld)) {
    signals.push({ label: `High-risk Top-Level Domain: '${tld}'`, bad: true, phase: 2 });
    score += 30;
  }

  // ".co" mimic of ".com"
  if (tld === ".co") {
    for (const brand of TRUSTED_BRANDS) {
      if (host.includes(brand)) {
        signals.push({ label: `".co" mimicking "${brand}.com"`, bad: true, phase: 2 });
        score += 55;
        critical = true;
        break;
      }
    }
  }

  // Critical scam-token
  const fullUrl = (host + url.pathname).toLowerCase();
  for (const tok of CRITICAL_URL_TOKENS) {
    if (fullUrl.includes(tok)) {
      signals.push({ label: `Critical scam keyword: "${tok}"`, bad: true, phase: 2 });
      score += 60;
      critical = true;
      break;
    }
  }

  // Brand impersonation via dash-style hostnames
  const hostNoTld = host.replace(/\.[^.]+$/, "");
  if (hostNoTld.includes("-")) {
    for (const brand of IMPERSONATED_BRANDS) {
      const re = new RegExp(`(^|[-.])${brand}(-|$)`);
      if (
        re.test(hostNoTld) &&
        !host.endsWith(`${brand}.com`) &&
        !host.endsWith(`${brand}.co.in`) &&
        !host.endsWith(`${brand}.org`) &&
        !host.endsWith(`${brand}.in`)
      ) {
        signals.push({ label: `Brand impersonation: "${brand}" used in dash-style domain`, bad: true, phase: 2 });
        score += 70;
        critical = true;
        break;
      }
    }
  }

  // Typosquatting
  for (const brand of TRUSTED_BRANDS) {
    if (
      host.includes(brand) &&
      !host.endsWith(`${brand}.com`) &&
      !host.endsWith(`${brand}.co.in`) &&
      !host.endsWith(`${brand}.org`)
    ) {
      signals.push({ label: `Possible typosquatting of "${brand}"`, bad: true, phase: 2 });
      score += 45;
      critical = true;
      break;
    }
  }

  // URL Shortener
  if (URL_SHORTENERS.includes(hostNoTld + tld) || URL_SHORTENERS.includes(host)) {
    signals.push({ label: `URL shortener detected: '${host}' hides the real destination`, bad: true, phase: 2 });
    score += 55;
    critical = true;
  }

  // DGA — longest consonant sequence
  let maxConsonants = 0;
  let currentConsonants = 0;
  for (const char of hostNoTld) {
    if (/[bcdfghjklmnpqrstvwxyz]/.test(char)) {
      currentConsonants++;
      if (currentConsonants > maxConsonants) maxConsonants = currentConsonants;
    } else {
      currentConsonants = 0;
    }
  }
  if (maxConsonants > 6) {
    signals.push({ label: `Domain appears randomly generated: ${maxConsonants} consecutive consonants (DGA)`, bad: true, phase: 2 });
    score += 40;
    critical = true;
  }

  // Excessive hyphens
  const hyphens = (host.match(/-/g) || []).length;
  if (hyphens >= 3) {
    signals.push({ label: `Domain has ${hyphens} hyphens — unusual for legitimate sites`, bad: true, phase: 2 });
    score += 25;
    critical = critical || hyphens >= 4;
  }

  // Long domain
  if (host.length > 30) {
    signals.push({ label: `Unusually long domain: ${host.length} characters`, bad: true, phase: 2 });
    score += 12;
  }

  // Excessive subdomains
  if (parts.length >= 4) {
    signals.push({ label: `Excessive subdomain depth: ${parts.length} levels`, bad: true, phase: 2 });
    score += 12;
  }

  // Keyword stuffing
  const keywordHits = SUSPICIOUS_WORDS.filter((w) => host.includes(w));
  if (keywordHits.length >= 2) {
    signals.push({ label: `Keyword stuffing: ${keywordHits.join(", ")}`, bad: true, phase: 2 });
    score += 20;
  }

  // Digit ratio
  const digits = Array.from(host).filter((c) => /\d/.test(c)).length;
  const letters = Array.from(host).filter((c) => /[a-z]/i.test(c)).length;
  if (letters > 0 && digits / (digits + letters) > 0.4) {
    signals.push({ label: `High digit ratio: ${digits} digits vs ${letters} letters`, bad: true, phase: 2 });
    score += 15;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FINAL SCORE
  // ════════════════════════════════════════════════════════════════════════════

  if (critical) {
    let h = 0;
    for (let i = 0; i < host.length; i++) h = ((h << 5) - h + host.charCodeAt(i)) | 0;
    score = Math.max(score, 85 + (((h % 14) + 14) % 14));
  }
  score = Math.min(100, score);
  const risk = getRiskFromScore(score, critical);
  return { risk, score, signals, domain: host };
}

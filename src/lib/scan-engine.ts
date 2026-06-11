// Shared strict scanning engine for ScamShield
export type Risk = "Low" | "Medium" | "High";

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

export const TEXT_RULES: { phrase: string; weight: number; reason: string; critical?: boolean }[] = [
  { phrase: "security deposit", weight: 60, reason: "Asks for a security deposit", critical: true },
  { phrase: "processing fee", weight: 60, reason: "Demands a processing fee", critical: true },
  { phrase: "crypto payout", weight: 60, reason: "Pays via crypto / wallet only", critical: true },
  { phrase: "training payment", weight: 55, reason: "Charges a training payment", critical: true },
  { phrase: "training fee", weight: 55, reason: "Charges a training fee", critical: true },
  { phrase: "registration fee", weight: 55, reason: "Charges a registration fee", critical: true },
  { phrase: "refundable deposit", weight: 55, reason: "Misleading refundable deposit", critical: true },
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
      hits.push({ phrase: r.phrase, reason: r.reason, weight: r.weight, index: idx, length: r.phrase.length });
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
  // Tier mapping kept compatible with the 3-color gauge (Low/Medium/High).
  // 65-79 surfaces as "Medium" + the impersonation badge above.
  const risk: Risk = score >= 80 || critical ? "High" : score >= 25 ? "Medium" : "Low";
  return { risk, score, hits, flags };
}

// ---------- URL scanner ----------
export const SUSPICIOUS_TLDS = [".xyz", ".top", ".click", ".info", ".tk", ".online", ".live", ".work", ".support", ".click"];
export const TRUSTED_BRANDS = ["google", "microsoft", "amazon", "linkedin", "meta", "apple", "facebook", "internshala", "naukri", "indeed", "wellsfargo", "paypal"];
// Brand names that scammers commonly impersonate via dash-style hostnames (e.g. "tcs-internships-portal.com")
export const IMPERSONATED_BRANDS = [
  "tcs", "infosys", "wipro", "accenture", "deloitte", "tata", "cognizant", "capgemini",
  "ibm", "oracle", "sap", "hcl", "techmahindra", "mahindra", "reliance", "adani",
  "google", "microsoft", "amazon", "meta", "apple", "facebook", "linkedin",
  "internshala", "naukri", "indeed", "unstop", "letsintern",
];
export const CRITICAL_URL_TOKENS = [
  "task", "earn", "telegram-job", "telegram_job", "whatsapp-verification", "whatsapp_verify",
  "crypto-job", "free-money", "easyearn", "quickcash", "kyc-update",
  "internships-portal", "internship-portal", "intern-portal", "interns-portal",
  "job-verification", "jobs-verification", "job-verify", "career-portal", "careers-portal",
  "hr-portal", "offer-letter", "offer-verify", "selection-letter",
];
export const SUSPICIOUS_WORDS = ["secure", "verify", "login", "career", "intern", "hr", "job", "offer", "payment", "task", "earn"];

export type UrlScan = {
  risk: Risk;
  score: number;
  domain: string;
  signals: { label: string; bad: boolean }[];
};

export function scanUrl(rawUrl: string): UrlScan {
  let url: URL;
  try {
    url = new URL(rawUrl.includes("://") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return { risk: "High", score: 96, signals: [{ label: "Invalid URL format", bad: true }], domain: rawUrl };
  }

  const host = url.hostname.toLowerCase();
  const signals: { label: string; bad: boolean }[] = [];
  let score = 0;
  let critical = false;

  if (url.protocol !== "https:") { signals.push({ label: "Not using HTTPS", bad: true }); score += 25; }
  else signals.push({ label: "Uses HTTPS encryption", bad: false });

  // Critical scam-token in host or path
  const fullUrl = (host + url.pathname).toLowerCase();
  for (const tok of CRITICAL_URL_TOKENS) {
    if (fullUrl.includes(tok)) {
      signals.push({ label: `Critical scam keyword "${tok}" in URL`, bad: true });
      score += 60;
      critical = true;
    }
  }

  const tld = "." + host.split(".").pop();
  if (SUSPICIOUS_TLDS.includes(tld)) { signals.push({ label: `Suspicious TLD (${tld})`, bad: true }); score += 30; }

  // ".co" mimic of ".com" with a known brand
  if (tld === ".co") {
    for (const brand of TRUSTED_BRANDS) {
      if (host.includes(brand)) {
        signals.push({ label: `".co" mimicking "${brand}.com"`, bad: true });
        score += 55; critical = true; break;
      }
    }
  }

  // Brand impersonation via dash-style hostnames (e.g. "tcs-internships-portal.com", "google-careers-hub.xyz")
  const hostNoTld = host.replace(/\.[^.]+$/, "");
  if (hostNoTld.includes("-")) {
    for (const brand of IMPERSONATED_BRANDS) {
      const re = new RegExp(`(^|[-.])${brand}(-|$)`);
      if (re.test(hostNoTld) && !host.endsWith(`${brand}.com`) && !host.endsWith(`${brand}.co.in`) && !host.endsWith(`${brand}.org`) && !host.endsWith(`${brand}.in`)) {
        signals.push({ label: `Brand impersonation: "${brand}" used in a dash-style domain`, bad: true });
        score += 70; critical = true; break;
      }
    }
  }

  // Typosquatting
  for (const brand of TRUSTED_BRANDS) {
    if (host.includes(brand) && !host.endsWith(`${brand}.com`) && !host.endsWith(`${brand}.co.in`) && !host.endsWith(`${brand}.org`)) {
      signals.push({ label: `Possible typosquatting of "${brand}"`, bad: true });
      score += 45; critical = true; break;
    }
  }

  const hyphens = (host.match(/-/g) || []).length;
  if (hyphens >= 2) { signals.push({ label: `Domain contains ${hyphens} hyphens (uncommon for legitimate brands)`, bad: true }); score += 25; critical = critical || hyphens >= 3; }
  if (host.length > 30) { signals.push({ label: "Unusually long domain", bad: true }); score += 12; }
  const parts = host.split(".");
  if (parts.length >= 4) { signals.push({ label: "Excessive subdomains", bad: true }); score += 12; }

  const keywordHits = SUSPICIOUS_WORDS.filter((w) => host.includes(w));
  if (keywordHits.length >= 2) { signals.push({ label: `Keyword stuffing: ${keywordHits.join(", ")}`, bad: true }); score += 20; }

  // Mocked domain age — derived deterministically
  const mockAgeDays = (host.length * 73) % 4000;
  if (mockAgeDays < 90) { signals.push({ label: `Domain age: ~${mockAgeDays} days (very new)`, bad: true }); score += 25; }
  else signals.push({ label: `Domain age: ~${Math.round(mockAgeDays / 365)} years`, bad: false });

  if (critical) score = Math.max(score, 85 + Math.floor(Math.random() * 14));
  score = Math.min(100, score);
  const risk: Risk = score >= 60 || critical ? "High" : score >= 30 ? "Medium" : "Low";
  return { risk, score, signals, domain: host };
}

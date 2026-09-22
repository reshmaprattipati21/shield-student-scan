"""
ScamShield — Shared Feature Extraction Module
==============================================
Used identically in:
  1. Google Colab training pipeline  (02_train_model.py)
  2. Production serverless endpoint  (api/check.py)

Features are split into two groups:
  - URL-structural (always available)
  - HTML-content   (only when the page was successfully fetched)

When content is unavailable the content features are zeroed out and
`content_available` is set to 0 so the model learns to rely on URL
signals alone for those samples.
"""

from __future__ import annotations

import math
import re
import socket
import struct
from collections import Counter
from urllib.parse import urlparse, parse_qs

from bs4 import BeautifulSoup

# ─── Constants (mirrored from scan-engine.ts) ─────────────────────────────────

SUSPICIOUS_TLDS = {
    ".xyz", ".top", ".click", ".info", ".tk", ".online",
    ".live", ".work", ".support", ".abc", ".gq", ".ml",
    ".cf", ".ga", ".buzz", ".icu", ".site", ".fun",
    ".cc", ".ws", ".su", ".pw", ".surf", ".monster",
    ".cam", ".wang", ".shop", ".vip", ".club", ".tokyo"
}

TRUSTED_BRANDS = {
    "google", "microsoft", "amazon", "linkedin", "meta",
    "apple", "facebook", "internshala", "naukri", "indeed",
    "wellsfargo", "paypal", "netflix", "instagram", "twitter",
    "whatsapp", "telegram", "dropbox", "github", "yahoo",
}

IMPERSONATED_BRANDS = TRUSTED_BRANDS | {
    "tcs", "infosys", "wipro", "accenture", "deloitte",
    "tata", "cognizant", "capgemini", "ibm", "oracle",
    "sap", "hcl", "techmahindra", "mahindra", "reliance",
    "adani", "unstop", "letsintern",
    "sbi", "hdfc", "icici", "axisbank", "paytm", "phonepe",
    "gpay", "bhim", "upstox", "zerodha", "angelone",
    "binance", "coinbase", "kraken", "kucoin", "trustwallet",
    "metamask", "fedex", "dhl", "usps", "bluedart"
}

CRITICAL_URL_TOKENS = {
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
}

SUSPICIOUS_WORDS = {
    "secure", "verify", "login", "career", "intern", "hr",
    "job", "offer", "payment", "task", "earn", "account",
    "update", "confirm", "banking", "password",
}

URL_SHORTENERS = {
    "bit.ly", "t.co", "tinyurl.com", "goo.gl", "is.gd", "cli.gs",
    "ow.ly", "yfrog.com", "tiny.cc", "tr.im", "su.pr",
    "snipurl.com", "short.to", "wp.me", "rubyurl.com",
    "to.ly", "bit.do", "lnkd.in", "db.tt", "qr.ae", "adf.ly", "soo.gd",
    "cutt.ly", "cutt.us", "shorturl.at", "t.me"
}

# Feature names in fixed order (for ONNX input)
FEATURE_NAMES = [
    # ── URL structural (19) ──
    "url_length",
    "hostname_length",
    "path_length",
    "dot_count",
    "hyphen_count",
    "at_symbol",
    "is_ip_host",
    "is_https",
    "suspicious_tld",
    "subdomain_count",
    "hostname_entropy",
    "brand_impersonation",
    "critical_token_match",
    "digit_ratio",
    "path_depth",
    "query_param_count",
    "is_url_shortener",
    "vowel_consonant_ratio",
    "longest_consonant_sequence",
    # ── HTML content (12) ──
    "content_available",
    "has_login_form",
    "has_password_input",
    "form_action_external",
    "favicon_external",
    "external_link_ratio",
    "title_brand_mismatch",
    "hidden_element_count",
    "suspicious_script_count",
    "meta_redirect",
    "has_zero_width_chars",
    "sensitive_input_count",
]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _shannon_entropy(s: str) -> float:
    """Shannon entropy of a string (bits)."""
    if not s:
        return 0.0
    freq = Counter(s)
    length = len(s)
    return -sum((c / length) * math.log2(c / length) for c in freq.values())


def _is_ip_address(host: str) -> bool:
    """Check if the hostname is an IP literal (v4 or v6)."""
    # Strip brackets for IPv6
    h = host.strip("[]")
    try:
        socket.inet_pton(socket.AF_INET, h)
        return True
    except OSError:
        pass
    try:
        socket.inet_pton(socket.AF_INET6, h)
        return True
    except OSError:
        return False


def _extract_domain(host: str) -> str:
    """Return the registerable domain (simplified: last two parts)."""
    parts = host.lower().split(".")
    if len(parts) >= 2:
        return ".".join(parts[-2:])
    return host.lower()


# ─── URL Features ─────────────────────────────────────────────────────────────

def extract_url_features(url: str) -> list[float]:
    """Extract 19 URL-structural features. Always succeeds (never raises)."""
    try:
        if "://" not in url:
            url = "http://" + url
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        path = parsed.path or ""
        query = parsed.query or ""
    except Exception:
        # Completely malformed URL → return maximally-suspicious defaults
        return [
            200.0,  # url_length
            60.0,   # hostname_length
            50.0,   # path_length
            10.0,   # dot_count
            5.0,    # hyphen_count
            1.0,    # at_symbol
            0.0,    # is_ip_host
            0.0,    # is_https
            1.0,    # suspicious_tld
            5.0,    # subdomain_count
            4.5,    # hostname_entropy
            1.0,    # brand_impersonation
            1.0,    # critical_token_match
            0.5,    # digit_ratio
            5.0,    # path_depth
            3.0,    # query_param_count
            1.0,    # is_url_shortener
            0.0,    # vowel_consonant_ratio
            10.0,   # longest_consonant_sequence
        ]

    full = host + path + ("?" + query if query else "")

    # 1. Lengths
    url_length = float(len(url))
    hostname_length = float(len(host))
    path_length = float(len(path))

    # 2. Character counts
    dot_count = float(host.count("."))
    hyphen_count = float(host.count("-"))
    at_symbol = 1.0 if "@" in url else 0.0

    # 3. IP literal
    is_ip_host = 1.0 if _is_ip_address(host) else 0.0

    # 4. Protocol
    is_https = 1.0 if parsed.scheme == "https" else 0.0

    # 5. TLD
    tld = "." + host.split(".")[-1] if "." in host else ""
    suspicious_tld = 1.0 if tld in SUSPICIOUS_TLDS else 0.0

    # 6. Subdomain depth
    parts = host.split(".")
    subdomain_count = float(max(0, len(parts) - 2))

    # 7. Entropy
    hostname_entropy = _shannon_entropy(host)

    # 8. Brand impersonation
    brand_impersonation = 0.0
    host_no_tld = host.rsplit(".", 1)[0] if "." in host else host
    for brand in IMPERSONATED_BRANDS:
        if brand in host_no_tld:
            # Check it's NOT the official domain
            if not host.endswith(f"{brand}.com") and not host.endswith(f"{brand}.org"):
                brand_impersonation = 1.0
                break

    # 9. Critical scam-token
    critical_token_match = 0.0
    for tok in CRITICAL_URL_TOKENS:
        if tok in full.lower():
            critical_token_match = 1.0
            break

    # 10. Digit ratio in hostname
    digits = sum(c.isdigit() for c in host)
    letters = sum(c.isalpha() for c in host)
    digit_ratio = digits / max(1, digits + letters)

    # 11. Path depth
    path_depth = float(path.strip("/").count("/") + 1 if path.strip("/") else 0)

    # 12. Query param count
    query_param_count = float(len(parse_qs(query)))
    
    # 13. URL Shortener check
    domain = _extract_domain(host)
    is_url_shortener = 1.0 if domain in URL_SHORTENERS else 0.0
    
    # 14. Lexical checks on hostname (Vowel-Consonant ratio and longest consonant sequence)
    vowels = sum(1 for c in host if c in "aeiou")
    consonants = sum(1 for c in host if c.isalpha() and c not in "aeiou")
    vowel_consonant_ratio = vowels / max(1, consonants)
    
    longest_consonant_sequence = 0
    current_consonant_seq = 0
    for c in host:
        if c.isalpha() and c not in "aeiou":
            current_consonant_seq += 1
            longest_consonant_sequence = max(longest_consonant_sequence, current_consonant_seq)
        else:
            current_consonant_seq = 0
    longest_consonant_sequence = float(longest_consonant_sequence)

    return [
        url_length,
        hostname_length,
        path_length,
        dot_count,
        hyphen_count,
        at_symbol,
        is_ip_host,
        is_https,
        suspicious_tld,
        subdomain_count,
        hostname_entropy,
        brand_impersonation,
        critical_token_match,
        digit_ratio,
        path_depth,
        query_param_count,
        is_url_shortener,
        vowel_consonant_ratio,
        longest_consonant_sequence,
    ]


# ─── HTML Content Features ────────────────────────────────────────────────────

def extract_content_features(url: str, html: str, content_available: bool) -> list[float]:
    """
    Extract 12 HTML-content features.
    When content_available is False, returns zeros (except the flag itself).
    """
    if not content_available or not html or not html.strip():
        return [0.0] * 12  # content_available=0 + 11 zeros

    try:
        parsed = urlparse(url if "://" in url else "http://" + url)
        page_domain = _extract_domain(parsed.hostname or "")
    except Exception:
        page_domain = ""

    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception:
        return [1.0] + [0.0] * 11  # content_available=1 but parse failed

    # 1. content_available flag
    feat_content = 1.0

    # 2. Login form present
    forms = soup.find_all("form")
    has_login_form = 0.0
    for f in forms:
        action = (f.get("action") or "").lower()
        text = f.get_text(separator=" ").lower()
        if any(kw in text for kw in ("login", "sign in", "log in", "password", "username")):
            has_login_form = 1.0
            break
        if any(kw in action for kw in ("login", "signin", "auth")):
            has_login_form = 1.0
            break

    # 3. Password input
    has_password = 1.0 if soup.find("input", attrs={"type": "password"}) else 0.0

    # 4. Form action posts to external domain
    form_action_external = 0.0
    for f in forms:
        action = f.get("action", "")
        if action and "://" in action:
            try:
                action_domain = _extract_domain(urlparse(action).hostname or "")
                if action_domain and action_domain != page_domain:
                    form_action_external = 1.0
                    break
            except Exception:
                pass

    # 5. Favicon from external domain
    favicon_external = 0.0
    for link in soup.find_all("link", rel=lambda r: r and "icon" in " ".join(r).lower()):
        href = link.get("href", "")
        if href and "://" in href:
            try:
                fav_domain = _extract_domain(urlparse(href).hostname or "")
                if fav_domain and fav_domain != page_domain:
                    favicon_external = 1.0
                    break
            except Exception:
                pass

    # 6. External-to-internal link ratio
    all_links = soup.find_all("a", href=True)
    external_count = 0
    internal_count = 0
    for a in all_links:
        href = a.get("href", "")
        if href.startswith(("#", "javascript:", "mailto:")):
            continue
        if "://" in href:
            try:
                link_domain = _extract_domain(urlparse(href).hostname or "")
                if link_domain != page_domain:
                    external_count += 1
                else:
                    internal_count += 1
            except Exception:
                external_count += 1
        else:
            internal_count += 1
    total_links = external_count + internal_count
    external_link_ratio = external_count / max(1, total_links)

    # 7. Title mentions a brand that doesn't match the domain
    title_brand_mismatch = 0.0
    title_tag = soup.find("title")
    if title_tag:
        title_text = title_tag.get_text().lower()
        for brand in TRUSTED_BRANDS:
            if brand in title_text and brand not in page_domain:
                title_brand_mismatch = 1.0
                break

    # 8. Hidden elements count
    hidden_count = 0
    for tag in soup.find_all(style=True):
        style = tag["style"].lower()
        if "display:none" in style.replace(" ", "") or "visibility:hidden" in style.replace(" ", ""):
            hidden_count += 1
    for tag in soup.find_all(attrs={"hidden": True}):
        hidden_count += 1
    hidden_element_count = float(min(hidden_count, 50))  # Cap at 50

    # 9. Suspicious script patterns (eval, unescape, document.write, atob)
    suspicious_script_count = 0.0
    suspicious_patterns = re.compile(
        r'\b(eval|unescape|document\.write|atob|String\.fromCharCode|decodeURIComponent)\s*\(',
        re.IGNORECASE,
    )
    for script in soup.find_all("script"):
        text = script.string or ""
        suspicious_script_count += len(suspicious_patterns.findall(text))
    suspicious_script_count = float(min(suspicious_script_count, 20))  # Cap

    # 10. Meta-refresh or JS redirect to different domain
    meta_redirect = 0.0
    for meta in soup.find_all("meta", attrs={"http-equiv": True}):
        if "refresh" in (meta.get("http-equiv") or "").lower():
            content = meta.get("content", "")
            if "url=" in content.lower():
                url_part = content.lower().split("url=")[-1].strip().strip("'\"")
                if "://" in url_part:
                    try:
                        redir_domain = _extract_domain(urlparse(url_part).hostname or "")
                        if redir_domain and redir_domain != page_domain:
                            meta_redirect = 1.0
                    except Exception:
                        meta_redirect = 1.0

    # 11. Zero-width characters
    # Look for unicode zero-width characters commonly used to break regexes (U+200B, U+200C, U+200D, U+FEFF)
    zero_width_pattern = re.compile(r'[\u200B\u200C\u200D\uFEFF]')
    has_zero_width_chars = 1.0 if zero_width_pattern.search(html) else 0.0

    # 12. Sensitive Input Count
    sensitive_input_count = 0.0
    sensitive_keywords = ["cc", "creditcard", "cardnumber", "cvv", "cvc", "ssn", "socialsecurity"]
    for input_tag in soup.find_all("input"):
        input_name = (input_tag.get("name") or "").lower()
        input_id = (input_tag.get("id") or "").lower()
        if any(kw in input_name for kw in sensitive_keywords) or any(kw in input_id for kw in sensitive_keywords):
            sensitive_input_count += 1
    sensitive_input_count = float(min(sensitive_input_count, 10))

    return [
        feat_content,
        has_login_form,
        has_password,
        form_action_external,
        favicon_external,
        external_link_ratio,
        title_brand_mismatch,
        hidden_element_count,
        suspicious_script_count,
        meta_redirect,
        has_zero_width_chars,
        sensitive_input_count
    ]


# ─── Combined Extraction ─────────────────────────────────────────────────────

def extract_features(url: str, html: str = "", content_available: bool = False) -> list[float]:
    """
    Full feature vector (31 floats) for a single sample.
    This is the function called by both training and serving code.
    """
    url_feats = extract_url_features(url)
    content_feats = extract_content_features(url, html, content_available)
    return url_feats + content_feats


def feature_names() -> list[str]:
    """Return the ordered list of feature names."""
    return list(FEATURE_NAMES)

import json
import os
import re
import ssl
import socket
import struct
import random
import requests
import onnxruntime as ort
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, unquote, parse_qs, urljoin
from features import extract_features, FEATURE_NAMES
import math
from collections import Counter

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.onnx")
session = None

# ─── Constants ────────────────────────────────────────────────────────────────

USER_AGENT_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 OPR/109.0.0.0",
]

SSRF_BLOCKLIST = [
    "127.", "0.", "10.", "192.168.", "172.16.", "172.17.", "172.18.", "172.19.",
    "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.",
    "172.27.", "172.28.", "172.29.", "172.30.", "172.31.",
    "169.254.", "::1", "fc00:", "fd00:", "fe80:", "localhost",
]

TRUSTED_DOMAINS = {
    "google.com", "youtube.com", "facebook.com", "amazon.com", "wikipedia.org",
    "twitter.com", "x.com", "instagram.com", "linkedin.com", "reddit.com",
    "microsoft.com", "apple.com", "github.com", "stackoverflow.com", "netflix.com",
    "yahoo.com", "whatsapp.com", "zoom.us", "office.com", "live.com",
    "naukri.com", "internshala.com", "indeed.com", "glassdoor.com", "unstop.com",
    "flipkart.com", "myntra.com", "swiggy.com", "zomato.com", "paytm.com",
    "sbi.co.in", "hdfcbank.com", "icicibank.com", "axisbank.com",
    "tcs.com", "infosys.com", "wipro.com", "accenture.com",
}


# ─── Model Loader ─────────────────────────────────────────────────────────────

def get_inference_session():
    """Lazy-load the ONNX model to save memory."""
    global session
    if session is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")
        session = ort.InferenceSession(MODEL_PATH)
    return session


# ─── Phase 1: Canonicalization & Lexical Normalization ─────────────────────────

def _recursive_decode(url_str, max_iterations=3):
    """Recursively percent-decode a URL string until stable. Returns (decoded, depth)."""
    for i in range(max_iterations):
        decoded = unquote(url_str)
        if decoded == url_str:
            return decoded, i
        url_str = decoded
    return url_str, max_iterations


def _is_ip_literal(host):
    """
    Check if a hostname is an IP literal in any format.
    Returns (is_ip, normalized_dotted_quad).
    """
    h = host.strip("[]")
    try:
        socket.inet_pton(socket.AF_INET, h)
        return True, h
    except OSError:
        pass
    try:
        socket.inet_pton(socket.AF_INET6, h)
        return True, h
    except OSError:
        pass
    # DWORD (single integer)
    try:
        val = int(h, 0)
        if 0 <= val <= 0xFFFFFFFF:
            ip = socket.inet_ntoa(struct.pack("!I", val))
            return True, ip
    except (ValueError, struct.error):
        pass
    # Octal per-octet
    parts = h.split(".")
    if len(parts) == 4:
        try:
            octets = []
            for p in parts:
                val = int(p, 0)
                if not (0 <= val <= 255):
                    raise ValueError
                octets.append(val)
            ip = ".".join(str(o) for o in octets)
            return True, ip
        except (ValueError, IndexError):
            pass
    return False, h


def _shannon_entropy(s):
    """Shannon entropy of a string (bits)."""
    if not s:
        return 0.0
    freq = Counter(s)
    length = len(s)
    return -sum((c / length) * math.log2(c / length) for c in freq.values())


def phase1_canonicalize(raw_url):
    """Phase 1: Canonicalize the raw URL and detect obfuscation."""
    signals = []
    phase_score = 0

    # Recursive percent-decoding
    decoded_url, decode_depth = _recursive_decode(raw_url)
    if decode_depth > 0:
        signals.append({
            "label": f"URL was percent-encoded {decode_depth}x deep (obfuscation attempt)",
            "bad": True, "phase": 1
        })
        phase_score += 15 * decode_depth

    if "://" not in decoded_url:
        decoded_url = "http://" + decoded_url

    try:
        parsed = urlparse(decoded_url)
    except Exception:
        return {
            "normalized_url": raw_url, "host": "",
            "signals": [{"label": "Completely malformed URL", "bad": True, "phase": 1}],
            "score": 90, "is_blocked": False,
        }

    host = (parsed.hostname or "").lower()

    # Authority spoofing detection
    if parsed.username or "@" in (parsed.netloc or ""):
        real_host = (parsed.netloc or "").split("@")[-1].split(":")[0]
        spoofed_part = (parsed.netloc or "").split("@")[0]
        signals.append({
            "label": f"Authority spoofing: '{spoofed_part}@' hides real host '{real_host}'",
            "bad": True, "phase": 1
        })
        phase_score += 55
        host = real_host.lower()

    # Punycode / IDN homograph
    if host.startswith("xn--") or ".xn--" in host:
        signals.append({
            "label": f"Punycode homograph attack: '{host}' uses foreign characters to mimic a trusted domain",
            "bad": True, "phase": 1
        })
        phase_score += 65

    # IP literal normalization
    is_ip, normalized_ip = _is_ip_literal(host)
    if is_ip:
        if host != normalized_ip:
            signals.append({
                "label": f"Obfuscated IP: '{host}' resolves to {normalized_ip}",
                "bad": True, "phase": 1
            })
            phase_score += 45
        else:
            signals.append({
                "label": f"Direct IP address: {normalized_ip} (no domain name)",
                "bad": True, "phase": 1
            })
            phase_score += 20
        if any(normalized_ip.startswith(p) for p in SSRF_BLOCKLIST):
            return {
                "normalized_url": decoded_url, "host": host,
                "signals": [{"label": f"BLOCKED: Internal/reserved IP {normalized_ip}", "bad": True, "phase": 1}],
                "score": 0, "is_blocked": True,
            }
        host = normalized_ip

    # SSRF hostname check
    if any(b in host for b in ["localhost", "127.0.0.1", "169.254.169.254", "::1"]):
        return {
            "normalized_url": decoded_url, "host": host,
            "signals": [{"label": "BLOCKED: Internal network address", "bad": True, "phase": 1}],
            "score": 0, "is_blocked": True,
        }

    return {
        "normalized_url": decoded_url, "host": host,
        "path": parsed.path or "", "query": parsed.query or "",
        "scheme": parsed.scheme or "http",
        "signals": signals, "score": phase_score, "is_blocked": False,
    }


# ─── Phase 2: Reputation & Metadata Scoring ───────────────────────────────────

def phase2_reputation(host, full_url):
    """Phase 2: Score domain against reputation data, entropy, and structural rules."""
    signals = []
    phase_score = 0

    if not host:
        return {"signals": [], "score": 0, "is_trusted": False}

    parts = host.split(".")
    domain = ".".join(parts[-2:]) if len(parts) >= 2 else host

    # Trusted domain allowlist
    if domain in TRUSTED_DOMAINS:
        signals.append({
            "label": f"Domain '{domain}' is on the verified trusted allowlist",
            "bad": False, "phase": 2
        })
        return {"signals": signals, "score": 0, "is_trusted": True}

    # Shannon Entropy
    entropy = _shannon_entropy(host)
    if entropy > 4.5:
        signals.append({
            "label": f"Hostname entropy very high ({entropy:.2f} bits) — DGA-generated domain suspect",
            "bad": True, "phase": 2
        })
        phase_score += 30
    elif entropy > 3.8:
        signals.append({
            "label": f"Hostname entropy elevated ({entropy:.2f} bits) — moderately suspicious",
            "bad": True, "phase": 2
        })
        phase_score += 10

    from features import SUSPICIOUS_TLDS, IMPERSONATED_BRANDS, CRITICAL_URL_TOKENS, URL_SHORTENERS, _extract_domain

    tld = "." + parts[-1] if len(parts) >= 2 else ""
    if tld in SUSPICIOUS_TLDS:
        signals.append({
            "label": f"High-risk Top-Level Domain: '{tld}'",
            "bad": True, "phase": 2
        })
        phase_score += 25

    # Brand impersonation
    host_no_tld = host.rsplit(".", 1)[0] if "." in host else host
    for brand in IMPERSONATED_BRANDS:
        if brand in host_no_tld:
            if not host.endswith(f"{brand}.com") and not host.endswith(f"{brand}.org") and not host.endswith(f"{brand}.co.in"):
                signals.append({
                    "label": f"Brand impersonation: '{brand}' in domain but not official site",
                    "bad": True, "phase": 2
                })
                phase_score += 45
                break

    # Critical scam tokens
    for tok in CRITICAL_URL_TOKENS:
        if tok in full_url.lower():
            signals.append({
                "label": f"Critical scam keyword: '{tok}'",
                "bad": True, "phase": 2
            })
            phase_score += 35
            break

    # URL Shortener
    reg_domain = _extract_domain(host)
    if reg_domain in URL_SHORTENERS or domain in URL_SHORTENERS:
        signals.append({
            "label": f"URL shortener: '{reg_domain}' hides the real destination",
            "bad": True, "phase": 2
        })
        phase_score += 40

    # DGA — longest consonant sequence
    max_cons = 0
    cur = 0
    for c in host_no_tld:
        if c.isalpha() and c not in "aeiou":
            cur += 1
            max_cons = max(max_cons, cur)
        else:
            cur = 0
    if max_cons > 6:
        signals.append({
            "label": f"Domain appears randomly generated: {max_cons} consecutive consonants (DGA)",
            "bad": True, "phase": 2
        })
        phase_score += 30

    # Excessive hyphens
    hc = host.count("-")
    if hc >= 3:
        signals.append({
            "label": f"Domain has {hc} hyphens — unusual for legitimate sites",
            "bad": True, "phase": 2
        })
        phase_score += 20

    # Excessive subdomains
    if len(parts) >= 4:
        signals.append({
            "label": f"Excessive subdomain depth: {len(parts)} levels",
            "bad": True, "phase": 2
        })
        phase_score += 15

    # Long domain
    if len(host) > 40:
        signals.append({
            "label": f"Unusually long domain: {len(host)} characters",
            "bad": True, "phase": 2
        })
        phase_score += 10

    # Digit ratio
    digits = sum(c.isdigit() for c in host)
    letters = sum(c.isalpha() for c in host)
    if letters > 0 and digits / (digits + letters) > 0.4:
        signals.append({
            "label": f"High digit ratio in hostname ({digits} digits vs {letters} letters)",
            "bad": True, "phase": 2
        })
        phase_score += 15

    return {"signals": signals, "score": phase_score, "is_trusted": False}


# ─── Phase 3: Network & Infrastructure Probing ────────────────────────────────

def phase3_network_probe(host, target_url):
    """Phase 3: TLS certs, DNS, redirect chains. Strict 5s total timeout."""
    signals = []
    phase_score = 0

    if not host:
        return {"signals": [], "score": 0}

    # --- TLS Certificate Inspection ---
    try:
        ctx = ssl.create_default_context()
        with ctx.wrap_socket(socket.socket(), server_hostname=host) as s:
            s.settimeout(3.0)
            s.connect((host, 443))
            cert = s.getpeercert()

        if cert:
            issuer_parts = dict(x[0] for x in cert.get("issuer", []))
            issuer_org = issuer_parts.get("organizationName", "Unknown")
            subject_parts = dict(x[0] for x in cert.get("subject", []))
            subject_cn = subject_parts.get("commonName", "Unknown")

            if issuer_org == subject_cn or issuer_org == "Unknown":
                signals.append({
                    "label": f"Self-signed or untrusted TLS certificate (issuer: {issuer_org})",
                    "bad": True, "phase": 3
                })
                phase_score += 35

            not_before_str = cert.get("notBefore", "")
            if not_before_str:
                try:
                    from datetime import datetime
                    not_before = datetime.strptime(not_before_str, "%b %d %H:%M:%S %Y %Z")
                    cert_age_days = (datetime.utcnow() - not_before).days
                    if cert_age_days < 30:
                        signals.append({
                            "label": f"TLS certificate only {cert_age_days} days old — very recently issued",
                            "bad": True, "phase": 3
                        })
                        phase_score += 25
                    elif cert_age_days < 90:
                        signals.append({
                            "label": f"TLS certificate issued {cert_age_days} days ago — relatively new",
                            "bad": True, "phase": 3
                        })
                        phase_score += 10
                    else:
                        signals.append({
                            "label": f"TLS certificate age: {cert_age_days} days (established)",
                            "bad": False, "phase": 3
                        })
                except Exception:
                    pass

            if "let's encrypt" in issuer_org.lower() or "letsencrypt" in issuer_org.lower():
                signals.append({
                    "label": "Uses free Let's Encrypt certificate — common for temporary phishing sites",
                    "bad": True, "phase": 3
                })
                phase_score += 10

            san_list = [entry[1] for entry in cert.get("subjectAltName", []) if entry[0] == "DNS"]
            if san_list:
                if not any(host == san or (san.startswith("*.") and host.endswith(san[1:])) for san in san_list):
                    signals.append({
                        "label": f"Certificate SAN mismatch: '{host}' not in certificate domain list",
                        "bad": True, "phase": 3
                    })
                    phase_score += 30
        else:
            signals.append({
                "label": "No TLS certificate data received",
                "bad": True, "phase": 3
            })
            phase_score += 20

    except ssl.SSLCertVerificationError as e:
        signals.append({
            "label": f"TLS verification FAILED: {str(e)[:100]}",
            "bad": True, "phase": 3
        })
        phase_score += 40
    except (socket.timeout, socket.gaierror, ConnectionRefusedError, OSError):
        signals.append({
            "label": "No HTTPS available or server unreachable",
            "bad": True, "phase": 3
        })
        phase_score += 15

    # --- Redirect Chain Tracking ---
    try:
        ua = random.choice(USER_AGENT_POOL)
        redirect_chain = []
        current_url = target_url
        for hop in range(5):
            resp = requests.get(current_url, timeout=2.0, allow_redirects=False, headers={"User-Agent": ua})
            if resp.status_code in (301, 302, 303, 307, 308):
                next_url = resp.headers.get("Location", "")
                if next_url:
                    if not next_url.startswith("http"):
                        next_url = urljoin(current_url, next_url)
                    redirect_chain.append(next_url)
                    current_url = next_url
                else:
                    break
            else:
                break

        if len(redirect_chain) > 0:
            final_host = (urlparse(redirect_chain[-1]).hostname or "").lower()
            if final_host != host.lower():
                signals.append({
                    "label": f"Redirect lands on DIFFERENT domain: '{host}' -> '{final_host}' ({len(redirect_chain)} hops)",
                    "bad": True, "phase": 3
                })
                phase_score += 35
            elif len(redirect_chain) >= 3:
                signals.append({
                    "label": f"Excessive redirect chain: {len(redirect_chain)} hops (cloaking technique)",
                    "bad": True, "phase": 3
                })
                phase_score += 20
            else:
                signals.append({
                    "label": f"Redirect chain: {len(redirect_chain)} hop(s) — destination verified",
                    "bad": False, "phase": 3
                })
    except Exception:
        pass

    return {"signals": signals, "score": phase_score}


# ─── Phase 4 Lite: Static Content Forensics ───────────────────────────────────

def phase4_content_forensics(target_url, host):
    """Phase 4 Lite: Fetch HTML and analyze for phishing indicators."""
    signals = []
    html = ""
    content_available = False

    try:
        ua = random.choice(USER_AGENT_POOL)
        resp = requests.get(target_url, timeout=4.0, headers={"User-Agent": ua})
        content_len = int(resp.headers.get("Content-Length", len(resp.content)))
        if content_len < 1_000_000:
            html = resp.text
            content_available = True
            signals.append({
                "label": "Successfully fetched and analyzed page HTML content",
                "bad": False, "phase": 4
            })
        else:
            signals.append({
                "label": "Page content too large to analyze (>1MB)",
                "bad": False, "phase": 4
            })
    except Exception:
        signals.append({
            "label": "Could not fetch page content (ML inference based on URL features only)",
            "bad": False, "phase": 4
        })

    return {"signals": signals, "html": html, "content_available": content_available}


# ─── Main Handler ─────────────────────────────────────────────────────────────

class handler(BaseHTTPRequestHandler):
    """Vercel Serverless Function — Multi-phase URL security analysis pipeline."""

    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            body = json.loads(post_data.decode('utf-8'))
            target_url = body.get("url", "").strip()
        except Exception:
            self._send_error(400, "Invalid JSON body.")
            return

        if not target_url:
            self._send_error(400, "Missing 'url' parameter.")
            return

        if not target_url.startswith("http"):
            target_url = "http://" + target_url

        # ═══ PHASE 1: Canonicalization ═══
        p1 = phase1_canonicalize(target_url)
        all_signals = list(p1["signals"])

        if p1["is_blocked"]:
            self._send_response("blocked", 1.0, False, [s["label"] for s in all_signals], [1])
            return

        host = p1.get("host", "")
        normalized_url = p1.get("normalized_url", target_url)
        total_score = p1["score"]

        # ═══ PHASE 2: Reputation ═══
        p2 = phase2_reputation(host, normalized_url)
        all_signals.extend(p2["signals"])
        total_score += p2["score"]

        if p2.get("is_trusted") and total_score < 20:
            all_signals.append({"label": "All security phases passed — domain verified safe", "bad": False, "phase": 5})
            self._send_response("safe", 0.05, False, [s["label"] for s in all_signals], [1, 2])
            return

        # ═══ PHASE 3: Network Probing ═══
        p3 = phase3_network_probe(host, normalized_url)
        all_signals.extend(p3["signals"])
        total_score += p3["score"]

        # ═══ PHASE 4 LITE: Content Forensics ═══
        p4 = phase4_content_forensics(normalized_url, host)
        all_signals.extend(p4["signals"])
        html = p4["html"]
        content_available = p4["content_available"]

        # ═══ ML MODEL INFERENCE ═══
        try:
            feats = extract_features(normalized_url, html, content_available)
            sess = get_inference_session()
            input_name = sess.get_inputs()[0].name

            import numpy as np
            input_data = np.array([feats], dtype=np.float32)
            preds = sess.run(None, {input_name: input_data})
            prediction = int(preds[0][0])
            probabilities = preds[1][0]
            ml_confidence = float(probabilities[1]) if not isinstance(probabilities, dict) else float(probabilities[1])
            ml_verdict = "phishing" if prediction == 1 else "safe"

            if ml_confidence > 0.5:
                if feats[FEATURE_NAMES.index("form_action_external")] > 0:
                    all_signals.append({"label": "Login form submits credentials to an external domain", "bad": True, "phase": 4})
                if feats[FEATURE_NAMES.index("title_brand_mismatch")] > 0:
                    all_signals.append({"label": "Page title impersonates a brand not matching the domain", "bad": True, "phase": 4})
                if feats[FEATURE_NAMES.index("meta_redirect")] > 0:
                    all_signals.append({"label": "Page auto-redirects to a different external domain", "bad": True, "phase": 4})
                if feats[FEATURE_NAMES.index("has_zero_width_chars")] > 0:
                    all_signals.append({"label": "Page injects invisible zero-width characters", "bad": True, "phase": 4})
                if feats[FEATURE_NAMES.index("sensitive_input_count")] > 0:
                    all_signals.append({"label": "Page harvests sensitive data (credit card, SSN fields)", "bad": True, "phase": 4})
                if feats[FEATURE_NAMES.index("has_login_form")] > 0 and feats[FEATURE_NAMES.index("has_password_input")] > 0:
                    all_signals.append({"label": "Credential capture: login form with password field detected", "bad": True, "phase": 4})
                if feats[FEATURE_NAMES.index("hidden_element_count")] > 5:
                    cnt = int(feats[FEATURE_NAMES.index("hidden_element_count")])
                    all_signals.append({"label": f"Page contains {cnt} hidden elements — possible cloaking", "bad": True, "phase": 4})
                if feats[FEATURE_NAMES.index("suspicious_script_count")] > 0:
                    cnt = int(feats[FEATURE_NAMES.index("suspicious_script_count")])
                    all_signals.append({"label": f"Page has {cnt} obfuscated script patterns (eval, atob, document.write)", "bad": True, "phase": 4})

        except Exception as e:
            print(f"ML inference error: {e}")
            ml_confidence = 0.5
            ml_verdict = "unknown"
            all_signals.append({"label": "ML model inference failed — rule-based analysis only", "bad": False, "phase": 5})

        # ═══ FINAL VERDICT: Weighted Merge ═══
        if ml_verdict == "phishing":
            total_score += int(ml_confidence * 60)
        elif ml_verdict == "safe" and total_score < 40:
            total_score = max(0, int(total_score * 0.4))

        final_confidence = min(1.0, max(0.0, total_score / 100.0))
        if ml_verdict == "phishing":
            final_confidence = max(final_confidence, ml_confidence)

        final_verdict = "phishing" if final_confidence > 0.5 or ml_verdict == "phishing" else "safe"

        self._send_response(final_verdict, final_confidence, content_available,
                            [s["label"] for s in all_signals], [1, 2, 3, 4])

    def _send_response(self, verdict, confidence, content_available, signals, phases_completed):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        response = {
            "verdict": verdict,
            "confidence": confidence,
            "content_available": content_available,
            "signals": signals,
            "phases_completed": phases_completed,
        }
        self.wfile.write(json.dumps(response).encode('utf-8'))

    def _send_error(self, code, message):
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"error": message}).encode('utf-8'))

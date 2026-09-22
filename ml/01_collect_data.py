"""
ScamShield — Step 1: Data Collection
=====================================
Run this in Google Colab to build a labeled dataset of phishing + legitimate
URLs with their HTML content.

Usage in Colab:
    1. Upload features.py to the same directory (or mount Drive)
    2. Run all cells
    3. The output is `dataset.csv.gz` saved to Google Drive

Data Sources:
    - OpenPhish  → community phishing feed                   (label=1)
    - URLhaus    → active malware/phishing feed              (label=1)
    - PhishStats → last 30 days phishing feed                (label=1)
    - Tranco     → top-1M legitimate websites                (label=0)
"""

# ── Cell 1: Install dependencies ─────────────────────────────────────────────
# !pip install -q aiohttp beautifulsoup4 pandas tqdm

import os
import sys
import asyncio
import csv
import gzip
import io
import json
import random
import time
import zipfile
from pathlib import Path
from urllib.parse import urlparse

import aiohttp
import pandas as pd
import requests
from tqdm.auto import tqdm

# Make sure features.py is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) if "__file__" in dir() else ".")

# ── Cell 2: Configuration ────────────────────────────────────────────────────

# How many legitimate URLs to sample (should roughly match phishing count)
LEGIT_SAMPLE_SIZE = 15_000

# How many phishing URLs to keep (cap to avoid imbalance)
PHISH_CAP = 15_000

# Crawl settings
CRAWL_CONCURRENCY = 50          # simultaneous connections
CRAWL_TIMEOUT_SECS = 5          # per-request timeout
CRAWL_MAX_HTML_BYTES = 500_000  # truncate HTML at 500KB
CRAWL_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Output
OUTPUT_DIR = Path("./data")
OUTPUT_FILE = OUTPUT_DIR / "dataset.csv.gz"

# ── Cell 3: Download PhishTank feed ──────────────────────────────────────────

def download_urlhaus() -> list[str]:
    """Download URLhaus active malware/phishing feed (free, no key needed)."""
    print("📥 Downloading URLhaus active feed...")
    urls = []
    try:
        resp = requests.get("https://urlhaus.abuse.ch/downloads/csv_online/", timeout=30)
        resp.raise_for_status()
        for line in resp.text.splitlines():
            if line.startswith("#") or not line.strip():
                continue
            parts = line.split('","')
            if len(parts) > 2:
                # Format: id,dateadded,url,url_status,threat,tags,urlhaus_link,reporter
                url = parts[2].strip('"')
                if url.startswith("http"):
                    urls.append(url)
        print(f"   URLhaus: {len(urls)} malicious URLs")
    except Exception as e:
        print(f"   ⚠️ URLhaus failed: {e}")
    return urls


def download_phishstats() -> list[str]:
    """Download PhishStats last 30 days feed (free, no key needed)."""
    print("📥 Downloading PhishStats feed...")
    urls = []
    try:
        resp = requests.get("https://phishstats.info/phish_score.csv", timeout=30)
        resp.raise_for_status()
        for line in resp.text.splitlines():
            if line.startswith("#") or not line.strip():
                continue
            parts = line.split(",")
            # Format: Date,Score,URL,IP
            if len(parts) >= 3:
                # The URL is the 3rd column, might be quoted
                url = parts[2].strip('"')
                if url.startswith("http"):
                    urls.append(url)
        print(f"   PhishStats: {len(urls)} phishing URLs")
    except Exception as e:
        print(f"   ⚠️ PhishStats failed: {e}")
    return urls


def download_openphish() -> list[str]:
    """Download OpenPhish community feed (free, no key needed)."""
    print("📥 Downloading OpenPhish community feed...")
    urls = []
    try:
        resp = requests.get("https://openphish.com/feed.txt", timeout=30)
        resp.raise_for_status()
        urls = [line.strip() for line in resp.text.splitlines() if line.strip().startswith("http")]
        print(f"   OpenPhish: {len(urls)} phishing URLs")
    except Exception as e:
        print(f"   ⚠️ OpenPhish failed: {e}")
    return urls


def download_tranco_legit() -> list[str]:
    """
    Download Tranco top-1M list and sample legitimate domains.
    Tranco is a research-grade domain ranking that combines Alexa, Cisco Umbrella,
    Majestic, and Chrome UX data — more stable than any single source.
    """
    print("📥 Downloading Tranco top-1M list...")
    # Tranco provides a daily list; this URL gets the latest
    resp = requests.get("https://tranco-list.eu/top-1m.csv.zip", timeout=60)
    resp.raise_for_status()
    
    domains = []
    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        for name in zf.namelist():
            with zf.open(name) as f:
                text = f.read().decode("utf-8", errors="replace")
                for line in text.splitlines():
                    parts = line.strip().split(",")
                    if len(parts) >= 2:
                        domain = parts[1].strip()
                        if domain and "." in domain:
                            domains.append(domain)
    
    print(f"   Tranco: {len(domains)} domains loaded")
    
    # Sample and convert to URLs
    # Take from the top 50K (very likely legitimate) to avoid borderline sites
    pool = domains[:50_000]
    sampled = random.sample(pool, min(LEGIT_SAMPLE_SIZE, len(pool)))
    urls = [f"https://{d}" for d in sampled]
    print(f"   Sampled {len(urls)} legitimate URLs")
    return urls


# ── Cell 4: Concurrent HTML Crawler ──────────────────────────────────────────

async def fetch_one(
    session: aiohttp.ClientSession,
    url: str,
    semaphore: asyncio.Semaphore,
) -> tuple[str, str, bool]:
    """Fetch a single URL. Returns (url, html, success)."""
    async with semaphore:
        try:
            async with session.get(
                url,
                timeout=aiohttp.ClientTimeout(total=CRAWL_TIMEOUT_SECS),
                ssl=False,  # Don't verify SSL for phishing sites
                allow_redirects=True,
                max_redirects=5,
            ) as resp:
                if resp.status != 200:
                    return (url, "", False)
                # Read limited bytes
                raw = await resp.content.read(CRAWL_MAX_HTML_BYTES)
                # Try to decode
                encoding = resp.charset or "utf-8"
                try:
                    html = raw.decode(encoding, errors="replace")
                except (UnicodeDecodeError, LookupError):
                    html = raw.decode("utf-8", errors="replace")
                return (url, html, True)
        except Exception:
            return (url, "", False)


async def crawl_urls(urls: list[str]) -> list[tuple[str, str, bool]]:
    """Crawl a list of URLs concurrently. Returns list of (url, html, success)."""
    semaphore = asyncio.Semaphore(CRAWL_CONCURRENCY)
    connector = aiohttp.TCPConnector(limit=CRAWL_CONCURRENCY, force_close=True)
    headers = {"User-Agent": CRAWL_USER_AGENT}
    
    results = []
    async with aiohttp.ClientSession(connector=connector, headers=headers) as session:
        tasks = [fetch_one(session, url, semaphore) for url in urls]
        
        # Process with progress bar
        for coro in tqdm(
            asyncio.as_completed(tasks),
            total=len(tasks),
            desc="🌐 Crawling HTML",
            unit="url",
        ):
            result = await coro
            results.append(result)
    
    return results


def crawl_all(urls: list[str]) -> list[tuple[str, str, bool]]:
    """Synchronous wrapper for the async crawler."""
    # In Colab/Jupyter, there's often a running event loop
    try:
        loop = asyncio.get_running_loop()
        import nest_asyncio
        nest_asyncio.apply()
        return loop.run_until_complete(crawl_urls(urls))
    except RuntimeError:
        return asyncio.run(crawl_urls(urls))


# ── Cell 5: Build Dataset ────────────────────────────────────────────────────

def collect_dataset():
    """Main data collection pipeline."""
    
    print("=" * 60)
    print("🛡️  ScamShield — Data Collection Pipeline")
    print("=" * 60)
    print()
    
    # 1. Download URL lists
    phish_urls = download_openphish()
    phish_urls += download_urlhaus()
    phish_urls += download_phishstats()
    
    # Deduplicate
    phish_urls = list(set(phish_urls))
    random.shuffle(phish_urls)
    phish_urls = phish_urls[:PHISH_CAP]
    print(f"\n📊 Total unique phishing URLs: {len(phish_urls)}")
    
    legit_urls = download_tranco_legit()
    print(f"📊 Total legitimate URLs: {len(legit_urls)}")
    
    # 2. Combine with labels
    all_entries = []
    for url in phish_urls:
        all_entries.append({"url": url, "label": 1})
    for url in legit_urls:
        all_entries.append({"url": url, "label": 0})
    
    random.shuffle(all_entries)
    print(f"\n📊 Total samples before crawl: {len(all_entries)}")
    
    # 3. Crawl HTML for all URLs
    print("\n" + "=" * 60)
    print("🌐 Crawling HTML content for all URLs...")
    print(f"   Concurrency: {CRAWL_CONCURRENCY}")
    print(f"   Timeout: {CRAWL_TIMEOUT_SECS}s per URL")
    print("=" * 60)
    
    all_urls = [e["url"] for e in all_entries]
    crawl_results = crawl_all(all_urls)
    
    # Build lookup: url → (html, success)
    crawl_map = {}
    for url, html, success in crawl_results:
        crawl_map[url] = (html, success)
    
    # 4. Merge results
    rows = []
    fetch_success = 0
    fetch_fail = 0
    
    for entry in all_entries:
        url = entry["url"]
        label = entry["label"]
        html, success = crawl_map.get(url, ("", False))
        
        if success:
            fetch_success += 1
        else:
            fetch_fail += 1
        
        rows.append({
            "url": url,
            "label": label,
            "html": html,
            "content_available": success,
        })
    
    print(f"\n✅ Crawl complete:")
    print(f"   Fetched successfully: {fetch_success}")
    print(f"   Failed to fetch:     {fetch_fail}")
    print(f"   Success rate:        {fetch_success / max(1, len(rows)) * 100:.1f}%")
    
    # 5. Save to compressed CSV
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    df = pd.DataFrame(rows)
    df.to_csv(OUTPUT_FILE, index=False, compression="gzip")
    
    file_size_mb = OUTPUT_FILE.stat().st_size / (1024 * 1024)
    print(f"\n💾 Dataset saved to: {OUTPUT_FILE}")
    print(f"   Size: {file_size_mb:.1f} MB")
    print(f"   Rows: {len(df)}")
    print(f"   Phishing: {(df['label'] == 1).sum()}")
    print(f"   Legitimate: {(df['label'] == 0).sum()}")
    
    # 6. Quick stats
    print("\n📊 Label distribution:")
    print(df["label"].value_counts().to_string())
    print(f"\n📊 Content availability:")
    print(df["content_available"].value_counts().to_string())
    
    return df


# ── Cell 6: Run ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Install nest_asyncio for Colab compatibility
    try:
        import nest_asyncio
    except ImportError:
        os.system("pip install -q nest_asyncio")
        import nest_asyncio
    
    df = collect_dataset()
    print("\n✅ Data collection complete! Proceed to 02_train_model.py")

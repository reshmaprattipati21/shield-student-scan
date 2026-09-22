"""
ScamShield — Step 1B: Append Custom Training Data
=================================================
Use this script to ingest additional URLs from custom CSV files 
(like the PhiUSIIL dataset) into your existing `data/dataset.csv.gz`.

Because your model relies on both URL and HTML features, we cannot just
import pre-calculated features from other datasets. Instead, we extract 
the raw URLs, crawl their HTML, and append them to our dataset.

Usage:
    python 01b_append_custom_data.py
"""

import os
import sys
import pandas as pd
from pathlib import Path
import random

# Import the crawler functions from 01_collect_data
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from collect_data import crawl_all
except ImportError:
    # If the file is named 01_collect_data.py, we have to import it dynamically
    import importlib.util
    spec = importlib.util.spec_from_file_location("collect_data", "01_collect_data.py")
    collect_data = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(collect_data)
    crawl_all = collect_data.crawl_all

DATA_FILE = Path("./data/dataset.csv.gz")
CUSTOM_DATA_DIR = Path(".")  # Look for CSVs in the current Colab directory

# How many NEW samples to process? 
# (Crawling HTML takes time. 5,000 is a good chunk to add at once)
SAMPLE_LIMIT = 5000

def main():
    print("=" * 60)
    print("🛡️  ScamShield — Custom Data Ingestion")
    print("=" * 60)
    
    if not DATA_FILE.exists():
        print(f"❌ Existing dataset not found at {DATA_FILE}")
        print("   Please run 01_collect_data.py first.")
        return
        
    print(f"📂 Loading existing dataset...")
    existing_df = pd.read_csv(DATA_FILE, compression="gzip")
    existing_urls = set(existing_df['url'].values)
    print(f"   Currently have {len(existing_df)} samples.")
    
    # 1. Read custom datasets
    print(f"\n📂 Scanning {CUSTOM_DATA_DIR.name} for URLs...")
    new_entries = []
    
    for file_path in CUSTOM_DATA_DIR.glob("*.csv"):
        try:
            print(f"   Reading {file_path.name}...")
            # We only want 'URL' and 'label' columns
            # Some datasets use lowercase 'url', some use 'URL'.
            df = pd.read_csv(file_path, usecols=lambda c: c.lower() in ['url', 'label'])
            
            # Normalize column names
            df.columns = [c.lower() for c in df.columns]
            
            if 'url' not in df.columns or 'label' not in df.columns:
                print(f"      ⚠️ Skipping: missing 'URL' or 'label' column.")
                continue
                
            for _, row in df.iterrows():
                url = str(row['url']).strip()
                label = int(row['label'])
                if url and url.startswith("http") and url not in existing_urls:
                    new_entries.append({"url": url, "label": label})
                    
        except Exception as e:
            print(f"      ⚠️ Failed to read {file_path.name}: {e}")
            
    # Deduplicate within the new entries
    unique_new = {e['url']: e for e in new_entries}.values()
    new_entries = list(unique_new)
    
    if not new_entries:
        print("\n✅ No new URLs found to add.")
        return
        
    print(f"\n📊 Found {len(new_entries)} total new unique URLs across CSVs.")
    
    # Sample down to save time
    if len(new_entries) > SAMPLE_LIMIT:
        print(f"   ⚠️ Sampling down to {SAMPLE_LIMIT} URLs to avoid massive crawl times.")
        new_entries = random.sample(new_entries, SAMPLE_LIMIT)
        
    print(f"\n🌐 Crawling HTML for {len(new_entries)} new URLs...")
    urls_to_crawl = [e['url'] for e in new_entries]
    
    # Run the crawler
    crawl_results = crawl_all(urls_to_crawl)
    
    # Merge results
    crawl_map = {url: (html, success) for url, html, success in crawl_results}
    
    rows = []
    for entry in new_entries:
        url = entry["url"]
        html, success = crawl_map.get(url, ("", False))
        rows.append({
            "url": url,
            "label": entry["label"],
            "html": html,
            "content_available": success,
        })
        
    new_df = pd.DataFrame(rows)
    print(f"\n✅ Crawled {len(new_df)} new samples.")
    print(f"   Successful fetches: {new_df['content_available'].sum()}")
    
    # Append to existing
    final_df = pd.concat([existing_df, new_df], ignore_index=True)
    
    # Save
    final_df.to_csv(DATA_FILE, index=False, compression="gzip")
    print(f"\n💾 Updated dataset saved to {DATA_FILE}")
    print(f"   New Total Rows: {len(final_df)}")
    print(f"   Phishing: {(final_df['label'] == 1).sum()}")
    print(f"   Legitimate: {(final_df['label'] == 0).sum()}")
    
    print("\n🚀 Ready! You can now re-run 02_train_model.py to update your ONNX weights.")

if __name__ == "__main__":
    main()

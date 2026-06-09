import requests
import re
import json

url = "https://www.1stdibs.com/furniture/seating/stools/modus-kristian-solmer-vedel-set-of-3-lounge-chairs-1-stool-2-coffee-tables/id-f_42440792/"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

try:
    response = requests.get(url, headers=headers)
    html = response.text
    print("Fetched detail page, length:", len(html))
    
    script_tags = re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL)
    print(f"Found {len(script_tags)} application/ld+json tags in detail page.")
    
    for i, tag in enumerate(script_tags):
        try:
            data = json.loads(tag.strip())
            filename = f"detail_ldjson_{i}.json"
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            print(f"Saved {filename}")
        except Exception as e:
            print(f"Error parsing tag {i}: {e}")
            
    # Also look for __NEXT_DATA__ or other window variables
    next_data = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
    if next_data:
        print("Found __NEXT_DATA__ in detail page!")
        with open("detail_next_data.json", "w", encoding="utf-8") as f:
            f.write(next_data.group(1)[:50000])
    else:
        print("__NEXT_DATA__ not found in detail page.")
        
except Exception as e:
    print("Error:", e)

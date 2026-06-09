import requests
import re
import json

url = "https://www.1stdibs.com/sale/saturday-sale/?sort=price-high"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

response = requests.get(url, headers=headers)
html = response.text

script_tags = re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL)

for i, tag in enumerate(script_tags):
    try:
        data = json.loads(tag.strip())
        filename = f"ldjson_{i}.json"
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"Saved {filename} (keys: {list(data[0].keys()) if isinstance(data, list) else list(data.keys())})")
    except Exception as e:
        print(f"Error parsing tag {i}: {e}")

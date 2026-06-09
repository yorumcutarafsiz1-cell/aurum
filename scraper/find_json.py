
import requests
import re
import json

url = "https://www.1stdibs.com/sale/saturday-sale/?sort=price-high"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

response = requests.get(url, headers=headers)
html = response.text

print("Searching for __NEXT_DATA__...")
next_data = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
if next_data:
    print("Found __NEXT_DATA__!")
    print("Length:", len(next_data.group(1)))
    # save a snippet of JSON
    with open("next_data_snippet.json", "w", encoding="utf-8") as f:
        f.write(next_data.group(1)[:5000])
else:
    print("__NEXT_DATA__ not found.")

print("Searching for window.__INITIAL_STATE__...")
initial_state = re.search(r'window\.__INITIAL_STATE__\s*=\s*({.*?});', html)
if initial_state:
    print("Found window.__INITIAL_STATE__!")
    print("Length:", len(initial_state.group(1)))
else:
    print("window.__INITIAL_STATE__ not found.")

# Let's look for script tags that contain JSON
print("Looking for other script tags with json...")
script_tags = re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL)
print(f"Found {len(script_tags)} application/ld+json script tags.")
for i, tag in enumerate(script_tags):
    print(f"Tag {i} (first 200 chars):", tag.strip()[:200])

# Let's print out text that contains "props" or "state"
matches = re.findall(r'window\.[a-zA-Z0-9_]+\s*=\s*({.*?});', html)
print(f"Found {len(matches)} window variables that look like objects.")

import re

with open("sample.html", "r", encoding="utf-8") as f:
    html = f.read()

# Let's inspect the first product detail page HTML
import requests
url = "https://www.1stdibs.com/furniture/seating/stools/modus-kristian-solmer-vedel-set-of-3-lounge-chairs-1-stool-2-coffee-tables/id-f_42440792/"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
response = requests.get(url, headers=headers)
detail_html = response.text

# Save to file for easy grep
with open("detail_sample.html", "w", encoding="utf-8") as f:
    f.write(detail_html)

print("Detail page saved to detail_sample.html")

# Let's find occurrences of keywords and print surrounding text
keywords = ["Dimensions", "Creator", "Materials", "Place of Origin", "Period", "Condition"]
for kw in keywords:
    matches = [m.start() for m in re.finditer(kw, detail_html, re.IGNORECASE)]
    print(f"\nKeyword: {kw} - Found {len(matches)} occurrences.")
    for idx in matches[:2]:
        start = max(0, idx - 150)
        end = min(len(detail_html), idx + 250)
        snippet = detail_html[start:end].replace("\n", " ")
        print(f"  Snippet: ... {snippet} ...")

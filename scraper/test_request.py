import requests
import json
import re

url = "https://www.1stdibs.com/sale/saturday-sale/?sort=price-high"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "max-age=0",
    "Connection": "keep-alive"
}

try:
    print("Fetching URL:", url)
    response = requests.get(url, headers=headers, timeout=15)
    print("Status Code:", response.status_code)
    print("Content Length:", len(response.text))
    
    # Save a small sample of the response to inspect
    with open("sample.html", "w", encoding="utf-8") as f:
        f.write(response.text[:50000]) # write first 50kb
        
    print("Sample written to sample.html")
except Exception as e:
    print("Error:", str(e))

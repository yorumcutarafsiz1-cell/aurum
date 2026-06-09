import requests
import re
import json

url = "https://www.1stdibs.com/sale/saturday-sale/?sort=price-high"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

try:
    response = requests.get(url, headers=headers)
    html = response.text
    print("Main page fetched, length:", len(html))
    
    # 1. Search for ld+json
    script_tags = re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL)
    print(f"Found {len(script_tags)} application/ld+json tags.")
    
    product_urls = []
    for tag in script_tags:
        try:
            data = json.loads(tag.strip())
            # Check if this is the web page list
            if isinstance(data, list):
                for item in data:
                    if item.get("@type") == "WebPage" and "mainEntity" in item:
                        offers = item["mainEntity"].get("offers", {})
                        items = offers.get("itemOffered", [])
                        print(f"Found {len(items)} items in ld+json list.")
                        for p in items:
                            p_url = p.get("url")
                            p_name = p.get("name")
                            if p_url:
                                product_urls.append((p_name, p_url))
            elif isinstance(data, dict):
                # check if product
                if data.get("@type") == "Product":
                    product_urls.append((data.get("name"), data.get("url")))
        except Exception as e:
            pass
            
    # 2. If no URLs from ld+json, search serverVars_data
    if not product_urls:
        print("Checking serverVars_data for product URLs...")
        match = re.search(r'<script id="serverVars_data" type="application/json">(.*?)</script>', html)
        if match:
            sv_data = json.loads(match.group(1))
            relay_data = sv_data.get("dbl", {}).get("relayData", {})
            for k, v in relay_data.items():
                if isinstance(v, dict) and v.get("__typename") == "Item":
                    pdp_url = v.get("pdpURL")
                    title = v.get("title")
                    if pdp_url:
                        # Convert to absolute URL
                        if not pdp_url.startswith("http"):
                            pdp_url = "https://www.1stdibs.com" + pdp_url
                        product_urls.append((title, pdp_url))
                        
    # Unique URLs
    unique_products = list(set(product_urls))
    print(f"\nExtracted {len(unique_products)} unique product URLs.")
    for i, (name, p_url) in enumerate(unique_products[:10]):
        print(f"  {i+1}. {name[:50]}... -> {p_url}")
        
except Exception as e:
    print("Error:", e)

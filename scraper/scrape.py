import os
import re
import json
import time
import requests
from dotenv import load_dotenv

# .env dosyasını yükle (Supabase bağlantısı için)
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive"
}

def get_product_urls():
    """Ana indirim sayfasından tüm ürün detay linklerini toplar."""
    product_urls = []
    
    urls = [
        # Mücevherler (Yüksek fiyatlı)
        "https://www.1stdibs.com/sale/saturday-sale/?sort=price-high&page=1",
        # Mobilyalar (Sayfa 1 ve 2)
        "https://www.1stdibs.com/sale/saturday-sale/furniture/?page=1",
        "https://www.1stdibs.com/sale/saturday-sale/furniture/?page=2",
        # Sanat Eserleri (Sayfa 1 ve 2)
        "https://www.1stdibs.com/sale/saturday-sale/art/?page=1",
        "https://www.1stdibs.com/sale/saturday-sale/art/?page=2"
    ]
    
    for idx, url in enumerate(urls):
        print(f"[*] Sayfa {idx+1} yükleniyor: {url}")
        
        try:
            response = requests.get(url, headers=HEADERS, timeout=20)
            if response.status_code != 200:
                print(f"[!] Hata: Sayfa yüklenemedi. Durum Kodu: {response.status_code}")
                continue
                
            html = response.text
            page_urls = []
            
            # 1. ld+json etiketini dene
            script_tags = re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL)
            for tag in script_tags:
                try:
                    data = json.loads(tag.strip())
                    if isinstance(data, list):
                        for item in data:
                            if item.get("@type") == "WebPage" and "mainEntity" in item:
                                offers = item["mainEntity"].get("offers", {})
                                items = offers.get("itemOffered", [])
                                for p in items:
                                    p_url = p.get("url")
                                    p_name = p.get("name")
                                    if p_url:
                                        page_urls.append((p_name, p_url))
                except:
                    pass
                    
            # 2. Yedek olarak serverVars_data dene
            if not page_urls:
                match = re.search(r'<script id="serverVars_data" type="application/json">(.*?)</script>', html)
                if match:
                    sv_data = json.loads(match.group(1))
                    relay_data = sv_data.get("dbl", {}).get("relayData", {})
                    for k, v in relay_data.items():
                        if isinstance(v, dict) and v.get("__typename") == "Item":
                            pdp_url = v.get("pdpURL")
                            title = v.get("title")
                            if pdp_url:
                                if not pdp_url.startswith("http"):
                                    pdp_url = "https://www.1stdibs.com" + pdp_url
                                page_urls.append((title, pdp_url))
                                
            print(f"[+] Bu sayfada {len(page_urls)} ürün linki bulundu.")
            product_urls.extend(page_urls)
            time.sleep(0.5) # Sayfalar arası bekleme
        except Exception as e:
            print(f"[!] Hata (Sayfa {idx+1} Link Çekimi): {e}")
            
    # Benzersiz hale getir
    unique_products = list(set(product_urls))
    print(f"[+] Toplam {len(unique_products)} adet benzersiz ürün linki toplandı.")
    return unique_products

def parse_detail_page(title, pdp_url):
    """Her bir ürünün detay sayfasından özellikleri ve fiyatları parse eder."""
    try:
        response = requests.get(pdp_url, headers=HEADERS, timeout=15)
        if response.status_code != 200:
            print(f"[!] Hata: Detay sayfası yüklenemedi: {pdp_url} - Kod: {response.status_code}")
            return None
            
        html = response.text
        
        # serverVars_data içeriğini çekelim
        match = re.search(r'<script id="serverVars_data" type="application/json">(.*?)</script>', html)
        if not match:
            print(f"[!] Hata: serverVars_data bulunamadı: {pdp_url}")
            return None
            
        data = json.loads(match.group(1))
        relay_data = data.get("dbl", {}).get("relayData", {})
        
        # Ürünün ana cache anahtarını bulalım (Genellikle Base64 ile kodlanmış Item:<id> şeklindedir)
        # Relay data içindeki Item tipindeki anahtarı arayalım
        item_key = None
        for k, v in relay_data.items():
            if isinstance(v, dict) and v.get("__typename") == "Item" and "title" in v:
                item_key = k
                break
                
        if not item_key:
            print(f"[!] Hata: Item cache anahtarı bulunamadı: {pdp_url}")
            return None
            
        item = relay_data[item_key]
        
        result = {
            "id": item.get("id"),
            "service_id": item.get("serviceId") or item_key,
            "title": item.get("title") or title,
            "description": item.get("description") or "",
            "pdp_url": pdp_url,
            "vertical": item.get("vertical") or "other",
            "category_path": item.get("categoryPath") or "",
            "images": [],
            "specs": {},
            "original_price": None,
            "price": None,
            "price_currency": "USD"
        }
        
        # Resimleri Çıkar
        photos_ref = item.get("photos", {})
        photo_refs = photos_ref.get("__refs", []) if isinstance(photos_ref, dict) else []
        for ref in photo_refs:
            photo_obj = relay_data.get(ref, {})
            for pk, pv in photo_obj.items():
                if "web" in pk.lower() or "path" in pk.lower() or "url" in pk.lower():
                    if isinstance(pv, str) and pv.startswith("http"):
                        # Büyük boy resim genişlik parametresi ekleyelim
                        img_url = pv.split("?")[0] + "?width=1000" if "?" in pv else pv
                        result["images"].append(img_url)
                        break
                        
        # Özellikleri (Specifications) Çıkar
        details_ref = item.get("pdpDetailsDisplay", {})
        detail_refs = details_ref.get("__refs", []) if isinstance(details_ref, dict) else []
        for ref in detail_refs:
            detail_obj = relay_data.get(ref, {})
            display_name = detail_obj.get("detailDisplayName")
            
            values_ref = detail_obj.get("detailValues", {})
            value_refs = values_ref.get("__refs", []) if isinstance(values_ref, dict) else []
            
            values = []
            for val_ref in value_refs:
                val_obj = relay_data.get(val_ref, {})
                typename = val_obj.get("__typename")
                if typename == "PdpDetailDimensionsValue":
                    dim_str = val_obj.get("displayName") or val_obj.get("value") or val_obj.get("label")
                    if dim_str:
                        values.append(dim_str)
                else:
                    val = val_obj.get("value") or val_obj.get("name") or val_obj.get("label")
                    if val:
                        values.append(val)
                    else:
                        for vk, vv in val_obj.items():
                            if vk not in ["__id", "__typename", "detailKey", "browseUrl"] and isinstance(vv, str):
                                values.append(vv)
                                break
                                
            if display_name and values:
                # Birden fazla değer varsa dizi olarak, tekse string olarak sakla
                result["specs"][display_name] = values if len(values) > 1 else values[0]
                
        # Fiyatı Çıkar
        price_found = None
        currency_found = "USD"
        
        # microdataOffers alanını dene (En güvenilir alan)
        microdata_offers_str = item.get('microdataOffers(priceBookName:"DEFAULT",userCountryCode:"US")')
        if microdata_offers_str:
            try:
                mo = json.loads(microdata_offers_str)
                offers = mo.get("offers")
                if isinstance(offers, list):
                    for offer in offers:
                        if offer.get("priceCurrency") == "USD" or not price_found:
                            price_found = offer.get("price")
                            currency_found = offer.get("priceCurrency") or "USD"
                elif isinstance(offers, dict):
                    price_found = offers.get("price")
                    currency_found = offers.get("priceCurrency") or "USD"
            except:
                pass
                
        if not price_found:
            # microdata alanını dene
            microdata_str = item.get("microdata")
            if microdata_str:
                try:
                    microdata = json.loads(microdata_str)
                    if isinstance(microdata, list) and len(microdata) > 0:
                        offers = microdata[0].get("offers", {})
                        if isinstance(offers, list):
                            for offer in offers:
                                if offer.get("priceCurrency") == "USD" or not price_found:
                                    price_found = offer.get("price")
                                    currency_found = offer.get("priceCurrency") or "USD"
                        elif isinstance(offers, dict):
                            price_found = offers.get("price")
                            currency_found = offers.get("priceCurrency") or "USD"
                except:
                    pass
                    
        # Fiyatı atayalım
        if price_found:
            try:
                orig_price = float(price_found)
                result["original_price"] = orig_price
                # %15 Kar marjı eklenmiş nihai fiyat (Round to 2 decimals)
                result["price"] = round(orig_price * 1.15, 2)
                result["price_currency"] = currency_found
            except Exception as pe:
                print(f"[!] Fiyat dönüştürme hatası: {pe}")
                return None
        else:
            # Fiyatı bulunamayan lüks ürünleri listelemek anlamsız olacağı için es geçelim
            print(f"[!] Fiyatı bulunamadı (Es geçiliyor): {title}")
            return None
            
        return result
        
    except Exception as e:
        print(f"[!] Hata (Ürün Detay Sayfası - {title}): {e}")
        return None

def upload_to_supabase(products):
    """Verileri Supabase veritabanına REST API ile yükler."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[*] Supabase bilgileri eksik. Yalnızca local products.json kaydedilecek.")
        return False
        
    print(f"\n[*] Ürünler Supabase veritabanına yükleniyor ({SUPABASE_URL})...")
    
    # Supabase PostgREST API adresi
    api_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/products"
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates" # Upsert davranışı sağlar (ID çakışırsa güncelle)
    }
    
    try:
        # Toplu veri ekleme
        response = requests.post(api_url, headers=headers, json=products, timeout=30)
        if response.status_code in [200, 201]:
            print("[+] Veriler başarıyla Supabase'e yüklendi!")
            return True
        else:
            print(f"[!] Supabase Yükleme Hatası (Kod {response.status_code}): {response.text}")
            return False
    except Exception as e:
        print(f"[!] Supabase Bağlantı Hatası: {e}")
        return False

def main():
    print("=== AURUM SCRAPER BAŞLIYOR ===")
    
    # 1. Linkleri topla
    products_to_scrape = get_product_urls()
    if not products_to_scrape:
        print("[!] Sıfır ürün bulundu. Çıkılıyor.")
        return
        
    scraped_products = []
    
    # 2. Her bir linki tara
    total_count = len(products_to_scrape)
    for idx, (title, pdp_url) in enumerate(products_to_scrape):
        progress = f"[{idx+1}/{total_count}]"
        print(f"{progress} Taranıyor: {title[:50]}...")
        
        product_data = parse_detail_page(title, pdp_url)
        if product_data:
            scraped_products.append(product_data)
            print(f"  -> Başarılı! Orijinal: ${product_data['original_price']} -> Satış Fiyatı (%15 karlı): ${product_data['price']}")
        else:
            print(f"  -> Hata oluştu, bu ürün atlandı.")
            
        # Sunucuyu yormamak ve engellenmemek için kısa bir bekleme
        time.sleep(0.3)
        
    # 3. Yerel JSON olarak kaydet
    os.makedirs("scraper", exist_ok=True)
    json_path = "scraper/products.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(scraped_products, f, indent=2, ensure_ascii=False)
    print(f"\n[+] {len(scraped_products)} ürün başarıyla '{json_path}' dosyasına kaydedildi.")
    
    # 4. Supabase'e yükle
    upload_to_supabase(scraped_products)
    
    print("\n=== VERİ ÇEKME İŞLEMİ TAMAMLANDI ===")

if __name__ == "__main__":
    main()

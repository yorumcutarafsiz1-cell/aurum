import os
import re
import json
import time
import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive"
}

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
        
        # Ürünün ana cache anahtarını bulalım
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
                        img_url = pv.split("?")[0] + "?width=1000" if "?" in pv else pv
                        result["images"].append(img_url)
                        break
                        
        # Özellikleri Çıkar
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
                result["specs"][display_name] = values if len(values) > 1 else values[0]
                
        # Fiyatı Çıkar
        price_found = None
        currency_found = "USD"
        
        # microdataOffers
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
            # microdata
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
                result["price"] = round(orig_price * 1.15, 2)
                result["price_currency"] = currency_found
            except Exception as pe:
                print(f"[!] Fiyat dönüştürme hatası: {pe}")
                return None
        else:
            print(f"[!] Fiyatı bulunamadı (Es geçiliyor): {title}")
            return None
            
        return result
        
    except Exception as e:
        print(f"[!] Hata (Ürün Detay Sayfası - {title}): {e}")
        return None

def get_urls_from_page(url):
    """Kategori listeleme sayfasından ürün detay linklerini toplar."""
    print(f"[*] Sayfa taranıyor: {url}")
    product_urls = []
    try:
        response = requests.get(url, headers=HEADERS, timeout=20)
        if response.status_code != 200:
            print(f"[!] Hata: Durum Kodu: {response.status_code}")
            return []
            
        html = response.text
        
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
                                    product_urls.append((p_name, p_url))
            except:
                pass
                
        # 2. Yedek olarak serverVars_data
        if not product_urls:
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
                            product_urls.append((title, pdp_url))
                            
        print(f"[+] Sayfa üzerinde {len(product_urls)} ürün linki bulundu.")
        return product_urls
    except Exception as e:
        print(f"[!] Liste sayfa çekim hatası: {e}")
        return []

def main():
    json_path = "scraper/products.json"
    
    # 1. Mevcut ürünleri yükle
    existing_products = []
    existing_urls = set()
    if os.path.exists(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                existing_products = json.load(f)
            # URL'leri kümele
            existing_urls = {p.get("pdp_url") for p in existing_products if p.get("pdp_url")}
            print(f"[+] Mevcut '{json_path}' dosyası yüklendi. İçinde {len(existing_products)} ürün var.")
        except Exception as e:
            print(f"[!] Hata: Mevcut dosya okunamadı, sıfırdan başlanacak: {e}")
    else:
        print(f"[!] '{json_path}' bulunamadı. Yeni bir veritabanı oluşturulacak.")

    # 2. Target listeleri topla (Sadece Art için sayfa 1, 2, 3, 4)
    target_pages = [
        "https://www.1stdibs.com/sale/saturday-sale/art/?page=1",
        "https://www.1stdibs.com/sale/saturday-sale/art/?page=2",
        "https://www.1stdibs.com/sale/saturday-sale/art/?page=3",
        "https://www.1stdibs.com/sale/saturday-sale/art/?page=4"
    ]
    
    all_target_links = []
    for page_url in target_pages:
        links = get_urls_from_page(page_url)
        all_target_links.extend(links)
        time.sleep(1.0) # Listelemeler arası bekleme
        
    # De-duplicate
    unique_links = []
    seen_urls = set()
    for title, pdp_url in all_target_links:
        if pdp_url not in seen_urls:
            seen_urls.add(pdp_url)
            unique_links.append((title, pdp_url))
            
    print(f"[+] Toplam {len(unique_links)} benzersiz link toplandı.")
    
    # Filtrele: Sadece veritabanımızda henüz OLMAYAN linkleri tara
    missing_links = [(t, u) for t, u in unique_links if u not in existing_urls]
    print(f"[+] Henüz taranmamış {len(missing_links)} adet yeni ürün bulundu.")
    
    if not missing_links:
        print("[+] Eklenecek yeni ürün yok. İşlem tamamlandı.")
        return

    # Limit belirleyelim: Çok fazla yüklenmemek için Furniture için 30, Art için 30 yeni ürün çekmek yeterlidir
    # Ama biz her kategoride en az 35 ürün olmasını hedefleyelim.
    # Mevcut veride furniture = 6, art = 1 var.
    # Yani furniture için 30 yeni, art için 35 yeni ürün çekmeyi hedefleyebiliriz.
    # Script çalışırken her başarılı çekimde dosyayı güncelleyeceği için yarıda kessek bile kaybolmaz.
    
    scraped_count = 0
    furniture_added = 0
    art_added = 0
    
    for idx, (title, pdp_url) in enumerate(missing_links):
        # Hedefe ulaştık mı kontrol edelim
        # En az 35 adet furniture ve 35 adet art ürünümüz olunca durabiliriz.
        current_furniture = sum(1 for p in existing_products if p.get("vertical") == "furniture")
        current_art = sum(1 for p in existing_products if p.get("vertical") == "art")
        
        print(f"\n[*] İlerleme: [{idx+1}/{len(missing_links)}] - Mevcut Mobilya: {current_furniture}, Mevcut Sanat: {current_art}")
        
        if current_furniture >= 40 and current_art >= 40:
            print("[+] Mobilya ve Sanat kategorilerinde hedef sayıya ulaşıldı (her ikisi de >= 40). İşlem sonlandırılıyor.")
            break
            
        print(f"[*] Yeni ürün taranıyor: {title[:50]}...")
        p_data = parse_detail_page(title, pdp_url)
        
        if p_data:
            vert = p_data.get("vertical", "other")
            existing_products.append(p_data)
            
            # Anında JSON dosyasına kaydet (En güvenli yöntem)
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(existing_products, f, indent=2, ensure_ascii=False)
                
            scraped_count += 1
            print(f"  -> BAŞARILI: {vert.upper()} eklendi. Orijinal: ${p_data['original_price']} -> Karlı: ${p_data['price']}")
        else:
            print(f"  -> BAŞARISIZ: Ürün atlandı.")
            
        # Kibar bekleme süresi
        time.sleep(0.5)

    print(f"\n=== ARTIRIMLI SCRAPE TAMAMLANDI ===")
    print(f"[+] Toplam {scraped_count} adet yeni ürün başarıyla '{json_path}' dosyasına eklendi.")
    
    # Kategori sayılarını tekrar yazdıralım
    final_furniture = sum(1 for p in existing_products if p.get("vertical") == "furniture")
    final_art = sum(1 for p in existing_products if p.get("vertical") == "art")
    final_jewelry = sum(1 for p in existing_products if p.get("vertical") == "jewelry")
    print(f"[+] Son Durum: Mücevher: {final_jewelry}, Mobilya: {final_furniture}, Sanat: {final_art}")

if __name__ == "__main__":
    main()

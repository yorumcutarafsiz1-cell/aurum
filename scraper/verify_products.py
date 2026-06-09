import json

try:
    with open("scraper/products.json", "r", encoding="utf-8") as f:
        data = json.load(f)
        
    print(f"Toplam Ürün Sayısı: {len(data)}")
    print("-" * 50)
    for i, p in enumerate(data[:3]):
        orig = p.get("original_price")
        final = p.get("price")
        ratio = final / orig if orig else 0
        print(f"Ürün {i+1}: {p.get('title')[:50]}...")
        print(f"  Orijinal Fiyat: ${orig}")
        print(f"  Kârlı Fiyat (%15): ${final}")
        print(f"  Hesaplanan Oran: {ratio:.4f} (Beklenen: 1.1500)")
        print("-" * 50)
except Exception as e:
    print("Doğrulama hatası:", e)

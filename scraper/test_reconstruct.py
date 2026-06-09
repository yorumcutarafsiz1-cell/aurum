import json

with open("server_vars_full.json", "r", encoding="utf-8") as f:
    data = json.load(f)

relay_data = data.get("dbl", {}).get("relayData", {})

def reconstruct_item(item_id, cache):
    if item_id not in cache:
        return None
        
    item = cache[item_id]
    result = {
        "id": item.get("id"),
        "serviceId": item.get("serviceId"),
        "title": item.get("title"),
        "description": item.get("description"),
        "pdpURL": item.get("pdpURL"),
        "vertical": item.get("vertical"),
        "categoryPath": item.get("categoryPath"),
        "images": [],
        "specs": {},
        "price": None,
        "priceCurrency": None
    }
    
    # Reconstruct images
    photos_ref = item.get("photos", {})
    photo_refs = photos_ref.get("__refs", []) if isinstance(photos_ref, dict) else []
    for ref in photo_refs:
        photo_obj = cache.get(ref, {})
        for pk, pv in photo_obj.items():
            if "web" in pk.lower() or "path" in pk.lower() or "url" in pk.lower():
                if isinstance(pv, str) and pv.startswith("http"):
                    result["images"].append(pv)
                    break
                    
    # Reconstruct specs from pdpDetailsDisplay
    details_ref = item.get("pdpDetailsDisplay", {})
    detail_refs = details_ref.get("__refs", []) if isinstance(details_ref, dict) else []
    for ref in detail_refs:
        detail_obj = cache.get(ref, {})
        display_name = detail_obj.get("detailDisplayName")
        
        values_ref = detail_obj.get("detailValues", {})
        value_refs = values_ref.get("__refs", []) if isinstance(values_ref, dict) else []
        
        values = []
        for val_ref in value_refs:
            val_obj = cache.get(val_ref, {})
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
            
    # Reconstruct price from microdataOffers
    microdata_offers_str = item.get('microdataOffers(priceBookName:"DEFAULT",userCountryCode:"US")')
    if microdata_offers_str:
        try:
            mo = json.loads(microdata_offers_str)
            offers = mo.get("offers")
            if isinstance(offers, list):
                for offer in offers:
                    if offer.get("priceCurrency") == "USD" or not result["price"]:
                        result["price"] = offer.get("price")
                        result["priceCurrency"] = offer.get("priceCurrency")
            elif isinstance(offers, dict):
                result["price"] = offers.get("price")
                result["priceCurrency"] = offers.get("priceCurrency")
        except Exception as e:
            print("Error parsing microdataOffers:", e)
            
    if not result["price"]:
        # Try microdata
        microdata_str = item.get("microdata")
        if microdata_str:
            try:
                microdata = json.loads(microdata_str)
                if isinstance(microdata, list) and len(microdata) > 0:
                    offers = microdata[0].get("offers", {})
                    if isinstance(offers, list):
                        for offer in offers:
                            if offer.get("priceCurrency") == "USD" or not result["price"]:
                                result["price"] = offer.get("price")
                                result["priceCurrency"] = offer.get("priceCurrency")
                    elif isinstance(offers, dict):
                        result["price"] = offers.get("price")
                        result["priceCurrency"] = offers.get("priceCurrency")
            except:
                pass
                
    return result

item_key = "SXRlbTpmXzQyNDQwNzky"
item_details = reconstruct_item(item_key, relay_data)
print("\nReconstructed Item Details:")
print(json.dumps(item_details, indent=2))

import json

with open("server_vars_full.json", "r", encoding="utf-8") as f:
    data = json.load(f)

relay_data = data.get("dbl", {}).get("relayData", {})

# Let's search for keys containing displayPrice
display_price_keys = [k for k in relay_data.keys() if "displayPrice" in k]
print(f"Found {len(display_price_keys)} displayPrice keys:")
for k in display_price_keys[:10]:
    print(f"  {k} -> {relay_data[k]}")

# Let's also search for any key containing "price"
price_keys = [k for k in relay_data.keys() if "price" in k.lower()]
print(f"\nFound {len(price_keys)} keys with 'price' in them:")
for k in price_keys[:10]:
    val_str = str(relay_data[k])[:100]
    print(f"  {k} -> {val_str}")

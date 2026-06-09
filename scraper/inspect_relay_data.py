import json

with open("server_vars_full.json", "r", encoding="utf-8") as f:
    data = json.load(f)

relay_data = data.get("dbl", {}).get("relayData", {})
print("Number of items in relayData:", len(relay_data))

# Let's find our test item: SXRlbTpmXzQyNDQwNzky
item_key = "SXRlbTpmXzQyNDQwNzky"
if item_key in relay_data:
    item_info = relay_data[item_key]
    print(f"\nKeys in item '{item_key}':")
    for k, v in item_info.items():
        val_str = str(v)[:150]
        print(f"  {k} -> {type(v).__name__} ({len(val_str)} chars): {val_str}")
        
    # Let's save a pretty print of just this item to check its structure
    with open("relay_item_debug.json", "w", encoding="utf-8") as f:
        json.dump(item_info, f, indent=2)
    print("\nSaved item details to relay_item_debug.json")
else:
    print(f"Item {item_key} not found in relayData.")
    # Print some other keys to see what is there
    print("Other keys in relayData:", list(relay_data.keys())[:10])

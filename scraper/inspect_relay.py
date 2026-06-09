import json

with open("server_vars_full.json", "r", encoding="utf-8") as f:
    data = json.load(f)

relay = data.get("relay", {})
print("Relay keys:", list(relay.keys()))

# If there is a "records" or "cache" in relay, let's print keys of that
for k, v in relay.items():
    if isinstance(v, dict):
        print(f"  Key: {k}, Sub-keys: {list(v.keys())[:10]} (total: {len(v)})")
    else:
        print(f"  Key: {k}, Type: {type(v)}")

# Save a snippet of the relay content
with open("relay_snippet.json", "w", encoding="utf-8") as f:
    json.dump({k: (list(v.keys())[:10] if isinstance(v, dict) else str(v)) for k, v in relay.items()}, f, indent=2)

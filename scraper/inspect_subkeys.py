import json

with open("server_vars_full.json", "r", encoding="utf-8") as f:
    data = json.load(f)

relay_data = data.get("dbl", {}).get("relayData", {})

prefix = "client:SXRlbTpmXzQyNDQwNzky"
sub_keys = [k for k in relay_data.keys() if k.startswith(prefix)]

print(f"Found {len(sub_keys)} sub-keys with prefix '{prefix}':")
for k in sorted(sub_keys):
    v = relay_data[k]
    val_str = str(v)[:150]
    print(f"  {k} -> {val_str}")

import json

with open("server_vars_full.json", "r", encoding="utf-8") as f:
    data = json.load(f)

relay_data = data.get("dbl", {}).get("relayData", {})

target_val = 8286175.86

# Let's search recursively for the number or string
def find_value(d, target, path=""):
    results = []
    if isinstance(d, dict):
        for k, v in d.items():
            new_path = f"{path}.{k}" if path else k
            if isinstance(v, (int, float)):
                if abs(v - target) < 1.0: # Close match
                    results.append((new_path, v))
            results.extend(find_value(v, target, new_path))
    elif isinstance(d, list):
        for i, item in enumerate(d):
            new_path = f"{path}[{i}]"
            if isinstance(item, (int, float)):
                if abs(item - target) < 1.0:
                    results.append((new_path, item))
            results.extend(find_value(item, target, new_path))
    return results

res = find_value(data, target_val)
print("Matches in serverVars_data:")
for path, val in res:
    print(f"  {path} -> {val}")

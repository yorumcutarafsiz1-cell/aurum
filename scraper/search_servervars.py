import json
import re

with open("server_vars_full.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Search recursively for the string "Kristian"
def search_dict(d, query, path=""):
    results = []
    if isinstance(d, dict):
        for k, v in d.items():
            new_path = f"{path}.{k}" if path else k
            if query.lower() in str(k).lower():
                results.append((new_path, "Key match"))
            results.extend(search_dict(v, query, new_path))
    elif isinstance(d, list):
        for i, item in enumerate(d):
            new_path = f"{path}[{i}]"
            results.extend(search_dict(item, query, new_path))
    elif isinstance(d, str):
        if query.lower() in d.lower():
            results.append((path, d[:100]))
    return results

res = search_dict(data, "Kristian")
print("Found matches in server_vars_full.json:")
for path, snippet in res[:10]:
    print(f"  Path: {path} -> {snippet}")

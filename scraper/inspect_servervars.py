import re
import json

# Read the local detail HTML we saved earlier
with open("detail_sample.html", "r", encoding="utf-8") as f:
    html = f.read()

# Extract content of id="serverVars_data"
match = re.search(r'<script id="serverVars_data" type="application/json">(.*?)</script>', html)
if match:
    data = json.loads(match.group(1))
    print("Found serverVars_data JSON!")
    print("Keys in JSON:", list(data.keys()))
    
    # Save first level keys and some sample structure to inspect
    with open("server_vars_keys.json", "w", encoding="utf-8") as f:
        json.dump(list(data.keys()), f, indent=2)
        
    # Let's inspect the apollo cache if it's there
    # Usually it is under 'apolloState' or 'cache' or in 'graphql'
    # Let's search inside the dictionary for some product details
    # We will save the whole dictionary pretty printed so we can inspect it or write scripts to query it
    with open("server_vars_full.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        
    print("Saved serverVars_data to server_vars_full.json")
else:
    print("serverVars_data not found in HTML!")

import json

with open("server_vars_full.json", "r", encoding="utf-8") as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'8286|8,286', text)]
print(f"Found {len(matches)} string matches in serverVars_data:")
for idx in matches[:5]:
    start = max(0, idx - 50)
    end = min(len(text), idx + 50)
    print(f"  Snippet: ... {text[start:end]} ...")

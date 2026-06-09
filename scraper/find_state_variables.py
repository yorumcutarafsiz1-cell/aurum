import re
import json

with open("detail_sample.html", "r", encoding="utf-8") as f:
    html = f.read()

print("Searching for __APOLLO_STATE__...")
apollo_state = re.search(r'window\.__APOLLO_STATE__\s*=\s*({.*?});', html)
if apollo_state:
    print("Found window.__APOLLO_STATE__!")
    print("Length:", len(apollo_state.group(1)))
    # Save a snippet
    with open("apollo_state_snippet.json", "w", encoding="utf-8") as f:
        f.write(apollo_state.group(1)[:10000])
else:
    print("window.__APOLLO_STATE__ not found.")

# Let's search for any window.xxx = { ... } object in the HTML
matches = re.finditer(r'window\s*\.\s*([a-zA-Z0-9_]+)\s*=\s*({.*?});\s*</script>', html, re.DOTALL)
found_any = False
for match in matches:
    found_any = True
    var_name = match.group(1)
    content = match.group(2)
    print(f"Found variable: window.{var_name}, content length: {len(content)}")
    with open(f"var_{var_name}.json", "w", encoding="utf-8") as f:
        f.write(content[:50000])

if not found_any:
    # Try another pattern, maybe there's no space before window
    matches2 = re.finditer(r'window\s*\.\s*([a-zA-Z0-9_]+)\s*=\s*({.*?});', html, re.DOTALL)
    for match in matches2:
         print(f"Found variable (no script end): window.{match.group(1)}, content length: {len(match.group(2))}")

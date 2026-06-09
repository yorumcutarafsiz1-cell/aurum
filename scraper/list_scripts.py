import re

with open("detail_sample.html", "r", encoding="utf-8") as f:
    html = f.read()

# Find all script tags
scripts = re.findall(r'<script([^>]*)>(.*?)</script>', html, re.DOTALL)
print(f"Total script tags: {len(scripts)}")

for i, (attrs, content) in enumerate(scripts):
    content_stripped = content.strip()
    if not content_stripped:
        print(f"Script {i}: Empty (Attrs: {attrs})")
        continue
        
    print(f"Script {i} (Length: {len(content_stripped)}, Attrs: {attrs}):")
    print(content_stripped[:300] + "...")
    print("-" * 50)

import json
import re

with open('levels_generated.json', 'r') as f:
    levels = json.load(f)

levels_js = json.dumps(levels, indent=2)

with open('src/components/FlipWords.tsx', 'r') as f:
    content = f.read()

# Find const allLevels: Level[] = [ ... ];
pattern = r'const allLevels: Level\[\] = \[\s*\{.*?\n\];'
match = re.search(pattern, content, re.DOTALL)
if match:
    new_content = content[:match.start()] + f"const allLevels: Level[] = {levels_js};" + content[match.end():]
    with open('src/components/FlipWords.tsx', 'w') as f:
        f.write(new_content)
    print("Patched FlipWords.tsx")
else:
    print("Could not find allLevels array in FlipWords.tsx")

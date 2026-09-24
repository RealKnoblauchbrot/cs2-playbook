"""List i18n keys used in src/ that are missing from each locale file."""
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
used = set()
dynamic = set()
for f in glob.glob(os.path.join(ROOT, "src", "**", "*.ts*"), recursive=True):
    s = open(f, encoding="utf-8").read()
    for m in re.finditer(r'\bt\(\s*"([^"]+)"', s):
        used.add(m.group(1))
    for m in re.finditer(r'\bt\(\s*`([^`]+)`', s):
        k = m.group(1)
        (dynamic if "${" in k else used).add(k)

def flat(d, p=""):
    out = {}
    for k, v in d.items():
        key = f"{p}.{k}" if p else k
        if isinstance(v, dict):
            out.update(flat(v, key))
        else:
            out[key] = v
    return out

ok = True
for loc in sorted(glob.glob(os.path.join(ROOT, "src", "locales", "*.json"))):
    keys = flat(json.load(open(loc, encoding="utf-8")))
    missing = sorted(k for k in used if k not in keys and f"{k}_other" not in keys)
    if missing:
        ok = False
        print(f"{os.path.basename(loc)} missing {len(missing)}:")
        for k in missing:
            print("  ", k)
# Other locales should mirror en.json (missing keys fall back to English).
en = flat(json.load(open(os.path.join(ROOT, "src", "locales", "en.json"), encoding="utf-8")))
for loc in sorted(glob.glob(os.path.join(ROOT, "src", "locales", "*.json"))):
    if loc.endswith("en.json"):
        continue
    keys = flat(json.load(open(loc, encoding="utf-8")))
    gap = sorted(set(en) - set(keys))
    if gap:
        print(f"{os.path.basename(loc)} lacks {len(gap)} keys present in en.json (falls back to English):")
        for k in gap:
            print("  ", k)
if "-d" in sys.argv:
    print("dynamic patterns:")
    for k in sorted(dynamic):
        print("  ", k)
sys.exit(0 if ok else 1)

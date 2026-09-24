"""
Extract map radars, callouts, map icons, cover images and equipment icons
from a local CS2 installation into the app's public/ and src/data/ folders.

Requirements:
  - Python 3.10+ with Pillow  (pip install pillow)
  - Source2Viewer CLI (https://github.com/ValveResourceFormat/ValveResourceFormat/releases)

Usage:
  python tools/extract_assets.py --cli path/to/Source2Viewer-CLI.exe [--cs2 "path/to/game/csgo"]

Re-run whenever Valve updates map radars. Callout positions are derived from the
maps' env_cs_place entities (bounding boxes of their hulls) and the HLTV overview
files (pos_x / pos_y / scale), names come from csgo_english.txt.
"""
import argparse
import collections
import json
import math
import os
import re
import shutil
import struct
import subprocess
import tempfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_CS2 = r"C:/Program Files (x86)/Steam/steamapps/common/Counter-Strike Global Offensive/game/csgo"

MAPS = {
    "de_dust2": "Dust II",
    "de_mirage": "Mirage",
    "de_inferno": "Inferno",
    "de_nuke": "Nuke",
    "de_ancient": "Ancient",
    "de_anubis": "Anubis",
    "de_vertigo": "Vertigo",
    "de_overpass": "Overpass",
    "de_train": "Train",
    "de_cache": "Cache",
}

EQUIPMENT = [
    "smokegrenade", "flashbang", "molotov", "incgrenade", "hegrenade", "decoy",
    "c4", "defuser", "kevlar", "assaultsuit", "taser", "knife",
    "glock", "usp_silencer", "hkp2000", "p250", "tec9", "fiveseven", "cz75a", "deagle", "elite", "revolver",
    "mac10", "mp9", "mp7", "mp5sd", "ump45", "p90", "bizon",
    "nova", "xm1014", "mag7", "sawedoff", "negev", "m249",
    "galilar", "famas", "ak47", "m4a1", "m4a1_silencer", "sg556", "aug",
    "ssg08", "awp", "g3sg1", "scar20",
]


def run(cli, *args):
    subprocess.run([cli, *args], check=True, capture_output=True)


def parse_overview(path):
    txt = open(path, encoding="utf-8", errors="ignore").read()
    txt = re.sub(r"//[^\n]*", "", txt)
    toks = [a if a else b for a, b in re.findall(r'"([^"]*)"|([{}])', txt)]

    def block(i):
        d = {}
        while i < len(toks):
            if toks[i] == "}":
                return d, i + 1
            k, v = toks[i], toks[i + 1]
            if v == "{":
                d[k], i = block(i + 2)
            else:
                d[k] = v
                i += 2
        return d, i

    root, _ = block(0)
    return next(iter(root.values()))


def hull_verts(path):
    """First vec3 array in a binary DMX = hull vertex positions (entity-local)."""
    b = open(path, "rb").read()
    start = max(b.find(b"Generated with"), 0)
    for i in range(start, len(b) - 4):
        n = struct.unpack_from("<i", b, i)[0]
        if 4 <= n <= 20000 and i + 4 + n * 12 <= len(b):
            fl = struct.unpack_from("<%df" % (n * 3), b, i + 4)
            if all(math.isfinite(f) and abs(f) < 20000 for f in fl) and len(set(fl)) > 3 \
                    and all(abs(f) > 1e-3 or f == 0 for f in fl):
                return [fl[j:j + 3] for j in range(0, len(fl), 3)]
    return None


def load_localization(path):
    loc = {}
    for line in open(path, encoding="utf-8", errors="ignore"):
        m = re.match(r'\s*"([^"]+)"\s+"([^"]*)"', line)
        if m:
            loc.setdefault(m.group(1).lower(), m.group(2))
    return loc


def extract_callouts(cli, cs2, tmp, mp, ov, loc):
    ents_dir = os.path.join(tmp, "maps", mp, "entities")
    run(cli, "-i", f"{cs2}/maps/{mp}.vpk", "-o", tmp, "-d", "-f", f"maps/{mp}/entities/")
    pos_x, pos_y, scale = float(ov["pos_x"]), float(ov["pos_y"]), float(ov["scale"])
    vs = ov.get("verticalsections")
    lower_max = float(vs["lower"]["AltitudeMax"]) if isinstance(vs, dict) and "lower" in vs else None

    txt = open(os.path.join(ents_dir, "default_ents.vents"), encoding="utf-8", errors="ignore").read()
    files = os.listdir(ents_dir)
    places = collections.defaultdict(list)
    for blk in txt.split("===="):
        if '"env_cs_place"' not in blk:
            continue
        name = re.search(r'place_name\s+"([^"]+)"', blk)
        org = re.search(r'origin\s+\[\s*([-\d.e]+),\s*([-\d.e]+),\s*([-\d.e]+)\s*\]', blk)
        ang = re.search(r'angles\s+\[\s*([-\d.e]+),\s*([-\d.e]+),\s*([-\d.e]+)\s*\]', blk)
        mdl = re.search(r'model\s+resource_name:"[^"]*/([^/"]+)\.vmdl"', blk)
        if not name or not org:
            continue
        x, y, z = map(float, org.groups())
        yaw = math.radians(float(ang.group(2))) if ang else 0.0
        boxes = []
        if mdl:
            for fn in files:
                if fn.startswith(mdl.group(1) + "_hull") and fn.endswith(".dmx"):
                    verts = hull_verts(os.path.join(ents_dir, fn))
                    if verts:
                        wx = [x + vx * math.cos(yaw) - vy * math.sin(yaw) for vx, vy, _ in verts]
                        wy = [y + vx * math.sin(yaw) + vy * math.cos(yaw) for vx, vy, _ in verts]
                        wz = [z + vz for _, _, vz in verts]
                        boxes.append((min(wx), min(wy), max(wx), max(wy), (min(wz) + max(wz)) / 2))
        if not boxes:
            boxes = [(x - 64, y - 64, x + 64, y + 64, z)]
        for bx0, by0, bx1, by1, cz in boxes:
            level = "lower" if (lower_max is not None and cz < lower_max) else "default"
            places[(name.group(1), level)].append((bx0, by0, bx1, by1))

    callouts = []
    for (key, level), boxes in sorted(places.items()):
        areas = [max((b[2] - b[0]) * (b[3] - b[1]), 1) for b in boxes]
        tot = sum(areas)
        cx = sum((b[0] + b[2]) / 2 * a for b, a in zip(boxes, areas)) / tot
        cy = sum((b[1] + b[3]) / 2 * a for b, a in zip(boxes, areas)) / tot
        if not any(b[0] <= cx <= b[2] and b[1] <= cy <= b[3] for b in boxes):
            big = max(zip(boxes, areas), key=lambda t: t[1])[0]
            cx, cy = (big[0] + big[2]) / 2, (big[1] + big[3]) / 2
        px = (cx - pos_x) / scale / 1024
        py = (pos_y - cy) / scale / 1024
        if not (0 <= px <= 1 and 0 <= py <= 1):
            continue
        name = loc.get(key.lower(), re.sub(r"(?<=[a-z])(?=[A-Z])", " ", key))
        callouts.append({"key": key, "name": name, "x": round(px, 4), "y": round(py, 4), "level": level})
    return callouts, lower_max


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cli", required=True, help="Path to Source2Viewer-CLI.exe")
    ap.add_argument("--cs2", default=DEFAULT_CS2, help="Path to .../game/csgo")
    args = ap.parse_args()
    cli, cs2 = args.cli, args.cs2
    pak = f"{cs2}/pak01_dir.vpk"

    out_maps = os.path.join(ROOT, "public", "assets", "maps")
    out_equip = os.path.join(ROOT, "public", "assets", "equipment")
    os.makedirs(out_maps, exist_ok=True)
    os.makedirs(out_equip, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        print("Extracting overviews, radars, icons from pak01 ...")
        run(cli, "-i", pak, "-o", tmp, "-d", "-f",
            "panorama/images/overheadmaps/,resource/overviews/,panorama/images/icons/equipment/,"
            "panorama/images/map_icons/map_icon_")
        run(cli, "-i", pak, "-o", tmp, "-f", "resource/csgo_english.txt")
        loc = load_localization(os.path.join(tmp, "resource", "csgo_english.txt"))

        maps_json = []
        for mp, display in MAPS.items():
            print("Map", mp)
            dst = os.path.join(out_maps, mp)
            os.makedirs(dst, exist_ok=True)
            ov = parse_overview(os.path.join(tmp, "resource", "overviews", f"{mp}.txt"))
            levels = [{"id": "default", "name": "Upper" if mp in ("de_nuke", "de_vertigo", "de_train") else "Main"}]
            radar_dir = os.path.join(tmp, "panorama", "images", "overheadmaps")
            Image.open(os.path.join(radar_dir, f"{mp}_radar_psd.png")).save(
                os.path.join(dst, "radar.webp"), lossless=True, quality=100, method=6)
            lower_png = os.path.join(radar_dir, f"{mp}_lower_radar_psd.png")
            if os.path.exists(lower_png):
                Image.open(lower_png).save(os.path.join(dst, "radar_lower.webp"), lossless=True, quality=100, method=6)
                levels.append({"id": "lower", "name": "Lower"})

            icon = os.path.join(tmp, "panorama", "images", "map_icons", f"map_icon_{mp}.svg")
            if os.path.exists(icon):
                shutil.copy(icon, os.path.join(dst, "icon.svg"))

            run(cli, "-i", pak, "-o", tmp, "-d", "-f", f"panorama/images/map_icons/screenshots/1080p/{mp}_png.vtex_c")
            shot = os.path.join(tmp, "panorama", "images", "map_icons", "screenshots", "1080p", f"{mp}_png.png")
            if os.path.exists(shot):
                im = Image.open(shot).convert("RGB")
                im.thumbnail((640, 360))
                im.save(os.path.join(dst, "cover.webp"), quality=82, method=6)

            callouts, lower_max = extract_callouts(cli, cs2, tmp, mp, ov, loc)

            def pt(k):
                return [float(ov.get(f"{k}_x", 0)), float(ov.get(f"{k}_y", 0))]

            maps_json.append({
                "id": mp,
                "name": display,
                "levels": levels,
                "posX": float(ov["pos_x"]),
                "posY": float(ov["pos_y"]),
                "scale": float(ov["scale"]),
                "lowerAltitudeMax": lower_max,
                "tSpawn": pt("TSpawn"),
                "ctSpawn": pt("CTSpawn"),
                "bombA": pt("bombA"),
                "bombB": pt("bombB"),
                "callouts": callouts,
            })
            print(f"  {len(callouts)} callouts, levels: {[l['id'] for l in levels]}")

        equip_dir = os.path.join(tmp, "panorama", "images", "icons", "equipment")
        for name in EQUIPMENT:
            src = os.path.join(equip_dir, f"{name}.svg")
            if os.path.exists(src):
                svg = open(src, encoding="utf-8").read()
                # Force white fill so icons can be tinted via CSS / canvas.
                svg = re.sub(r'fill="(?!none)[^"]*"', 'fill="#ffffff"', svg)
                open(os.path.join(out_equip, f"{name}.svg"), "w", encoding="utf-8").write(svg)
            else:
                print("  missing equipment icon:", name)

    with open(os.path.join(ROOT, "src", "data", "maps.generated.json"), "w", encoding="utf-8") as f:
        json.dump(maps_json, f, indent=1, ensure_ascii=False)
    print("Done.")


if __name__ == "__main__":
    main()

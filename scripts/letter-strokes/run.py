import io, re, json, sys, math
from PIL import Image, ImageDraw
import numpy as np
from strokes import build, ZWJ
from hints import HINTS

src = io.open("../../src/data/arabicAlphabet.ts", encoding="utf-8").read()
rows = re.findall(r'id: (\d+),.*?isolated: "([^"]+)", initial: "([^"]+)", medial: "([^"]+)", final: "([^"]+)"', src)

def sample(d):
    pts = []; pos = None
    for cmd, args in re.findall(r"([MLQ])([^MLQ]*)", d):
        n = [float(v) for v in args.split()]
        if cmd == "M": pos = (n[0], n[1]); pts.append(pos)
        elif cmd == "L": pos = (n[0], n[1]); pts.append(pos)
        else:
            c = (n[0], n[1]); e = (n[2], n[3])
            for t in np.linspace(0, 1, 8)[1:]:
                pts.append(((1-t)**2*pos[0]+2*(1-t)*t*c[0]+t**2*e[0], (1-t)**2*pos[1]+2*(1-t)*t*c[1]+t**2*e[1]))
            pos = e
    return pts

COL = [(200, 40, 40), (40, 90, 200), (30, 150, 60)]
def preview(data, title):
    S = 300
    img = Image.fromarray(np.where(data["_mask"], 205, 255).astype("uint8")).convert("RGB")
    dr = ImageDraw.Draw(img)
    for i, st in enumerate(data["strokes"]):
        pts = sample(st["d"])
        dr.line(pts, fill=COL[i % 3], width=9)
        dr.ellipse([pts[0][0]-24, pts[0][1]-24, pts[0][0]+24, pts[0][1]+24], fill=(0, 170, 0))
        # flèches
        for j in range(8, len(pts)-1, 14):
            a, b = pts[j-3], pts[j]; ang = math.atan2(b[1]-a[1], b[0]-a[0])
            for s in (2.6, -2.6):
                dr.line([b, (b[0]+30*math.cos(ang+s), b[1]+30*math.sin(ang+s))], fill=(0, 0, 0), width=6)
        dr.rectangle([pts[-1][0]-16, pts[-1][1]-16, pts[-1][0]+16, pts[-1][1]+16], fill=(0, 0, 0))
    for m in data["marks"]:
        dr.ellipse([m["cx"]-m["r"], m["cy"]-m["r"], m["cx"]+m["r"], m["cy"]+m["r"]], outline=(230, 140, 0), width=6)
    return img.resize((S, S))

out = {}
tiles = []
only = sys.argv[1:] 
for id_, iso, ini, med, fin in rows:
    for form, key, text in (("initial", ini, iso + ZWJ), ("medial", med, ZWJ + iso + ZWJ), ("final", fin, ZWJ + iso)):
        if key == iso or key in out: continue
        if only and id_ not in only: continue
        print(id_, form, file=sys.stderr)
        data = build(text, form, HINTS.get((int(id_), form), {}))
        tiles.append((f"{id_} {form}", preview(data, key)))
        data.pop("_mask")
        out[key] = data
        print("  ", len(data["strokes"]), "traits", [s["length"] for s in data["strokes"]], len(data["marks"]), "marques", file=sys.stderr)

json.dump(out, io.open("forms.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
per = 12
for s in range(0, len(tiles), per):
    sheet = Image.new("RGB", (300*4, 320*3), (255, 255, 255))
    dr = ImageDraw.Draw(sheet)
    for i, (t, im) in enumerate(tiles[s:s+per]):
        x, y = (i % 4)*300, (i // 4)*320
        sheet.paste(im, (x, y+20)); dr.text((x+6, y+4), t, fill=(0, 0, 0))
    sheet.save(f"sheet{s//per}.png")
print(len(out), "formes")

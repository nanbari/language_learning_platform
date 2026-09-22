# Lignes d'écriture : où tombent, dans le repère 1000 × 1000 de chaque glyphe
# (isolé ou forme liée), la ligne de base de la police et la hauteur du corps
# des lettres (sommet de la dent du ـبـ).
#
# Les lettres isolées et les formes liées n'ont pas le même cadrage, et les
# isolées ne sortent pas exactement de cette police : on ne reporte que des
# proportions. Dans la police, la ligne de base et la hauteur du corps sont à
# une fraction de la hauteur du corps de chaque lettre (points exclus) ; la
# même fraction est appliquée au corps du tracé enregistré dans src/data.
#   python lines.py  -> lines.json, à reporter dans src/data/letterLines.ts
import io, re, json, sys
from gen import flatten
from strokes import ZWJ

def stored_outlines(path):
    src = io.open(path, encoding="utf-8").read()
    return {m.group(1): m.group(2) for m in re.finditer(r'"([^"]+)": \{\s*"outline": "([^"]+)"', src)}

def bbox(pts):
    return min(p[0] for p in pts), max(p[0] for p in pts), min(p[1] for p in pts), max(p[1] for p in pts)

def body_only(contours):
    """Le corps de la lettre sans ses points : les petits contours isolés (points) sont écartés.
    Certaines lettres isolées ont leurs points déplacés à la main : seul le corps sert à caler l'échelle."""
    x0, x1, y0, y1 = bbox([p for c in contours for p in c])
    size = max(x1 - x0, y1 - y0)
    keep = []
    for c in contours:
        cx0, cx1, cy0, cy1 = bbox(c)
        if max(cx1 - cx0, cy1 - cy0) >= 0.3 * size:
            keep.append(c)
    return keep

def bbox_1000(d):
    """Contours d'un tracé enregistré (commandes absolues M L H V Q C Z), points de contrôle compris."""
    contours, cur, x, y = [], [], 0.0, 0.0
    for cmd, args in re.findall(r"([MLHVQCZ])([^MLHVQCZ]*)", d):
        n = [float(v) for v in re.findall(r"-?\d+(?:\.\d+)?", args)]
        if cmd == "M":
            if len(cur) > 2: contours.append(cur)
            cur = []
        if cmd in "MLQC":
            for i in range(0, len(n), 2):
                x, y = n[i], n[i + 1]; cur.append((x, y))
        elif cmd == "H":
            for v in n: x = v; cur.append((x, y))
        elif cmd == "V":
            for v in n: y = v; cur.append((x, y))
    if len(cur) > 2: contours.append(cur)
    return bbox([p for c in body_only(contours) for p in c])

def bbox_font(text):
    return bbox([p for c in body_only(flatten(text)) for p in c])

alphabet = io.open("../../src/data/arabicAlphabet.ts", encoding="utf-8").read()
rows = re.findall(r'id: (\d+),.*?isolated: "([^"]+)", initial: "([^"]+)", medial: "([^"]+)", final: "([^"]+)"', alphabet)
stored = stored_outlines("../../src/data/letterStrokes.ts") | stored_outlines("../../src/data/letterFormStrokes.ts")

# Hauteur du corps : sommet de la dent du ب médial (sans son point), en unités police.
X_HEIGHT = max(p[1] for c in flatten(ZWJ + "ب" + ZWJ) for p in c if p[1] < 400)

out = {}
for id_, iso, ini, med, fin in rows:
    for key, text in ((iso, iso), (ini, iso + ZWJ), (med, ZWJ + iso + ZWJ), (fin, ZWJ + iso)):
        if key in out or key not in stored:
            continue
        # Les lettres isolées ne viennent pas exactement de cette police : on ne
        # reporte que des proportions. Dans la police (y vers le haut), la ligne
        # de base et la hauteur du corps sont à une fraction de la hauteur du
        # corps de la lettre depuis son sommet ; on applique la même fraction
        # au tracé enregistré (y vers le bas).
        sx0, sx1, sy0, sy1 = bbox_1000(stored[key])
        fx0, fx1, fy0, fy1 = bbox_font(text)
        at = lambda y_font: int(round(sy0 + (fy1 - y_font) / (fy1 - fy0) * (sy1 - sy0)))
        out[key] = {"baseline": at(0), "top": at(X_HEIGHT)}
        print(f"{key}	corps {int(sy0)}-{int(sy1)}	{out[key]}", file=sys.stderr)

json.dump(out, io.open("lines.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(len(out), "glyphes ; hauteur du corps", X_HEIGHT, "unités police")

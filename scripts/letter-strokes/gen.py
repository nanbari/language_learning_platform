# Génère le geste d'écriture des formes liées (début / milieu / fin) en naskh.
import sys, json, math, io
import numpy as np
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import DecomposingRecordingPen
from PIL import Image, ImageDraw, ImageChops
from skimage.morphology import skeletonize
from skimage.measure import label
import networkx as nx

FONT = "NotoNaskhArabic.ttf"
ZWJ = "‍"
blob = hb.Blob.from_file_path(FONT)
face = hb.Face(blob)
hbfont = hb.Font(face)
tt = TTFont(FONT)
glyphset = tt.getGlyphSet()
order = tt.getGlyphOrder()

def shape(text):
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {})
    out = []
    x = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        out.append((name, x + pos.x_offset, pos.y_offset))
        x += pos.x_advance
    return out

def flatten(text):
    """Contours (listes de points, unités police) du texte mis en forme, sans les glyphes ZWJ vides."""
    contours = []
    for name, ox, oy in shape(text):
        pen = DecomposingRecordingPen(glyphset)
        glyphset[name].draw(pen)
        cur = []
        last = None
        for op, args in pen.value:
            if op == "moveTo":
                cur = [args[0]]; last = args[0]
            elif op == "lineTo":
                cur.append(args[0]); last = args[0]
            elif op == "qCurveTo":
                pts = list(args)
                # points implicites entre hors-courbe consécutifs
                on = []
                for i in range(len(pts) - 1):
                    c = pts[i]
                    nxt = pts[i + 1]
                    end = nxt if i == len(pts) - 2 else ((c[0] + nxt[0]) / 2, (c[1] + nxt[1]) / 2)
                    on.append((c, end))
                for c, end in on:
                    for t in np.linspace(0, 1, 9)[1:]:
                        px = (1 - t) ** 2 * last[0] + 2 * (1 - t) * t * c[0] + t ** 2 * end[0]
                        py = (1 - t) ** 2 * last[1] + 2 * (1 - t) * t * c[1] + t ** 2 * end[1]
                        cur.append((px, py))
                    last = end
            elif op == "curveTo":
                c1, c2, end = args
                for t in np.linspace(0, 1, 9)[1:]:
                    px = (1-t)**3*last[0] + 3*(1-t)**2*t*c1[0] + 3*(1-t)*t**2*c2[0] + t**3*end[0]
                    py = (1-t)**3*last[1] + 3*(1-t)**2*t*c1[1] + 3*(1-t)*t**2*c2[1] + t**3*end[1]
                    cur.append((px, py))
                last = end
            elif op in ("closePath", "endPath"):
                if len(cur) > 2:
                    contours.append([(x + ox, y + oy) for x, y in cur])
                cur = []
    return contours

if __name__ == "__main__":
    for t in ["ب", "ب" + ZWJ, ZWJ + "ب" + ZWJ, ZWJ + "ب", ZWJ + "د"]:
        print([n for n, _, _ in shape(t)], len(flatten(t)))

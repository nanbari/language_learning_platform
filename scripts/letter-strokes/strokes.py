# Squelette -> traits du stylo pour une forme liée.
import math, json, io, re, sys
import numpy as np
from PIL import Image, ImageDraw, ImageChops
from skimage.morphology import skeletonize, medial_axis
from skimage.measure import label, regionprops
import networkx as nx
from gen import shape, glyphset, flatten, ZWJ
from fontTools.pens.recordingPen import DecomposingRecordingPen

K = 1.5          # agrandissement maximal
MAXBOX = 640
PRUNE = 38       # barbules du squelette plus courtes que ça : supprimées

def is_dot(name):
    return name.lower().startswith(("dot", "twodots", "threedots"))

def glyph_contours(name, ox, oy):
    return flatten_glyph(name, ox, oy)

def flatten_glyph(name, ox, oy):
    pen = DecomposingRecordingPen(glyphset)
    glyphset[name].draw(pen)
    contours, ops_out = [], []
    cur, last = [], None
    for op, args in pen.value:
        if op == "moveTo":
            cur = [args[0]]; last = args[0]; ops_out.append(("M", [args[0]]))
        elif op == "lineTo":
            cur.append(args[0]); last = args[0]; ops_out.append(("L", [args[0]]))
        elif op == "qCurveTo":
            pts = list(args)
            if pts[-1] is None:
                raise ValueError("contour sans point sur courbe")
            for i in range(len(pts) - 1):
                c = pts[i]; nxt = pts[i + 1]
                end = nxt if i == len(pts) - 2 else ((c[0] + nxt[0]) / 2, (c[1] + nxt[1]) / 2)
                for t in np.linspace(0, 1, 9)[1:]:
                    cur.append(((1-t)**2*last[0] + 2*(1-t)*t*c[0] + t**2*end[0], (1-t)**2*last[1] + 2*(1-t)*t*c[1] + t**2*end[1]))
                ops_out.append(("Q", [c, end])); last = end
        elif op == "curveTo":
            c1, c2, end = args
            for t in np.linspace(0, 1, 9)[1:]:
                cur.append(((1-t)**3*last[0]+3*(1-t)**2*t*c1[0]+3*(1-t)*t**2*c2[0]+t**3*end[0], (1-t)**3*last[1]+3*(1-t)**2*t*c1[1]+3*(1-t)*t**2*c2[1]+t**3*end[1]))
            ops_out.append(("C", [c1, c2, end])); last = end
        elif op in ("closePath", "endPath"):
            if len(cur) > 2:
                contours.append([(x + ox, y + oy) for x, y in cur])
            ops_out.append(("Z", [])); cur = []
    ops_out = [(o, [(x + ox, y + oy) for x, y in a]) for o, a in ops_out]
    return contours, ops_out

def raster(contours, tf):
    """Remplissage « non nul » : les contours pleins s'additionnent, les contre-formes se retranchent."""
    def area(c):
        return sum(x1*y2 - x2*y1 for (x1, y1), (x2, y2) in zip(c, c[1:] + c[:1])) / 2
    if not contours:
        return np.zeros((1000, 1000), dtype=bool)
    sign = 1 if area(max(contours, key=lambda c: abs(area(c)))) > 0 else -1
    solid = Image.new("1", (1000, 1000), 0)
    holes = Image.new("1", (1000, 1000), 0)
    for c in contours:
        target = solid if area(c) * sign > 0 else holes
        ImageDraw.Draw(target).polygon([tf(p) for p in c], fill=1)
    return np.array(solid, dtype=bool) & ~np.array(holes, dtype=bool)

NB = [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]

def skeleton_graph(mask):
    sk = skeletonize(mask)
    pts = set(zip(*np.nonzero(sk)))
    def nbrs(p):
        return [(p[0]+dy, p[1]+dx) for dy, dx in NB if (p[0]+dy, p[1]+dx) in pts]
    # graphe de pixels ; on retire les diagonales doublées par un chemin orthogonal
    PG = nx.Graph()
    for p in pts:
        PG.add_node(p)
    for p in pts:
        for q in nbrs(p):
            if abs(p[0]-q[0]) + abs(p[1]-q[1]) == 2:
                if (p[0], q[1]) in pts or (q[0], p[1]) in pts:
                    continue
            PG.add_edge(p, q)
    special = [p for p in PG if PG.degree(p) != 2]
    # regroupe les pixels de jonction voisins
    SG = PG.subgraph([p for p in special if PG.degree(p) > 2])
    cluster = {}
    for i, comp in enumerate(nx.connected_components(SG)):
        for p in comp:
            cluster[p] = ("J", i)
    for p in special:
        if PG.degree(p) == 1:
            cluster[p] = ("E", p)
        elif PG.degree(p) == 0:
            cluster[p] = ("I", p)
    G = nx.MultiGraph()
    centers = {}
    for p, cid in cluster.items():
        centers.setdefault(cid, []).append(p)
    for cid, ps in centers.items():
        G.add_node(cid, pos=(float(np.mean([q[1] for q in ps])), float(np.mean([q[0] for q in ps]))))
    seen = set()
    for p in cluster:
        for q in PG.neighbors(p):
            if q in cluster:
                if cluster[q] != cluster[p] and (q, p) not in seen:
                    seen.add((p, q))
                    G.add_edge(cluster[p], cluster[q], path=[p, q])
                continue
            if (p, q) in seen:
                continue
            path = [p, q]; prev, curp = p, q
            while curp not in cluster:
                nxts = [r for r in PG.neighbors(curp) if r != prev]
                if not nxts:
                    break
                prev, curp = curp, nxts[0]
                path.append(curp)
            if curp in cluster:
                seen.add((p, q)); seen.add((curp, path[-2]))
                G.add_edge(cluster[p], cluster[curp], path=path)
    if G.number_of_nodes() == 0 and pts:
        # boucle pure, sans jonction ni extrémité
        start = min(pts)
        path = [start]; prev = None; curp = start
        while True:
            nxts = [r for r in PG.neighbors(curp) if r != prev]
            if not nxts: break
            prev, curp = curp, nxts[0]
            if curp == start: break
            path.append(curp)
        path.append(start)
        G.add_node(("J", 0), pos=(start[1], start[0]))
        G.add_edge(("J", 0), ("J", 0), path=path)
    return G

def plen(path):
    return sum(math.hypot(a[0]-b[0], a[1]-b[1]) for a, b in zip(path, path[1:]))

def simplify(G, prune=None, protect=()):
    PRUNE = prune if prune is not None else globals()['PRUNE']
    """Supprime les barbules puis fusionne les noeuds de degré 2."""
    changed = True
    while changed:
        changed = False
        for u, v, k, d in list(G.edges(keys=True, data=True)):
            if u == v: continue
            for a in (u, v):
                if G.degree(a) == 1 and a not in protect and plen(d["path"]) < PRUNE and G.degree(v if a == u else u) > 2:
                    G.remove_edge(u, v, k); G.remove_node(a); changed = True; break
            if changed: break
        if changed: continue
        for n in list(G.nodes):
            if G.degree(n) == 2:
                es = list(G.edges(n, keys=True, data=True))
                if len(es) == 2 and es[0][1] != n and es[1][1] != n or (len(es) == 2 and not any(e[0] == e[1] for e in es)):
                    (a1, b1, k1, d1), (a2, b2, k2, d2) = es
                    o1 = b1 if a1 == n else a1
                    o2 = b2 if a2 == n else a2
                    if (a1, b1, k1) == (a2, b2, k2): continue
                    p1 = orient(d1["path"], G, o1, n)
                    p2 = orient(d2["path"], G, n, o2)
                    G.remove_edge(a1, b1, k1); G.remove_edge(a2, b2, k2); G.remove_node(n)
                    G.add_edge(o1, o2, path=p1 + p2[1:]); changed = True; break
    return G

def orient(path, G, a, b):
    """Chemin de pixels orienté de a vers b (positions des noeuds)."""
    pa = G.nodes[a]["pos"]
    d0 = math.hypot(path[0][1]-pa[0], path[0][0]-pa[1])
    d1 = math.hypot(path[-1][1]-pa[0], path[-1][0]-pa[1])
    if a == b:
        return path
    return path if d0 <= d1 else path[::-1]

def signed_area(path):
    s = 0
    for (y1, x1), (y2, x2) in zip(path, path[1:] + path[:1]):
        s += x1 * y2 - x2 * y1
    return s / 2   # > 0 : sens horaire à l'écran (y vers le bas)

def near(G, ends, anchor):
    return min(ends, key=lambda n: math.hypot(G.nodes[n]["pos"][0]-anchor[0], (G.nodes[n]["pos"][1]-anchor[1]) * 2))

def trails(G, form, hints, anchors):
    """Décompose le squelette en traits ordonnés (listes de pixels)."""
    G = G.copy()
    pos = lambda n: G.nodes[n]["pos"]
    extra = []
    ends = [n for n in G if G.degree(n) == 1]
    keep = set()
    if ends:
        if form in ("medial", "final"): keep.add(near(G, ends, anchors[1]))
        if form in ("medial", "initial"): keep.add(near(G, ends, anchors[0]))
    stubs = set(keep)
    def pendant_len(n):
        (u, v, k, d), = list(G.edges(n, keys=True, data=True))
        return plen(d["path"])
    rest = [n for n in ends if n not in keep]
    if rest and form == "final" and hints.get("tail") != "none":
        keep.add(min(rest, key=lambda n: pos(n)[0]) if hints.get("tail") == "left" else max(rest, key=pendant_len))   # le bout de la queue : fin du geste
    if rest and form == "initial" and hints.get("start") != "none":
        side = hints.get("start", "right")
        keep.add(max(rest, key=lambda n: pos(n)[0] if side == "right" else -pos(n)[0]) if side != "top" else min(rest, key=lambda n: pos(n)[1]))
    def odd(): return [n for n in G if G.degree(n) % 2 == 1]
    while len(odd()) > 2:
        cands = [n for n in G if G.degree(n) == 1 and n not in keep]
        if not cands: break
        n = min(cands, key=lambda n: pos(n)[1])          # l'extrémité la plus haute
        (u, v, k, d), = list(G.edges(n, keys=True, data=True))
        other = v if u == n else u
        if hints.get("stem") and len(extra) < hints["stem"]:
            # trait à part, posé ensuite de haut en bas (hampe du ط, barre du ك)
            extra.append(orient(d["path"], G, n, other))
            G.remove_edge(u, v, k); G.remove_node(n)
            simplify(G, prune=0)
        else:
            # dent : le stylo monte puis redescend sur le même chemin
            G.add_edge(u, v, path=d["path"])
            keep.add(n)
    # jonctions impaires restantes (boucle à deux jonctions) : on repasse sur le plus court chemin
    while len(odd()) > 2:
        free = [n for n in odd() if n not in keep] if len([n for n in odd() if n in keep]) == 2 or form != "medial" else odd()
        free = [n for n in odd() if G.degree(n) > 1] or free
        best = None
        W = nx.Graph()
        for u, v, d in G.edges(data=True):
            w = plen(d["path"])
            if u != v and (not W.has_edge(u, v) or W[u][v]["w"] > w): W.add_edge(u, v, w=w, path=d["path"])
        for i in range(len(free)):
            for j in range(i + 1, len(free)):
                try: L = nx.shortest_path_length(W, free[i], free[j], weight="w")
                except Exception: continue
                if best is None or L < best[0]: best = (L, free[i], free[j])
        if best is None: break
        sp = nx.shortest_path(W, best[1], best[2], weight="w")
        for u, v in zip(sp, sp[1:]):
            G.add_edge(u, v, path=W[u][v]["path"])
    out = []
    for comp in nx.connected_components(G):
        H = G.subgraph(comp).copy()
        if H.number_of_edges() == 0: continue
        o = [n for n in H if H.degree(n) % 2 == 1]
        if len(o) == 2:
            kept = [n for n in o if n in keep and H.degree(n) == 1]
            if form == "initial":
                end = near(H, o, anchors[0])
                start = [n for n in o if n != end][0]
            else:
                start = near(H, o, anchors[1])
            if hints.get("reverse"): start = [n for n in o if n != start][0]
        else:
            start = min(H.nodes, key=lambda n: pos(n)[1])
            if len(o): print("   !! noeuds impairs:", len(o), file=sys.stderr)
        edges = [(u, v, k, H.edges[u, v, k]["path"]) for u, v, k in H.edges(keys=True)]
        best = [None, -1e18]
        want_cw = not hints.get("ccw")
        def rec(node, used, pix, count=[0]):
            if count[0] > 4000: return
            if len(used) == len(edges):
                count[0] += 1
                area = signed_area(pix)
                score = area if want_cw else -area
                if score > best[1]: best[0], best[1] = list(pix), score
                return
            for i, (u, v, k, p) in enumerate(edges):
                if i in used or node not in (u, v): continue
                opts = [p, p[::-1]] if u == v else [orient(p, H, node, v if node == u else u)]
                for q in opts:
                    nxt = v if node == u else u
                    rec(nxt, used | {i}, pix + (q if not pix else q[1:]))
        rec(start, frozenset(), [])
        if best[0] is None:
            print("   !! pas de parcours", file=sys.stderr); continue
        out.append(best[0])
    out.sort(key=lambda p: -plen(p))
    return out + extra

def smooth_path(pix, dist, step=22):
    """Pixels -> points espacés, prolongés jusqu'au bout du plein, puis chemin en Q."""
    pts = [(float(x), float(y)) for y, x in pix]
    closed = math.hypot(pts[0][0]-pts[-1][0], pts[0][1]-pts[-1][1]) < 3 and len(pts) > 20
    def extend(p, q, r):
        dx, dy = p[0]-q[0], p[1]-q[1]; n = math.hypot(dx, dy) or 1
        return (p[0] + dx/n*r, p[1] + dy/n*r)
    if not closed and len(pts) > 12:
        r0 = dist[int(pts[0][1]), int(pts[0][0])] * 0.75
        r1 = dist[int(pts[-1][1]), int(pts[-1][0])] * 0.75
        pts = [extend(pts[0], pts[min(10, len(pts)-1)], r0)] + pts + [extend(pts[-1], pts[max(-11, -len(pts))], r1)]
    # moyenne glissante
    sm = []
    w = 6
    for i in range(len(pts)):
        lo, hi = max(0, i-w), min(len(pts), i+w+1)
        if i < w or i >= len(pts)-w:
            lo, hi = max(0, i - min(i, len(pts)-1-i)), i + min(i, len(pts)-1-i) + 1
        sm.append((sum(p[0] for p in pts[lo:hi])/(hi-lo), sum(p[1] for p in pts[lo:hi])/(hi-lo)))
    keep = [sm[0]]; acc = 0
    for a, b in zip(sm, sm[1:]):
        acc += math.hypot(a[0]-b[0], a[1]-b[1])
        if acc >= step:
            keep.append(b); acc = 0
    if keep[-1] != sm[-1]:
        if math.hypot(keep[-1][0]-sm[-1][0], keep[-1][1]-sm[-1][1]) < step/2 and len(keep) > 1: keep[-1] = sm[-1]
        else: keep.append(sm[-1])
    length = sum(math.hypot(a[0]-b[0], a[1]-b[1]) for a, b in zip(sm, sm[1:]))
    r = lambda v: str(int(round(v)))
    if len(keep) < 3:
        d = f"M{r(keep[0][0])} {r(keep[0][1])}L{r(keep[-1][0])} {r(keep[-1][1])}"
    else:
        d = f"M{r(keep[0][0])} {r(keep[0][1])}"
        for i in range(1, len(keep)-2):
            c = keep[i]; e = ((keep[i][0]+keep[i+1][0])/2, (keep[i][1]+keep[i+1][1])/2)
            d += f"Q{r(c[0])} {r(c[1])} {r(e[0])} {r(e[1])}"
        d += f"Q{r(keep[-2][0])} {r(keep[-2][1])} {r(keep[-1][0])} {r(keep[-1][1])}"
    return d, int(round(length)), keep

def advances(text):
    import uharfbuzz as hb
    from gen import hbfont
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties(); hb.shape(hbfont, buf, {})
    return [p.x_advance for p in buf.glyph_positions]

def build(text, form, hints=None):
    hints = hints or {}
    glyphs = [(n, ox, oy) for n, ox, oy in shape(text) if n != "space"]
    body_c, dot_c, ops_all = [], [], []
    for n, ox, oy in glyphs:
        cs, ops = flatten_glyph(n, ox, oy)
        (dot_c if is_dot(n) else body_c).extend(cs)
        ops_all += ops
    allp = [p for c in body_c + dot_c for p in c]
    x0, x1 = min(p[0] for p in allp), max(p[0] for p in allp)
    y0, y1 = min(p[1] for p in allp), max(p[1] for p in allp)
    k = min(K, MAXBOX / max(x1-x0, y1-y0))
    cx, cy = (x0+x1)/2, (y0+y1)/2
    tf = lambda p: (500 + (p[0]-cx)*k, 500 - (p[1]-cy)*k)
    r = lambda v: str(int(round(v)))
    outline = ""
    for o, a in ops_all:
        outline += o + " ".join(f"{r(tf(p)[0])} {r(tf(p)[1])}" for p in a)
    adv = sum(a for a in advances(text))
    anchors = (tf((0, 45)), tf((adv, 45)))
    body = raster(body_c, tf)
    marks = []
    lab = label(body, connectivity=2)
    regs = sorted(regionprops(lab), key=lambda g: -g.area)
    main = lab == regs[0].label
    for g in regs[1:]:
        if g.area < 200: continue
        marks.append({"cx": int(round(g.centroid[1])), "cy": int(round(g.centroid[0])), "r": int(round(max(g.bbox[2]-g.bbox[0], g.bbox[3]-g.bbox[1]) / 2 * 1.15))})
    if dot_c:
        dl = label(raster(dot_c, tf), connectivity=2)
        for g in regionprops(dl):
            if g.area < 100: continue
            marks.append({"cx": int(round(g.centroid[1])), "cy": int(round(g.centroid[0])), "r": int(round(math.sqrt(g.area / math.pi) * 1.5))})
    _, dist = medial_axis(main, return_distance=True)
    G = skeleton_graph(main)
    ends = [n for n in G if G.degree(n) == 1]
    protect = set()
    if ends:
        px = lambda n: G.nodes[n]["pos"][0]
        if form in ("medial", "final"): protect.add(near(G, ends, anchors[1]))
        if form in ("medial", "initial"): protect.add(near(G, ends, anchors[0]))
    G = simplify(G, prune=float(dist.max()) * hints.get("prune", 2.2), protect=protect)
    strokes = []
    for pix in trails(G, form, hints, anchors):
        d, length, _ = smooth_path(pix, dist)
        ws = [dist[y, x] for y, x in pix]
        width = int(round(max(ws) * 2 * 1.12))
        strokes.append({"d": d, "width": width, "length": length})
    full = body | (raster(dot_c, tf) if dot_c else False)
    return {"outline": outline, "strokes": strokes, "marks": marks, "_mask": full}

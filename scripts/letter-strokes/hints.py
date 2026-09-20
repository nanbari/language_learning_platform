# Sens des boucles : ف ق و tournent dans le sens inverse des aiguilles, comme les lettres isolées.
HINTS = {}
for i in (20, 21, 27):
    for f in ("initial", "medial", "final"): HINTS[(i, f)] = {"ccw": True}
for i in (16, 17):
    for f in ("initial", "medial", "final"): HINTS[(i, f)] = {"stem": 1}
for i in (5, 6, 7):
    for f in ("initial", "medial", "final"): HINTS[(i, f)] = {"prune": 4.0, "start": "left"}
for i in (14, 15, 16, 17):
    HINTS.setdefault((i, "initial"), {})["start"] = "none"   # le geste part de la boucle, pas de la dent
for i in (16, 17):
    HINTS[(i, "final")]["tail"] = "left"
for i in (18, 19):
    HINTS[(i, "initial")] = {"start": "top"}
HINTS[(22, "medial")] = {"stem": 1}
HINTS[(26, "final")] = {"tail": "none"}   # ـه : on monte, puis la boucle se referme en bas

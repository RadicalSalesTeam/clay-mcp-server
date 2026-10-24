"""Niezależna weryfikacja wymiarów: odczyt geometrii z PDF (pdfplumber), przeliczenie pt -> mm.

Użycie: python3 weryfikuj_v4.py [plik.pdf] [SX] [SY] - SX/SY to korekta drukarki zapisana w PDF;
wymiary są przeliczane na mm "po wydruku".
"""
import sys
import pdfplumber
from collections import defaultdict

FILE = sys.argv[1] if len(sys.argv) > 1 else "szablon_otwory_v4_A4_x2.pdf"
SX = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
SY = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
PT = 25.4 / 72
PX, PY = PT / SX, PT / SY
pdf = pdfplumber.open(FILE)
p = pdf.pages[0]
print(f"Strona PDF: {p.width*PT:.2f} x {p.height*PT:.2f} mm, korekta X {SX:.4f} Y {SY:.4f}")
H = p.height

# środki wierceń = środki poziomych ramion krzyżyków o długości 8 mm
ARM = {(round((l['x1'] - l['x0']) * PX, 2)) for l in p.lines}
drills = sorted({(round((l['x0'] + l['x1']) / 2 * PX, 2), round((H - l['top']) * PY, 2))
                 for l in p.lines if abs(l['top'] - l['bottom']) < 1e-6 and round((l['x1'] - l['x0']) * PX, 2) in (5.0, 8.0)})
# kontury cięcia = zamknięte ścieżki

def bbox(o):
    return (o['x0'] * PX, (H - o['bottom']) * PY, o['x1'] * PX, (H - o['top']) * PY)

ok = True
def check(name, val, exp, tol=0.02):
    global ok
    good = abs(val - exp) <= tol
    ok &= good
    print(f"  {'OK ' if good else 'BŁĄD'} {name}: {val:.2f} mm (oczekiwane {exp})")

rows = defaultdict(list)
for x, y in drills:
    rows[y].append(x)
axes = (round(H * PY * 3 / 4, 2), round(H * PY / 4, 2))
objs = [o for o in p.curves] + [r for r in p.rects]
for n, ax in enumerate(axes, 1):
    print(f"Szablon {n} (oś y={ax} mm):")
    top, bot = sorted(rows[ax + 10]), sorted(rows[ax - 10])
    single = sorted(rows[ax])
    check("liczba otworów w rzędach", len(top) + len(bot), 12, 0)
    check("rozstaw poziomy bloku (min)", min(b - a for a, b in zip(top, top[1:])), 20)
    check("rozstaw poziomy bloku (max)", max(b - a for a, b in zip(top, top[1:])), 20)
    check("rozstaw pionowy rzędów", (ax + 10) - (ax - 10), 20)
    check("kolumny górne = dolne", max(abs(a - b) for a, b in zip(top, bot)), 0)
    check("ostatnia kolumna -> pojedynczy", single[0] - top[-1], 20)
    mine = [bbox(o) for o in objs if ax - 30 < (bbox(o)[1] + bbox(o)[3]) / 2 < ax + 30]
    rect = max(mine, key=lambda b: b[2] - b[0])
    check("pojedynczy -> lewa krawędź prostokąta", rect[0] - single[0], 20)
    check("szerokość prostokąta", rect[2] - rect[0], 103)
    check("wysokość prostokąta z wypustkami (33+2x2,5)", rect[3] - rect[1], 38)
    check("prostokąt symetryczny względem osi", (rect[1] + rect[3]) / 2, ax)
    # wypustki: punkty konturu na wysokości y = ±19
    r_obj = max([o for o in objs if ax - 30 < (bbox(o)[1] + bbox(o)[3]) / 2 < ax + 30], key=lambda o: o['x1'] - o['x0'])
    pts = [(x * PX, (H - y) * PY) for x, y in r_obj['pts']]
    ys = sorted({round(y, 2) for _, y in pts})
    tab_top = [x for x, y in pts if abs(y - max(ys)) < 0.01]
    body = sorted(ys)[-2]
    check("szerokość wypustki", max(tab_top) - min(tab_top), 21)
    check("wypustka centrycznie", (max(tab_top) + min(tab_top)) / 2 - (rect[0] + rect[2]) / 2, 0)
    check("wysokość wypustki", max(ys) - body, 2.5)
    wl = sorted([b for b in mine if b is not rect and 10 < (b[2] - b[0]) < 20], key=lambda b: b[1])
    check("liczba gniazd", len(wl), 2, 0)
    for k, b in enumerate(wl, 1):
        check(f"gniazdo {k} szerokość", b[2] - b[0], 16.5)
        check(f"gniazdo {k} wysokość całkowita", b[3] - b[1], 18.1)
        check(f"prostokąt -> gniazdo {k}", b[0] - rect[2], 20)
    check("odstęp między gniazdami (brzeg-brzeg)", wl[1][1] - wl[0][3], 10)
    check("para gniazd symetryczna względem osi", (wl[0][1] + wl[1][3]) / 2, ax)
    for b in wl:
        o = [o for o in p.curves if abs(bbox(o)[1] - b[1]) < 0.01 and abs(bbox(o)[0] - b[0]) < 0.01][0]
        q = [(x * PX, (H - y) * PY) for x, y in o['pts']]
        tp, bt, lf = max(y for _, y in q), min(y for _, y in q), min(x for x, _ in q)
        nt = [x for x, y in q if abs(y - tp) < 0.01]
        check("gniazdo: szerokość wypustu", max(nt) - min(nt), 8.1)
        check("gniazdo: wysokość korpusu", max(y for x, y in q if abs(x - lf) < 0.01) - bt, 13.8)
    print(f"  marginesy po wydruku: lewe wiercenie {top[0]:.1f} mm, prawa krawędź gniazd {p.width*PX - wl[0][2]:.1f} mm")
EXP_H, EXP_V = (250, 100) if SX != 1 else (100, 50)
hl = min((l for l in p.lines if abs(l['top'] - l['bottom']) < 1e-6), key=lambda l: abs((l['x1'] - l['x0']) * PX - EXP_H))
vl = min((l for l in p.lines if abs(l['x0'] - l['x1']) < 1e-6), key=lambda l: abs((l['bottom'] - l['top']) * PY - EXP_V))
print("Odcinki kontrolne:")
check("poziomy", (hl['x1'] - hl['x0']) * PX, EXP_H)
check("pionowy", (vl['bottom'] - vl['top']) * PY, EXP_V)
print("\nWYNIK:", "WSZYSTKO ZGODNE" if ok else "SĄ BŁĘDY")

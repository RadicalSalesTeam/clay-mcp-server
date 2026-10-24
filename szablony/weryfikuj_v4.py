"""Niezależna weryfikacja wymiarów: odczyt geometrii z PDF (pdfplumber), przeliczenie pt -> mm."""
import pdfplumber
from collections import defaultdict

PT = 25.4 / 72
pdf = pdfplumber.open("szablon_otwory_v4_A4_x2.pdf")
p = pdf.pages[0]
print(f"Strona: {p.width*PT:.2f} x {p.height*PT:.2f} mm")
H = p.height

# środki wierceń = środki poziomych ramion krzyżyków o długości 8 mm
drills = sorted({(round((l['x0'] + l['x1']) / 2 * PT, 2), round((H - l['top']) * PT, 2))
                 for l in p.lines if abs(l['top'] - l['bottom']) < 1e-6 and abs((l['x1'] - l['x0']) * PT - 8) < 0.01})
# kontury cięcia = zamknięte ścieżki

def bbox(o):
    return (o['x0'] * PT, (H - o['bottom']) * PT, o['x1'] * PT, (H - o['top']) * PT)

ok = True
def check(name, val, exp, tol=0.02):
    global ok
    good = abs(val - exp) <= tol
    ok &= good
    print(f"  {'OK ' if good else 'BŁĄD'} {name}: {val:.2f} mm (oczekiwane {exp})")

rows = defaultdict(list)
for x, y in drills:
    rows[y].append(x)
axes = (157.5, 52.5)
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
    pts = [(x * PT, (H - y) * PT if False else y * PT) for x, y in r_obj['pts']]
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
    print(f"  marginesy: lewy krzyżyk {top[0]-4:.1f} mm, prawy {p.width*PT - wl[0][2]:.1f} mm")
print("\nWYNIK:", "WSZYSTKO ZGODNE" if ok else "SĄ BŁĘDY")

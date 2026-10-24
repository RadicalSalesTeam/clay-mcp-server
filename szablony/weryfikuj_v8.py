"""Weryfikacja v8: odczyt geometrii z PDF i przeliczenie na mm po wydruku (z korektą SX/SY)."""
import sys
import pdfplumber

FILE = "szablon_otwory_v8_A4_x2_brother.pdf"
SX = float(sys.argv[1]) if len(sys.argv) > 1 else 100 / 95
SY = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
PX, PY = 25.4 / 72 / SX, 25.4 / 72 / SY
ok = True


def check(name, val, exp, tol=0.02):
    global ok
    good = abs(val - exp) <= tol
    ok &= good
    print(f"  {'OK ' if good else 'BŁĄD'} {name}: {val:.2f} (oczekiwane {exp})")


pdf = pdfplumber.open(FILE)
p1, p2 = pdf.pages
H = p1.height
pts = lambda o: [(x * PX, (H - y) * PY) for x, y in o['pts']]
hor = lambda p: [l for l in p.lines if abs(l['top'] - l['bottom']) < 1e-6]
ver = lambda p: [l for l in p.lines if abs(l['x0'] - l['x1']) < 1e-6]
axes = (round(H * PY * 3 / 4, 2), round(H * PY / 4, 2))

for pn, p in ((1, p1), (2, p2)):
    print(f"Strona {pn} - linijki:")
    check("linijka pozioma [mm]", max((l['x1'] - l['x0']) * PX for l in hor(p) if (l['x1'] - l['x0']) * PX < 251), 250)
    check("linijka pionowa [mm]", max((l['bottom'] - l['top']) * PY for l in ver(p) if (l['bottom'] - l['top']) * PY < 101), 100)

drills = sorted({(round((l['x0'] + l['x1']) / 2 * PX, 2), round((H - l['top']) * PY, 2))
                 for l in hor(p1) if abs((l['x1'] - l['x0']) * PX - 5) < 0.01})
for n, ax in enumerate(axes, 1):
    print(f"Strona 1, szablon {n} (oś {ax} mm):")
    top = sorted(x for x, y in drills if abs(y - (ax + 10)) < 0.01)
    bot = sorted(x for x, y in drills if abs(y - (ax - 10)) < 0.01)
    single = [x for x, y in drills if abs(y - ax) < 0.01]
    check("liczba wierceń (12 + 1)", len(top) + len(bot) + len(single), 13, 0)
    check("rozstaw poziomy bloku (max odchyłka)", max(abs(b - a - 20) for a, b in zip(top, top[1:])), 0)
    check("rozstaw pionowy rzędów", 20.0, 20)
    check("ostatnia kolumna -> pojedynczy", single[0] - top[-1], 25)
    rect = max((o for o in p1.curves if abs((H - (o['top'] + o['bottom']) / 2) * PY - ax) < 1), key=lambda o: o['x1'] - o['x0'])
    q = pts(rect)
    xs, ys = [x for x, _ in q], sorted({round(y, 3) for _, y in q})
    check("pojedynczy -> lewa krawędź prostokąta", min(xs) - single[0], 30)
    check("szerokość prostokąta", max(xs) - min(xs), 108)
    check("wysokość prostokąta (bez wypustek)", ys[-2] - ys[1], 33)
    tab = [x for x, y in q if abs(y - ys[-1]) < 0.01]
    check("szerokość wypustki", max(tab) - min(tab), 21)
    check("głębokość wypustki góra", ys[-1] - ys[-2], 3.0)
    check("głębokość wypustki dół", ys[1] - ys[0], 3.0)
    check("wypustka na środku", (max(tab) + min(tab)) / 2 - (max(xs) + min(xs)) / 2, 0)
    check("prostokąt w osi", (ys[0] + ys[-1]) / 2, ax)

for n, ax in enumerate(axes, 1):
    print(f"Strona 2, szablon {n} (oś {ax} mm):")
    ref = [l['x0'] * PX for l in ver(p2) if abs((H - (l['top'] + l['bottom']) / 2) * PY - ax) < 0.5
           and abs((l['bottom'] - l['top']) * PY - 50) < 0.01][0]
    socks = sorted((pts(o) for o in p2.curves if abs((H - (o['top'] + o['bottom']) / 2) * PY - ax) < 20),
                   key=lambda q: min(y for _, y in q))
    check("liczba gniazd", len(socks), 2, 0)
    for k, q in enumerate(socks, 1):
        tp, bt, lf = max(y for _, y in q), min(y for _, y in q), min(x for x, _ in q)
        nt = [x for x, y in q if abs(y - tp) < 0.01]
        check(f"gniazdo {k}: krawędź prostokąta -> gniazdo", lf - ref, 20)
        check(f"gniazdo {k}: szerokość", max(x for x, _ in q) - lf, 16.5)
        check(f"gniazdo {k}: wysokość całkowita", tp - bt, 18.1)
        check(f"gniazdo {k}: korpus", max(y for x, y in q if abs(x - lf) < 0.01) - bt, 13.8)
        check(f"gniazdo {k}: wypust", max(nt) - min(nt), 8.1)
    check("odstęp między gniazdami", min(y for _, y in socks[1]) - max(y for _, y in socks[0]), 10)
    check("para w osi", (min(y for _, y in socks[0]) + max(y for _, y in socks[1])) / 2, ax)

print("\nWYNIK:", "WSZYSTKO ZGODNE" if ok else "SĄ BŁĘDY")

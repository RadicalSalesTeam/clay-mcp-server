"""Szablon wierceń/cięcia v8: 2 szt. na A4 poziomo, korekta skali dla Brother ("wypełnij stronę").

Strona 1: blok 2x6 + pojedynczy otwór + prostokąt 108 x 33 z wypustkami (x2).
Strona 2: gniazda Wieland (x2 pary) z linią odniesienia = prawa krawędź prostokąta.
Rysunek jest w mm rzeczywistych i rozciągany o SX/SY, żeby po wydruku wyszło 1:1.
Użycie: python3 szablon_otwory_v8.py [SX] [SY]   (domyślnie SX = 100/95, SY = 1)
"""
import sys
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

pdfmetrics.registerFont(TTFont("Sans", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))

SX = float(sys.argv[1]) if len(sys.argv) > 1 else 100 / 95
SY = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0

PITCH = 20        # rozstaw otworów w bloku 2x6 (poziomo i pionowo) [mm]
SINGLE_GAP = 25   # skrajna prawa kolumna bloku -> pojedynczy otwór [mm]
RECT_GAP = 30     # pojedynczy otwór -> lewa krawędź prostokąta [mm]
RECT_W, RECT_H = 108, 33
TAB_W, TAB_D = 21, 3.0
WL_GAP = 20       # prawa krawędź prostokąta -> lewa krawędź gniazd [mm]
WL_SPACING = 10   # między gniazdami w pionie, brzeg do brzegu [mm]
# Wieland GST15I2S B1 R W SW (91.921.9053.1) - wycięcie w blasze
WL_W, WL_H = 16.5, 13.8
WL_NOTCH_W, WL_TOTAL_H = 8.1, 18.1
WL_R = 1.7
ARM = 2.5         # ramię krzyżyka wiercenia

X_SINGLE = 5 * PITCH + SINGLE_GAP
X_RECT = X_SINGLE + RECT_GAP
X_RECT_END = X_RECT + RECT_W
Y_WL = (WL_TOTAL_H + WL_SPACING) / 2

W, H = landscape(A4)
Wmm, Hmm = W / mm / SX, H / mm / SY      # strona w mm "po wydruku"
AXES = (Hmm * 3 / 4, Hmm / 4)


def text(c, x, y, s, size=8):
    """Tekst bez rozciągania korektą skali."""
    c.saveState()
    c.translate(x * mm, y * mm)
    c.scale(1 / SX, 1 / SY)
    c.setFont("Sans", size)
    c.drawString(0, 0, s)
    c.restoreState()


def cross(c, x, y):
    c.setLineWidth(0.25)
    c.line((x - ARM) * mm, y * mm, (x + ARM) * mm, y * mm)
    c.line(x * mm, (y - ARM) * mm, x * mm, (y + ARM) * mm)
    c.circle(x * mm, y * mm, 1.0 * mm)


def polygon(c, pts):
    p = c.beginPath()
    p.moveTo(pts[0][0] * mm, pts[0][1] * mm)
    for x, y in pts[1:]:
        p.lineTo(x * mm, y * mm)
    p.close()
    c.setLineWidth(0.35)
    c.drawPath(p, stroke=1, fill=0)


def rect_with_tabs(c, xl, yc):
    xr, yt, yb = xl + RECT_W, yc + RECT_H / 2, yc - RECT_H / 2
    xc, t = xl + RECT_W / 2, TAB_W / 2
    polygon(c, [(xl, yb), (xc - t, yb), (xc - t, yb - TAB_D), (xc + t, yb - TAB_D), (xc + t, yb),
                (xr, yb), (xr, yt), (xc + t, yt), (xc + t, yt + TAB_D), (xc - t, yt + TAB_D),
                (xc - t, yt), (xl, yt)])


def wieland_cutout(c, xl, yc):
    """Wycięcie wg rysunku Wieland: korpus 16,5 x 13,8 + wypust 8,1 do 18,1, R1,7, wypust do góry."""
    yb = yc - WL_TOTAL_H / 2
    yb_top, ytop = yb + WL_H, yb + WL_TOTAL_H
    xr, xc = xl + WL_W, xl + WL_W / 2
    nl, nr, r = xc - WL_NOTCH_W / 2, xc + WL_NOTCH_W / 2, WL_R
    p = c.beginPath()
    p.moveTo(xl * mm, yb * mm)
    p.lineTo(xr * mm, yb * mm)
    p.lineTo(xr * mm, yb_top * mm)
    p.lineTo((nr + r) * mm, yb_top * mm)
    p.arcTo(nr * mm, yb_top * mm, (nr + 2 * r) * mm, (yb_top + 2 * r) * mm, startAng=270, extent=-90)
    p.lineTo(nr * mm, ytop * mm)
    p.lineTo(nl * mm, ytop * mm)
    p.lineTo(nl * mm, (yb_top + r) * mm)
    p.arcTo((nl - 2 * r) * mm, yb_top * mm, nl * mm, (yb_top + 2 * r) * mm, startAng=0, extent=-90)
    p.lineTo(xl * mm, yb_top * mm)
    p.close()
    c.setLineWidth(0.35)
    c.drawPath(p, stroke=1, fill=0)


def ruler_h(c, x, y, length):
    c.setLineWidth(0.3)
    c.line(x * mm, y * mm, (x + length) * mm, y * mm)
    for k in range(length + 1):
        t = 4 if k % 10 == 0 else 2.5 if k % 5 == 0 else 1.5
        c.line((x + k) * mm, y * mm, (x + k) * mm, (y + t) * mm)
        if k % 10 == 0:
            text(c, x + k - (0.8 if k < 10 else 1.6 if k < 100 else 2.4), y + 5, str(k), 5)


def ruler_v(c, x, y, length):
    c.setLineWidth(0.3)
    c.line(x * mm, y * mm, x * mm, (y + length) * mm)
    for k in range(length + 1):
        t = 4 if k % 10 == 0 else 2.5 if k % 5 == 0 else 1.5
        c.line(x * mm, (y + k) * mm, (x - t) * mm, (y + k) * mm)
        if k % 10 == 0:
            text(c, x - 4 - (1.6 if k < 10 else 3.2 if k < 100 else 4.8), y + k - 0.8, str(k), 5)


def footer(c, title):
    text(c, 15, Hmm - 10, title)
    text(c, 15, 6, f"Linijki: poziomo 250 mm, pionowo 100 mm - po wydruku muszą mieć dokładnie tyle. "
                   f"Brother \"wypełnij stronę\", korekta X {SX:.4f}, Y {SY:.4f}.", 7)


c = canvas.Canvas("szablon_otwory_v8_A4_x2_brother.pdf", pagesize=(W, H))
c.setTitle("Szablon otworów v8 (2 szt., A4, korekta Brother)")

# ---- strona 1: wiercenia + prostokąt ----
c.scale(SX, SY)
ox = (Wmm - (X_RECT_END + ARM)) / 2 + ARM
for oy in AXES:
    for i in range(6):
        for row in (+PITCH / 2, -PITCH / 2):
            cross(c, ox + i * PITCH, oy + row)
    cross(c, ox + X_SINGLE, oy)
    rect_with_tabs(c, ox + X_RECT, oy)
c.setDash(3, 2)
c.setLineWidth(0.3)
c.line(10 * mm, (Hmm / 2) * mm, (ox + X_SINGLE + 4) * mm, (Hmm / 2) * mm)
c.line((ox + X_RECT - 2) * mm, (Hmm / 2) * mm, (Wmm - 10) * mm, (Hmm / 2) * mm)
c.setDash()
ruler_h(c, (Wmm - 250) / 2, 14, 250)
ruler_v(c, ox + (X_SINGLE + X_RECT) / 2 + 3, Hmm / 2 - 50, 100)
footer(c, "Szablon v8 - STRONA 1/2: wiercenia i prostokąt 108 x 33 (wypustki 21 x 3). 2 szt., A4 poziomo.")
c.showPage()

# ---- strona 2: gniazda Wieland ----
c.scale(SX, SY)
xr = Wmm / 2 - 10                        # linia odniesienia = prawa krawędź prostokąta
for oy in AXES:
    c.setDash(3, 2)
    c.setLineWidth(0.3)
    c.line(xr * mm, (oy - 25) * mm, xr * mm, (oy + 25) * mm)
    c.line((xr - 15) * mm, oy * mm, (xr + WL_GAP + WL_W + 10) * mm, oy * mm)
    c.setDash()
    text(c, xr - 48, oy + 20, "prawa krawędź prostokąta", 6)
    text(c, xr - 30, oy + 1, "oś szablonu", 6)
    for s in (+1, -1):
        wieland_cutout(c, xr + WL_GAP, oy + s * Y_WL)
ruler_h(c, (Wmm - 250) / 2, 14, 250)
ruler_v(c, 30, Hmm / 2 - 50, 100)
footer(c, "Szablon v8 - STRONA 2/2: gniazda Wieland GST15I2S, 20 mm od prawej krawędzi prostokąta, w osi, odstęp 10 mm.")
c.save()
print(f"SX={SX:.4f} SY={SY:.4f} str.1: ox={ox:.2f}, prawa krawędź prostokąta {ox + X_RECT_END:.2f} z {Wmm:.2f} mm")

"""Szablon wierceń/cięcia v2, skala 1:1.

Całość ma ~386 mm długości, więc wersja A4 jest podzielona na 2 arkusze
(poziomo) z krzyżykami pasowania. Dodatkowo wersja A3 na jednym arkuszu.
Wydruk: skala 100% / "rozmiar rzeczywisty".
"""
import math
from reportlab.lib.pagesizes import A3, A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

pdfmetrics.registerFont(TTFont("Sans", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))

PITCH = 20        # rozstaw otworów w bloku 2x6 (poziomo i pionowo) [mm]
SINGLE_GAP = 30   # skrajna prawa kolumna bloku -> pojedynczy otwór [mm]
RECT_GAP = 50     # pojedynczy otwór -> lewa krawędź prostokąta [mm]
RECT_W, RECT_H = 103, 33
TAB_W, TAB_D = 21, 2.5
WL_GAP = 50       # prawa krawędź prostokąta -> pierwsze gniazdo [mm]
WL_SPACING = 20   # między gniazdami, brzeg do brzegu [mm]
# Wieland GST15I2S B1 R W SW (91.921.9053.1) - wycięcie w blasze
WL_W, WL_H = 16.5, 13.8          # korpus
WL_NOTCH_W, WL_TOTAL_H = 8.1, 18.1
WL_R = 1.7

# Współrzędne globalne [mm]: x=0 - środek pierwszej kolumny, y=0 - oś
X_SINGLE = 5 * PITCH + SINGLE_GAP
X_RECT = X_SINGLE + RECT_GAP
X_WL1 = X_RECT + RECT_W + WL_GAP
X_WL2 = X_WL1 + WL_W + WL_SPACING
X_END = X_WL2 + WL_W


def cross(c, x, y, r=4):
    c.setLineWidth(0.25)
    c.line((x - r) * mm, y * mm, (x + r) * mm, y * mm)
    c.line(x * mm, (y - r) * mm, x * mm, (y + r) * mm)
    c.circle(x * mm, y * mm, 1.0 * mm)


def rect_with_tabs(c, xl, yc):
    xr, yt, yb = xl + RECT_W, yc + RECT_H / 2, yc - RECT_H / 2
    xc, t = xl + RECT_W / 2, TAB_W / 2
    pts = [(xl, yb), (xc - t, yb), (xc - t, yb - TAB_D), (xc + t, yb - TAB_D), (xc + t, yb),
           (xr, yb), (xr, yt), (xc + t, yt), (xc + t, yt + TAB_D), (xc - t, yt + TAB_D),
           (xc - t, yt), (xl, yt)]
    p = c.beginPath()
    p.moveTo(pts[0][0] * mm, pts[0][1] * mm)
    for x, y in pts[1:]:
        p.lineTo(x * mm, y * mm)
    p.close()
    c.setLineWidth(0.35)
    c.drawPath(p, stroke=1, fill=0)


def wieland_cutout(c, xl, yc):
    """Wycięcie wg rysunku Wieland: korpus 16,5 x 13,8 + wypust 8,1 do 18,1, R1,7.
    Całe wycięcie (18,1) wyśrodkowane na osi, wypust do góry."""
    yb = yc - WL_TOTAL_H / 2
    yb_top = yb + WL_H
    ytop = yb + WL_TOTAL_H
    xr = xl + WL_W
    xc = xl + WL_W / 2
    nl, nr = xc - WL_NOTCH_W / 2, xc + WL_NOTCH_W / 2
    r = WL_R
    p = c.beginPath()
    p.moveTo(xl * mm, yb * mm)
    p.lineTo(xr * mm, yb * mm)
    p.lineTo(xr * mm, yb_top * mm)
    # górna krawędź korpusu do wypustu, zaokrąglony narożnik R1.7
    p.lineTo((nr + r) * mm, yb_top * mm)
    p.arcTo((nr + r - r) * mm, (yb_top - 0) * mm, (nr + r + r) * mm, (yb_top + 2 * r) * mm,
            startAng=270, extent=-90)
    p.lineTo(nr * mm, ytop * mm)
    p.lineTo(nl * mm, ytop * mm)
    p.lineTo(nl * mm, (yb_top + r) * mm)
    p.arcTo((nl - 2 * r) * mm, yb_top * mm, nl * mm, (yb_top + 2 * r) * mm,
            startAng=0, extent=-90)
    p.lineTo(xl * mm, yb_top * mm)
    p.close()
    c.setLineWidth(0.35)
    c.drawPath(p, stroke=1, fill=0)


def draw_all(c, ox, oy, clip=None):
    """ox, oy - położenie (x=0, y=0) globalnych na stronie [mm]."""
    c.saveState()
    if clip:
        p = c.beginPath()
        p.rect((ox + clip[0]) * mm, 0, (clip[1] - clip[0]) * mm, 1000 * mm)
        c.clipPath(p, stroke=0, fill=0)
    for i in range(6):
        for row in (+PITCH / 2, -PITCH / 2):
            cross(c, ox + i * PITCH, oy + row)
    cross(c, ox + X_SINGLE, oy)
    rect_with_tabs(c, ox + X_RECT, oy)
    wieland_cutout(c, ox + X_WL1, oy)
    wieland_cutout(c, ox + X_WL2, oy)
    c.restoreState()


def reg_mark(c, x, y, label):
    """Znacznik pasowania (nie wiercić) - krzyżyk w kwadracie."""
    c.setLineWidth(0.25)
    c.rect((x - 3) * mm, (y - 3) * mm, 6 * mm, 6 * mm)
    c.line((x - 6) * mm, y * mm, (x + 6) * mm, y * mm)
    c.line(x * mm, (y - 6) * mm, x * mm, (y + 6) * mm)
    c.setFont("Sans", 7)
    c.drawString((x + 4) * mm, (y + 4) * mm, label)


def scale_bar(c, x, y, text):
    c.setLineWidth(0.4)
    c.line(x * mm, y * mm, (x + 100) * mm, y * mm)
    for k in range(0, 101, 10):
        t = 3 if k % 50 == 0 else 1.5
        c.line((x + k) * mm, y * mm, (x + k) * mm, (y + t) * mm)
    c.setFont("Sans", 8)
    c.drawString(x * mm, (y - 5) * mm, text)


SCALE_TXT = "KONTROLA SKALI: odcinek = 100 mm. Drukuj 100% (rozmiar rzeczywisty), bez dopasowania do strony."

# ---------- A4: 2 arkusze ----------
W, H = landscape(A4)
Hmm = H / mm
SPLIT = (X_SINGLE + X_RECT) / 2        # linia cięcia arkusza 1 (w przerwie 50 mm)
REG_X = (SPLIT - 15, SPLIT - 5)        # znaczniki pasowania (obecne na obu arkuszach)
REG_Y = (-60, 60)

c = canvas.Canvas("szablon_otwory_v2_A4_2arkusze.pdf", pagesize=(W, H))
c.setTitle("Szablon otworów v2 (A4 x2, skala 1:1)")

# arkusz 1
ox, oy = 25, Hmm / 2
draw_all(c, ox, oy, clip=(-20, SPLIT))
c.setDash(3, 2)
c.setLineWidth(0.3)
c.line((ox + SPLIT) * mm, 10 * mm, (ox + SPLIT) * mm, (Hmm - 18) * mm)
c.setDash()
for gx in REG_X:
    for gy in REG_Y:
        reg_mark(c, ox + gx, oy + gy, "")
c.setFont("Sans", 8)
c.drawString(15 * mm, (Hmm - 12) * mm, "Szablon v2 - ARKUSZ 1/2 (A4 poziomo, 1:1). Przytnij wzdłuż linii przerywanej "
             "i nałóż na arkusz 2 tak, by znaczniki w kwadratach się pokryły.")
scale_bar(c, 15, 15, SCALE_TXT)
c.showPage()

# arkusz 2
ox2 = 15 - (REG_X[0] - 10)             # lewy margines przed pierwszym znacznikiem
draw_all(c, ox2, oy, clip=(SPLIT, X_END + 20))
for gx in REG_X:
    for gy in REG_Y:
        reg_mark(c, ox2 + gx, oy + gy, "")
c.setFont("Sans", 8)
c.drawString(15 * mm, (Hmm - 12) * mm, "Szablon v2 - ARKUSZ 2/2 (A4 poziomo, 1:1). Znaczniki w kwadratach służą tylko do "
             "pasowania arkuszy - nie wiercić.")
scale_bar(c, 15, 15, SCALE_TXT)
c.save()

# ---------- A3: 1 arkusz ----------
W3, H3 = landscape(A3)
c = canvas.Canvas("szablon_otwory_v2_A3.pdf", pagesize=(W3, H3))
c.setTitle("Szablon otworów v2 (A3, skala 1:1)")
ox3 = (W3 / mm - X_END) / 2
draw_all(c, ox3, H3 / mm / 2)
c.setFont("Sans", 8)
c.drawString(15 * mm, (H3 / mm - 12) * mm, "Szablon v2 - A3 poziomo, skala 1:1")
scale_bar(c, 15, 15, SCALE_TXT)
c.save()

print(f"X_SINGLE={X_SINGLE} X_RECT={X_RECT} X_WL1={X_WL1} X_WL2={X_WL2} X_END={X_END} SPLIT={SPLIT}")
print(f"A4 sheet2 right edge at {ox2 + X_END:.1f} mm of {W/mm:.0f}")

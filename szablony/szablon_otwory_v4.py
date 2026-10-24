"""Szablon wierceń/cięcia v4: dwa szablony v3 jeden nad drugim, A4 poziomo, skala 1:1.

Gniazda Wieland jedno nad drugim, para wyśrodkowana na osi.
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
SINGLE_GAP = 20   # skrajna prawa kolumna bloku -> pojedynczy otwór [mm]
RECT_GAP = 20     # pojedynczy otwór -> lewa krawędź prostokąta [mm]
RECT_W, RECT_H = 103, 33
TAB_W, TAB_D = 21, 2.5
WL_GAP = 20       # prawa krawędź prostokąta -> lewa krawędź gniazd [mm] (max dla A4)
WL_SPACING = 10   # między gniazdami w pionie, brzeg do brzegu [mm]
# Wieland GST15I2S B1 R W SW (91.921.9053.1) - wycięcie w blasze
WL_W, WL_H = 16.5, 13.8          # korpus
WL_NOTCH_W, WL_TOTAL_H = 8.1, 18.1
WL_R = 1.7

# Współrzędne globalne [mm]: x=0 - środek pierwszej kolumny, y=0 - oś
X_SINGLE = 5 * PITCH + SINGLE_GAP
X_RECT = X_SINGLE + RECT_GAP
X_WL1 = X_RECT + RECT_W + WL_GAP
X_END = X_WL1 + WL_W
Y_WL = (WL_TOTAL_H + WL_SPACING) / 2   # środki gniazd: +/- od osi


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
    wieland_cutout(c, ox + X_WL1, oy + Y_WL)
    wieland_cutout(c, ox + X_WL1, oy - Y_WL)
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



def vscale_bar(c, x, y, length=50):
    c.setLineWidth(0.4)
    c.line(x * mm, y * mm, x * mm, (y + length) * mm)
    for k in range(0, length + 1, 10):
        t = 3 if k % 50 == 0 else 1.5
        c.line(x * mm, (y + k) * mm, (x + t) * mm, (y + k) * mm)


W, H = landscape(A4)
Wmm, Hmm = W / mm, H / mm
c = canvas.Canvas("szablon_otwory_v4_A4_x2.pdf", pagesize=(W, H))
c.setTitle("Szablon otworów v4 (2 szt., A4, skala 1:1)")
ox = (Wmm - (X_END + 4)) / 2 + 4      # +4: ramię krzyżyka z lewej
AXES = (Hmm * 3 / 4, Hmm / 4)         # osie obu szablonów
for oy in AXES:
    draw_all(c, ox, oy)

# linia podziału arkusza na dwa szablony
c.setDash(3, 2)
c.setLineWidth(0.3)
c.line(30 * mm, (Hmm / 2) * mm, (Wmm - 10) * mm, (Hmm / 2) * mm)
c.setDash()

# kontrola skali w obu kierunkach
vscale_bar(c, 15, Hmm / 2 - 25)
c.setFont("Sans", 7)
c.drawString(19 * mm, (Hmm / 2 + 27) * mm, "50 mm (pion)")
c.setFont("Sans", 8)
c.drawString(15 * mm, (Hmm - 12) * mm, "Szablon v4 - 2 szt., A4 poziomo, skala 1:1. Linia przerywana - podział na dwa szablony.")
scale_bar(c, 15, 15, "KONTROLA SKALI: poziomo 100 mm, pionowo 50 mm. Drukuj 100% (rozmiar rzeczywisty), bez dopasowania do strony.")
c.save()
print(f"ox={ox:.2f} osie={AXES} X_END={X_END}")

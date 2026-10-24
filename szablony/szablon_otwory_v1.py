"""Szablon wierceń/cięcia 1:1 na A4 (poziomo). Wydruk: skala 100% / "rozmiar rzeczywisty"."""
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

PITCH = 15        # rozstaw otworów w bloku 2x6 (poziomo i pionowo) [mm]
SINGLE_GAP = 20   # skrajny prawy otwór bloku -> pojedynczy otwór [mm]
RECT_GAP = 50     # pojedynczy otwór -> lewa krawędź prostokąta [mm]
RECT_W, RECT_H = 100, 40
TAB_W, TAB_D = 10, 4

W, H = landscape(A4)
total_w = 5 * PITCH + SINGLE_GAP + RECT_GAP + RECT_W
x0 = (W / mm - total_w) / 2          # środek pierwszej kolumny
axis = H / mm / 2                    # oś pozioma (między rzędami)

def cross(c, x, y, r=4):
    c.line((x - r) * mm, y * mm, (x + r) * mm, y * mm)
    c.line(x * mm, (y - r) * mm, x * mm, (y + r) * mm)
    c.circle(x * mm, y * mm, 1.0 * mm)

c = canvas.Canvas("szablon_otwory_v1.pdf", pagesize=(W, H))
c.setTitle("Szablon otworów v1 (A4, skala 1:1)")
c.setLineWidth(0.25)

# blok 2 x 6
for i in range(6):
    for row in (+PITCH / 2, -PITCH / 2):
        cross(c, x0 + i * PITCH, axis + row)

# pojedynczy otwór w osi
xs = x0 + 5 * PITCH + SINGLE_GAP
cross(c, xs, axis)

# prostokąt z wypustkami (kontur cięcia)
xl = xs + RECT_GAP
xr = xl + RECT_W
yt, yb = axis + RECT_H / 2, axis - RECT_H / 2
xc = (xl + xr) / 2
pts = [(xl, yb), (xc - TAB_W / 2, yb), (xc - TAB_W / 2, yb - TAB_D), (xc + TAB_W / 2, yb - TAB_D),
       (xc + TAB_W / 2, yb), (xr, yb), (xr, yt), (xc + TAB_W / 2, yt), (xc + TAB_W / 2, yt + TAB_D),
       (xc - TAB_W / 2, yt + TAB_D), (xc - TAB_W / 2, yt), (xl, yt)]
p = c.beginPath()
p.moveTo(pts[0][0] * mm, pts[0][1] * mm)
for x, y in pts[1:]:
    p.lineTo(x * mm, y * mm)
p.close()
c.setLineWidth(0.35)
c.drawPath(p, stroke=1, fill=0)

# kontrola skali
c.setLineWidth(0.4)
bx, by = 20, 20
c.line(bx * mm, by * mm, (bx + 100) * mm, by * mm)
for k in range(0, 101, 10):
    t = 3 if k % 50 == 0 else 1.5
    c.line((bx + k) * mm, by * mm, (bx + k) * mm, (by + t) * mm)
c.setFont("Helvetica", 8)
c.drawString(bx * mm, (by - 5) * mm, "KONTROLA SKALI: ten odcinek = 100 mm. Drukuj w skali 100% (rozmiar rzeczywisty), bez dopasowania do strony.")
c.drawString(bx * mm, (H / mm - 15) * mm, "Szablon v1 - A4 poziomo, skala 1:1")
c.save()
print(f"x0={x0:.1f} xs={xs:.1f} xl={xl:.1f} xr={xr:.1f} axis={axis:.1f}")

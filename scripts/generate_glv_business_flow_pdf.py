from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A3, landscape
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf"
OUTPUT_PATH = OUTPUT_DIR / "glv-business-flow-chart.pdf"

PAGE_W, PAGE_H = landscape(A3)

GREEN = colors.HexColor("#176B3A")
LIME = colors.HexColor("#B7EB55")
LIME_SOFT = colors.HexColor("#EFF9DD")
INK = colors.HexColor("#17351F")
MUTED = colors.HexColor("#33413A")
BORDER = colors.HexColor("#DCE5DF")
AMBER = colors.HexColor("#A9720A")
AMBER_FILL = colors.HexColor("#F6C343")
AMBER_SOFT = colors.HexColor("#FFF7DC")
BLUE = colors.HexColor("#1F5578")
BLUE_SOFT = colors.HexColor("#E9F3FA")
RED = colors.HexColor("#A32828")
RED_SOFT = colors.HexColor("#FDE2E2")
GRAY_SOFT = colors.HexColor("#F6F8F6")
WHITE = colors.white


def draw_text(c, x, y, text, size=9, color=INK, bold=False, align="left"):
    c.setFillColor(color)
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    if align == "center":
        c.drawCentredString(x, y, text)
    elif align == "right":
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)


def wrap_lines(text, max_chars):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def rounded_box(
    c,
    x,
    y,
    w,
    h,
    title,
    body,
    fill,
    stroke=GREEN,
    title_color=INK,
    body_chars=28,
    title_size=13,
    body_size=10.5,
):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(1.6)
    c.roundRect(x, y, w, h, 10, fill=1, stroke=1)
    draw_text(c, x + 16, y + h - 26, title, size=title_size, color=title_color, bold=True)
    line_y = y + h - 48
    for line in wrap_lines(body, body_chars):
        draw_text(c, x + 16, line_y, line, size=body_size, color=MUTED)
        line_y -= 15


def diamond(c, cx, cy, w, h, title, body):
    c.setFillColor(AMBER_SOFT)
    c.setStrokeColor(AMBER)
    c.setLineWidth(1.6)
    path = c.beginPath()
    path.moveTo(cx, cy + h / 2)
    path.lineTo(cx + w / 2, cy)
    path.lineTo(cx, cy - h / 2)
    path.lineTo(cx - w / 2, cy)
    path.close()
    c.drawPath(path, fill=1, stroke=1)
    draw_text(c, cx, cy + 10, title, size=13, color=INK, bold=True, align="center")
    draw_text(c, cx, cy - 10, body, size=10, color=MUTED, align="center")


def arrow(c, x1, y1, x2, y2, color=GREEN, label=None, label_dx=0, label_dy=0):
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(2)
    c.line(x1, y1, x2, y2)
    dx = x2 - x1
    dy = y2 - y1
    length = max((dx * dx + dy * dy) ** 0.5, 1)
    ux = dx / length
    uy = dy / length
    size = 9
    px = -uy
    py = ux
    p1 = (x2, y2)
    p2 = (x2 - ux * size + px * size * 0.55, y2 - uy * size + py * size * 0.55)
    p3 = (x2 - ux * size - px * size * 0.55, y2 - uy * size - py * size * 0.55)
    c.line(*p1, *p2)
    c.line(*p1, *p3)
    if label:
        c.setFillColor(colors.white)
        label_w = c.stringWidth(label, "Helvetica-Bold", 10.5) + 10
        cx = (x1 + x2) / 2 + label_dx
        cy = (y1 + y2) / 2 + label_dy
        c.rect(cx - label_w / 2, cy - 7, label_w, 15, fill=1, stroke=0)
        draw_text(c, cx, cy - 3.5, label, size=10.5, color=color, bold=True, align="center")


def lane(c, x, y, w, h, label, fill):
    c.setFillColor(fill)
    c.setStrokeColor(BORDER)
    c.setLineWidth(1)
    c.roundRect(x, y, w, h, 14, fill=1, stroke=1)
    draw_text(c, x + 18, y + h - 24, label, size=13, color=INK, bold=True)


def draw_main_page(c):
    c.setFillColor(WHITE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    header_h = 100
    c.setFillColor(INK)
    c.rect(0, PAGE_H - header_h, PAGE_W, header_h, fill=1, stroke=0)
    draw_text(c, 44, PAGE_H - 42, "GLV Business Flow Chart", size=28, color=WHITE, bold=True)
    draw_text(
        c,
        44,
        PAGE_H - 70,
        "Pay small, own big - procurement only starts when the account reaches the configured threshold.",
        size=12.5,
        color=colors.HexColor("#E7F2E7"),
    )
    draw_text(c, PAGE_W - 44, PAGE_H - 48, "Current rule: 75%+ paid", size=16, color=LIME, bold=True, align="right")

    margin = 40
    lane_h = 150
    gap = 18
    lanes = [
        ("Customer and Staff", PAGE_H - header_h - gap - lane_h, LIME_SOFT),
        ("System and Account Logic", PAGE_H - header_h - gap * 2 - lane_h * 2, GRAY_SOFT),
        ("Procurement and Delivery", PAGE_H - header_h - gap * 3 - lane_h * 3, BLUE_SOFT),
        ("Finance and Reporting", PAGE_H - header_h - gap * 4 - lane_h * 4, AMBER_SOFT),
    ]
    lane_w = PAGE_W - margin * 2
    for label, y, fill in lanes:
        lane(c, margin, y, lane_w, lane_h, label, fill)

    w = 190
    h = 102
    box_gap = 33
    x_positions = [margin + 14 + i * (w + box_gap) for i in range(5)]
    y1 = lanes[0][1] + 22
    y2 = lanes[1][1] + 22
    y3 = lanes[2][1] + 22
    y4 = lanes[3][1] + 22
    mid1, mid2, mid3, mid4 = y1 + h / 2, y2 + h / 2, y3 + h / 2, y4 + h / 2

    rounded_box(c, x_positions[0], y1, w, h, "Customer signs up", "Customer is assigned to a staff member and account is opened.", WHITE)
    rounded_box(c, x_positions[1], y1, w, h, "Product selected", "Staff selects the product and daily payment plan.", WHITE)
    rounded_box(c, x_positions[2], y1, w, h, "Payments recorded", "Cash payments reduce balance and increase account progress.", WHITE)
    diamond(c, x_positions[3] + 95, y1 + h / 2, 176, 96, "75% paid?", "threshold check")
    rounded_box(c, x_positions[4], y1, w, h, "Continue collection", "Below threshold: no procurement cost is treated as due.", WHITE, stroke=AMBER)

    rounded_box(c, x_positions[0], y2, w, h, "Account status", "Active, dormant, probation, completed, closed, archived.", WHITE)
    rounded_box(c, x_positions[1], y2, w, h, "Progress tracked", "System compares total paid to the target amount.", WHITE)
    rounded_box(c, x_positions[2], y2, w, h, "Fully paid", "Account becomes completed when balance reaches zero.", WHITE)
    rounded_box(c, x_positions[3], y2, w, h, "Procurement list", "Accounts at 75%+ and pending delivery appear here.", WHITE, stroke=BLUE)
    rounded_box(c, x_positions[4], y2, w, h, "Export products", "Admin downloads products and customers to buy for.", WHITE, stroke=BLUE)

    rounded_box(c, x_positions[0], y3, w, h, "Admin buys product", "Only procurement-ready products are purchased.", WHITE, stroke=BLUE)
    rounded_box(c, x_positions[1], y3, w, h, "Deliver to customer", "Delivery is confirmed against the account.", WHITE, stroke=BLUE)
    rounded_box(c, x_positions[2], y3, w, h, "Clear obligation", "Delivered accounts leave procurement attention.", WHITE, stroke=GREEN)
    rounded_box(c, x_positions[3], y3, w, h, "Archive later", "Completed and delivered accounts can archive after the set period.", WHITE, stroke=GREEN)

    rounded_box(c, x_positions[0], y4, w, h, "Collected cash", "All customer payments actually received.", WHITE, stroke=GREEN)
    rounded_box(c, x_positions[1], y4, w, h, "Procurement due", "Cost of products currently ready to buy.", WHITE, stroke=BLUE)
    rounded_box(c, x_positions[2], y4, w, h, "Salaries paid", "Payroll already paid for the due month.", WHITE, stroke=AMBER)
    rounded_box(c, x_positions[3], y4, w + 60, h, "Operating cash position", "Collected cash - procurement due - salaries paid.", WHITE, stroke=GREEN)

    # Horizontal flow arrows (drawn through the gaps between boxes, never through text)
    arrow(c, x_positions[0] + w, mid1, x_positions[1] - 4, mid1)
    arrow(c, x_positions[1] + w, mid1, x_positions[2] - 4, mid1)
    arrow(c, x_positions[2] + w, mid1, x_positions[3] + 7, mid1)
    arrow(c, x_positions[3] + 183, mid1, x_positions[4] - 4, mid1, color=AMBER, label="No", label_dy=18)
    arrow(c, x_positions[3] + 95, y1 - 6, x_positions[3] + 95, y2 + h + 6, color=BLUE, label="Yes", label_dx=30)

    arrow(c, x_positions[0] + w, mid2, x_positions[1] - 4, mid2)
    arrow(c, x_positions[1] + w, mid2, x_positions[2] - 4, mid2)
    arrow(c, x_positions[2] + w, mid2, x_positions[3] - 4, mid2)
    arrow(c, x_positions[3] + w, mid2, x_positions[4] - 4, mid2)

    # Routed through the blank left margin so it never crosses the lane
    # label or any box text (both sit directly above/around box0).
    export_y = y3 + h + 26
    margin_line_x = 20
    draw_text(c, x_positions[4] + 95, export_y - 8, "Export guides purchase", size=10.5, color=BLUE, bold=True, align="center")
    arrow(c, x_positions[4] + 95, y2 - 6, x_positions[4] + 95, export_y, color=BLUE)
    arrow(c, x_positions[4] + 95, export_y, margin_line_x, export_y, color=BLUE)
    arrow(c, margin_line_x, export_y, margin_line_x, mid3, color=BLUE)
    arrow(c, margin_line_x, mid3, x_positions[0] - 4, mid3, color=BLUE)
    arrow(c, x_positions[0] + w, mid3, x_positions[1] - 4, mid3, color=BLUE)
    arrow(c, x_positions[1] + w, mid3, x_positions[2] - 4, mid3, color=GREEN)
    arrow(c, x_positions[2] + w, mid3, x_positions[3] - 4, mid3, color=GREEN)

    arrow(c, x_positions[0] + w, mid4, x_positions[1] - 4, mid4, color=GREEN)
    arrow(c, x_positions[1] + w, mid4, x_positions[2] - 4, mid4, color=BLUE)
    arrow(c, x_positions[2] + w, mid4, x_positions[3] - 4, mid4, color=AMBER)

    formula_x = x_positions[3] + w + 60 + 26
    formula_w = PAGE_W - margin - 14 - formula_x
    c.setFillColor(INK)
    c.roundRect(formula_x, y4 - 4, formula_w, h + 12, 12, fill=1, stroke=0)
    draw_text(c, formula_x + formula_w / 2, y4 + h - 18, "Cash-safe formula", size=14, color=LIME, bold=True, align="center")
    draw_text(c, formula_x + formula_w / 2, y4 + h - 42, "Cash - Procurement", size=11.5, color=WHITE, align="center")
    draw_text(c, formula_x + formula_w / 2, y4 + h - 58, "- Salaries Paid", size=11.5, color=WHITE, align="center")

    draw_text(c, 44, 26, "Generated for GLV Management System", size=10, color=MUTED)
    draw_text(c, PAGE_W - 44, 26, "Page 1 of 2", size=10, color=MUTED, align="right")


def draw_notes_page(c):
    c.setFillColor(WHITE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    draw_text(c, 44, PAGE_H - 54, "GLV Business Rules Behind The Flow", size=26, color=INK, bold=True)
    draw_text(c, 44, PAGE_H - 82, "These rules keep reports aligned with the real cash movement of the business.", size=13, color=MUTED)

    cards = [
        (
            "1. Customer accounts do not create immediate buying cost",
            "The full product cost is exposure, but GLV does not buy every product immediately. This prevents reports from showing a false operating loss.",
            LIME_SOFT,
            GREEN,
        ),
        (
            "2. Procurement starts at the threshold",
            "Products enter the procurement list only when customer accounts are at or above the configured threshold, currently understood as 75%+ paid.",
            BLUE_SOFT,
            BLUE,
        ),
        (
            "3. Delivery clears procurement attention",
            "After the product is bought and delivered, delivery confirmation removes it from procurement attention and supports completed-and-delivered reporting.",
            GRAY_SOFT,
            GREEN,
        ),
        (
            "4. Cash position should follow real obligations",
            "Operating Cash Position = Collected Cash - Procurement Due Now - Salaries Paid. Total Product Exposure remains visible but is not treated as immediate loss.",
            AMBER_SOFT,
            AMBER,
        ),
        (
            "5. Staff performance should be cash based",
            "If salaries are replaced with commission later, commission should be calculated on payments actually collected, not on expected receivables.",
            RED_SOFT,
            RED,
        ),
    ]

    x = 54
    card_w = PAGE_W - 108
    card_h = 86
    y = PAGE_H - 170
    for title, body, fill, stroke in cards:
        rounded_box(
            c,
            x,
            y,
            card_w,
            card_h,
            title,
            body,
            fill,
            stroke=stroke,
            body_chars=140,
            title_size=14.5,
            body_size=12,
        )
        y -= card_h + 20

    footer_card_h = 96
    c.setFillColor(INK)
    c.roundRect(54, 56, card_w, footer_card_h, 14, fill=1, stroke=0)
    draw_text(c, 78, 56 + footer_card_h - 30, "Recommended report wording", size=15, color=LIME, bold=True)
    draw_text(c, 78, 56 + footer_card_h - 56, "Use 'Operating Cash Position' for current cash health.", size=12.5, color=WHITE)
    draw_text(c, 78, 56 + footer_card_h - 76, "Use 'Total Product Exposure' only as risk visibility, not as immediate product cost.", size=12.5, color=colors.HexColor("#E7F2E7"))

    draw_text(c, 44, 26, "Generated for GLV Management System", size=10, color=MUTED)
    draw_text(c, PAGE_W - 44, 26, "Page 2 of 2", size=10, color=MUTED, align="right")


def build_pdf():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT_PATH), pagesize=landscape(A3))
    c.setTitle("GLV Business Flow Chart")
    c.setAuthor("GLV Management System")
    draw_main_page(c)
    c.showPage()
    draw_notes_page(c)
    c.save()


if __name__ == "__main__":
    build_pdf()
    print(OUTPUT_PATH)

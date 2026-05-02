"""
Renders the UniGuide Business Proposal financial-projection table as a PNG.
Saves to the user's Desktop. Uses the APPROVED updated numbers
(Y1: Grants 200K, Salary 120K, Total 220K, Profit +RM 30K).

Run:  python scripts/render_financial_table.py
"""

from PIL import Image, ImageDraw, ImageFont
import os

# ----- Data -----
HEADERS = ["Metric", "Y1", "Y3", "Y5", "Y7"]
ROWS = [
    ["Active Institutions", "1 (UM pilot)", "5", "20", "40+ (incl. SEA)"],
    ["Active Students",     "33K",          "200K",     "800K",     "2M"],
    ["Licensing Revenue",   "RM 50K",       "RM 500K",  "RM 3M",    "RM 8M"],
    ["Government Grants",   "RM 200K",      "RM 300K",  "RM 500K",  "RM 800K"],   # UPDATED
    ["Hosting + AI + DB",   "RM 80K",       "RM 200K",  "RM 900K",  "RM 2M"],
    ["Staff Salary",        "RM 120K",      "RM 400K",  "RM 1.2M",  "RM 3M"],     # UPDATED
    ["Marketing",           "RM 10K",       "RM 50K",   "RM 150K",  "RM 400K"],
    ["Legal",               "RM 10K",       "RM 20K",   "RM 50K",   "RM 120K"],
    ["Total Cost",          "RM 220K",      "RM 670K",  "RM 2.3M",  "RM 5.5M"],   # UPDATED
    ["Profit / Loss",       "+RM 30K",      "+RM 130K", "+RM 1.2M", "+RM 3.3M"],  # UPDATED — Y1 now profit
]

# Indices of "emphasis" rows (bold body text)
BOLD_ROWS = {len(ROWS) - 2, len(ROWS) - 1}  # Total Cost, Profit / Loss
PROFIT_LOSS_ROW = len(ROWS) - 1

# ----- Style -----
COL_WIDTHS = [320, 220, 220, 220, 240]   # px per column
ROW_HEIGHT = 56                            # body row
HEADER_HEIGHT = 64                         # header row
PADDING_X = 18
TOP_MARGIN = 12
BOTTOM_MARGIN = 12
SIDE_MARGIN = 12

# Colors (sampled from the source screenshot)
NAVY        = (29, 53, 87)       # header bg
WHITE       = (255, 255, 255)
NEAR_BLACK  = (26, 26, 26)
GREY_BORDER = (212, 212, 212)
LOSS_BG     = (253, 224, 224)    # pale pink for negative
PROFIT_BG   = (214, 240, 214)    # pale green for positive
LOSS_TEXT   = (130, 25, 25)
PROFIT_TEXT = (25, 90, 35)

WIDTH  = SIDE_MARGIN * 2 + sum(COL_WIDTHS)
HEIGHT = TOP_MARGIN + HEADER_HEIGHT + ROW_HEIGHT * len(ROWS) + BOTTOM_MARGIN

# ----- Fonts (Windows: Segoe UI is built-in) -----
FONT_DIRS = [
    r"C:\Windows\Fonts",
]
def _font(filename: str, size: int) -> ImageFont.FreeTypeFont:
    for d in FONT_DIRS:
        p = os.path.join(d, filename)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

FONT_HEADER  = _font("segoeuib.ttf", 22)   # Segoe UI Bold
FONT_METRIC  = _font("segoeui.ttf",  19)   # left-column body
FONT_VALUE   = _font("segoeui.ttf",  19)   # value cells
FONT_BOLD    = _font("segoeuib.ttf", 19)   # Total Cost / Profit row

def draw_centered(draw, text, x0, y0, x1, y1, font, fill):
    """Draw text centered both ways within the (x0,y0)-(x1,y1) box."""
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = x0 + ((x1 - x0) - tw) // 2 - bbox[0]
    ty = y0 + ((y1 - y0) - th) // 2 - bbox[1]
    draw.text((tx, ty), text, font=font, fill=fill)

def draw_left(draw, text, x0, y0, x1, y1, font, fill, padding=PADDING_X):
    """Left-aligned (vertically centered) — used for metric column."""
    bbox = draw.textbbox((0, 0), text, font=font)
    th = bbox[3] - bbox[1]
    ty = y0 + ((y1 - y0) - th) // 2 - bbox[1]
    draw.text((x0 + padding, ty), text, font=font, fill=fill)

def render():
    img = Image.new("RGB", (WIDTH, HEIGHT), WHITE)
    d = ImageDraw.Draw(img)

    # ----- Header row -----
    y0 = TOP_MARGIN
    y1 = y0 + HEADER_HEIGHT
    x = SIDE_MARGIN
    for i, h in enumerate(HEADERS):
        x_end = x + COL_WIDTHS[i]
        # Navy fill
        d.rectangle([x, y0, x_end, y1], fill=NAVY)
        # White bold text — left-aligned for "Metric", centered for year cols
        if i == 0:
            draw_left(d, h, x, y0, x_end, y1, FONT_HEADER, WHITE)
        else:
            draw_centered(d, h, x, y0, x_end, y1, FONT_HEADER, WHITE)
        x = x_end

    # ----- Body rows -----
    for r_idx, row in enumerate(ROWS):
        ry0 = TOP_MARGIN + HEADER_HEIGHT + r_idx * ROW_HEIGHT
        ry1 = ry0 + ROW_HEIGHT
        is_bold = r_idx in BOLD_ROWS
        is_profit_row = r_idx == PROFIT_LOSS_ROW

        x = SIDE_MARGIN
        for c_idx, cell in enumerate(row):
            x_end = x + COL_WIDTHS[c_idx]
            cell_bg = WHITE
            cell_text = NEAR_BLACK
            font = FONT_BOLD if is_bold else (FONT_METRIC if c_idx == 0 else FONT_VALUE)

            # Profit/Loss row — color-code each YEAR cell (not the metric label)
            if is_profit_row and c_idx >= 1:
                if cell.strip().startswith("-"):
                    cell_bg = LOSS_BG
                    cell_text = LOSS_TEXT
                elif cell.strip().startswith("+"):
                    cell_bg = PROFIT_BG
                    cell_text = PROFIT_TEXT

            if cell_bg != WHITE:
                d.rectangle([x, ry0, x_end, ry1], fill=cell_bg)

            if c_idx == 0:
                draw_left(d, cell, x, ry0, x_end, ry1, font, cell_text)
            else:
                draw_centered(d, cell, x, ry0, x_end, ry1, font, cell_text)

            x = x_end

    # ----- Grid lines (drawn last so they overlay clean) -----
    # Outer + inner borders
    total_h = HEADER_HEIGHT + ROW_HEIGHT * len(ROWS)
    # Horizontals — between every row
    for r in range(len(ROWS) + 2):
        if r == 0:
            yy = TOP_MARGIN
        elif r == 1:
            yy = TOP_MARGIN + HEADER_HEIGHT
        else:
            yy = TOP_MARGIN + HEADER_HEIGHT + (r - 1) * ROW_HEIGHT
        d.line([(SIDE_MARGIN, yy), (SIDE_MARGIN + sum(COL_WIDTHS), yy)],
               fill=GREY_BORDER, width=1)
    # Verticals — between every column
    x = SIDE_MARGIN
    for i in range(len(COL_WIDTHS) + 1):
        d.line([(x, TOP_MARGIN), (x, TOP_MARGIN + total_h)],
               fill=GREY_BORDER, width=1)
        if i < len(COL_WIDTHS):
            x += COL_WIDTHS[i]

    # ----- Save -----
    desktop = os.path.join(os.path.expanduser("~"), "Desktop")
    out_path = os.path.join(desktop, "uniguide-financial-projection.png")
    img.save(out_path, "PNG")
    print(f"Saved: {out_path}  ({WIDTH}x{HEIGHT})")

if __name__ == "__main__":
    render()

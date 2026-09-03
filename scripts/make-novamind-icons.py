#!/usr/bin/env python3
"""Generate NovaMind logo + app icons (one-shot rebrand helper)."""
import math
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BG = (17, 24, 39, 255)  # #111827
GRAD_TOP = (99, 102, 241)  # indigo-500
GRAD_BOT = (20, 184, 166)  # teal-500


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make_logo(size, radius_ratio=0.22):
    """Draw the NovaMind mark: gradient brain-orbit ring + neural spark."""
    s = size
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded-square background
    r = int(s * radius_ratio)
    draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=r, fill=BG)

    # Vertical gradient overlay clipped to the rounded square
    grad = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(grad)
    for y in range(s):
        gdraw.line([(0, y), (s, y)], fill=lerp(GRAD_TOP, GRAD_BOT, y / s) + (26,))
    mask = Image.new('L', (s, s), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle([0, 0, s - 1, s - 1], radius=r, fill=255)
    img.paste(grad, (0, 0), mask)

    # Neural network nodes
    nodes = [
        (0.50, 0.30), (0.28, 0.52), (0.72, 0.52),
        (0.38, 0.72), (0.62, 0.72), (0.50, 0.52),
    ]
    px = [(x * s, y * s) for x, y in nodes]

    # Edges
    edges = [(0, 1), (0, 2), (1, 3), (2, 4), (1, 5), (2, 5), (3, 5), (4, 5), (3, 4)]
    lw = max(2, int(s * 0.022))
    for a, b in edges:
        draw.line([px[a], px[b]], fill=(226, 232, 240, 235), width=lw)

    # Nodes: outer ring gradient, center bright
    node_r = int(s * 0.052)
    for i, (x, y) in enumerate(px):
        if i == len(px) - 1:
            rgb = (255, 255, 255)
        else:
            rgb = lerp(GRAD_TOP, GRAD_BOT, (px[i][1]) / s)
        color = rgb + (255,)
        draw.ellipse(
            [x - node_r, y - node_r, x + node_r, y + node_r],
            fill=color,
        )
        halo = node_r + max(2, int(s * 0.012))
        draw.ellipse(
            [x - halo, y - halo, x + halo, y + halo],
            outline=rgb + (90,),
            width=max(1, int(s * 0.006)),
        )

    # Orbit arc for the "AI" spark feel
    arc_r = s * 0.335
    box = [s * 0.5 - arc_r, s * 0.5 - arc_r, s * 0.5 + arc_r, s * 0.5 + arc_r]
    draw.arc(box, start=200, end=340, fill=(148, 163, 184, 160), width=max(2, int(s * 0.012)))
    # Spark at arc head
    ang = math.radians(340)
    sx = s * 0.5 + arc_r * math.cos(ang)
    sy = s * 0.5 + arc_r * math.sin(ang)
    sr = int(s * 0.03)
    draw.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=(250, 204, 21, 255))

    return img


def write_sizes(img, targets):
    for path, size in targets:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        img.resize((size, size), Image.LANCZOS).save(path)


def main():
    out = os.path.join(ROOT, 'src', 'assets')
    logo = make_logo(1024)
    logo.save(os.path.join(out, 'novamind-logo.png'))

    mipmap = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
    density = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192,
    }
    for folder, size in density.items():
        icon = make_logo(size, radius_ratio=0.0)
        p = os.path.join(mipmap, folder, 'ic_launcher.png')
        icon.save(p)
        # Round icon: circle crop
        circle = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
        circle.paste(icon, (0, 0), mask)
        circle.save(os.path.join(mipmap, folder, 'ic_launcher_round.png'))

    ios_dir = os.path.join(ROOT, 'ios', 'NovaMind', 'Images.xcassets', 'AppIcon.appiconset')
    sizes = {
        'App_store_1024_1x.png': 1024,
        'iPad_App_76_2x.png': 152,
        'iPad_Pro_App_83.5_2x.png': 167,
        'iPhone_App_60_2x.png': 120,
        'iPhone_App_60_3x.png': 180,
        'iPhone_Notifications_20_3x.png': 60,
        'iPad_Notifications_20_2x.png': 40,
        'iPhone_Settings_29_2x.png': 58,
        'iPhone_Settings_29_3x.png': 87,
    }
    for name, size in sizes.items():
        p = os.path.join(ios_dir, name)
        if os.path.exists(p):
            make_logo(size, radius_ratio=0.0 if size >= 1024 else 0.22).save(p)

    print('NovaMind icons generated.')


if __name__ == '__main__':
    main()

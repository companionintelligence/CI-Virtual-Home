#!/usr/bin/env python3
"""
Isometric SVG primitives and furniture renderers for generate_house_iso.py.

Carried over from CI-Common's generated/infographics/scripts/generate_sims_scenes.py (the "Sims-Style 3D
Isometric Scene & Lottie Engine"), cut down to exactly what generate_house_iso.py draws with: the SE isometric
projection (iso, COS30/SIN30), polygon / line / prism primitives, and the stair, platform-bed, sectional-sofa,
kitchen-island, coffee-table and botanical renderers — every definition those reach, and nothing else. The
function bodies are unchanged; only the module around them was removed.

The ten household marketing scenes that module also generated (its SCENES table, generate_scene_svg,
build_scene_lottie, render_vista, main) are CI-Common content and stay there. This is a library: it has no
entry point and writes nothing on import.
"""
import math


COS30 = math.cos(math.radians(30))  # 0.8660254
SIN30 = math.sin(math.radians(30))  # 0.5

def iso(x, y, z, cx, cy, scale=1.0):
    """Project 3D point (x, y, z) into 2D isometric coordinates."""
    u = cx + (x - y) * COS30 * scale
    v = cy + (x + y) * SIN30 * scale - z * scale
    return round(u, 1), round(v, 1)

def pts_str(pts):
    return " ".join(f"{u},{v}" for u, v in pts)

def poly(pts, fill="none", stroke="none", stroke_w=1, opacity=1.0, extra=""):
    s_pts = pts_str(pts)
    stk = f'stroke="{stroke}" stroke-width="{stroke_w}"' if stroke != "none" else ""
    op = f'opacity="{opacity}"' if opacity < 1.0 else ""
    return f'<polygon points="{s_pts}" fill="{fill}" {stk} {op} {extra}/>'

def line(p0, p1, stroke="#000", stroke_w=1, opacity=1.0, extra=""):
    op = f'opacity="{opacity}"' if opacity < 1.0 else ""
    return f'<line x1="{p0[0]}" y1="{p0[1]}" x2="{p1[0]}" y2="{p1[1]}" stroke="{stroke}" stroke-width="{stroke_w}" {op} {extra}/>'

def rect_prism(x, y, z, dx, dy, dz, cx, cy, scale, top_c, left_c, right_c, stroke="none", stroke_w=1, opacity=1.0):
    t = [iso(x, y, z+dz, cx, cy, scale), iso(x+dx, y, z+dz, cx, cy, scale), iso(x+dx, y+dy, z+dz, cx, cy, scale), iso(x, y+dy, z+dz, cx, cy, scale)]
    l = [iso(x, y+dy, z, cx, cy, scale), iso(x+dx, y+dy, z, cx, cy, scale), iso(x+dx, y+dy, z+dz, cx, cy, scale), iso(x, y+dy, z, cx, cy, scale)]
    r = [iso(x+dx, y, z, cx, cy, scale), iso(x+dx, y+dy, z, cx, cy, scale), iso(x+dx, y+dy, z+dz, cx, cy, scale), iso(x+dx, y, z+dz, cx, cy, scale)]
    out = [
        poly(r, fill=right_c, stroke=stroke, stroke_w=stroke_w, opacity=opacity),
        poly(l, fill=left_c, stroke=stroke, stroke_w=stroke_w, opacity=opacity),
        poly(t, fill=top_c, stroke=stroke, stroke_w=stroke_w, opacity=opacity)
    ]
    return "\n".join(out)


# -------------------------------------------------------------
# ADVANCED 3D ARCHITECTURAL MULTI-LEVEL GEOMETRY BUILDERS
# -------------------------------------------------------------
def render_stairs(sx, sy, sz, width, run, rise, num_steps, direction, cx, cy, scale,
                  tread_c="#d8be9b", riser_c="#a88b68", side_c="#88623b"):
    """
    Renders 3D architectural stairs connecting two elevation levels.
    direction: '+x', '-x', '+y', '-y'
    """
    svg = []
    step_run = run / num_steps
    step_rise = rise / num_steps

    for i in range(num_steps):
        if direction == '+x':
            cur_x = sx + i * step_run
            cur_y = sy
            cur_z = sz + i * step_rise
            svg.append(rect_prism(cur_x, cur_y, cur_z, 0.1, width, step_rise, cx, cy, scale, tread_c, riser_c, side_c))
            svg.append(rect_prism(cur_x, cur_y, cur_z + step_rise - 1, step_run, width, 1.5, cx, cy, scale, tread_c, riser_c, side_c, stroke="#705538", stroke_w=0.5*scale))
        elif direction == '-x':
            cur_x = sx - (i + 1) * step_run
            cur_y = sy
            cur_z = sz + i * step_rise
            svg.append(rect_prism(cur_x + step_run, cur_y, cur_z, 0.1, width, step_rise, cx, cy, scale, tread_c, riser_c, side_c))
            svg.append(rect_prism(cur_x, cur_y, cur_z + step_rise - 1, step_run, width, 1.5, cx, cy, scale, tread_c, riser_c, side_c, stroke="#705538", stroke_w=0.5*scale))
        elif direction == '+y':
            cur_x = sx
            cur_y = sy + i * step_run
            cur_z = sz + i * step_rise
            svg.append(rect_prism(cur_x, cur_y, cur_z, width, 0.1, step_rise, cx, cy, scale, tread_c, riser_c, side_c))
            svg.append(rect_prism(cur_x, cur_y, cur_z + step_rise - 1, width, step_run, 1.5, cx, cy, scale, tread_c, riser_c, side_c, stroke="#705538", stroke_w=0.5*scale))
        elif direction == '-y':
            cur_x = sx
            cur_y = sy - (i + 1) * step_run
            cur_z = sz + i * step_rise
            svg.append(rect_prism(cur_x, cur_y + step_run, cur_z, width, 0.1, step_rise, cx, cy, scale, tread_c, riser_c, side_c))
            svg.append(rect_prism(cur_x, cur_y, cur_z + step_rise - 1, width, step_run, 1.5, cx, cy, scale, tread_c, riser_c, side_c, stroke="#705538", stroke_w=0.5*scale))

    return "\n".join(svg)


# HIGH-CRAFT PROCEDURAL ARCHITECTURAL FURNITURE BUILDERS
# -------------------------------------------------------------
def render_platform_bed(bx, by, bz, bdx, bdy, bdz, cx, cy, scale, headboard_c=("#3d2915", "#2a1c0e", "#181008"), linen_c=("#f5f2eb", "#dedad0", "#c4c0b4"), blanket_c=("#0a6358", "#074840", "#05342e")):
    """
    Renders a low-profile architectural platform bed suite:
    - Low wooden plinth frame with beveled reveal
    - Slatted headboard against wall
    - Mattress with tucked duvet
    - Folded textured runner / accent blanket
    - Dual plush pillows
    """
    svg = []
    # 1. Wooden Plinth Frame
    svg.append(rect_prism(bx, by, bz, bdx, bdy, 12, cx, cy, scale, "#88623b", "#614324", "#3d2915", stroke="#2a1c0e", stroke_w=0.8*scale))
    
    # 2. Slatted Headboard at by (back of bed)
    hb_h = 55
    svg.append(rect_prism(bx-4, by-6, bz, bdx+8, 8, hb_h, cx, cy, scale, headboard_c[0], headboard_c[1], headboard_c[2], stroke="#1a1208", stroke_w=0.8*scale))
    for sx in range(int(bx), int(bx+bdx), 8):
        svg.append(line(iso(sx, by-6.2, bz+4, cx, cy, scale), iso(sx, by-6.2, bz+hb_h-4, cx, cy, scale), stroke="#ffffff", stroke_w=0.6*scale, opacity=0.15))
        
    # 3. Mattress
    mat_x, mat_y, mat_z = bx + 6, by + 6, bz + 12
    mat_dx, mat_dy, mat_dz = bdx - 12, bdy - 10, 16
    svg.append(rect_prism(mat_x, mat_y, mat_z, mat_dx, mat_dy, mat_dz, cx, cy, scale, linen_c[0], linen_c[1], linen_c[2], stroke="#b0aba0", stroke_w=0.6*scale))
    
    # 4. Fitted Duvet / Coverlet (covers lower 70% of bed)
    duv_y = mat_y + int(mat_dy * 0.28)
    duv_dy = mat_dy - int(mat_dy * 0.28)
    svg.append(rect_prism(mat_x-1, duv_y, mat_z+0.5, mat_dx+2, duv_dy+1, mat_dz+1, cx, cy, scale, linen_c[0], linen_c[1], linen_c[2], stroke="#a8a398", stroke_w=0.6*scale))
    
    # 5. Accent Throw Blanket at foot of bed
    bl_y = mat_y + int(mat_dy * 0.65)
    bl_dy = mat_dy - int(mat_dy * 0.65)
    svg.append(rect_prism(mat_x-1.5, bl_y, mat_z+1.5, mat_dx+3, bl_dy+1.5, mat_dz+1.5, cx, cy, scale, blanket_c[0], blanket_c[1], blanket_c[2], stroke="#03201d", stroke_w=0.6*scale))
    
    # 6. Dual Pillows
    pil_w = (mat_dx - 14) / 2
    pil_d = 26
    pil_h = 7
    for pi, px in enumerate([mat_x + 4, mat_x + 10 + pil_w]):
        svg.append(rect_prism(px, mat_y + 6, mat_z + mat_dz, pil_w, pil_d, pil_h, cx, cy, scale, "#ffffff", "#ebe7df", "#d8d3c8", stroke="#c4c0b4", stroke_w=0.6*scale))
        cr_p1 = iso(px + pil_w*0.2, mat_y + 6 + pil_d*0.5, mat_z + mat_dz + pil_h, cx, cy, scale)
        cr_p2 = iso(px + pil_w*0.8, mat_y + 6 + pil_d*0.5, mat_z + mat_dz + pil_h, cx, cy, scale)
        svg.append(f'<line x1="{cr_p1[0]}" y1="{cr_p1[1]}" x2="{cr_p2[0]}" y2="{cr_p2[1]}" stroke="#cfcac0" stroke-width="{1.5*scale}"/>')
        
    return "\n".join(svg)

def render_sectional_sofa(sx, sy, sz, cx, cy, scale, sofa_c=("#2c3e50", "#202d3a", "#151e27"), cushion_c=("#34495e", "#273746", "#1a252f"), pillow_c=("#ffb900", "#e67e22")):
    """
    Renders an L-shaped contemporary designer sectional sofa:
    - Main seating bank along x
    - Chaise return along y
    - Low solid plinth base
    - Fluffy seat & backrest cushions
    - Accent throw pillows
    """
    svg = []
    # 1. Base plinth
    svg.append(rect_prism(sx, sy, sz, 160, 50, 8, cx, cy, scale, "#11171d", "#0c1116", "#080c10"))
    svg.append(rect_prism(sx, sy+50, sz, 55, 65, 8, cx, cy, scale, "#11171d", "#0c1116", "#080c10"))
    
    # 2. Main Backrest & Armrest
    svg.append(rect_prism(sx, sy, sz+8, 160, 14, 30, cx, cy, scale, sofa_c[0], sofa_c[1], sofa_c[2], stroke="#10171d", stroke_w=0.8*scale))
    svg.append(rect_prism(sx+146, sy+14, sz+8, 14, 36, 22, cx, cy, scale, sofa_c[0], sofa_c[1], sofa_c[2], stroke="#10171d", stroke_w=0.8*scale))
    svg.append(rect_prism(sx, sy+14, sz+8, 14, 101, 22, cx, cy, scale, sofa_c[0], sofa_c[1], sofa_c[2], stroke="#10171d", stroke_w=0.8*scale))
    
    # 3. Cushions
    svg.append(rect_prism(sx+14, sy+14, sz+8, 41, 98, 12, cx, cy, scale, cushion_c[0], cushion_c[1], cushion_c[2], stroke="#151e27", stroke_w=0.7*scale))
    svg.append(rect_prism(sx+57, sy+14, sz+8, 43, 34, 12, cx, cy, scale, cushion_c[0], cushion_c[1], cushion_c[2], stroke="#151e27", stroke_w=0.7*scale))
    svg.append(rect_prism(sx+102, sy+14, sz+8, 43, 34, 12, cx, cy, scale, cushion_c[0], cushion_c[1], cushion_c[2], stroke="#151e27", stroke_w=0.7*scale))
    
    svg.append(rect_prism(sx+58, sy+14, sz+20, 41, 8, 18, cx, cy, scale, cushion_c[0], cushion_c[1], cushion_c[2]))
    svg.append(rect_prism(sx+103, sy+14, sz+20, 41, 8, 18, cx, cy, scale, cushion_c[0], cushion_c[1], cushion_c[2]))
    
    # 4. Accent Pillows
    svg.append(rect_prism(sx+20, sy+24, sz+20, 16, 16, 14, cx, cy, scale, pillow_c[0], pillow_c[0], pillow_c[0], stroke="#b87a00", stroke_w=0.5*scale))
    svg.append(rect_prism(sx+124, sy+18, sz+20, 16, 16, 14, cx, cy, scale, pillow_c[1], pillow_c[1], pillow_c[1], stroke="#963d0c", stroke_w=0.5*scale))
    
    return "\n".join(svg)

def render_kitchen_island(kx, ky, kz, kdx, kdy, kdz, cx, cy, scale, stone_c=("#e8e6e1", "#cfccc4", "#b5b1a6"), cabinet_c=("#22303a", "#162027", "#10171d")):
    """
    Renders a monolithic kitchen waterfall island:
    - Marble/travertine waterfall stone countertop wrapping down both ends
    - Deep inset dark cabinets with bronze hardware
    - Recessed induction cooktop & undermount prep sink with gooseneck faucet
    - Two architectural barstools
    """
    svg = []
    # 1. Cabinet base
    svg.append(rect_prism(kx+6, ky+4, kz, kdx-12, kdy-8, kdz-4, cx, cy, scale, cabinet_c[0], cabinet_c[1], cabinet_c[2], stroke="#080c0f", stroke_w=0.8*scale))
    mid_x = kx + kdx // 2
    svg.append(line(iso(mid_x, ky+kdy-4, kz+4, cx, cy, scale), iso(mid_x, ky+kdy-4, kz+kdz-8, cx, cy, scale), stroke="#080c0f", stroke_w=1.2*scale))
    for hx in [kx + kdx*0.25, kx + kdx*0.75]:
        hp = iso(hx, ky+kdy-3.8, kz+kdz-16, cx, cy, scale)
        svg.append(f'<line x1="{hp[0]-6*scale}" y1="{hp[1]}" x2="{hp[0]+6*scale}" y2="{hp[1]}" stroke="#c89d55" stroke-width="{2.4*scale}"/>')
        
    # 2. Waterfall Countertop
    svg.append(rect_prism(kx, ky, kz+kdz-5, kdx, kdy, 6, cx, cy, scale, stone_c[0], stone_c[1], stone_c[2], stroke="#9e9a90", stroke_w=0.7*scale))
    svg.append(rect_prism(kx, ky, kz, 6, kdy, kdz-5, cx, cy, scale, stone_c[0], stone_c[1], stone_c[2], stroke="#9e9a90", stroke_w=0.7*scale))
    svg.append(rect_prism(kx+kdx-6, ky, kz, 6, kdy, kdz-5, cx, cy, scale, stone_c[0], stone_c[1], stone_c[2], stroke="#9e9a90", stroke_w=0.7*scale))
    
    # 3. Undermount Sink with Gooseneck Faucet
    sink_x, sink_y = kx + 18, ky + 12
    sink_pts = [iso(sink_x, sink_y, kz+kdz+1.1, cx, cy, scale), iso(sink_x+26, sink_y, kz+kdz+1.1, cx, cy, scale),
                iso(sink_x+26, sink_y+20, kz+kdz+1.1, cx, cy, scale), iso(sink_x, sink_y+20, kz+kdz+1.1, cx, cy, scale)]
    svg.append(poly(sink_pts, fill="#2b363f", stroke="#1a2228", stroke_w=1.0*scale))
    f_base = iso(sink_x+13, sink_y+2, kz+kdz+1.2, cx, cy, scale)
    f_top = iso(sink_x+13, sink_y+2, kz+kdz+20, cx, cy, scale)
    f_spout = iso(sink_x+13, sink_y+10, kz+kdz+16, cx, cy, scale)
    svg.append(f'<path d="M {f_base[0]} {f_base[1]} L {f_top[0]} {f_top[1]} Q {f_top[0]} {f_top[1]-6*scale} {f_spout[0]} {f_spout[1]}" stroke="#c89d55" stroke-width="{2.6*scale}" fill="none"/>')
    
    # 4. Induction Cooktop
    cook_x, cook_y = kx + 60, ky + 10
    cook_pts = [iso(cook_x, cook_y, kz+kdz+1.1, cx, cy, scale), iso(cook_x+34, cook_y, kz+kdz+1.1, cx, cy, scale),
                iso(cook_x+34, cook_y+24, kz+kdz+1.1, cx, cy, scale), iso(cook_x, cook_y+24, kz+kdz+1.1, cx, cy, scale)]
    svg.append(poly(cook_pts, fill="#11171d", stroke="#33424d", stroke_w=0.8*scale))
    for cx_off in [9, 25]:
        cp = iso(cook_x + cx_off, cook_y + 12, kz+kdz+1.2, cx, cy, scale)
        svg.append(f'<circle cx="{cp[0]}" cy="{cp[1]}" r="{5*scale}" fill="none" stroke="#f54900" stroke-width="{1*scale}" opacity="0.6"/>')
        
    # 5. Artisan Pour-Over Dripper
    svg.append(rect_prism(kx+kdx-25, ky+12, kz+kdz+1.2, 12, 12, 14, cx, cy, scale, "#fcfbf9", "#dedad0", "#c4c0b4", stroke="#95b8ac", stroke_w=0.6*scale))
    
    # 6. Two Minimalist Barstools
    for bx in [kx + 24, kx + 76]:
        by_s = ky + kdy + 18
        for lx, ly in [(bx-8, by_s-8), (bx+8, by_s-8), (bx-8, by_s+8), (bx+8, by_s+8)]:
            svg.append(line(iso(lx, ly, 0, cx, cy, scale), iso(lx*0.8 + bx*0.2, ly*0.8 + by_s*0.2, 34, cx, cy, scale), stroke="#11171d", stroke_w=3.2*scale))
        svg.append(line(iso(bx-7, by_s, 14, cx, cy, scale), iso(bx+7, by_s, 14, cx, cy, scale), stroke="#c89d55", stroke_w=1.8*scale))
        seat_pts = [iso(bx + 11*math.cos(math.radians(d)), by_s + 11*math.sin(math.radians(d)), 34, cx, cy, scale) for d in range(0, 360, 24)]
        svg.append(poly(seat_pts, fill="#d8be9b", stroke="#614324", stroke_w=1.0*scale))
        
    return "\n".join(svg)

def render_coffee_table(tx, ty, tz, tdx, tdy, tdz, cx, cy, scale, top_c="#e8e4da", base_c="#3a2618"):
    """Renders a low monolithic travertine / oak coffee table with accessories."""
    svg = []
    svg.append(rect_prism(tx+8, ty+6, tz, tdx-16, tdy-12, tdz-4, cx, cy, scale, base_c, "#2a1c10", "#181008"))
    svg.append(rect_prism(tx, ty, tz+tdz-4, tdx, tdy, 4, cx, cy, scale, top_c, "#d8d3c5", "#c4bea8", stroke="#9e9882", stroke_w=0.6*scale))
    svg.append(rect_prism(tx+14, ty+10, tz+tdz, 26, 18, 3, cx, cy, scale, "#0a6358", "#074840", "#05342e"))
    svg.append(rect_prism(tx+16, ty+11, tz+tdz+3, 22, 16, 2, cx, cy, scale, "#ffffff", "#ebebeb", "#d8d8d8"))
    cp = iso(tx+tdx-16, ty+tdy-12, tz+tdz, cx, cy, scale)
    svg.append(f'<circle cx="{cp[0]}" cy="{cp[1]}" r="{4.5*scale}" fill="#dedad0" stroke="#88623b" stroke-width="{0.8*scale}"/>')
    return "\n".join(svg)

# HIGH-CRAFT BOTANICAL ILLUSTRATION ENGINE v4
# -------------------------------------------------------------
def render_botanical(species_type, cx, cy, scale, mx=50, my=360, mz=0):
    """
    Renders realistic botanical flora with rich species-specific shapes,
    proper stems, leaves, and animated sway. Each species is visually distinct.
    """
    svg = []
    pot_w, pot_h = 36, 40

    # 1. Wooden Tripod Stand
    for leg_off in [(-14, -14, 1.0), (14, -14, 0.9), (0, 16, 0.7)]:
        lox, loy, ld = leg_off
        svg.append(line(iso(mx+lox*0.8, my+loy*0.8, mz+2, cx, cy, scale), iso(mx+lox*0.5, my+loy*0.5, mz+28, cx, cy, scale), stroke="#875836", stroke_w=4.0*scale))

    # Saucer
    s_pts = [iso(mx + 20*math.cos(math.radians(d)), my + 20*math.sin(math.radians(d)), mz+26, cx, cy, scale) for d in range(0, 360, 24)]
    svg.append(poly(s_pts, fill="#c86432", stroke="#782d1e", stroke_w=1.0*scale))

    # Planter body
    svg.append(rect_prism(mx-17, my-17, mz+28, pot_w, pot_w, pot_h, cx, cy, scale, "#fcfbf9", "#e8eee9", "#cbdad3", stroke="#95b8ac", stroke_w=1.0*scale))
    # Teal glaze rim
    svg.append(rect_prism(mx-17.5, my-17.5, mz+28+pot_h-7, pot_w+1, pot_w+1, 7, cx, cy, scale, "#72ddd4", "#409b9b", "#0a6358", stroke="#0a6358", stroke_w=0.7*scale))
    # Dark soil
    soil = [iso(mx + 14*math.cos(math.radians(d)), my + 14*math.sin(math.radians(d)), mz+28+pot_h, cx, cy, scale) for d in range(0, 360, 24)]
    svg.append(poly(soil, fill="#241408", stroke="#140b04", stroke_w=0.8*scale))

    pot_top_z = mz + 28 + pot_h

    # 2. Species-Specific Foliage
    if species_type == "monstera":
        # Monstera Deliciosa: Big heart-shaped leaves with fenestrations, glossy deep green
        # Thick main stem
        stem_top = iso(mx, my, pot_top_z + 85, cx, cy, scale)
        stem_base = iso(mx, my, pot_top_z, cx, cy, scale)
        svg.append(f'<line x1="{stem_base[0]}" y1="{stem_base[1]}" x2="{stem_top[0]}" y2="{stem_top[1]}" stroke="#2d4a1e" stroke-width="{6*scale}" stroke-linecap="round"/>')

        leaves = [
            # dx, dy, dz_apex, leaf_h, leaf_w, color, delay
            (30, -28, 52, 64, 44, "#1b4332", "0s"),
            (-28, 30, 58, 68, 48, "#2d6a4f", "0.5s"),
            (38, 24, 74, 72, 50, "#40916c", "1.0s"),
            (-22, -35, 62, 60, 40, "#1b4332", "1.5s"),
            (4, 8, 88, 76, 54, "#52b788", "0.8s"),
            (20, -15, 78, 66, 46, "#2d6a4f", "1.3s"),
        ]
        for ldx, ldy, ldz, lh, lw, col, dly in leaves:
            stem_a = iso(mx + ldx*0.3, my + ldy*0.3, pot_top_z + ldz*0.4, cx, cy, scale)
            leaf_tip = iso(mx + ldx, my + ldy, pot_top_z + ldz, cx, cy, scale)
            # petiole
            svg.append(f'<path d="M {stem_base[0]} {stem_base[1]} Q {stem_a[0]} {stem_a[1]} {leaf_tip[0]} {leaf_tip[1]}" stroke="#1e3f20" stroke-width="{2.8*scale}" fill="none"/>')
            # Leaf - drawn as a big bezier shape relative to leaf_tip
            ls = scale
            svg.append(f'<g transform="translate({leaf_tip[0]},{leaf_tip[1]})" style="animation: plantSway 4.5s ease-in-out {dly} infinite alternate; transform-origin: 0 0;">')
            # Main leaf outline with lobes
            d_path = f"""
                M 0 0
                C {-lw*0.35*ls} {-lh*0.12*ls}, {-lw*0.75*ls} {-lh*0.32*ls}, {-lw*0.70*ls} {-lh*0.50*ls}
                Q {-lw*0.38*ls} {-lh*0.52*ls}, {-lw*0.65*ls} {-lh*0.68*ls}
                Q {-lw*0.30*ls} {-lh*0.70*ls}, {-lw*0.50*ls} {-lh*0.88*ls}
                C {-lw*0.18*ls} {-lh*0.94*ls}, {-lw*0.08*ls} {-lh*0.98*ls}, 0 {-lh*ls}
                C {lw*0.08*ls} {-lh*0.98*ls}, {lw*0.18*ls} {-lh*0.94*ls}, {lw*0.50*ls} {-lh*0.88*ls}
                Q {lw*0.30*ls} {-lh*0.70*ls}, {lw*0.65*ls} {-lh*0.68*ls}
                Q {lw*0.38*ls} {-lh*0.52*ls}, {lw*0.70*ls} {-lh*0.50*ls}
                C {lw*0.75*ls} {-lh*0.32*ls}, {lw*0.35*ls} {-lh*0.12*ls}, 0 0 Z
            """.replace("\n", " ").strip()
            svg.append(f'<path d="{d_path}" fill="{col}" stroke="#0f2417" stroke-width="{0.8*ls}" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.35))"/>')
            # Pale midrib
            svg.append(f'<line x1="0" y1="0" x2="0" y2="{-lh*0.95*ls}" stroke="#b7e4c7" stroke-width="{1.6*ls}" opacity="0.85"/>')
            # Side veins at 3 heights
            for vy_frac in [0.25, 0.48, 0.68]:
                vy = -lh * vy_frac * ls
                svg.append(f'<line x1="0" y1="{vy}" x2="{-lw*0.38*ls}" y2="{vy-7*ls}" stroke="#b7e4c7" stroke-width="{0.9*ls}" opacity="0.55"/>')
                svg.append(f'<line x1="0" y1="{vy}" x2="{lw*0.38*ls}" y2="{vy-7*ls}" stroke="#b7e4c7" stroke-width="{0.9*ls}" opacity="0.55"/>')
            # Swiss-cheese holes (fenestrations) - simple oval cutouts
            svg.append(f'<ellipse cx="{-lw*0.3*ls}" cy="{-lh*0.55*ls}" rx="{6*ls}" ry="{10*ls}" fill="{col}" stroke="#0f2417" stroke-width="{0.6*ls}" opacity="0.9"/>')
            svg.append(f'<ellipse cx="{lw*0.3*ls}" cy="{-lh*0.55*ls}" rx="{6*ls}" ry="{10*ls}" fill="{col}" stroke="#0f2417" stroke-width="{0.6*ls}" opacity="0.9"/>')
            svg.append('</g>')

    elif species_type == "bonsai":
        # Japanese Juniper Bonsai: Sinuous twisted trunk with multi-directional branches & cloud needle pads
        b_base = iso(mx, my, pot_top_z, cx, cy, scale)
        # Main trunk - twisted S-curve
        b_c1 = iso(mx-8, my+6, pot_top_z+18, cx, cy, scale)
        b_c2 = iso(mx+10, my-5, pot_top_z+36, cx, cy, scale)
        b_top = iso(mx-4, my+3, pot_top_z+54, cx, cy, scale)
        svg.append(f'<path d="M {b_base[0]} {b_base[1]} C {b_c1[0]} {b_c1[1]}, {b_c2[0]} {b_c2[1]}, {b_top[0]} {b_top[1]}" stroke="#3a2010" stroke-width="{11*scale}" stroke-linecap="round" fill="none"/>')
        svg.append(f'<path d="M {b_base[0]} {b_base[1]} C {b_c1[0]} {b_c1[1]}, {b_c2[0]} {b_c2[1]}, {b_top[0]} {b_top[1]}" stroke="#7f4f24" stroke-width="{6*scale}" stroke-linecap="round" fill="none"/>')
        svg.append(f'<path d="M {b_base[0]} {b_base[1]} C {b_c1[0]} {b_c1[1]}, {b_c2[0]} {b_c2[1]}, {b_top[0]} {b_top[1]}" stroke="#b08a6a" stroke-width="{2.5*scale}" stroke-linecap="round" fill="none" opacity="0.5"/>')

        # Sub-branches
        branches = [
            (mx+18, my-10, pot_top_z+30),
            (mx-16, my+12, pot_top_z+40),
            (mx+12, my+8, pot_top_z+50),
        ]
        for bx, by, bz in branches:
            bp = iso(bx, by, bz, cx, cy, scale)
            mid_p = ((b_top[0]+bp[0])/2, (b_top[1]+bp[1])/2)
            svg.append(f'<path d="M {b_top[0]} {b_top[1]} Q {mid_p[0]} {mid_p[1]} {bp[0]} {bp[1]}" stroke="#7f4f24" stroke-width="{5*scale}" stroke-linecap="round" fill="none"/>')

        # Deadwood Jin tip
        jin = iso(mx-8, my+6, pot_top_z+64, cx, cy, scale)
        svg.append(line(b_top, jin, stroke="#ede0d4", stroke_w=2.2*scale))

        # Cloud needle pads with texture
        pads = [
            (mx-18, my+12, pot_top_z+28, 24, 12, "#1b4332", "0s"),
            (mx+22, my-10, pot_top_z+38, 28, 14, "#2d6a4f", "0.6s"),
            (mx-10, my-14, pot_top_z+48, 26, 13, "#40916c", "1.2s"),
            (mx+10, my+10, pot_top_z+56, 32, 16, "#52b788", "0.4s"),
            (mx-2, my+2, pot_top_z+62, 24, 12, "#74c69d", "0.9s"),
            (mx+6, my-6, pot_top_z+44, 18, 10, "#2d6a4f", "1.5s"),
        ]
        for px, py, pz, rw, rh, pcol, dly in pads:
            c = iso(px, py, pz, cx, cy, scale)
            svg.append(f'<g style="animation: plantSway 5.5s ease-in-out {dly} infinite alternate; transform-origin:{c[0]}px {c[1]}px;">')
            svg.append(f'<ellipse cx="{c[0]}" cy="{c[1]}" rx="{rw*scale}" ry="{rh*scale}" fill="{pcol}" stroke="#0f2417" stroke-width="{0.9*scale}" filter="drop-shadow(0 3px 6px rgba(0,0,0,0.28))"/>')
            svg.append(f'<ellipse cx="{c[0]-2*scale}" cy="{c[1]-1.5*scale}" rx="{rw*0.55*scale}" ry="{rh*0.5*scale}" fill="#95d5b2" opacity="0.4"/>')
            svg.append('</g>')

    elif species_type == "fiddle_leaf":
        # Ficus Lyrata: Tall upright single trunk with large violin-shaped leaves
        t_base = iso(mx, my, pot_top_z, cx, cy, scale)
        t_mid = iso(mx+3, my-2, pot_top_z+48, cx, cy, scale)
        t_top = iso(mx, my, pot_top_z+90, cx, cy, scale)
        svg.append(f'<path d="M {t_base[0]} {t_base[1]} Q {t_mid[0]} {t_mid[1]} {t_top[0]} {t_top[1]}" stroke="#5c4033" stroke-width="{8*scale}" stroke-linecap="round" fill="none"/>')
        svg.append(f'<path d="M {t_base[0]} {t_base[1]} Q {t_mid[0]} {t_mid[1]} {t_top[0]} {t_top[1]}" stroke="#8B6048" stroke-width="{3.5*scale}" stroke-linecap="round" fill="none" opacity="0.6"/>')

        fiddle_leaves = [
            (26, -22, 38, -28, 58, 42, "#1b4332", "0s"),
            (-24, 24, 52, 118, 62, 44, "#2d6a4f", "0.6s"),
            (30, 20, 66, 42, 68, 48, "#2d6a4f", "1.1s"),
            (-20, -28, 78, -112, 64, 46, "#40916c", "0.3s"),
            (0, 0, 98, 0, 72, 52, "#52b788", "0.8s"),
        ]
        for fl_x, fl_y, fl_z, ang, fl_l, fl_w, col, dly in fiddle_leaves:
            stem_pt = iso(mx + fl_x*0.35, my + fl_y*0.35, pot_top_z + fl_z*0.5, cx, cy, scale)
            p_tip = iso(mx + fl_x, my + fl_y, pot_top_z + fl_z, cx, cy, scale)
            svg.append(f'<path d="M {t_base[0]} {t_base[1]} Q {stem_pt[0]} {stem_pt[1]} {p_tip[0]} {p_tip[1]}" stroke="#3a2010" stroke-width="{2.2*scale}" fill="none"/>')
            svg.append(f'<g transform="translate({p_tip[0]},{p_tip[1]}) rotate({ang})" style="animation: plantSway 5s ease-in-out {dly} infinite alternate; transform-origin: 0 0;">')
            ls = scale
            # Violin contour - wide body, pinched waist, broad top
            v_path = f"""
                M 0 0
                C {-fl_w*0.28*ls} {-fl_l*0.18*ls}, {-fl_w*0.22*ls} {-fl_l*0.38*ls}, {-fl_w*0.52*ls} {-fl_l*0.55*ls}
                C {-fl_w*0.64*ls} {-fl_l*0.68*ls}, {-fl_w*0.64*ls} {-fl_l*0.82*ls}, {-fl_w*0.45*ls} {-fl_l*0.92*ls}
                C {-fl_w*0.22*ls} {-fl_l*0.99*ls}, 0 {-fl_l*ls}, 0 {-fl_l*ls}
                C 0 {-fl_l*ls}, {fl_w*0.22*ls} {-fl_l*0.99*ls}, {fl_w*0.45*ls} {-fl_l*0.92*ls}
                C {fl_w*0.64*ls} {-fl_l*0.82*ls}, {fl_w*0.64*ls} {-fl_l*0.68*ls}, {fl_w*0.52*ls} {-fl_l*0.55*ls}
                C {fl_w*0.22*ls} {-fl_l*0.38*ls}, {fl_w*0.28*ls} {-fl_l*0.18*ls}, 0 0 Z
            """.replace("\n", " ").strip()
            svg.append(f'<path d="{v_path}" fill="{col}" stroke="#0f2417" stroke-width="{0.9*ls}" filter="drop-shadow(0 4px 10px rgba(0,0,0,0.3))"/>')
            svg.append(f'<line x1="0" y1="0" x2="0" y2="{-fl_l*0.95*ls}" stroke="#d8f3dc" stroke-width="{2*ls}" opacity="0.8"/>')
            # Wavy edge veins
            for vy_f in [0.35, 0.6, 0.8]:
                vy = -fl_l * vy_f * ls
                svg.append(f'<line x1="0" y1="{vy}" x2="{-fl_w*0.30*ls}" y2="{vy-5*ls}" stroke="#d8f3dc" stroke-width="{1*ls}" opacity="0.6"/>')
                svg.append(f'<line x1="0" y1="{vy}" x2="{fl_w*0.30*ls}" y2="{vy-5*ls}" stroke="#d8f3dc" stroke-width="{1*ls}" opacity="0.6"/>')
            svg.append('</g>')

    elif species_type == "bougainvillea":
        # Climbing Bougainvillea: Arching woody trellis with magenta paper-bract clusters
        # Draw 3 arching woody canes
        cane_paths = [
            [(mx, my, pot_top_z), (mx-6, my-4, pot_top_z+38), (mx-12, my-16, pot_top_z+82)],
            [(mx, my, pot_top_z), (mx-14, my+2, pot_top_z+50), (mx-20, my-6, pot_top_z+88)],
            [(mx, my, pot_top_z), (mx+4, my-8, pot_top_z+32), (mx-2, my-20, pot_top_z+70)],
        ]
        for cane in cane_paths:
            p0, p1, p2 = [iso(*pt, cx, cy, scale) for pt in cane]
            svg.append(f'<path d="M {p0[0]} {p0[1]} Q {p1[0]} {p1[1]} {p2[0]} {p2[1]}" stroke="#543d2b" stroke-width="{5*scale}" stroke-linecap="round" fill="none"/>')
            svg.append(f'<path d="M {p0[0]} {p0[1]} Q {p1[0]} {p1[1]} {p2[0]} {p2[1]}" stroke="#8B6048" stroke-width="{2*scale}" stroke-linecap="round" fill="none" opacity="0.5"/>')

        # Clustered bracts at different heights along canes
        bract_positions = [
            (mx-4, my-3, pot_top_z+28, "#f72585", 1.0),
            (mx-10, my-8, pot_top_z+48, "#d81159", 1.0),
            (mx-16, my-14, pot_top_z+72, "#ff4d6d", 1.0),
            (mx-18, my-4, pot_top_z+58, "#b5179e", 1.0),
            (mx-6, my-18, pot_top_z+60, "#f72585", 0.85),
            (mx-2, my-10, pot_top_z+38, "#ff4d6d", 0.9),
            (mx-14, my+2, pot_top_z+82, "#d81159", 0.95),
            (mx-22, my-4, pot_top_z+78, "#b5179e", 0.85),
        ]
        for bx, by, bz, bcol, bop in bract_positions:
            bp = iso(bx, by, bz, cx, cy, scale)
            svg.append(f'<g style="animation: plantSway 3.8s ease-in-out infinite alternate; transform-origin:{bp[0]}px {bp[1]}px;">')
            # 6 oval bracts in a cluster
            for ang in range(0, 360, 60):
                rad = math.radians(ang)
                ex = bp[0] + 9*math.cos(rad)*scale
                ey = bp[1] + 7*math.sin(rad)*scale
                svg.append(f'<ellipse cx="{ex}" cy="{ey}" rx="{9.5*scale}" ry="{6.5*scale}" fill="{bcol}" stroke="#ffffff" stroke-width="{0.4*scale}" opacity="{bop}" transform="rotate({ang},{bp[0]},{bp[1]})"/>')
            # Yellow stamens
            svg.append(f'<circle cx="{bp[0]}" cy="{bp[1]}" r="{3.5*scale}" fill="#ffdd00" stroke="#c8a000" stroke-width="{0.5*scale}"/>')
            # Small dark green leaves among bracts
            svg.append(f'<ellipse cx="{bp[0]+5*scale}" cy="{bp[1]-4*scale}" rx="{4.5*scale}" ry="{2.5*scale}" fill="#1b4332" opacity="0.7"/>')
            svg.append('</g>')

    elif species_type == "pilea":
        # Pilea Peperomioides: Round pancake leaves on long petioles, radiating from central stem
        # Central upright stem
        stem_top = iso(mx, my, pot_top_z + 60, cx, cy, scale)
        stem_base = iso(mx, my, pot_top_z, cx, cy, scale)
        svg.append(f'<path d="M {stem_base[0]} {stem_base[1]} L {stem_top[0]} {stem_top[1]}" stroke="#52b788" stroke-width="{4*scale}" stroke-linecap="round" fill="none"/>')

        # Radiating leaves on long stems
        leaf_data = [
            (30, 36, 40, 15, "0s"),
            (82, 42, 52, 17, "0.25s"),
            (148, 38, 44, 15, "0.5s"),
            (208, 44, 56, 18, "0.75s"),
            (268, 36, 42, 14, "1.0s"),
            (326, 40, 60, 17, "1.25s"),
            (10, 28, 74, 19, "0.4s"),
            (190, 32, 68, 16, "0.9s"),
        ]
        for p_deg, p_len, p_z, p_r, dly in leaf_data:
            rad = math.radians(p_deg)
            lx = mx + p_len * math.cos(rad) * 0.65
            ly = my + p_len * math.sin(rad) * 0.65
            p_base = iso(mx + p_len*0.08*math.cos(rad), my + p_len*0.08*math.sin(rad), pot_top_z + 4, cx, cy, scale)
            p_leaf = iso(lx, ly, pot_top_z + p_z, cx, cy, scale)
            svg.append(line(p_base, p_leaf, stroke="#74c69d", stroke_w=2.4*scale))
            svg.append(f'<g style="animation: plantSway 4.2s ease-in-out {dly} infinite alternate; transform-origin:{p_leaf[0]}px {p_leaf[1]}px;">')
            svg.append(f'<circle cx="{p_leaf[0]}" cy="{p_leaf[1]}" r="{p_r*scale}" fill="#2d6a4f" stroke="#1b4332" stroke-width="{0.9*scale}" filter="drop-shadow(0 3px 6px rgba(0,0,0,0.25))"/>')
            svg.append(f'<circle cx="{p_leaf[0]}" cy="{p_leaf[1]}" r="{p_r*0.6*scale}" fill="#52b788" opacity="0.5"/>')
            # Central white dot (navel)
            svg.append(f'<circle cx="{p_leaf[0]-p_r*0.18*scale}" cy="{p_leaf[1]-p_r*0.18*scale}" r="{2.0*scale}" fill="#d8f3dc" opacity="0.9"/>')
            svg.append('</g>')

    elif species_type == "pink_princess":
        # Philodendron Pink Princess: Dark green heart-shaped leaves with pink/cream variegation
        stem_base = iso(mx, my, pot_top_z, cx, cy, scale)
        leaves = [
            (25, -22, 45, -30, 50, 36, "#1b4332", "#f4a0b5", "0s"),
            (-22, 26, 55, 120, 54, 38, "#0f2417", "#f7c5d0", "0.5s"),
            (32, 20, 68, 40, 60, 42, "#2d6a4f", "#e8b4c8", "1.0s"),
            (-18, -28, 72, -115, 52, 36, "#0f2417", "#f4a0b5", "1.5s"),
            (2, 4, 85, 5, 66, 46, "#1b4332", "#fad4e0", "0.8s"),
        ]
        # Stem  
        stem_top = iso(mx, my, pot_top_z + 82, cx, cy, scale)
        svg.append(f'<path d="M {stem_base[0]} {stem_base[1]} L {stem_top[0]} {stem_top[1]}" stroke="#2d4a1e" stroke-width="{5*scale}" stroke-linecap="round" fill="none"/>')
        for ldx, ldy, ldz, ang, lh, lw, dark_col, pink_col, dly in leaves:
            p_mid = iso(mx + ldx*0.4, my + ldy*0.4, pot_top_z + ldz*0.5, cx, cy, scale)
            p_tip = iso(mx + ldx, my + ldy, pot_top_z + ldz, cx, cy, scale)
            svg.append(f'<path d="M {stem_base[0]} {stem_base[1]} Q {p_mid[0]} {p_mid[1]} {p_tip[0]} {p_tip[1]}" stroke="#1e3f20" stroke-width="{2.5*scale}" fill="none"/>')
            ls = scale
            svg.append(f'<g transform="translate({p_tip[0]},{p_tip[1]}) rotate({ang})" style="animation: plantSway 4.8s ease-in-out {dly} infinite alternate; transform-origin: 0 0;">')
            # Heart leaf shape
            d_path = f"""
                M 0 0
                C {-lw*0.38*ls} {-lh*0.14*ls}, {-lw*0.78*ls} {-lh*0.34*ls}, {-lw*0.72*ls} {-lh*0.52*ls}
                C {-lw*0.68*ls} {-lh*0.72*ls}, {-lw*0.30*ls} {-lh*0.82*ls}, 0 {-lh*ls}
                C {lw*0.30*ls} {-lh*0.82*ls}, {lw*0.68*ls} {-lh*0.72*ls}, {lw*0.72*ls} {-lh*0.52*ls}
                C {lw*0.78*ls} {-lh*0.34*ls}, {lw*0.38*ls} {-lh*0.14*ls}, 0 0 Z
            """.replace("\n", " ").strip()
            svg.append(f'<path d="{d_path}" fill="{dark_col}" stroke="#0f2417" stroke-width="{0.8*ls}"/>')
            # Pink variegation patches
            v_path = f"""
                M {lw*0.08*ls} {-lh*0.18*ls}
                C {lw*0.30*ls} {-lh*0.22*ls}, {lw*0.50*ls} {-lh*0.40*ls}, {lw*0.45*ls} {-lh*0.60*ls}
                C {lw*0.35*ls} {-lh*0.78*ls}, {lw*0.10*ls} {-lh*0.78*ls}, 0 {-lh*0.88*ls}
                C {-lw*0.05*ls} {-lh*0.78*ls}, {lw*0.02*ls} {-lh*0.35*ls}, {lw*0.08*ls} {-lh*0.18*ls} Z
            """.replace("\n", " ").strip()
            svg.append(f'<path d="{v_path}" fill="{pink_col}" opacity="0.85"/>')
            svg.append(f'<line x1="0" y1="0" x2="0" y2="{-lh*0.94*ls}" stroke="#d8f3dc" stroke-width="{1.5*ls}" opacity="0.75"/>')
            svg.append('</g>')

    elif species_type == "saguaro_agave":
        # Giant Saguaro Cactus + Blue Agave rosette — dramatic desert plants
        # SAGUARO: Tall ribbed column with arms
        sag_h = 110
        sag_r = 14
        # Main column ribs
        s_base = iso(mx - 10, my - 5, pot_top_z, cx, cy, scale)
        s_top = iso(mx - 10, my - 5, pot_top_z + sag_h, cx, cy, scale)
        # Draw saguaro body as ribbed cylinder with 8 ribs
        rib_colors = ["#3d7a3d", "#2d6a2d", "#4a8a4a", "#2a602a"]
        for ri in range(8):
            ang = math.radians(ri * 45)
            rx = (mx - 10) + sag_r * 0.6 * math.cos(ang)
            ry = (my - 5) + sag_r * 0.3 * math.sin(ang)
            rb = iso(rx, ry, pot_top_z, cx, cy, scale)
            rt = iso(rx, ry, pot_top_z + sag_h, cx, cy, scale)
            rcol = rib_colors[ri % len(rib_colors)]
            svg.append(f'<path d="M {rb[0]} {rb[1]} L {rt[0]} {rt[1]}" stroke="{rcol}" stroke-width="{sag_r*1.4*scale}" stroke-linecap="round" fill="none" opacity="0.9"/>')

        # Saguaro outline
        svg.append(f'<path d="M {s_base[0]} {s_base[1]} L {s_top[0]} {s_top[1]}" stroke="#2d6a2d" stroke-width="{sag_r*2.2*scale}" stroke-linecap="round" fill="none"/>')
        svg.append(f'<path d="M {s_base[0]} {s_base[1]} L {s_top[0]} {s_top[1]}" stroke="#52b752" stroke-width="{sag_r*0.6*scale}" stroke-linecap="round" fill="none" opacity="0.4"/>')

        # Arms - two S-curved branches
        arm1_start = iso(mx - 10, my - 5, pot_top_z + 58, cx, cy, scale)
        arm1_mid = iso(mx + 12, my - 5, pot_top_z + 62, cx, cy, scale)
        arm1_top = iso(mx + 14, my - 5, pot_top_z + sag_h + 4, cx, cy, scale)
        svg.append(f'<path d="M {arm1_start[0]} {arm1_start[1]} Q {arm1_mid[0]} {arm1_mid[1]} {arm1_top[0]} {arm1_top[1]}" stroke="#2d6a2d" stroke-width="{sag_r*1.6*scale}" stroke-linecap="round" fill="none"/>')
        svg.append(f'<path d="M {arm1_start[0]} {arm1_start[1]} Q {arm1_mid[0]} {arm1_mid[1]} {arm1_top[0]} {arm1_top[1]}" stroke="#52b752" stroke-width="{sag_r*0.4*scale}" stroke-linecap="round" fill="none" opacity="0.4"/>')

        arm2_start = iso(mx - 10, my - 5, pot_top_z + 44, cx, cy, scale)
        arm2_mid = iso(mx - 26, my - 5, pot_top_z + 50, cx, cy, scale)
        arm2_top = iso(mx - 28, my - 5, pot_top_z + sag_h - 8, cx, cy, scale)
        svg.append(f'<path d="M {arm2_start[0]} {arm2_start[1]} Q {arm2_mid[0]} {arm2_mid[1]} {arm2_top[0]} {arm2_top[1]}" stroke="#2d6a2d" stroke-width="{sag_r*1.5*scale}" stroke-linecap="round" fill="none"/>')

        # White spines along column
        for sz in range(10, sag_h, 18):
            sp = iso(mx - 10, my - 5 - sag_r + 2, pot_top_z + sz, cx, cy, scale)
            svg.append(f'<circle cx="{sp[0]}" cy="{sp[1]}" r="{1.5*scale}" fill="#ffffff" opacity="0.6"/>')

        # AGAVE at base
        agave_pts = [
            (mx+22, my+10, 18, 28, "#2a5f2a"),
            (mx+30, my+2, 22, 20, "#1e4a1e"),
            (mx+24, my+18, 16, 24, "#3a6f3a"),
            (mx+10, my+22, 14, 28, "#1e4a1e"),
            (mx+38, my+14, 12, 18, "#2a5f2a"),
        ]
        for ax, ay, az_h, a_len, acol in agave_pts:
            a_base = iso(ax - a_len*0.5, ay - a_len*0.3, pot_top_z + 2, cx, cy, scale)
            a_tip = iso(ax, ay, pot_top_z + az_h, cx, cy, scale)
            # Agave leaf - thick at base, pointed tip
            ls = scale
            svg.append(f'<g style="animation: plantSway 6s ease-in-out infinite alternate; transform-origin:{a_base[0]}px {a_base[1]}px;">')
            svg.append(f'<path d="M {a_base[0]} {a_base[1]} Q {(a_base[0]+a_tip[0])*0.5} {(a_base[1]+a_tip[1])*0.4} {a_tip[0]} {a_tip[1]}" stroke="{acol}" stroke-width="{8*ls}" stroke-linecap="round" fill="none"/>')
            svg.append(f'<path d="M {a_base[0]} {a_base[1]} Q {(a_base[0]+a_tip[0])*0.5} {(a_base[1]+a_tip[1])*0.4} {a_tip[0]} {a_tip[1]}" stroke="#8aca8a" stroke-width="{2*ls}" stroke-linecap="round" fill="none" opacity="0.4"/>')
            # Sharp tip spine
            svg.append(f'<circle cx="{a_tip[0]}" cy="{a_tip[1]}" r="{2.5*ls}" fill="#f5e6c8"/>')
            svg.append('</g>')

    elif species_type == "bird_of_paradise":
        # Strelitzia: Long arching leaf blades + bright orange & blue flowers
        # Cluster of large paddle-shaped leaves
        stem_base = iso(mx, my, pot_top_z, cx, cy, scale)
        bird_leaves = [
            (20, -18, 55, -25, 80, 28, "#1b4332", "0s"),
            (-18, 22, 60, 115, 85, 30, "#0f2417", "0.7s"),
            (28, 16, 70, 35, 90, 32, "#2d6a4f", "1.4s"),
            (-12, -26, 65, -108, 75, 26, "#1b4332", "0.4s"),
            (4, 2, 80, 5, 95, 34, "#40916c", "1.0s"),
        ]
        for ldx, ldy, ldz, ang, lh, lw, col, dly in bird_leaves:
            stem_mid = iso(mx + ldx*0.4, my + ldy*0.4, pot_top_z + ldz*0.5, cx, cy, scale)
            p_tip = iso(mx + ldx, my + ldy, pot_top_z + ldz, cx, cy, scale)
            svg.append(f'<path d="M {stem_base[0]} {stem_base[1]} Q {stem_mid[0]} {stem_mid[1]} {p_tip[0]} {p_tip[1]}" stroke="#2d4a1e" stroke-width="{3*scale}" fill="none"/>')
            ls = scale
            svg.append(f'<g transform="translate({p_tip[0]},{p_tip[1]}) rotate({ang})" style="animation: plantSway 5.5s ease-in-out {dly} infinite alternate; transform-origin: 0 0;">')
            # Long elliptical paddle leaf
            svg.append(f'<ellipse cx="0" cy="{-lh*0.5*ls}" rx="{lw*0.5*ls}" ry="{lh*0.5*ls}" fill="{col}" stroke="#0f2417" stroke-width="{0.8*ls}" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.3))"/>')
            # Midrib + side tears (natural splits)
            svg.append(f'<line x1="0" y1="0" x2="0" y2="{-lh*ls}" stroke="#d8f3dc" stroke-width="{2*ls}" opacity="0.7"/>')
            for tear_y in [-lh*0.35*ls, -lh*0.60*ls]:
                svg.append(f'<path d="M 0 {tear_y} Q {-lw*0.3*ls} {tear_y-8*ls} {-lw*0.5*ls} {tear_y-4*ls}" stroke="#0f2417" stroke-width="{1.2*ls}" fill="none" opacity="0.5"/>')
                svg.append(f'<path d="M 0 {tear_y} Q {lw*0.3*ls} {tear_y-8*ls} {lw*0.5*ls} {tear_y-4*ls}" stroke="#0f2417" stroke-width="{1.2*ls}" fill="none" opacity="0.5"/>')
            svg.append('</g>')

        # Iconic orange & blue flower on a stem
        f_stem_top = iso(mx + 8, my - 10, pot_top_z + 68, cx, cy, scale)
        f_stem_base = iso(mx, my, pot_top_z, cx, cy, scale)
        svg.append(f'<path d="M {f_stem_base[0]} {f_stem_base[1]} L {f_stem_top[0]} {f_stem_top[1]}" stroke="#2d4a1e" stroke-width="{3.5*scale}" stroke-linecap="round" fill="none"/>')
        # Green spathe (boat)
        spathe_pts = [iso(mx+4, my-12, pot_top_z+62, cx, cy, scale), iso(mx+14, my-8, pot_top_z+66, cx, cy, scale), iso(mx+16, my-8, pot_top_z+72, cx, cy, scale), iso(mx+4, my-14, pot_top_z+68, cx, cy, scale)]
        svg.append(poly(spathe_pts, fill="#1b4332", stroke="#0f2417", stroke_w=0.8*scale))
        # Orange petals
        for op_i, (opx, opy) in enumerate([(mx+5, my-13), (mx+9, my-10), (mx+13, my-8)]):
            op_pt = iso(opx, opy, pot_top_z + 66 + op_i*3, cx, cy, scale)
            svg.append(f'<ellipse cx="{op_pt[0]}" cy="{op_pt[1]}" rx="{7*scale}" ry="{4*scale}" fill="#f77f00" stroke="#d66000" stroke-width="{0.5*scale}"/>')
        # Blue sepals
        for bp_i, (bpx, bpy) in enumerate([(mx+4, my-15), (mx+8, my-12)]):
            bp_pt = iso(bpx, bpy, pot_top_z + 68 + bp_i*2, cx, cy, scale)
            svg.append(f'<ellipse cx="{bp_pt[0]}" cy="{bp_pt[1]}" rx="{5*scale}" ry="{3*scale}" fill="#0077cc" stroke="#004488" stroke-width="{0.5*scale}"/>')

    elif species_type == "alpine_pine":
        # Small mountain pine with multi-tiered branches + edelweiss at base
        trunk_base = iso(mx, my, pot_top_z, cx, cy, scale)
        trunk_top = iso(mx, my, pot_top_z + 70, cx, cy, scale)
        svg.append(f'<path d="M {trunk_base[0]} {trunk_base[1]} L {trunk_top[0]} {trunk_top[1]}" stroke="#3d2410" stroke-width="{7*scale}" stroke-linecap="round" fill="none"/>')
        svg.append(f'<path d="M {trunk_base[0]} {trunk_base[1]} L {trunk_top[0]} {trunk_top[1]}" stroke="#6b3f18" stroke-width="{3*scale}" stroke-linecap="round" fill="none" opacity="0.6"/>')

        # Tiered branch layers with needle tufts
        tiers = [
            (pot_top_z + 22, 28, 10, "#1b4332"),
            (pot_top_z + 36, 24, 9, "#2d6a4f"),
            (pot_top_z + 50, 20, 8, "#40916c"),
            (pot_top_z + 62, 16, 7, "#52b788"),
            (pot_top_z + 70, 12, 6, "#74c69d"),
        ]
        for tz, tw, th, tcol in tiers:
            # Left branch
            bl = iso(mx - tw, my, tz, cx, cy, scale)
            bc = iso(mx, my, tz, cx, cy, scale)
            br = iso(mx + tw, my, tz, cx, cy, scale)
            svg.append(line(bl, br, stroke="#3d2410", stroke_w=3*scale))
            # Needle tufts as triangles pointing outward
            for bx_off in [-tw, -tw*0.6, 0, tw*0.6, tw]:
                bp = iso(mx + bx_off, my, tz, cx, cy, scale)
                svg.append(f'<g style="animation: plantSway 6s ease-in-out infinite alternate; transform-origin:{bp[0]}px {bp[1]}px;">')
                # Small triangle tuft
                svg.append(f'<polygon points="{bp[0]-5*scale},{bp[1]} {bp[0]+5*scale},{bp[1]} {bp[0]},{bp[1]-th*scale}" fill="{tcol}" stroke="#0f2417" stroke-width="{0.6*scale}" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))"/>')
                svg.append('</g>')

        # Snow cap on top
        snow_top = iso(mx, my, pot_top_z + 72, cx, cy, scale)
        svg.append(f'<ellipse cx="{snow_top[0]}" cy="{snow_top[1]}" rx="{10*scale}" ry="{5*scale}" fill="#ffffff" opacity="0.9"/>')

        # Edelweiss flowers at base (little star-shaped)
        edel_positions = [(mx-10, my+10, 4), (mx+8, my+14, 3), (mx-4, my+18, 5)]
        for ex, ey, ez in edel_positions:
            ep = iso(ex, ey, pot_top_z + ez, cx, cy, scale)
            for eang in range(0, 360, 60):
                erad = math.radians(eang)
                epx = ep[0] + 4.5*math.cos(erad)*scale
                epy = ep[1] + 3*math.sin(erad)*scale
                svg.append(f'<ellipse cx="{epx}" cy="{epy}" rx="{3.5*scale}" ry="{2*scale}" fill="#f0f0e0" stroke="#c8c8a0" stroke-width="{0.4*scale}" transform="rotate({eang},{ep[0]},{ep[1]})"/>')
            svg.append(f'<circle cx="{ep[0]}" cy="{ep[1]}" r="{2.5*scale}" fill="#f0d060"/>')

    elif species_type == "boston_fern":
        # Giant Boston Fern: Arching fronds with pinnate leaflets
        # Central crown, multiple arching fronds
        frond_base = iso(mx, my, pot_top_z, cx, cy, scale)
        fronds = [
            (22, -20, 55, "0s"), (-20, 24, 60, "0.5s"),
            (30, 18, 68, "1.0s"), (-14, -28, 52, "0.3s"),
            (2, 4, 72, "0.8s"), (26, -8, 64, "1.3s"),
            (-18, 10, 58, "0.6s"), (10, 26, 62, "1.1s"),
        ]
        for fdx, fdy, fdz, dly in fronds:
            f_tip = iso(mx + fdx, my + fdy, pot_top_z + fdz, cx, cy, scale)
            f_mid = iso(mx + fdx*0.55, my + fdy*0.55, pot_top_z + fdz*0.6, cx, cy, scale)
            # Arching rachis (main frond stem)
            svg.append(f'<path d="M {frond_base[0]} {frond_base[1]} Q {f_mid[0]} {f_mid[1]} {f_tip[0]} {f_tip[1]}" stroke="#1b4332" stroke-width="{2.5*scale}" fill="none" style="animation: plantSway 5s ease-in-out {dly} infinite alternate; transform-origin:{frond_base[0]}px {frond_base[1]}px;"/>')
            # Pinnae (feathery leaflets along each side of the rachis)
            steps = 7
            for si in range(1, steps):
                t = si / steps
                # Interpolate position along rachis using quadratic bezier
                ix = (1-t)**2 * frond_base[0] + 2*(1-t)*t * f_mid[0] + t**2 * f_tip[0]
                iy = (1-t)**2 * frond_base[1] + 2*(1-t)*t * f_mid[1] + t**2 * f_tip[1]
                pinna_size = (6 + si * 2.5) * scale * (1 - t * 0.3)
                # Left pinna
                svg.append(f'<ellipse cx="{ix - pinna_size*0.7}" cy="{iy - pinna_size*0.5}" rx="{pinna_size*0.9}" ry="{pinna_size*0.45}" fill="#2d6a4f" stroke="#1b4332" stroke-width="{0.6*scale}" opacity="0.9"/>')
                # Right pinna
                svg.append(f'<ellipse cx="{ix + pinna_size*0.7}" cy="{iy - pinna_size*0.5}" rx="{pinna_size*0.9}" ry="{pinna_size*0.45}" fill="#40916c" stroke="#1b4332" stroke-width="{0.6*scale}" opacity="0.9"/>')

    else:
        # Fallback: Generic tropical broadleaf philodendron
        for ang in range(0, 360, 55):
            rad = math.radians(ang)
            lx = mx + 32 * math.cos(rad)
            ly = my + 32 * math.sin(rad)
            p_b = iso(mx, my, pot_top_z, cx, cy, scale)
            p_t = iso(lx, ly, pot_top_z + 52, cx, cy, scale)
            svg.append(line(p_b, p_t, stroke="#1e3f20", stroke_w=3*scale))
            svg.append(f'<g style="animation: plantSway 4.2s ease-in-out infinite alternate;">')
            svg.append(f'<ellipse cx="{p_t[0]}" cy="{p_t[1]}" rx="{20*scale}" ry="{12*scale}" fill="#2d6a4f" stroke="#1b4332" stroke-width="{1*scale}"/>')
            svg.append(f'<ellipse cx="{p_t[0]}" cy="{p_t[1]}" rx="{13*scale}" ry="{7*scale}" fill="#74c69d" opacity="0.55"/>')
            svg.append('</g>')

    # 3. Secondary Desk Succulent (small ceramic pot near keyboard)
    d_pot = iso(165, 175, 75, cx, cy, scale)
    svg.append(f'<circle cx="{d_pot[0]}" cy="{d_pot[1]}" r="{8*scale}" fill="#fcfbf9" stroke="#0a6358" stroke-width="{1*scale}"/>')
    svg.append(f'<circle cx="{d_pot[0]}" cy="{d_pot[1]}" r="{5.5*scale}" fill="#241408"/>')
    for sang in range(0, 360, 60):
        s_rad = math.radians(sang)
        sx = d_pot[0] + 5 * math.cos(s_rad) * scale
        sy = d_pot[1] + 4 * math.sin(s_rad) * scale
        svg.append(f'<ellipse cx="{sx}" cy="{sy}" rx="{4*scale}" ry="{2.5*scale}" fill="#52b788" stroke="#2d6a4f" stroke-width="{0.4*scale}" transform="rotate({sang},{d_pot[0]},{d_pot[1]})"/>')

    # 4. Trailing Bookshelf Vine (Golden Pothos cascading off top shelf)
    sh_plant = iso(22, 295, 148, cx, cy, scale)
    svg.append(f'<circle cx="{sh_plant[0]}" cy="{sh_plant[1]}" r="{8.5*scale}" fill="#c86432" stroke="#782d1e" stroke-width="{1*scale}"/>')
    svg.append(f'<circle cx="{sh_plant[0]}" cy="{sh_plant[1]}" r="{5.5*scale}" fill="#241408"/>')
    # Cascading vine tendril
    vine_cp1 = (sh_plant[0]+10*scale, sh_plant[1]+30*scale)
    vine_end = (sh_plant[0]+6*scale, sh_plant[1]+92*scale)
    svg.append(f'<path d="M {sh_plant[0]} {sh_plant[1]} Q {vine_cp1[0]} {vine_cp1[1]} {vine_end[0]} {vine_end[1]}" stroke="#2d6a4f" stroke-width="{2.2*scale}" fill="none"/>')
    for vy_off in [16, 32, 50, 68, 85]:
        t = vy_off / 92
        vx = (1-t)**2 * sh_plant[0] + 2*(1-t)*t * vine_cp1[0] + t**2 * vine_end[0]
        vy = (1-t)**2 * sh_plant[1] + 2*(1-t)*t * vine_cp1[1] + t**2 * vine_end[1]
        svg.append(f'<ellipse cx="{vx}" cy="{vy}" rx="{6.5*scale}" ry="{4*scale}" fill="#74c69d" stroke="#1b4332" stroke-width="{0.5*scale}"/>')
        # Variegation stripe
        svg.append(f'<ellipse cx="{vx+1*scale}" cy="{vy}" rx="{2*scale}" ry="{2.5*scale}" fill="#c8f0c0" opacity="0.7"/>')

    return "\n".join(svg)

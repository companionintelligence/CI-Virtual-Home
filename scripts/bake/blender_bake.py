# The Blender half of the bake (scripts/bake/bake.mts spawns it: blender -b --factory-startup --python blender_bake.py -- job.json out.json).
#
# One manifest entry in, one JSON record out: role-split, normalised, quantised geometry. Nothing here reads the repo; the job file carries
# everything (source path, objects, pose, scale, role table, budget, nine-slice fits). Modes:
#   bake       the production path (stages 1-12 below)
#   swatches   the role-table bootstrap: per material (and per palette cell) the triangle count and the mean colour, so a human can write
#              the role table in models/roles/*.json. Reads the pack's own texture files; nothing is written back.
#   list       every mesh object with its parent, triangles, determinant and materials (to pick `objects`)
#
# Stages (PLAN 5.4, model-integration 2.1):
#   1  import         FBX / GLB / Collada, objects by name plus every child (sorted), `include` / `exclude` for the unparented parts
#   2  world bake     the matrix_world goes into the vertices: the FBX x100 node scale and the -90 degree X turn are absorbed here, never
#                     in the engine; a negative determinant (a mirrored object) flips the winding of that object's triangles
#   3  front axis     a Z yaw so the pack's front (+Y / -Y / +X / -X, plus the entry's own `yaw`) becomes Blender -Y, then Blender
#                     (x, y, z) -> three (x, z, -y): a proper rotation, so the front is +z and y is up, the repo's contract
#   4  scale          ONE uniform factor (to a target `height`, or an explicit `uniform`); `plan` is a non-uniform escape hatch, flagged
#   5  pivot          floor-centre | wall-back (back plane at z = 0, growing +z) | ceiling; `pivotParts` keeps taps and handles out of the centre
#   6  roles          material name, or palette cell (UV centroid -> cell of the palette image) -> role
#   7  clean-up       0.1 mm weld, zero-area triangles dropped, closedness and signed volume measured per part
#   8  decimate       only a part over its share of the budget: planar dissolve, then collapse (per role part, so role borders never merge)
#   9  nine-slice     triangles bisected at the band planes so vertices exist there (the runtime stretches only what is between them)
#   10 hard edges     vertices split where adjacent faces differ by more than `hardEdge` degrees (the runtime recomputes normals)
#   11 quantise       uint16 over each part's own bounding box, base64
#
# Deterministic: sorted iteration everywhere, positions rounded to 1e-5 before quantising, no clock, no random, PYTHONHASHSEED=0 from the driver.
import bpy, sys, os, json, math, struct, base64, hashlib

argv = sys.argv[sys.argv.index('--') + 1:]
JOB = json.load(open(argv[0]))
OUT = argv[1]
MODE = JOB.get('mode', 'bake')

def log(*a):
    print('BAKE', *a, flush=True)

def fail(msg):
    log('ERROR', msg)
    json.dump({'error': msg}, open(OUT, 'w'))
    raise SystemExit(0)

# ---- 1. import -----------------------------------------------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
SRC = JOB['src']
ext = os.path.splitext(SRC)[1].lower()
if ext == '.fbx':
    bpy.ops.import_scene.fbx(filepath=SRC)
elif ext in ('.glb', '.gltf'):
    bpy.ops.import_scene.gltf(filepath=SRC)
elif ext == '.dae':
    bpy.ops.wm.collada_import(filepath=SRC)
else:
    fail('unsupported source format ' + ext)

if MODE == 'list':
    dg = bpy.context.evaluated_depsgraph_get()
    rows = []
    for o in sorted(bpy.context.scene.objects, key=lambda o: o.name):
        if o.type != 'MESH':
            continue
        me = o.evaluated_get(dg).to_mesh(); me.calc_loop_triangles()
        rows.append({'name': o.name, 'parent': o.parent.name if o.parent else None, 'tris': len(me.loop_triangles),
                     'det': round(o.matrix_world.to_3x3().determinant(), 5), 'materials': [s.material.name if s.material else None for s in o.material_slots]})
    json.dump({'objects': rows}, open(OUT, 'w'), indent=1)
    raise SystemExit(0)

def with_children(o, acc):
    acc.append(o)
    for c in sorted(o.children, key=lambda c: c.name):
        with_children(c, acc)

objs = []
for n in JOB['objects'] + JOB.get('include', []):
    o = bpy.data.objects.get(n)
    if o is None:
        fail('object not found in the source: ' + n)
    with_children(o, objs)
exclude = set(JOB.get('exclude', []))
seen = set(); uniq = []
for o in objs:
    if o.name in exclude or o.name in seen or o.type != 'MESH':
        continue
    seen.add(o.name); uniq.append(o)
objs = sorted(uniq, key=lambda o: o.name)
if not objs:
    fail('no mesh objects selected')

# ---- the role source -------------------------------------------------------------------------------------------------------------
ROLES = JOB.get('roles', {})
PALETTE_MATS = set(ROLES.get('paletteMaterials', []))
GRID = ROLES.get('grid', [1, 1])            # columns, rows of the palette image
MATMAP = ROLES.get('materials', {})         # material name -> role (a palette material uses `cells`)
CELLS = ROLES.get('cells', {})              # "col,row" (row counted from the TOP of the palette image) -> role

def cell_of(uv):
    c = min(GRID[0] - 1, max(0, int(math.floor(uv[0] * GRID[0]))))
    r = min(GRID[1] - 1, max(0, int(math.floor((1.0 - uv[1]) * GRID[1]))))
    return '%d,%d' % (c, r)

def find_image_pixels(path):
    import numpy as np
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size[0], img.size[1]
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape((h, w, 4)), w, h

def srgb8(v):
    v = max(0.0, min(1.0, float(v)))
    v = v * 12.92 if v <= 0.0031308 else 1.055 * (v ** (1 / 2.4)) - 0.055
    return int(round(v * 255))

# ---- 2/3. world bake and front axis ----------------------------------------------------------------------------------------------
POSE = JOB.get('pose', {})
FRONT = POSE.get('front', '+Y')
# the yaw that turns the front onto Blender -Y (+Y -> 180, -Y -> 0, +X -> -90, -X -> +90; the pilot had the last two swapped)
YAW = {'-Y': 0, '+Y': 180, '+X': -90, '-X': 90}[FRONT] + float(POSE.get('yaw', 0))
yaw = math.radians(YAW)
cy, sy = math.cos(yaw), math.sin(yaw)

def to_three(v):
    x, y, z = v[0] * cy - v[1] * sy, v[0] * sy + v[1] * cy, v[2]
    return (x, z, -y)

flip_objs = set(JOB.get('flipObjects', []))
dg = bpy.context.evaluated_depsgraph_get()
tris = []            # (role-key, obj name, (p0, p1, p2)) in three axes, metres, unscaled
mirrored = []
flipped_by = {}
stray_uv = 0
for o in objs:
    eo = o.evaluated_get(dg); me = eo.to_mesh()
    M = o.matrix_world
    det = M.to_3x3().determinant()
    flip = det < 0 and not JOB.get('noFlip')      # noFlip: the diagnostic that shows what the flip fixes
    if det < 0:
        mirrored.append(o.name)
    if o.name in flip_objs:
        flip = not flip
    flipped_by[o.name] = flip
    me.calc_loop_triangles()
    mats = [s.material.name if s.material else '' for s in o.material_slots]
    uvl = me.uv_layers.active.data if me.uv_layers.active else None
    vs = [to_three(M @ v.co) for v in me.vertices]
    for t in me.loop_triangles:
        mname = mats[t.material_index] if t.material_index < len(mats) else ''
        key = mname
        if mname in PALETTE_MATS:
            if uvl is None:
                fail('palette material %s on %s has no UVs' % (mname, o.name))
            uvs = [uvl[l].uv for l in t.loops]
            cs = set(cell_of(u) for u in uvs)
            if len(cs) > 1:
                stray_uv += 1
            cu = ((uvs[0][0] + uvs[1][0] + uvs[2][0]) / 3.0, (uvs[0][1] + uvs[1][1] + uvs[2][1]) / 3.0)
            key = mname + '@' + cell_of(cu)
        p = [vs[i] for i in t.vertices]
        if flip:
            p = [p[0], p[2], p[1]]
        tris.append((key, o.name, (p[0], p[1], p[2])))
    eo.to_mesh_clear()

def role_of(key):
    if '@' in key:
        cell = key.split('@', 1)[1]
        if cell in CELLS:
            return CELLS[cell]
        return None
    if key in MATMAP:
        return MATMAP[key]
    return None

# ---- swatches mode ---------------------------------------------------------------------------------------------------------------
if MODE == 'swatches':
    rows = {}
    for key, oname, p in tris:
        r = rows.setdefault(key, {'key': key, 'tris': 0, 'objects': set()})
        r['tris'] += 1; r['objects'].add(oname)
    pal = None
    pal_path = ROLES.get('paletteImage')
    if pal_path:
        pal = find_image_pixels(pal_path)
    tex_root = JOB.get('textureRoot')
    for r in rows.values():
        key = r['key']; r['objects'] = sorted(r['objects'])
        if '@' in key and pal:
            a, w, h = pal
            col, row = [int(v) for v in key.split('@', 1)[1].split(',')]
            x0, x1 = int(col * w / GRID[0]), max(int(col * w / GRID[0]) + 1, int((col + 1) * w / GRID[0]))
            y_top0, y_top1 = int(row * h / GRID[1]), max(int(row * h / GRID[1]) + 1, int((row + 1) * h / GRID[1]))
            sl = a[h - y_top1:h - y_top0, x0:x1, :3].reshape(-1, 3).mean(axis=0)
            r['mean'] = '#%02x%02x%02x' % tuple(srgb8(c) for c in sl)
        elif tex_root and '@' not in key:
            found = None
            for dp, dn, fn in os.walk(tex_root):
                for f in sorted(fn):
                    if os.path.splitext(f)[0] == key and os.path.splitext(f)[1].lower() in ('.png', '.jpg', '.jpeg'):
                        found = os.path.join(dp, f); break
                if found: break
            if found:
                a, w, h = find_image_pixels(found)
                sl = a[:, :, :3].reshape(-1, 3).mean(axis=0)
                r['mean'] = '#%02x%02x%02x' % tuple(srgb8(c) for c in sl)
                r['image'] = os.path.relpath(found, tex_root)
        r['role'] = role_of(key)
    json.dump({'swatches': sorted(rows.values(), key=lambda r: r['key'])}, open(OUT, 'w'), indent=1)
    raise SystemExit(0)

# ---- 6. roles (checked now, applied below) ---------------------------------------------------------------------------------------
missing = sorted(set(k for k, _, _ in tris if role_of(k) is None))
if missing:
    fail('no role for: ' + ', '.join(missing) + '  (add them to the entry\'s roles table: models/roles/*.json)')

# ---- 4/5. scale and pivot --------------------------------------------------------------------------------------------------------
def bbox(points):
    return ([min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)])

allp = [p for _, _, t in tris for p in t]
mn, mx = bbox(allp)
native = [mx[i] - mn[i] for i in range(3)]
SC = JOB.get('scale', {})
non_uniform = False
if 'plan' in SC:
    sx, sy_, sz = [float(v) for v in SC['plan']]; non_uniform = not (sx == sy_ == sz)
elif 'height' in SC:
    sx = sy_ = sz = float(SC['height']) / native[1]
elif 'uniform' in SC:
    sx = sy_ = sz = float(SC['uniform'])
else:
    sx = sy_ = sz = 1.0

def scale_pt(p):
    return (p[0] * sx, p[1] * sy_, p[2] * sz)

tris = [(k, o, tuple(scale_pt(p) for p in t)) for k, o, t in tris]
pp = [p for _, o, t in tris if (not JOB.get('pivotParts') or o in JOB['pivotParts']) for p in t]
allp = [p for _, _, t in tris for p in t]
pmn, pmx = bbox(pp or allp)
amn, amx = bbox(allp)
PIVOT = POSE.get('pivot', 'floor-centre')
if PIVOT == 'floor-centre':
    off = ((pmn[0] + pmx[0]) / 2, amn[1], (pmn[2] + pmx[2]) / 2)
elif PIVOT == 'wall-back':
    off = ((pmn[0] + pmx[0]) / 2, amn[1], amn[2])
elif PIVOT == 'ceiling':
    off = ((pmn[0] + pmx[0]) / 2, amx[1], (pmn[2] + pmx[2]) / 2)
else:
    fail('unknown pivot ' + PIVOT)

def R5(v):
    r = round(v, 5)
    return 0.0 if r == 0 else r

def norm_pt(p):
    return (R5(p[0] - off[0]), R5(p[1] - off[1]), R5(p[2] - off[2]))

# ---- 7. clean-up: weld, drop degenerates, group by role --------------------------------------------------------------------------
WELD = float(JOB.get('weld', 1e-4))
vkey = lambda p: (int(round(p[0] / WELD)), int(round(p[1] / WELD)), int(round(p[2] / WELD)))

def area2(a, b, c):
    ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
    nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
    return nx * nx + ny * ny + nz * nz

parts = {}   # role -> list of triangles (3 points)
objrole = {}  # (source object, role) -> its triangles: the finest shell the winding gate looks at
objtris = {}  # source object -> its triangles, for the per-object winding check
dropped = 0
weldmap = {}
for k, o, t in tris:
    role = role_of(k)
    q = []
    for p in t:
        p = norm_pt(p); kk = vkey(p)
        q.append(weldmap.setdefault(kk, p))
    if vkey(q[0]) == vkey(q[1]) or vkey(q[1]) == vkey(q[2]) or vkey(q[0]) == vkey(q[2]) or area2(*q) < 1e-14:
        dropped += 1; continue
    parts.setdefault(role, []).append(q)
    objtris.setdefault(o, []).append(q)
    objrole.setdefault((o, role), []).append(q)

def signed_volume(P):
    v = 0.0
    for a, b, c in P:
        v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6.0
    return v

def open_edges(P):
    # a closed shell: every directed edge is used once and its reverse is used once. Returns how many directed edges break that.
    d = {}
    for a, b, c in P:
        for u, v in ((a, b), (b, c), (c, a)):
            d.setdefault((vkey(u), vkey(v)), 0); d[(vkey(u), vkey(v))] += 1
    return sum(1 for (u, v), n in d.items() if n != 1 or d.get((v, u), 0) != 1)

# the winding check that does not depend on the determinant rule: every source object that is a closed shell on its own must have positive
# signed volume once normalised (a mirrored object left unflipped, or an inverted source shell, shows up negative here)
obj_report = []
for oname in sorted(objtris):
    P = objtris[oname]
    ne = open_edges(P)
    obj_report.append({'name': oname, 'tris': len(P), 'closed': ne == 0, 'openEdges': ne, 'vol': round(signed_volume(P), 8), 'mirrored': oname in mirrored, 'flipped': flipped_by.get(oname, False)})

shell_report = []
for (oname, role) in sorted(objrole):
    P = objrole[(oname, role)]
    ne = open_edges(P)
    shell_report.append({'object': oname, 'role': role, 'tris': len(P), 'closed': ne == 0, 'vol': round(signed_volume(P), 8)})

# ---- 8. decimate -----------------------------------------------------------------------------------------------------------------
BUDGET = JOB.get('budget', {}).get('tris')
decimated = False
if BUDGET and sum(len(P) for P in parts.values()) > BUDGET:
    import bmesh
    total = sum(len(P) for P in parts.values())
    for role in sorted(parts):
        P = parts[role]
        target = max(4, int(BUDGET * len(P) / total))
        if len(P) <= target:
            continue
        verts, vi, faces = [], {}, []
        for a, b, c in P:
            f = []
            for p in (a, b, c):
                k = vkey(p)
                if k not in vi:
                    vi[k] = len(verts); verts.append(p)
                f.append(vi[k])
            faces.append(f)
        me = bpy.data.meshes.new('dec_' + role); me.from_pydata(verts, [], faces); me.update()
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(0.5), verts=bm.verts, edges=bm.edges)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new('dec_' + role, me); bpy.context.scene.collection.objects.link(ob)
        if len(me.polygons) > target:
            md = ob.modifiers.new('d', 'DECIMATE'); md.decimate_type = 'COLLAPSE'; md.ratio = target / float(len(me.polygons)); md.use_collapse_triangulate = True
        d2 = bpy.context.evaluated_depsgraph_get()
        em = ob.evaluated_get(d2).to_mesh(); em.calc_loop_triangles()
        newP = []
        for t in em.loop_triangles:
            q = [tuple(R5(c) for c in em.vertices[i].co) for i in t.vertices]
            if area2(*q) > 1e-14:
                newP.append(q)
        parts[role] = newP
        decimated = True
        bpy.data.objects.remove(ob)

# ---- 9. nine-slice cuts ----------------------------------------------------------------------------------------------------------
FIT = JOB.get('fit', {})
AXIS = {'x': 0, 'y': 1, 'z': 2}

CUT_EPS = 2e-4     # a vertex within 0.2 mm of a band plane counts as ON it: bands should sit on planes the mesh already has (a plane through
                   # the middle of a face costs triangles; a plane on existing vertices costs nothing)
cut_count = 0

def cut_triangles(P, ax, c):
    global cut_count
    out = []
    for a, b, d in P:
        ps = [a, b, d]; side = [p[ax] - c for p in ps]
        if all(s >= -CUT_EPS for s in side) or all(s <= CUT_EPS for s in side):
            out.append((a, b, d)); continue
        cut_count += 1
        # polygon clip against the plane, then fan: keeps the winding
        poly_lo, poly_hi = [], []
        for i in range(3):
            p, q = ps[i], ps[(i + 1) % 3]; sp, sq = side[i], side[(i + 1) % 3]
            if sp > CUT_EPS: poly_hi.append(p)
            elif sp < -CUT_EPS: poly_lo.append(p)
            else: poly_hi.append(p); poly_lo.append(p)      # on the plane: belongs to both halves
            if (sp > CUT_EPS and sq < -CUT_EPS) or (sp < -CUT_EPS and sq > CUT_EPS):
                # interpolate from the endpoint with the smaller key so both neighbours of the edge compute the same point
                u, v = (p, q) if vkey(p) <= vkey(q) else (q, p)
                su, sv = u[ax] - c, v[ax] - c
                t = su / (su - sv)
                m = tuple(R5(u[i] + (v[i] - u[i]) * t) if i != ax else R5(c) for i in range(3))
                poly_hi.append(m); poly_lo.append(m)
        for poly in (poly_lo, poly_hi):
            for i in range(1, len(poly) - 1):
                tri = (poly[0], poly[i], poly[i + 1])
                if area2(*tri) > 1e-14:
                    out.append(tri)
    return out

cut_planes = []
for param in sorted(FIT):
    f = FIT[param]; ax = AXIS[f['axis']]
    for c in f['band']:
        cut_planes.append((ax, float(c)))
if cut_planes:
    for role in sorted(parts):
        P = parts[role]
        for ax, c in sorted(set(cut_planes)):
            P = cut_triangles(P, ax, c)
        parts[role] = P

# ---- the part records ------------------------------------------------------------------------------------------------------------
HARD = math.radians(float(JOB.get('hardEdge', 35)))
COS = math.cos(HARD)

def normal(t):
    a, b, c = t
    ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
    nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
    l = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
    return (nx / l, ny / l, nz / l)

def quantise(P):
    N = [normal(t) for t in P]
    verts, vmap, idx = [], {}, []
    for ti, t in enumerate(P):
        for p in t:
            k = vkey(p); found = None
            for rep_n, vi in vmap.get(k, []):
                if rep_n[0] * N[ti][0] + rep_n[1] * N[ti][1] + rep_n[2] * N[ti][2] >= COS:
                    found = vi; break
            if found is None:
                verts.append(p); found = len(verts) - 1
                vmap.setdefault(k, []).append((N[ti], found))
            idx.append(found)
    bb0 = [min(v[i] for v in verts) for i in range(3)]; bb1 = [max(v[i] for v in verts) for i in range(3)]
    q = bytearray()
    for v in verts:
        for i in range(3):
            ext_ = (bb1[i] - bb0[i])
            q += struct.pack('<H', 0 if ext_ == 0 else int(round((v[i] - bb0[i]) / ext_ * 65535)))
    iw = 1 if len(verts) <= 256 else 2
    ib = bytearray()
    for i in idx:
        ib += struct.pack('<B' if iw == 1 else '<H', i)
    return verts, idx, bb0, bb1, bytes(q), bytes(ib), iw

COLOR_ROLE = JOB.get('colorParam')
OPEN_ROLES = set(JOB.get('open', []))
out_parts = []
total_tris = 0
for role in sorted(parts):
    P = parts[role]
    nopen = open_edges(P)
    closed = nopen == 0
    vol = signed_volume(P)
    verts, idx, bb0, bb1, q, ib, iw = quantise(P)
    total_tris += len(P)
    out_parts.append({'role': role, 'tris': len(P), 'verts': len(verts), 'iw': iw,
                      'bb': [R5(v) for v in bb0 + bb1], 'closed': closed, 'openEdges': nopen, 'vol': round(vol, 8),
                      'open': role in OPEN_ROLES or (not closed),
                      'colorParam': role == COLOR_ROLE,
                      'pos': base64.b64encode(q).decode('ascii'), 'idx': base64.b64encode(ib).decode('ascii')})

allbb = [min(p['bb'][i] for p in out_parts) for i in range(3)] + [max(p['bb'][3 + i] for p in out_parts) for i in range(3)]
json.dump({
    'parts': out_parts, 'box': allbb, 'tris': total_tris, 'dropped': dropped,
    'scale': [round(sx, 6), round(sy_, 6), round(sz, 6)], 'nonUniform': non_uniform,
    'nativeDims': [round(v, 4) for v in native], 'yaw': YAW, 'pivot': PIVOT, 'pivotOffset': [round(v, 5) for v in off],
    'mirroredObjects': mirrored, 'objects': [o.name for o in objs], 'objectReport': obj_report, 'shellReport': shell_report, 'decimated': decimated, 'strayUV': stray_uv, 'cutTriangles': cut_count,
}, open(OUT, 'w'), indent=1)
log('OK', JOB.get('id'), 'tris', total_tris, 'parts', len(out_parts), 'scale', round(sx, 4), 'mirrored', mirrored)

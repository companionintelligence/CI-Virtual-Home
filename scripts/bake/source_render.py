# Blender Workbench render of ONE source asset as the pack ships it (textures re-linked by file name from the pack folder, which is how the
# packs have to be opened: their FBX files point at the author's own disk), for the comparison sheets (scripts/bake/sheet.mts --sources).
# Review material only: the output goes to a temp folder or _staging, never into the repo.
#   blender -b --factory-startup --python source_render.py -- <source file> <out.png> <obj1,obj2> <res> [front +Y|-Y|+X|-X] [yaw]
import bpy, sys, os, math, mathutils

argv = sys.argv[sys.argv.index('--') + 1:]
src, out, names, res = argv[0], argv[1], argv[2].split(','), int(argv[3])
front = argv[4] if len(argv) > 4 else '+Y'
extra_yaw = float(argv[5]) if len(argv) > 5 else 0.0

bpy.ops.wm.read_factory_settings(use_empty=True)
ext = os.path.splitext(src)[1].lower()
if ext == '.fbx': bpy.ops.import_scene.fbx(filepath=src)
elif ext in ('.glb', '.gltf'): bpy.ops.import_scene.gltf(filepath=src)
else: bpy.ops.wm.collada_import(filepath=src)

# the pack folder: <root>/<Pack>/<Pack>/...
parts = src.split(os.sep)
i = parts.index('3dinside') if '3dinside' in parts else None
pack_dir = os.sep.join(parts[:i + 3]) if i is not None else os.path.dirname(src)
index = {}
for dp, dn, fn in os.walk(pack_dir):
    for f in sorted(fn):
        if os.path.splitext(f)[1].lower() in ('.png', '.jpg', '.jpeg'):
            index.setdefault(f.lower(), os.path.join(dp, f))
for img in bpy.data.images:
    base = os.path.basename(img.filepath.replace('\\', '/')).lower()
    if base in index and (img.size[0] == 0 or not os.path.exists(bpy.path.abspath(img.filepath))):
        img.filepath = index[base]
        try: img.reload()
        except Exception: pass

def with_children(o, acc):
    acc.append(o)
    for c in o.children: with_children(c, acc)
keep = []
for n in names:
    with_children(bpy.data.objects[n], keep)
for o in list(bpy.context.scene.objects):
    if o not in keep: bpy.data.objects.remove(o)

YAW = {'-Y': 0, '+Y': 180, '+X': -90, '-X': 90}[front] + extra_yaw
roots = [o for o in keep if o.parent is None]
pivot = bpy.data.objects.new('pivot', None); bpy.context.scene.collection.objects.link(pivot)
for o in roots: o.parent = pivot
bpy.context.view_layer.update()
pivot.rotation_euler = (0, 0, math.radians(YAW))
bpy.context.view_layer.update()
pts = [o.matrix_world @ mathutils.Vector(c) for o in keep if o.type == 'MESH' for c in o.bound_box]
lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)]); hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
c = (lo + hi) / 2; size = hi - lo
r = max(size.x, size.y, size.z, 0.4) * 1.15

# the prop sheet's view: a floor, the front-right three-quarter (the front is Blender -Y after the yaw)
fl = bpy.data.objects.new('floor', bpy.data.meshes.new('floor'))
bpy.context.scene.collection.objects.link(fl)
fl.data.from_pydata([(-6, -6, lo.z), (6, -6, lo.z), (6, 6, lo.z), (-6, 6, lo.z)], [], [(0, 1, 2, 3)])
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.render.resolution_x, sc.render.resolution_y = int(res * 16 / 9), res
sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'; sh.show_cavity = False
sc.display.render_aa = '8'
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.angle = math.radians(32 * 16 / 9 * 0.62)   # about the prop sheet's 32 degree vertical fov
cam.location = (c.x + r * 1.6, c.y - r * 2.0, c.z + r * 1.1)
d = c - cam.location
cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
sc.world = bpy.data.worlds.new('w'); sc.world.color = (0.9, 0.9, 0.9)
sc.render.filepath = out
sc.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
print('SOURCE OK', out)

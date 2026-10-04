# Converts the user's Blender skateboard (2024DECK.fbx) into the optimized, game-ready src/board/deck.glb.
#
#   "C:\Program Files\Blender Foundation\Blender 3.6\blender.exe" -b --factory-startup --python tools/convert-board.py -- <in.fbx> <out.glb>
#
# What it does:
#   * imports the FBX, applies the Bearings empty's scale/rotation, flips it upright (wheels down) and turns it so the
#     nose ends up on +Z in glTF (board-local frame from src/core/constants.js: origin = wheel contact center, +Y up)
#   * decimates every part to a web budget (the source is ~1.17M tris)
#   * slides each truck assembly so its axle sits at BOARD.truckAxleZ
#   * regroups the parts into animatable nodes, origins at their pivots:
#       deck            grip / graphic / ply edge (static)
#       truck_F/B       baseplate, bushings, mounting bolts (static)
#       hanger_F/B      hanger + axle + axle nuts, origin on the axle line (leans around Z)
#       wheel_FL/FR/BL/BR  urethane + bearings, origin at the wheel center (spins around X)
#   Each part keeps its own material name so the game can swap in real materials by name.
import bpy, bmesh, sys, math
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SRC = argv[0] if len(argv) > 0 else r"D:\!ROM BODY MODELS!\2024DECK.fbx"
OUT = argv[1] if len(argv) > 1 else r"src/board/deck.glb"

TRUCK_AXLE_Z = 0.205  # BOARD.truckAxleZ

# target triangle counts per material (whole board)
TARGET = {
    'wheels': 4 * 900,
    'bottomtrucks': 2 * 700,
    'maintrucks': 2 * 1400,
    'hardware1': 3600,
    'truckbushingsz': 2 * 450,
    'outerbearing': 4 * 160,
    'innerbarinjg': 4 * 96,
    'griptape': 3400,
    'deck graphic': 3400,
    'sidedeck': 3136,
}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)
for o in list(bpy.data.objects):
    if o.type != 'MESH':
        bpy.data.objects.remove(o)
src = [o for o in bpy.data.objects if o.type == 'MESH'][0]
src.name = 'board'
bpy.context.view_layer.objects.active = src
src.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# flip upright: the import comes in wheels-up
src.data.transform(Matrix.Rotation(math.pi, 4, 'Y'))
src.data.update()


def mat_verts(me, name):
    idx = next(i for i, m in enumerate(me.materials) if m and m.name == name)
    vs = set()
    for p in me.polygons:
        if p.material_index == idx:
            vs.update(p.vertices)
    return [me.vertices[i].co.copy() for i in vs]


me = src.data
wheel_vs = mat_verts(me, 'wheels')
ground = min(v.z for v in wheel_vs)
ys = [v.y for v in wheel_vs]
cy = (min(ys) + max(ys)) / 2
xs = [v.x for v in wheel_vs]
cx = (min(xs) + max(xs)) / 2
me.transform(Matrix.Translation((-cx, -cy, -ground)))
me.update()

# nose = the end with the longer / higher kick. Put it on Blender -Y (glTF +Z).
side_vs = mat_verts(me, 'sidedeck')
endA = max(v.y for v in side_vs)
endB = -min(v.y for v in side_vs)
hA = max(v.z for v in side_vs if v.y > 0.3)
hB = max(v.z for v in side_vs if v.y < -0.3)
print('ENDS +Y: reach %.4f height %.4f | -Y: reach %.4f height %.4f' % (endA, hA, endB, hB))
nose_is_posY = (endA + hA) > (endB + hB)
if nose_is_posY:
    me.transform(Matrix.Rotation(math.pi, 4, 'Z'))
    me.update()
print('nose was on', '+Y' if nose_is_posY else '-Y', '(Blender) -> now -Y = glTF +Z')

# separate by material
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='MATERIAL')
bpy.ops.object.mode_set(mode='OBJECT')

parts = {}
for o in bpy.data.objects:
    parts[o.data.materials[0].name] = o
    # drop the second UV set and the UVs entirely: the game projects its own UVs
    while o.data.uv_layers:
        o.data.uv_layers.remove(o.data.uv_layers[0])


def tris(o):
    o.data.calc_loop_triangles()
    return len(o.data.loop_triangles)


before = 0
after = 0
for name, o in parts.items():
    t0 = tris(o)
    before += t0
    tgt = TARGET.get(name, t0)
    if tgt < t0:
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        # weld the duplicate verts left by the modeling (seams / mirror), so collapse keeps the surface closed
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.remove_doubles(threshold=0.00002)
        bpy.ops.object.mode_set(mode='OBJECT')
        mod = o.modifiers.new('dec', 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = tgt / tris(o)
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    t1 = tris(o)
    after += t1
    print('DECIMATE %-16s %8d -> %6d' % (name, t0, t1))
print('TOTAL TRIS %d -> %d' % (before, after))


def split_islands(o):
    """Separate o into loose parts; returns list of objects."""
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.mesh.separate(type='LOOSE')
    return [x for x in bpy.context.selected_objects]


def center(o):
    vs = [v.co for v in o.data.vertices]
    mn = Vector([min(v[i] for v in vs) for i in range(3)])
    mx = Vector([max(v[i] for v in vs) for i in range(3)])
    return (mn + mx) / 2, mn, mx


groups = {k: [] for k in ['deck', 'truck_F', 'truck_B', 'hanger_F', 'hanger_B', 'wheel_FL', 'wheel_FR', 'wheel_BL', 'wheel_BR']}
groups['deck'] = [parts['griptape'], parts['deck graphic'], parts['sidedeck']]

# front = -Y in Blender (nose). "L" = +X (board's left when looking toward the nose, per constants.js)
def fb(c):
    return 'F' if c.y < 0 else 'B'


def lr(c):
    return 'L' if c.x > 0 else 'R'


wheel_centers = {}
for o in split_islands(parts['wheels']):
    c, mn, mx = center(o)
    key = 'wheel_' + fb(c) + lr(c)
    groups[key].append(o)
    wheel_centers[key] = c
    print('WHEEL', key, 'center', [round(v, 4) for v in c], 'dia', round(mx.z - mn.z, 4), 'width', round(mx.x - mn.x, 4))
for nm in ['outerbearing', 'innerbarinjg']:
    for o in split_islands(parts[nm]):
        c, _, _ = center(o)
        key = min(wheel_centers, key=lambda k: (wheel_centers[k] - c).length)
        groups[key].append(o)
for nm in ['bottomtrucks', 'truckbushingsz']:
    for o in split_islands(parts[nm]):
        c, _, _ = center(o)
        groups['truck_' + fb(c)].append(o)
for o in split_islands(parts['maintrucks']):
    c, mn, mx = center(o)
    groups['hanger_' + fb(c)].append(o)
for o in split_islands(parts['hardware1']):
    c, mn, mx = center(o)
    # axle nuts sit outboard of the wheels; everything else is mounting hardware / kingpin
    groups[('hanger_' if abs(c.x) > 0.07 else 'truck_') + fb(c)].append(o)

# axle line height: average wheel center
axle_y = sum(abs(c.y) for c in wheel_centers.values()) / 4
axle_z = sum(c.z for c in wheel_centers.values()) / 4
shift = axle_y - TRUCK_AXLE_Z
print('AXLE |y| %.4f height %.4f -> shifting trucks %.4f inward' % (axle_y, axle_z, shift))

final = []
for gname, objs in groups.items():
    if not objs:
        print('WARNING empty group', gname)
        continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = gname
    o.data.name = gname
    if gname != 'deck':
        front = gname.split('_')[1].startswith('F')
        o.data.transform(Matrix.Translation((0, shift if front else -shift, 0)))
    # pivots
    if gname.startswith('wheel_'):
        c, _, _ = center(o)
        piv = Vector((c.x, c.y, axle_z))
    elif gname.startswith('hanger_'):
        piv = Vector((0, -TRUCK_AXLE_Z if gname.endswith('F') else TRUCK_AXLE_Z, axle_z))
    else:
        piv = Vector((0, 0, 0))
    o.data.transform(Matrix.Translation(-piv))
    o.location = piv
    o.data.use_auto_smooth = True
    o.data.auto_smooth_angle = math.radians(40)
    for p in o.data.polygons:
        p.use_smooth = True
    final.append(o)

# report a few reference heights (board-local, Y-up = Blender Z here)
deck = bpy.data.objects['deck']
mid = [deck.matrix_world @ v.co for v in deck.data.vertices if abs(v.co.y) < 0.06 and abs(v.co.x) < 0.04]
if mid:
    print('DECK @center: bottom %.4f top %.4f' % (min(v.z for v in mid), max(v.z for v in mid)))
dmn = [min((deck.matrix_world @ v.co)[i] for v in deck.data.vertices) for i in range(3)]
dmx = [max((deck.matrix_world @ v.co)[i] for v in deck.data.vertices) for i in range(3)]
print('DECK bbox', [round(v, 4) for v in dmn], [round(v, 4) for v in dmx])

total = 0
for o in final:
    total += tris(o)
print('FINAL TRIS', total)

# materials are only name tags for the game (it builds its own); drop the image textures (the deck graphic
# references clothesXD/DECK1.png) so the GLB stays geometry-only
for m in bpy.data.materials:
    if m.use_nodes:
        for n in [n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE']:
            m.node_tree.nodes.remove(n)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_texcoords=False,
    export_normals=True,
    export_tangents=False,
    export_colors=False,
    export_materials='EXPORT',
    export_animations=False,
    export_skins=False,
    export_morph=False,
    export_extras=False,
    export_cameras=False,
    export_lights=False,
)
print('WROTE', OUT)

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { noiseTex, muralTex, bankProf, profileSolid } from './primitive-park.js';

// Default map: a flat factory warehouse. The whole perimeter is ONE continuous rolling bank (rounded corners,
// a grindable curb along its top) so you can carve around and pump for speed; the big flat middle holds the
// tech: ledges, rails and manual pads. Start on the roll-in pad at the south end.
// Building: x -28..28, z -20..20, floor y = 0.

const BX = 28;
const BZ = 20;
const WALL_H = 8;

export function createWorld(renderer, scene) {
  const colliders = [];
  const rails = [];
  const mats = {
    floor: new THREE.MeshStandardMaterial({ map: noiseTex([132, 130, 126], 12, 512, 14, true, 0.02), roughness: 0.5 }),
    bank: new THREE.MeshStandardMaterial({ map: noiseTex([150, 146, 140], 12, 256, 6, false, 0.03), roughness: 0.7, side: THREE.DoubleSide }),
    lite: new THREE.MeshStandardMaterial({ map: noiseTex([72, 66, 60], 10, 256, 3, false, 0.03), roughness: 0.5 }),
    concrete: new THREE.MeshStandardMaterial({ map: noiseTex([160, 156, 148], 12, 256, 3, false, 0.03), roughness: 0.75 }),
    red: new THREE.MeshStandardMaterial({ map: noiseTex([150, 46, 40], 10, 256, 2, false, 0.02), roughness: 0.6 }),
    gray: new THREE.MeshStandardMaterial({ map: noiseTex([92, 96, 102], 10, 256, 2, false, 0.02), roughness: 0.6 }),
    blue: new THREE.MeshStandardMaterial({ map: noiseTex([44, 70, 120], 10, 256, 2, false, 0.02), roughness: 0.6 }),
    metal: new THREE.MeshStandardMaterial({ color: '#a9aeb5', roughness: 0.28, metalness: 0.9 }),
    rail: new THREE.MeshStandardMaterial({ color: '#1d1f22', roughness: 0.45, metalness: 0.6 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#e0b21b', roughness: 0.5, metalness: 0.3 }),
    wall: new THREE.MeshStandardMaterial({ map: noiseTex([190, 188, 182], 8, 512, 8, true, 0.02), roughness: 0.9 }),
    roof: new THREE.MeshStandardMaterial({ color: '#2b2d31', roughness: 0.9 }),
    truss: new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.6, metalness: 0.5 }),
    skylight: new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#eef4ff', emissiveIntensity: 2.2 }),
  };

  // ---- indoor light ----
  scene.background = new THREE.Color('#15171a');
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  renderer.toneMappingExposure = 0.82;
  scene.fog = null;
  scene.add(new THREE.HemisphereLight('#f3f6ff', '#5d5650', 0.8));
  const sunDir = new THREE.Vector3(0.28, 1, 0.18).normalize();
  const sun = new THREE.DirectionalLight('#fff3e2', 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -26;
  sc.right = sc.top = 26;
  sc.near = 1;
  sc.far = 90;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const add = (mesh, surface, collide = true, shadow = true) => {
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    if (!mesh.parent) scene.add(mesh);
    mesh.updateMatrixWorld(true);
    if (collide) {
      mesh.userData.surface = surface;
      colliders.push(mesh);
    }
    return mesh;
  };
  const rail = (a, b, kind, radius = 0.02) => rails.push({ a: a.clone(), b: b.clone(), kind, radius });
  function block(x0, x1, z0, z1, h, mat, grind = '', kind = 'concrete', surface = 'concrete') {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), mat);
    m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
    add(m, surface);
    const e = (ax, az, bx, bz) => {
      rail(new THREE.Vector3(ax, h, az), new THREE.Vector3(bx, h, bz), kind, 0.01);
      const len = Math.hypot(bx - ax, bz - az);
      const s = new THREE.Mesh(new THREE.BoxGeometry(ax === bx ? 0.035 : len, 0.035, ax === bx ? len : 0.035), mats.metal);
      s.position.set((ax + bx) / 2 + (ax === bx ? (ax > (x0 + x1) / 2 ? -0.0165 : 0.0165) : 0), h - 0.0165, (az + bz) / 2 + (az === bz ? (az > (z0 + z1) / 2 ? -0.0165 : 0.0165) : 0));
      scene.add(s);
    };
    if (grind.includes('x0')) e(x0, z0, x0, z1);
    if (grind.includes('x1')) e(x1, z0, x1, z1);
    if (grind.includes('z0')) e(x0, z0, x1, z0);
    if (grind.includes('z1')) e(x0, z1, x1, z1);
  }
  function bar(a, b, mat = mats.rail, r = 0.024) {
    const g = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 14), mat);
    tube.position.copy(a).add(b).multiplyScalar(0.5);
    tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(b, a).normalize());
    g.add(tube);
    const n = Math.max(2, Math.round(a.distanceTo(b) / 2) + 1);
    for (let i = 0; i < n; i++) {
      const p = new THREE.Vector3().lerpVectors(a, b, 0.05 + (0.9 * i) / (n - 1));
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, p.y, 8), mat);
      post.position.set(p.x, p.y / 2, p.z);
      g.add(post);
    }
    g.traverse((o) => (o.castShadow = true));
    scene.add(g);
    rail(a.clone().setY(a.y + r), b.clone().setY(b.y + r), 'metal', r);
  }

  // ---- shell ----
  add(new THREE.Mesh(new THREE.PlaneGeometry(BX * 2, BZ * 2).rotateX(-Math.PI / 2), mats.floor), 'smoothConcrete', true, false);
  for (const [x, z, w, d] of [[0, BZ + 0.25, BX * 2 + 1, 0.5], [0, -BZ - 0.25, BX * 2 + 1, 0.5], [BX + 0.25, 0, 0.5, BZ * 2], [-BX - 0.25, 0, 0.5, BZ * 2]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), mats.wall);
    m.position.set(x, WALL_H / 2, z);
    add(m, 'concrete', true, false);
  }
  {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(BX * 2 + 1, 0.3, BZ * 2 + 1), mats.roof);
    roof.position.set(0, WALL_H + 0.15, 0);
    scene.add(roof);
    for (let x = -BX + 4; x <= BX - 4; x += 7) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, BZ * 2), mats.truss);
      t.position.set(x, WALL_H - 0.4, 0);
      scene.add(t);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(2.4, BZ * 1.5).rotateX(Math.PI / 2), mats.skylight);
      s.position.set(x + 3.5, WALL_H - 0.01, 0);
      scene.add(s);
    }
    const mural = (seed, x, z, w, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.6), new THREE.MeshStandardMaterial({ map: muralTex(seed), roughness: 0.85 }));
      m.position.set(x, 4.6, z);
      m.rotation.y = ry;
      scene.add(m);
    };
    mural(11, 0, -BZ + 0.01, 20, 0);
    mural(23, 0, BZ - 0.01, 20, Math.PI);
    mural(37, -BX + 0.01, 0, 16, Math.PI / 2);
    mural(53, BX - 0.01, 0, 16, -Math.PI / 2);
  }

  // ---- the perimeter: one continuous rolling bank with a curb along the top ----
  {
    const b = bankProf(1.3, 28, 0, 1.2, 0.4);
    const curbU = b.top + 0.35;
    const P = [...b.pts, [curbU, 1.3], [curbU, 1.52], [curbU + 1.05, 1.52]];
    const L = curbU + 1.05; // bottom edge inset from the walls
    const rc = 4; // corner radius of the bottom edge
    const x0 = -BX + L, x1 = BX - L, z0 = -BZ + L, z1 = BZ - L;
    // closed path around the flat (bottom edge), outward normal toward the walls
    const path = [];
    const corners = [
      [x1 - rc, z1 - rc, 0], // NE: east side -> north side
      [x0 + rc, z1 - rc, Math.PI / 2],
      [x0 + rc, z0 + rc, Math.PI],
      [x1 - rc, z0 + rc, Math.PI * 1.5],
    ];
    for (const [cx, cz, a0] of corners) {
      for (let i = 0; i <= 12; i++) {
        const a = a0 + (i / 12) * (Math.PI / 2);
        path.push([cx + Math.cos(a) * rc, cz + Math.sin(a) * rc, Math.cos(a), Math.sin(a)]);
      }
    }
    const pos = [];
    const idx = [];
    for (const [px, pz, nx, nz] of path) for (const [u, y] of P) pos.push(px + nx * u, y, pz + nz * u);
    const M = P.length;
    for (let i = 0; i < path.length; i++) {
      const j = (i + 1) % path.length;
      for (let k = 0; k < M - 1; k++) {
        const a = i * M + k, c = j * M + k;
        idx.push(a, c, a + 1, c, c + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    add(new THREE.Mesh(g, mats.bank), 'concrete');
    // curb grind edge (straight runs + a few pieces round each corner)
    const ci = P.length - 2;
    const cp = path.map(([px, pz, nx, nz]) => new THREE.Vector3(px + nx * P[ci][0], 1.52, pz + nz * P[ci][0]));
    for (let i = 0; i < cp.length; i++) {
      const j = (i + 1) % cp.length;
      if (cp[i].distanceTo(cp[j]) > 0.05 && (i % 3 === 0 || cp[i].distanceTo(cp[j]) > 2)) {
        let k = j;
        if (cp[i].distanceTo(cp[j]) < 2) k = Math.min(cp.length - 1, i + 3) % cp.length;
        rail(cp[i], cp[k], 'concrete', 0.01);
      }
    }
    // deck fillers in the four corners (outside the rounded deck edge)
    const R2 = rc + L;
    for (const [cx, cz, a0] of corners) {
      const sx = Math.sign(Math.cos(a0 + Math.PI / 4)), sz = Math.sign(Math.sin(a0 + Math.PI / 4));
      const pts = [new THREE.Vector2(cx + sx * R2 * 1.5, -(cz + sz * R2 * 1.5))];
      for (let i = 0; i <= 12; i++) {
        const a = a0 + (i / 12) * (Math.PI / 2);
        pts.push(new THREE.Vector2(cx + Math.cos(a) * R2, -(cz + Math.sin(a) * R2)));
      }
      const s = new THREE.Shape(pts.map((p) => new THREE.Vector2(THREE.MathUtils.clamp(p.x, -BX, BX), THREE.MathUtils.clamp(p.y, -BZ, BZ))));
      const fg = new THREE.ExtrudeGeometry(s, { depth: 1.52, bevelEnabled: false });
      fg.rotateX(-Math.PI / 2);
      add(new THREE.Mesh(fg, mats.concrete), 'concrete');
    }
  }

  // ---- roll-in pad (south): stand on it, push, drop in ----
  block(-2.5, 2.5, -15.0, -13.2, 2.4, mats.lite, '', 'wood', 'wood');
  {
    const r = bankProf(2.4, 36, 0, 3.0, 1.4, 14);
    const m = new THREE.Mesh(profileSolid(r, 5), mats.lite);
    m.position.set(0, 0, -13.2 + r.top);
    m.rotation.y = Math.PI / 2; // rises toward -z, back to the pad
    add(m, 'wood');
  }

  // ---- the flat: ledges, rails, manual pads (mostly running north, the way you roll in) ----
  block(-1.7, -1.2, -4, 8, 0.42, mats.gray, 'x0 x1'); // long ledge, left of the roll-in line
  bar(new THREE.Vector3(2.2, 0.33, -3), new THREE.Vector3(2.2, 0.33, 6)); // flat bar, right of it
  block(-9, -6, -4, 4, 0.16, mats.concrete, 'x0 x1 z0 z1'); // long low manual pad
  block(6, 8.5, -4, 0, 0.22, mats.concrete, 'x0 x1 z0 z1'); // manual pad pair (manny to manny)
  block(6, 8.5, 2, 6, 0.22, mats.concrete, 'x0 x1 z0 z1');
  block(-15, -14.5, -5, 5, 0.35, mats.red, 'x0'); // two-step ledge
  block(-14.5, -14, -5, 5, 0.55, mats.red, 'x1');
  bar(new THREE.Vector3(13, 0.4, -6), new THREE.Vector3(13, 0.4, 8), mats.yellow); // long round rail
  block(-20, -10, 9.8, 10.2, 0.22, mats.concrete, 'z0 z1'); // low curb
  block(16, 18.2, 10, 10.5, 0.48, mats.blue, 'z0 z1', 'wood', 'wood'); // bench (wallie it)
  block(17, 21, -7, -3, 0.18, mats.concrete, 'x0 x1 z0 z1'); // wide manual pad by the bank
  block(-6, 0, 11, 11.5, 0.3, mats.blue, 'z0 z1'); // low ledge
  block(-22, -19, -8, -6, 0.5, mats.gray, 'x0 x1 z0 z1'); // box

  // ---- props: knockable cones ----
  const props = [];
  const coneMat = new THREE.MeshStandardMaterial({ color: '#ff6a1a', roughness: 0.6 });
  for (let i = 0; i < 5; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 14).translate(0, 0.25, 0), coneMat);
    cone.position.set(-4 - i * 1.4, 0, -9 + (i % 2) * 0.6);
    cone.castShadow = true;
    scene.add(cone);
    props.push({ object3d: cone, radius: 0.2, velocity: new THREE.Vector3(), angularVelocity: new THREE.Vector3(), baseY: 0 });
  }

  const spot = (name, x, y, z, yaw) => ({ name, position: new THREE.Vector3(x, y, z), yaw });
  const world = {
    colliders,
    rails,
    spawn: { position: new THREE.Vector3(0, 2.4, -14.4), yaw: 0 },
    spots: [
      spot('Roll-In', 0, 2.4, -14.4, 0),
      spot('Ledge Line', 0, 0, -7, 0),
      spot('Manual Pads', -7.5, 0, -8, 0),
      spot('Rail', 13, 0, -10, 0),
      spot('Two-Step Ledge', -13, 0, -9, 0),
      spot('Bank', 0, 0, 12, Math.PI / 2),
    ],
    sun,
    catalog: [],
    placed: [],
    props,
    onChange: null,
    update(dt, focus) {
      sun.position.copy(focus).addScaledVector(sunDir, 40);
      sun.target.position.copy(focus);
      for (const p of props) {
        const o = p.object3d;
        if (p.velocity.lengthSq() < 1e-4 && o.position.y <= p.baseY + 1e-3) continue;
        p.velocity.y -= 9.81 * dt;
        o.position.addScaledVector(p.velocity, dt);
        o.rotation.x += p.angularVelocity.x * dt;
        o.rotation.z += p.angularVelocity.z * dt;
        if (o.position.y < p.baseY) {
          o.position.y = p.baseY;
          p.velocity.y *= -0.3;
          p.velocity.x *= 0.7;
          p.velocity.z *= 0.7;
          p.angularVelocity.multiplyScalar(0.7);
          if (p.velocity.lengthSq() < 0.05) p.velocity.set(0, 0, 0);
        }
      }
    },
    kickProp(p, impulse) {
      p.velocity.copy(impulse);
      p.angularVelocity.set((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12);
    },
    makeGhost: () => new THREE.Group(),
    placeObject: () => null,
    removeObject() {},
    serialize: () => [],
    deserialize() {},
  };
  return world;
}

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// "Primitive"-style private indoor park (after P-Rod's LA warehouse park, as recreated by the Skater XL map):
// corner-pocket quarter, double set with hubbas + rail, extended six stair with rail, out rail, mini ramp with a
// wallride wall, high bank with a wall extension, euro gap, pyramid hip, long ledge, step-up ledge, manual pad,
// flat bar and a bank with a handrail. Everything is original geometry/art (no logos).
// Building: x -21..21, z -10..10 (~840 m2), floor at y = 0. Transitions are smooth and meet the floor tangentially.

const BX = 21;
const BZ = 10;
const WALL_H = 7;

export function noiseTex(base, spread, size = 512, repeat = 1, lines = false, blotch = 0.08) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const n = (Math.random() - 0.5) * spread;
    img.data[i * 4] = base[0] + n;
    img.data[i * 4 + 1] = base[1] + n;
    img.data[i * 4 + 2] = base[2] + n;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.globalAlpha = blotch;
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? '#000' : '#fff';
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 10 + Math.random() * 60, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (lines) {
    ctx.strokeStyle = 'rgba(0,0,0,0.32)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// original abstract mural: overlapping color fields, rings and brush strokes
export function muralTex(seed, w = 1024, h = 384) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pals = [
    ['#f2efe6', '#e4572e', '#29335c', '#f3a712', '#669bbc'],
    ['#efe9dd', '#2a9d8f', '#e76f51', '#264653', '#e9c46a'],
    ['#ecebe4', '#111111', '#d62828', '#f77f00', '#fcbf49'],
  ];
  const pal = pals[seed % pals.length];
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = pal[0];
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i++) {
    g.fillStyle = pal[1 + Math.floor(rnd() * 4)];
    g.globalAlpha = 0.85;
    g.beginPath();
    const x = rnd() * w, y = rnd() * h, r = 40 + rnd() * 160;
    if (rnd() < 0.5) g.arc(x, y, r, 0, 7);
    else g.rect(x - r, y - r * 0.4, r * 2, r * 0.8);
    g.fill();
  }
  g.globalAlpha = 1;
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    g.strokeStyle = pal[1 + Math.floor(rnd() * 4)];
    g.lineWidth = 8 + rnd() * 26;
    g.beginPath();
    g.moveTo(rnd() * w, rnd() * h);
    g.bezierCurveTo(rnd() * w, rnd() * h, rnd() * w, rnd() * h, rnd() * w, rnd() * h);
    g.stroke();
  }
  for (let i = 0; i < 5; i++) {
    g.strokeStyle = '#111';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(rnd() * w, rnd() * h, 20 + rnd() * 70, 0, 7);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---- profiles (u = horizontal distance from the bottom edge toward the top, y = height) ----
export function quarterProf(R, H, deck, segs = 26) {
  const pts = [[0, 0]];
  const aMax = Math.acos(Math.max(-1, 1 - Math.min(H, R) / R));
  for (let i = 1; i <= segs; i++) {
    const a = (i / segs) * aMax;
    pts.push([Math.sin(a) * R, R - Math.cos(a) * R]);
  }
  let top = pts[pts.length - 1][0];
  if (H > R) {
    pts.push([R, H]);
    top = R;
  }
  if (deck > 0) pts.push([top + deck, H]);
  return { pts, top, H, len: top + deck };
}

export function bankProf(H, angDeg, deck, r1 = 0.8, r2 = 0.35, segs = 10) {
  const ang = (angDeg * Math.PI) / 180;
  const pts = [[0, 0]];
  for (let i = 1; i <= segs; i++) {
    const a = (i / segs) * ang;
    pts.push([r1 * Math.sin(a), r1 * (1 - Math.cos(a))]);
  }
  const [x1, y1] = pts[pts.length - 1];
  const y2 = H - r2 * (1 - Math.cos(ang));
  const x2 = x1 + (y2 - y1) / Math.tan(ang);
  pts.push([x2, y2]);
  for (let i = 1; i <= segs; i++) {
    const b = ang * (1 - i / segs);
    pts.push([x2 + r2 * (Math.sin(ang) - Math.sin(b)), y2 + r2 * (Math.cos(b) - Math.cos(ang))]);
  }
  const top = pts[pts.length - 1][0];
  if (deck > 0) pts.push([top + deck, H]);
  return { pts, top, H, len: top + deck };
}

// closed solid from a profile, extruded across `width` (local: +x = up the ramp, z = across)
export function profileSolid(prof, width) {
  const s = new THREE.Shape();
  const p = prof.pts;
  s.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
  const last = p[p.length - 1];
  if (last[1] > 0) s.lineTo(last[0], 0);
  s.lineTo(p[0][0], 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -width / 2);
  return g;
}

const YAW = { '+x': 0, '-x': Math.PI, '+z': -Math.PI / 2, '-z': Math.PI / 2 };

export function createWorld(renderer, scene) {
  const colliders = [];
  const rails = [];
  const mats = {
    floor: new THREE.MeshStandardMaterial({ map: noiseTex([138, 136, 131], 12, 512, 10, true, 0.02), roughness: 0.55, metalness: 0.0 }),
    lite: new THREE.MeshStandardMaterial({ map: noiseTex([72, 66, 60], 10, 256, 3, false, 0.04), roughness: 0.5 }),
    concrete: new THREE.MeshStandardMaterial({ map: noiseTex([160, 156, 148], 14, 256, 3, false, 0.03), roughness: 0.75 }),
    ledgeRed: new THREE.MeshStandardMaterial({ map: noiseTex([150, 46, 40], 10, 256, 2, false, 0.02), roughness: 0.6 }),
    ledgeGray: new THREE.MeshStandardMaterial({ map: noiseTex([92, 96, 102], 10, 256, 2, false, 0.02), roughness: 0.6 }),
    ledgeBlue: new THREE.MeshStandardMaterial({ map: noiseTex([44, 70, 120], 10, 256, 2, false, 0.02), roughness: 0.6 }),
    wood: new THREE.MeshStandardMaterial({ map: noiseTex([128, 96, 64], 20, 256, 3), roughness: 0.7 }),
    metal: new THREE.MeshStandardMaterial({ color: '#a9aeb5', roughness: 0.28, metalness: 0.9 }),
    railPaint: new THREE.MeshStandardMaterial({ color: '#1d1f22', roughness: 0.45, metalness: 0.6 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#e0b21b', roughness: 0.5, metalness: 0.3 }),
    wall: new THREE.MeshStandardMaterial({ map: noiseTex([196, 194, 188], 8, 512, 6, true, 0.02), roughness: 0.9 }),
    roof: new THREE.MeshStandardMaterial({ color: '#2b2d31', roughness: 0.9 }),
    truss: new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.6, metalness: 0.5 }),
    skylight: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#eef4ff', emissiveIntensity: 2.2 }),
    lamp: new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff4e0', emissiveIntensity: 3 }),
    door: new THREE.MeshStandardMaterial({ map: noiseTex([120, 124, 128], 12, 256, 1, false, 0.03), roughness: 0.5, metalness: 0.6 }),
  };
  mats.door.map.repeat.set(1, 8);

  // ---- light: indoor, skylights + high bays ----
  scene.background = new THREE.Color('#15171a');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  renderer.toneMappingExposure = 0.82;
  scene.fog = null;
  scene.add(new THREE.HemisphereLight('#f3f6ff', '#5d5650', 0.8));
  const sunDir = new THREE.Vector3(0.28, 1, 0.18).normalize();
  const sun = new THREE.DirectionalLight('#fff3e2', 2.1);
  sun.position.copy(sunDir).multiplyScalar(40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -24;
  sc.right = sc.top = 24;
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

  // straight ramp/bank from a profile. (x, z) = center of the bottom edge, dir = which way it rises
  function ramp(prof, width, x, z, dir, mat = mats.lite, surface = 'wood', coping = true) {
    const m = new THREE.Mesh(profileSolid(prof, width), mat);
    m.position.set(x, 0, z);
    m.rotation.y = YAW[dir];
    add(m, surface);
    if (coping) {
      const cop = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, width, 12).rotateX(Math.PI / 2), mats.metal);
      cop.position.set(prof.top, prof.H, 0);
      cop.castShadow = true;
      m.add(cop);
      rail(new THREE.Vector3(prof.top, prof.H + 0.03, -width / 2).applyMatrix4(m.matrixWorld), new THREE.Vector3(prof.top, prof.H + 0.03, width / 2).applyMatrix4(m.matrixWorld), 'coping', 0.03);
    }
    return m;
  }

  // axis-aligned solid block (x0..x1, z0..z1, floor..h); grind = which top edges are grindable
  function block(x0, x1, z0, z1, h, mat, surface = 'concrete', grind = '', kind = 'concrete', y0 = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h - y0, z1 - z0), mat);
    m.position.set((x0 + x1) / 2, (y0 + h) / 2, (z0 + z1) / 2);
    add(m, surface);
    const e = (ax, az, bx, bz) => {
      rail(new THREE.Vector3(ax, h, az), new THREE.Vector3(bx, h, bz), kind, 0.01);
      // steel angle on the edge (visual)
      const len = Math.hypot(bx - ax, bz - az);
      const s = new THREE.Mesh(new THREE.BoxGeometry(ax === bx ? 0.035 : len, 0.035, ax === bx ? len : 0.035), mats.metal);
      s.position.set((ax + bx) / 2 + (ax === bx ? (ax > (x0 + x1) / 2 ? -0.0165 : 0.0165) : 0), h - 0.0165, (az + bz) / 2 + (az === bz ? (az > (z0 + z1) / 2 ? -0.0165 : 0.0165) : 0));
      scene.add(s);
    };
    if (grind.includes('x0')) e(x0, z0, x0, z1);
    if (grind.includes('x1')) e(x1, z0, x1, z1);
    if (grind.includes('z0')) e(x0, z0, x1, z0);
    if (grind.includes('z1')) e(x0, z1, x1, z1);
    return m;
  }

  // round handrail / flat bar with posts down to the floor; contact line on top of the bar
  function bar(a, b, r = 0.024, mat = mats.railPaint, postEvery = 2.0) {
    const g = new THREE.Group();
    const len = a.distanceTo(b);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), mat);
    tube.position.copy(a).add(b).multiplyScalar(0.5);
    tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(b, a).normalize());
    g.add(tube);
    const n = Math.max(2, Math.round(len / postEvery) + 1);
    for (let i = 0; i < n; i++) {
      const p = new THREE.Vector3().lerpVectors(a, b, 0.06 + (0.88 * i) / (n - 1));
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, p.y, 8), mat);
      post.position.set(p.x, p.y / 2, p.z);
      g.add(post);
    }
    g.traverse((o) => (o.castShadow = true));
    scene.add(g);
    rail(a.clone().setY(a.y + r), b.clone().setY(b.y + r), 'metal', r);
  }

  // sloped ledge (hubba) running along z: polygon in (z, y), thickness across x from xa to xb
  function hubba(points, xa, xb, mat) {
    const s = new THREE.Shape();
    s.moveTo(points[0][0], 0);
    for (const [zz, yy] of points) s.lineTo(zz, yy);
    s.lineTo(points[points.length - 1][0], 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: xb - xa, bevelEnabled: false, curveSegments: 1 });
    const m = new THREE.Mesh(g, mat);
    m.rotation.y = -Math.PI / 2; // shape x -> world z, extrusion -> world -x
    m.position.set(xb, 0, 0);
    add(m, 'concrete');
    for (const x of [xa, xb])
      for (let i = 0; i < points.length - 1; i++) rail(new THREE.Vector3(x, points[i][1], points[i][0]), new THREE.Vector3(x, points[i + 1][1], points[i + 1][0]), 'concrete', 0.01);
  }

  // ---- shell: floor, walls, roof ----
  add(new THREE.Mesh(new THREE.PlaneGeometry(BX * 2, BZ * 2).rotateX(-Math.PI / 2), mats.floor), 'smoothConcrete', true, false);
  for (const [x, z, w, d] of [[0, BZ + 0.25, BX * 2 + 1, 0.5], [0, -BZ - 0.25, BX * 2 + 1, 0.5], [BX + 0.25, 0, 0.5, BZ * 2], [-BX - 0.25, 0, 0.5, BZ * 2]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), mats.wall);
    m.position.set(x, WALL_H / 2, z);
    add(m, 'concrete', true, false);
  }
  {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(BX * 2 + 1, 0.3, BZ * 2 + 1), mats.roof);
    roof.position.set(0, WALL_H + 0.15, 0);
    roof.receiveShadow = true;
    scene.add(roof);
    // trusses, skylight strips and high-bay lamps
    for (let x = -BX + 3; x <= BX - 3; x += 6) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, BZ * 2), mats.truss);
      t.position.set(x, WALL_H - 0.35, 0);
      scene.add(t);
      for (const z of [-5, 5]) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.18, 16), mats.lamp);
        l.position.set(x, WALL_H - 1.1, z);
        scene.add(l);
      }
    }
    for (let x = -BX + 6; x <= BX - 6; x += 6) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(2.2, BZ * 1.4).rotateX(Math.PI / 2), mats.skylight);
      s.position.set(x, WALL_H - 0.01, 0);
      scene.add(s);
    }
  }
  // murals (original abstract pieces) and a roll-up door
  const mural = (seed, x, y, z, w, h, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: muralTex(seed), roughness: 0.85 }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    scene.add(m);
  };
  mural(7, -BX + 0.01, 4.2, -2, 14, 4.2, Math.PI / 2);
  mural(19, 0, 4.4, -BZ + 0.01, 18, 4.0, 0);
  mural(31, BX - 0.01, 4.2, 2, 12, 4.2, -Math.PI / 2);
  mural(43, -6, 4.6, BZ - 0.01, 14, 3.6, Math.PI);
  {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.8), mats.door);
    d.position.set(BX - 0.02, 2.4, 7.2);
    d.rotation.y = -Math.PI / 2;
    scene.add(d);
  }

  // ---- NW: corner-pocket quarter (west straight + swept corner + north straight) ----
  {
    const qp = quarterProf(2.4, 1.9, 1.2);
    const off = qp.len; // bottom edge distance from the walls
    const xw = -BX + off; // west bottom edge line
    const zn = BZ - off; // north bottom edge line
    const rc = 2.5;
    const C = new THREE.Vector2(xw + rc, zn - rc);
    ramp(qp, C.y - 0.6, xw, (C.y + 0.6) / 2, '-x'); // west straight: z 0.6 .. C.y
    ramp(qp, -7.6 - C.x, (C.x - 7.6) / 2, zn, '+z'); // north straight: x C.x .. -7.6
    // swept corner surface between them
    const N = 18;
    const P = qp.pts;
    const pos = [];
    const idx = [];
    for (let i = 0; i <= N; i++) {
      const a = Math.PI - (i / N) * (Math.PI / 2);
      const dx = Math.cos(a), dz = Math.sin(a);
      for (const [u, y] of P) pos.push(C.x + dx * (rc + u), y, C.y + dz * (rc + u));
    }
    const M = P.length;
    for (let i = 0; i < N; i++)
      for (let j = 0; j < M - 1; j++) {
        const a = i * M + j, b = (i + 1) * M + j;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mat = mats.lite.clone();
    mat.side = THREE.DoubleSide;
    add(new THREE.Mesh(g, mat), 'wood');
    // corner coping (a few straight pieces) and the deck filler behind the curve
    const ci = qp.pts.findIndex((p) => p[0] === qp.top);
    const cr = rc + qp.pts[ci][0];
    const copePts = [];
    for (let i = 0; i <= 4; i++) {
      const a = Math.PI - (i / 4) * (Math.PI / 2);
      copePts.push(new THREE.Vector3(C.x + Math.cos(a) * cr, qp.H + 0.03, C.y + Math.sin(a) * cr));
    }
    const curve = new THREE.CatmullRomCurve3(copePts.map((p) => p.clone().setY(qp.H)));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.03, 10), mats.metal);
    tube.castShadow = true;
    scene.add(tube);
    for (let i = 0; i < 4; i++) rail(copePts[i], copePts[i + 1], 'coping', 0.03);
    const s = new THREE.Shape();
    const R2 = rc + qp.len;
    s.moveTo(-BX, -(C.y));
    s.lineTo(-BX, -BZ);
    s.lineTo(C.x, -BZ);
    s.absarc(C.x, -C.y, R2, Math.PI * 1.5, Math.PI, true);
    const fg = new THREE.ExtrudeGeometry(s, { depth: qp.H, bevelEnabled: false, curveSegments: 24 });
    fg.rotateX(-Math.PI / 2);
    add(new THREE.Mesh(fg, mats.lite), 'wood');
  }

  // ---- north middle: bank with a handrail down it ----
  {
    const b = bankProf(1.0, 25, 1.0);
    ramp(b, 9.6, -2.8, BZ - b.len, '+z', mats.concrete, 'concrete', false);
    bar(new THREE.Vector3(-3, 1.8, BZ - b.len + b.top + 0.15), new THREE.Vector3(-3, 0.8, BZ - b.len - 0.45));
  }

  // ---- NE: high bank with a wall extension ----
  let highBankZ;
  {
    const b = bankProf(1.8, 32, 1.0, 0.9, 0.4);
    highBankZ = BZ - b.len;
    ramp(b, BX - 2, (2 + BX) / 2, highBankZ, '+z', mats.concrete, 'concrete', false);
    block(9, 13, highBankZ + b.top, highBankZ + b.top + 0.4, 3.0, mats.ledgeGray, 'concrete', '', 'concrete', 1.8);
  }

  // ---- SW: double set (8 risers in two flights) with hubbas both sides and a kinked handrail ----
  {
    const r = 0.0, tr = 0.38;
    block(-BX, -9, -BZ, -7, 1.36, mats.concrete); // top platform
    const steps = [[-7, 1.19], [-6.62, 1.02], [-6.24, 0.85]];
    for (const [z0, h] of steps) block(-19, -10, z0, z0 + tr, h, mats.concrete);
    block(-19.6, -9.4, -5.86, -3.86, 0.68, mats.concrete); // mid landing
    for (const [z0, h] of [[-3.86, 0.51], [-3.48, 0.34], [-3.1, 0.17]]) block(-19, -10, z0, z0 + tr, h, mats.concrete);
    const hub = [[-8, 1.78], [-7, 1.78], [-5.48, 1.1], [-3.86, 1.1], [-2.34, 0.42], [-1.6, 0.42]];
    hubba(hub, -19.6, -19.0, mats.ledgeRed);
    hubba(hub, -10.0, -9.4, mats.ledgeRed);
    const hr = 0.86;
    bar(new THREE.Vector3(-14.5, 1.36 + hr, -7.0), new THREE.Vector3(-14.5, 0.68 + hr, -5.48));
    bar(new THREE.Vector3(-14.5, 0.68 + hr, -5.48), new THREE.Vector3(-14.5, 0.68 + hr, -3.86));
    bar(new THREE.Vector3(-14.5, 0.68 + hr, -3.86), new THREE.Vector3(-14.5, hr, -2.34 + r));
  }

  // ---- S middle: extended six stair with a rail, plus the out rail off the platform ----
  {
    block(-6, 3, -BZ, -6.2, 1.02, mats.concrete);
    const treads = [[-6.2, 0.85], [-5.82, 0.68], [-5.44, 0.51], [-5.06, 0.34], [-4.68, 0.17]];
    for (const [z0, h] of treads) block(-4.5, 1.5, z0, z0 + 0.38, h, mats.concrete);
    bar(new THREE.Vector3(-1.5, 1.02 + 0.86, -6.2), new THREE.Vector3(-1.5, 0.86, -3.92));
    bar(new THREE.Vector3(1.6, 1.38, -8.4), new THREE.Vector3(7.2, 1.38, -8.4), 0.024, mats.yellow);
  }

  // ---- SE: mini ramp with a wallride wall on one deck ----
  {
    const q = quarterProf(1.9, 1.25, 1.3);
    const w = 6, zc = -BZ + 0.4 + w / 2;
    const flat = 3.0;
    const xE = BX - 0.4 - q.len; // east quarter bottom edge
    const xW = xE - flat; // west quarter bottom edge
    ramp(q, w, xE, zc, '+x');
    ramp(q, w, xW, zc, '-x');
    block(xE + q.top + 0.25, xE + q.top + 0.55, zc - w / 2, zc - w / 2 + 2.4, 3.3, mats.ledgeBlue, 'wood', '', 'wood', q.H);
  }

  // ---- center: long ledge, step-up ledge, manual pad, flat bar, benches ----
  block(-7, 5, 0.95, 1.45, 0.42, mats.ledgeGray, 'concrete', 'z0 z1');
  block(-1, 2, -1.75, -1.25, 0.3, mats.ledgeBlue, 'concrete', 'z0 z1');
  block(2, 5, -1.75, -1.25, 0.5, mats.ledgeBlue, 'concrete', 'z0 z1');
  block(-6.5, -2.5, -3.4, -1.7, 0.18, mats.concrete, 'concrete', 'z0 z1 x0 x1');
  bar(new THREE.Vector3(-5, 0.33, 3.9), new THREE.Vector3(2, 0.33, 3.9));
  for (const [x, z] of [[17.5, 4.2], [-9.5, 4.9]]) {
    block(x - 1.1, x + 1.1, z - 0.22, z + 0.22, 0.46, mats.wood, 'wood', 'z0 z1', 'wood');
  }

  // ---- east middle: euro gap (bank up, gap, landing deck + bank down) ----
  {
    // runs along +x out of the ledge alley, lands toward the hip
    const up = bankProf(0.85, 30, 0.7);
    ramp(up, 4, 6.5, -0.6, '+x', mats.lite, 'wood', false);
    const x1 = 6.5 + up.len + 1.5;
    const down = bankProf(0.85, 28, 0.9);
    ramp(down, 4, x1 + down.len, -0.6, '-x', mats.lite, 'wood', false);
  }

  // ---- east: pyramid hip ----
  {
    const g = new THREE.CylinderGeometry(1.0, 2.6, 0.75, 4, 1);
    const m = new THREE.Mesh(g, mats.concrete);
    m.position.set(16.6, 0.375, 1.0);
    m.rotation.y = Math.PI / 4;
    add(m, 'concrete');
  }

  // ---- props: knockable cones ----
  const props = [];
  const coneMat = new THREE.MeshStandardMaterial({ color: '#ff6a1a', roughness: 0.6 });
  for (let i = 0; i < 5; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 14).translate(0, 0.25, 0), coneMat);
    cone.position.set(-1 + i * 1.3, 0, 6.0 - (i % 2) * 0.6);
    cone.castShadow = true;
    scene.add(cone);
    props.push({ object3d: cone, radius: 0.2, velocity: new THREE.Vector3(), angularVelocity: new THREE.Vector3(), baseY: 0 });
  }

  // ---- object dropper ----
  const catalog = [
    { id: 'kicker', name: 'Kicker', category: 'ramps' },
    { id: 'quarter', name: 'Quarter Pipe', category: 'ramps' },
    { id: 'ledge', name: 'Ledge', category: 'street' },
    { id: 'flatbar', name: 'Flat Bar', category: 'street' },
    { id: 'manualpad', name: 'Manual Pad', category: 'street' },
  ];
  function build(id) {
    const group = new THREE.Group();
    const cols = [];
    const localRails = [];
    if (id === 'kicker' || id === 'quarter') {
      const prof = id === 'kicker' ? bankProf(0.55, 24, 0.3, 1.2, 0.25) : quarterProf(2.2, 1.5, 1.2);
      const m = new THREE.Mesh(profileSolid(prof, id === 'kicker' ? 2.4 : 4), mats.lite);
      m.rotation.y = -Math.PI / 2;
      m.userData.surface = 'wood';
      group.add(m);
      cols.push(m);
      if (id === 'quarter') localRails.push({ a: new THREE.Vector3(-2, 1.53, prof.top), b: new THREE.Vector3(2, 1.53, prof.top), kind: 'coping' });
    } else if (id === 'ledge' || id === 'manualpad') {
      const [w, h, d] = id === 'ledge' ? [0.5, 0.45, 4] : [2.4, 0.18, 5];
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), id === 'ledge' ? mats.ledgeRed : mats.concrete);
      m.userData.surface = 'concrete';
      group.add(m);
      cols.push(m);
      for (const sx of [-1, 1]) localRails.push({ a: new THREE.Vector3((sx * w) / 2, h, -d / 2), b: new THREE.Vector3((sx * w) / 2, h, d / 2), kind: 'concrete' });
    } else if (id === 'flatbar') {
      const a = new THREE.Vector3(0, 0.36, -2.5);
      const b = new THREE.Vector3(0, 0.36, 2.5);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 5, 12).rotateX(Math.PI / 2), mats.railPaint);
      tube.position.set(0, 0.36, 0);
      group.add(tube);
      for (const z of [-2.2, 2.2]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.36, 8), mats.railPaint);
        post.position.set(0, 0.18, z);
        group.add(post);
      }
      localRails.push({ a: a.clone().setY(0.384), b: b.clone().setY(0.384), kind: 'metal' });
    }
    group.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    return { group, cols, localRails };
  }

  const placed = [];
  const spot = (name, x, y, z, yaw) => ({ name, position: new THREE.Vector3(x, y, z), yaw });
  const world = {
    colliders,
    rails,
    spawn: { position: new THREE.Vector3(-8.5, 0, -0.4), yaw: Math.PI / 2 },
    spots: [
      spot('Floor', -8.5, 0, -0.4, Math.PI / 2),
      spot('Double Set', -16.5, 1.36, -8.6, 0),
      spot('Six Stair', 0, 1.02, -9.2, 0),
      spot('Out Rail', 0.2, 1.02, -8.4, Math.PI / 2),
      spot('Mini Ramp', BX - 0.4 - quarterProf(1.9, 1.25, 1.3).len - 1.5, 0, -BZ + 3.4, Math.PI / 2),
      spot('Corner Pocket', -9, 0, 0.5, -Math.PI / 4),
      spot('High Bank', 5, 0, 3.0, 0),
      spot('Euro Gap', 0.5, 0, -0.4, Math.PI / 2),
      spot('Ledges', -8, 0, 0.2, Math.PI / 2),
    ],
    sun,
    catalog,
    placed,
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
    makeGhost(id) {
      const { group } = build(id);
      group.traverse((o) => {
        if (o.isMesh) {
          o.material = new THREE.MeshBasicMaterial({ color: '#ff5a1f', transparent: true, opacity: 0.45, depthWrite: false });
          o.castShadow = false;
        }
      });
      return group;
    },
    placeObject(id, position, yaw) {
      const { group, cols, localRails } = build(id);
      group.position.copy(position);
      group.rotation.y = yaw;
      scene.add(group);
      group.updateMatrixWorld(true);
      const h = {
        id,
        group,
        colliders: cols,
        rails: localRails.map((r) => ({ a: r.a.clone().applyMatrix4(group.matrixWorld), b: r.b.clone().applyMatrix4(group.matrixWorld), kind: r.kind, radius: 0.02 })),
      };
      placed.push(h);
      world.onChange?.();
      return h;
    },
    removeObject(h) {
      const i = placed.indexOf(h);
      if (i >= 0) placed.splice(i, 1);
      scene.remove(h.group);
      world.onChange?.();
    },
    serialize() {
      return placed.map((h) => ({ id: h.id, x: h.group.position.x, y: h.group.position.y, z: h.group.position.z, yaw: h.group.rotation.y }));
    },
    deserialize(list) {
      const cb = world.onChange;
      world.onChange = null;
      for (const o of list) if (catalog.find((c) => c.id === o.id)) world.placeObject(o.id, new THREE.Vector3(o.x, o.y, o.z), o.yaw);
      world.onChange = cb;
      cb?.();
    },
  };
  void highBankZ;
  return world;
}

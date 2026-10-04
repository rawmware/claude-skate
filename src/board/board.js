import * as THREE from 'three';
import { BOARD } from '../core/constants.js';
import { TRUCK_FINISHES, DEFAULT_BOARD } from '../core/customization.js';
import { loadBoardModel } from './model.js';

// Procedural skateboard: concave deck with kicked nose/tail, 7-ply edge, grip tape, trucks, wheels.
// Board-local frame per constants.js: origin at the wheel contact center, +Z nose, +Y up.

const GRIP_INSET = 0.0016; // grip tape is trimmed a hair inside the deck outline
const L = BOARD.length;
const W = BOARD.width;
const T = BOARD.deckThickness;

function deckProfileY(z) {
  const a = Math.abs(z);
  if (a <= BOARD.kickStartZ) return 0;
  // smooth ramp into the kick (quadratic blend over 6cm, then straight at kickAngle)
  const d = a - BOARD.kickStartZ;
  const blend = 0.06;
  const k = Math.tan(BOARD.kickAngle);
  if (d < blend) return (k * d * d) / (2 * blend);
  return (k * blend) / 2 + k * (d - blend);
}

function deckHalfWidth(z) {
  const a = Math.abs(z);
  const r = W / 2; // nose/tail are semicircles-ish
  const start = L / 2 - r * 1.05;
  if (a <= start) return W / 2;
  const t = Math.min(1, (a - start) / (L / 2 - start));
  return (W / 2) * Math.sqrt(Math.max(0, 1 - t * t * 0.985));
}

function concave(x, z) {
  const hw = deckHalfWidth(z);
  const u = hw > 0 ? x / (W / 2) : 0;
  const along = 1 - Math.min(1, Math.max(0, (Math.abs(z) - BOARD.kickStartZ) / 0.1)) * 0.55;
  const au = Math.abs(u);
  return 0.0098 * (0.55 * au * au + 0.45 * Math.pow(au, 3.2)) * along;
}

function buildDeckGeometry() {
  const NZ = 64;
  const NX = 14;
  const base = BOARD.deckBottomY;
  const top = [];
  const topGrip = [];
  const bottom = [];
  const uvT = [];
  const uvB = [];
  for (let i = 0; i <= NZ; i++) {
    const z = -L / 2 + (L * i) / NZ;
    const hw = Math.max(0.004, deckHalfWidth(z));
    const yz = deckProfileY(z);
    const gripInset = Math.min(GRIP_INSET, hw * 0.5);
    for (let j = 0; j <= NX; j++) {
      const x = -hw + (2 * hw * j) / NX;
      const c = concave(x, z);
      // rounded top edge: the veneer rolls over the rail slightly
      const edge = Math.abs(x) / hw;
      const roll = edge > 0.94 ? ((edge - 0.94) / 0.06) ** 2 * 0.0016 : 0;
      top.push(x, base + T + yz + c - roll, z);
      bottom.push(x, base + yz + c, z);
      topGrip.push(Math.sign(x) * Math.max(0, Math.abs(x) - gripInset), base + T + yz + c + 0.0009 - Math.max(0, edge - 0.9) * 0.002, Math.sign(z) * Math.max(0, Math.abs(z) - (i === 0 || i === NZ ? GRIP_INSET : 0)));
      uvT.push(0.5 + x / W, i / NZ);
      uvB.push(0.5 - x / W, i / NZ);
    }
  }
  const idx = (i, j) => i * (NX + 1) + j;

  // top (grip)
  const gTop = new THREE.BufferGeometry();
  gTop.setAttribute('position', new THREE.Float32BufferAttribute(topGrip, 3));
  gTop.setAttribute('uv', new THREE.Float32BufferAttribute(uvT, 2));
  const iTop = [];
  for (let i = 0; i < NZ; i++)
    for (let j = 0; j < NX; j++) {
      const a = idx(i, j), b = idx(i + 1, j), c = idx(i + 1, j + 1), d = idx(i, j + 1);
      iTop.push(a, b, d, b, c, d);
    }
  gTop.setIndex(iTop);
  gTop.computeVertexNormals();
  const gWood = new THREE.BufferGeometry();
  gWood.setAttribute('position', new THREE.Float32BufferAttribute(top, 3));
  gWood.setAttribute('uv', new THREE.Float32BufferAttribute(uvT, 2));
  gWood.setIndex(iTop);
  gWood.computeVertexNormals();

  // bottom (graphic)
  const gBot = new THREE.BufferGeometry();
  gBot.setAttribute('position', new THREE.Float32BufferAttribute(bottom, 3));
  gBot.setAttribute('uv', new THREE.Float32BufferAttribute(uvB, 2));
  const iBot = [];
  for (let i = 0; i < NZ; i++)
    for (let j = 0; j < NX; j++) {
      const a = idx(i, j), b = idx(i + 1, j), c = idx(i + 1, j + 1), d = idx(i, j + 1);
      iBot.push(a, d, b, b, d, c);
    }
  gBot.setIndex(iBot);
  gBot.computeVertexNormals();

  // edge: walk the outline (right side nose->tail, then left side) and extrude top->bottom
  const ring = [];
  for (let i = 0; i <= NZ; i++) ring.push(idx(i, NX));
  for (let j = NX - 1; j >= 0; j--) ring.push(idx(NZ, j));
  for (let i = NZ - 1; i >= 0; i--) ring.push(idx(i, 0));
  for (let j = 1; j <= NX; j++) ring.push(idx(0, j));
  const ep = [];
  const euv = [];
  let acc = 0;
  for (let k = 0; k < ring.length; k++) {
    const r = ring[k];
    const tx = top[r * 3], ty = top[r * 3 + 1], tz = top[r * 3 + 2];
    const bx = bottom[r * 3], by = bottom[r * 3 + 1], bz = bottom[r * 3 + 2];
    if (k > 0) {
      const p = ring[k - 1];
      acc += Math.hypot(tx - top[p * 3], tz - top[p * 3 + 2]);
    }
    ep.push(tx, ty, tz, bx, by, bz);
    euv.push(acc * 4, 1, acc * 4, 0);
  }
  const gEdge = new THREE.BufferGeometry();
  gEdge.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3));
  gEdge.setAttribute('uv', new THREE.Float32BufferAttribute(euv, 2));
  const ie = [];
  for (let k = 0; k < ring.length - 1; k++) {
    const a = k * 2, b = k * 2 + 1, c = k * 2 + 2, d = k * 2 + 3;
    ie.push(a, b, c, b, d, c);
  }
  gEdge.setIndex(ie);
  gEdge.computeVertexNormals();
  return { gTop, gBot, gEdge, gWood };
}

// Original abstract emblem (no text, no brand): a ring crossed by three bars around a diamond core.
// Drawn centered on the origin; size ~ its height in px.
function drawEmblem(ctx, size, fill, stroke) {
  const r = size * 0.5;
  const shape = () => {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2, true);
    for (const y of [-0.42, 0, 0.42]) ctx.rect(-r * 1.55, y * r - r * 0.09, r * 3.1, r * 0.18);
    ctx.moveTo(0, -r * 0.42);
    ctx.lineTo(r * 0.36, 0);
    ctx.lineTo(0, r * 0.42);
    ctx.lineTo(-r * 0.36, 0);
    ctx.closePath();
  };
  ctx.save();
  ctx.lineJoin = 'round';
  if (stroke) {
    ctx.lineWidth = size * 0.07;
    ctx.strokeStyle = stroke;
    shape();
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  shape();
  ctx.fill();
  ctx.restore();
}

function noiseCanvas(w, h, base, spread, grain = 1) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const n = (Math.random() - 0.5) * spread * grain;
    img.data[i * 4] = base[0] + n;
    img.data[i * 4 + 1] = base[1] + n;
    img.data[i * 4 + 2] = base[2] + n;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { c, ctx };
}

let gripNormalTex = null;
function getGripNormal() {
  if (gripNormalTex) return gripNormalTex;
  const s = 512;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s);
  for (let i = 0; i < s * s; i++) {
    img.data[i * 4] = 128 + (Math.random() - 0.5) * 120;
    img.data[i * 4 + 1] = 128 + (Math.random() - 0.5) * 120;
    img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  gripNormalTex = new THREE.CanvasTexture(c);
  gripNormalTex.wrapS = gripNormalTex.wrapT = THREE.RepeatWrapping;
  gripNormalTex.repeat.set(3, 12);
  return gripNormalTex;
}

function makeGripTexture(cfg) {
  const w = 256, h = 1024;
  const base = cfg.grip === 'clear' ? [0, 0, 0] : [22, 22, 24];
  const { c, ctx } = noiseCanvas(w, h, base, 64);
  if (cfg.grip !== 'clear') {
    const gi = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < w * h; i++) {
      if (Math.random() < 0.035) {
        const v = 70 + Math.random() * 70;
        gi.data[i * 4] = gi.data[i * 4 + 1] = gi.data[i * 4 + 2] = v;
      }
    }
    ctx.putImageData(gi, 0, 0);
  }
  if (cfg.grip === 'clear') {
    // see-through grip: show the deck color with a dark speckle
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = cfg.deckColor;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.getImageData(0, 0, w, h);
    const col = new THREE.Color(cfg.deckColor);
    for (let i = 0; i < w * h; i++) {
      const n = Math.random();
      g.data[i * 4] = col.r * 200 * (0.75 + n * 0.25);
      g.data[i * 4 + 1] = col.g * 200 * (0.75 + n * 0.25);
      g.data[i * 4 + 2] = col.b * 200 * (0.75 + n * 0.25);
    }
    ctx.putImageData(g, 0, 0);
  }
  if (cfg.grip === 'split') {
    ctx.fillStyle = cfg.deckAccent;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(0, 0, w / 2, h);
    ctx.globalAlpha = 1;
    const g = ctx.getImageData(0, 0, w / 2, h);
    for (let i = 0; i < g.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 40;
      g.data[i] += n; g.data[i + 1] += n; g.data[i + 2] += n;
    }
    ctx.putImageData(g, 0, 0);
  }
  if (cfg.grip === 'cutout') {
    ctx.save();
    ctx.translate(w / 2, h * 0.5);
    ctx.rotate(-Math.PI / 2);
    drawEmblem(ctx, 120, cfg.deckColor, null);
    ctx.restore();
  }
  // wear near the bolts & tail
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = '#888';
  for (let k = 0; k < 40; k++) {
    ctx.beginPath();
    ctx.arc(w / 2 + (Math.random() - 0.5) * w * 0.6, h * (0.08 + Math.random() * 0.08), 4 + Math.random() * 18, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // bolts (8 hardware heads)
  for (const zf of [0.5 - BOARD.truckAxleZ / L, 0.5 + BOARD.truckAxleZ / L]) {
    for (const dz of [-0.032, 0.032]) {
      for (const dx of [-0.04, 0.04]) {
        const px = w / 2 + (dx / W) * w;
        const py = (zf + dz / L) * h;
        ctx.fillStyle = '#3a3a3c';
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#9a9a9a';
        ctx.beginPath();
        ctx.arc(px - 1, py - 1, 2.2, 0, 7);
        ctx.fill();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function makeGraphicTexture(cfg) {
  const w = 256, h = 1024;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const col = cfg.deckColor;
  const acc = cfg.deckAccent;
  ctx.fillStyle = col;
  ctx.fillRect(0, 0, w, h);
  const g = cfg.deckGraphic;
  if (g === 'wood' || g === 'plain') {
    ctx.fillStyle = g === 'wood' ? '#c89c62' : col;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(80,45,15,0.25)';
    for (let i = 0; i < 70; i++) {
      ctx.lineWidth = 0.5 + Math.random() * 2;
      ctx.beginPath();
      const x0 = Math.random() * w;
      ctx.moveTo(x0, 0);
      for (let y = 0; y <= h; y += 32) ctx.lineTo(x0 + Math.sin(y * 0.01 + i) * 6 + Math.random() * 2, y);
      ctx.stroke();
    }
  } else if (g === 'stripes') {
    ctx.fillStyle = acc;
    for (let i = 0; i < 3; i++) ctx.fillRect(w * 0.25 + i * 44, 0, 24, h);
  } else if (g === 'checker') {
    const s = 42;
    for (let y = 0; y < h / s; y++) for (let x = 0; x < w / s + 1; x++) if ((x + y) % 2) { ctx.fillStyle = acc; ctx.fillRect(x * s, y * s, s, s); }
  } else if (g === 'flames') {
    ctx.fillStyle = acc;
    for (let k = 0; k < 7; k++) {
      ctx.beginPath();
      const x0 = (k / 6) * w;
      ctx.moveTo(x0 - 30, h);
      ctx.bezierCurveTo(x0 - 50, h * 0.7, x0 + 40, h * 0.6, x0 + (Math.random() - 0.5) * 60, h * (0.25 + Math.random() * 0.25));
      ctx.bezierCurveTo(x0 + 10, h * 0.7, x0 + 50, h * 0.8, x0 + 30, h);
      ctx.fill();
    }
  } else if (g === 'gradient') {
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, col);
    gr.addColorStop(0.55, acc);
    gr.addColorStop(1, '#1b1035');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,240,200,0.9)';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.52, 70, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = col;
    for (let i = 0; i < 6; i++) ctx.fillRect(0, h * 0.52 - 10 - i * 14, w, 4 + i * 0.4);
  } else if (g === 'camo') {
    const cols = [acc, '#3d4a2c', '#6b6a43', '#2a2a22'];
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath();
      const x = Math.random() * w, y = Math.random() * h;
      ctx.ellipse(x, y, 10 + Math.random() * 40, 8 + Math.random() * 25, Math.random() * 3, 0, 7);
      ctx.fill();
    }
  } else if (g === 'eye') {
    ctx.fillStyle = acc;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.18);
    ctx.lineTo(w * 0.95, h * 0.62);
    ctx.lineTo(w * 0.05, h * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.5, 70, 38, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.5, 26, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(w / 2 - 8, h * 0.5 - 8, 7, 0, 7);
    ctx.fill();
  } else if (g === 'palms') {
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, acc);
    gr.addColorStop(1, col);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#141414';
    for (const [x, y, s] of [[70, 700, 1], [190, 820, 0.8], [140, 480, 0.6]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.fillRect(-5, 0, 10, 260);
      for (let i = 0; i < 7; i++) {
        ctx.save();
        ctx.rotate(-Math.PI / 2 + (i - 3) * 0.45);
        ctx.beginPath();
        ctx.ellipse(55, 0, 60, 10, 0.2, 0, 7);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
  }
  if (g === 'logo' || g === 'stripes' || g === 'checker' || g === 'plain') {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 2);
    drawEmblem(ctx, g === 'logo' ? 150 : 110, g === 'logo' ? acc : g === 'plain' ? 'rgba(255,255,255,0.15)' : '#fff', g === 'logo' ? '#111' : col);
    ctx.restore();
  }
  // scratches & wear on the bottom (boards get beat up)
  ctx.strokeStyle = 'rgba(230,200,150,0.35)';
  for (let i = 0; i < 90; i++) {
    const y = Math.random() < 0.5 ? Math.random() * h * 0.22 : h - Math.random() * h * 0.22;
    const x = Math.random() * w;
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 20);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

let plyTex = null;
function getPlyTexture() {
  if (plyTex) return plyTex;
  // 7-ply maple seen from the edge: pale plies with alternating grain direction, thin glue lines, a dyed veneer
  const w = 256, h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const plies = ['#c9a06a', '#e2c28f', '#d9b67f', '#e6c995', '#d9b67f', '#e2c28f', '#c9a06a'];
  const ph = h / plies.length;
  plies.forEach((p, i) => {
    ctx.fillStyle = p;
    ctx.fillRect(0, i * ph, w, ph + 1);
    // grain flecks
    for (let k = 0; k < 90; k++) {
      ctx.fillStyle = `rgba(110,70,30,${0.05 + Math.random() * 0.12})`;
      ctx.fillRect(Math.random() * w, i * ph + Math.random() * ph, 6 + Math.random() * 26, 0.6);
    }
    // glue line
    ctx.fillStyle = 'rgba(60,35,15,0.55)';
    ctx.fillRect(0, i * ph, w, 0.9);
  });
  plyTex = new THREE.CanvasTexture(c);
  plyTex.colorSpace = THREE.SRGBColorSpace;
  plyTex.wrapS = THREE.RepeatWrapping;
  plyTex.anisotropy = 8;
  return plyTex;
}

// mounting hardware under the deck: eight bolt nuts, plus the pivot-side nylon lock nuts
function buildHardware(darkMat, metalMat) {
  const out = [];
  const nutGeo = new THREE.CylinderGeometry(0.0055, 0.0055, 0.0045, 6);
  for (const side of [1, -1]) {
    for (const dz of [-0.0285, 0.0285]) {
      for (const dx of [-0.0205, 0.0205]) {
        const n = new THREE.Mesh(nutGeo, darkMat);
        n.position.set(dx, BOARD.deckBottomY - 0.0105, side * BOARD.truckAxleZ + dz);
        out.push(n);
      }
    }
  }
  return out;
}

function buildTruck(metalMat, darkMat, bushingMat) {
  const truck = new THREE.Group();
  const bY = BOARD.deckBottomY;
  // baseplate: tapered plate with a pivot-cup boss
  const bp = new THREE.Shape();
  bp.moveTo(-0.029, -0.036);
  bp.lineTo(0.029, -0.036);
  bp.lineTo(0.026, 0.036);
  bp.lineTo(-0.026, 0.036);
  bp.closePath();
  const bpg = new THREE.ExtrudeGeometry(bp, { depth: 0.007, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0016, bevelSegments: 2 });
  bpg.rotateX(Math.PI / 2);
  bpg.translate(0, bY, 0);
  truck.add(new THREE.Mesh(bpg, metalMat));
  // riser pad
  const riser = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.003, 0.074), darkMat);
  riser.position.y = bY - 0.0015;
  truck.add(riser);
  // pivot cup + kingpin boss
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.012, 14), metalMat);
  boss.position.set(0, bY - 0.012, -0.014);
  boss.rotation.x = -0.25;
  truck.add(boss);
  // kingpin, washers, bushings and the lock nut
  const kp = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.058, 10), darkMat);
  kp.position.set(0, bY - 0.028, 0.016);
  kp.rotation.x = 0.55;
  truck.add(kp);
  for (const [dy, r, col] of [[-0.016, 0.0125, bushingMat], [-0.031, 0.0115, bushingMat]]) {
    const bush = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, 0.0125, 16), col);
    bush.position.set(0, bY + dy, 0.016 + dy * -0.55);
    bush.rotation.x = 0.55;
    truck.add(bush);
  }
  const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.0022, 16), metalMat);
  washer.position.set(0, bY - 0.0385, 0.0275);
  washer.rotation.x = 0.55;
  truck.add(washer);
  const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.009, 6), darkMat);
  lock.position.set(0, bY - 0.0445, 0.0315);
  lock.rotation.x = 0.55;
  truck.add(lock);
  // hanger: pivot group (leans around the kingpin axis)
  const hanger = new THREE.Group();
  hanger.position.set(0, BOARD.wheelRadius, 0);
  const shape = new THREE.Shape();
  shape.moveTo(-0.058, -0.004);
  shape.lineTo(0.058, -0.004);
  shape.lineTo(0.052, 0.008);
  shape.lineTo(0.04, 0.026);
  shape.quadraticCurveTo(0.02, 0.043, 0, 0.044);
  shape.quadraticCurveTo(-0.02, 0.043, -0.04, 0.026);
  shape.lineTo(-0.052, 0.008);
  shape.closePath();
  const hg = new THREE.ExtrudeGeometry(shape, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.0035, bevelSize: 0.0035, bevelSegments: 3 });
  hg.translate(0, 0, -0.011);
  hanger.add(new THREE.Mesh(hg, metalMat));
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.255, 10), darkMat);
  axle.rotation.z = Math.PI / 2;
  hanger.add(axle);
  // axle nuts
  for (const sx of [1, -1]) {
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.0072, 0.0072, 0.007, 6), darkMat);
    nut.rotation.z = Math.PI / 2;
    nut.position.x = sx * (BOARD.axleHalfTrack + BOARD.wheelWidth / 2 + 0.0045);
    hanger.add(nut);
  }
  truck.add(hanger);
  truck.userData.hanger = hanger;
  return truck;
}

function buildWheel(wheelMat, coreMat, radius) {
  const r = radius;
  const hw = BOARD.wheelWidth / 2;
  const pts = [];
  pts.push(new THREE.Vector2(0.0125, -hw));
  pts.push(new THREE.Vector2(0.0125, -hw * 0.93));
  pts.push(new THREE.Vector2(r * 0.42, -hw * 0.93)); // recessed hub face
  pts.push(new THREE.Vector2(r * 0.46, -hw));
  pts.push(new THREE.Vector2(r - 0.01, -hw));
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI;
    pts.push(new THREE.Vector2(r - 0.007 + Math.cos(a) * 0.007, Math.sin(a) * hw * 0.98));
  }
  pts.push(new THREE.Vector2(r - 0.01, hw));
  pts.push(new THREE.Vector2(r * 0.46, hw));
  pts.push(new THREE.Vector2(r * 0.42, hw * 0.93));
  pts.push(new THREE.Vector2(0.0125, hw * 0.93));
  pts.push(new THREE.Vector2(0.0125, hw));
  const g = new THREE.LatheGeometry(pts, 36);
  g.rotateZ(Math.PI / 2); // axis -> X
  const wheel = new THREE.Group();
  wheel.add(new THREE.Mesh(g, wheelMat));
  // bearing (steel ring + shield)
  const brg = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.0115, BOARD.wheelWidth * 0.99, 18), coreMat);
  brg.rotation.z = Math.PI / 2;
  wheel.add(brg);
  // printed ring on both faces so the spin reads
  for (const sx of [1, -1]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.5, r * 0.58, 36), coreMat);
    ring.rotation.y = sx * Math.PI / 2;
    ring.position.x = sx * (hw * 0.935);
    wheel.add(ring);
  }
  const band = new THREE.Mesh(new THREE.BoxGeometry(BOARD.wheelWidth * 1.01, 0.004, 0.012), coreMat);
  band.position.y = r * 0.74;
  wheel.add(band);
  return wheel;
}

export function createBoard(initial = DEFAULT_BOARD) {
  const object3d = new THREE.Group();
  object3d.name = 'skateboard';
  const { gTop, gBot, gEdge, gWood } = buildDeckGeometry();

  const gripMat = new THREE.MeshStandardMaterial({ roughness: 0.97, metalness: 0, normalMap: getGripNormal(), normalScale: new THREE.Vector2(1.1, 1.1) });
  const graphicMat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.0 });
  const edgeMat = new THREE.MeshStandardMaterial({ map: getPlyTexture(), roughness: 0.7, side: THREE.DoubleSide });
  const metalMat = new THREE.MeshStandardMaterial({ color: '#b8bcc2', roughness: 0.35, metalness: 0.9 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.4, metalness: 0.8 });
  const bushingMat = new THREE.MeshStandardMaterial({ color: '#e0c33a', roughness: 0.7 });
  const wheelMat = new THREE.MeshPhysicalMaterial({ color: '#f4f1e6', roughness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.6 });
  const coreMat = new THREE.MeshStandardMaterial({ color: '#2e2e30', roughness: 0.5, metalness: 0.3 });
  const bearingMat = new THREE.MeshStandardMaterial({ color: '#a7adb5', roughness: 0.3, metalness: 0.95 });

  const deck = new THREE.Group();
  deck.add(new THREE.Mesh(gTop, gripMat), new THREE.Mesh(gWood, edgeMat), new THREE.Mesh(gBot, graphicMat), new THREE.Mesh(gEdge, edgeMat));
  deck.add(...buildHardware(darkMat, metalMat));
  object3d.add(deck);

  const trucks = [];
  const wheels = [];
  let wheelRadius = BOARD.wheelRadius;
  const truckRoot = new THREE.Group();
  object3d.add(truckRoot);

  function rebuildRunningGear(cfg) {
    while (truckRoot.children.length) truckRoot.remove(truckRoot.children[0]);
    trucks.length = 0;
    wheels.length = 0;
    wheelRadius = ((cfg.wheelSize || 54) / 1000) / 2;
    for (const side of [1, -1]) {
      const t = buildTruck(metalMat, darkMat, bushingMat);
      t.position.z = side * BOARD.truckAxleZ;
      if (side < 0) t.rotation.y = Math.PI;
      truckRoot.add(t);
      trucks.push(t);
      const h = t.userData.hanger;
      h.position.y = wheelRadius;
      for (const sx of [1, -1]) {
        const w = buildWheel(wheelMat, coreMat, wheelRadius);
        w.position.x = sx * BOARD.axleHalfTrack;
        h.add(w);
        wheels.push(w);
      }
    }
  }

  let gripTex = null;
  let graphicTex = null;
  function setConfig(cfg) {
    cfg = { ...DEFAULT_BOARD, ...cfg };
    gripTex?.dispose();
    graphicTex?.dispose();
    gripTex = makeGripTexture(cfg);
    graphicTex = makeGraphicTexture(cfg);
    gripMat.map = gripTex;
    graphicMat.map = graphicTex;
    gripMat.needsUpdate = graphicMat.needsUpdate = true;
    const tf = TRUCK_FINISHES.find((t) => t.id === cfg.truckFinish) || TRUCK_FINISHES[0];
    metalMat.color.set(tf.color);
    wheelMat.color.set(cfg.wheelColor);
    if (!wheels.length || ((cfg.wheelSize || 54) / 2000) !== wheelRadius) rebuildRunningGear(cfg);
    model?.setWheelRadius(wheelRadius);
    object3d.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  let spin = 0;
  let lean = 0;
  function setWheelSpin(rad) {
    spin = rad;
    for (const w of wheels) w.rotation.x = rad;
    model?.setWheelSpin(rad);
  }

  function setTruckLean(l) {
    lean = l;
    // hangers roll opposite on front/back so the board carves
    for (let i = 0; i < trucks.length; i++) {
      trucks[i].userData.hanger.rotation.z = l * 0.12 * (i === 0 ? 1 : -1);
    }
    model?.setTruckLean(l);
  }

  // The user's modeled board (src/board/deck.glb) replaces the procedural one once it has loaded; the procedural
  // board stays as the placeholder while it streams in and as the fallback if it fails. Both share the materials
  // above, so customization (grip/graphic textures, truck finish, wheel color/size) drives whichever is showing.
  let model = null;
  loadBoardModel({
    grip: gripMat,
    graphic: graphicMat,
    edge: edgeMat,
    metal: metalMat,
    dark: darkMat,
    bushing: bushingMat,
    wheel: wheelMat,
    core: coreMat,
    bearing: bearingMat,
  })
    .then((m) => {
      model = m;
      m.setWheelRadius(wheelRadius);
      m.setWheelSpin(spin);
      m.setTruckLean(lean);
      deck.visible = false;
      truckRoot.visible = false;
      object3d.add(m.object3d);
    })
    .catch((err) => console.warn('[board] modeled board failed to load, keeping the procedural one', err));

  setConfig(initial);
  return { object3d, setConfig, setWheelSpin, setTruckLean, get wheelRadius() { return wheelRadius; } };
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BOARD } from '../core/constants.js';
import deckUrl from './deck.glb?url';

// The user's Blender board (2024DECK.fbx), converted + decimated by tools/convert-board.py into deck.glb (~24k tris).
// The GLB is already in the board-local frame (origin = wheel contact center, +Y up, +Z nose, axles at
// ±BOARD.truckAxleZ) and is grouped into animatable nodes:
//   deck, truck_F, truck_B (static) · hanger_F, hanger_B (origin on the axle line) · wheel_FL/FR/BL/BR (origin = hub)
// Every primitive keeps its Blender material name, which is how the game puts its own materials back on.

const MODEL_WHEEL_R = 0.027; // the model ships 54mm wheels

let gltfPromise = null;
function loadGltf() {
  if (!gltfPromise) {
    gltfPromise = new GLTFLoader().loadAsync(deckUrl).then((gltf) => {
      prepareGeometry(gltf.scene);
      return gltf;
    });
    gltfPromise.catch(() => {
      gltfPromise = null; // allow a retry on the next board
    });
  }
  return gltfPromise;
}

// The export has no UVs: project the same UV layout the procedural deck uses so the canvas grip / graphic
// textures (256x1024, u across the width, v tail -> nose) land the same way. The ply edge gets
// u = run along the rail, v = 0 (bottom veneer) .. 1 (top veneer).
function prepareGeometry(root) {
  root.updateMatrixWorld(true);
  const W = BOARD.width;
  const L = BOARD.length;
  const done = new Set();
  root.traverse((o) => {
    if (!o.isMesh || done.has(o.geometry)) return;
    const name = o.material?.name;
    const g = o.geometry;
    const p = g.attributes.position;
    if (name === 'griptape' || name === 'deck graphic') {
      const flip = name === 'deck graphic' ? -1 : 1;
      const uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        uv[i * 2] = 0.5 + (flip * p.getX(i)) / W;
        uv[i * 2 + 1] = 0.5 + p.getZ(i) / L;
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      done.add(g);
    } else if (name === 'sidedeck') {
      // per 5mm slice along the board: lowest / highest edge vertex = bottom / top veneer
      const BINS = 180;
      const lo = new Float32Array(BINS).fill(Infinity);
      const hi = new Float32Array(BINS).fill(-Infinity);
      const bin = (z) => Math.max(0, Math.min(BINS - 1, Math.floor((z / L + 0.5) * BINS)));
      for (let i = 0; i < p.count; i++) {
        const b = bin(p.getZ(i));
        lo[b] = Math.min(lo[b], p.getY(i));
        hi[b] = Math.max(hi[b], p.getY(i));
      }
      const uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        const b = bin(p.getZ(i));
        const h = hi[b] - lo[b];
        uv[i * 2] = (p.getZ(i) + Math.abs(p.getX(i))) * 4;
        uv[i * 2 + 1] = h > 1e-4 ? (p.getY(i) - lo[b]) / h : 0.5;
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      done.add(g);
    }
  });
}

/**
 * Loads the GLB board and hands back a controller once it's ready.
 * mats: { grip, graphic, edge, metal, dark, bushing, wheel, core, bearing }
 */
export function loadBoardModel(mats) {
  return loadGltf().then((gltf) => {
    const root = gltf.scene.clone(true);
    root.name = 'skateboard-model';
    const byMaterial = {
      griptape: mats.grip,
      'deck graphic': mats.graphic,
      sidedeck: mats.edge,
      maintrucks: mats.metal,
      bottomtrucks: mats.metal,
      hardware1: mats.dark,
      truckbushingsz: mats.bushing,
      wheels: mats.wheel,
      outerbearing: mats.core,
      innerbarinjg: mats.bearing,
    };
    const node = (n) => root.getObjectByName(n);
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = byMaterial[o.material?.name];
      if (m) o.material = m;
      else console.warn('[board] unmapped model material', o.material?.name);
      o.castShadow = true;
      o.receiveShadow = true;
    });
    root.updateMatrixWorld(true);
    const hangers = [node('hanger_F'), node('hanger_B')];
    const wheels = [];
    if (hangers.some((h) => !h)) throw new Error('board model is missing its hanger nodes');
    for (const [h, keys] of [[hangers[0], ['wheel_FL', 'wheel_FR']], [hangers[1], ['wheel_BL', 'wheel_BR']]]) {
      for (const k of keys) {
        const w = node(k);
        if (!w) throw new Error(`board model is missing ${k}`);
        h.attach(w); // wheels ride on the hanger so they lean with it
        wheels.push(w);
      }
    }

    return {
      object3d: root,
      setWheelRadius(r) {
        // bigger/smaller urethane: scale each wheel about its hub, lift the whole board so they still touch down
        const s = r / MODEL_WHEEL_R;
        for (const w of wheels) w.scale.setScalar(s);
        root.position.y = r - MODEL_WHEEL_R;
      },
      setWheelSpin(rad) {
        for (const w of wheels) w.rotation.x = rad;
      },
      setTruckLean(lean) {
        // same roll the procedural hangers get (front +, back mirrored by its 180° truck = same sign in board space)
        for (const h of hangers) h.rotation.z = lean * 0.12;
      },
    };
  });
}

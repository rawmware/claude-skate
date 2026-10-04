// Feeds every gesture diagram (src/ui/gestures.js) through the flick recognizer as a stick path
// and checks the trick it produces. Run: node tools/flick-test.mjs
import { FlickRecognizer, trickName } from '../src/game/flick.js';
import { GESTURES } from '../src/ui/gestures.js';

const HZ = 120;
// expand a gesture's waypoints (deg on the gate, '~' = along the rim) into stick samples (screen x right, y up)
function path(pts, secsPerSeg = 0.05) {
  const out = [];
  let prev = null; // {x,y,ang}
  for (const p of pts) {
    if (p === 'c') { prev = { x: 0, y: 0, ang: null }; out.push([0, 0]); continue; }
    const arc = typeof p === 'string' && p[0] === '~';
    const ang = arc ? parseFloat(p.slice(1)) : p;
    const n = Math.max(2, Math.round(secsPerSeg * HZ));
    if (arc && prev.ang != null) {
      const d = ((ang - prev.ang) % 360 + 540) % 360 - 180;
      const steps = Math.max(n, Math.ceil(Math.abs(d) / 8));
      for (let i = 1; i <= steps; i++) {
        const a = ((prev.ang + (d * i) / steps) * Math.PI) / 180;
        out.push([Math.cos(a), Math.sin(a)]);
      }
      prev = { ang: prev.ang + d };
    } else {
      const a = (ang * Math.PI) / 180;
      const [x0, y0] = out[out.length - 1];
      const x1 = Math.cos(a), y1 = Math.sin(a);
      for (let i = 1; i <= n; i++) out.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
      prev = { ang };
    }
    // hold briefly at each waypoint
    for (let i = 0; i < 3; i++) out.push(out[out.length - 1]);
  }
  return out;
}

function run(pts, { mouse = false, stance = 1, seg = 0.05 } = {}) {
  const r = new FlickRecognizer();
  const samples = [...path(pts, seg), ...Array(30).fill([0, 0])];
  let ev = null;
  for (const [x, y] of samples) {
    const u = -x * stance; // same mirroring as the controller (regular)
    const e = r.update(1 / HZ, u, y, { canLoad: true, airborne: false, lateAllowed: false, manual: mouse });
    if (e && e.type === 'pop') { ev = e; break; }
  }
  if (mouse && !ev) ev = r.release();
  if (!ev || ev.type !== 'pop') return '(no pop)';
  const name = trickName(ev.flips, ev.shove, ev.nose, false, ev.imp);
  return name === 'Ollie' && ev.nose ? 'Nollie' : name;
}

const norm = (s) => s.replace(/^BS /, '').toLowerCase();
let bad = 0;
for (const g of GESTURES) {
  if (!g.pts || g.dashed || g.fast) continue;
  // fast thumb, normal, slow and deliberate
  for (const seg of [0.025, 0.05, 0.1]) for (const mouse of [false, true]) {
    const got = run(g.pts, { mouse, seg });
    const ok = norm(got) === norm(g.name);
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${mouse ? 'mouse' : 'stick'} ${String(seg * 1000).padStart(3)}ms  ${g.name.padEnd(18)} ${g.seq.padEnd(10)} -> ${got}`);
  }
}
console.log(bad ? `\n${bad} mismatches` : '\nall gestures match');
process.exit(bad ? 1 : 0);

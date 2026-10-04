// Live physics / trick tuning, Skater XL mod-menu style (think fro's mod / Nulvex / XXL stats).
// `T` is read every frame by the controller, so changes apply instantly. Saved per browser.

export const TUNING_DEFS = [
  { group: 'Core' },
  { key: 'gravity', label: 'Gravity', min: 0.5, max: 1.6, step: 0.01, def: 0.92, fmt: 'x' },
  { key: 'timeScale', label: 'Time scale (slow-mo)', min: 0.1, max: 1, step: 0.01, def: 1, fmt: 'x' },
  { group: 'Pop' },
  { key: 'pop', label: 'Pop force', min: 0.6, max: 1.6, step: 0.01, def: 1, fmt: 'x' },
  { key: 'popAngle', label: 'Pop nose-up angle', min: 0, max: 2, step: 0.05, def: 1, fmt: 'x' },
  { group: 'Flip tricks' },
  { key: 'flipSpeed', label: 'Flip speed', min: 0.3, max: 2, step: 0.01, def: 1, fmt: 'x' },
  { key: 'flipAssist', label: 'Flip consistency (finish before landing)', type: 'bool', def: true },
  { key: 'scoopSpeed', label: 'Scoop / shuv speed', min: 0.3, max: 2, step: 0.01, def: 0.8, fmt: 'x' },
  { key: 'scoopStand', label: 'FS/BS flip board stand-up', min: 0, max: 1.5, step: 0.05, def: 1, fmt: 'x' },
  { key: 'autoCatch', label: 'Auto catch', type: 'bool', def: false },
  { group: 'Board control' },
  { key: 'boardControl', label: 'Mouse board control in the air', min: 0, max: 2, step: 0.05, def: 1, fmt: 'x' },
  { group: 'Spin & air' },
  { key: 'spinSpeed', label: 'Body spin speed', min: 0.4, max: 2, step: 0.01, def: 1, fmt: 'x' },
  { key: 'spinAssist', label: 'Finish spins to 180s (land assist)', type: 'bool', def: true },
  { key: 'airControl', label: 'Air steering', min: 0, max: 2, step: 0.05, def: 1, fmt: 'x' },
  { key: 'boardFloat', label: 'Board float / looseness', min: 0, max: 2, step: 0.05, def: 1, fmt: 'x' },
  { group: 'Landing' },
  { key: 'landTolerance', label: 'Sideways landing tolerance', min: 25, max: 80, step: 1, def: 48, fmt: 'deg' },
  { group: 'Riding' },
  { key: 'pushForce', label: 'Push force', min: 0.5, max: 2, step: 0.01, def: 1, fmt: 'x' },
  { key: 'topSpeed', label: 'Push top speed', min: 0.6, max: 1.8, step: 0.01, def: 1, fmt: 'x' },
  { key: 'turnSpeed', label: 'Carve / turn speed', min: 0.5, max: 2, step: 0.01, def: 1, fmt: 'x' },
];

export const TUNING_DEFAULTS = Object.fromEntries(TUNING_DEFS.filter((d) => d.key).map((d) => [d.key, d.def]));

export const TUNING_PRESETS = {
  Default: {},
  Floaty: { gravity: 0.82, flipSpeed: 0.85, scoopSpeed: 0.9, spinSpeed: 0.9, boardFloat: 1.5, pop: 1.05 },
  Snappy: { flipSpeed: 1.3, scoopSpeed: 1.25, spinSpeed: 1.2, popAngle: 1.2, boardFloat: 0.7, turnSpeed: 1.15 },
  Hardcore: { spinAssist: false, autoCatch: false, landTolerance: 32, gravity: 1.05, airControl: 0.4 },
  'Slow-mo practice': { timeScale: 0.35, autoCatch: true, landTolerance: 60 },
};

const KEY = 'sk8.tuning.v2'; // v2: new slower-flip / higher-pop defaults (old saved sliders are left behind)

export const T = { ...TUNING_DEFAULTS };

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object') {
      for (const k of Object.keys(TUNING_DEFAULTS)) if (typeof saved[k] === typeof TUNING_DEFAULTS[k]) T[k] = saved[k];
    }
  } catch {
    /* storage blocked: run on defaults */
  }
}

export function saveTuning() {
  try {
    localStorage.setItem(KEY, JSON.stringify(T));
  } catch {
    /* ignore */
  }
}

export function applyPreset(name) {
  Object.assign(T, TUNING_DEFAULTS, TUNING_PRESETS[name] || {});
  saveTuning();
}

load();

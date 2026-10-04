// In-game mod menu (Skater XL style): live sliders for flip speed, scoop, pop, gravity, spin...
// Toggle with M (or Insert). Changes apply instantly and are saved in this browser.
import { T, TUNING_DEFS, TUNING_PRESETS, applyPreset, saveTuning } from '../core/tuning.js';

const CSS = `
#sk8-mods{position:fixed;top:16px;right:16px;width:340px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);overflow:auto;
  background:rgba(13,13,15,.94);color:#f2f2f0;border:1px solid #2a2a2e;border-radius:10px;z-index:60;pointer-events:auto;
  font:13px/1.3 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.5);display:none}
#sk8-mods.open{display:block}
#sk8-mods header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #2a2a2e;position:sticky;top:0;background:#0d0d0f}
#sk8-mods header b{font:900 16px Impact,'Arial Black',sans-serif;letter-spacing:.04em}
#sk8-mods header b i{color:#ff5a1f;font-style:normal}
#sk8-mods header span{opacity:.55;font-size:11px}
#sk8-mods .presets{display:flex;flex-wrap:wrap;gap:6px;padding:10px 14px}
#sk8-mods button{background:#1c1c20;color:#f2f2f0;border:1px solid #333;border-radius:6px;padding:5px 9px;font:inherit;font-size:12px;cursor:pointer}
#sk8-mods button:hover{border-color:#ff5a1f}
#sk8-mods h4{margin:10px 14px 4px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#ff5a1f}
#sk8-mods .r{padding:5px 14px}
#sk8-mods .r .top{display:flex;justify-content:space-between;margin-bottom:3px}
#sk8-mods .r .v{opacity:.7;font-variant-numeric:tabular-nums}
#sk8-mods input[type=range]{width:100%;accent-color:#ff5a1f}
#sk8-mods label.t{display:flex;justify-content:space-between;align-items:center;padding:6px 14px;cursor:pointer}
#sk8-mods input[type=checkbox]{accent-color:#ff5a1f;width:16px;height:16px}
#sk8-mods footer{padding:10px 14px 14px;opacity:.55;font-size:11px}
`;

export function createModMenu(game) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.id = 'sk8-mods';
  document.body.appendChild(root);

  const refreshers = [];
  const fmt = (d, v) => (d.fmt === 'deg' ? `${Math.round(v)}°` : `${v.toFixed(2)}×`);

  root.innerHTML = `<header><b>SK8<i>.</i>IO MODS</b><span>M to close</span></header><div class="presets"></div>`;
  const presets = root.querySelector('.presets');
  for (const name of Object.keys(TUNING_PRESETS)) {
    const b = document.createElement('button');
    b.textContent = name;
    b.onclick = () => {
      applyPreset(name);
      refreshers.forEach((f) => f());
    };
    presets.appendChild(b);
  }

  for (const d of TUNING_DEFS) {
    if (d.group) {
      const h = document.createElement('h4');
      h.textContent = d.group;
      root.appendChild(h);
      continue;
    }
    if (d.type === 'bool') {
      const l = document.createElement('label');
      l.className = 't';
      l.innerHTML = `<span>${d.label}</span><input type="checkbox">`;
      const cb = l.querySelector('input');
      cb.onchange = () => {
        T[d.key] = cb.checked;
        saveTuning();
      };
      refreshers.push(() => (cb.checked = !!T[d.key]));
      root.appendChild(l);
      continue;
    }
    const r = document.createElement('div');
    r.className = 'r';
    r.innerHTML = `<div class="top"><span>${d.label}</span><span class="v"></span></div><input type="range" min="${d.min}" max="${d.max}" step="${d.step}">`;
    const inp = r.querySelector('input');
    const val = r.querySelector('.v');
    inp.oninput = () => {
      T[d.key] = parseFloat(inp.value);
      val.textContent = fmt(d, T[d.key]);
      saveTuning();
    };
    // double-click a slider to reset it
    inp.ondblclick = () => {
      T[d.key] = d.def;
      saveTuning();
      refreshers.forEach((f) => f());
    };
    refreshers.push(() => {
      inp.value = T[d.key];
      val.textContent = fmt(d, T[d.key]);
    });
    root.appendChild(r);
  }
  const foot = document.createElement('footer');
  foot.textContent = 'Double-click a slider to reset it. Settings are saved in this browser.';
  root.appendChild(foot);
  refreshers.forEach((f) => f());

  let open = false;
  const toggle = () => {
    open = !open;
    root.classList.toggle('open', open);
    if (open) {
      // free the mouse so the sliders can be used; click the game to grab it again
      game.input.mouseEnabled = false;
      game.input.exitPointerLock();
    } else if (game.mode === 'playing') {
      game.input.mouseEnabled = true;
    }
  };
  window.addEventListener('keydown', (e) => {
    if ((e.code === 'KeyM' || e.code === 'Insert') && !e.repeat && !(e.target instanceof HTMLInputElement && e.target.type !== 'range')) {
      e.preventDefault();
      toggle();
    }
  });
  return { toggle, get open() { return open; } };
}

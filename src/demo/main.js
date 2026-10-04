import { boot } from '../boot.js';
import { createWorld as createWarehouse } from './warehouse.js';
import { createWorld as createPrimitive } from './primitive-park.js';
import { createUI } from '../ui/index.js';
import { createAudio } from '../audio/index.js';

// Demo build: board-only gameplay (real physics, tricks, controls, UI, audio).
// Maps: the flat warehouse with a rolling perimeter bank (default) or ?map=primitive for the Primitive-style park.
// Press N on the title / pause screen to switch maps.
const map = new URLSearchParams(location.search).get('map') === 'primitive' ? 'primitive' : 'warehouse';
const game = boot({ createWorld: map === 'primitive' ? createPrimitive : createWarehouse, Skater: null, createUI, createAudio });
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyN' || e.repeat || !game || (game.mode !== 'title' && game.mode !== 'paused')) return;
  const url = new URL(location.href);
  url.searchParams.set('map', map === 'primitive' ? 'warehouse' : 'primitive');
  location.href = url.toString();
});

# Session notes: board feel, controls, wallies, warehouse map

Test at **http://localhost:5173/demo.html** (dev server) or open `dist-demo/demo.html` (rebuilt).
Default map is the new **Warehouse**. Press **N** on the title or pause screen to switch to the **Primitive** park.

## New controls (mouse)
| Do this | You get |
| --- | --- |
| Hold left click, pull back, flick | The pop fires when the flick finishes. You don't need to let go. |
| **Keep holding** after the pop and move the mouse | **Board control:** your feet angle the board (it's loose and springy). **Up** = nose down, **back** = tail down, **sideways** = turn the board under you. |
| Land on a rail/ledge with the board angled | The pose picks the grind. Nose down = **Nosegrind**, tail down = **5-0**, plus sideways = **Crooked/Overcrook** or **Smith/Feeble**. Fully sideways = **Boardslide**, which becomes a **Noseslide/Tailslide** with up/back. |
| Move the mouse mid-grind | Switches the grind. Pulling back to load the pop-out does not switch it. |
| On the ground, hold click and **ease the mouse halfway back / forward** | **Manual / Nose manual**. How far you ease it sets how high the nose is held. All the way back loads the pop, so you can pop straight out of a manual. |
| Land still holding tail-down / nose-down | Lands **straight into a manual**. |
| Front wheels into a curb / ledge / bench / wall, then pop (flick or Space) | **Wallie** up and over onto it. With no pop, it bumps off. |
| Click in the air | Catch early, as before. |

There's no catch button needed anymore: the feet catch the board on its **last rotation before you land**. More air or a faster flick leaves time for doubles.
Keyboard still works: W/S + A/D in the air set up grinds; Q/E do manuals.

| Hold click on the ground and drag **sideways** (without pulling back) | Carve with the mouse |
| Hold the mouse during a grind | Sideways leans the board over the rail; up/back presses the nose/tail |

## Feel changes
- **Loose board:** the board trails the rider's rotation (about 4° in carves, about 11° in air spins) and springs back with a little overshoot, so it no longer reads as welded on. The mod-menu "Board float" slider scales it.
- **Flip animation:** the board rises off the feet and comes back down to them as it finishes rotating (no hovering until the catch). It drifts a few cm off the flicking foot. The catch slap is consistent: the front foot slaps flips (nose dips), the back foot slaps scoops (tail dips). Snappier pops stand the nose up steeper.
- **Flips ~35% slower than the last build** (~1.4 rot/s on flat, vs ~3.5–4.6 originally). **Scoops slower and lower**: shuvits stay low under the feet.
- **Pop is higher and crisper**, gravity is a bit lighter, and a snappy flick pops higher than a lazy one.
- **Smooth transitions:** the collision system interpolates surface normals, so quarters, banks and corners ride as curves instead of stepping from facet to facet.
- **Landings blend in** (no snap). There's a landing-catch window, and small curbs/cracks bump instead of bailing.
- **Vert lock** off steep quarters (hold W to carry onto the deck). The nose and tail no longer clip into walls in the air.
- **No branding on boards:** the deck and grip use an original emblem instead of the "SK8.IO" text.
- New mod-menu entries (**M**): "Flip consistency" on/off, "Mouse board control" strength. Tuning was reset to the new defaults (key `sk8.tuning.v2`).

## Maps
- **Warehouse** (`src/demo/warehouse.js`): one continuous rolling bank all the way round, with a grindable curb on top. Big flat middle with a long ledge, flat bar, manual pads, a two-step ledge, a long rail, a curb, a bench and a box. You start on the **roll-in pad**: push W to drop in.
- **Primitive** (`src/demo/primitive-park.js`, `?map=primitive`).

## Where things are
- Physics/tricks/board pose: `src/game/controller.js`. Look for `boardPose`, `_poseGrind`, `_startWallie` / `_wallieStep`, the auto-catch in `step()`, and `_land`.
- Smoothed normals: `src/game/collision.js` (`smoothCornerNormals`).
- Headless checks: `node tools/catch-sim.mjs`, `combo-sim.mjs`, `flick-test.mjs`, `physics-sim.mjs`, plus `tools/scratch/control-sim.mjs` (posed grinds and manuals) and `tools/scratch/feel-sim.mjs` (flip speed and wallies). All pass.

## Next up (not done)
Wallrides, a manual balance meter, a ditch on the Primitive map, and a deeper frame-by-frame flip animation pass (flip axis tilt, catch slap).

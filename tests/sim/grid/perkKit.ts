import { GridSim } from '../../../src/sim/grid/gridSim';
import { createRng } from '../../../src/core/rng';
import type { Ent } from '../../../src/sim/grid/types';
import { handMap, OPEN } from './kit';
export function arena(seed = 3) {
  const sim = GridSim.create(seed), s = sim.s;
  s.map = handMap(OPEN); s.hero.pos = { x: 5, y: 5 }; s.hero.suit = [];
  s.foes = []; s.chests = []; s.traps = []; s.barrels = []; s.floorItems = []; s.tiles = [];
  s.visible = new Set(Array.from({ length: 225 }, (_, i) => i)); s.seen = new Uint8Array(225).fill(1);
  s.rng = createRng(seed);
  return sim;
}
export function foe(sim: GridSim, x = 6, y = 5, hp = 100): Ent {
  const f: Ent = { id: `f${sim.s.foes.length}`, kind: 'minion', pos: { x, y }, hp, maxHp: hp,
    nextAt: 100, awake: true, alive: true, group: 1 };
  sim.s.foes.push(f); return f;
}

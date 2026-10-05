import { it } from 'vitest';
import { GridSim } from '../../src/sim/grid/gridSim';
import { makeWeapon } from '../../src/sim/grid/items';
import { newState, refreshSight } from '../../src/sim/grid/state';
import { createRng } from '../../src/core/rng';
import type { EngraveId } from '../../src/sim/grid/engraveCore';
import type { FoeKind, GridMap, GridState } from '../../src/sim/grid/types';

const ROWS = ['#############', '#...........#', '#...........#', '#...........#', '#...........#', '#...........#', '#...........#', '#...........#', '#############'];
const POOL: EngraveId[] = ['gunRelay', 'bladeRelay', 'tempest', 'spinShot', 'barrage', 'flow', 'ricochet', 'pierce', 'momentum', 'gale', 'reclaim', 'trance', 'volley', 'mark', 'cull', 'bayonet', 'reverseCut'];
function build(seed: number, suit: EngraveId[], foes: { kind: FoeKind; pos: { x: number; y: number }; hp: number }[]): GridState {
  const hero = { x: 6, y: 4 };
  const m: GridMap = { w: ROWS[0]!.length, h: ROWS.length, tiles: [], rooms: [], start: hero, exits: [], chests: [], spawns: foes.map((f, i) => ({ kind: f.kind, pos: f.pos, group: i + 1 })), barrels: [] };
  for (const row of ROWS) for (const c of row) m.tiles.push(c === '#' ? 'wall' : 'floor');
  const s = newState(m, seed, 'pistol', 3);
  s.hero.gear.hands[1] = { ...makeWeapon('dagger', 2), name: '요원 칼' };
  s.hero.gear.active = 1;
  s.hero.suit = [...suit];
  s.hero.charge = s.hero.maxCharge = 20;
  s.foes.forEach((f, i) => { f.awake = true; f.hp = Math.min(f.maxHp, foes[i]!.hp); });
  refreshSight(s);
  return s;
}
it('search the longest chain', () => {
  let best = { score: -1, desc: '' };
  for (let n = 0; n < 4000; n++) {
    const rng = createRng(1000 + n);
    const suit = rng.shuffle([...POOL]).slice(0, 6) as EngraveId[];
    const count = 5 + rng.int(0, 6);
    const cells = rng.shuffle([...Array(11 * 7)].map((_, i) => ({ x: 1 + (i % 11), y: 1 + Math.floor(i / 11) })).filter(c => !(c.x === 6 && c.y === 4)));
    const foes = cells.slice(0, count).map((pos, i) => ({ kind: (i === 0 ? 'minion' : rng.pick(['minion', 'minion', 'ghoul', 'archer'])) as FoeKind, pos, hp: rng.int(1, 6) }));
    foes[0]!.pos = { x: 7, y: 4 }; foes[0]!.hp = 1;
    const s = build(1000 + n, suit, foes);
    const sim = GridSim.fromState(s);
    const before = s.foes.filter(f => f.alive).length;
    const ev = sim.act({ kind: 'move', dir: { x: 1, y: 0 } });
    const engr = ev.filter(e => e.type === 'engrave').map(e => e.text ?? '');
    const fired = sim.s.fired.size;
    // free follow-ups while flow keeps the hero going
    let extra = 0;
    for (let k = 0; k < 3 && !sim.s.outcome; k++) {
      const t = sim.autoTarget(); if (!t) break;
      sim.s.hero.gear.active = 0;
      const e2 = sim.act({ kind: 'shoot', target: t }); extra += e2.filter(e => e.type === 'engrave').length;
    }
    const kills = before - sim.s.foes.filter(f => f.alive).length;
    const score = fired * 10 + kills * 3 + extra;
    if (score > best.score) best = { score, desc: JSON.stringify({ n, fired, kills, extra, engr, suit, foes }) };
  }
  console.log(best.desc);
});

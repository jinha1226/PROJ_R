import { it } from 'vitest';
import { GridSim } from '../../src/sim/grid/gridSim';
import { fromSave, toSave } from '../../src/sim/grid/save';
import { createRng } from '../../src/core/rng';
import { SCENES, showcaseState, type ShowFoe } from '../../src/ui/grid/chainShowcase';
import { DIRS, type FoeKind, type GAction } from '../../src/sim/grid/types';

/** How long a single-turn chain can get with only a few foes in the room (each build's suit, best of many layouts). */
const candidates = (sim: GridSim): GAction[] => [...DIRS.map(dir => ({ kind: 'move', dir }) as GAction), { kind: 'swap' }, ...sim.s.foes.filter(f => f.alive).map(f => ({ kind: 'shoot', target: f.id }) as GAction)];
it('chains with few foes', () => {
  for (const sc of SCENES) for (const count of [3, 5, 8]) {
    let best = { links: 0, kills: 0, actions: 0 };
    for (let n = 0; n < 500; n++) {
      const rng = createRng(70000 + n * 13 + count);
      const cells = rng.shuffle([...Array(11 * 7)].map((_, i) => ({ x: 1 + (i % 11), y: 1 + Math.floor(i / 11) })).filter(c => Math.abs(c.x - 6) + Math.abs(c.y - 4) > 1 && Math.abs(c.x - 6) + Math.abs(c.y - 4) < 6));
      const foes: ShowFoe[] = cells.slice(0, count).map(c => ({ kind: rng.pick(['minion', 'ghoul', 'archer', 'brute'] as FoeKind[]), x: c.x, y: c.y, hp: rng.int(1, 8) }));
      const s0 = showcaseState(70000 + n, sc.suit, foes, undefined, sc.hand);
      s0.hero.fx.free = true;
      const sim = GridSim.fromState(s0);
      let links = 0, kills = 0, actions = 0;
      for (let step = 0; step < 12; step++) {
        const snap = toSave(sim.s), t0 = sim.s.hero.nextAt;
        let pick: { a: GAction; v: number; more: boolean } | null = null;
        for (const a of candidates(sim)) {
          const trial = GridSim.fromState(fromSave(snap));
          const ev = trial.act(a);
          if ((ev.length === 1 && ev[0]!.type === 'blocked') || trial.s.hero.nextAt > t0 + 1e-9) continue;
          const more = !!trial.s.hero.fx.free && trial.s.foes.some(f => f.alive);
          const v = ev.filter(e => e.type === 'engrave').length * 3 + ev.filter(e => e.type === 'die').length * 2 + (more ? 30 : 0);
          if (!pick || v > pick.v) pick = { a, v, more };
        }
        if (!pick) break;
        const ev = sim.act(pick.a);
        actions++;
        links += ev.filter(e => e.type === 'engrave').length;
        kills += ev.filter(e => e.type === 'die').length;
        if (!pick.more) break;
      }
      if (links > best.links) best = { links, kills, actions };
    }
    console.log(`${sc.id} foes ${count}: best ${best.links} links, ${best.kills} kills, ${best.actions} free moves`);
  }
});

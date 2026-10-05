import { it } from 'vitest';
import { GridSim } from '../../src/sim/grid/gridSim';
import { fromSave, toSave } from '../../src/sim/grid/save';
import { createRng } from '../../src/core/rng';
import type { EngraveId } from '../../src/sim/grid/engraveCore';
import { showcaseState, type ShowFoe } from '../../src/ui/grid/chainShowcase';
import { DIRS, type FoeKind, type GAction, type GEvent } from '../../src/sim/grid/types';

/** Searches the showcase for one turn: every action after the first is free (flow), so the foes never move while the chain runs. */
const FUSION: EngraveId[] = ['gunRelay', 'bladeRelay', 'bayonet', 'reverseCut', 'reclaim', 'momentum', 'spinShot', 'trance', 'execute'];
const OTHER: EngraveId[] = ['dash', 'leap', 'tempest', 'pierce', 'ricochet', 'mark', 'fury', 'cull', 'quickdraw'];
const flash = (ev: GEvent[]) => ev.filter(e => e.type === 'engrave').length * 3
  + ev.filter(e => e.type === 'move' && (e.text === 'dash' || e.text === 'leap')).length * 8
  + ev.filter(e => e.type === 'die').length * 2
  + Math.min(4, ev.filter(e => e.type === 'shoot' && e.src === 'hero').length) * 2;
const candidates = (sim: GridSim): GAction[] => [...DIRS.map(dir => ({ kind: 'move', dir }) as GAction), { kind: 'swap' }, ...sim.s.foes.filter(f => f.alive).map(f => ({ kind: 'shoot', target: f.id }) as GAction)];
it('search one long turn', () => {
  let best = { score: -1, desc: '' };
  for (let n = 0; n < 1400; n++) {
    const rng = createRng(9000 + n);
    const suit = ['flow', 'gunRelay', 'bladeRelay', 'dash', ...rng.shuffle([...FUSION, ...OTHER].filter(id => !['gunRelay', 'bladeRelay', 'dash'].includes(id))).slice(0, 2)] as EngraveId[];
    const cells = rng.shuffle([...Array(11 * 7)].map((_, i) => ({ x: 1 + (i % 11), y: 1 + Math.floor(i / 11) })).filter(c => Math.abs(c.x - 6) + Math.abs(c.y - 4) > 1));
    const foes: ShowFoe[] = cells.slice(0, 9 + rng.int(0, 5)).map(c => ({ kind: rng.pick(['minion', 'minion', 'ghoul', 'archer', 'brute'] as FoeKind[]), x: c.x, y: c.y, hp: rng.int(1, 8) }));
    const s0 = showcaseState(9000 + n, suit, foes);
    s0.hero.fx.free = true;
    const sim = GridSim.fromState(s0);
    const plan: GAction[] = [];
    let total = 0, lunges = 0, kills = 0, links = 0;
    for (let step = 0; step < 14; step++) {
      const snap = toSave(sim.s);
      const t0 = sim.s.hero.nextAt;
      let pick: { a: GAction; v: number; more: boolean } | null = null;
      for (const a of candidates(sim)) {
        const trial = GridSim.fromState(fromSave(snap));
        const ev = trial.act(a);
        if (ev.length === 1 && ev[0]!.type === 'blocked') continue;
        if (trial.s.hero.nextAt > t0 + 1e-9) continue; // the turn must not pass
        const more = !!trial.s.hero.fx.free && trial.s.foes.some(f => f.alive);
        const v = flash(ev) + (more ? 30 : 0) + (a.kind === 'swap' ? -2 : 0);
        if (!pick || v > pick.v) pick = { a, v, more };
      }
      if (!pick) break;
      const ev = sim.act(pick.a);
      plan.push(pick.a);
      total += flash(ev);
      links += ev.filter(e => e.type === 'engrave').length;
      lunges += ev.filter(e => e.type === 'move' && (e.text === 'dash' || e.text === 'leap')).length;
      kills += ev.filter(e => e.type === 'die').length;
      if (!pick.more) break;
    }
    const score = total + plan.length * 5;
    if (score > best.score) best = { score, desc: JSON.stringify({ seed: 9000 + n, score, actions: plan.length, links, lunges, kills, suit, foes, plan }) };
  }
  console.log(best.desc);
});

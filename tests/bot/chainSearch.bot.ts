import { it } from 'vitest';
import { GridSim } from '../../src/sim/grid/gridSim';
import { showcaseState, type ShowFoe } from '../../src/ui/grid/chainShowcase';
import { fromSave, toSave } from '../../src/sim/grid/save';
import { createRng } from '../../src/core/rng';
import type { EngraveId } from '../../src/sim/grid/engraveCore';
import { DIRS, type FoeKind, type GAction, type GEvent } from '../../src/sim/grid/types';

/** Searches layouts for the showcase (src/ui/grid/chainShowcase.ts): long chains with plenty of dashing and leaping. */
const MOVERS: EngraveId[] = ['dash', 'leap', 'bladeRelay'];
const POOL: EngraveId[] = ['gunRelay', 'momentum', 'flow', 'gale', 'tempest', 'spinShot', 'execute', 'fury', 'reclaim', 'quickdraw', 'cull', 'bayonet', 'reverseCut', 'pierce', 'ricochet', 'shoulder', 'trance', 'mark'];
type Foe = ShowFoe;
const flash = (ev: GEvent[]) => ev.filter(e => e.type === 'engrave').length * 3
  + ev.filter(e => e.type === 'move' && (e.text === 'dash' || e.text === 'leap')).length * 7
  + ev.filter(e => e.type === 'die').length * 2
  + Math.min(4, ev.filter(e => e.type === 'shoot' && e.src === 'hero').length) * 3;
function candidates(sim: GridSim): GAction[] {
  const out: GAction[] = DIRS.map(dir => ({ kind: 'move', dir }));
  out.push({ kind: 'swap' });
  for (const f of sim.s.foes) if (f.alive) out.push({ kind: 'shoot', target: f.id });
  return out;
}
it('search the most dynamic long chain', () => {
  let best = { score: -1, desc: '' };
  for (let n = 0; n < 700; n++) {
    const rng = createRng(5000 + n);
    const suit = [...rng.shuffle([...MOVERS]).slice(0, 2 + rng.int(0, 1)), ...rng.shuffle([...POOL])].slice(0, 6) as EngraveId[];
    const cells = rng.shuffle([...Array(11 * 7)].map((_, i) => ({ x: 1 + (i % 11), y: 1 + Math.floor(i / 11) })).filter(c => Math.abs(c.x - 6) + Math.abs(c.y - 4) > 1));
    const foes: Foe[] = cells.slice(0, 8 + rng.int(0, 5)).map(c => ({ kind: rng.pick(['minion', 'minion', 'ghoul', 'archer', 'brute'] as FoeKind[]), x: c.x, y: c.y, hp: rng.int(1, 9) }));
    const sim = GridSim.fromState(showcaseState(5000 + n, suit, foes));
    const plan: GAction[] = [];
    let total = 0, lunges = 0, kills = 0;
    const engr = new Set<string>();
    for (let step = 0; step < 10 && sim.s.foes.some(f => f.alive); step++) {
      const snap = toSave(sim.s);
      let pick: { a: GAction; v: number } | null = null;
      for (const a of candidates(sim)) {
        const trial = GridSim.fromState(fromSave(snap));
        const ev = trial.act(a);
        if (ev.length === 1 && ev[0]!.type === 'blocked') continue;
        const v = flash(ev) + (a.kind === 'swap' ? -1 : 0);
        if (!pick || v > pick.v) pick = { a, v };
      }
      if (!pick) break;
      const ev = sim.act(pick.a);
      plan.push(pick.a);
      total += flash(ev);
      lunges += ev.filter(e => e.type === 'move' && (e.text === 'dash' || e.text === 'leap')).length;
      kills += ev.filter(e => e.type === 'die').length;
      for (const e of ev) if (e.type === 'engrave') engr.add(e.text ?? '');
    }
    const score = total + engr.size * 4 + (lunges >= 4 ? 20 : 0) + (engr.has('gunRelay') || engr.has('bayonet') || engr.has('reverseCut') ? 15 : 0);
    if (score > best.score) best = { score, desc: JSON.stringify({ n, seed: 5000 + n, score, lunges, kills, kinds: [...engr], suit, foes, plan }) };
  }
  console.log(best.desc);
});

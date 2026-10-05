import { it } from 'vitest';
import { GridSim } from '../../src/sim/grid/gridSim';
import { fromSave, toSave } from '../../src/sim/grid/save';
import { createRng } from '../../src/core/rng';
import type { EngraveId } from '../../src/sim/grid/engraveCore';
import { showcaseState, type ShowFoe } from '../../src/ui/grid/chainShowcase';
import { DIRS, type FoeKind, type GAction, type GEvent } from '../../src/sim/grid/types';

/** Searches one turn of free moves (흐름) for the most varied show: many different moves, not the same lunge again and again. */
/** the visual kinds a move can show */
function kinds(ev: GEvent[]): string[] {
  const out: string[] = [];
  for (const e of ev) {
    if (e.type === 'move' && e.text && ['dash', 'leap', 'kite'].includes(e.text)) out.push(e.text);
    if (e.type === 'engrave' && e.text && !['flow', 'dash', 'leap', 'kite'].includes(e.text)) out.push(e.text);
    if (e.type === 'push') out.push('push');
  }
  return out;
}
const flash = (ev: GEvent[]) => ev.filter(e => e.type === 'engrave').length * 2 + ev.filter(e => e.type === 'die').length * 2;
const candidates = (sim: GridSim): GAction[] => [...DIRS.map(dir => ({ kind: 'move', dir }) as GAction), { kind: 'swap' }, ...sim.s.foes.filter(f => f.alive).map(f => ({ kind: 'shoot', target: f.id }) as GAction)];
it('search the most varied single turn', () => {
  let best = { score: -1, desc: '' };
  const ALL: EngraveId[][] = [
    ['flow', 'gunRelay', 'spinShot', 'leap', 'tempest', 'kite'],
    ['flow', 'gunRelay', 'bladeRelay', 'leap', 'tempest', 'spinShot'],
    ['flow', 'gunRelay', 'spinShot', 'dash', 'leap', 'ricochet'],
    ['flow', 'gunRelay', 'bladeRelay', 'spinShot', 'tempest', 'pierce'],
    ['flow', 'gunRelay', 'tempest', 'kite', 'pierce', 'bladeRelay'],
    // blade builds (5, 6, 7)
    ['flow', 'dash', 'leap', 'tempest', 'cull', 'fury'],
    ['flow', 'dash', 'leap', 'tempest', 'shoulder', 'wallslam'],
    ['flow', 'dash', 'tempest', 'cull', 'finisher', 'bloodlust'],
    // gun builds (8, 9, 10)
    ['flow', 'pierce', 'ricochet', 'volley', 'mark', 'barrage'],
    ['flow', 'barrage', 'ricochet', 'quickdraw', 'pierce', 'kite'],
    ['flow', 'rapid', 'volley', 'ricochet', 'pierce', 'thrift'],
  ];
  const GUN = (suit: EngraveId[]) => !suit.some(id => ['dash', 'leap', 'tempest', 'gunRelay', 'bladeRelay'].includes(id));
  // SUIT=n searches one suit only (a scene per suit)
  const SUITS = process.env.SUIT ? process.env.SUIT.split(',').map(i => ALL[Number(i)]!) : ALL;
  for (let n = 0; n < Number(process.env.N ?? 4000); n++) {
    const rng = createRng(30000 + n);
    const suit = SUITS[n % SUITS.length]!;
    // foes in knots, so being surrounded (칼날 폭풍, 회전 사격) and leaping in happen
    const foes: ShowFoe[] = [];
    const taken = new Set(['6,4']);
    for (let c = 0, knots = 3 + rng.int(0, 2); c < knots; c++) {
      const cx = 1 + rng.int(0, 10), cy = 1 + rng.int(0, 6);
      for (let k = 0, size = 2 + rng.int(0, 3); k < size; k++) {
        const x = Math.min(11, Math.max(1, cx + rng.int(-1, 1))), y = Math.min(7, Math.max(1, cy + rng.int(-1, 1)));
        if (taken.has(`${x},${y}`) || Math.abs(x - 6) + Math.abs(y - 4) <= 1) continue;
        taken.add(`${x},${y}`);
        foes.push({ kind: rng.pick(['minion', 'minion', 'ghoul', 'archer', 'brute'] as FoeKind[]), x, y, hp: rng.int(1, 8) });
      }
    }
    const s0 = showcaseState(30000 + n, suit, foes, undefined, GUN(suit) ? 'gun' : 'blade');
    s0.hero.fx.free = true;
    const sim = GridSim.fromState(s0);
    const plan: GAction[] = [];
    const seen = new Map<string, number>();
    let total = 0, links = 0, kills = 0;
    for (let step = 0; step < 12; step++) {
      const snap = toSave(sim.s);
      const t0 = sim.s.hero.nextAt;
      let pick: { a: GAction; v: number; more: boolean } | null = null;
      for (const a of candidates(sim)) {
        const trial = GridSim.fromState(fromSave(snap));
        const ev = trial.act(a);
        if (ev.length === 1 && ev[0]!.type === 'blocked') continue;
        if (trial.s.hero.nextAt > t0 + 1e-9) continue;
        const more = !!trial.s.hero.fx.free && trial.s.foes.some(f => f.alive);
        // a kind not shown yet is worth much more than one shown before
        const novelty = kinds(ev).reduce((v, k) => v + 24 / (1 + (seen.get(k) ?? 0) * 2), 0);
        const v = flash(ev) + novelty + (more ? 30 : 0) + (a.kind === 'swap' ? -2 : 0);
        if (!pick || v > pick.v) pick = { a, v, more };
      }
      if (!pick) break;
      const ev = sim.act(pick.a);
      plan.push(pick.a);
      for (const k of kinds(ev)) seen.set(k, (seen.get(k) ?? 0) + 1);
      total += flash(ev);
      links += ev.filter(e => e.type === 'engrave').length;
      kills += ev.filter(e => e.type === 'die').length;
      if (!pick.more) break;
    }
    const variety = seen.size;
    const score = variety * 40 + total + plan.length * 6;
    if (score > best.score) best = { score, desc: JSON.stringify({ seed: 30000 + n, hand: GUN(suit) ? 'gun' : 'blade', score, variety, kinds: Object.fromEntries(seen), actions: plan.length, links, kills, suit, foes, plan }) };
  }
  console.log(best.desc);
});

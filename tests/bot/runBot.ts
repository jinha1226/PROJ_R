import { smartDecide, createMemory } from './brain/policy';
import type { EngraveId } from '../../src/sim/grid/engraveCore';
import type { Round } from '../../src/sim/grid/rounds';
import { GridSim } from '../../src/sim/grid/gridSim';
import { freshMeta, type MetaState } from '../../src/sim/grid/meta';
import { walkBlocked } from '../../src/sim/grid/actions';
import { gunCost } from '../../src/sim/grid/kataTargets';
import { activeWeapon } from '../../src/sim/grid/gear';
import { exploreTarget } from '../../src/sim/grid/explore';
import { findPath } from '../../src/sim/grid/path';
import { canStep, idx, tileAt, type Cell, type GridState } from '../../src/sim/grid/types';

export interface BotResult { seed: number; floor: number; outcome: string; actions: number; killedBy?: string; stuck?: string; level: number; kills: number; floorActions: number[]; floorDmg: number[]; floorHp: number[]; potions: number; scrolls: number; belt: number; build: string[] }

const stepTo = (s: GridState, to: Cell): Cell | null => {
  const p = findPath(s.map, s.hero.pos, to, (c) => walkBlocked(s, c));
  return p && p[0] ? { x: p[0].x - s.hero.pos.x, y: p[0].y - s.hero.pos.y } : null;
};

/** One action by a plain policy: picks first, shoot what can be shot, walk to the core / stairs, explore, then hunt. */
export function naiveDecide(sim: GridSim): Parameters<GridSim['act']>[0] {
  const s = sim.s;
  if (s.upgrades.length) return { kind: 'upgrade', i: 0 };
  if (s.offers.length) return { kind: 'choose', i: 0 };
  const h = s.hero;
  const w = activeWeapon(h.gear);
  const loaded = !!w && h.charge >= gunCost(s, w);
  const t = loaded ? sim.autoTarget() : undefined;
  if (t) return { kind: 'shoot', target: t };
  // out of charge: strike the nearest adjacent foe (hits refill it)
  const adj = s.foes.find((f) => f.alive && Math.max(Math.abs(f.pos.x - h.pos.x), Math.abs(f.pos.y - h.pos.y)) === 1 && canStep(s.map, h.pos, { x: f.pos.x - h.pos.x, y: f.pos.y - h.pos.y }));
  if (adj) return { kind: 'move', dir: { x: adj.pos.x - h.pos.x, y: adj.pos.y - h.pos.y } };
  if (!loaded) {
    const awake = s.foes.filter((f) => f.alive && f.awake).sort((a, b) => Math.hypot(a.pos.x - h.pos.x, a.pos.y - h.pos.y) - Math.hypot(b.pos.x - h.pos.x, b.pos.y - h.pos.y))[0];
    const d = awake && stepTo(s, awake.pos);
    if (d) return { kind: 'move', dir: d };
  }
  const core = s.floorItems.find((f) => f.item.kind === 'core');
  const goals: Cell[] = [];
  if (core) goals.push(core.pos);
  if (s.map.stairs && s.seen[idx(s.map, s.map.stairs)]) goals.push(s.map.stairs);
  const ex = exploreTarget(s);
  if (ex) goals.push(ex);
  const foes = s.foes.filter((f) => f.alive).sort((a, b) => Math.hypot(a.pos.x - s.hero.pos.x, a.pos.y - s.hero.pos.y) - Math.hypot(b.pos.x - s.hero.pos.x, b.pos.y - s.hero.pos.y));
  goals.push(...foes.map((f) => f.pos));
  if (s.map.stairs) goals.push(s.map.stairs);
  for (const g of goals) {
    const d = stepTo(s, g);
    if (d) return { kind: 'move', dir: d };
  }
  // a found trap in a corridor hides the rest of the floor from exploring: walk through it
  const loose = (c: Cell) => s.barrels.some((b) => b.x === c.x && b.y === c.y);
  const far = s.seen.findIndex((v, i) => !v && s.map.tiles[i] !== 'wall' && !!findPath(s.map, s.hero.pos, { x: i % s.map.w, y: Math.floor(i / s.map.w) }, loose));
  const tgt = s.map.stairs ?? (far >= 0 ? { x: far % s.map.w, y: Math.floor(far / s.map.w) } : null);
  const p = tgt && findPath(s.map, s.hero.pos, tgt, loose);
  if (p && p[0]) { trapWalks++; return { kind: 'move', dir: { x: p[0].x - s.hero.pos.x, y: p[0].y - s.hero.pos.y } }; }
  return { kind: 'search' };
}
export let trapWalks = 0;

export interface BotOptions {
  god: boolean; policy: 'naive' | 'smart'; meta?: MetaState; startSuit?: EngraveId[]; round?: Round;
  maxActions?: number; onFinish?: (s: GridState) => void;
}
export function runBot(seed: number, options: BotOptions | boolean, maxActions = 40000, onStuck?: (s: GridState) => void): BotResult {
  // Preserve the diagnostic runner's old boolean API as the naive baseline.
  const opts: BotOptions = typeof options === 'boolean' ? { god: options, policy: 'naive' } : options;
  const { god } = opts;
  maxActions = opts.maxActions ?? maxActions;
  const mem = createMemory();
  const decide = (sim: GridSim) => opts.policy === 'smart' ? smartDecide(sim, mem) : naiveDecide(sim);
  const sim = GridSim.createRun(seed, opts.meta ?? freshMeta(), { gun: 'pistol', start: 1, startSuit: opts.startSuit ?? [], round: opts.round });
  const s = sim.s;
  const floorActions: number[] = [];
  let n = 0, onFloor = 0, floor = s.run.floor, blocked = 0;
  let stuck: string | undefined;
  const floorDmg: number[] = [0], floorHp: number[] = [s.hero.maxHp];
  while (!s.outcome && n < maxActions) {
    if (god) { floorDmg[floorDmg.length - 1]! += s.hero.maxHp - s.hero.hp; s.hero.hp = s.hero.maxHp; }
    const a = decide(sim);
    const upgrade = a.kind === 'upgrade' && a.i !== null ? s.upgrades[0]?.[a.i] : undefined;
    const ev = sim.act(a);
    if (ev.some(e => e.type === 'drink' || e.type === 'use' && e.text?.startsWith('potion:'))) mem.potions++;
    if (ev.some(e => e.type === 'read')) {
      mem.scrolls++;
      if (a.kind === 'read' && a.sc === 'map') mem.mappedFloors.push(s.run.floor);
    }
    if (a.kind === 'use' && ev.some(e => e.type === 'use' || e.type === 'heal' && e.text !== 'regen')) mem.belt++;
    if (upgrade && ev.some(e => e.type === 'upgrade')) mem.upgrades.push(upgrade);
    if (ev.length === 1 && ev[0]!.type === 'blocked') {
      if (a.kind === 'choose') { sim.act({ kind: 'choose', i: null }); continue; }
      if (++blocked > 50) {
        const to = a.kind === 'move' ? { x: s.hero.pos.x + a.dir.x, y: s.hero.pos.y + a.dir.y } : null;
        stuck = `blocked loop ${a.kind} at f${s.run.floor}${to ? ` into ${tileAt(s.map, to)} ${JSON.stringify(to)} from ${JSON.stringify(s.hero.pos)} foe=${s.foes.some((f) => f.alive && f.pos.x === to.x && f.pos.y === to.y)}` : ''}`;
        break;
      }
      sim.act({ kind: 'wait' });
    } else blocked = 0;
    n++; onFloor++;
    if (s.run.floor !== floor) { floorDmg.push(0); floorHp.push(s.hero.maxHp); floorActions.push(onFloor); onFloor = 0; floor = s.run.floor; }
    if (onFloor > 6000) {
      const st = s.map.stairs;
      const champ = s.foes.find((f) => f.alive && f.kind === 'champion');
      const pathSt = st && findPath(s.map, s.hero.pos, st);
      const pathCh = champ && findPath(s.map, s.hero.pos, champ.pos);
      const unseen = s.seen.reduce((a, v, i) => a + (!v && s.map.tiles[i] !== 'wall' ? 1 : 0), 0);
      stuck = `floor ${s.run.floor} >6000 | stairs ${st ? JSON.stringify(st) : 'none'} seen=${st ? !!s.seen[idx(s.map, st)] : '-'} path=${pathSt ? pathSt.length : 'NO'} | champ ${champ ? `${JSON.stringify(champ.pos)} path=${pathCh ? pathCh.length : 'NO'}` : 'none'} | unseen ${unseen} | foes ${s.foes.filter((f) => f.alive).length} | last ${JSON.stringify(decide(sim))} at ${JSON.stringify(s.hero.pos)}`;
      onStuck?.(s);
      break;
    }
  }
  floorActions.push(onFloor);
  opts.onFinish?.(s);
  return { seed, floor: s.run.floor, outcome: s.outcome ?? (stuck ? 'stuck' : 'timeout'), actions: n, killedBy: s.run.killedBy?.kind, stuck, level: s.hero.level, kills: s.run.kills, floorActions, floorDmg, floorHp, potions: mem.potions, scrolls: mem.scrolls, belt: mem.belt,
    build: [...s.hero.suit, ...s.hero.rounds.map(r => `round:${r}`), ...mem.upgrades.map(u => `upgrade:${u}`)] };
}

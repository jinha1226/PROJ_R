import { GridSim } from '../../../src/sim/grid/gridSim';
import { freshMeta } from '../../../src/sim/grid/meta';
import { shotClear } from '../../../src/sim/grid/combat';
import { BAG_SIZE } from '../../../src/sim/grid/gear';
import { GUN_COST, isGun, WEAPONS } from '../../../src/sim/grid/items';
import { canStep, dist, idx, type GAction, type GridState } from '../../../src/sim/grid/types';
import { navigate } from './gridBotNav';

export type GridBotMode = 'decent' | 'pistol-only';
export interface GridBotResult {
  seed: number; mode: GridBotMode; outcome: 'won' | 'dead' | 'returned' | 'cap';
  floor: number; turns: number; actions: number; time: number; level: number;
  sightTurns: number; emptyChargeTurns: number; killer?: string;
}
export const GRID_BOT_CAP = 10_000;

/** Fixed policy, no RNG of its own, fresh pistol loadout and no inherited progression. */
export function gridBotAction(s: GridState, mode: GridBotMode): GAction {
  const h = s.hero, g = h.gear;
  if (s.upgrades.length) return { kind: 'upgrade', i: 0 };
  if (s.offers.length) {
    const i = mode === 'pistol-only' ? s.offers[0]!.findIndex(id => id !== 'bladeRelay') : 0;
    return { kind: 'choose', i: i < 0 ? null : i, slot: 0 };
  }
  if (mode === 'pistol-only' && g.hands[g.active] && WEAPONS[g.hands[g.active]!.group].melee) return { kind: 'swap' };
  if (h.hp < h.maxHp * 0.4 && g.belt.potion > 0) return { kind: 'use', item: 'potion' };
  if (mode === 'decent' && g.hands.includes(null)) {
    const bag = g.bag.findIndex(w => w.kind === 'weapon' && WEAPONS[w.group].melee);
    if (bag >= 0) return g.hands[g.active] ? { kind: 'swap' } : { kind: 'equip', bag };
  }
  const foes = s.foes.filter(f => f.alive && s.visible.has(idx(s.map, f.pos)))
    .sort((a, b) => dist(h.pos, a.pos) - dist(h.pos, b.pos) || a.hp - b.hp);
  const adjacent = foes.find(f => dist(h.pos, f.pos) === 1 && canStep(s.map, h.pos, { x: f.pos.x - h.pos.x, y: f.pos.y - h.pos.y }));
  if (adjacent) {
    const melee = g.hands.findIndex(w => w && WEAPONS[w.group].melee);
    if (mode === 'decent' && melee >= 0 && g.active !== melee) return { kind: 'swap' };
    // With no melee weapon this is the game's ordinary gun bash; it earns no charge.
    return { kind: 'move', dir: { x: adjacent.pos.x - h.pos.x, y: adjacent.pos.y - h.pos.y }, plain: true };
  }
  const gunHand = g.hands.findIndex(w => w && isGun(w.group));
  const gun = g.hands[gunHand];
  if (gun && isGun(gun.group) && h.charge >= GUN_COST[gun.group]) {
    const target = foes.find(f => f.awake && dist(h.pos, f.pos) <= WEAPONS[gun.group].range! && shotClear(s, h.pos, f.pos));
    if (target) return g.active === gunHand ? { kind: 'shoot', target: target.id } : { kind: 'swap' };
  }
  return navigate(s, mode, g.bag.length < BAG_SIZE);
}

/** Count only time-spending actions as turns; cap all actions too, including free choices. */
export function playGridRun(seed: number, mode: GridBotMode = 'decent', cap = GRID_BOT_CAP): GridBotResult {
  const sim = GridSim.createRun(seed, freshMeta(), { gun: 'pistol', start: 1, startSuit: [] });
  let turns = 0, actions = 0, sightTurns = 0, emptyChargeTurns = 0;
  while (!sim.s.outcome && actions < cap) {
    const s = sim.s, before = s.hero.nextAt;
    const inSight = s.foes.some(f => f.alive && s.visible.has(idx(s.map, f.pos)));
    const empty = s.hero.charge === 0;
    sim.act(gridBotAction(s, mode));
    actions++;
    if (s.hero.nextAt > before) {
      turns++;
      if (inSight) { sightTurns++; if (empty) emptyChargeTurns++; }
    }
  }
  const s = sim.s;
  return { seed, mode, outcome: s.outcome ?? 'cap', floor: s.run.floor, turns, actions,
    time: s.time, level: s.hero.level, sightTurns, emptyChargeTurns, killer: s.run.killedBy?.kind };
}

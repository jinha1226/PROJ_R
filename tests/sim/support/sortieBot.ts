import type { Vec2 } from '../../../src/core/vec2';
import { xitem } from '../../../src/data/extract';
import { generateRegion } from '../../../src/sim/extract/region';
import { bagSlots, carriedValue, emptyLoadout, type Loadout } from '../../../src/sim/extract/loadout';
import { createProtagonist } from '../../../src/sim/roster/generate';
import { SEC } from '../../../src/sim/world/clock';
import { lootSource } from '../../../src/sim/world/interact';
import { idleInput, WorldSim, type HeroInput } from '../../../src/sim/world/worldSim';
import { heroUnit } from '../../../src/sim/world/worldState';

export interface SortieOutcome { outcome: 'extracted' | 'failed' | 'timeout'; minutes: number; value: number; xp: number }

/** The free kit plus the two small potions 50 starting gold buys. */
export const starterLoadout = (): Loadout => ({ ...emptyLoadout(), equipped: { weapon: 'x_sword_shield_0', chest: 'x_chest_0' }, quick: [{ id: 'x_potion_s', n: 2 }] });

const d = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * A plain player: loots the nearest unopened container, fights whatever attacks (auto combat), drinks below 40% HP,
 * and heads for the nearest open extraction point after `leaveAt` minutes, below 35% HP, or with a full bag.
 */
export function playSortie(seed: number, leaveAt: number, loadout: Loadout = starterLoadout(), level = 1): SortieOutcome {
  const hero = { ...createProtagonist(seed), level };
  const sim = new WorldSim(generateRegion(seed), hero, loadout, seed);
  const w = sim.w;
  let path: Vec2[] = [];
  let goal: Vec2 | null = null;
  let repath = 0;
  const limit = 20 * 60 * SEC;
  while (!w.outcome && w.b.tick < limit) {
    const h = heroUnit(w);
    const input: HeroInput = idleInput();
    const minute = w.b.tick / (60 * SEC);
    const threat = w.b.units.some((u) => u.team === 'enemy' && u.alive && !u.downed && !u.dormant && w.ai[u.id]?.mode === 'alert' && d(u.pos, h.pos) < 9);
    if (h.hp < h.maxHp * 0.4 && w.hero.loadout.quick[0]) input.quick = 0;
    const leaving = minute >= leaveAt || (h.hp < h.maxHp * 0.35 && !w.hero.loadout.quick[0]);
    if (threat && !(leaving && w.hero.channel?.kind === 'extract')) {
      goal = null;
    } else {
      let target: Vec2 | null;
      if (leaving) {
        const open = w.region.extracts.filter((e) => !w.closed.includes(e.id)).sort((a, b) => d(a.pos, h.pos) - d(b.pos, h.pos));
        target = open[0]?.pos ?? null;
      } else {
        const near = sim.nearby();
        if (near?.kind === 'search' && !w.hero.channel) input.interact = true;
        if (near?.kind === 'loot') takeBest(sim, near.id);
        // roadside finds first; points of interest cost more the riskier they are
        const risk = (poi?: string) => (poi ? 20 * (w.region.pois.find((p) => p.id === poi)?.risk ?? 1) : 0);
        const todo = w.region.containers.filter((c) => !w.containers[c.id]?.opened && c.kind !== 'vault')
          .sort((a, b) => d(a.pos, h.pos) + risk(a.poi) - (d(b.pos, h.pos) + risk(b.poi)));
        const rest = h.hp < h.maxHp * 0.6;
        target = rest || near?.kind === 'search' || w.hero.channel?.kind === 'search' ? null : todo[0]?.pos ?? null;
      }
      if (target && (!goal || d(goal, target) > 0.1 || repath-- <= 0)) {
        goal = target;
        path = w.nav.path(h.pos, target) ?? [target];
        repath = 40;
      }
      while (path.length > 1 && d(path[0]!, h.pos) < 0.7) path.shift();
      const next = target ? path[0] : undefined;
      if (next && d(next, h.pos) > 0.3) {
        const l = d(next, h.pos);
        input.move = { x: (next.x - h.pos.x) / l, y: (next.y - h.pos.y) / l };
      }
    }
    sim.step(input);
  }
  return { outcome: w.outcome ?? 'timeout', minutes: w.b.tick / (60 * SEC), value: w.outcome === 'extracted' ? carriedValue(w.hero.loadout) : 0, xp: w.xp };
}

/** Takes the most valuable stacks first; with a full bag, swaps out the cheapest stack for a pricier find. */
function takeBest(sim: WorldSim, id: string): void {
  for (let guard = 0; guard < 12; guard++) {
    const items = lootSource(sim.w, id);
    if (!items?.length) return;
    const order = items.map((s, i) => ({ i, v: xitem(s.id).value * s.n })).sort((a, b) => b.v - a.v);
    if (order.some((o) => sim.lootTake(id, o.i))) continue;
    const bag = sim.w.hero.loadout.bag;
    const worst = bag.map((s, i) => ({ i, v: xitem(s.id).value * s.n })).sort((a, b) => a.v - b.v)[0];
    if (!worst || worst.v >= order[0]!.v || bag.length < bagSlots(sim.w.hero.loadout)) return;
    sim.lootDrop('bag', worst.i);
    if (!sim.lootTake(id, order[0]!.i)) return;
  }
}

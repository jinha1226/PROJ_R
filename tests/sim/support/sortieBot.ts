import type { Vec2 } from '../../../src/core/vec2';
import { xitem } from '../../../src/data/extract';
import { kitUp, newCompany } from '../../../src/sim/extract/company';
import { createRng } from '../../../src/core/rng';
import { generateRecruit } from '../../../src/sim/roster/generate';
import { generateRegion } from '../../../src/sim/extract/region';
import { bagSlots, carriedValue } from '../../../src/sim/extract/loadout';
import { SEC } from '../../../src/sim/world/clock';
import { lootSource } from '../../../src/sim/world/interact';
import { partyUnits } from '../../../src/sim/world/party';
import { idleInput, WorldSim, type HeroInput } from '../../../src/sim/world/worldSim';
import { heroUnit } from '../../../src/sim/world/worldState';

export interface SortieOutcome { outcome: 'extracted' | 'failed' | 'timeout'; minutes: number; value: number; xp: number; home: number; dead: number; size: number }

const d = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * A plain commander: leads the party to the nearest unopened container (roadside first, risky places cost more),
 * lets them fight on their own, orders a retreat when someone is in trouble, and heads for the nearest open
 * extraction point (standing in its middle) after `leaveAt` minutes or when half the party is down.
 */
export function playSortie(seed: number, leaveAt: number, size = 3): SortieOutcome {
  let c = newCompany(seed);
  const rng = createRng(seed ^ 0xb07);
  const used = new Set(c.mercs.map((m) => m.name));
  while (c.mercs.length < size) {
    const m = generateRecruit(rng, { level: 1, usedNames: used, id: `b${c.mercs.length}` });
    c = kitUp({ ...c, mercs: [...c.mercs, m] }, m.id);
  }
  const members = c.mercs.slice(0, size).map((m) => ({ merc: m, gear: c.gear[m.id]! }));
  const sim = WorldSim.party(generateRegion(seed), members, [{ id: 'x_potion_s', n: 2 }], null, seed);
  const w = sim.w;
  let path: Vec2[] = [];
  let goal: Vec2 | null = null;
  let repath = 0;
  let retreatCd = 0;
  const limit = 20 * 60 * SEC;
  while (!w.outcome && w.b.tick < limit) {
    const h = heroUnit(w);
    const party = partyUnits(w);
    const input: HeroInput = idleInput();
    const minute = w.b.tick / (60 * SEC);
    const standing = party.filter((u) => !u.downed);
    const struggling = standing.some((u) => u.hp < u.maxHp * 0.25);
    if (w.party.mode === 'combat' && struggling && retreatCd <= 0) { input.retreat = true; retreatCd = 8 * SEC; }
    retreatCd--;
    // waiting at the exit for stragglers: call everyone in
    if (w.hero.channel?.waiting && w.b.tick % 40 === 0) input.regroup = true;
    if (h.hp < h.maxHp * 0.4) {
      const potion = w.hero.loadout.bag.findIndex((s) => xitem(s.id).use?.kind === 'heal');
      if (potion >= 0) sim.useItem(potion);
    }
    const leaving = minute >= leaveAt || standing.length * 2 <= size;
    let target: Vec2 | null = null;
    if (w.party.mode !== 'combat' || leaving) {
      if (leaving) {
        const open = w.region.extracts.filter((e) => !w.closed.includes(e.id)).sort((a, b) => d(a.pos, h.pos) - d(b.pos, h.pos));
        target = open[0]?.pos ?? null;
      } else {
        const near = sim.nearby();
        if (near?.kind === 'search' && !w.hero.channel) input.interact = true;
        if (near?.kind === 'loot') takeBest(sim, near.id);
        const risk = (poi?: string) => (poi ? 20 * (w.region.pois.find((p) => p.id === poi)?.risk ?? 1) : 0);
        const todo = w.region.containers.filter((x) => !w.containers[x.id]?.opened && x.kind !== 'vault')
          .sort((a, b) => d(a.pos, h.pos) + risk(a.poi) - (d(b.pos, h.pos) + risk(b.poi)));
        const rest = standing.some((u) => u.hp < u.maxHp * 0.6);
        target = rest || near?.kind === 'search' || w.hero.channel?.kind === 'search' ? null : todo[0]?.pos ?? null;
      }
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
    sim.step(input);
  }
  const end = w.outcome ? sim.end() : null;
  return {
    outcome: w.outcome ?? 'timeout', minutes: w.b.tick / (60 * SEC), value: w.outcome === 'extracted' ? carriedValue(w.hero.loadout) : 0, xp: w.xp, size,
    home: end ? end.members.filter((m) => m.state !== 'dead').length : 0, dead: end ? end.members.filter((m) => m.state === 'dead').length : 0,
  };
}

/** Takes the most valuable stacks first; with a full pack, swaps out the cheapest stack for a pricier find. */
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

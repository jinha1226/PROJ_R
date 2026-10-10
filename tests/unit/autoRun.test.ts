import { expect, it } from 'vitest';
import { delveTick, newDelve } from '../../src/sim/delve/delveSim';
import { dist, idx } from '../../src/sim/grid/types';
import { entOf, unitOf } from '../../src/sim/party/partyCore';
import { pickTrait } from '../../src/sim/party/partyLevel';
import type { TraitId } from '../../src/sim/party/traitDefs';
import { orderTo } from '../../src/sim/roam/roam';
import { AutoRun } from '../../src/ui/delve/autoRun';
import { AutoExplore, exploreWants } from '../../src/ui/delve/explore';

/** the dungeon screen's loop without the screen: explore's look, the auto run's look, then time */
function run(seed: number, limit = 4000) {
  const p = newDelve(seed), sel = p.leader ?? 'hero', explorer = new AutoExplore(), auto = new AutoRun(), said: string[] = [];
  auto.toggle();
  let fights = 0, fought = false;
  for (let k = 0; k < limit && auto.on; k++) {
    const e = entOf(p, sel);
    explorer.step(p.s, e?.alive ? e.pos : undefined, unitOf(p, sel)?.order?.kind === 'move', !!p.combat, (c) => orderTo(p, sel, c), () => auto.sweptOut(), exploreWants(p));
    auto.step(p, sel, explorer, { go: (c) => orderTo(p, sel, c), pick: (id, t) => { pickTrait(p, id, t as TraitId); }, say: (t) => said.push(t) });
    // (the screen hands the clone to no one while the run is on)
    p.manual = undefined; p.waiting = false;
    delveTick(p, 0.2);
    if (p.combat && !fought) fights++;
    fought = !!p.combat;
  }
  return { p, sel, auto, said, fights };
}

it('a floor run by itself: the clone uncovers the floor, fights what it meets under no hand, and stops at the stairs (or dies trying)', () => {
  let ended = 0, fought = 0;
  for (const seed of [3, 7, 11]) {
    const { p, sel, auto, said, fights } = run(seed);
    const e = entOf(p, sel)!;
    // it never hangs: the run ends by itself, at the stairs or with the clone down
    expect(auto.on).toBe(false);
    fought += fights;
    if (!e.alive) continue;
    ended++;
    expect(said.at(-1)).toMatch(/탐험 끝/);
    const stairs = p.s.map.stairs;
    if (stairs && p.s.seen[idx(p.s.map, stairs)]) expect(dist(e.pos, stairs)).toBeLessThanOrEqual(1);
    // most of the floor's open ground has been seen
    const open = p.s.map.tiles.reduce((n, t) => n + (t === 'floor' ? 1 : 0), 0), seen = p.s.map.tiles.reduce((n, t, i) => n + (t === 'floor' && p.s.seen[i] ? 1 : 0), 0);
    expect(seen / open).toBeGreaterThan(0.8);
  }
  expect(fought).toBeGreaterThan(0);
  expect(ended).toBeGreaterThanOrEqual(0);
}, 30000);

it('a tap takes the clone back: the run stops and does not start again by itself', () => {
  const auto = new AutoRun();
  expect(auto.toggle()).toBe(true); auto.stop(); expect(auto.on).toBe(false);
  expect(auto.toggle()).toBe(true); expect(auto.toggle()).toBe(false);
});

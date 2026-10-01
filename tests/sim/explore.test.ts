import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng';
import { generateExploration, ROOM_HALF } from '../../src/sim/explore/generate';
import { moveTo, chooseExplore, leaveExploration, openChest, useCampfire } from '../../src/sim/explore/progress';
import { roomBattleSetup } from '../../src/sim/explore/roomBattle';
import { newRunV2 } from '../../src/sim/week/week';
import { generateRecruit } from '../../src/sim/roster/generate';
import type { Exploration } from '../../src/sim/explore/types';
import type { RegionCard, RunState } from '../../src/sim/run/types';

const card = (stars: 1 | 2 | 3, rooms = 8): RegionCard => ({ theme: 'dungeon', stars, reward: 'gear', rooms });
const dist = (e: Exploration, from: string) => {
  const d = new Map([[from, 0]]);
  const q = [from];
  while (q.length) { const id = q.shift()!; for (const n of Object.values(e.rooms[id]!.doors)) if (n && !d.has(n)) { d.set(n, d.get(id)! + 1); q.push(n); } }
  return d;
};
const party = (): RunState => {
  const r = newRunV2(6, 'x');
  const rng = createRng(1);
  const used = new Set<string>();
  const extra = [1, 2, 3].map((i) => generateRecruit(rng, { level: 3, usedNames: used, id: `m${i}` }));
  return { ...r, week: 4, roster: { ...r.roster, mercs: [...r.roster.mercs, ...extra], nextId: 4 } };
};

describe('exploration maps', () => {
  for (let seed = 0; seed < 25; seed++) {
    it(`generates a valid map (seed ${seed})`, () => {
      const stars = ((seed % 3) + 1) as 1 | 2 | 3;
      const e = generateExploration(seed, 5, card(stars, 6 + (seed % 5)), ['m0']);
      const rooms = Object.values(e.rooms);
      expect(rooms.length).toBeGreaterThanOrEqual(6);
      expect(rooms.length).toBeLessThanOrEqual(10);
      const start = rooms.find((r) => r.type === 'start')!;
      const d = dist(e, start.id);
      expect(d.size).toBe(rooms.length);
      const exit = rooms.filter((r) => r.type === 'exit');
      expect(exit).toHaveLength(1);
      expect(d.get(exit[0]!.id)!).toBeGreaterThanOrEqual(3);
      if (stars >= 2) expect(rooms.some((r) => r.type === 'elite')).toBe(true);
      for (const r of rooms) for (const [dir, to] of Object.entries(r.doors)) {
        const back = { n: 's', s: 'n', e: 'w', w: 'e' }[dir as 'n']!;
        expect(e.rooms[to!]!.doors[back as 'n']).toBe(r.id);
      }
      for (const r of rooms) for (const p of r.props) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(ROOM_HALF.x - 1);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(ROOM_HALF.y - 1);
        for (const [dir] of Object.entries(r.doors)) {
          const door = { n: [0, -ROOM_HALF.y], s: [0, ROOM_HALF.y], e: [ROOM_HALF.x, 0], w: [-ROOM_HALF.x, 0] }[dir as 'n']!;
          expect(Math.hypot(p.x - door[0]!, p.y - door[1]!)).toBeGreaterThan(4);
        }
      }
    });
  }
  it('enemy count follows min(6, 1 + stars + ceil(week/3))', () => {
    const e = generateExploration(3, 7, card(2), ['m0']);
    const battle = Object.values(e.rooms).find((r) => r.type === 'battle')!;
    expect(battle.enemies).toHaveLength(Math.min(6, 1 + 2 + Math.ceil(7 / 3)));
  });
  it('moving only through doors, recording where we came in', () => {
    const e = generateExploration(4, 3, card(1), ['m0']);
    const start = e.rooms[e.at]!;
    const [dir, next] = Object.entries(start.doors)[0]!;
    const moved = moveTo(e, next!);
    expect(moved.at).toBe(next);
    expect(moved.enteredFrom).toBe({ n: 's', s: 'n', e: 'w', w: 'e' }[dir as 'n']);
    const far = Object.values(e.rooms).find((r) => !Object.values(start.doors).includes(r.id) && r.id !== start.id)!;
    expect(() => moveTo(e, far.id)).toThrow();
  });
  it('room battles spawn allies at the entry door, never inside props or walls', () => {
    for (let seed = 0; seed < 60; seed++) {
      let run = party();
      run = chooseExplore({ ...run, seed }, 1, ['m0', 'm1', 'm2', 'm3']);
      let e = run.exploration!;
      const target = Object.values(e.rooms).find((r) => r.type === 'battle' && Object.values(e.rooms[e.at]!.doors).includes(r.id))
        ?? Object.values(e.rooms).find((r) => r.type === 'battle')!;
      if (Object.values(e.rooms[e.at]!.doors).includes(target.id)) e = moveTo(e, target.id);
      else e = { ...e, at: target.id, enteredFrom: Object.keys(target.doors)[0] as 'n' };
      const setup = roomBattleSetup({ ...run, exploration: e }, target.id, { m0: { col: 2, row: 1 }, m1: { col: 2, row: 2 }, m2: { col: 0, row: 1 }, m3: { col: 1, row: 0 } });
      expect(setup.enemies.length).toBeGreaterThan(0);
      for (const u of [...setup.allies, ...setup.enemies]) {
        expect(Math.abs(u.spawn!.x)).toBeLessThanOrEqual(ROOM_HALF.x - 0.5);
        expect(Math.abs(u.spawn!.y)).toBeLessThanOrEqual(ROOM_HALF.y - 0.5);
        for (const o of setup.obstacles ?? []) expect(Math.hypot(u.spawn!.x - o.pos.x, u.spawn!.y - o.pos.y)).toBeGreaterThan(o.radius + 0.4);
      }
    }
  });
  it('chests, campfires, and leaving give rewards and a report', () => {
    let run = chooseExplore(party(), 0, ['m0', 'm1']);
    const e = run.exploration!;
    const chest = Object.values(e.rooms).find((r) => r.type === 'chest')!;
    run = { ...run, exploration: { ...e, at: chest.id } };
    const opened = openChest(run);
    expect(opened.exploration!.rooms[chest.id]!.done).toBe(true);
    expect(opened.exploration!.loot.items.length + opened.exploration!.loot.gold).toBeGreaterThan(0);
    expect(() => openChest(opened)).toThrow();
    const camp = Object.values(e.rooms).find((r) => r.type === 'campfire');
    if (camp) {
      const hurt = { ...opened, roster: { ...opened.roster, mercs: opened.roster.mercs.map((m) => ({ ...m, injury: 2 })) }, exploration: { ...opened.exploration!, at: camp.id } };
      expect(useCampfire(hurt).roster.mercs.find((m) => m.id === 'm1')!.injury).toBe(1);
    }
    const left = leaveExploration(opened);
    expect(left.phase).toBe('report');
    expect(left.report!.kind).toBe('explore');
    expect(left.exploration).toBeUndefined();
  });
  it('is deterministic and JSON-safe', () => {
    const a = generateExploration(10, 4, card(3), ['m0']);
    expect(a).toEqual(generateExploration(10, 4, card(3), ['m0']));
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
});

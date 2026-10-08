import { describe, expect, it } from 'vitest';
import { makeWeapon } from '../../../src/sim/grid/items';
import { createRng } from '../../../src/core/rng';
import { scaleFoe, spawnKind } from '../../../src/sim/grid/foes';
import { generateMap } from '../../../src/sim/grid/mapgen';
import { distanceMap } from '../../../src/sim/grid/path';
import { FLOORS, nextFloor, XP_STEPS } from '../../../src/sim/grid/run';
import { FOES, idx } from '../../../src/sim/grid/types';
import { BOSS_POWER, isBossFloor, zoneOf } from '../../../src/sim/grid/zones';
import { OPEN, sim, sureHits } from './kit';

const step = { kind: 'move', dir: { x: 1, y: 0 } } as const;

describe('fifteen floors in three zones', () => {
  it('maps the zone boundaries and exactly three boss floors', () => {
    for (const [floor, id, name] of [[1, 'cave', '동굴'], [5, 'cave', '동굴'], [6, 'crypt', '지하 묘지'], [10, 'crypt', '지하 묘지'], [11, 'ruins', '고대 유적'], [15, 'ruins', '고대 유적']] as const) {
      expect(zoneOf(floor)).toMatchObject({ id, name });
    }
    expect(Array.from({ length: 15 }, (_, i) => i + 1).filter(isBossFloor)).toEqual([5, 10, 15]);
  });

  it('puts stairs or a lone champion in the deepest room across seeds and floors', () => {
    for (const seed of [3, 8, 21]) for (let floor = 1; floor <= 15; floor++) {
      const m = generateMap(seed, floor);
      const distances = distanceMap(m, m.start);
      const centers = m.rooms.slice(1).map((r) => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) }));
      const deepest = centers.sort((a, b) => distances[idx(m, b)]! - distances[idx(m, a)]!)[0]!;
      const bosses = m.spawns.filter((f) => f.kind === 'champion');
      if ([5, 10, 15].includes(floor)) {
        expect(m.stairs).toBeUndefined();
        expect(bosses).toHaveLength(1);
        expect(bosses[0]!.pos).toEqual(deepest);
        const room = m.rooms[bosses[0]!.group]!;
        const inside = (c: { x: number; y: number }) => c.x >= room.x && c.x < room.x + room.w && c.y >= room.y && c.y < room.y + room.h;
        expect(m.spawns.filter((f) => inside(f.pos))).toEqual(bosses);
        expect([...m.chests, ...m.barrels!].some(inside)).toBe(false);
      } else {
        expect(m.stairs).toEqual(deepest);
        expect(bosses).toEqual([]);
      }
    }
  });

  it('never generates cave mages and generates ruins mages', () => {
    let mages = 0;
    for (let seed = 1; seed <= 20; seed++) {
      for (let floor = 1; floor <= 5; floor++) expect(generateMap(seed, floor).spawns.some((f) => f.kind === 'mage')).toBe(false);
      for (let floor = 11; floor <= 15; floor++) mages += generateMap(seed, floor).spawns.filter((f) => f.kind === 'mage').length;
    }
    expect(mages).toBeGreaterThan(0);
  }, 30_000);

  it('uses the zone weights with one random draw per spawn', () => {
    for (const [floor, counts] of [[1, [35, 15, 35, 15, 0]], [6, [45, 20, 15, 12, 8]], [11, [20, 30, 10, 20, 20]]] as const) {
      const rng = createRng(1);
      let draws = 0;
      rng.next = () => (draws++ + 0.5) / 100;
      const picks = Array.from({ length: 100 }, () => spawnKind(rng, floor));
      expect(['minion', 'brute', 'ghoul', 'archer', 'mage'].map((kind) => picks.filter((k) => k === kind).length)).toEqual(counts);
      expect(draws).toBe(100);
    }
  });

  it('scales ordinary foes gently and bosses by zone', () => {
    expect(scaleFoe('minion', 11).hp).toBe(39);
    for (const floor of [5, 10, 15] as const) {
      const power = BOSS_POWER[floor];
      expect(scaleFoe('champion', floor)).toEqual({ hp: Math.round(FOES.champion.hp * power), dmg: FOES.champion.dmg.map((d) => Math.round(d * power)), power });
    }
    expect(BOSS_POWER).toEqual({ 5: 1, 10: 1.6, 15: 1.8 });
    expect(scaleFoe('champion', 3).power).toBe(1);
  });

  it.each([5, 10])('opens stairs at the defeated boss on floor %i without winning', (floor) => {
    const g = sim(OPEN, { x: 7, y: 7 }, [{ kind: 'champion', pos: { x: 8, y: 7 } }]);
    g.s.run.floor = floor;
    sureHits(g);
    g.s.foes[0]!.hp = 1;
    const events = g.act(step);
    expect(g.s.map.stairs).toEqual({ x: 8, y: 7 });
    expect(events).toContainEqual({ t: 0, type: 'stairs', to: { x: 8, y: 7 } });
    expect(g.s.outcome).toBeUndefined();
    expect(g.s.run.won).toBe(false);
  });

  it('drops the final core and wins only on pickup, even with a full bag', () => {
    const g = sim(OPEN, { x: 7, y: 7 }, [{ kind: 'champion', pos: { x: 8, y: 7 } }]);
    g.s.run.floor = 15;
    sureHits(g);
    g.s.foes[0]!.hp = 1;
    g.act(step);
    expect(g.s.outcome).toBeUndefined();
    expect(g.s.map.stairs).toBeUndefined();
    expect(g.s.floorItems).toEqual([
      { pos: { x: 8, y: 7 }, item: { kind: 'material', mat: 'remains', n: 3 } },
      { pos: { x: 8, y: 7 }, item: { kind: 'core', name: '에너지원' } },
    ]);
    g.s.hero.gear.bag = Array.from({ length: 20 }, () => makeWeapon('sword', 1));
    const events = g.act(step);
    expect(g.s.outcome).toBe('won');
    expect(g.s.run.won).toBe(true);
    expect(g.s.run.floor).toBe(15);
    expect(g.s.floorItems).toEqual([]);
    expect(events.filter((e) => e.type === 'core' || e.type === 'victory').map((e) => e.type)).toEqual(['core', 'victory']);
    expect(g.act({ kind: 'wait' })).toEqual([]);
  });

  it('continues from floor 14 to 15 and supports fourteen level thresholds', () => {
    const g = sim(OPEN, { x: 7, y: 7 });
    g.s.run.floor = 14;
    nextFloor(g.s);
    expect(g.s.run.floor).toBe(15);
    expect(g.s.foes.filter((f) => f.kind === 'champion')).toHaveLength(1);
    expect(FLOORS).toBe(15);
    expect(XP_STEPS).toEqual([10, 25, 45, 100, 170, 260, 370, 500, 650, 820, 1010, 1220, 1450, 1700]);
  });
});

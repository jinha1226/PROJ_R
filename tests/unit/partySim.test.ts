import { expect, it } from 'vitest';
import { damage, entOf, unitOf } from '../../src/sim/party/partyCore';
import { nextWave, partyRoom, promote, tick } from '../../src/sim/party/partySim';
import { queueSkill, useSkill } from '../../src/sim/party/partySkills';
import type { GEvent } from '../../src/sim/grid/types';

type P = ReturnType<typeof partyRoom>;
const heroesAlive = (p: P) => p.units.filter((u) => u.side === 'hero' && entOf(p, u.id)!.alive).length;
const foesAlive = (p: P) => p.units.filter((u) => u.side === 'foe' && entOf(p, u.id)!.alive);
const run = (p: P, n: number) => { for (let i = 0; i < n && heroesAlive(p) && foesAlive(p).length; i++) tick(p, 0.1); };

it('left alone, the party closes in and fights the first band to an end', () => {
  const p = partyRoom();
  run(p, 900);
  expect(foesAlive(p).length === 0 || heroesAlive(p) === 0).toBe(true);
});

it('the three picked classes and weapons are the party', () => {
  const p = partyRoom([{ cls: 'cleric', weapon: 'symbol' }, { cls: 'rogue', weapon: 'daggers' }, { cls: 'mage', weapon: 'wand' }]);
  expect(p.units.filter((u) => u.side === 'hero').map((u) => [u.id, u.cls, u.weapon])).toEqual([['hero', 'cleric', 'symbol'], ['ally-1', 'rogue', 'daggers'], ['ally-2', 'mage', 'wand']]);
  expect(entOf(p, 'hero')!.maxHp).toBe(50);
});

it('a move order walks the hero there, then it holds that cell and fights from it', () => {
  const p = partyRoom();
  unitOf(p, 'ally-2')!.order = { kind: 'move', cell: { x: 2, y: 8 } };
  for (let i = 0; i < 60; i++) tick(p, 0.1);
  expect(entOf(p, 'ally-2')!.pos).toEqual({ x: 2, y: 8 });
  expect(unitOf(p, 'ally-2')!.order?.kind).toBe('hold');
  for (let i = 0; i < 100 && entOf(p, 'ally-2')!.alive; i++) tick(p, 0.1);
  if (entOf(p, 'ally-2')!.alive) expect(entOf(p, 'ally-2')!.pos).toEqual({ x: 2, y: 8 });
});

it('a skill given while paused waits: nothing happens until time runs, then it goes off on the hero\'s moment', () => {
  const p = partyRoom([{ cls: 'warrior', weapon: 'swordShield' }, { cls: 'archer', weapon: 'longbow' }, { cls: 'cleric', weapon: 'mace' }]);
  for (let i = 0; i < 30; i++) tick(p, 0.1);
  const hurt = entOf(p, 'ally-1')!; hurt.hp = 10;
  queueSkill(p, 'ally-2', 0);
  expect(hurt.hp).toBe(10);
  let healed = false;
  for (let i = 0; i < 30 && !healed; i++) healed = tick(p, 0.1).some((e) => e.type === 'heal' && e.dst === 'ally-1');
  expect(healed).toBe(true);
  expect(useSkill(p, 'ally-2', 0)).toEqual([]);
});

it('a ward soaks up blows before they reach health', () => {
  const p = partyRoom([{ cls: 'cleric', weapon: 'symbol' }, { cls: 'archer', weapon: 'longbow' }, { cls: 'mage', weapon: 'staff' }]);
  useSkill(p, 'hero', 1);
  const archer = unitOf(p, 'ally-1')!;
  expect(archer.shield).toBe(15);
  const hp = entOf(p, 'ally-1')!.hp;
  damage(p, p.time, foesAlive(p)[0]!.id, archer, 10, []);
  expect(entOf(p, 'ally-1')!.hp).toBe(hp);
  expect(archer.shield).toBe(5);
});

it('the shield of a sword-and-board warrior takes a quarter off each blow', () => {
  const p = partyRoom();
  const e = entOf(p, 'hero')!;
  damage(p, 0, foesAlive(p)[0]!.id, unitOf(p, 'hero')!, 8, []);
  expect(e.maxHp - e.hp).toBe(6);
});

it('frost holds a foe in place for a while', () => {
  const p = partyRoom();
  let ev: GEvent[] = [];
  for (let i = 0; i < 100 && !ev.length; i++) { tick(p, 0.1); ev = useSkill(p, 'ally-2', 1); }
  const hit = ev.find((e) => e.type === 'hit')!;
  const foe = unitOf(p, hit.dst!)!;
  expect(foe.frozenUntil).toBeGreaterThan(p.time + 2);
  expect(foe.nextAt).toBeGreaterThanOrEqual(foe.frozenUntil);
});

it('a hidden rogue is not chosen as a target', () => {
  const p = partyRoom([{ cls: 'rogue', weapon: 'daggers' }, { cls: 'archer', weapon: 'longbow' }, { cls: 'mage', weapon: 'staff' }]);
  entOf(p, foesAlive(p)[0]!.id)!.pos = { x: 4, y: 4 };
  useSkill(p, 'hero', 0);
  const ev: GEvent[] = [];
  for (let i = 0; i < 30; i++) ev.push(...tick(p, 0.1));
  expect(ev.some((e) => e.type === 'hit' && e.dst === 'hero')).toBe(false);
});

it('a warrior who keeps killing while badly hurt can become a berserker', () => {
  const p = partyRoom();
  const w = unitOf(p, 'hero')!, e = entOf(p, 'hero')!;
  e.hp = 20;
  const [a, b] = foesAlive(p);
  damage(p, 0, 'hero', a!, 999, []);
  expect(w.promoteReady).toBeFalsy();
  damage(p, 0, 'hero', b!, 999, []);
  expect(w.promoteReady).toBe(true);
  promote(p, 'hero');
  expect(w.cls).toBe('berserker');
  expect(e.maxHp).toBe(85);
  expect(e.hp).toBe(35);
});

it('kills at full health do not count toward berserker', () => {
  const p = partyRoom();
  for (const f of foesAlive(p).slice(0, 3)) damage(p, 0, 'hero', f, 999, []);
  expect(unitOf(p, 'hero')!.promoteReady).toBeFalsy();
  expect(promote(p, 'hero')).toEqual([]);
});

it('the next band comes only once the field is clear, and there are three', () => {
  const p = partyRoom();
  expect(nextWave(p)).toBe(false);
  const clear = () => { for (const f of foesAlive(p)) damage(p, 0, 'x', f, 999, []); };
  clear();
  expect(nextWave(p)).toBe(true);
  expect(foesAlive(p).length).toBe(7);
  clear();
  expect(nextWave(p)).toBe(true);
  clear();
  expect(nextWave(p)).toBe(false);
});

it('a great axe also cuts the foe beside the one it swings at', () => {
  const p = partyRoom([{ cls: 'warrior', weapon: 'greataxe' }, { cls: 'archer', weapon: 'longbow' }, { cls: 'mage', weapon: 'staff' }]);
  const [a, b] = foesAlive(p);
  entOf(p, a!.id)!.pos = { x: 4, y: 4 }; entOf(p, b!.id)!.pos = { x: 4, y: 5 };
  let both = false;
  for (let i = 0; i < 40 && !both; i++) {
    const swing = tick(p, 0.1).filter((e) => e.type === 'hit' && e.src === 'hero');
    both = new Set(swing.map((e) => e.dst)).size >= 2;
  }
  expect(both).toBe(true);
});

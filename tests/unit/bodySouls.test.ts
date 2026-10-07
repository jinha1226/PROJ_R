import { expect, it } from 'vitest';
import { newDelve } from '../../src/sim/delve/delveSim';
import { implant, implantCarried, roamStep, hpNow } from '../../src/sim/roam/roam';
import { entOf, unitOf } from '../../src/sim/party/partyCore';
import { linesOf, soulsOf, memoriesOf } from '../../src/sim/party/body';
import { tagsOf } from '../../src/sim/party/classKit';
import { shiftUnitTimes } from '../../src/sim/roam/carry';
import { CLASSES } from '../../src/sim/party/partyDefs';
import type { GEvent } from '../../src/sim/grid/types';

it('the first soul sets the class; a second adds its line and keeps class and weapon; health is the higher class', () => {
  const p = newDelve(2, 1), u = unitOf(p, 'hero')!;
  implant(p, u, 'mage', []);
  expect([u.cls, u.weapon]).toEqual(['mage', 'staff']);
  implant(p, u, 'warrior', []);
  expect(linesOf(u)).toEqual(['mage', 'warrior']);
  expect([u.cls, u.weapon]).toEqual(['mage', 'staff']);
  expect(entOf(p, 'hero')!.maxHp).toBe(CLASSES.warrior.hp);
});

it('a body takes souls up to its slots: two at first, more once the lab allows', () => {
  const p = newDelve(2, 1);
  p.carried = ['mage', 'warrior', 'archer'];
  implantCarried(p, 'hero', 0); implantCarried(p, 'hero', 0);
  expect(implantCarried(p, 'hero', 0)).toEqual([]);
  expect(p.carried).toEqual(['archer']);
  p.soulSlots = 3;
  expect(implantCarried(p, 'hero', 0).length).toBeGreaterThan(0);
  expect(soulsOf(unitOf(p, 'hero')!)).toHaveLength(3);
});

it('souls go only into a fresh level-1 body that has never been down', () => {
  const p = newDelve(2, 1), u = unitOf(p, 'hero')!;
  p.carried = ['mage', 'warrior'];
  u.level = 2;
  expect(implantCarried(p, 'hero', 0)).toEqual([]);
  u.level = 1; u.wentDown = true;
  expect(implantCarried(p, 'hero', 0)).toEqual([]);
  u.wentDown = undefined;
  expect(implantCarried(p, 'hero', 0).length).toBeGreaterThan(0);
});

it('every soul brings its memory: both count as tags', () => {
  const p = newDelve(2, 1), u = unitOf(p, 'hero')!;
  implant(p, u, { cls: 'mage', memory: 'burnt' }, []);
  implant(p, u, { cls: 'warrior', memory: 'frostGrave' }, []);
  expect(memoriesOf(u)).toEqual(['burnt', 'frostGrave']);
  const tags = tagsOf(u);
  expect(tags.화염).toBeGreaterThanOrEqual(1);
  expect(tags.냉기).toBeGreaterThanOrEqual(1);
});

it('a fallen body loses every soul in it', () => {
  const p = newDelve(2, 1), u = unitOf(p, 'hero')!;
  implant(p, u, 'mage', []); implant(p, u, 'warrior', []);
  entOf(p, 'hero')!.alive = false;
  const ev: GEvent[] = [];
  roamStep(p, hpNow(p), ev);
  expect(soulsOf(u)).toEqual([]);
  expect(ev.some((e) => e.text === 'soulLost')).toBe(true);
});

it('time shifts move every soul ultimate with the unit', () => {
  const p = newDelve(2, 1), u = unitOf(p, 'hero')!;
  implant(p, u, 'mage', []); implant(p, u, 'warrior', []);
  u.souls![1]!.ultReady = 40;
  shiftUnitTimes(u, -30);
  expect(u.souls![1]!.ultReady).toBe(10);
});

import { expect, it } from 'vitest';
import { applyStatus } from '../../src/sim/party/status';
import { entOf } from '../../src/sim/party/partyCore';
import { addShield, SHIELD_CAP } from '../../src/sim/party/shield';
import { counter, foesNear, mostHurt, restore, stepBehind } from '../../src/sim/party/cardFx';
import { scene, put } from './support/cardScene';

it('burn and chill make steam: the foes round are blinded and hurt, both states gone', () => {
  const { p, u, foes } = scene('mage'); const [a, b] = foes; put(p, a!, 6, 4); put(p, b!, 7, 4);
  const ev: { type: string; text?: string }[] = [];
  applyStatus(p, u, a!, 'burn', 0, ev as never); applyStatus(p, u, a!, 'chill', 0, ev as never);
  expect(ev.some((e) => e.type === 'react' && e.text === '증기')).toBe(true);
  expect((b!.blindUntil ?? 0) > 0).toBe(true); expect(entOf(p, b!.id)!.hp).toBeLessThan(200);
  expect(a!.status.burn).toBeUndefined(); expect(a!.status.chill).toBeUndefined();
});

it('burn and shock overload; chill and shock leave the foe exposed', () => {
  const { p, u, foes } = scene('mage'); const [a, b] = foes; put(p, a!, 6, 4); put(p, b!, 6, 5);
  const ev: never[] = [];
  applyStatus(p, u, a!, 'burn', 0, ev); applyStatus(p, u, a!, 'shock', 0, ev);
  expect(entOf(p, b!.id)!.hp).toBe(190);
  applyStatus(p, u, b!, 'chill', 0, ev); applyStatus(p, u, b!, 'shock', 0, ev);
  expect((b!.status.exposed?.until ?? 0) > 0).toBe(true);
});

it('every reaction is an event effects can hang on', () => {
  const { p, u, foes } = scene('mage'); const [a] = foes; put(p, a!, 6, 4);
  const seen: string[] = [];
  u.triggers = [{ id: 'r', when: 'reaction', run: (_p, c) => { seen.push(c.reaction ?? ''); u.nth++; } }];
  applyStatus(p, u, a!, 'burn', 0, []); applyStatus(p, u, a!, 'poison', 0, []);
  expect(seen).toContain('독연 폭발');
});

it('shields now hold up to sixty', () => {
  const { u } = scene(); addShield(u, 100); expect(u.shield).toBe(SHIELD_CAP); expect(SHIELD_CAP).toBe(60);
});

it('helpers: foes near a cell, a counter blow, stepping behind a foe, restoring health, the most hurt ally', () => {
  const { p, u, foes } = scene('warrior'); const [a, b] = foes; put(p, a!, 5, 4, 999); put(p, b!, 9, 9);
  expect(foesNear(p, { x: 4, y: 4 }, 1).map((f) => f.id)).toEqual([a!.id]);
  const seen: string[] = []; u.triggers = [{ id: 'c', when: 'counter', run: () => { seen.push('counter'); u.nth++; } }];
  p.s.rng.chance = () => true; counter(p, u, a!, 0, []);
  expect(seen).toEqual(['counter']); expect(entOf(p, a!.id)!.hp).toBeLessThan(999);
  expect(stepBehind(p, u, b!, 1, [])).toBe(true); expect(Math.max(Math.abs(entOf(p, u.id)!.pos.x - 9), Math.abs(entOf(p, u.id)!.pos.y - 9))).toBe(1);
  const e = entOf(p, u.id)!; e.hp = 5; restore(p, u, 10); expect(e.hp).toBe(15);
  expect(mostHurt(p)?.id).toBe(u.id);
});

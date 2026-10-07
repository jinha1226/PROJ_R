import { expect, it } from 'vitest';
import { damage, entOf } from '../../src/sim/party/partyCore';
import { scene, put } from './support/cardScene';

it('two blows taken within a turn set off the whirlwind: every foe within four cells is cut', () => {
  const { p, u, foes } = scene('warrior'); u.weapon = 'greataxe'; u.gear = undefined;
  const [a, b, c, far] = foes; put(p, a!, 5, 4); put(p, b!, 4, 6); put(p, c!, 8, 4); put(p, far!, 12, 4);
  const ev: { type: string; text?: string }[] = [];
  damage(p, 0, a!.id, u, 2, ev as never, false, false, 'physical', true);
  expect(ev.some((e) => e.text === '회오리 베기')).toBe(false);
  damage(p, 0.5, b!.id, u, 2, ev as never, false, false, 'physical', true);
  expect(ev.filter((e) => e.text === '회오리 베기')).toHaveLength(1);
  for (const f of [a, b, c]) expect(entOf(p, f!.id)!.hp, f!.id).toBeLessThan(200);
  expect(entOf(p, far!.id)!.hp).toBe(200);
});

it('blows a turn apart do not count together, and the whirlwind turns once a turn', () => {
  const { p, u, foes } = scene('warrior'); u.weapon = 'greataxe'; u.gear = undefined;
  const [a] = foes; put(p, a!, 5, 4, 999);
  const ev: { type: string; text?: string }[] = [];
  damage(p, 0, a!.id, u, 1, ev as never, false, false, 'physical', true); damage(p, 1.5, a!.id, u, 1, ev as never, false, false, 'physical', true);
  expect(ev.filter((e) => e.text === '회오리 베기')).toHaveLength(0);
  damage(p, 1.8, a!.id, u, 1, ev as never, false, false, 'physical', true); damage(p, 2.0, a!.id, u, 1, ev as never, false, false, 'physical', true);
  expect(ev.filter((e) => e.text === '회오리 베기')).toHaveLength(1);
});

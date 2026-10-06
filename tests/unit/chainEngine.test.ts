import { expect, it } from 'vitest';
import { action, emit, CHAIN_CAP, type TriggerDef } from '../../src/sim/party/triggers';
import { damage, entOf } from '../../src/sim/party/partyCore';
import { scene, put } from './support/cardScene';

it('a chain stops at twelve effects in one action', () => {
  const { p, u } = scene();
  let n = 0;
  u.triggers = Array.from({ length: 20 }, (_, i): TriggerDef => ({ id: `t${i}`, when: 'hit', run: () => { n++; u.shield = n; } }));
  action(p, () => emit(p, 'hit', { t: 0, src: u, ev: [] }));
  expect(CHAIN_CAP).toBe(12); expect(n).toBe(12);
});

it('the same effect fires once per chain unless it repeats', () => {
  const { p, u } = scene();
  let once = 0, again = 0;
  u.triggers = [
    { id: 'once', when: 'hit', run: (pp, c) => { once++; u.shield = once + again; emit(pp, 'hit', c); } },
    { id: 'again', when: 'kill', repeat: true, run: (pp, c) => { again++; u.shield = once + again; if (again < 3) emit(pp, 'kill', c); } },
  ];
  action(p, () => { emit(p, 'hit', { t: 0, src: u, ev: [] }); emit(p, 'kill', { t: 0, src: u, ev: [] }); });
  expect(once).toBe(1); expect(again).toBe(3);
});

it('three or more effects in one action leave a chain event with the count', () => {
  const { p, u } = scene();
  u.triggers = ['a', 'b', 'c'].map((id, i): TriggerDef => ({ id, when: 'hit', run: () => { u.shield = i + 1; } }));
  const ev: { type: string; text?: string; amount?: number }[] = [];
  action(p, () => emit(p, 'hit', { t: 0, src: u, ev: ev as never }));
  expect(ev.find((e) => e.text === 'chain')?.amount).toBe(3);
});

it('a broken shield, a fallen summon and the overkill of a kill are events effects can hang on', () => {
  const { p, u, foes } = scene(); const [a] = foes; put(p, a!, 5, 4, 10);
  const seen: string[] = [];
  u.triggers = [
    { id: 'sb', when: 'shieldBreak', run: () => { seen.push('shieldBreak'); u.nth += 1; } },
    { id: 'k', when: 'kill', run: (_p, c) => { seen.push(`over${c.over}`); u.nth += 1; } },
  ];
  u.shield = 5; damage(p, 0, a!.id, u, 8, []);
  damage(p, 0, u.id, a!, 25, []);
  expect(seen).toContain('shieldBreak'); expect(seen).toContain('over15');
  expect(entOf(p, u.id)!.alive).toBe(true);
});

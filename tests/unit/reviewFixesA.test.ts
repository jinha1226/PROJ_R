import { expect, it, vi } from 'vitest';
import { damage, entOf, strike } from '../../src/sim/party/partyCore';
import { action } from '../../src/sim/party/triggers';
import { heal } from '../../src/sim/party/kitEffects';
import { applyStatus } from '../../src/sim/party/status';
import { HERO_SOULS } from '../../src/sim/delve/heroSouls';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { scene, put } from './support/cardScene';

it('a card fires again for each heal, strike and kill in one action, not only the first', () => {
  const { p, u, foes } = scene('cleric'); const [a, b] = foes; put(p, a!, 5, 4, 999); put(p, b!, 6, 4, 999);
  const o = p.units.find((v) => v.side === 'hero' && v !== u)!; o.cls = 'warrior'; entOf(p, o.id)!.alive = true; entOf(p, o.id)!.pos = { x: 1, y: 1 };
  u.traits = { overflowGrace: 1, envenom: 1 }; u.shield = 0; o.shield = 0;
  action(p, () => { heal(p, u, u, 999, 0, []); heal(p, u, o, 999, 0, []); });
  expect(u.shield).toBeGreaterThan(0); expect(o.shield).toBeGreaterThan(0);
  p.s.rng.chance = () => true;
  action(p, () => { strike(p, u, a!, 0, [], 1, false); strike(p, u, b!, 0, [], 1, false); });
  expect(a!.status.poison?.stacks).toBe(1); expect(b!.status.poison?.stacks).toBe(1);
});

it('combo\'s extra blow does not rob the main blow of its bonuses', () => {
  const run = (combo: boolean) => {
    const { p, u, foes } = scene('rogue'); u.weapon = 'daggers'; u.gear = undefined; const [a] = foes; put(p, a!, 5, 4, 9999);
    applyStatus(p, u, a!, 'poison', 0, []); applyStatus(p, u, a!, 'bleed', 0, []);
    u.traits = combo ? { vitals: 1, combo: 1 } : { vitals: 1 }; u.nth = 2; p.s.rng.chance = () => true; p.s.rng.int = () => 10; a!.order = { kind: 'attack', target: u.id };
    const ev: { type: string; dst?: string; amount?: number }[] = [];
    strike(p, u, a!, 0.1, ev as never);
    return ev.filter((e) => e.type === 'hit' && e.dst === a!.id).map((e) => e.amount!);
  };
  const plain = run(false)[0]!, both = run(true);
  expect(Math.max(...both)).toBeGreaterThanOrEqual(plain);
});

it('hero souls come with real cards', () => {
  for (const h of Object.values(HERO_SOULS)) { const ids = Object.keys(h.traits); expect(ids.length).toBeGreaterThan(0); for (const id of ids) expect(TRAITS[id], id).toBeDefined(); }
});

it('every card module can be the first thing imported', async () => {
  for (const m of ['cardsCommon', 'cardsMelee', 'cardsRanged', 'cardsSupport', 'memories', 'resonance']) {
    vi.resetModules();
    await expect(import(`../../src/sim/party/${m}.ts`), m).resolves.toBeDefined();
  }
});

it('a negating effect stops a killing blow too', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 5, 4);
  u.memory = 'shieldKeeper'; u.keeperUsed = false; const e = entOf(p, u.id)!;
  damage(p, 0, a!.id, u, 9999, []);
  expect(e.alive).toBe(true); expect(e.hp).toBe(e.maxHp);
  const q = scene('warrior'); const [f] = q.foes; put(q.p, f!, 5, 4, 999);
  q.u.traits = { lastStand: 2 }; const qe = entOf(q.p, q.u.id)!; qe.hp = 10; q.p.s.rng.chance = () => true;
  damage(q.p, 0, f!.id, q.u, 9999, []);
  expect(qe.alive).toBe(true); expect(qe.hp).toBe(10);
});

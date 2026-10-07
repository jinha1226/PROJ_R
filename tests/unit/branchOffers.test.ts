import { expect, it } from 'vitest';
import { newDelve } from '../../src/sim/delve/delveSim';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { unitOf } from '../../src/sim/party/partyCore';
import { rollOffer } from '../../src/sim/party/traitPool';
import { rerollOffer, gainXp, LEVEL_XP, REROLLS_PER_RUN } from '../../src/sim/party/partyLevel';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { implant, print } from '../../src/sim/roam/roam';
import { takeClone } from '../../src/sim/roam/carry';

it('the first level-up of the empty body offers exactly its three signatures', () => {
  const p = newDelve(5, 1), u = unitOf(p, 'hero')!;
  u.level = 2;
  for (let i = 0; i < 10; i++) expect(rollOffer(p, u).sort()).toEqual(['grenade', 'pierceRound', 'returnFire']);
});

it('a line with no branch cards yet still gets its cards on the first pick', () => {
  const p = newDelve(5, 1), u = unitOf(p, 'hero')!;
  implant(p, u, 'warrior', []); implant(p, u, 'mage', []);
  u.level = 2;
  for (let i = 0; i < 10; i++) {
    const pools = rollOffer(p, u).map((id) => TRAITS[id]!.pool);
    expect(pools).toContain('warrior'); expect(pools).toContain('mage');
  }
});

it('after a signature, every offer has a card of its branch while one is left, and that branch comes up more often', () => {
  const p = newDelve(5, 1), u = unitOf(p, 'hero')!;
  u.level = 5; u.traits = { grenade: 1 };
  let blast = 0, suit = 0;
  for (let i = 0; i < 400; i++) {
    const o = rollOffer(p, u);
    if (i < 40) expect(o.some((id) => TRAITS[id]!.branch === 'shell:blast')).toBe(true);
    blast += o.filter((id) => TRAITS[id]!.branch === 'shell:blast').length;
    suit += o.filter((id) => TRAITS[id]!.branch === 'shell:suit').length;
  }
  expect(blast).toBeGreaterThanOrEqual(suit * 2);
});

it('a reroll draws a fresh offer for the same pick, two a run', () => {
  const p = newDelve(5, 1), u = unitOf(p, 'hero')!;
  u.traits = { grenade: 1 }; gainXp(p, u, LEVEL_XP[4]!, []);
  u.rerolls = REROLLS_PER_RUN;
  const seen = new Set([u.offer!.join()]);
  expect(rerollOffer(p, 'hero').length).toBeGreaterThan(0); seen.add(u.offer!.join());
  expect(rerollOffer(p, 'hero').length).toBeGreaterThan(0); seen.add(u.offer!.join());
  expect(u.rerolls).toBe(0);
  expect(rerollOffer(p, 'hero')).toEqual([]);
  expect(seen.size).toBeGreaterThan(1);
});

it('a clone leaving for a run carries two rerolls', () => {
  const p = newSurface(3), b = print(p, undefined, [], p.drill!)!;
  expect(takeClone(p, b.id).clones[0]!.unit.rerolls).toBe(REROLLS_PER_RUN);
  expect(REROLLS_PER_RUN).toBe(2);
});

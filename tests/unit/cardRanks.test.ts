import { expect, it } from 'vitest';
import { damage, entOf, strike } from '../../src/sim/party/partyCore';
import { action } from '../../src/sim/party/triggers';
import { applyStatus } from '../../src/sim/party/status';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { traitText, upText } from '../../src/sim/party/traitText';
import { ampBase } from '../../src/sim/party/traitTypes';
import { rollOffer } from '../../src/sim/party/traitPool';
import { whirlwind } from '../../src/sim/party/cardsWarrior';
import { classScene } from './support/classScene';
import { newDelve } from '../../src/sim/delve/delveSim';
import { unitOf } from '../../src/sim/party/partyCore';

/** the lines whose cards already follow the rank rule (the rest join in later tasks) */
const RANKED = ['shell', 'warrior'];

it.each(RANKED)('%s: signature and law cards have three ranks, convert and amp cards two, each with its texts', (line) => {
  const cards = Object.values(TRAITS).filter((d) => d.pool === line && d.branch);
  expect(cards).toHaveLength(12);
  for (const d of cards) {
    const want = d.kind === 'law' ? 3 : 2;
    expect(d.ranks, d.id).toBe(want);
    expect(d.up, d.id).toBeTruthy();
    if (want === 3) expect(d.up3, d.id).toBeTruthy();
  }
});

it('the text shows each rank reached, and the next rank’s text is what an offer shows', () => {
  const d = TRAITS.bladeStorm!;
  expect(traitText('bladeStorm', 3)).toContain(d.up3!);
  expect(upText(d, 1)).toBe(d.up); expect(upText(d, 2)).toBe(d.up3);
});

it('a card at its top rank is never offered again', () => {
  const p = newDelve(5, 1), u = unitOf(p, 'hero')!;
  u.cls = 'warrior'; u.souls = [{ cls: 'warrior', level: 5, ultReady: 0 }] as never; u.level = 5;
  u.traits = { bladeStorm: 3, bloodVortex: 3, rendWounds: 2, bladeAmp: 2 };
  for (let k = 0; k < 40; k++) { const o = rollOffer(p, u); for (const id of ['bladeStorm', 'bloodVortex', 'rendWounds', 'bladeAmp']) expect(o).not.toContain(id); }
});

it('an amp at rank 2 adds 0.04 to its base', () => {
  const { u } = classScene('warrior'); u.traits = { bladeAmp: 1 };
  expect(ampBase(u, 'bladeAmp', 1.12)).toBeCloseTo(1.12); u.traits.bladeAmp = 2; expect(ampBase(u, 'bladeAmp', 1.12)).toBeCloseTo(1.16);
});

// the empty body
it('pierce round 3: a foe killed by the pierce gives a round back', () => {
  const { p, u, put } = classScene('shell'); u.traits = { pierceRound: 3 }; u.hitStreak = 5; u.ammo = 2;
  const a = put(0, 7, 6), b = put(1, 9, 6, 1);
  strike(p, u, a, 1, []);
  expect(entOf(p, b.id)!.alive).toBe(false); expect(u.ammo).toBe(2);
});

it('quick reload 3: a kill flashes, stunning the foes within two', () => {
  const { p, u, put } = classScene('shell'); u.traits = { quickReload: 3 };
  const a = put(0, 5, 6, 1), b = put(1, 6, 7);
  action(p, () => damage(p, 1, u.id, a, 99, [], true));
  expect((b.status.stun?.until ?? 0) > 1).toBe(true);
});

it('target lock 2: a miss makes the next two shots critical', () => {
  const { p, u, put } = classScene('shell'); u.traits = { targetLock: 2 };
  const a = put(0, 8, 6); p.s.rng.chance = () => false;
  strike(p, u, a, 1, []);
  expect(u.nextCrit).toBe(true); expect(u.critShots).toBe(1);
});

it('grenade 3: the grenade leaves burning ground for two turns', () => {
  const { p, u, put } = classScene('shell'); u.traits = { grenade: 3 }; u.nth = 2;
  const a = put(0, 8, 6);
  strike(p, u, a, 1, []);
  expect(p.grounds?.some((g) => g.by === u.id && g.until === 3)).toBe(true);
});

it('overheat 3: a burning foe that dies bursts', () => {
  const { p, u, put, hp } = classScene('shell'); u.traits = { overheat: 3 };
  const a = put(0, 8, 6, 1), b = put(1, 9, 6);
  applyStatus(p, u, a, 'burn', 0, []);
  action(p, () => damage(p, 1, u.id, a, 99, [], true));
  expect(hp(b)).toBeLessThan(999);
});

it('chain blast 2: the small blast reaches two cells', () => {
  const { p, u, put, hp } = classScene('shell'); u.traits = { chainBlast: 2 };
  const a = put(0, 8, 6, 1), b = put(1, 10, 6);
  action(p, () => damage(p, 1, u.id, a, 99, [], true, false, 'fire'));
  expect(hp(b)).toBeLessThan(999);
});

it('return fire 3: a critical return shot pierces to the foe behind', () => {
  const { p, u, put, hp } = classScene('shell'); u.traits = { returnFire: 3 };
  const a = put(0, 7, 6), b = put(1, 9, 6);
  action(p, () => damage(p, 1, a.id, u, 1, [], false, false, 'physical', true));
  expect(hp(b)).toBeLessThan(999);
});

it('suit overload 3: a kill while overloaded gives a shield of ten', () => {
  const { p, u, put } = classScene('shell'); u.traits = { suitOverload: 3 }; u.hasteUntil = 5; u.shield = 0;
  const a = put(0, 6, 6, 1);
  action(p, () => damage(p, 1, u.id, a, 99, [], true));
  expect(u.shield).toBe(10);
});

// the warrior
it('blade storm 3: when the spin ends one last whirlwind goes round', () => {
  const { u, put, hp, fire } = classScene('warrior'); u.traits = { bladeStorm: 3 }; u.spinUntil = 2;
  const a = put(0, 6, 6);
  fire('turn', 3);
  expect(hp(a)).toBeLessThan(999); expect(u.spinUntil ?? 0).toBeLessThanOrEqual(3);
});

it('blood vortex 3: the foes the vortex cuts bleed two deep', () => {
  const { p, u, put } = classScene('warrior'); u.traits = { bloodVortex: 3 };
  const a = put(0, 9, 6, 1), b = put(1, 10, 7);
  applyStatus(p, u, a, 'bleed', 0, []);
  action(p, () => damage(p, 1, u.id, a, 99, [], true));
  expect(b.status.bleed?.stacks).toBe(2);
});

it('frenzy 3: at the top of the frenzy every attack strikes three times', () => {
  const run = (r: number) => { const s = classScene('warrior'); s.u.traits = { frenzy: r }; s.u.frenzy = 8; s.u.frenzyAt = 0; const f = s.put(0, 5, 6, 99999); strike(s.p, s.u, f, 1, []); return 99999 - s.hp(f); };
  expect(run(3)).toBeGreaterThan(run(2) * 1.3);
});

it('carnage 3: the carnage blow is always critical', () => {
  const { p, u, put, hp } = classScene('warrior'); u.traits = { carnage: 3 }; u.frenzy = 5;
  const a = put(0, 5, 6, 1), b = put(1, 5, 7);
  p.s.rng.chance = (c) => c >= 0.5;
  let crits = 0; u.triggers = [{ id: 'spy', when: 'crit', repeat: true, run: () => { crits++; } }];
  action(p, () => damage(p, 1, u.id, a, 99, [], true));
  expect(hp(b)).toBeLessThan(999); expect(crits).toBe(1);
});

it('berserk 2 adds eight percent per stack; iron counter 2 stuns half the time', () => {
  const { u } = classScene('warrior'); u.frenzy = 5;
  expect(TRAITS.berserk!.passive!(u, 2).crit).toBeCloseTo(0.4);
  expect(TRAITS.ironCounter!.trigger!(2).chance).toBe(0.5);
});

it('war shout 3: what the shout stuns is left exposed', () => {
  const { u, put, fire } = classScene('warrior'); u.traits = { warShout: 3 }; u.shoutUntil = 5;
  const a = put(0, 6, 6);
  fire('turn', 1);
  expect((a.status.exposed?.until ?? 0) > 1).toBe(true);
});

it('rage 3: struck with full rage, the warrior spins a whirlwind', () => {
  const { p, u, put, hp } = classScene('warrior'); u.traits = { rage: 3 }; u.rage = 5;
  const a = put(0, 5, 6), b = put(1, 7, 8);
  action(p, () => damage(p, 1, a.id, u, 1, [], false, false, 'physical', true));
  expect(hp(b)).toBeLessThan(999);
});

it('whirlwinds still start the spin at rank 3', () => {
  const { p, u } = classScene('warrior'); u.traits = { bladeStorm: 3 };
  action(p, () => whirlwind(p, u, 1, [])); expect(u.spinUntil).toBe(3);
});

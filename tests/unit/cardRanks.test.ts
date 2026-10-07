import { expect, it } from 'vitest';
import { damage, entOf, strike } from '../../src/sim/party/partyCore';
import { action } from '../../src/sim/party/triggers';
import { applyStatus } from '../../src/sim/party/status';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { traitText, upText } from '../../src/sim/party/traitText';
import { ampBase } from '../../src/sim/party/traitTypes';
import { rollOffer } from '../../src/sim/party/traitPool';
import { whirlwind } from '../../src/sim/party/cardsWarrior';
import { tickSnares, laySnare } from '../../src/sim/party/snares';
import { summon } from '../../src/sim/party/kitEffects';
import type { GEvent } from '../../src/sim/grid/types';
import { classScene } from './support/classScene';
import { traitMult } from '../../src/sim/party/traitCombat';
import { newDelve } from '../../src/sim/delve/delveSim';
import { unitOf } from '../../src/sim/party/partyCore';

/** the lines whose cards already follow the rank rule (the rest join in later tasks) */
const RANKED = ['shell', 'warrior', 'mage', 'necromancer', 'rogue', 'archer'];

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

// the mage
it('meteor 3: a meteor stuns what it hits', () => {
  const { p, u, put, fire } = classScene('mage'); u.traits = { meteor: 3 };
  const a = put(0, 10, 6); applyStatus(p, u, a, 'burn', 0, []);
  fire('turn', 1);
  expect((a.status.stun?.until ?? 0) > 1).toBe(true);
});

it('fireball 3: a fireball on a burning foe throws another at the nearest foe', () => {
  const { p, u, put, hp, fire } = classScene('mage'); u.traits = { fireball: 3 }; u.nth = 2;
  const a = put(0, 8, 6), b = put(1, 11, 6); applyStatus(p, u, a, 'burn', 0, []);
  fire('hit', 1, { target: a, basic: true });
  expect(hp(b)).toBeLessThan(999);
});

it('fire spread 2: the burn spreads two cells', () => {
  const { p, u, put } = classScene('mage'); u.traits = { fireSpread: 2 };
  const a = put(0, 8, 6, 1), b = put(1, 10, 6);
  action(p, () => damage(p, 1, u.id, a, 99, [], true, false, 'fire'));
  expect((b.status.burn?.until ?? 0) > 1).toBe(true);
});

it('blizzard 3: a frozen foe dying in the blizzard bursts in ice shards', () => {
  const { p, u, put, hp } = classScene('mage'); u.traits = { blizzard: 3 }; u.anchor = { x: 4, y: 6 }; u.anchorAt = 0;
  const a = put(0, 5, 6, 1), b = put(1, 6, 7); a.status.freeze = { until: 9 };
  action(p, () => damage(p, 3, u.id, a, 99, [], true));
  expect(hp(b)).toBeLessThan(999);
});

it('frost ring 3: the ring gives a shield of ten', () => {
  const { u, put, fire } = classScene('mage'); u.traits = { frostRing: 3 }; u.shield = 0;
  const a = put(0, 5, 6);
  fire('struck', 1, { target: a });
  expect(u.shield).toBe(10);
});

it('chain lightning 3: a kill by the leaping lightning sends it leaping again that turn', () => {
  const run = (r: number) => {
    const s = classScene('mage'); s.u.traits = { chainLightning: r };
    const a = s.put(0, 8, 6), c = s.put(2, 10, 6); s.put(1, 9, 6, 1);
    applyStatus(s.p, s.u, a, 'shock', 0, []);
    s.fire('turn', 1); return 999 - s.hp(c);
  };
  expect(run(3)).toBeGreaterThan(run(2));
});

it('static field 3: what the field hits is shocked', () => {
  const { u, put, fire } = classScene('mage'); u.traits = { staticField: 3 };
  const a = put(0, 5, 6), b = put(1, 6, 7);
  fire('hit', 1, { target: a });
  expect((b.status.shock?.until ?? 0) > 1).toBe(true);
});

it('overcurrent 2: the shock passes to two foes beside', () => {
  const { p, u, put, fire } = classScene('mage'); u.traits = { overcurrent: 2 }; u.cycle = 2;
  const a = put(0, 7, 6), b = put(1, 8, 6), c = put(2, 7, 7);
  applyStatus(p, u, a, 'shock', 0, []);
  fire('hit', 1, { target: a });
  expect((b.status.shock?.until ?? 0) > 1 && (c.status.shock?.until ?? 0) > 1).toBe(true);
});

// the necromancer
it('bone spear 3: what the spear runs through is left exposed', () => {
  const { p, u, put } = classScene('necromancer'); u.traits = { boneSpear: 3 };
  const a = put(0, 7, 6), b = put(1, 9, 6);
  strike(p, u, a, 0, []);
  expect((b.status.exposed?.until ?? 0) > 0).toBe(true);
});

it('bone prison 3: it closes at the fight’s start as well', () => {
  const { u, put, fire } = classScene('necromancer'); u.traits = { bonePrison: 3 };
  const a = put(0, 6, 6);
  fire('combatStart', 0);
  expect((a.status.stun?.until ?? 0) > 0).toBe(true);
});

it('bone armour 2: a third and more of the harm becomes bone shards', () => {
  const { u, fire } = classScene('necromancer'); u.traits = { boneArmor: 2 }; u.shield = 0;
  fire('damaged', 1, { amount: 100 });
  expect(u.shield).toBe(35);
});

it('raise skeleton 3: a skeleton that falls bursts where it fell', () => {
  const { p, u, put, hp } = classScene('necromancer'); u.traits = { raiseSkeleton: 3 };
  const a = put(0, 9, 6);
  expect(summon(p, u, { x: 8, y: 6 }, 0, [])).toBe(true);
  const sk = p.units[p.units.length - 1]!;
  entOf(p, sk.id)!.pos = { x: 8, y: 6 };
  action(p, () => damage(p, 1, a.id, sk, 999, []));
  expect(hp(a)).toBeLessThan(999);
});

it('grasp of the dead 3: the bodies it leaves hold the foes beside them a turn', () => {
  const { p, u, put } = classScene('necromancer'); u.traits = { deadGrasp: 3 };
  const a = put(0, 9, 6);
  expect(summon(p, u, { x: 8, y: 6 }, 0, [])).toBe(true);
  const sk = p.units[p.units.length - 1]!; entOf(p, sk.id)!.pos = { x: 8, y: 6 };
  action(p, () => damage(p, 1, 'trap', sk, 999, []));
  expect((a.status.stun?.until ?? 0) > 1).toBe(true);
});

it('soul link 2: nearly half the harm goes to the minion', () => {
  const { p, u } = classScene('necromancer'); u.traits = { soulLink: 2 }; u.gear!.armor = null;
  expect(summon(p, u, { x: 4, y: 6 }, 0, [], 2, { hp: 500 })).toBe(true);
  const sk = p.units[p.units.length - 1]!, e = entOf(p, 'hero')!; e.hp = e.maxHp = 1000;
  damage(p, 3, 'trap', u, 100, [], true);
  expect(500 - entOf(p, sk.id)!.hp).toBe(45);
});

it('poison nova 3: the foes in its cloud are cursed', () => {
  const { p, u, put, fire } = classScene('necromancer'); u.traits = { poisonNova: 3 };
  const a = put(0, 9, 6);
  p.grounds = [{ at: { x: 8, y: 6 }, by: u.id, until: 5, next: 2, kind: 'poison', r: 2 }];
  fire('turn', 1);
  expect((a.cursedUntil ?? 0) > 1).toBe(true);
});

it('curse 3: a cursed foe dying poisons the foes beside it three deep', () => {
  const { p, u, put } = classScene('necromancer'); u.traits = { curse: 3 };
  const a = put(0, 9, 6, 1), b = put(1, 10, 6); a.cursedUntil = 9;
  action(p, () => damage(p, 1, u.id, a, 99, [], true));
  expect(b.status.poison?.stacks).toBe(3);
});

it('poison burst 2: the burst spreads four stacks', () => {
  const { p, u, put } = classScene('necromancer'); u.traits = { poisonBurst: 2 };
  const a = put(0, 9, 6), b = put(1, 10, 6);
  action(p, () => applyStatus(p, u, a, 'poison', 0, [], 5));
  expect(b.status.poison?.stacks).toBe(4);
});

// the rogue
it('lightning trap 3: the trap strikes the foes beside it too', () => {
  const { p, u, put, hp } = classScene('rogue'); u.traits = { lightningTrap: 3 };
  put(0, 9, 9); const b = put(1, 10, 9);
  laySnare(p, u, { x: 9, y: 9 }, 'bolt', 0, []); tickSnares(p, 1, []);
  expect(hp(b)).toBeLessThan(999);
});

it('fire trap 3: the trap leaves burning ground for two turns', () => {
  const { p, u, put } = classScene('rogue'); u.traits = { fireTrap: 3 };
  put(0, 9, 9);
  laySnare(p, u, { x: 9, y: 9 }, 'fire', 0, []); tickSnares(p, 1, []);
  expect(p.grounds?.some((g) => g.by === u.id && g.until === 3)).toBe(true);
});

it('chain detonation 2: a trap set off by another hits half again as hard', () => {
  const run = (r: number) => {
    const s = classScene('rogue'); s.u.traits = { chainDetonate: r };
    s.put(0, 9, 9); const b = s.put(1, 11, 9);
    laySnare(s.p, s.u, { x: 9, y: 9 }, 'bolt', 0, []); laySnare(s.p, s.u, { x: 11, y: 9 }, 'bolt', 0, []);
    s.p.snares![1]!.ready = 5;
    tickSnares(s.p, 1, []); return 999 - s.hp(b);
  };
  expect(run(2)).toBeGreaterThan(run(1) * 1.3);
});

it('charge-up 3: with full ki the shockwave reaches two cells', () => {
  const { p, u, put, hp } = classScene('rogue'); u.traits = { chargeUp: 3 }; u.ki = 5;
  const a = put(0, 5, 6), b = put(1, 6, 8);
  strike(p, u, a, 1, []);
  expect(hp(b)).toBeLessThan(999);
});

it('finishing blow 3: the burst reaches two cells', () => {
  const { p, u, put, hp } = classScene('rogue'); u.traits = { finisher: 3 }; u.ki = 3;
  const a = put(0, 5, 6, 5000), b = put(1, 7, 6);
  strike(p, u, a, 1, []);
  expect(hp(b)).toBeLessThan(999);
});

it('dragon claw 2: a finishing kill gives back three ki', () => {
  const { p, u, put } = classScene('rogue'); u.traits = { finisher: 1, dragonClaw: 2 }; u.ki = 3;
  const a = put(0, 5, 6, 1);
  strike(p, u, a, 1, []);
  expect(u.ki).toBe(3);
});

it('shadow step 3: the blow after the step is always critical', () => {
  const { p, u, put } = classScene('rogue'); u.traits = { shadowStep: 3 };
  const a = put(0, 5, 6, 1); put(1, 8, 6);
  p.s.rng.chance = (c) => c >= 0.5;
  let crits = 0; u.triggers = [{ id: 'spy', when: 'crit', repeat: true, run: () => { crits++; } }];
  action(p, () => damage(p, 1, u.id, a, 99, [], true));
  expect(crits).toBe(1);
});

it('vitals 3: a foe carrying three states dies and hands them to the nearest foe', () => {
  const { p, u, put } = classScene('rogue'); u.traits = { vitals: 3 };
  const a = put(0, 5, 6, 1), b = put(1, 7, 6);
  for (const s of ['poison', 'bleed', 'mark'] as const) applyStatus(p, u, a, s, 0, []);
  const ev: GEvent[] = [];
  action(p, () => damage(p, 1, u.id, a, 99, ev, true));
  expect(b.status.poison && b.status.bleed && b.status.mark).toBeTruthy();
});

it('shadow poison 2: five stacks from hiding', () => {
  const { u, put, fire } = classScene('rogue'); u.traits = { shadowPoison: 2 }; u.hiddenUntil = 9;
  const a = put(0, 5, 6);
  fire('hit', 1, { target: a });
  expect(a.status.poison?.stacks).toBe(5);
});

it('ambush multiplies 1.3 per #은신 (1.34 at rank 2)', () => {
  const { p, u, put } = classScene('rogue');
  const a = put(0, 5, 6);
  u.traits = { ambushArt: 1, shadowStep: 1, shadowPoison: 1 }; u.hiddenUntil = 9;
  expect(traitMult(p, u, a, 1)).toBeCloseTo(1.3 ** 3);
  u.traits.ambushArt = 2; expect(traitMult(p, u, a, 1)).toBeCloseTo(1.34 ** 3);
});

import { describe, expect, it } from 'vitest';
import { createRng } from '../../../src/core/rng';
import { GridSim } from '../../../src/sim/grid/gridSim';
import { hitChance } from '../../../src/sim/grid/combat';
import { GUN_COST, GUNS, makeWeapon, RIFLE_BURST, rollEquipment, shotgunFalloff, WEAPONS } from '../../../src/sim/grid/items';
import { canFire, meleeAttack, rangedAttack, shootCell } from '../../../src/sim/grid/weapons';
import { counterBlow } from '../../../src/sim/grid/combos';
import { FOES } from '../../../src/sim/grid/types';
import { nextFloor } from '../../../src/sim/grid/run';
import { handMap, OPEN, sim, sureHits } from './kit';

const hooks = { noise: () => {}, cast: () => 1 };
describe('ship guns and suit charge', () => {
  it('starts with a pistol, agent knife, full suit and no rack', () => {
    const s = GridSim.create(7).s;
    expect(s.hero).toMatchObject({ hp: 35, maxHp: 35, charge: 10, maxCharge: 10 });
    expect(s.hero.gear.hands[0]).toMatchObject({ group: 'pistol', tier: 1 });
    expect(s.hero.suit).toEqual([]);
    expect(s.hero.gear.hands[1]).toMatchObject({ group: 'dagger', name: '요원 칼' });
    expect(s.hero.gear.armor?.tier).toBe(1);
    expect(s.hero.gear.belt.potion).toBe(2);
    expect(s.floorItems.filter((f) => f.item.kind === 'weapon')).toEqual([]);
  });

  it('spends one charge and 0.6 turns; empty charge refuses without time', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 7, y: 7 } }]);
    g.s.foes[0]!.nextAt = 100;
    g.act({ kind: 'shoot', target: 'f1' });
    expect(g.s.hero.charge).toBe(9);
    expect(g.s.time).toBeCloseTo(0.6);
    g.s.hero.charge = 0;
    expect(g.act({ kind: 'shoot', target: 'f1' }).map((e) => e.type)).toContain('blocked');
    expect(g.s.time).toBeCloseTo(0.6);
  });

  it.each([false, true])('shotgun hits and pushes three cells (diagonal=%s) for two charge', (diagonal) => {
    const positions = diagonal ? [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 7, y: 6 }] : [{ x: 7, y: 5 }, { x: 7, y: 4 }, { x: 7, y: 6 }];
    const g = sim(OPEN, { x: 4, y: 5 }, positions.map((pos) => ({ kind: 'brute', pos })));
    g.s.hero.gear.hands[0] = makeWeapon('shotgun', 1);
    sureHits(g);
    expect(rangedAttack(g.s, 0, g.s.foes[0]!, hooks)).toBe(1);
    expect(g.s.hero.charge).toBe(8);
    g.s.foes.forEach((f, i) => {
      const p = positions[i]!;
      expect(f.hp).toBe(f.maxHp - Math.round(5 * shotgunFalloff(Math.max(Math.abs(p.x - 4), Math.abs(p.y - 5)))));
      expect(f.pos).toEqual({ x: p.x + Math.sign(p.x - 4), y: p.y + Math.sign(p.y - 5) });
    });
  });

  it('rifle halves cover penalty with the same base hit chance', () => {
    const m = handMap(['########', '#......#', '#...P..#', '#......#', '########']);
    const from = { x: 1, y: 1 }, to = { x: 5, y: 2 };
    expect(hitChance(m, from, to, 0.85, 0.5)).toBeCloseTo(hitChance(m, from, to, 0.85) + 0.15);
  });

  it.each([
    ['sword', 100, 0, true, 1], ['sword', 1, 0, true, 3],
    ['axe', 100, 0, true, 1], ['axe', 1, 0, true, 7],
    ['sword', 1, 9, true, 10], ['sword', 100, 0, false, 0],
    ['pistol', 1, 0, true, 3],
  ] as const)('%s melee hp=%s charge=%s hit=%s ends at %s', (group, hp, charge, hit, expected) => {
    const g = sim(OPEN, { x: 5, y: 5 }, [4, 5, 6].map((y) => ({ kind: 'brute', pos: { x: 6, y } })));
    g.s.hero.gear.hands[0] = makeWeapon(group, 1);
    g.s.hero.charge = charge;
    g.s.foes.forEach((f) => { f.hp = hp; });
    sureHits(g);
    g.s.rng.chance = () => hit;
    meleeAttack(g.s, 0, { x: 1, y: 0 }, g.s.foes[1]!);
    expect(g.s.hero.charge).toBe(expected);
  });

  it('finds only local weapons, including staffs, and never armour (the suit is all the agent wears)', () => {
    const rng = createRng(22);
    const finds = Array.from({ length: 1000 }, () => rollEquipment(rng, 10));
    expect(finds.every((w) => w.kind === 'weapon')).toBe(true);
    expect(new Set(finds.flatMap((w) => w.kind === 'weapon' ? [w.group] : []))).toEqual(new Set(['dagger', 'sword', 'axe', 'spear', 'mace', 'staff']));
  });

  it('chests give no arrows and do not refill suit charge', () => {
    const g = sim(['#####', '#.C.#', '#...#', '#####'], { x: 1, y: 1 });
    g.s.hero.charge = 3;
    const ev = g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(g.s.chests[0]!.opened).toBe(true);
    expect(g.s.hero.gear).not.toHaveProperty('arrows');
    expect(ev.some((e) => e.text === '화살')).toBe(false);
    expect(g.s.hero.charge).toBe(3);
  });

  it.each(GUNS)('%s keeps tier 1 and spends its charge and noise on foe and barrel shots', (gun) => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    g.s.hero.gear.hands[0] = makeWeapon(gun, 2);
    expect(g.s.hero.gear.hands[0]!.tier).toBe(1);
    const noises: number[] = [];
    rangedAttack(g.s, 0, g.s.foes[0]!, { ...hooks, noise: (_at, r) => noises.push(r) });
    expect(g.s.hero.charge).toBe(10 - GUN_COST[gun]);
    g.s.foes[0]!.alive = false;
    g.s.barrels = [{ x: 6, y: 7 }];
    let exploded = false;
    shootCell(g.s, 1, g.s.barrels[0]!, () => { exploded = true; }, (_at, r) => noises.push(r));
    expect(exploded).toBe(true);
    expect(g.s.hero.charge).toBe(10 - 2 * GUN_COST[gun]);
    expect(noises).toEqual([gun === 'pistol' ? 4 : 6, gun === 'pistol' ? 4 : 6]);
    g.s.hero.charge = GUN_COST[gun] - 1;
    expect(canFire(g.s)).toBe(false);
    expect(shootCell(g.s, 2, g.s.barrels[0]!, () => { throw new Error('unpowered shot'); })).toBeNull();
  });

  it('rifle preview and actual hit roll both use half cover', () => {
    const g = sim(['########', '#......#', '#....P.#', '#......#', '########'], { x: 1, y: 1 }, [{ kind: 'brute', pos: { x: 5, y: 3 } }]);
    const chances: number[] = [];
    g.s.rng.chance = (p) => { chances.push(p); return false; };
    g.s.hero.gear.hands[0] = makeWeapon('pistol', 1);
    const pistol = g.shotChance('f1')!;
    g.s.hero.gear.hands[0] = makeWeapon('rifle', 1);
    expect(g.shotChance('f1')).toBeCloseTo(pistol + 0.15 + WEAPONS.rifle.hit - WEAPONS.pistol.hit);
    expect(rangedAttack(g.s, 0, g.s.foes[0]!, hooks)).toBe(1.2);
    expect(chances).toEqual(Array(RIFLE_BURST).fill(g.shotChance('f1')));
    expect(g.s.hero.charge).toBe(8);
  });

  it('shotgun rolls each foe separately and pushes only surviving hits', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [7, 6, 8].map((y) => ({ kind: 'brute', pos: { x: 6, y } })));
    g.s.hero.gear.hands[0] = makeWeapon('shotgun', 1);
    sureHits(g);
    const rolls = [false, true, true];
    g.s.rng.chance = () => rolls.shift()!;
    g.s.foes[2]!.hp = 1;
    rangedAttack(g.s, 0, g.s.foes[0]!, hooks);
    expect(rolls).toEqual([]);
    const full = g.s.foes[0]!.maxHp;
    expect(g.s.foes.map((f) => f.hp)).toEqual([full, full - Math.round(5 * shotgunFalloff(3)), 0]);
    expect(g.s.events.filter((e) => e.type === 'push').map((e) => e.src)).toEqual(['f2']);
    expect(g.s.hero.charge).toBe(8); // Shot kills never refill the suit.
  });

  it.each([['pistol', 'pistol'], ['empty hand', null]] as const)('a bash with a %s still earns melee hit and kill charge', (_, group) => {
    const g = sim(OPEN, { x: 5, y: 5 }, [{ kind: 'minion', pos: { x: 6, y: 5 } }]);
    g.s.hero.gear.hands[0] = group ? makeWeapon(group, 1) : null;
    g.s.hero.charge = 0;
    g.s.foes[0]!.hp = 1;
    sureHits(g);
    meleeAttack(g.s, 0, { x: 1, y: 0 }, g.s.foes[0]!);
    expect(g.s.foes[0]!.alive).toBe(false);
    expect(g.s.hero.charge).toBe(3);
  });

  it('a missed main sweep gives no hit charge even if both sides die', () => {
    const g = sim(OPEN, { x: 5, y: 5 }, [5, 4, 6].map((y) => ({ kind: 'minion', pos: { x: 6, y } })));
    g.s.hero.gear.hands[0] = makeWeapon('axe', 1);
    g.s.hero.charge = 0;
    g.s.foes.forEach((f) => { f.hp = 1; });
    sureHits(g);
    const rolls = [false, true, true];
    g.s.rng.chance = () => rolls.shift()!;
    meleeAttack(g.s, 0, { x: 1, y: 0 }, g.s.foes[0]!);
    expect(g.s.hero.charge).toBe(4);
  });

  it.each(['counter', 'riposte'] as const)('%s earns melee hit and kill charge', (id) => {
    const g = sim(OPEN, { x: 5, y: 5 }, [{ kind: 'minion', pos: { x: 6, y: 5 } }]);
    g.s.hero.suit = [id];
    g.s.hero.gear.hands[0] = makeWeapon('sword', 1);
    g.s.hero.charge = 0;
    g.s.foes[0]!.hp = 1;
    sureHits(g);
    counterBlow(g.s, 0, 'f1', id === 'counter' ? 'dodge' : 'parry');
    expect(g.s.hero.charge).toBe(3);
  });

  it('leap refills once for its main hit and for each melee kill', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [7, 8].map((y) => ({ kind: 'minion', pos: { x: 6, y } })));
    g.s.hero.suit = ['leap'];
    g.s.hero.gear.hands[0] = makeWeapon('axe', 1);
    g.s.hero.charge = 0;
    g.s.foes.forEach((f) => { f.hp = 1; });
    sureHits(g);
    g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(g.s.hero.charge).toBe(5);
  });

  it('shove-shot can spend the melee refill but its gun kill gives no melee kill charge', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    g.s.hero.suit = ['shoveShot'];
    g.s.hero.gear.hands = [makeWeapon('sword', 1), makeWeapon('pistol', 1)];
    g.s.hero.charge = 0;
    g.s.foes[0]!.hp = 10;
    sureHits(g);
    meleeAttack(g.s, 0, { x: 1, y: 0 }, g.s.foes[0]!, hooks);
    expect(g.s.foes[0]!.alive).toBe(false);
    expect(g.s.hero.charge).toBe(0);
    expect(g.s.events.some((e) => e.type === 'shoot')).toBe(true);
  });

  it('staff charges and floor transitions are independent of suit charge', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    g.s.hero.charge = 0;
    const w = makeWeapon('staff', 1);
    g.s.hero.gear.hands[0] = w;
    expect(canFire(g.s)).toBe(true);
    rangedAttack(g.s, 0, g.s.foes[0]!, hooks);
    expect(w.charges).toBe(2);
    expect(g.s.hero.charge).toBe(0);
    g.s.hero.charge = 3;
    nextFloor(g.s);
    expect(g.s.hero.charge).toBe(3);
    expect(g.s.hero.maxCharge).toBe(10);
  });


  it('can equip a found melee weapon in place of the agent knife', () => {
    const g = sim(OPEN, { x: 3, y: 7 });
    const gun = g.s.hero.gear.hands[0];
    const sword = makeWeapon('sword', 1);
    g.s.hero.gear.bag.push(sword);
    expect(g.act({ kind: 'swap' }).some((e) => e.type === 'swap')).toBe(true);
    expect(g.s.time).toBe(0.5);
    expect(g.s.hero.gear.active).toBe(1);
    g.act({ kind: 'equip', bag: 0 });
    expect(g.s.hero.gear.hands).toEqual([gun, sword]);
    expect(g.s.hero.gear.bag).toEqual([{ ...makeWeapon('dagger', 1), name: '요원 칼' }]);
    g.act({ kind: 'swap' });
    expect(g.s.hero.gear.active).toBe(0);
  });

});

describe('no passive suit charge', () => {
  it('a recharge scroll refills staffs and the suit', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    g.s.hero.charge = 0;
    const staff = makeWeapon('staff', 1);
    staff.charges = 0;
    g.s.hero.gear.hands[1] = staff;
    g.s.hero.gear.scrolls.recharge = 1;
    g.act({ kind: 'read', sc: 'recharge' });
    expect(staff.charges).toBe(3);
    expect(g.s.hero.charge).toBe(g.s.hero.maxCharge);
  });

  it.each(['wait', 'search'] as const)('%s never refills an empty or partly charged suit', (kind) => {
    for (const charge of [0, 3]) {
      const g = sim(OPEN, { x: 5, y: 7 });
      g.s.hero.charge = charge;
      for (let i = 0; i < 60; i++) g.act({ kind });
      expect(g.s.hero.charge).toBe(charge);
    }
  });
});

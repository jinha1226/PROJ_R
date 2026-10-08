import { expect, it, vi } from 'vitest';
import { createRng } from '../../../src/core/rng';
import { sensedFoes } from '../../../src/sim/grid/perks';
import { meleeAttack, rangedAttack, reachTarget, weaponRange } from '../../../src/sim/grid/weapons';
import { heroAct, shootable } from '../../../src/sim/grid/actions';
import { addStatus, tickStatuses } from '../../../src/sim/grid/status';
import { strike } from '../../../src/sim/grid/combat';
import { nextFloor, settleKills } from '../../../src/sim/grid/run';
import { regenerate } from '../../../src/sim/grid/regen';
import { newRunState } from '../../../src/sim/grid/runSetup';
import { freshMeta } from '../../../src/sim/grid/meta';
import { makeWeapon, WEAPONS } from '../../../src/sim/grid/items';
import { idx } from '../../../src/sim/grid/types';
import { arena, foe } from './perkKit';
import { sureHits } from './kit';
const hooks = { noise: () => {} };
const dir = { x: 1, y: 0 };
it('scatter hurts at most two neighbours with half damage and shortens targeting range', () => {
  const sim = arena(), s = sim.s; sureHits(sim); s.hero.perks = ['scatter'];
  const f = foe(sim, 7), a = foe(sim, 7, 6), b = foe(sim, 8, 5), c = foe(sim, 8, 6), far = foe(sim, 11);
  rangedAttack(s, 0, f, hooks);
  expect(a.hp).toBe(98); expect(b.hp).toBe(98); expect(c.hp).toBe(100);
  expect(s.events.filter(e => e.text === 'scatter')).toHaveLength(2);
  expect(weaponRange(s.hero.gear.hands[0]!, s.hero)).toBe(5);
  expect(shootable(s)).not.toContain(far.id);
});
it('pierceBarrel hits the first foe up to three cells behind without extra charge', () => {
  const sim = arena(), s = sim.s; sureHits(sim); s.hero.perks = ['pierceBarrel'];
  const f = foe(sim, 7), behind = foe(sim, 10), farther = foe(sim, 11);
  rangedAttack(s, 0, f, hooks);
  expect(behind.hp).toBe(97); expect(farther.hp).toBe(100); expect(s.hero.arrows).toBe(23);
});
it('soulCell refunds one charge for a hero kill, once', () => {
  const sim = arena(), s = sim.s; sureHits(sim); s.hero.perks = ['soulCell']; s.hero.charge = 4;
  const f = foe(sim, 6, 5, 1), alive = new Set([f.id]); rangedAttack(s, 0, f, hooks);
  settleKills(s, alive); settleKills(s, alive); expect(s.hero.charge).toBe(5);
});
it('runeScope doubles the existing sleeping-shot damage', () => {
  const shot = (perk: boolean) => {
    const sim = arena(); sureHits(sim); sim.s.hero.perks = perk ? ['runeScope'] : [];
    const f = foe(sim); f.awake = false; rangedAttack(sim.s, 0, f, hooks); return 100 - f.hp;
  };
  expect(shot(true)).toBe(shot(false) * 2);
});
it('thermal senses an unseen foe behind a wall without changing visibility', () => {
  const sim = arena(), s = sim.s; const f = foe(sim, 8), far = foe(sim, 14);
  s.map.tiles[idx(s.map, { x: 7, y: 5 })] = 'wall'; s.visible.clear();
  expect(sensedFoes(s)).toEqual([]); s.hero.perks = ['thermal'];
  expect(sensedFoes(s)).toEqual([f.id]); expect(sensedFoes(s)).not.toContain(far.id); expect(s.visible.size).toBe(0);
});
it('bayonetGrip uses the blade tier dagger damage and refills on pistol melee', () => {
  const sim = arena(), s = sim.s; sureHits(sim); s.hero.perks = ['bayonetGrip']; s.hero.charge = 0;
  s.hero.gear.hands[1]!.tier = 2; const f = foe(sim);
  meleeAttack(s, 0, dir, f); expect(100 - f.hp).toBeGreaterThanOrEqual(WEAPONS.dagger.dmg[1][0]);
  expect(s.hero.charge).toBe(1); expect(s.hero.gear.active).toBe(0);
});
it('doubleTap makes the third consecutive shot free even at zero charge, then resets on wait', () => {
  const sim = arena(), s = sim.s; sureHits(sim); s.hero.gear.hands[0] = makeWeapon('staff', 1); s.hero.perks = ['doubleTap']; s.hero.charge = 4;
  const f = foe(sim);
  for (let i = 0; i < 3; i++) expect(sim.act({ kind: 'shoot', target: f.id }).some(e => e.type === 'shoot')).toBe(true);
  expect(s.hero.charge).toBe(2); s.hero.charge = 0; sim.act({ kind: 'wait' });
  expect(sim.act({ kind: 'shoot', target: f.id }).some(e => e.type === 'shoot')).toBe(false);
});
it('soulWeave gives a shield at run start and refreshes its minimum at the next floor', () => {
  const m = freshMeta(); m.mods.fitted = { chest: 'soulWeave' };
  const s = newRunState(3, m, { gun: 'bow', start: 1, startSuit: [] });
  expect(s.hero.shield).toBe(6); s.hero.shield = 1; nextFloor(s); expect(s.hero.shield).toBe(6);
  s.hero.shield = 9; nextFloor(s); expect(s.hero.shield).toBe(9);
});
it('reactive pushes a landed melee attacker only when the cell behind is free', () => {
  const sim = arena(), s = sim.s; s.hero.perks = ['reactive']; const f = foe(sim);
  vi.spyOn(s.rng, 'chance').mockImplementation(p => p >= 0.5);
  strike(s, 0, f, s.hero, 1, [2, 2], 1, 'melee'); expect(f.pos.x).toBe(7);
  f.pos.x = 6; s.map.tiles[idx(s.map, { x: 7, y: 5 })] = 'wall';
  strike(s, 0, f, s.hero, 1, [2, 2], 1, 'melee'); expect(f.pos.x).toBe(6); expect(f.hp).toBe(100);
  s.map.tiles[idx(s.map, { x: 7, y: 5 })] = 'floor';
  strike(s, 0, f, s.hero, 1, [2, 2], 1, 'shot'); expect(f.pos.x).toBe(6);
});
it('hookArms reaches two cells and pulls on a hit, but not through blocked cells or on miss', () => {
  const sim = arena(), s = sim.s; sureHits(sim); s.hero.perks = ['hookArms']; const f = foe(sim, 7);
  expect(reachTarget(s, dir)).toBe(f); meleeAttack(s, 0, dir, f); expect(f.pos).toEqual({ x: 6, y: 5 }); expect(f.hp).toBeLessThan(100);
  f.pos.x = 7; s.rng.chance = () => false; meleeAttack(s, 0, dir, f); expect(f.pos.x).toBe(7);
  s.barrels = [{ x: 6, y: 5 }]; expect(reachTarget(s, dir)).toBeUndefined();
});
it('shockArms stuns on a seeded 20 percent roll', () => {
  const sim = arena(), s = sim.s; s.hero.perks = ['shockArms']; const f = foe(sim);
  const seed = Array.from({ length: 100 }, (_, i) => i).find(i => {
    const r = createRng(i); return r.chance(0.9) && (r.int(2, 4), r.chance(0.2));
  })!;
  s.rng = createRng(seed); meleeAttack(s, 0, dir, f); expect(f.stun).toBe(1);
});
it('chargeLegs adds three damage immediately after a move', () => {
  const sim = arena(), s = sim.s; sureHits(sim); s.hero.perks = ['chargeLegs']; s.hero.gear.active = 1;
  const a = foe(sim), b = foe(sim, 6, 6); meleeAttack(s, 0, dir, a);
  s.hero.fx.lastAction = 'move'; meleeAttack(s, 0, { x: 1, y: 1 }, b); expect(a.hp - b.hp).toBe(3);
});
it('silentLegs removes step noise', () => {
  const sim = arena(), s = sim.s; s.hero.perks = ['silentLegs']; const noise = vi.fn();
  heroAct(s, { kind: 'move', dir, plain: true }, { noise, use: () => null });
  expect(noise).toHaveBeenCalledWith(s.hero.pos, 0);
});
it('regenPack heals one HP after twelve combat turns, never while poisoned or burning', () => {
  const sim = arena(), s = sim.s; s.hero.perks = ['regenPack']; s.hero.hp = 20; foe(sim);
  for (let i = 0; i < 11; i++) regenerate(s, 1, false); expect(s.hero.hp).toBe(20);
  regenerate(s, 1, false); expect(s.hero.hp).toBe(21);
  for (const status of ['burn', 'poison'] as const) {
    s.hero.status = { burn: 0, freeze: 0, poison: 0 }; s.hero.status[status] = 20;
    regenerate(s, 12, false); expect(s.hero.hp).toBe(21);
  }
});
it('elemTank adds one to hero-applied burn and poison ticks only', () => {
  const sim = arena(), s = sim.s; s.hero.perks = ['elemTank']; const f = foe(sim), other = foe(sim, 7);
  addStatus(s, 0, f, 'fire', s.hero.id); addStatus(s, 0, other, 'fire', 'tile');
  tickStatuses(s, f, 0); tickStatuses(s, other, 0); expect(f.hp).toBe(97); expect(other.hp).toBe(98);
  f.status!.burn = 0; addStatus(s, 0, f, 'poison', s.hero.id); tickStatuses(s, f, 1); expect(f.hp).toBe(95);
});
it('elemChamber adds one shot status strength on top of element resonance', () => {
  const sim = arena(), s = sim.s; sureHits(sim); s.hero.perks = ['elemChamber']; s.hero.rounds = ['fire'];
  s.hero.suit = ['fireEmber', 'fireStoke', 'fireSpread']; const f = foe(sim);
  rangedAttack(s, 0, f, hooks); expect(f.status?.burn).toBe(5);
  const other = foe(sim, 7); addStatus(s, 0, other, 'fire', s.hero.id); expect(other.status?.burn).toBe(4);
});
it('doubleTap charges barrel shots in the same order as foe shots', () => {
  const sim = arena(), s = sim.s; s.hero.gear.hands[0] = makeWeapon('staff', 1); s.hero.perks = ['doubleTap']; s.hero.charge = 4;
  for (let i = 0; i < 3; i++) {
    s.barrels = [{ x: 8, y: 5 }];
    expect(sim.act({ kind: 'shoot', at: { x: 8, y: 5 } }).some(e => e.type === 'shoot')).toBe(true);
    expect(s.hero.charge).toBe([2, 1, 2][i]);
  }
});

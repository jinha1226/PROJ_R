import { makeWeapon } from '../../../src/sim/grid/items';
import { expect, it } from 'vitest';
import { runEffect } from '../../../src/sim/grid/kataEffects';
import { GridSim } from '../../../src/sim/grid/gridSim';
import { fromSave, toSave } from '../../../src/sim/grid/save';
import { addStatus, applyElement, tickStatuses } from '../../../src/sim/grid/status';
import { arena, foe } from './perkKit';
import { sureHits } from './kit';

it('counts volley follow-up shots toward doubleTap without charging the sixth shot', () => {
  const sim = arena(), s = sim.s; sureHits(sim); s.hero.gear.hands[0] = makeWeapon('staff', 1); s.hero.perks = ['doubleTap']; s.hero.suit = ['volley']; s.hero.charge = 10;
  const f = foe(sim, 7); foe(sim, 7, 6); foe(sim, 7, 4);
  for (let i = 0; i < 3; i++) sim.act({ kind: 'shoot', target: f.id });
  expect(s.hero.charge).toBe(4); expect(s.hero.fx.taps).toBe(5);
  sim.act({ kind: 'shoot', target: f.id }); expect(s.hero.charge).toBe(4);
});
it('does not boost a new environmental poison after old hero poison expires', () => {
  const sim = arena(), s = sim.s; s.hero.perks = ['elemTank']; const f = foe(sim);
  addStatus(s, 0, f, 'poison', s.hero.id); f.status!.poison = 0;
  s.tiles.push({ pos: { ...f.pos }, kind: 'poison', until: 10 });
  tickStatuses(s, f, 0); expect(f.hp).toBe(99);
});
it('replaces pre-stone-save charge and plating stats exactly while preserving upgrades', () => {
  const raw = JSON.parse(toSave(arena().s));
  const h = raw.state.hero;
  h.maxCharge = h.charge = 14; h.maxHp = h.hp = 46; // extMag + charge upgrade, plating + level HP
  h.modStats = { maxCharge: 2, maxHp: 6, hit: 0.13, swap: -0.25, meleeDmg: 1, evasion: 0.05, noise: -2 };
  h.bonus.meleeDmg = 3; h.bonus.evasion = 0.1;
  delete h.baseMods; delete h.sockets; delete h.perks; delete raw.state.run.stones; delete raw.state.run.modsUnlocked;
  const sim = GridSim.fromState(fromSave(JSON.stringify(raw))), s = sim.s;
  expect(s.hero.maxCharge).toBe(14); expect(s.hero.maxHp).toBe(46); expect(s.hero.perks).toEqual([]);
  s.run.stones.push('soulCell', 'reactive', 'scatter', 'thermal', 'hookArms', 'chargeLegs', 'regenPack', 'doubleTap');
  for (const stone of [...s.run.stones]) sim.act({ kind: 'socket', stone });
  expect(s.hero.maxCharge).toBe(12); expect(s.hero.charge).toBe(12); expect(s.hero.maxHp).toBe(40); expect(s.hero.hp).toBe(40);
  expect(s.hero.bonus.meleeDmg).toBe(2); expect(s.hero.bonus.evasion).toBeCloseTo(0.05);
  for (const value of Object.values(s.hero.modStats!)) expect(value).toBeCloseTo(0);
  const saved = fromSave(toSave(s)); expect(saved.hero).toEqual(s.hero);
});
it('removes legacy heavy barrel stats without removing the back-slot silencer', () => {
  const raw = JSON.parse(toSave(arena().s)), h = raw.state.hero;
  delete h.baseMods; h.modStats = { gunDmg: 1, noise: 0, hit: 0.12, maxCharge: 4, shield: 3 };
  h.bonus.gunDmg = 3; h.maxCharge = h.charge = 14; h.shield = 2;
  const sim = GridSim.fromState(fromSave(JSON.stringify(raw))), s = sim.s;
  s.run.stones.push('scatter', 'elemChamber', 'reactive');
  sim.act({ kind: 'socket', stone: 'scatter' }); expect(s.hero.bonus.gunDmg).toBe(2); expect(s.hero.modStats?.noise).toBe(-2);
  sim.act({ kind: 'socket', stone: 'elemChamber' }); expect(s.hero.maxCharge).toBe(10);
  sim.act({ kind: 'socket', stone: 'reactive' }); expect(s.hero.shield).toBe(0);
});
it.each(['spinShot', 'execute'] as const)('doubleTap makes the third %s engraving shot free too', effect => {
  const sim = arena(), s = sim.s; sureHits(sim); s.hero.gear.hands[0] = makeWeapon('staff', 1); s.hero.perks = ['doubleTap']; s.hero.fx.taps = 2; s.hero.charge = 0;
  const f = foe(sim), other = foe(sim, 5, 6);
  expect(runEffect(s, effect, { t: 0, foe: f, neighbours: [f, other] })).toBe(true);
  expect(s.events.filter(e => e.type === 'shoot')).toHaveLength(1); expect(s.hero.fx.taps).toBe(3); expect(s.hero.charge).toBe(0);
});
it.each(['fire', 'poison'] as const)('elemTank retains hero ownership when a foe enters hero-created %s ground', element => {
  const sim = arena(), s = sim.s; s.hero.perks = ['elemTank'];
  applyElement(s, 0, element, { x: 8, y: 5 }, element === 'poison' ? 1 : 0, null, s.hero.id);
  const f = foe(sim, 8); tickStatuses(s, f, 0);
  expect(f.hp).toBe(element === 'fire' ? 97 : 98);
});
it('bayonetGrip changes pistol-bump damage and hit, preserving its time and weapon event', async () => {
  const { meleeAttack } = await import('../../../src/sim/grid/weapons');
  const sim = arena(), s = sim.s; sureHits(sim); s.hero.perks = ['bayonetGrip']; const f = foe(sim); f.awake = false;
  expect(meleeAttack(s, 0, { x: 1, y: 0 }, f)).toBe(1);
  expect(s.events.find(e => e.type === 'bump')?.group).toBe('bow'); expect(f.hp).toBe(97);
});

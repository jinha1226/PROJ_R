import { describe, it, expect } from 'vitest';
import '../../src/sim/progression';
import '../../src/sim/personality';
import { createState, setupFromPresets } from '../../src/sim/battle/setup';
import { applyToTargets } from '../../src/sim/battle/effects';
import { startAction, advanceActions } from '../../src/sim/battle/actions';
import { dealDamage, heal } from '../../src/sim/battle/damage';
import { addTag, hasTag } from '../../src/sim/battle/tags';
import { effectiveStats } from '../../src/sim/battle/stats';
import { runReactors } from '../../src/sim/battle/reactors';
import { emit } from '../../src/sim/battle/events';
import { Battle } from '../../src/sim/battle/battle';
import { getSkill } from '../../src/data/skills';
import { hasEmotion } from '../../src/sim/personality/emotions';
import { v } from '../../src/core/vec2';
import type { BattleState } from '../../src/sim/battle/types';

const fresh = (enemy = 'bandits') => {
  const s = createState(setupFromPresets(3, 'standard', enemy));
  for (const u of s.units) { u.setup.stats.crit = 0; u.setup.stats.dodge = 0; }
  const by = (def: string) => s.units.find((u) => u.setup.defId === def)!;
  return { s, by, foe: s.units.find((u) => u.team === 'enemy')! };
};
const lost = (s: BattleState, id: string) => { const u = s.units.find((x) => x.id === id)!; return u.maxHp - u.hp; };

describe('progression effects in battle', () => {
  it('skill level 3 hits 1.4x as hard as level 1', () => {
    const a = fresh(); const b = fresh();
    b.by('mage').setup.skillLevels = { fireball: 3 };
    applyToTargets(a.s, a.by('mage'), getSkill('fireball'), [a.foe]);
    applyToTargets(b.s, b.by('mage'), getSkill('fireball'), [b.foe]);
    expect(lost(b.s, b.foe.id) / lost(a.s, a.foe.id)).toBeCloseTo(1.4, 1);
  });
  it('skill level 3 cuts the cooldown to 80%', () => {
    const { s, by, foe } = fresh();
    const w = by('warrior'); w.setup.skillLevels = { shield_bash: 3 }; w.pos = v(0, 0); foe.pos = v(1, 0);
    startAction(s, w, 'shield_bash', foe.id);
    for (let i = 0; i < 6; i++) advanceActions(s);
    expect(w.cooldowns.shield_bash).toBe(Math.round(8 * 20 * 0.8));
  });
  it('wetLightning and giantSlayer raise damage', () => {
    const a = fresh(); const b = fresh();
    addTag(a.s, a.foe, 'wet', 5, 0, 'x'); addTag(b.s, b.foe, 'wet', 5, 0, 'x');
    b.by('mage').setup.uniques = ['wetLightning'];
    dealDamage(a.s, a.by('mage'), a.foe, { mult: 2, canDodge: false, canCrit: false, skillId: 't' });
    dealDamage(b.s, b.by('mage'), b.foe, { mult: 2, canDodge: false, canCrit: false, skillId: 't' });
    expect(lost(b.s, b.foe.id) / lost(a.s, a.foe.id)).toBeCloseTo(1.25, 1);
    const c = fresh('boss'); const boss = c.s.units.find((u) => u.setup.boss)!;
    const base = dealDamage(c.s, c.by('mage'), boss, { mult: 3, canDodge: false, canCrit: false, skillId: 't' });
    c.by('mage').setup.title = 'giantSlayer';
    const slayer = dealDamage(c.s, c.by('mage'), boss, { mult: 3, canDodge: false, canCrit: false, skillId: 't' });
    expect(slayer / base).toBeCloseTo(1.1, 1);
  });
  it('lifesteal heals, thorns reflects melee, knockdownBleed bleeds', () => {
    const { s, by, foe } = fresh();
    const kael = by('berserker'); kael.hp = 50; kael.setup.uniques = ['lifesteal', 'knockdownBleed'];
    addTag(s, foe, 'knockdown', 1, 0, 'x');
    dealDamage(s, kael, foe, { mult: 3, canDodge: false, canCrit: false, skillId: 'cleave' });
    runReactors(s);
    expect(kael.hp).toBeGreaterThan(50);
    expect(hasTag(foe, 'bleed')).toBe(true);
    const bran = by('warrior'); bran.setup.uniques = ['thorns'];
    const cut = s.units.find((u) => u.setup.defId === 'bandit_cutthroat')!;
    s.events = [];
    dealDamage(s, cut, bran, { mult: 1, canDodge: false, canCrit: false, skillId: 'stab' });
    runReactors(s);
    expect(cut.hp).toBeLessThan(cut.maxHp);
  });
  it('markReset refreshes cooldowns on killing a marked enemy', () => {
    const { s, by, foe } = fresh();
    const r = by('crossbow'); r.setup.uniques = ['markReset']; r.cooldowns = { crippling_shot: 100, piercing_bolt: 100 };
    addTag(s, foe, 'marked', 5, 0, 'x'); foe.hp = 1;
    dealDamage(s, r, foe, { mult: 5, canDodge: false, canCrit: false, skillId: 'bolt_shot' });
    runReactors(s);
    expect(r.cooldowns.crippling_shot).toBe(0);
  });
  it('lastStand, friendGuard, and guardian adjust stats', () => {
    const { s, by } = fresh();
    const w = by('warrior');
    const atk = effectiveStats(w, s).atk;
    w.setup.uniques = ['lastStand']; w.hp = w.maxHp * 0.2;
    expect(effectiveStats(w, s).atk).toBeCloseTo(atk * 1.25);
    const def = effectiveStats(w, s).def;
    w.setup.title = 'guardian'; w.intent = { kind: 'guard', reason: 'guard' };
    expect(effectiveStats(w, s).def).toBeCloseTo(def * 1.15);
  });
  it('healingHand boosts healing; undying extends the lifeline', () => {
    const { s, by } = fresh();
    const p = by('priest'); const w = by('warrior'); w.hp = 10;
    const plain = heal(s, p, w, 50, 'heal'); w.hp = 10;
    p.setup.title = 'healingHand';
    expect(heal(s, p, w, 50, 'heal')).toBe(Math.round(plain * 1.1));
    w.setup.title = 'undying'; w.hp = 1;
    dealDamage(s, s.units.find((u) => u.team === 'enemy')!, w, { mult: 9, canDodge: false, canCrit: false, skillId: 't' });
    expect(w.lifeline).toBeCloseTo(w.maxHp * 0.5 * 1.25);
  });
  it('firstStrike and limp act at battle start; hundredCuts and momentumSurge feed momentum', () => {
    const setup = setupFromPresets(3, 'standard', 'bandits');
    setup.allies[0]!.uniques = ['firstStrike'];
    setup.allies[1]!.scars = ['limp'];
    const b = new Battle(setup);
    b.step();
    expect(b.state.units[0]!.momentum).toBeGreaterThanOrEqual(30);
    expect(hasEmotion(b.state.units[1]!, 'resolve')).toBe(true);
    const { s, by, foe } = fresh();
    const k = by('berserker'); k.setup.title = 'hundredCuts';
    emit(s, { type: 'died', src: k.id, dst: foe.id }); runReactors(s);
    expect(k.momentum).toBeGreaterThanOrEqual(10);
  });
});

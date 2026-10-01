import { describe, it, expect, afterEach } from 'vitest';
import { pairKey, relationKinds, partners, relationOf } from '../../src/sim/personality/relations';
import { createState, setupFromPresets } from '../../src/sim/battle/setup';
import { dealDamage } from '../../src/sim/battle/damage';
import { lethalGuards, registerLethalGuard, momentumModifiers, registerMomentumModifier } from '../../src/sim/battle/stats';
import type { Relation } from '../../src/data/types';

const rel = (affinity: number, extra: Partial<Relation> = {}): Relation => ({ a: 'a0', b: 'a1', affinity, rival: false, battlesTogether: 0, contests: 0, ...extra });

describe('relations', () => {
  const lethalBefore = lethalGuards.length;
  const momentumBefore = momentumModifiers.length;
  afterEach(() => {
    lethalGuards.length = lethalBefore;
    momentumModifiers.length = momentumBefore;
  });

  it('pair keys are symmetric', () => {
    expect(pairKey('a3', 'a1')).toBe(pairKey('a1', 'a3'));
  });
  it('relation kinds follow spec thresholds', () => {
    expect(relationKinds(rel(39), 1, 1).has('friend')).toBe(false);
    expect(relationKinds(rel(40), 1, 1).has('friend')).toBe(true);
    expect(relationKinds(rel(80, { battlesTogether: 9 }), 1, 1).has('comrade')).toBe(false);
    expect(relationKinds(rel(80, { battlesTogether: 10 }), 1, 1).has('comrade')).toBe(true);
    expect(relationKinds(rel(-40), 1, 1).has('feud')).toBe(true);
    expect(relationKinds(rel(-39), 1, 1).has('feud')).toBe(false);
    expect(relationKinds(rel(0, { rival: true }), 1, 1).has('rival')).toBe(true);
    expect(relationKinds(rel(30), 5, 2).has('mentor')).toBe(false);
    expect(relationKinds(rel(30), 5, 1).has('mentor')).toBe(true);
    expect(relationKinds(rel(29), 5, 1).has('mentor')).toBe(false);
  });
  it('state keeps only relations between deployed allies', () => {
    const setup = setupFromPresets(1, 'bonds', 'skeletons');
    setup.relations!.push({ a: 'a0', b: 'a9', affinity: 90, rival: false, battlesTogether: 20, contests: 0 });
    const s = createState(setup);
    expect(relationOf(s, 'a0', 'a1')?.affinity).toBe(60);
    expect(relationOf(s, 'a0', 'a9')).toBeUndefined();
  });
  it('partners excludes dead or downed partners', () => {
    const s = createState(setupFromPresets(1, 'bonds', 'skeletons'));
    const [a0, a1] = s.units;
    expect(partners(s, a0!, 'friend').map((u) => u.id)).toEqual(['a1', 'a4']);
    a1!.downed = true;
    expect(partners(s, a0!, 'friend').map((u) => u.id)).toEqual(['a4']);
    expect(partners(s, a0!, 'mentor').map((u) => u.id)).toEqual(['a4']);
  });
  it('lethal guard can keep a unit at 1 hp', () => {
    const s = createState(setupFromPresets(1, 'bonds', 'skeletons'));
    const [a0] = s.units;
    const foe = s.units.find((u) => u.team === 'enemy')!;
    registerLethalGuard((u) => u.id === 'a0');
    a0!.hp = 5;
    dealDamage(s, foe, a0!, { mult: 50, canDodge: false, canCrit: false, skillId: 't' });
    expect(a0!.hp).toBe(1);
    expect(a0!.downed).toBe(false);
  });
  it('momentum modifiers scale momentum gain', () => {
    const s = createState(setupFromPresets(1, 'bonds', 'skeletons'));
    const s2 = createState(setupFromPresets(1, 'bonds', 'skeletons'));
    registerMomentumModifier((u) => (u.id === 'a0' ? 2 : 1));
    const f1 = s.units.find((u) => u.team === 'enemy')!;
    const f2 = s2.units.find((u) => u.team === 'enemy')!;
    dealDamage(s, s.units[0]!, f1, { mult: 1, canDodge: false, canCrit: false, skillId: 't' });
    momentumModifiers.length = momentumBefore;
    dealDamage(s2, s2.units[0]!, f2, { mult: 1, canDodge: false, canCrit: false, skillId: 't' });
    expect(s.units[0]!.momentum).toBeCloseTo(s2.units[0]!.momentum * 2);
  });
});

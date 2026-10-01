import { describe, it, expect } from 'vitest';
import { addEmotion, hasEmotion, tickEmotions } from '../../src/sim/personality/emotions';
import { createState, setupFromPresets } from '../../src/sim/battle/setup';
import { effectiveStats } from '../../src/sim/battle/stats';
import { dealDamage } from '../../src/sim/battle/damage';
import { makeSnapshot } from '../../src/sim/battle/snapshot';

const fresh = () => {
  const s = createState(setupFromPresets(1, 'bonds', 'skeletons'));
  const by = (id: string) => s.units.find((u) => u.id === id)!;
  return { s, by, foe: s.units.find((u) => u.team === 'enemy')! };
};

describe('emotions', () => {
  it('rage raises attack by 20% and expires', () => {
    const { s, by } = fresh();
    const kael = by('a2');
    const base = effectiveStats(kael, s).atk;
    addEmotion(s, kael, 'rage');
    expect(effectiveStats(kael, s).atk).toBeCloseTo(base * 1.2);
    for (let i = 0; i < 5 * 20 + 1; i++) tickEmotions(s);
    expect(hasEmotion(kael, 'rage')).toBe(false);
    expect(s.events.some((e) => e.type === 'emotion_end')).toBe(true);
  });
  it('calm halves emotion strength and duration', () => {
    const { s, by } = fresh();
    const bran = by('a0');
    const base = effectiveStats(bran, s).atk;
    addEmotion(s, bran, 'rage');
    expect(effectiveStats(bran, s).atk).toBeCloseTo(base * 1.1);
    expect(bran.emotions[0]!.ticksLeft).toBe(50);
  });
  it('courage blocks fear', () => {
    const { s, by } = fresh();
    const owen = by('a1');
    addEmotion(s, owen, 'courage');
    addEmotion(s, owen, 'fear');
    expect(hasEmotion(owen, 'fear')).toBe(false);
  });
  it('gaining courage cancels fear', () => {
    const { s, by } = fresh();
    const owen = by('a1');
    owen.hp = owen.maxHp * 0.2;
    addEmotion(s, owen, 'fear');
    addEmotion(s, owen, 'courage');
    expect(hasEmotion(owen, 'fear')).toBe(false);
  });
  it('revenge ends when its target dies', () => {
    const { s, by, foe } = fresh();
    const serin = by('a4');
    addEmotion(s, serin, 'revenge', { targetId: foe.id });
    tickEmotions(s);
    expect(hasEmotion(serin, 'revenge')).toBe(true);
    foe.alive = false;
    tickEmotions(s);
    expect(hasEmotion(serin, 'revenge')).toBe(false);
  });
  it('fear ends once HP recovers above 40%', () => {
    const { s, by } = fresh();
    const owen = by('a1');
    owen.hp = owen.maxHp * 0.2;
    addEmotion(s, owen, 'fear');
    owen.hp = owen.maxHp * 0.5;
    tickEmotions(s);
    expect(hasEmotion(owen, 'fear')).toBe(false);
  });
  it('resolve keeps a unit standing once', () => {
    const { s, by, foe } = fresh();
    const yuna = by('a3');
    addEmotion(s, yuna, 'resolve');
    yuna.hp = 3;
    dealDamage(s, foe, yuna, { mult: 99, canDodge: false, canCrit: false, skillId: 't' });
    expect(yuna.hp).toBe(1);
    expect(s.events.some((e) => e.type === 'resolve')).toBe(true);
    dealDamage(s, foe, yuna, { mult: 99, canDodge: false, canCrit: false, skillId: 't' });
    expect(yuna.downed).toBe(true);
  });
  it('emotions appear in snapshots', () => {
    const { s, by } = fresh();
    addEmotion(s, by('a2'), 'rage');
    expect(makeSnapshot(s).units.find((u) => u.id === 'a2')!.emotions).toEqual(['rage']);
  });
});

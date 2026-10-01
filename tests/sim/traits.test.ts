import { describe, it, expect } from 'vitest';
import '../../src/sim/personality';
import { createState, setupFromPresets } from '../../src/sim/battle/setup';
import { decideUnit } from '../../src/sim/battle/ai/decide';
import { runReactors } from '../../src/sim/battle/reactors';
import { emit } from '../../src/sim/battle/events';
import { effectiveStats } from '../../src/sim/battle/stats';
import { hasEmotion, emotionOf } from '../../src/sim/personality/emotions';
import { v } from '../../src/core/vec2';
import type { BattleState } from '../../src/sim/battle/types';

const bonds = (enemy = 'skeletons') => {
  const s = createState(setupFromPresets(1, 'bonds', enemy));
  const by = (id: string) => s.units.find((u) => u.id === id)!;
  return { s, by, foes: s.units.filter((u) => u.team === 'enemy') };
};
const farAway = (s: BattleState, ids: string[]) => s.units.filter((u) => ids.includes(u.id)).forEach((u, i) => { u.pos = v(-11, -6 + i); });

describe('trait behaviors', () => {
  it('a wounded, isolated coward panics and flees', () => {
    const { s, by, foes } = bonds();
    const owen = by('a1');
    owen.pos = v(0, 0);
    owen.hp = owen.maxHp * 0.25;
    farAway(s, ['a0', 'a2', 'a3', 'a4']);
    foes[0]!.pos = v(1.5, 0);
    runReactors(s);
    expect(hasEmotion(owen, 'fear')).toBe(true);
    decideUnit(s, owen);
    expect(owen.intent?.kind).toBe('flee');
    expect(owen.vel.x).toBeLessThan(0);
  });
  it('a coward finds courage next to a friend', () => {
    const { s, by, foes } = bonds();
    const owen = by('a1');
    const bran = by('a0');
    owen.pos = v(0, 0);
    bran.pos = v(1, 0);
    owen.hp = owen.maxHp * 0.25;
    foes[0]!.pos = v(2, 0);
    runReactors(s);
    expect(hasEmotion(owen, 'courage')).toBe(true);
    expect(hasEmotion(owen, 'fear')).toBe(false);
    expect(s.events.some((e) => e.type === 'relation_trigger' && e.data?.kind === 'courage' && e.src === 'a1' && e.dst === 'a0')).toBe(true);
  });
  it('the vengeful hunt whoever downed their friend', () => {
    const { s, by, foes } = bonds();
    const serin = by('a4');
    const bran = by('a0');
    const killer = foes[3]!;
    bran.downed = true;
    emit(s, { type: 'downed', src: killer.id, dst: bran.id });
    runReactors(s);
    expect(emotionOf(serin, 'revenge')?.targetId).toBe(killer.id);
    expect(s.events.some((e) => e.type === 'relation_trigger' && e.data?.kind === 'revenge')).toBe(true);
    decideUnit(s, serin);
    expect(serin.intent?.targetId).toBe(killer.id);
    expect(serin.intent?.reason).toBe('revenge');
  });
  it('glory seekers go for the boss', () => {
    const pick = (traits: ('glory')[]) => {
      const s = createState(setupFromPresets(1, 'standard', 'boss'));
      const kael = s.units.find((u) => u.setup.defId === 'berserker')!;
      kael.setup.traits = traits;
      kael.setup.tactics = [];
      const boss = s.units.find((u) => u.setup.boss)!;
      const archer = s.units.find((u) => u.setup.defId === 'skeleton_archer')!;
      kael.pos = v(0, 0);
      boss.pos = v(3.5, 1);
      archer.pos = v(2.2, -1);
      kael.cooldowns = { charge: 999, whirlwind: 999 };
      decideUnit(s, kael);
      return { target: kael.intent?.targetId, boss: boss.id, archer: archer.id };
    };
    const plain = pick([]);
    expect(plain.target).toBe(plain.archer);
    const glory = pick(['glory']);
    expect(glory.target).toBe(glory.boss);
  });
  it('loners hit harder when alone', () => {
    const { s, by } = bonds();
    const yuna = by('a3');
    yuna.setup.traits = ['loner'];
    const crowded = effectiveStats(yuna, s).atk;
    yuna.pos = v(10, 6);
    expect(effectiveStats(yuna, s).atk).toBeCloseTo(crowded * 1.15);
  });
  it('cautious units act later at the start', () => {
    const s = createState(setupFromPresets(1, 'standard', 'bandits'));
    const lia = s.units.find((u) => u.setup.defId === 'crossbow')!;
    const bran = s.units.find((u) => u.setup.defId === 'warrior')!;
    expect(lia.decisionIn).toBeGreaterThanOrEqual(10);
    expect(bran.decisionIn).toBeLessThan(5);
  });
  it('hotheads sometimes fly into a rage when hit', () => {
    const { s, by, foes } = bonds();
    const kael = by('a2');
    let raged = false;
    for (let i = 0; i < 60 && !raged; i++) {
      emit(s, { type: 'damage', src: foes[0]!.id, dst: kael.id, amount: 1 });
      runReactors(s);
      s.events = [];
      raged = hasEmotion(kael, 'rage');
    }
    expect(raged).toBe(true);
  });
});

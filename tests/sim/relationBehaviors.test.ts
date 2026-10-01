import { describe, it, expect } from 'vitest';
import '../../src/sim/personality';
import { createState, setupFromPresets } from '../../src/sim/battle/setup';
import { decideUnit } from '../../src/sim/battle/ai/decide';
import { runReactors } from '../../src/sim/battle/reactors';
import { emit } from '../../src/sim/battle/events';
import { effectiveStats } from '../../src/sim/battle/stats';
import { hasEmotion } from '../../src/sim/personality/emotions';
import { v } from '../../src/core/vec2';

const bonds = () => {
  const s = createState(setupFromPresets(1, 'bonds', 'skeletons'));
  const by = (id: string) => s.units.find((u) => u.id === id)!;
  return { s, by, foes: s.units.filter((u) => u.team === 'enemy') };
};

/** Owen (a1) is wounded and an enemy is coming for him; Bran (a0) is his friend and mentor. */
const owenInDanger = () => {
  const t = bonds();
  const { by, foes } = t;
  const owen = by('a1');
  const bran = by('a0');
  owen.pos = v(-6, 0);
  owen.hp = owen.maxHp * 0.2;
  bran.pos = v(-3, 3);
  foes[0]!.pos = v(-4, -1);
  foes[0]!.intent = { kind: 'attack', targetId: owen.id, reason: 'attack' };
  return { ...t, owen, bran, attacker: foes[0]! };
};

describe('relationship behaviors', () => {
  it('a friend in danger draws a protector who announces it', () => {
    const { s, bran, owen, attacker } = owenInDanger();
    decideUnit(s, bran);
    expect(bran.intent?.kind).toBe('protect');
    expect(bran.intent?.targetId).toBe(attacker.id);
    expect(bran.intent?.allyId).toBe(owen.id);
    runReactors(s);
    const trig = s.events.find((e) => e.type === 'relation_trigger' && e.src === bran.id && e.dst === owen.id);
    expect(trig?.data?.kind).toBe('mentor');
  });
  it('no relationship, no protection', () => {
    const { s, bran } = owenInDanger();
    s.relations.clear();
    bran.setup.traits = [];
    decideUnit(s, bran);
    expect(bran.intent?.kind).not.toBe('protect');
  });
  it('a downed friend cannot be protected (rescue is used instead)', () => {
    const { s, bran, owen } = owenInDanger();
    owen.downed = true;
    decideUnit(s, bran);
    expect(bran.intent?.kind).not.toBe('protect');
  });
  it('rivals sharpen each other nearby', () => {
    const { s, by } = bonds();
    const kael = by('a2');
    const yuna = by('a3');
    kael.pos = v(0, 0);
    yuna.pos = v(10, 6);
    const far = effectiveStats(kael, s);
    yuna.pos = v(2, 0);
    const near = effectiveStats(kael, s);
    expect(near.atkSpeed).toBeCloseTo(far.atkSpeed * 1.1);
    expect(near.crit).toBeCloseTo(far.crit * 1.1);
  });
  it('feuding allies weaken each other nearby', () => {
    const { s, by } = bonds();
    const yuna = by('a3');
    const serin = by('a4');
    yuna.pos = v(0, 0);
    serin.pos = v(10, 6);
    const far = effectiveStats(yuna, s).atk;
    serin.pos = v(2, 0);
    expect(effectiveStats(yuna, s).atk).toBeCloseTo(far * 0.9);
  });
  it('a healer passes over a feuding ally for another wounded one', () => {
    const pick = (feud: boolean) => {
      const { s, by } = bonds();
      const owen = by('a1');
      if (feud) s.relations.set('a1|a3', { a: 'a1', b: 'a3', affinity: -60, rival: false, battlesTogether: 0, contests: 0 });
      by('a2').hp = by('a2').maxHp * 0.35;
      by('a3').hp = by('a3').maxHp * 0.25;
      owen.pos = v(-6, 0);
      by('a2').pos = v(-4, 1);
      by('a3').pos = v(-4, -1);
      owen.cooldowns = { judgment: 999 };
      decideUnit(s, owen);
      return owen.intent?.targetId;
    };
    expect(pick(false)).toBe('a3');
    expect(pick(true)).toBe('a2');
  });
  it('a rival kill spurs the other rival', () => {
    const { s, by, foes } = bonds();
    const yuna = by('a3');
    const before = yuna.momentum;
    emit(s, { type: 'died', src: 'a2', dst: foes[0]!.id });
    runReactors(s);
    expect(yuna.momentum).toBe(before + 10 * 1.25); // reckless boosts momentum gain
    expect(s.events.some((e) => e.type === 'relation_trigger' && e.data?.kind === 'rivalry' && e.src === 'a3')).toBe(true);
  });
  it('seeing a rival go down enrages', () => {
    const { s, by, foes } = bonds();
    by('a2').downed = true;
    emit(s, { type: 'downed', src: foes[0]!.id, dst: 'a2' });
    runReactors(s);
    expect(hasEmotion(by('a3'), 'rage')).toBe(true);
  });
  it('relations with an absent unit never fire', () => {
    const setup = setupFromPresets(1, 'bonds', 'skeletons');
    setup.allies = setup.allies.filter((u) => u.id !== 'a0');
    const s = createState(setup);
    const owen = s.units.find((u) => u.id === 'a1')!;
    owen.hp = owen.maxHp * 0.25;
    runReactors(s);
    expect(s.events.some((e) => e.type === 'relation_trigger' && e.dst === 'a0')).toBe(false);
  });
});

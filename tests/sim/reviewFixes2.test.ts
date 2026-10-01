import { describe, it, expect } from 'vitest';
import '../../src/sim/personality';
import { createState, setupFromPresets } from '../../src/sim/battle/setup';
import { decideUnit } from '../../src/sim/battle/ai/decide';
import { runReactors } from '../../src/sim/battle/reactors';
import { emit } from '../../src/sim/battle/events';
import { hasEmotion } from '../../src/sim/personality/emotions';
import { v } from '../../src/core/vec2';

const bonds = () => {
  const s = createState(setupFromPresets(1, 'bonds', 'skeletons'));
  return { s, by: (id: string) => s.units.find((u) => u.id === id)!, foes: s.units.filter((u) => u.team === 'enemy') };
};

describe('plan 2 review fixes', () => {
  it('a disciple protecting the master fires protect, not mentor', () => {
    const { s, by, foes } = bonds();
    const bran = by('a0');
    const owen = by('a1');
    bran.pos = v(-6, 0);
    bran.hp = bran.maxHp * 0.2;
    owen.pos = v(-2, 6); // attacker out of Owen's reach, so he must move in to protect
    owen.setup.traits = [];
    owen.cooldowns = { heal: 999, judgment: 999 }; // a healer would rightly heal instead; force the protect choice
    foes[0]!.pos = v(-4, -1);
    foes[0]!.intent = { kind: 'attack', targetId: bran.id, reason: 'attack' };
    decideUnit(s, owen);
    expect(owen.intent?.kind).toBe('protect');
    runReactors(s);
    const trig = s.events.find((e) => e.type === 'relation_trigger' && e.src === 'a1');
    expect(trig?.data?.kind).toBe('protect');
  });
  it('comrade combos lift both comrades into elation', () => {
    const { s, by } = bonds();
    const bran = by('a0');
    const serin = by('a4');
    serin.pos = v(-4, 0);
    bran.pos = v(-2, 0);
    serin.momentum = 60;
    bran.momentum = 60;
    s.units.find((u) => u.team === 'enemy')!.pos = v(2, 0);
    decideUnit(s, serin);
    expect(s.events.some((e) => e.type === 'pair_combo')).toBe(true);
    expect(hasEmotion(serin, 'elation')).toBe(true);
    expect(hasEmotion(bran, 'elation')).toBe(true);
  });
  it('a downed vengeful unit does not swear revenge', () => {
    const { s, by, foes } = bonds();
    const serin = by('a4');
    const bran = by('a0');
    serin.downed = true;
    bran.downed = true;
    emit(s, { type: 'downed', src: foes[0]!.id, dst: bran.id });
    runReactors(s);
    expect(s.events.some((e) => e.type === 'relation_trigger' && e.data?.kind === 'revenge')).toBe(false);
  });
});

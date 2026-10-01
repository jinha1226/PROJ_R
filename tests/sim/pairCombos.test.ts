import { describe, it, expect } from 'vitest';
import '../../src/sim/personality';
import { createState, setupFromPresets } from '../../src/sim/battle/setup';
import { decideUnit } from '../../src/sim/battle/ai/decide';
import { advanceActions } from '../../src/sim/battle/actions';
import { updateTelegraphs } from '../../src/sim/battle/telegraphs';
import { comboFor } from '../../src/sim/personality/pairCombos';
import { v } from '../../src/core/vec2';

/** Bran (warrior a0) and Serin (mage a4) are comrades → 방패 뒤 영창, led by the mage. */
const ready = () => {
  const s = createState(setupFromPresets(1, 'bonds', 'skeletons'));
  const by = (id: string) => s.units.find((u) => u.id === id)!;
  const bran = by('a0');
  const serin = by('a4');
  serin.pos = v(-4, 0);
  bran.pos = v(-2, 0);
  serin.momentum = 60;
  bran.momentum = 60;
  const foe = s.units.find((u) => u.team === 'enemy')!;
  foe.pos = v(2, 0);
  return { s, bran, serin, foe, by };
};

describe('comrade pair combos', () => {
  it('fires when conditions are met: both act, momentum spent, event emitted', () => {
    const { s, bran, serin } = ready();
    decideUnit(s, serin);
    expect(serin.intent?.reason).toBe('comboPair');
    expect(serin.action?.skillId).toBe('combo_shield_chant');
    expect(bran.action?.skillId).toBe('combo_guard_taunt');
    expect(serin.momentum).toBe(10);
    expect(bran.momentum).toBe(10);
    const ev = s.events.find((e) => e.type === 'pair_combo');
    expect(ev).toMatchObject({ src: 'a4', dst: 'a0', skillId: 'shield_chant' });
  });
  it('respects the pair cooldown', () => {
    const { s, serin } = ready();
    decideUnit(s, serin);
    serin.action = null;
    serin.momentum = 100;
    s.units.find((u) => u.id === 'a0')!.action = null;
    decideUnit(s, serin);
    expect(s.events.filter((e) => e.type === 'pair_combo')).toHaveLength(1);
  });
  it('needs comrade standing (affinity 79 is not enough)', () => {
    const { s, serin } = ready();
    s.relations.get('a0|a4')!.affinity = 79;
    decideUnit(s, serin);
    expect(s.events.some((e) => e.type === 'pair_combo')).toBe(false);
  });
  it('only the lead starts it', () => {
    const { s, bran } = ready();
    decideUnit(s, bran);
    expect(s.events.some((e) => e.type === 'pair_combo')).toBe(false);
  });
  it('the lead finishes even if the partner goes down mid-cast', () => {
    const { s, bran, serin } = ready();
    decideUnit(s, serin);
    bran.downed = true;
    bran.hp = 0;
    let fired = false;
    for (let i = 0; i < 40 && !fired; i++) {
      advanceActions(s);
      updateTelegraphs(s);
      fired = s.events.some((e) => e.type === 'telegraph_fire' && e.skillId === 'combo_shield_chant');
      s.tick++;
    }
    expect(fired).toBe(true);
    expect(bran.action).toBeNull();
  });
  it('unlisted class pairs use the generic combo led by the lower id', () => {
    const { by } = ready();
    const c = comboFor(by('a1'), by('a3'));
    expect(c.def.id).toBe('joint_strike');
    expect(c.lead.id).toBe('a1');
  });
});

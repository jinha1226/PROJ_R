import { describe, it, expect } from 'vitest';
import { createState, setupFromPresets } from '../../src/sim/battle/setup';
import { generateCandidates } from '../../src/sim/battle/ai/candidates';
import { decideUnit } from '../../src/sim/battle/ai/decide';
import { updateRescue } from '../../src/sim/battle/rescue';
import { startAction, advanceActions } from '../../src/sim/battle/actions';
import { updateTelegraphs } from '../../src/sim/battle/telegraphs';
import { addTag } from '../../src/sim/battle/tags';
import { v } from '../../src/core/vec2';

describe('review fixes', () => {
  it('taunted enemies retarget when the taunter is downed', () => {
    const s = createState(setupFromPresets(3, 'standard', 'bandits'));
    const w = s.units.find((u) => u.setup.defId === 'warrior')!;
    const foe = s.units.find((u) => u.setup.defId === 'bandit_cutthroat')!;
    addTag(s, foe, 'taunted', 3, 0, w.id);
    w.downed = true;
    w.hp = 0;
    const targets = new Set(generateCandidates(foe, s).filter((c) => c.kind === 'skill').map((c) => c.target!.id));
    expect(targets.size).toBeGreaterThan(1);
    decideUnit(s, foe);
    expect(foe.intent?.targetId).not.toBe(w.id);
  });
  it('rescue progress does not carry over after switching intent', () => {
    const s = createState(setupFromPresets(1, 'standard', 'tutorial'));
    const [a, b] = s.units.filter((u) => u.team === 'ally');
    a!.downed = true;
    a!.pos = v(-4, 0);
    b!.pos = v(-4.5, 0);
    b!.rescueTarget = a!.id;
    for (let i = 0; i < 35; i++) updateRescue(s);
    b!.setup.tactics = [];
    s.units.filter((u) => u.team === 'enemy').forEach((e) => { e.pos = v(-3.5, 0.5); });
    decideUnit(s, b!);
    expect(b!.intent?.kind).not.toBe('rescue');
    expect(b!.rescueProgress).toBe(0);
  });
  it('a telegraph whose windup completed still fires if the caster is stunned right after', () => {
    const s = createState(setupFromPresets(2, 'standard', 'boss'));
    const boss = s.units.find((u) => u.setup.boss)!;
    const w = s.units.find((u) => u.setup.defId === 'warrior')!;
    w.pos = v(0, 0);
    boss.pos = v(2, 0);
    startAction(s, boss, 'crushing_slam', w.id, { ...w.pos });
    let fired = false;
    for (let i = 0; i < 60 && !fired; i++) {
      advanceActions(s);
      if (boss.action?.phase === 'active') addTag(s, boss, 'stun', 1, 0, w.id);
      updateTelegraphs(s);
      fired = s.events.some((e) => e.type === 'telegraph_fire');
      s.tick++;
    }
    expect(fired).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { createState, setupFromPresets } from '../../src/sim/battle/setup';
import { Battle } from '../../src/sim/battle/battle';
import { createTelegraph } from '../../src/sim/battle/telegraphs';
import { addTag } from '../../src/sim/battle/tags';
import { decide } from '../../src/sim/battle/ai/decide';
import { getSkill } from '../../src/data/skills';
import { v } from '../../src/core/vec2';
import type { BattleState, UnitState } from '../../src/sim/battle/types';

/** Only `who` decides this tick. */
const only = (s: BattleState, who: UnitState) => s.units.forEach((u) => { u.decisionIn = u === who ? 0 : 99; });
const byDef = (s: BattleState, id: string) => s.units.find((u) => u.setup.defId === id)!;

describe('utility AI', () => {
  it('melee approaches the nearest enemy with a reason', () => {
    const s = createState(setupFromPresets(3, 'solo', 'tutorial'));
    const me = s.units[0]!;
    only(s, me);
    decide(s);
    expect(me.intent?.kind).toBe('approach');
    expect(me.intent?.reason).toBeTruthy();
    expect(me.vel.x).toBeGreaterThan(0);
  });
  it('attacks when in range', () => {
    const s = createState(setupFromPresets(3, 'solo', 'tutorial'));
    const me = s.units[0]!;
    me.pos = v(4, -1.5);
    only(s, me);
    decide(s);
    expect(['attack', 'skill']).toContain(me.intent?.kind);
    expect(me.action).not.toBeNull();
  });
  it('steps out of a telegraph about to fire', () => {
    const s = createState(setupFromPresets(3, 'standard', 'boss'));
    const boss = s.units.find((u) => u.setup.boss)!;
    const w = byDef(s, 'warrior');
    w.pos = v(0, 0);
    boss.pos = v(2, 0);
    createTelegraph(s, boss, getSkill('crushing_slam'), w, undefined);
    s.tick += 20;
    only(s, w);
    decide(s);
    expect(w.intent?.kind).toBe('dodge');
    expect(w.intent?.reason).toBe('dodge');
  });
  it('priest picks the wet target for judgment (combo seeking)', () => {
    const s = createState(setupFromPresets(3, 'elemental', 'bandits'));
    const priest = byDef(s, 'priest');
    const foes = s.units.filter((u) => u.team === 'enemy');
    priest.pos = v(0, 0);
    foes.forEach((f, i) => { f.pos = v(3, i - 2); });
    addTag(s, foes[3]!, 'wet', 6, 0, 'x');
    only(s, priest);
    decide(s);
    expect(priest.intent?.skillId).toBe('judgment');
    expect(priest.intent?.targetId).toBe(foes[3]!.id);
    expect(priest.intent?.reason).toBe('combo');
  });
  it('priest heals a wounded ally over attacking', () => {
    const s = createState(setupFromPresets(3, 'standard', 'bandits'));
    const p = byDef(s, 'priest');
    const w = byDef(s, 'warrior');
    w.hp = w.maxHp * 0.3;
    p.pos = v(-6, 0);
    w.pos = v(-3, 0);
    only(s, p);
    decide(s);
    expect(p.intent?.skillId).toBe('heal');
    expect(p.intent?.targetId).toBe(w.id);
  });
  it('ranged with keepDistance kites a close enemy', () => {
    const s = createState(setupFromPresets(3, 'standard', 'bandits'));
    const x = byDef(s, 'crossbow');
    const foe = s.units.find((u) => u.team === 'enemy')!;
    x.pos = v(0, 0);
    foe.pos = v(1.5, 0);
    only(s, x);
    decide(s);
    expect(x.intent?.kind).toBe('kite');
    expect(x.vel.x).toBeLessThan(0);
  });
  it('allies try to rescue a downed friend', () => {
    const s = createState(setupFromPresets(3, 'standard', 'tutorial'));
    const [a, b] = s.units.filter((u) => u.team === 'ally');
    a!.downed = true;
    a!.hp = 0;
    a!.lifeline = 50;
    a!.pos = v(-4, 0);
    b!.pos = v(-5, 0);
    s.units.filter((u) => u.team === 'enemy').forEach((e) => { e.pos = v(10, 6); });
    b!.setup.tactics = ['rescueDowned'];
    only(s, b!);
    decide(s);
    expect(b!.intent?.kind).toBe('rescue');
    expect(b!.rescueTarget).toBe(a!.id);
  });
  it('taunted enemies only target the taunter', () => {
    const s = createState(setupFromPresets(3, 'standard', 'bandits'));
    const w = byDef(s, 'warrior');
    const foe = byDef(s, 'bandit_cutthroat');
    addTag(s, foe, 'taunted', 3, 0, w.id);
    foe.threat[w.id] = 1e6;
    only(s, foe);
    decide(s);
    expect(foe.intent?.targetId).toBe(w.id);
  });
  it('markHunt prefers marked enemies', () => {
    const s = createState(setupFromPresets(3, 'elemental', 'bandits'));
    const r = byDef(s, 'rogue');
    const foes = s.units.filter((u) => u.team === 'enemy');
    r.pos = v(0, 0);
    foes[0]!.pos = v(1, 0.3);
    foes[1]!.pos = v(1, -0.3);
    addTag(s, foes[1]!, 'marked', 6, 0, 'x');
    r.cooldowns = { mark_for_death: 100, shadow_step: 100 };
    only(s, r);
    decide(s);
    expect(r.intent?.targetId).toBe(foes[1]!.id);
  });
  it('emits an intent event on change', () => {
    const s = createState(setupFromPresets(3, 'solo', 'tutorial'));
    only(s, s.units[0]!);
    decide(s);
    expect(s.events.some((e) => e.type === 'intent' && e.src === s.units[0]!.id)).toBe(true);
  });
  it('a full battle produces intents and ends', () => {
    const b = new Battle(setupFromPresets(11, 'standard', 'bandits'));
    let n = 0;
    let intents = 0;
    while (!b.outcome && n < 20 * 300) {
      intents += b.step().events.filter((e) => e.type === 'intent').length;
      n++;
    }
    expect(b.outcome).not.toBeNull();
    expect(intents).toBeGreaterThan(10);
  });
});

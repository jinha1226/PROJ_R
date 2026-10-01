import { describe, it, expect } from 'vitest';
import { slotToPos, lineOf, setupFromPresets, createState } from '../../src/sim/battle/setup';
import { Battle, runHeadless } from '../../src/sim/battle/battle';
import { makeSnapshot } from '../../src/sim/battle/snapshot';
import { stageMult } from '../../src/sim/battle/constants';

describe('battle setup', () => {
  it('maps formation slots symmetrically', () => {
    expect(slotToPos('ally', 2, 0)).toEqual({ x: -5, y: -4.5 });
    expect(slotToPos('ally', 0, 3)).toEqual({ x: -10, y: 4.5 });
    expect(slotToPos('enemy', 2, 0)).toEqual({ x: 5, y: -4.5 });
    expect(lineOf(2)).toBe('front');
    expect(lineOf(1)).toBe('mid');
    expect(lineOf(0)).toBe('back');
  });
  it('builds state with leader and stage-scaled enemies', () => {
    const s1 = createState(setupFromPresets(1, 'standard', 'bandits'));
    const s3 = createState(setupFromPresets(1, 'standard', 'skeletons'));
    expect(s1.units.filter((u) => u.team === 'ally')).toHaveLength(5);
    expect(s1.units[0]!.setup.isLeader).toBe(true);
    expect(s1.units[1]!.setup.isLeader).toBeFalsy();
    const war = s3.units.find((u) => u.setup.defId === 'skeleton_warrior')!;
    expect(war.maxHp).toBe(Math.round(120 * stageMult(3)));
    expect(war.hp).toBe(war.maxHp);
  });
  it('empty enemy side ends immediately with victory', () => {
    const r = runHeadless(setupFromPresets(1, 'solo', 'empty'));
    expect(r.outcome).toBe('victory');
    expect(r.ticks).toBeLessThanOrEqual(1);
  });
  it('empty ally side ends immediately with defeat', () => {
    const setup = setupFromPresets(1, 'solo', 'tutorial');
    setup.allies = [];
    const b = new Battle(setup);
    expect(b.step().events.some((e) => e.type === 'battle_end')).toBe(true);
    expect(b.outcome).toBe('defeat');
  });
  it('obstacles stay out of deploy zones', () => {
    for (let seed = 0; seed < 30; seed++)
      for (const o of setupFromPresets(seed, 'solo', 'tutorial').obstacles ?? []) expect(Math.abs(o.pos.x)).toBeLessThanOrEqual(3);
  });
  it('snapshot mirrors unit state', () => {
    const s = createState(setupFromPresets(1, 'standard', 'bandits'));
    const snap = makeSnapshot(s);
    expect(snap.units).toHaveLength(s.units.length);
    expect(snap.units[0]).toMatchObject({ id: s.units[0]!.id, hp: s.units[0]!.hp, alive: true, downed: false });
  });
});

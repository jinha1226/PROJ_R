import { describe, it, expect } from 'vitest';
import { applyBattleToRelations } from '../../src/sim/roster/relationships';
import { setupFromPresets } from '../../src/sim/battle/setup';
import type { BattleEvent } from '../../src/sim/battle/types';
import type { Relation, TraitId } from '../../src/data/types';

const allies = (traits: TraitId[][]) => {
  const s = setupFromPresets(1, 'standard', 'bandits').allies.slice(0, traits.length);
  return s.map((u, i) => ({ ...u, traits: traits[i]! }));
};
const find = (rels: Relation[], a: string, b: string) => rels.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
const ev = (e: Omit<BattleEvent, 'tick'> & { tick?: number }): BattleEvent => ({ tick: 0, ...e });

describe('post-battle relationship update', () => {
  it('fighting together builds affinity, scaled by chatty/loner', () => {
    const plain = applyBattleToRelations({ relations: [], allies: allies([[], []]), events: [], seed: 1 });
    expect(find(plain.relations, 'a0', 'a1')).toMatchObject({ affinity: 2, battlesTogether: 1 });
    const chatty = applyBattleToRelations({ relations: [], allies: allies([['chatty'], []]), events: [], seed: 1 });
    expect(find(chatty.relations, 'a0', 'a1')!.affinity).toBe(3);
    const loner = applyBattleToRelations({ relations: [], allies: allies([['loner'], []]), events: [], seed: 1 });
    expect(find(loner.relations, 'a0', 'a1')!.affinity).toBe(1);
  });
  it('trait compatibility helps or hurts', () => {
    const likes = applyBattleToRelations({ relations: [], allies: allies([['protective'], ['coward']]), events: [], seed: 1 });
    expect(find(likes.relations, 'a0', 'a1')!.affinity).toBe(3);
    const clash = applyBattleToRelations({ relations: [], allies: allies([['reckless'], ['cautious']]), events: [], seed: 1 });
    expect(find(clash.relations, 'a0', 'a1')!.affinity).toBe(0);
  });
  it('rescues and protection bring people together', () => {
    const r = applyBattleToRelations({
      relations: [], allies: allies([[], []]), seed: 1,
      events: [ev({ type: 'rescued', src: 'a0', dst: 'a1' }), ev({ type: 'relation_trigger', src: 'a1', dst: 'a0', data: { kind: 'protect' } })],
    });
    expect(find(r.relations, 'a0', 'a1')!.affinity).toBe(2 + 20 + 5);
    expect(r.moments.some((m) => m.kind === 'rescue' && m.a === 'a0' && m.b === 'a1')).toBe(true);
  });
  it('three last-hit contests make competitive pairs rivals', () => {
    const relations: Relation[] = [{ a: 'a0', b: 'a1', affinity: 0, rival: false, battlesTogether: 3, contests: 2 }];
    const r = applyBattleToRelations({
      relations, allies: allies([['competitive'], []]), seed: 1,
      events: [ev({ tick: 10, type: 'damage', src: 'a1', dst: 'e0', amount: 5 }), ev({ tick: 20, type: 'died', src: 'a0', dst: 'e0' })],
    });
    expect(find(r.relations, 'a0', 'a1')).toMatchObject({ rival: true, contests: 3 });
    expect(r.moments.some((m) => m.kind === 'newRival')).toBe(true);
    expect(relations[0]!.contests).toBe(2);
  });
  it('old damage does not count as a contest', () => {
    const r = applyBattleToRelations({
      relations: [], allies: allies([[], []]), seed: 1,
      events: [ev({ tick: 10, type: 'damage', src: 'a1', dst: 'e0', amount: 5 }), ev({ tick: 200, type: 'died', src: 'a0', dst: 'e0' })],
    });
    expect(find(r.relations, 'a0', 'a1')!.contests).toBe(0);
  });
  it('crossing the friend threshold is a moment', () => {
    const r = applyBattleToRelations({
      relations: [{ a: 'a0', b: 'a1', affinity: 39, rival: false, battlesTogether: 5, contests: 0 }],
      allies: allies([[], []]), events: [], seed: 1,
    });
    expect(r.moments).toContainEqual({ kind: 'newFriend', a: 'a0', b: 'a1' });
  });
  it('is deterministic and caps moments at 8', () => {
    const events = Array.from({ length: 20 }, (_, i) => ev({ type: 'pair_combo', src: 'a0', dst: 'a1', tick: i }))
      .concat(Array.from({ length: 20 }, (_, i) => ev({ type: 'rescued', src: i % 2 ? 'a0' : 'a2', dst: 'a1', tick: i })));
    const input = { relations: [], allies: allies([[], [], []]), events, seed: 9 };
    const a = applyBattleToRelations(input);
    const b = applyBattleToRelations(input);
    expect(a).toEqual(b);
    expect(a.moments.length).toBeLessThanOrEqual(8);
  });
});

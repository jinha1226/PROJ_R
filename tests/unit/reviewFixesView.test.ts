import { describe, it, expect } from 'vitest';
import { BattlePlayer } from '../../src/view/playback/battlePlayer';
import { EventRouter } from '../../src/view/playback/eventRouter';
import { guardFrame } from '../../src/ui/screens/loopGuard';
import { Battle } from '../../src/sim/battle/battle';
import { setupFromPresets } from '../../src/sim/battle/setup';
import type { Actor } from '../../src/view/actors/actor';

describe('review fixes (view)', () => {
  it('retreat works while paused', () => {
    const p = new BattlePlayer(new Battle(setupFromPresets(1, 'standard', 'bandits')), () => {});
    p.speed = 0;
    p.retreat();
    p.update(0.016);
    expect(p.battle.outcome).toBe('retreat');
  });
  it('downed actors do not play the hit animation', () => {
    const played: string[] = [];
    const fake = { isBusy: false, isDown: true, play: (k: string) => played.push(k), flash: () => {} } as unknown as Actor;
    const router = new EventRouter({
      actors: new Map([['a0', fake]]), fx: { slash() {}, burst() {}, glow() {} } as never,
      numbers: { show() {} } as never, posOf: () => ({ x: 0, z: 0, facing: 0 }), toScreen: () => ({ left: 0, top: 0 }),
      teamOf: () => 'ally', shake() {}, onSummon() {}, onBerserk() {}, log() {},
    });
    router.handle({ tick: 1, type: 'damage', src: 'e0', dst: 'a0', amount: 5, skillId: 'stab' });
    expect(played).not.toContain('hit');
  });
  it('frame guard reports errors once and stops', () => {
    const errors: unknown[] = [];
    expect(guardFrame(() => { throw new Error('boom'); }, (e) => errors.push(e))).toBe(false);
    expect(errors).toHaveLength(1);
    expect(guardFrame(() => {}, (e) => errors.push(e))).toBe(true);
  });
});

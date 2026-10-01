import { describe, it, expect } from 'vitest';
import { EventRouter, type RouterDeps } from '../../src/view/playback/eventRouter';
import type { Actor } from '../../src/view/actors/actor';

const setup = () => {
  const calls: string[] = [];
  const fake = { isBusy: false, isDown: false, play: () => {}, flash: () => {} } as unknown as Actor;
  const deps: RouterDeps = {
    actors: new Map([['a0', fake], ['a1', fake]]), fx: { slash() {}, burst() {}, glow() {} } as never,
    numbers: { show() {} } as never, posOf: () => ({ x: 0, z: 0, facing: 0 }), toScreen: () => ({ left: 0, top: 0 }),
    teamOf: () => 'ally', shake() {}, onSummon() {}, onBerserk() {}, log() {},
    tether: (a, b, kind) => calls.push(`tether:${a}-${b}:${kind}`),
    bark: (id, key) => calls.push(`bark:${id}:${key}`),
    popIcon: (id, icon) => calls.push(`pop:${id}:${icon}`),
    slowmo: () => calls.push('slowmo'),
    punch: () => calls.push('punch'),
  };
  return { router: new EventRouter(deps), calls };
};

describe('event router: relationships and emotions', () => {
  it('relation triggers draw a tether, pop an icon, and bark', () => {
    const { router, calls } = setup();
    router.handle({ tick: 1, type: 'relation_trigger', src: 'a0', dst: 'a1', data: { kind: 'protect' } });
    expect(calls).toEqual(expect.arrayContaining(['tether:a0-a1:protect', 'pop:a0:relation:protect', 'bark:a0:protect']));
  });
  it('a rival kill uses the rivalKill line', () => {
    const { router, calls } = setup();
    router.handle({ tick: 1, type: 'relation_trigger', src: 'a1', dst: 'a0', data: { kind: 'rivalry', kill: true } });
    expect(calls).toContain('bark:a1:rivalKill');
  });
  it('pair combos slow time and punch the camera', () => {
    const { router, calls } = setup();
    router.handle({ tick: 1, type: 'pair_combo', src: 'a0', dst: 'a1', skillId: 'shield_chant' });
    expect(calls).toEqual(expect.arrayContaining(['slowmo', 'punch', 'tether:a0-a1:combo', 'bark:a0:combo']));
  });
  it('rage and fear show emotion icons and bark', () => {
    const { router, calls } = setup();
    router.handle({ tick: 1, type: 'emotion', dst: 'a1', data: { id: 'fear' } });
    expect(calls).toEqual(expect.arrayContaining(['pop:a1:emotion:fear', 'bark:a1:fear']));
  });
  it('generic bark events are forwarded', () => {
    const { router, calls } = setup();
    router.handle({ tick: 1, type: 'bark', src: 'a0', dst: 'a1', data: { key: 'downedFriend' } });
    expect(calls).toContain('bark:a0:downedFriend');
  });
});

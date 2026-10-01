import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { EventRouter } from '../../src/view/playback/eventRouter';
import { applyTierGlow, restoreGlow } from '../../src/view/actors/gearLook';
import { TIER_LOOK } from '../../src/view/actors/gearLook';
import { t } from '../../src/ui/i18n/ko';
import type { Actor } from '../../src/view/actors/actor';

const router = () => new EventRouter({
  actors: new Map([['a0', { isBusy: false, isDown: false, play() {}, flash() {} } as unknown as Actor]]),
  fx: { slash() {}, burst() {}, glow() {} } as never, numbers: { show() {} } as never,
  posOf: () => ({ x: 0, z: 0, facing: 0 }), toScreen: () => ({ left: 0, top: 0 }), teamOf: () => 'ally',
  shake() {}, onSummon() {}, onBerserk() {}, log() {}, tether() {}, bark() {}, popIcon() {}, slowmo() {}, punch() {},
});

describe('plan 3 review fixes (view)', () => {
  it('damage from non-skill sources (thorns, lifesteal) does not crash the router', () => {
    expect(() => router().handle({ tick: 1, type: 'damage', src: 'e0', dst: 'a0', amount: 3, skillId: 'thorns' })).not.toThrow();
    expect(() => router().handle({ tick: 1, type: 'damage', src: 'e0', dst: 'a0', amount: 3, skillId: 'whatever' })).not.toThrow();
  });
  it('battle log names thorns and lifesteal in Korean', () => {
    expect(t('skill.thorns')).not.toBe('skill.thorns');
    expect(t('skill.lifesteal')).not.toBe('skill.lifesteal');
  });
  it('gear glow returns to its own tier color after a hit flash', () => {
    const mat = new THREE.MeshStandardMaterial();
    applyTierGlow(mat, TIER_LOOK[3]!);
    mat.emissive.setHex(0xffffff);
    restoreGlow(mat);
    expect(`#${mat.emissive.getHexString()}`).toBe(TIER_LOOK[3]!.color);
  });
});

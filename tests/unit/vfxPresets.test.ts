import { describe, expect, it } from 'vitest';
import { PRESETS, TILE } from '../../src/view/fx/vfx';

describe('vfx presets', () => {
  it('every effect has layers with sane ranges and a real tile', () => {
    for (const [kind, layers] of Object.entries(PRESETS)) {
      expect(layers.length, kind).toBeGreaterThan(0);
      for (const l of layers) {
        expect(TILE[l.tile], kind).toBeGreaterThanOrEqual(0);
        expect(l.count[0], kind).toBeGreaterThanOrEqual(1);
        expect(l.count[0], kind).toBeLessThanOrEqual(l.count[1]);
        expect(l.life[0], kind).toBeGreaterThan(0);
        expect(l.life[0], kind).toBeLessThanOrEqual(l.life[1]);
        expect(l.size[0], kind).toBeLessThanOrEqual(l.size[1]);
      }
    }
  });

  it('effects stay short: nothing outlives a turn and a half', () => {
    for (const layers of Object.values(PRESETS)) for (const l of layers) expect(l.life[1]).toBeLessThanOrEqual(1.5);
  });
});

describe('vfx firing', () => {
  it('a reused effect bursts where it is fired, not where it last went off', async () => {
    const THREE = await import('three');
    const { Vfx } = await import('../../src/view/fx/vfx');
    const fx = new Vfx(new THREE.Texture()), scene = new THREE.Scene(); scene.add(fx.root);
    for (let i = 0; i < 4; i++) { fx.fire('hit', new THREE.Vector3(0, 0, 0)); fx.update(0.016); }
    fx.fire('hit', new THREE.Vector3(12, 0, 7)); fx.update(0.016); fx.update(0.016);
    const ps = (fx as unknown as { pools: Map<string, { systems: { particles: { position: { x: number; z: number } }[]; particleNum: number }[] }[]> }).pools.get('hit')![0]!.systems[0]!;
    expect(ps.particleNum).toBeGreaterThan(0);
    for (let i = 0; i < ps.particleNum; i++) { expect(Math.abs(ps.particles[i]!.position.x - 12)).toBeLessThan(2); expect(Math.abs(ps.particles[i]!.position.z - 7)).toBeLessThan(2); }
  });
});

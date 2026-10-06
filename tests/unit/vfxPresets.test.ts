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

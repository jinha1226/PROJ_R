import { describe, it, expect } from 'vitest';
import { createState, setupFromPresets } from '../../src/sim/battle/setup';
import { STAGE_SCALE } from '../../src/sim/battle/constants';

describe('spawn positions', () => {
  it('uses explicit spawn/facing when given', () => {
    const setup = setupFromPresets(1, 'standard', 'bandits');
    setup.allies[0] = { ...setup.allies[0]!, spawn: { x: 3, y: -2 }, facing: Math.PI / 2 };
    const s = createState(setup);
    expect(s.units[0]!.pos).toEqual({ x: 3, y: -2 });
    expect(s.units[0]!.facing).toBeCloseTo(Math.PI / 2);
    expect(s.units[1]!.pos).toEqual({ x: -5, y: 1.5 });
  });
  it('enemy stage scaling is 6% per stage', () => {
    expect(STAGE_SCALE).toBe(0.06);
  });
});

import { describe, it, expect } from 'vitest';
import { shipZoom } from '../../src/view/grid/shipFrame';

describe('framing the ship deck', () => {
  it('fits the whole 15 × 11 deck in landscape and in portrait', () => {
    const land = shipZoom(15, 11, 844 / 390);
    expect(land).toBeGreaterThanOrEqual(12);
    expect(land * (844 / 390)).toBeGreaterThanOrEqual(15.999);
    const port = shipZoom(15, 11, 390 / 844);
    expect(port * (390 / 844)).toBeGreaterThanOrEqual(15.999);
  });
});

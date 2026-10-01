import { describe, it, expect } from 'vitest';
import { gearLook, TIER_LOOK } from '../../src/view/actors/gearLook';

describe('gear look', () => {
  it('tints only gear meshes by tier', () => {
    const look = gearLook({ model: 'Knight', gear: { weapon: '1H_Sword', offhand: 'Round_Shield', helmet: true, cape: false }, gearTiers: { weapon: 4, armor: 0 } });
    expect(look.tints['1H_Sword']).toEqual(TIER_LOOK[4]);
    expect(look.tints.Round_Shield).toEqual(TIER_LOOK[4]);
    expect(look.tints.Knight_Helmet).toEqual(TIER_LOOK[0]);
    expect(look.tints.Knight_Body).toBeUndefined();
    expect(look.propTint).toEqual(TIER_LOOK[4]);
  });
  it('worn gear is desaturated and non-metallic; legendary glows', () => {
    expect(TIER_LOOK[0]!.metalness).toBe(0);
    expect(TIER_LOOK[4]!.emissive).toBeGreaterThan(0);
    expect(TIER_LOOK[1]!.amount).toBe(0);
  });
  it('heroes get an aura; injured flag passes through', () => {
    expect(gearLook({ model: 'Mage', gear: { weapon: 'Staff', helmet: false, cape: true }, rank: 'hero' }).aura).toBe(true);
    expect(gearLook({ model: 'Mage', gear: { weapon: 'Staff', helmet: false, cape: true }, rank: 'veteran' }).aura).toBe(false);
  });
});

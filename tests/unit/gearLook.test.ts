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
  it('good gloves and boots tint the arms and legs; plain ones do not', () => {
    const gear = { weapon: '1H_Sword', helmet: false, cape: false };
    const good = gearLook({ model: 'Knight', gear, gearTiers: { hands: 3, feet: 2 } });
    expect(good.tints.Knight_ArmLeft).toBe(TIER_LOOK[3]);
    expect(good.tints.Knight_LegRight).toBe(TIER_LOOK[2]);
    const plain = gearLook({ model: 'Knight', gear, gearTiers: { hands: 1, feet: 0 } });
    expect(plain.tints.Knight_ArmLeft).toBeUndefined();
    expect(plain.tints.Knight_LegLeft).toBeUndefined();
  });
});

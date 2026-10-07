import { describe, expect, it } from 'vitest';
import { wearsPart } from '../../src/view/grid/outfitKit';
import { lookOf, outfitOf } from '../../src/ui/party/partyPick';

describe('outfits', () => {
  it('a peasant wears its own pieces and only the ranger pieces it asks for', () => {
    const look = { set: 'Peasant' as const, tint: '#fff', extra: ['pauldron' as const] };
    expect(wearsPart('Male_Peasant_Body', look)).toBe(true);
    expect(wearsPart('Male_Ranger_Acc_Pauldron', look)).toBe(true);
    expect(wearsPart('Male_Ranger_Head_Hood', look)).toBe(false);
    expect(wearsPart('Male_Ranger_Body', look)).toBe(false);
  });

  it('a ranger leaves its hood off unless asked', () => {
    expect(wearsPart('Male_Ranger_Head_Hood', { set: 'Ranger', tint: '#fff' })).toBe(false);
    expect(wearsPart('Male_Ranger_Head_Hood', { set: 'Ranger', tint: '#fff', extra: ['hood'] })).toBe(true);
    expect(wearsPart('Male_Ranger_Feet_Boots', { set: 'Ranger', tint: '#fff' })).toBe(true);
  });

  it('every soul is dressed; the empty clone stays bare and keeps its grey', () => {
    expect(outfitOf('shell')).toBeUndefined();
    expect(lookOf('shell', 'fists').outfit).toBeUndefined();
    for (const cls of ['warrior', 'berserker', 'guardian', 'archer', 'sniper', 'hunter', 'mage', 'elementalist', 'necromancer', 'cleric', 'healer', 'inquisitor', 'rogue', 'assassin', 'toxicologist'] as const) expect(outfitOf(cls)).toBeDefined();
    expect(outfitOf('hunter')).toBe(outfitOf('archer'));
    expect(lookOf('archer', 'longbow').body).toBe(lookOf('mage', 'staff').body);
  });
});

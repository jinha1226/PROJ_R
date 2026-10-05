import type { Family } from '../../../src/sim/grid/engraveDefs';
import type { MetaState } from '../../../src/sim/grid/meta';
import { effectiveMods, MODS, type ModDef, type PerkId } from '../../../src/sim/grid/mods';
import { guardian, stoneMod } from '../../../src/sim/grid/stones';
import type { GAction, GridState } from '../../../src/sim/grid/types';
import { archetype } from './build';

const UNIVERSAL: Partial<Record<PerkId, number>> = { soulCell: 14, regenPack: 13, soulWeave: 11, undyingHeart: 20 };
const GUN: PerkId[] = ['scatter', 'pierceBarrel', 'runeScope', 'bayonetGrip', 'doubleTap'];
const MELEE: PerkId[] = ['hookArms', 'shockArms', 'chargeLegs', 'reactive', 'whirlHeart'];
const VALUES = { perk: 5, preferred: 7, element: 12, thermal: 2, silent: 4 };
export function scoreMod(m: ModDef, family: Family): number {
  if (m.perk) {
    if (UNIVERSAL[m.perk]) return UNIVERSAL[m.perk]!;
    if (m.perk === 'thermal') return VALUES.thermal;
    if (m.perk === 'silentLegs') return family === 'melee' ? VALUES.preferred + VALUES.silent : VALUES.silent;
    if (family === 'element' && ['elemChamber', 'elemTank'].includes(m.perk)) return VALUES.element;
    return VALUES.perk + ((family === 'ranged' || family === 'fusion') && GUN.includes(m.perk)
      || family === 'melee' && MELEE.includes(m.perk) ? VALUES.preferred : 0);
  }
  const v = m.stats;
  return (v.maxHp ?? 0) + (v.shield ?? 0) * 2 + (v.evasion ?? 0) * 20
    + (family === 'melee' ? (v.meleeDmg ?? 0) * 4
      : (v.gunDmg ?? 0) * 4 + (v.hit ?? 0) * 30 + (v.maxCharge ?? 0) + -(v.swap ?? 0) * 8);
}
/** A supplied campaign meta enables retreat; standalone runs carry guardians to the core. */
export function pickStone(s: GridState, campaign?: MetaState): GAction {
  const id = s.stonePrompt, keep: GAction = { kind: 'socket', stone: null };
  if (!id || !s.run.stones.includes(id) || Object.values(s.hero.sockets ?? {}).includes(id)) return keep;
  const mod = stoneMod(id); if (!mod) return keep;
  const g = guardian(id);
  if (g) return campaign && !campaign.portals.includes(g.floor) ? { kind: 'portal', stone: id } : { kind: 'socket', stone: id };
  const fitted = effectiveMods(s.hero.baseMods ?? {}, s.hero.sockets ?? {});
  const old = MODS.find(m => m.id === fitted[mod.slot]);
  const family = archetype(s);
  return scoreMod(mod, family) > (old ? scoreMod(old, family) : 0) ? { kind: 'socket', stone: id } : keep;
}

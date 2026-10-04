import type { WeaponGroup } from '../../sim/grid/items';
import type { UalIdle } from './ualActor';
import type { WeaponLook } from './weaponMeshes';

/** What the hero shows in hand: nothing aboard the ship or with empty hands, else the group in use. */
export const heroLook = (group: WeaponGroup | undefined, onShip: boolean): WeaponLook => (onShip ? 'none' : group ?? 'none');

/** The stance for a look: guns at the ready, empty hands and casters at ease, blades on guard. */
export function stanceFor(kind: WeaponLook): UalIdle {
  if (kind === 'pistol') return 'Pistol_Idle_Loop';
  if (kind === 'none' || kind === 'bow' || kind === 'crossbow') return 'Idle_Loop';
  return 'Sword_Idle';
}

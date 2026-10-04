import type { WeaponLook } from './weaponMeshes';

/** Match the weapon actually used, including a gun used to bash. */
export function handSwap(main: WeaponLook, off: WeaponLook, group?: WeaponLook): [WeaponLook, WeaponLook] | null {
  return group !== undefined && main !== group && off === group ? [off, main] : null;
}

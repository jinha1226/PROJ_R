import { weaponDef } from '../delve/gear';
import type { Party, Unit } from './partyCore';

/** rounds in the pistol's magazine (fixed: no magazine modules) */
export const MAG = 6;
export const isGun = (u: Unit): boolean => weaponDef(u)?.family === 'gun';
export const magOf = (p: Party, u: Unit): number => { void p; void u; return MAG; };
/** a reload takes one attack's time */
export const reloadTime = (p: Party, u: Unit): number => { void p; void u; return 1; };

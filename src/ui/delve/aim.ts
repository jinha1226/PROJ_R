import type { Unit } from '../../sim/party/partyCore';
import { AIMED, ultSlots } from '../../sim/party/ultimate';

/** Whether this soul's ultimate waits for the player to pick a cell. */
export const aimNeeded = (u: Unit, slot: number): boolean => { const s = ultSlots(u).find((x) => x.slot === slot); return !!s && AIMED.includes(s.ult); };

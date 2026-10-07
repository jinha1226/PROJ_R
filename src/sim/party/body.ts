import type { HeroSoulId } from '../delve/heroSouls';
import type { MemoryId } from './memories';
import type { BaseClass } from './partyDefs';
import type { Unit } from './partyCore';

/** A soul in a body: its class, the hero it was (if named), the memory it carried, when its ultimate is ready again. */
export interface BodySoul { cls: BaseClass; hero?: HeroSoulId; memory?: MemoryId; ultReady: number }
/** souls one body holds before the lab is upgraded */
export const BASE_SOUL_SLOTS = 2;

export const soulsOf = (u: Unit): BodySoul[] => u.souls ?? [];
/** the class lines the body's souls bring (the first is the body's own class) */
export const linesOf = (u: Unit): BaseClass[] => soulsOf(u).map((s) => s.cls);
export const memoriesOf = (u: Unit): MemoryId[] => soulsOf(u).flatMap((s) => (s.memory ? [s.memory] : []));
export const hasMemory = (u: Unit, id: MemoryId): boolean => soulsOf(u).some((s) => s.memory === id);

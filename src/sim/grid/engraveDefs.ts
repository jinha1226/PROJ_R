import type { EngraveId } from './engraveCore';
import type { Trigger, TriggerCtx } from './kataBus';
import type { EffectId } from './kataEffects';
import type { GridState } from './types';

export type Family = 'melee' | 'ranged' | 'fusion' | 'element';
export interface EngraveDef { on: Trigger; when?: (s: GridState, c: TriggerCtx) => boolean; effect: EffectId; p?: number; afterBlow?: boolean }

/** Hand-written engravings are deliberately absent. */
export const DEFS: Partial<Record<EngraveId, EngraveDef>> = {
  gunRelay: { on: 'meleeKill', effect: 'shootNearest' },
  bladeRelay: { on: 'gunKill', effect: 'dashSlash' },
  spinShot: { on: 'surrounded', effect: 'spinShot', afterBlow: true },
  counterShot: { on: 'dodge', effect: 'shootFoe' },
  execute: { on: 'stunned', effect: 'execute' },
  flow: { on: 'chain', effect: 'freeNext' },
};

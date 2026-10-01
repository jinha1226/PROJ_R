import type { Rng } from '../../core/rng';
import type { TacticId, TraitId } from '../../data/types';
import type { Mercenary } from '../roster/types';
import type { RunState } from './types';

export type EventEffect =
  | { kind: 'gold'; amount: number }
  | { kind: 'affinity'; a: string; b: string; amount: number }
  | { kind: 'injure'; merc: string; battles: number }
  | { kind: 'healAll' }
  | { kind: 'item'; itemId: string }
  | { kind: 'tactic'; tacticId: TacticId }
  | { kind: 'xp'; mercs: string[]; amount: number }
  | { kind: 'rival'; a: string; b: string };

export interface EventCtx {
  run: RunState;
  rng: Rng;
  party: Mercenary[];
  /** first living member with the trait (revealed or not) */
  withTrait(t: TraitId, except?: string[]): Mercenary | undefined;
  /** ids/names chosen at setup, stable between view and resolution */
  vars: Record<string, string>;
}

export interface Resolution {
  effects: EventEffect[];
  resultKey: string;
  vars?: Record<string, string>;
}

export interface ChoiceDef {
  id: string;
  textKey: string;
  /** a party member with this trait must exist; they become the actor */
  trait?: TraitId;
  /** a second, different member with this trait must also exist */
  trait2?: TraitId;
  gold?: number;
  resolve(ctx: EventCtx): Resolution;
}

export interface EventDef {
  id: string;
  requires?(ctx: EventCtx): boolean;
  /** picks members/names used by the text and the choices */
  setup?(ctx: EventCtx): Record<string, string>;
  choices: ChoiceDef[];
}

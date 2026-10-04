import { fire, has } from './engraveCore';
import { DEFS } from './engraveDefs';
import { canRun, runEffect } from './kataEffects';
import type { Element } from './items';
import type { Ent, GridState } from './types';
import type { ShotHooks } from './weapons';

export type Trigger =
  | 'meleeHit' | 'meleeKill' | 'gunHit' | 'gunKill' | 'dodge' | 'parry' | 'hurt'
  | 'stunned' | 'elementApplied' | 'reaction' | 'surrounded' | 'afterMove' | 'afterSwap' | 'afterWait' | 'chain';
export interface TriggerCtx {
  t: number; foe?: Ent; src?: string; element?: Element; count?: number; hooks?: ShotHooks;
  /** Neighbours captured before the main blow; spin resolves after it. */
  neighbours?: Ent[];
  afterBlow?: (() => void)[];
  /** Extra action time accrued by a dash, shared with the caller. */
  timeCost?: number;
  shotCost?: number;
}

/** Dispatch in suit order. Mark before running so nested attacks cannot loop. */
export function emit(s: GridState, trigger: Trigger, ctx: TriggerCtx): void {
  for (const id of s.hero.suit) {
    const def = DEFS[id];
    if (!def || def.on !== trigger) continue;
    const resolve = () => {
      if (!has(s, id) || (def.when && !def.when(s, ctx))) return;
      if (canRun(s, def.effect, ctx, def.p) && fire(s, ctx.t, id)) runEffect(s, def.effect, ctx, def.p);
    };
    // Spin keeps its original post-hit recharge/target ordering, even though surrounded is announced first.
    if (def.afterBlow && ctx.afterBlow) ctx.afterBlow.push(resolve);
    else resolve();
  }
}

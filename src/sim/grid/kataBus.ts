import { fire, has } from './engraveCore';
import { DEFS } from './engraveDefs';
import { canRun, runEffect } from './kataEffects';
import type { Element } from './items';
import type { Ent, GridState } from './types';
import type { ShotHooks } from './weapons';

export type Trigger =
  | 'preShot' | 'meleeHit' | 'meleeKill' | 'gunHit' | 'gunKill' | 'dodge' | 'parry' | 'hurt'
  | 'stunned' | 'elementApplied' | 'reaction' | 'surrounded' | 'afterMove' | 'afterSwap' | 'afterWait' | 'chain';
export interface TriggerCtx {
  t: number; foe?: Ent; src?: string; element?: Element; count?: number; hooks?: ShotHooks;
  /** Neighbours captured before the main blow; spin resolves after it. */
  neighbours?: Ent[];
  afterBlow?: (() => void)[];
  /** Extra action time accrued by a dash, shared with the caller. */
  timeCost?: number;
  shotCost?: number;
  chargeCost?: number;
  shotOnly?: boolean;
  through?: Ent;
  meleeExecute?: boolean;
  activeBlade?: boolean;
  /** Legacy relay propagation can include a nested attack of the other kind. */
  inheritedKill?: boolean;
}

/** Dispatch in suit order. Mark before running so nested attacks cannot loop. */
export function emit(s: GridState, trigger: Trigger, ctx: TriggerCtx): void {
  const afterTrigger: (() => void)[] = [];
  for (const id of s.hero.suit) {
    const def = DEFS[id];
    if (!def || def.on !== trigger) continue;
    const resolve = () => {
      if (!has(s, id) || (def.when && !def.when(s, ctx))) return;
      const targets = def.targets?.(s, ctx) ?? [ctx];
      if (!targets.some(c => canRun(s, def.effect, c, def.p)) || !fire(s, ctx.t, id)) return;
      for (const c of targets) runEffect(s, def.effect, c, def.p);
    };
    // Spin keeps its original post-hit recharge/target ordering, even though surrounded is announced first.
    if (def.afterBlow && ctx.afterBlow) ctx.afterBlow.push(resolve);
    else if (def.afterTrigger) afterTrigger.push(resolve);
    else resolve();
  }
  afterTrigger.forEach(resolve => resolve());
}

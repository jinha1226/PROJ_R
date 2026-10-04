import { emit, type TriggerCtx } from './kataBus';
import type { GridState } from './types';
import type { ShotHooks } from './weapons';

/** Snapshot before dispatch: nested effects must not extend this attack's iteration. */
export function emitKills(s: GridState, t: number, start: number, kind: 'meleeKill' | 'gunKill', hooks?: ShotHooks, shotCost?: number): number {
  const kills = s.events.slice(start).filter(e => e.type === 'die' && e.src === s.hero.id);
  const ctx: TriggerCtx = { t, hooks, shotCost, count: kills.length, timeCost: 0 };
  for (const e of kills) {
    ctx.foe = s.foes.find(f => f.id === e.dst);
    emit(s, kind, ctx);
  }
  return ctx.timeCost ?? 0;
}

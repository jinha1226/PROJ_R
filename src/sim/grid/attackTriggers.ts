import { emit, type TriggerCtx } from './kataBus';
import type { GridState } from './types';
import type { ShotHooks } from './weapons';

/** Snapshot before dispatch: nested effects must not extend this attack's iteration. */
export function emitKills(s: GridState, t: number, start: number, kind: 'meleeKill' | 'gunKill', hooks?: ShotHooks, shotCost?: number): number {
  const memory = s.hero.fx.kills ??= { melee: [], gun: [] };
  const credited = [...memory.melee, ...memory.gun];
  const kills = s.events.slice(start).filter(e => e.type === 'die' && e.src === s.hero.id && e.dst);
  const list = kind === 'meleeKill' ? memory.melee : memory.gun;
  list.push(...kills.map(e => e.dst!).filter(id => !credited.includes(id)));
  const ctx: TriggerCtx = { t, hooks, shotCost, count: list.length, timeCost: 0 };
  for (const e of kills) {
    // Old relays also see nested kills; new rewards only see this attack's newly credited kills.
    ctx.inheritedKill = credited.includes(e.dst!);
    ctx.foe = s.foes.find(f => f.id === e.dst);
    emit(s, kind, ctx);
  }
  return ctx.timeCost ?? 0;
}

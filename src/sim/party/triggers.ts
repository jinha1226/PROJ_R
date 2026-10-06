import { CATALOG } from '../delve/catalog';
import { worn } from '../delve/gear';
import { TRAITS } from './traitDefs';
import { kitOf, proficient } from './classKit';
import { alive, posOf, type Party, type Unit } from './partyCore';
import { dist, type GEvent } from '../grid/types';
import type { StatusId } from './status';
export type Cond = 'hit' | 'crit' | 'kill' | 'struck' | 'block' | 'dodge' | 'crisis' | 'nth' | 'still' | 'moved' | 'allyHit' | 'allyCrisis' | 'combatStart' | 'statusApplied' | 'ultimate' | 'healed' | 'taunt' | 'allyUltimate' | 'beforeHit' | 'guard' | 'overflow' | 'fireball';
export interface Ctx { t: number; src: Unit; target?: Unit; amount?: number; status?: StatusId; depth: number; ev: GEvent[] }
export interface TriggerDef { id: string; when: Cond; cd?: number; chance?: number; nth?: number; test?: (p: Party, c: Ctx) => boolean; run: (p: Party, c: Ctx) => void }
export const CHAIN_CAP = 5;
export function sourcesOf(_p: Party, u: Unit): TriggerDef[] { return [...(proficient(u) ? kitOf(u).innate.map(d=>({...d,cd:d.id==='포위 베기'?6-(u.traits?.whirlwind??0):d.id==='구원의 손'?8-2*(u.traits?.quickPrayer??0):d.cd,nth:d.id==='연쇄 주문'&&(u.traits?.quickChant??0)>=2?2:d.nth})) : []), ...Object.entries(u.traits??{}).flatMap(([id,r])=>r&&TRAITS[id]?.trigger?[TRAITS[id]!.trigger!(r)]:[]), ...worn(u).flatMap(it=>CATALOG[it.def]!.triggers), ...(u.triggers ?? [])]; }
// A shared action budget covers siblings as well as recursive calls, including damage callbacks.
const actions = new WeakMap<Party, { count: number; depth: number }>();
export function action<T>(p:Party,run:()=>T):T {
  if(actions.has(p))return run();
  actions.set(p,{count:0,depth:0});
  try{return run();}finally{actions.delete(p);}
}
export function emit(p: Party, cond: Cond, input: Omit<Ctx, 'depth'> & { depth?: number }): void {
  if (!alive(p, input.src)) return;
  const root = !actions.has(p), action = actions.get(p) ?? { count: 0, depth: 0 };
  if (root) actions.set(p, action);
  const c: Ctx = { ...input, depth: action.depth };
  try {
    if (cond === 'crisis') { if (c.src.crisisUsed) return; c.src.crisisUsed = true; }
    for (const def of sourcesOf(p, c.src)) {
      if (!alive(p, c.src) || action.count >= CHAIN_CAP) break;
      if (def.when !== cond || c.t < (c.src.trig[def.id] ?? 0) || (def.nth && c.src.nth % def.nth !== 0) || (def.test && !def.test(p, c))) continue;
      if (def.chance !== undefined && !p.s.rng.chance(def.chance)) continue;
      const before = effectState(p), oldReady = c.src.trig[def.id], eventAt = c.ev.length;
      // Reserve a slot before entering recursive callbacks; release it for a no-op.
      c.src.trig[def.id] = c.t + (def.cd ?? 0) * (c.src.traits?.fanatic ? .5 : 1);
      action.count++; action.depth++;
      try { def.run(p, { ...c, depth: action.depth }); } finally { action.depth--; }
      if (effectState(p) !== before) {
        c.ev.splice(eventAt, 0, { t: c.t, type: 'buff', src: c.src.id, text: def.id });
      } else {
        action.count--;
        if (oldReady === undefined) delete c.src.trig[def.id]; else c.src.trig[def.id] = oldReady;
      }
    }
    if (cond === 'hit' || cond === 'crisis' || cond === 'ultimate') for (const ally of p.units) {
      if (!c.src.traits?.loneWolf && !ally.traits?.loneWolf && ally !== c.src && ally.side === 'hero' && c.src.side === 'hero' && alive(p, ally) && dist(posOf(p, ally), posOf(p, c.src)) <= (cond==='ultimate'?3:2)) {
        emit(p, cond === 'hit' ? 'allyHit' : cond === 'ultimate' ? 'allyUltimate' : 'allyCrisis', { ...c, src: ally, target: cond === 'hit' ? c.target : c.src });
      }
    }
  } finally { if (root) actions.delete(p); }
}

// Ignore cooldown bookkeeping and presentation events when deciding whether an effect worked.
function effectState(p: Party): string {
  return JSON.stringify([p.units.map(u => ({ ...u, trig: undefined, triggers: undefined })),
    [p.s.hero, ...p.s.foes].map(e => [e.id, e.hp, e.alive, e.pos]), p.grounds]);
}

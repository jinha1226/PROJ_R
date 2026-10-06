import { CATALOG } from '../delve/catalog';
import { worn } from '../delve/gear';
import { TRAITS } from './traitDefs';
import { kitOf, proficient } from './classKit';
import { alive, posOf, type Party, type Unit } from './partyCore';
import { dist, type GEvent } from '../grid/types';
import type { StatusId } from './status';
export type Cond = 'hit' | 'crit' | 'kill' | 'struck' | 'block' | 'dodge' | 'crisis' | 'nth' | 'still' | 'moved' | 'allyHit' | 'allyCrisis' | 'combatStart' | 'statusApplied' | 'ultimate' | 'healed' | 'taunt' | 'allyUltimate' | 'beforeHit' | 'guard' | 'overflow' | 'fireball' | 'counter' | 'shieldBreak' | 'summonDied' | 'reaction' | 'wait';
export interface Ctx { t: number; src: Unit; target?: Unit; amount?: number; status?: StatusId; reaction?: string; over?: number; depth: number; ev: GEvent[] }
export interface TriggerDef { id: string; when: Cond; cd?: number; chance?: number; nth?: number; test?: (p: Party, c: Ctx) => boolean; run: (p: Party, c: Ctx) => void; repeat?: boolean }
export const CHAIN_CAP = 12;
export function sourcesOf(_p: Party, u: Unit): TriggerDef[] { return [...(proficient(u) ? kitOf(u).innate.map(d=>({...d,cd:d.id==='포위 베기'?6-(u.traits?.whirlwind??0):d.id==='구원의 손'?8-2*(u.traits?.quickPrayer??0):d.cd,nth:d.id==='연쇄 주문'&&(u.traits?.quickChant??0)>=2?2:d.nth})) : []), ...Object.entries(u.traits??{}).flatMap(([id,r])=>r&&TRAITS[id]?[...(TRAITS[id]!.trigger?[TRAITS[id]!.trigger!(r)]:[]),...(TRAITS[id]!.triggers?.(r)??[])]:[]), ...worn(u).flatMap(it=>CATALOG[it.def]!.triggers), ...(u.triggers ?? [])]; }
// A shared action budget covers siblings as well as recursive calls, including damage callbacks.
// Within one action an effect fires once (unless it repeats); three or more effects leave a chain event for the screen.
interface ChainState { count: number; depth: number; fired: Set<string>; ev?: GEvent[]; src?: string; t: number }
const actions = new WeakMap<Party, ChainState>();
const fresh = (t: number): ChainState => ({ count: 0, depth: 0, fired: new Set(), t });
function close(p: Party, s: ChainState): void {
  actions.delete(p);
  if (s.count >= 3 && s.ev) s.ev.push({ t: s.t, type: 'buff', src: s.src, text: 'chain', amount: s.count });
}
export function action<T>(p:Party,run:()=>T):T {
  if(actions.has(p))return run();
  const s=fresh(p.time);actions.set(p,s);
  try{return run();}finally{close(p,s);}
}
export function emit(p: Party, cond: Cond, input: Omit<Ctx, 'depth'> & { depth?: number }): void {
  if (!alive(p, input.src)) return;
  if (cond === 'moved') input.src.steady = 0;
  const root = !actions.has(p), action = actions.get(p) ?? fresh(input.t);
  if (root) actions.set(p, action);
  const c: Ctx = { ...input, depth: action.depth };
  try {
    if (cond === 'crisis') { if (c.src.crisisUsed) return; c.src.crisisUsed = true; }
    for (const def of sourcesOf(p, c.src)) {
      if (!alive(p, c.src) || action.count >= CHAIN_CAP) break;
      const key = `${c.src.id}:${def.id}`;
      if (def.when !== cond || (!def.repeat && action.fired.has(key)) || c.t < (c.src.trig[def.id] ?? 0) || (def.nth && c.src.nth % def.nth !== 0) || (def.test && !def.test(p, c))) continue;
      if (def.chance !== undefined && !p.s.rng.chance(def.chance)) continue;
      const before = effectState(p), oldReady = c.src.trig[def.id], eventAt = c.ev.length;
      // Reserve a slot before entering recursive callbacks; release it for a no-op.
      c.src.trig[def.id] = c.t + (def.cd ?? 0) * (c.src.traits?.fanatic ? .5 : 1);
      const had = action.fired.has(key); action.fired.add(key);
      action.count++; action.depth++;
      try { def.run(p, { ...c, depth: action.depth }); } finally { action.depth--; }
      if (effectState(p) !== before) {
        action.ev ??= c.ev; action.src ??= c.src.id; action.t = c.t;
        c.ev.splice(eventAt, 0, { t: c.t, type: 'buff', src: c.src.id, text: def.id });
      } else {
        if (!had) action.fired.delete(key);
        action.count--;
        if (oldReady === undefined) delete c.src.trig[def.id]; else c.src.trig[def.id] = oldReady;
      }
    }
    if (cond === 'hit' || cond === 'crisis' || cond === 'ultimate') for (const ally of p.units) {
      if (!c.src.traits?.loneWolf && !ally.traits?.loneWolf && ally !== c.src && ally.side === 'hero' && c.src.side === 'hero' && alive(p, ally) && dist(posOf(p, ally), posOf(p, c.src)) <= (cond==='ultimate'?3:2)) {
        emit(p, cond === 'hit' ? 'allyHit' : cond === 'ultimate' ? 'allyUltimate' : 'allyCrisis', { ...c, src: ally, target: cond === 'hit' ? c.target : c.src });
      }
    }
  } finally { if (root) close(p, action); }
}

// Ignore cooldown bookkeeping and presentation events when deciding whether an effect worked.
function effectState(p: Party): string {
  return JSON.stringify([p.units.map(u => ({ ...u, trig: undefined, triggers: undefined })),
    [p.s.hero, ...p.s.foes].map(e => [e.id, e.hp, e.alive, e.pos]), p.grounds]);
}

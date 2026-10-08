import { CATALOG } from '../delve/catalog';
import { worn } from '../delve/gear';
import { sfTriggers } from '../base/workshop';
import { TRAITS } from './traitDefs';
import { kitsOf, proficient } from './classKit';
import { resonanceTriggers } from './resonance';
import { duoTriggers } from './cardsCombo';
import { freshFight, memoryTriggers } from './memories';
import { alive, posOf, type Party, type Unit } from './partyCore';
import { dist, type GEvent } from '../grid/types';
import type { StatusId } from './status';
import type { DamageKind } from './partyCore';
export type Cond = 'hit' | 'crit' | 'kill' | 'struck' | 'block' | 'dodge' | 'crisis' | 'nth' | 'still' | 'moved' | 'allyHit' | 'allyCrisis' | 'combatStart' | 'statusApplied' | 'ultimate' | 'healed' | 'taunt' | 'allyUltimate' | 'beforeHit' | 'guard' | 'overflow' | 'fireball' | 'counter' | 'shieldBreak' | 'summonDied' | 'reaction' | 'wait' | 'reload' | 'attack' | 'damage' | 'damaged' | 'teleport' | 'summon' | 'turn' | 'miss';
export interface Ctx { kind?: DamageKind; basic?: boolean; t: number; src: Unit; target?: Unit; amount?: number; status?: StatusId; reaction?: string; over?: number; depth: number; ev: GEvent[] }
/** `every`: the effect goes off on every nth time its condition holds, counted per unit (2026-10-08: no effect is left to chance) */
export interface TriggerDef { id: string; when: Cond; cd?: number; every?: number; nth?: number; test?: (p: Party, c: Ctx) => boolean; run: (p: Party, c: Ctx) => void; repeat?: boolean }
export const CHAIN_CAP = 30;
export function sourcesOf(p: Party, u: Unit): TriggerDef[] { return [...resonanceTriggers(p, u), ...duoTriggers(p, u), ...memoryTriggers(u), ...(proficient(u) ? kitsOf(u).flatMap((k) => k.innate) : []), ...Object.entries(u.traits??{}).flatMap(([id,r])=>r&&TRAITS[id]&&TRAITS[id]!.pool!=='duo'?[...(TRAITS[id]!.trigger?[TRAITS[id]!.trigger!(r)]:[]),...(TRAITS[id]!.triggers?.(r)??[])]:[]), ...worn(u).flatMap(it=>CATALOG[it.def]!.triggers), ...sfTriggers(u), ...(u.triggers ?? [])]; }
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
  if (cond === 'combatStart') freshFight(input.src);
  const root = !actions.has(p), action = actions.get(p) ?? fresh(input.t);
  if (root) actions.set(p, action);
  // an effect fires once per chain: a top-level event (each heal, blow or kill the action makes) starts a fresh chain
  if (action.depth === 0) action.fired = new Set();
  const c: Ctx = { ...input, depth: action.depth };
  try {
    if (cond === 'crisis') { if (c.src.crisisUsed) return; c.src.crisisUsed = true; }
    for (const def of sourcesOf(p, c.src)) {
      if (!alive(p, c.src) || action.count >= CHAIN_CAP) break;
      const key = `${c.src.id}:${def.id}`;
      if (def.when !== cond || (!def.repeat && action.fired.has(key)) || c.t < (c.src.trig[def.id] ?? 0) || (def.nth && c.src.nth % def.nth !== 0) || (def.test && !def.test(p, c))) continue;
      if (def.every) { const tally = (c.src.tally ??= {}), n = (tally[def.id] = (tally[def.id] ?? 0) + 1); if (n % def.every !== 0) continue; }
      const before = effectState(p, c.src), oldReady = c.src.trig[def.id], eventAt = c.ev.length;
      // Reserve a slot before entering recursive callbacks; release it for a no-op.
      c.src.trig[def.id] = c.t + (def.cd ?? 0) * (c.src.traits?.fanatic ? .5 : 1);
      const had = action.fired.has(key); action.fired.add(key);
      action.count++; action.depth++;
      try { def.run(p, { ...c, depth: action.depth }); } finally { action.depth--; }
      if (effectState(p, c.src) !== before) {
        action.ev ??= c.ev; action.src ??= c.src.id; action.t = c.t;
        c.ev.splice(eventAt, 0, { t: c.t, type: 'buff', src: c.src.id, dst: c.target?.id, text: def.id });
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

// Whether an effect worked: the source unit in full (minus cooldown bookkeeping), and for everyone else a light fingerprint of
// what effects change (health, life, place, shield, states, taunt, stealth, immunity, raised, burst, sleep, aimed-at), plus counts of
// units, burning ground and gravity wells. A full JSON of every unit was too slow with a horde on the floor.
function effectState(p: Party, src: Unit): string {
  let h = 0;
  // a state with no end (shock) lasts Infinity: fold it to a big finite number, or the hash collapses to 0
  const mix = (v: number) => { h = (Math.imul(h, 31) + Math.round((Number.isFinite(v) ? v : 1e9) * 1000)) | 0; };
  mix(p.units.length); mix(p.grounds?.length ?? 0); mix(p.wells?.length ?? 0); mix(p.snares?.length ?? 0); mix(p.zones?.length ?? 0);
  for (const u of p.units) {
    if (u === src) continue;
    for (const k in u.status) { const st = u.status[k as StatusId]; if (st) { mix(st.until); mix(st.stacks ?? 0); } }
    mix(u.shield); mix(u.tauntUntil); mix(u.hiddenUntil); mix(u.immuneUntil ?? 0); mix(u.raised ? 1 : 0); mix(u.burst ? 1 : 0); mix(u.asleep ? 1 : 0); mix(u.sighted?.length ?? 0); mix(u.nextAt);
  }
  for (const e of [p.s.hero, ...p.s.foes]) { mix(e.hp); mix(e.alive ? 1 : 0); mix(e.pos.x); mix(e.pos.y); }
  return `${h}|${JSON.stringify({ ...src, trig: undefined, triggers: undefined })}`;
}

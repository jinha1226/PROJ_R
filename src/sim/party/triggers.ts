import { alive, posOf, type Party, type Unit } from './partyCore';
import { dist, type GEvent } from '../grid/types';
import type { StatusId } from './status';
export type Cond = 'hit' | 'crit' | 'kill' | 'struck' | 'block' | 'dodge' | 'crisis' | 'nth' | 'still' | 'moved' | 'allyHit' | 'allyCrisis' | 'combatStart' | 'statusApplied' | 'ultimate';
export interface Ctx { t: number; src: Unit; target?: Unit; amount?: number; status?: StatusId; depth: number; ev: GEvent[] }
export interface TriggerDef { id: string; when: Cond; cd?: number; chance?: number; nth?: number; test?: (p: Party, c: Ctx) => boolean; run: (p: Party, c: Ctx) => void }
export const CHAIN_CAP = 5;
export function sourcesOf(_p: Party, u: Unit): TriggerDef[] { return u.triggers ?? []; }
// A shared action budget covers siblings as well as recursive calls, including damage callbacks.
const actions = new WeakMap<Party, { count: number; depth: number }>();
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
      c.src.trig[def.id] = c.t + (def.cd ?? 0); action.count++; action.depth++;
      c.ev.push({ t: c.t, type: 'buff', src: c.src.id, text: def.id });
      try { def.run(p, { ...c, depth: action.depth }); } finally { action.depth--; }
    }
    if (cond === 'hit' || cond === 'crisis') for (const ally of p.units) {
      if (ally !== c.src && ally.side === 'hero' && c.src.side === 'hero' && alive(p, ally) && dist(posOf(p, ally), posOf(p, c.src)) <= 2) {
        emit(p, cond === 'hit' ? 'allyHit' : 'allyCrisis', { ...c, src: ally, target: cond === 'hit' ? c.target : c.src });
      }
    }
  } finally { if (root) actions.delete(p); }
}

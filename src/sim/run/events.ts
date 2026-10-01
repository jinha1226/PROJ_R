import { createRng } from '../../core/rng';
import type { TraitId } from '../../data/types';
import { pairKey } from '../personality/relations';
import { addXp } from '../roster/leveling';
import { EVENT_DEFS } from './eventDefs';
import type { EventCtx, EventEffect } from './eventTypes';
import type { EventView, Spot, RunState } from './types';

export type { EventEffect } from './eventTypes';

const ctxFor = (run: RunState, seed: number, vars: Record<string, string>): EventCtx => {
  const party = run.roster.mercs.filter((m) => m.alive);
  return {
    run, rng: createRng(seed), party, vars,
    withTrait: (t: TraitId, except: string[] = []) => party.find((m) => !except.includes(m.id) && m.traits.includes(t)),
  };
};
const nodeSeed = (run: RunState, node: Spot) => (run.seed * 31337 + node.step * 97 + node.lane * 13) >>> 0;

/** Picks an eligible event for the node (or `forceId`, which must be eligible). */
export function pickEvent(run: RunState, node: Spot, forceId?: string): EventView {
  const ctx = ctxFor(run, nodeSeed(run, node), {});
  const eligible = EVENT_DEFS.filter((e) => !e.requires || e.requires(ctx));
  const def = forceId ? eligible.find((e) => e.id === forceId) : ctx.rng.pick(eligible);
  if (!def) throw new Error(`event not eligible: ${forceId}`);
  const vars = { ...(def.setup?.(ctx) ?? {}), seed: String(nodeSeed(run, node)) };
  const choices = def.choices.map((c) => {
    const actor = c.trait ? ctx.withTrait(c.trait) : undefined;
    const second = c.trait2 ? ctx.withTrait(c.trait2, actor ? [actor.id] : []) : undefined;
    const traitOk = (!c.trait || !!actor) && (!c.trait2 || !!second);
    const goldOk = (c.gold ?? 0) <= run.gold;
    return {
      id: c.id, textKey: c.textKey, actor: actor?.name, available: traitOk && goldOk,
      reasonKey: !traitOk ? 'event.needTrait' : !goldOk ? 'event.needGold' : undefined,
    };
  });
  return { eventId: def.id, vars, choices: traitOkFilter(choices) };
}

/** Trait choices the party cannot take stay hidden (spec: hidden options); gold-gated ones show disabled. */
const traitOkFilter = (choices: EventView['choices']) => choices.filter((c) => c.reasonKey !== 'event.needTrait');

export function applyEffects(run: RunState, effects: EventEffect[]): RunState {
  let r = { ...run, roster: { ...run.roster, relations: run.roster.relations.map((x) => ({ ...x })) } };
  const mapMerc = (id: string, f: (m: RunState['roster']['mercs'][number]) => RunState['roster']['mercs'][number]) => {
    r = { ...r, roster: { ...r.roster, mercs: r.roster.mercs.map((m) => (m.id === id ? f(m) : m)) } };
  };
  const rel = (a: string, b: string) => {
    let x = r.roster.relations.find((q) => pairKey(q.a, q.b) === pairKey(a, b));
    if (!x) { x = { a, b, affinity: 0, rival: false, battlesTogether: 0, contests: 0 }; r.roster.relations.push(x); }
    return x;
  };
  for (const e of effects) {
    if (e.kind === 'gold') r = { ...r, gold: Math.max(0, r.gold + e.amount) };
    else if (e.kind === 'affinity' && e.a !== e.b) { const x = rel(e.a, e.b); x.affinity = Math.max(-100, Math.min(100, x.affinity + e.amount)); }
    else if (e.kind === 'rival' && e.a !== e.b) rel(e.a, e.b).rival = true;
    else if (e.kind === 'injure') mapMerc(e.merc, (m) => ({ ...m, injury: Math.max(m.injury, e.battles) }));
    else if (e.kind === 'healAll') r = { ...r, roster: { ...r.roster, mercs: r.roster.mercs.map((m) => ({ ...m, injury: 0 })) } };
    else if (e.kind === 'item') r = { ...r, roster: { ...r.roster, inventory: [...r.roster.inventory, e.itemId] } };
    else if (e.kind === 'tactic' && !r.roster.tacticsOwned.includes(e.tacticId)) r = { ...r, roster: { ...r.roster, tacticsOwned: [...r.roster.tacticsOwned, e.tacticId] } };
    else if (e.kind === 'xp') for (const id of e.mercs) mapMerc(id, (m) => addXp(m, e.amount));
  }
  return r;
}

export function resolveEvent(run: RunState, view: EventView, choiceId: string): { run: RunState; effects: EventEffect[]; resultKey: string; vars: Record<string, string> } {
  const def = EVENT_DEFS.find((e) => e.id === view.eventId);
  const choice = def?.choices.find((c) => c.id === choiceId);
  const shown = view.choices.find((c) => c.id === choiceId);
  if (!def || !choice || !shown?.available) throw new Error(`choice not available: ${view.eventId}/${choiceId}`);
  const ctx = ctxFor(run, Number(view.vars.seed) ^ choiceId.length * 7, view.vars);
  const res = choice.resolve(ctx);
  return { run: { ...applyEffects(run, res.effects), pending: undefined }, effects: res.effects, resultKey: res.resultKey, vars: { ...view.vars, ...res.vars } };
}

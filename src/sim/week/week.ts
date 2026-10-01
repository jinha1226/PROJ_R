import { createRng } from '../../core/rng';
import { addXp, xpToNext } from '../roster/leveling';
import { newRoster } from '../roster/generate';
import { note } from '../roster/chronicle';
import { applyEffects, pickEvent } from '../run/events';
import { encounterCandidates, recruit } from '../run/recruit';
import { shopStock } from '../run/shop';
import { LAST_WEEK, type Candidate, type RegionCard, type RunState, type Theme, type WeekReport } from '../run/types';

export const START_GOLD = 60;
const VISIT_CHANCE = 0.6;
const START_EVENT_CHANCE = 0.25;
const TRAIN_EVENT_CHANCE = 0.25;
const TRAIN_FRACTION = 0.4;
const THEMES: Theme[] = ['forest', 'dungeon', 'graveyard'];
const REWARDS: RegionCard['reward'][] = ['gold', 'gear', 'xp'];

const weekRng = (run: RunState, salt: number) => createRng((run.seed * 2654435761 + run.week * 40503 + salt) >>> 0);

function regionCards(run: RunState): RegionCard[] {
  const rng = weekRng(run, 11);
  const themes = rng.shuffle([...THEMES]);
  const stars = rng.shuffle([1, 2, 3] as RegionCard['stars'][]);
  return themes.map((theme, i) => ({ theme, stars: stars[i]!, reward: rng.pick(REWARDS), rooms: Math.min(10, 5 + stars[i]! + rng.int(0, 1)) }));
}

function visitors(run: RunState): Candidate[] | undefined {
  if (run.week < 2) return undefined;
  const rng = weekRng(run, 23);
  if (run.week > 2 && !rng.chance(VISIT_CHANCE)) return undefined;
  const all = [...encounterCandidates(run, { step: run.week, lane: 9 })].sort((a, b) => a.fee - b.fee);
  return all.slice(0, rng.int(1, 2));
}

/** Sets up a week: visitors, an optional start event, region cards, and the shop; week 12 is the boss. */
export function startWeek(run: RunState): RunState {
  if (run.week >= LAST_WEEK) return { ...run, phase: 'boss', visitors: undefined, startEvent: undefined, report: undefined };
  const rng = weekRng(run, 37);
  const vis = visitors(run);
  const startEvent = run.week >= 2 && run.roster.mercs.length >= 1 && rng.chance(START_EVENT_CHANCE) ? pickEvent(run, { step: run.week, lane: 7 }) : undefined;
  return {
    ...run, visitors: vis, startEvent, regionCards: regionCards(run), report: undefined, exploration: undefined,
    shop: { week: run.week, stock: shopStock(run, { step: run.week, lane: 5 }) },
    phase: vis || startEvent ? 'start' : 'choose',
  };
}

export function newRunV2(seed: number, startedAt: string): RunState {
  const base: RunState = {
    version: 2, seed, gold: START_GOLD, roster: newRoster(seed, 0), week: 1, phase: 'choose', status: 'active',
    formation: {}, startedAt, namedProtagonist: false,
  };
  return startWeek(base);
}

const toChoose = (run: RunState): RunState => (run.visitors || run.startEvent ? { ...run, phase: 'start' } : { ...run, phase: 'choose' });

export function recruitVisitor(run: RunState, c: Candidate): RunState {
  return toChoose({ ...recruit(run, c), visitors: undefined });
}

export function skipStart(run: RunState): RunState {
  return { ...run, visitors: undefined, startEvent: undefined, phase: 'choose' };
}

export function canExplore(run: RunState): boolean {
  return run.roster.mercs.some((m) => m.alive && m.injury === 0);
}

const report = (run: RunState, kind: WeekReport['kind'], deployed: string[], xp: Record<string, number>, notes: WeekReport['notes'] = []): WeekReport =>
  ({ week: run.week, kind, deployed, xp, moments: [], notes, gold: 0, items: [] });

/** Up to five members train: each gains 40% of their next level's xp; sometimes rivals spar. */
export function trainWeek(run: RunState, ids: string[]): RunState {
  const chosen = ids.slice(0, 5).filter((id) => run.roster.mercs.some((m) => m.id === id));
  const xp: Record<string, number> = {};
  const roster = { ...run.roster, mercs: run.roster.mercs.map((m) => {
    if (!chosen.includes(m.id)) return m;
    xp[m.id] = Math.round(xpToNext(m.level) * TRAIN_FRACTION);
    return addXp(m, xp[m.id]!);
  }) };
  let next: RunState = { ...run, roster };
  const notes: WeekReport['notes'] = [];
  const rng = weekRng(run, 53);
  const competitive = roster.mercs.filter((m) => chosen.includes(m.id) && m.traits.includes('competitive'));
  if (competitive.length >= 2 && rng.chance(TRAIN_EVENT_CHANCE * 2)) {
    const [a, b] = competitive;
    next = applyEffects(next, [{ kind: 'rival', a: a!.id, b: b!.id }, { kind: 'xp', mercs: [a!.id, b!.id], amount: 20 }]);
    notes.push({ key: 'spar', vars: { a: a!.name, b: b!.name } });
  } else if (chosen.length >= 2 && rng.chance(TRAIN_EVENT_CHANCE)) {
    const [a, b] = rng.shuffle([...chosen]);
    next = applyEffects(next, [{ kind: 'affinity', a: a!, b: b!, amount: 6 }]);
    notes.push({ key: 'trainBond', vars: { a: roster.mercs.find((m) => m.id === a)!.name, b: roster.mercs.find((m) => m.id === b)!.name } });
  }
  return { ...next, phase: 'report', report: report(run, 'train', chosen, xp, notes) };
}

/** Everyone heals; optionally two members talk by the fire. */
export function restWeek(run: RunState, a?: string, b?: string): RunState {
  let next = applyEffects(run, [{ kind: 'healAll' }]);
  const notes: WeekReport['notes'] = [];
  if (a && b && a !== b) {
    const chatty = next.roster.mercs.some((m) => (m.id === a || m.id === b) && m.traits.includes('chatty'));
    next = applyEffects(next, [{ kind: 'affinity', a, b, amount: chatty ? 15 : 12 }]);
    const name = (id: string) => next.roster.mercs.find((m) => m.id === id)?.name ?? id;
    notes.push({ key: 'talk', vars: { a: name(a), b: name(b) } });
    next = { ...next, roster: { ...next.roster, mercs: next.roster.mercs.map((m) => (m.id === a ? note(m, run.roster.battles, 'restTalk', { who: b }) : m)) } };
  }
  return { ...next, phase: 'report', report: report(run, 'rest', [], {}, notes) };
}

/** After the report: idle members recover a little, then the next week starts. */
export function endWeek(run: RunState): RunState {
  const busy = new Set(run.report?.deployed ?? []);
  const mercs = run.roster.mercs.map((m) => (!busy.has(m.id) && m.injury > 0 ? { ...m, injury: m.injury - 1 } : m));
  return startWeek({ ...run, roster: { ...run.roster, mercs }, week: run.week + 1, report: undefined, exploration: undefined, pending: undefined });
}

import { createRng } from '../../core/rng';
import { autoFormation } from '../roster/formation';
import { addXp } from '../roster/leveling';
import { rollItem } from '../roster/loot';
import type { RunState, WeekReport } from '../run/types';
import { generateExploration, OPPOSITE } from './generate';
import type { Dir, Exploration, Room } from './types';

const MAX_PARTY = 5;
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Elite packs already carry a leader, so their stage is one lower. */
export const stageOf = (e: Exploration, room?: Room): number => Math.max(1, e.week + (e.stars - 1) - (room?.type === 'elite' ? 1 : 0));

export function chooseExplore(run: RunState, cardIndex: number, party: string[]): RunState {
  const card = run.regionCards?.[cardIndex];
  if (!card) throw new Error('no such region');
  const ready = party.filter((id) => run.roster.mercs.some((m) => m.id === id && m.alive && m.injury === 0)).slice(0, MAX_PARTY);
  if (!ready.length) throw new Error('nobody can explore');
  const mercs = run.roster.mercs.filter((m) => ready.includes(m.id));
  const keep = ready.every((id) => run.formation[id]);
  const formation = keep
    ? Object.fromEntries(ready.map((id) => [id, run.formation[id]!]))
    : Object.fromEntries(autoFormation(mercs).map(({ merc, col, row }) => [merc.id, { col, row }]));
  return { ...run, phase: 'exploring', formation, exploration: generateExploration((run.seed ^ (run.week * 2654435761)) >>> 0, run.week, card, ready) };
}

export function moveTo(e: Exploration, roomId: string): Exploration {
  const here = e.rooms[e.at]!;
  const dir = (Object.keys(here.doors) as Dir[]).find((d) => here.doors[d] === roomId);
  if (!dir) throw new Error(`no door to ${roomId}`);
  return { ...e, at: roomId, enteredFrom: OPPOSITE[dir], visited: e.visited.includes(roomId) ? e.visited : [...e.visited, roomId] };
}

const current = (run: RunState): Room => {
  const e = run.exploration;
  if (!e) throw new Error('not exploring');
  return e.rooms[e.at]!;
};

export function markDone(run: RunState, roomId: string, loot: Partial<Exploration['loot']> = {}): RunState {
  const e = run.exploration!;
  return {
    ...run,
    exploration: {
      ...e, rooms: { ...e.rooms, [roomId]: { ...e.rooms[roomId]!, done: true } },
      loot: { gold: e.loot.gold + (loot.gold ?? 0), items: [...e.loot.items, ...(loot.items ?? [])] },
    },
  };
}

/** Chest reward follows the region's reward focus: gear → item, gold → coins, xp → party xp. */
export function openChest(run: RunState): RunState {
  const room = current(run);
  if (room.type !== 'chest' || room.done) throw new Error('nothing to open');
  const e = run.exploration!;
  const rng = createRng((e.seed ^ hash(room.id)) >>> 0);
  if (e.reward === 'gold') {
    const gold = 30 + 10 * e.stars;
    return markDone({ ...run, gold: run.gold + gold }, room.id, { gold });
  }
  if (e.reward === 'xp') {
    const mercs = run.roster.mercs.map((m) => (e.party.includes(m.id) ? addXp(m, 15 * e.stars) : m));
    return markDone({ ...run, roster: { ...run.roster, mercs } }, room.id, { gold: 0 });
  }
  const item = rollItem(rng, stageOf(e, room) + 1);
  return markDone({ ...run, roster: { ...run.roster, inventory: [...run.roster.inventory, item] } }, room.id, { items: [item] });
}

export function useCampfire(run: RunState): RunState {
  const room = current(run);
  if (room.type !== 'campfire' || room.done) throw new Error('no campfire here');
  const party = run.exploration!.party;
  const mercs = run.roster.mercs.map((m) => (party.includes(m.id) && m.injury > 0 ? { ...m, injury: m.injury - 1 } : m));
  const next = markDone({ ...run, roster: { ...run.roster, mercs } }, room.id);
  return { ...next, exploration: { ...next.exploration!, rested: true } };
}

export const eventSpot = (run: RunState) => ({ step: run.week, lane: 20 + (hash(run.exploration!.at) % 1000) });

/** Ends the exploration (exit, return, or retreat) and produces the week report. */
export function leaveExploration(run: RunState, retreated = false): RunState {
  const e = run.exploration;
  if (!e) return run;
  const report: WeekReport = {
    week: run.week, kind: 'explore', deployed: e.party, xp: {}, moments: [], gold: e.loot.gold, items: e.loot.items,
    notes: [{ key: retreated ? 'retreated' : 'returned', vars: { rooms: String(e.visited.length) } }],
  };
  return { ...run, phase: 'report', report, exploration: undefined, pending: undefined };
}

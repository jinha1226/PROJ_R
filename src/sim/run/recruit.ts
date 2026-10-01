import { createRng } from '../../core/rng';
import { generateRecruit } from '../roster/generate';
import { note } from '../roster/chronicle';
import type { Candidate, MapNode, RunState } from './types';

export const ROSTER_CAP = 8;
const PAST_CHANCE = 0.2;
const NAME_MAX = 12;

/** 2–3 candidates; one is free, the others cost 25 + 10 × level. */
export function encounterCandidates(run: RunState, node: MapNode): Candidate[] {
  const rng = createRng((run.seed * 104729 + node.step * 613 + node.lane * 37) >>> 0);
  const level = Math.max(1, Math.round(node.step / 2));
  const used = new Set([...run.roster.mercs, ...run.roster.memorial].map((m) => m.name));
  const n = rng.int(2, 3);
  const free = rng.int(0, n - 1);
  const alive = run.roster.mercs.filter((m) => m.alive);
  return Array.from({ length: n }, (_, i) => {
    const merc = generateRecruit(rng, { level, usedNames: used, id: `m${run.roster.nextId + i}` });
    const past = alive.length && rng.chance(PAST_CHANCE)
      ? { with: rng.pick(alive).id, kind: rng.pick(['friend', 'feud', 'rival'] as const) }
      : undefined;
    return { merc, fee: i === free ? 0 : 25 + 10 * level, past };
  });
}

export function recruit(run: RunState, c: Candidate): RunState {
  if (run.roster.mercs.length >= ROSTER_CAP) throw new Error('company is full');
  if (run.gold < c.fee) throw new Error('not enough gold');
  const id = `m${run.roster.nextId}`;
  const merc = { ...c.merc, id };
  const relations = [...run.roster.relations];
  if (c.past) {
    const r = { a: c.past.with, b: id, affinity: 0, rival: false, battlesTogether: 0, contests: 0 };
    if (c.past.kind === 'friend') r.affinity = 50;
    if (c.past.kind === 'feud') r.affinity = -50;
    if (c.past.kind === 'rival') r.rival = true;
    relations.push(r);
  }
  return {
    ...run, gold: run.gold - c.fee,
    roster: { ...run.roster, mercs: [...run.roster.mercs, merc], relations, nextId: run.roster.nextId + 1 },
  };
}

export function nameProtagonist(run: RunState, raw: string): RunState {
  const name = raw.trim().slice(0, NAME_MAX);
  const mercs = run.roster.mercs.map((m) =>
    m.protagonist && name ? note({ ...m, name }, run.roster.battles, 'named', { name }) : m);
  return { ...run, namedProtagonist: true, roster: { ...run.roster, mercs } };
}

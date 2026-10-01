import type { Relation, RelationKind } from '../../data/types';
import type { BattleState, UnitState } from '../battle/types';

export const FRIEND_MIN = 40;
export const COMRADE_MIN = 80;
export const COMRADE_BATTLES = 10;
export const FEUD_MAX = -40;
export const MENTOR_LEVEL_GAP = 4;
export const MENTOR_MIN = 30;

export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Relationship labels per spec 3.3; levels are of r.a and r.b respectively. */
export function relationKinds(r: Relation, levelA: number, levelB: number): Set<RelationKind> {
  const out = new Set<RelationKind>();
  if (r.affinity >= FRIEND_MIN) out.add('friend');
  if (r.affinity >= COMRADE_MIN && r.battlesTogether >= COMRADE_BATTLES) out.add('comrade');
  if (r.rival) out.add('rival');
  if (r.affinity <= FEUD_MAX) out.add('feud');
  if (Math.abs(levelA - levelB) >= MENTOR_LEVEL_GAP && r.affinity >= MENTOR_MIN) out.add('mentor');
  return out;
}

export function relationOf(s: BattleState, a: string, b: string): Relation | undefined {
  return s.relations.get(pairKey(a, b));
}

const kindsBetween = (s: BattleState, a: UnitState, b: UnitState): Set<RelationKind> => {
  const r = relationOf(s, a.id, b.id);
  if (!r) return new Set();
  const la = r.a === a.id ? a.setup.level : b.setup.level;
  const lb = r.a === a.id ? b.setup.level : a.setup.level;
  return relationKinds(r, la, lb);
};

/** True when both units are alive, standing, and hold that relationship. */
export function hasRelation(s: BattleState, a: UnitState, b: UnitState, kind: RelationKind): boolean {
  if (a === b || !a.alive || !b.alive || a.downed || b.downed) return false;
  return kindsBetween(s, a, b).has(kind);
}

/** Relationship check that ignores the downed state of b (e.g. "my friend went down"). */
export function relatedEvenIfDown(s: BattleState, a: UnitState, b: UnitState, kind: RelationKind): boolean {
  if (a === b || !a.alive || !b.alive) return false;
  return kindsBetween(s, a, b).has(kind);
}

/** Standing partners of u with that relationship, sorted by id. For 'mentor', only u's disciples (lower level). */
export function partners(s: BattleState, u: UnitState, kind: RelationKind): UnitState[] {
  if (s.relations.size === 0) return [];
  return s.units
    .filter((o) => o.team === u.team && hasRelation(s, u, o, kind) && (kind !== 'mentor' || o.setup.level < u.setup.level))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

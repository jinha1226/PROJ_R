import { createRng } from '../../core/rng';
import { TRAITS } from '../../data/traits';
import type { Relation, RelationKind, TraitId } from '../../data/types';
import type { BattleEvent, UnitSetup } from '../battle/types';
import { pairKey, relationKinds } from '../personality/relations';

export type MomentKind =
  | 'rescue' | 'protect' | 'rivalry' | 'revenge' | 'courage' | 'combo'
  | 'newFriend' | 'newComrade' | 'newRival' | 'newFeud' | 'death';

export interface Moment {
  kind: MomentKind;
  a: string;
  b?: string;
}

export interface RelationUpdate {
  relations: Relation[];
  moments: Moment[];
}

const BASE_GAIN = 2;
const RESCUE_GAIN = 20;
const PROTECT_GAIN = 5;
const CONTEST_WINDOW = 60;
const CONTESTS_FOR_RIVAL = 3;
const RIVAL_CHANCE = 0.3;
const MAX_MOMENTS = 8;
const PRIORITY: MomentKind[] = ['death', 'newComrade', 'newFriend', 'newRival', 'newFeud', 'combo', 'rescue', 'revenge', 'protect', 'courage', 'rivalry'];
const NEW_KIND: Partial<Record<RelationKind, MomentKind>> = { friend: 'newFriend', comrade: 'newComrade', rival: 'newRival', feud: 'newFeud' };
const TRIGGER_MOMENT: Record<string, MomentKind> = { protect: 'protect', mentor: 'protect', rivalry: 'rivalry', revenge: 'revenge', courage: 'courage' };

function compatGain(ta: TraitId[], tb: TraitId[]): number {
  const mult = [...ta, ...tb].reduce((m, t) => m * TRAITS[t].affinityMult, 1);
  const likes = ta.some((t) => TRAITS[t].likes.some((x) => tb.includes(x))) || tb.some((t) => TRAITS[t].likes.some((x) => ta.includes(x)));
  const dislikes = ta.some((t) => TRAITS[t].dislikes.some((x) => tb.includes(x))) || tb.some((t) => TRAITS[t].dislikes.some((x) => ta.includes(x)));
  let gain = BASE_GAIN * mult;
  if (likes) gain *= 1.5;
  if (dislikes) gain = gain * 0.5 - 1;
  return gain;
}

/** Last hits on a target that another ally damaged within the contest window. */
function countContests(events: readonly BattleEvent[], allyIds: Set<string>): Map<string, number> {
  const hits = new Map<string, { src: string; tick: number }[]>();
  const out = new Map<string, number>();
  for (const e of events) {
    if (e.type === 'damage' && e.src && e.dst && allyIds.has(e.src)) {
      const list = hits.get(e.dst) ?? [];
      list.push({ src: e.src, tick: e.tick });
      hits.set(e.dst, list);
    } else if (e.type === 'died' && e.src && e.dst && allyIds.has(e.src)) {
      const others = new Set((hits.get(e.dst) ?? []).filter((h) => h.src !== e.src && e.tick - h.tick <= CONTEST_WINDOW).map((h) => h.src));
      for (const o of others) out.set(pairKey(e.src, o), (out.get(pairKey(e.src, o)) ?? 0) + 1);
    }
  }
  return out;
}

function battleMoments(events: readonly BattleEvent[], allyIds: Set<string>): Moment[] {
  const out: Moment[] = [];
  for (const e of events) {
    if (e.type === 'rescued' && e.src && e.dst) out.push({ kind: 'rescue', a: e.src, b: e.dst });
    else if (e.type === 'pair_combo' && e.src && e.dst) out.push({ kind: 'combo', a: e.src, b: e.dst });
    else if (e.type === 'died' && e.dst && allyIds.has(e.dst)) out.push({ kind: 'death', a: e.dst });
    else if (e.type === 'relation_trigger' && e.src && e.dst) {
      const kind = TRIGGER_MOMENT[String(e.data?.kind)];
      if (kind) out.push({ kind, a: e.src, b: e.dst });
    }
  }
  return out;
}

const affinityOf = (k: string, events: readonly BattleEvent[]): number => {
  let gain = 0;
  for (const e of events) {
    if (!e.src || !e.dst || pairKey(e.src, e.dst) !== k) continue;
    if (e.type === 'rescued') gain += RESCUE_GAIN;
    else if (e.type === 'relation_trigger' && (e.data?.kind === 'protect' || e.data?.kind === 'mentor')) gain += PROTECT_GAIN;
  }
  return gain;
};

/** Pure: computes relationships after a battle (spec 3.4) and the moments worth showing. */
export function applyBattleToRelations(input: { relations: Relation[]; allies: UnitSetup[]; events: readonly BattleEvent[]; seed: number }): RelationUpdate {
  const rng = createRng(input.seed ^ 0x5bd1e995);
  const allies = [...input.allies].sort((x, y) => (x.id < y.id ? -1 : 1));
  const ids = new Set(allies.map((u) => u.id));
  const byKey = new Map(input.relations.map((r) => [pairKey(r.a, r.b), { ...r }]));
  const contests = countContests(input.events, ids);
  const moments = battleMoments(input.events, ids);

  for (let i = 0; i < allies.length; i++) {
    for (let j = i + 1; j < allies.length; j++) {
      const A = allies[i]!;
      const B = allies[j]!;
      const k = pairKey(A.id, B.id);
      const old = byKey.get(k) ?? { a: A.id, b: B.id, affinity: 0, rival: false, battlesTogether: 0, contests: 0 };
      const levelA = old.a === A.id ? A.level : B.level;
      const levelB = old.a === A.id ? B.level : A.level;
      const before = relationKinds(old, levelA, levelB);
      const r = { ...old, battlesTogether: old.battlesTogether + 1, contests: old.contests + (contests.get(k) ?? 0) };
      r.affinity = Math.max(-100, Math.min(100, Math.round(r.affinity + compatGain(A.traits, B.traits) + affinityOf(k, input.events))));
      if (!r.rival && r.contests >= CONTESTS_FOR_RIVAL) {
        const competitive = A.traits.includes('competitive') || B.traits.includes('competitive');
        r.rival = competitive || rng.chance(RIVAL_CHANCE);
      }
      for (const kind of relationKinds(r, levelA, levelB)) {
        const m = NEW_KIND[kind];
        if (m && !before.has(kind)) moments.push({ kind: m, a: r.a, b: r.b });
      }
      byKey.set(k, r);
    }
  }

  const seen = new Set<string>();
  const unique = moments.filter((m) => {
    const key = `${m.kind}|${m.a}|${m.b ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((x, y) => PRIORITY.indexOf(x.kind) - PRIORITY.indexOf(y.kind));
  const relations = [...byKey.entries()].sort(([x], [y]) => (x < y ? -1 : 1)).map(([, r]) => r);
  return { relations, moments: unique.slice(0, MAX_MOMENTS) };
}

import { relationKinds, pairKey } from '../../sim/personality/relations';
import { applyBattleToRelations } from '../../sim/roster/relationships';
import type { BattleEvent, BattleSetup } from '../../sim/battle/types';
import type { RelationKind } from '../../data/types';
import { t } from '../i18n/ko';
import type { ResultStory } from './resultOverlay';

const SHOWN: RelationKind[] = ['comrade', 'friend', 'rival', 'feud'];

/** Turns a finished battle into "moments" and relationship changes for the result screen. */
export function buildStory(setup: BattleSetup, events: readonly BattleEvent[], nameOf: (id: string) => string): ResultStory {
  const before = new Map((setup.relations ?? []).map((r) => [pairKey(r.a, r.b), r]));
  const level = new Map(setup.allies.map((u) => [u.id, u.level]));
  const { relations, moments } = applyBattleToRelations({ relations: setup.relations ?? [], allies: setup.allies, events, seed: setup.seed });
  const bonds = relations
    .map((r) => {
      const old = before.get(pairKey(r.a, r.b));
      const delta = r.affinity - (old?.affinity ?? 0);
      const kinds = relationKinds(r, level.get(r.a) ?? 1, level.get(r.b) ?? 1);
      const label = SHOWN.filter((k) => kinds.has(k)).map((k) => t(`relation.${k}`)).join('·');
      return { text: `${nameOf(r.a)} · ${nameOf(r.b)}`, delta, label: label || undefined, weight: Math.abs(delta) + (label ? 100 : 0) };
    })
    .filter((b) => b.delta !== 0)
    .sort((x, y) => y.weight - x.weight)
    .slice(0, 6)
    .map(({ text, delta, label }) => ({ text, delta, label }));
  return {
    moments: moments.map((m) => ({ icon: `moment:${m.kind}` as const, text: t(`moment.${m.kind}`, { a: nameOf(m.a), b: m.b ? nameOf(m.b) : '' }) })),
    bonds,
  };
}

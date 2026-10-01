import { COMBOS, GENERIC_COMBO } from '../../data/combos';
import type { RelationKind } from '../../data/types';
import { relationKinds } from '../../sim/personality/relations';
import type { BattleState, UnitState } from '../../sim/battle/types';
import { t } from '../i18n/ko';

const ORDER: RelationKind[] = ['comrade', 'mentor', 'friend', 'rival', 'feud'];

function comboName(a: UnitState, b: UnitState): string {
  const ca = a.setup.defId;
  const cb = b.setup.defId;
  const c = COMBOS.find((x) => (x.classes[0] === ca && x.classes[1] === cb) || (x.classes[0] === cb && x.classes[1] === ca)) ?? GENERIC_COMBO;
  return t(`combo.${c.id}`);
}

/** Relationship rule sentences for one unit, e.g. "브란은(는) 오웬이(가) 위험하면 엄호하러 달려간다." */
export function describeRelations(s: BattleState, u: UnitState, nameOf: (x: UnitState) => string): { kind: RelationKind; text: string }[] {
  const out: { kind: RelationKind; text: string }[] = [];
  for (const r of s.relations.values()) {
    if (r.a !== u.id && r.b !== u.id) continue;
    const other = s.units.find((x) => x.id === (r.a === u.id ? r.b : r.a));
    if (!other) continue;
    const ua = r.a === u.id ? u : other;
    const ub = r.a === u.id ? other : u;
    const kinds = relationKinds(r, ua.setup.level, ub.setup.level);
    for (const kind of ORDER) {
      if (!kinds.has(kind)) continue;
      const mentorFirst = kind === 'mentor' && u.setup.level < other.setup.level;
      const [a, b] = mentorFirst ? [other, u] : [u, other];
      out.push({ kind, text: t(`rule.${kind}`, { a: nameOf(a), b: nameOf(b), combo: comboName(u, other) }) });
    }
  }
  return out;
}

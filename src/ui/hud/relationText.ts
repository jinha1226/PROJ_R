import { COMBOS, GENERIC_COMBO } from '../../data/combos';
import type { ClassId, Relation, RelationKind } from '../../data/types';
import { relationKinds } from '../../sim/personality/relations';
import type { BattleState, UnitState } from '../../sim/battle/types';
import { t } from '../i18n/ko';

const ORDER: RelationKind[] = ['comrade', 'mentor', 'friend', 'rival', 'feud'];

export interface Party {
  id: string;
  name: string;
  level: number;
  classId: string;
}

function comboName(a: string, b: string): string {
  const c = COMBOS.find((x) => (x.classes[0] === a && x.classes[1] === b) || (x.classes[0] === b && x.classes[1] === a)) ?? GENERIC_COMBO;
  return t(`combo.${c.id}`);
}

/** Rule sentences for one relationship, written from `self`'s point of view. */
export function ruleLines(r: Relation, self: Party, other: Party): { kind: RelationKind; text: string }[] {
  const [ua, ub] = r.a === self.id ? [self, other] : [other, self];
  const kinds = relationKinds(r, ua.level, ub.level);
  return ORDER.filter((k) => kinds.has(k)).map((kind) => {
    const mentorFirst = kind === 'mentor' && self.level < other.level;
    const [a, b] = mentorFirst ? [other, self] : [self, other];
    return { kind, text: t(`rule.${kind}`, { a: a.name, b: b.name, combo: comboName(self.classId as ClassId, other.classId as ClassId) }) };
  });
}

const asParty = (u: UnitState, nameOf: (x: UnitState) => string): Party => ({ id: u.id, name: nameOf(u), level: u.setup.level, classId: u.setup.defId });

/** In battle: every rule sentence that involves unit u. */
export function describeRelations(s: BattleState, u: UnitState, nameOf: (x: UnitState) => string): { kind: RelationKind; text: string }[] {
  const out: { kind: RelationKind; text: string }[] = [];
  for (const r of s.relations.values()) {
    if (r.a !== u.id && r.b !== u.id) continue;
    const other = s.units.find((x) => x.id === (r.a === u.id ? r.b : r.a));
    if (other) out.push(...ruleLines(r, asParty(u, nameOf), asParty(other, nameOf)));
  }
  return out;
}

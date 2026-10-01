import { dist } from '../../core/vec2';
import type { RelationKind } from '../../data/types';
import { relationKinds } from '../../sim/personality/relations';
import { slotToPos } from '../../sim/battle/setup';
import { PROXIMITY } from '../../sim/battle/constants';
import type { Roster } from '../../sim/roster/types';
import type { Slot } from '../../sim/run/types';
import { ruleLines } from '../hud/relationText';

const COMBO_REACH = 6;
const EFFECT: Partial<Record<RelationKind, string>> = {
  friend: '친구 인접: 방어 ↑', rival: '라이벌 인접: 공격 속도·치명 ↑', feud: '반목 인접: 공격 ↓',
};

/** What the chosen formation will trigger at the start: proximity bonuses/penalties and reachable comrade combos. */
export function adjacencyPreview(r: Roster, formation: Record<string, Slot>): { kind: RelationKind; text: string }[] {
  const out: { kind: RelationKind; text: string }[] = [];
  const placed = r.mercs.filter((m) => formation[m.id]);
  const pos = (id: string) => slotToPos('ally', formation[id]!.col, formation[id]!.row);
  for (const rel of r.relations) {
    const a = placed.find((m) => m.id === rel.a);
    const b = placed.find((m) => m.id === rel.b);
    if (!a || !b) continue;
    const d = dist(pos(a.id), pos(b.id));
    for (const kind of relationKinds(rel, a.level, b.level)) {
      if (EFFECT[kind] && d <= PROXIMITY) out.push({ kind, text: `${a.name}·${b.name} — ${EFFECT[kind]}` });
      if (kind === 'comrade' && d <= COMBO_REACH) {
        const line = ruleLines(rel, { id: a.id, name: a.name, level: a.level, classId: a.classId }, { id: b.id, name: b.name, level: b.level, classId: b.classId })
          .find((l) => l.kind === 'comrade');
        if (line) out.push({ kind, text: line.text });
      }
    }
  }
  return out;
}

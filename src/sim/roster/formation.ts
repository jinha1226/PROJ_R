import { CLASSES } from '../../data/classes';
import type { Role } from '../../data/types';
import type { Mercenary } from './types';

type Col = 0 | 1 | 2;
type Row = 0 | 1 | 2 | 3;

const COL_OF: Record<Role, Col> = { vanguard: 2, striker: 2, skirmisher: 2, support: 1, ranged: 0, caster: 0 };
const ROW_ORDER: Row[] = [1, 2, 0, 3];
const MAX_DEPLOY = 5;

/** Default formation: melee front, support middle, ranged/casters back; overflow shifts to the next column. */
export function autoFormation(mercs: Mercenary[]): { merc: Mercenary; col: Col; row: Row }[] {
  const used = new Map<Col, number>([[0, 0], [1, 0], [2, 0]]);
  const out: { merc: Mercenary; col: Col; row: Row }[] = [];
  for (const merc of mercs.slice(0, MAX_DEPLOY)) {
    let col = COL_OF[CLASSES[merc.classId].role];
    for (let tries = 0; (used.get(col) ?? 0) >= 4 && tries < 3; tries++) col = ((col + 2) % 3) as Col;
    const n = used.get(col) ?? 0;
    used.set(col, n + 1);
    out.push({ merc, col, row: ROW_ORDER[n]! });
  }
  return out;
}

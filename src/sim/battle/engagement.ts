import { dist } from '../../core/vec2';
import { DISENGAGE_DIST, MELEE_ENGAGE } from './constants';
import { dealDamage } from './damage';
import { emit } from './events';
import { isActionBlocked } from './tags';
import type { BattleState, UnitState } from './types';

const isMelee = (u: UnitState): boolean => u.setup.stats.range <= 2;
const canAct = (u: UnitState): boolean => u.alive && !u.downed && !isActionBlocked(u);

export function updateEngagement(s: BattleState): void {
  const byId = new Map(s.units.map((u) => [u.id, u]));
  for (const u of s.units) {
    if (!u.alive || u.downed) {
      u.engagedWith = null;
      continue;
    }
    if (u.engagedWith) {
      const foe = byId.get(u.engagedWith);
      if (!foe || !foe.alive || foe.downed) {
        u.engagedWith = null;
      } else if (dist(u.pos, foe.pos) > DISENGAGE_DIST) {
        const evasive = u.forced && u.forced.kind !== 'knockback';
        const pushed = u.forced?.kind === 'knockback';
        if (!evasive && !pushed && isMelee(foe) && canAct(foe)) {
          emit(s, { type: 'opportunity', src: foe.id, dst: u.id });
          dealDamage(s, foe, u, { mult: 1, canDodge: false, canCrit: false, skillId: foe.setup.basic });
        }
        u.engagedWith = null;
      }
    }
    if (!u.engagedWith && isMelee(u) && u.intent?.targetId) {
      const foe = byId.get(u.intent.targetId);
      if (foe && foe.team !== u.team && foe.alive && !foe.downed && dist(u.pos, foe.pos) <= MELEE_ENGAGE)
        u.engagedWith = foe.id;
    }
  }
}

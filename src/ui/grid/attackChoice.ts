import { shootable } from '../../sim/grid/actions';
import { activeWeapon } from '../../sim/grid/gear';
import { WEAPONS } from '../../sim/grid/items';
import { canStep, dist, idx, type GAction, type GridState } from '../../sim/grid/types';

export type AttackChoice = { kind: 'melee'; action: GAction; foe: string }
  | { kind: 'shoot'; action: GAction; foe: string } | { kind: 'swap' } | null;

/** Adjacent blows take priority, regardless of the weapon in hand. */
export function attackChoice(s: GridState, target: string | undefined): AttackChoice {
  const h = s.hero;
  const adjacent = s.foes.filter(f => {
    if (!f.alive || !s.visible.has(idx(s.map, f.pos)) || dist(h.pos, f.pos) !== 1) return false;
    const dir = { x: f.pos.x - h.pos.x, y: f.pos.y - h.pos.y };
    return dir.x === 0 || dir.y === 0 || canStep(s.map, h.pos, dir);
  });
  const foe = adjacent.find(f => f.id === (target ?? h.target)) ?? adjacent[0];
  if (foe) return { kind: 'melee', action: { kind: 'move', dir: { x: foe.pos.x - h.pos.x, y: foe.pos.y - h.pos.y } }, foe: foe.id };
  const w = activeWeapon(h.gear);
  if (w && !WEAPONS[w.group].melee) {
    return target && shootable(s).includes(target) ? { kind: 'shoot', action: { kind: 'shoot', target }, foe: target } : null;
  }
  const other = h.gear.hands[h.gear.active === 0 ? 1 : 0];
  return other && !WEAPONS[other.group].melee ? { kind: 'swap' } : null;
}

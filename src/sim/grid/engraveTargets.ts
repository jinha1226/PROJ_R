import { canSwingAt } from './combos';
import { gunInHand, inShot } from './kataTargets';
import type { TriggerCtx } from './kataBus';
import { add, idx, same, type GridState } from './types';

export function adjacentSlashes(s: GridState, c: TriggerCtx): TriggerCtx[] {
  const foes = c.neighbours ?? s.foes.filter(f => f.alive && canSwingAt(s, s.hero.pos, f.pos));
  if (foes.length < 2) return [];
  return foes.map(foe => ({ ...c, foe, activeBlade: true }));
}

export function barrageShots(s: GridState, c: TriggerCtx): TriggerCtx[] {
  const gun = gunInHand(s);
  if (!gun) return [];
  return s.foes.filter(foe => s.visible.has(idx(s.map, foe.pos)) && inShot(s, gun, { ...c, foe }))
    .map(foe => ({ ...c, foe, chargeCost: 1 }));
}

/** Only a directly collinear neighbouring cell is behind the struck foe. */
export function pierceShot(s: GridState, c: TriggerCtx): TriggerCtx[] {
  if (!c.foe) return [];
  const dx = c.foe.pos.x - s.hero.pos.x, dy = c.foe.pos.y - s.hero.pos.y;
  if ((!dx && !dy) || (dx && dy && Math.abs(dx) !== Math.abs(dy))) return [];
  const at = add(c.foe.pos, { x: Math.sign(dx), y: Math.sign(dy) });
  const foe = s.foes.find(f => f.alive && same(f.pos, at));
  return foe ? [{ ...c, foe, through: c.foe, chargeCost: 0 }] : [];
}

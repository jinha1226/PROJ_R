import { idx } from '../../sim/grid/types';
import { entOf, unitOf, type Unit } from '../../sim/party/partyCore';
import type { DelveParty } from '../../sim/delve/delveSim';

/** The foes a clone could go for: awake, alive and in sight — the nearest first. */
export function foesInSight(p: DelveParty, id: string): Unit[] {
  const e = entOf(p, id);
  if (!e?.alive) return [];
  const far = (u: Unit) => { const o = entOf(p, u.id)!.pos; return Math.hypot(o.x - e.pos.x, o.y - e.pos.y); };
  return p.units.filter((u) => u.side === 'foe' && !u.asleep && entOf(p, u.id)?.alive && p.s.visible.has(idx(p.s.map, entOf(p, u.id)!.pos))).sort((a, b) => far(a) - far(b));
}

/** Whom the attack key strikes: the foe the clone was told to go for, else the one picked with the target key, else the nearest. */
export function attackTarget(p: DelveParty, id: string, picked?: string): Unit | undefined {
  const me = unitOf(p, id);
  if (!me || !entOf(p, id)?.alive) return undefined;
  const told = me.order?.kind === 'attack' ? unitOf(p, me.order.target) : undefined;
  if (told && entOf(p, told.id)?.alive) return told;
  const list = foesInSight(p, id);
  return list.find((u) => u.id === picked) ?? list[0];
}

/** The target key: the foe after the one the attack key would strike now, going outward and round again. */
export function nextTarget(p: DelveParty, id: string, picked?: string): Unit | undefined {
  const list = foesInSight(p, id), now = attackTarget(p, id, picked);
  if (!list.length) return undefined;
  return list[(list.findIndex((u) => u.id === now?.id) + 1) % list.length];
}

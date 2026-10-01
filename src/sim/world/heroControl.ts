import type { Vec2 } from '../../core/vec2';
import { xitem } from '../../data/extract';
import { isActionBlocked } from '../battle/tags';
import { effectiveStats } from '../battle/stats';
import { removeAt } from '../extract/loadout';
import type { WorldState } from './types';
import { emitW, heroUnit } from './worldState';
import { alertGroup } from './perception';
import { goHome } from './patrol';

export interface HeroInput {
  /** world-space direction for the leader */
  move: Vec2;
  /** quick slot index to use this tick */
  quick: number | null;
  interact: boolean;
  focus: boolean;
  retreat: boolean;
  regroup: boolean;
}

export const idleInput = (): HeroInput => ({ move: { x: 0, y: 0 }, quick: null, interact: false, focus: false, retreat: false, regroup: false });

export const SEC = 20;
const HIDE_TICKS = 4 * SEC;
const DRINK_TICKS = 16;
const RECALL_TICKS = 10 * SEC;

/** Uses the item in a quick slot: potions take a moment, the rest act at once. */
/** Uses a consumable from a quick slot or straight from the shared pack. */
export function useItem(w: WorldState, where: 'quick' | 'bag', index: number): void {
  const s = where === 'quick' ? w.hero.loadout.quick[index] : w.hero.loadout.bag[index];
  if (!s) return;
  const use = xitem(s.id).use;
  if (!use) return;
  if (use.kind === 'heal' && w.hero.drink) return;
  if (use.kind === 'recall' && w.hero.channel && w.hero.channel.kind !== 'search') return;
  w.hero.loadout = removeAt(w.hero.loadout, where, index, 1).loadout;
  const tick = w.b.tick;
  if (use.kind === 'heal') w.hero.drink = { ticks: 0, total: DRINK_TICKS, item: s.id };
  else if (use.kind === 'antidote') w.hero.poisonImmuneUntil = tick + use.sec * SEC;
  else if (use.kind === 'recall') w.hero.channel = { kind: 'recall', ticks: 0, total: RECALL_TICKS };
  else {
    const h = heroUnit(w);
    for (const [g, grp] of Object.entries(w.groups)) {
      if (grp.hunter || !grp.alerted) continue;
      if (grp.members.some((id) => { const m = w.b.units.find((x) => x.id === id); return m?.alive && Math.hypot(m.pos.x - h.pos.x, m.pos.y - h.pos.y) <= use.radius; })) goHome(w, g);
    }
    w.hero.hiddenUntil = tick + HIDE_TICKS;
  }
  emitW(w, 'use', { item: s.id });
}

/** Quick items and the leader's movement (the leader leaves the AI while the stick is held). */
export function applyHeroInput(w: WorldState, input: HeroInput): void {
  const u = heroUnit(w);
  if (!u.alive || u.downed) return;
  if (input.quick !== null) useItem(w, 'quick', input.quick);
  const ch = w.hero.channel;
  const len = Math.min(1, Math.hypot(input.move.x, input.move.y));
  if (len > 0.1 && ch && ch.kind !== 'extract') w.hero.channel = undefined;
  if (!u.setup.controlled || u.action || u.forced || isActionBlocked(u)) return;
  if (len > 0.1) {
    const speed = effectiveStats(u, w.b).moveSpeed;
    const k = (speed * len) / Math.hypot(input.move.x, input.move.y);
    u.vel = { x: input.move.x * k, y: input.move.y * k };
    u.facing = Math.atan2(input.move.y, input.move.x);
  } else u.vel = { x: 0, y: 0 };
}

/** Hitting an unaware enemy alerts its whole group. */
export function alertOnHit(w: WorldState): void {
  for (const e of w.b.events) if (e.type === 'damage' && e.src && w.party.order.includes(e.src) && e.dst) alertGroup(w, w.groupOf[e.dst] ?? '');
}

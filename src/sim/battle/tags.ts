import { len } from '../../core/vec2';
import { TAGS } from '../../data/tags';
import type { TagId } from '../../data/types';
import { TICK_RATE, secToTicks } from './constants';
import { dealDamage } from './damage';
import { emit } from './events';
import type { BattleState, UnitState } from './types';

export function hasTag(u: UnitState, tag: TagId): boolean {
  return u.tags.some((t) => t.tag === tag);
}

export function isActionBlocked(u: UnitState): boolean {
  return u.tags.some((t) => TAGS[t.tag].blocksAction);
}

/** Same tag refreshes to the longer remaining duration. */
export function addTag(s: BattleState, dst: UnitState, tag: TagId, durationSec: number, value: number, srcId: string): void {
  if (!dst.alive) return;
  const ticks = secToTicks(durationSec);
  const cur = dst.tags.find((t) => t.tag === tag);
  if (cur) {
    cur.ticksLeft = Math.max(cur.ticksLeft, ticks);
    cur.value = Math.max(cur.value, value);
    cur.srcId = srcId;
  } else {
    dst.tags.push({ tag, ticksLeft: ticks, value, srcId });
  }
  emit(s, { type: 'tag_add', src: srcId, dst: dst.id, tag, data: { ticks } });
}

export function removeTag(s: BattleState, u: UnitState, tag: TagId): void {
  if (!hasTag(u, tag)) return;
  u.tags = u.tags.filter((t) => t.tag !== tag);
  if (tag === 'shield') u.shield = 0;
  emit(s, { type: 'tag_remove', dst: u.id, tag });
}

const moving = (u: UnitState): boolean => !!u.forced || len(u.vel) > 0.1;

export function tickTags(s: BattleState): void {
  for (const u of s.units) {
    if (!u.alive || u.tags.length === 0) continue;
    for (const t of [...u.tags]) {
      t.ticksLeft--;
      const dot = t.tag === 'burn' || (t.tag === 'bleed' && moving(u));
      if (dot && t.ticksLeft % TICK_RATE === 0 && t.value > 0) {
        const src = s.units.find((x) => x.id === t.srcId);
        if (src) dealDamage(s, src, u, { mult: t.value, canDodge: false, canCrit: false, skillId: t.tag });
      }
      if (t.ticksLeft <= 0 && u.alive) removeTag(s, u, t.tag);
    }
  }
}

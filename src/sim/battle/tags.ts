import { TAGS } from '../../data/tags';
import type { TagId } from '../../data/types';
import type { UnitState } from './types';

export function hasTag(u: UnitState, tag: TagId): boolean {
  return u.tags.some((t) => t.tag === tag);
}

export function isActionBlocked(u: UnitState): boolean {
  return u.tags.some((t) => TAGS[t.tag].blocksAction);
}

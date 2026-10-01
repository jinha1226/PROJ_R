import { xitem } from '../../data/extract';

/** n of one item occupying one slot (n ≤ the item's stack size). */
export interface Stack {
  id: string;
  n: number;
}

export const stackWeight = (s: Stack | null | undefined): number => (s ? xitem(s.id).weight * s.n : 0);
export const stackValue = (s: Stack | null | undefined): number => (s ? xitem(s.id).value * s.n : 0);

/**
 * Puts up to n of id into a slot list: tops up partial stacks first, then opens new slots while
 * fewer than maxSlots are used. `room(k)` says whether k more units may be added (weight).
 */
export function putInto(list: Stack[], id: string, n: number, maxSlots: number, room: (k: number) => boolean): { list: Stack[]; added: number } {
  const cap = xitem(id).stack;
  const out = list.map((s) => ({ ...s }));
  let added = 0;
  for (const s of out) {
    if (added >= n) break;
    if (s.id !== id || s.n >= cap) continue;
    while (s.n < cap && added < n && room(added + 1)) { s.n++; added++; }
  }
  while (added < n && out.length < maxSlots && room(added + 1)) {
    const take = Math.min(cap, n - added);
    let k = 0;
    while (k < take && room(added + k + 1)) k++;
    if (k === 0) break;
    out.push({ id, n: k });
    added += k;
  }
  return { list: out, added };
}

/** Merges stacks into a pile list (ground piles have no slot limit). */
export function mergeAll(list: Stack[], extra: Stack[]): Stack[] {
  let out = list;
  for (const s of extra) out = putInto(out, s.id, s.n, Infinity, () => true).list;
  return out;
}

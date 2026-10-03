import type { BuffKind, Ent, GridState } from './types';

/** Is a timed effect (kept as the game time it runs out) still on at `now`? */
export function buffOn(e: Ent, k: BuffKind, now: number): boolean {
  return (e.buffs?.[k] ?? 0) > now + 1e-9;
}

/** Puts a timed effect on for `turns` from `t` (a longer one already on is kept). */
export function addBuff(s: GridState, e: Ent, k: BuffKind, turns: number, t: number): void {
  const b = (e.buffs ??= {});
  b[k] = Math.max(b[k] ?? 0, t + turns);
  // a confused or frightened caster loses the spell it had marked (it would land late on an empty spot)
  if (k === 'confuse' || k === 'fear') s.telegraphs = s.telegraphs.filter((x) => x.src !== e.id);
  s.events.push({ t, type: 'buff', src: e.id, dst: e.id, text: k, to: { ...e.pos } });
}

export function clearBuff(e: Ent, k: BuffKind): void {
  if (e.buffs) delete e.buffs[k];
}

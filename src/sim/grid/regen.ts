import { dist, idx, type GridState } from './types';

export function canRegenerate(s: GridState): boolean {
  const h = s.hero;
  return h.alive && !(h.status?.burn || h.status?.poison) && !s.foes.some((f) =>
    f.alive && f.awake && dist(h.pos, f.pos) <= 8 && s.visible.has(idx(s.map, f.pos)));
}

/** Six safe turns per HP; danger discards the bank, full health cannot stockpile it. */
export function regenerate(s: GridState, spent: number, safeAtStart = true): void {
  const h = s.hero;
  if (!safeAtStart || !canRegenerate(s)) { h.regenClock = 0; return; }
  if (spent <= 0) return;
  h.regenClock = (h.regenClock ?? 0) + spent;
  const gained = Math.min(h.maxHp - h.hp, Math.floor((h.regenClock + 1e-9) / 6));
  if (gained > 0) {
    h.hp += gained;
    h.regenClock -= gained * 6;
    s.events.push({ t: h.nextAt, type: 'heal', src: h.id, dst: h.id, amount: gained, text: 'regen' });
  }
  if (h.hp >= h.maxHp) h.regenClock = 0;
}

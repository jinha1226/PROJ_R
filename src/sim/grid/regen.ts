import { hasPerk } from './mods';
import { PERK_BALANCE } from './perks';
import { dist, idx, type GridState } from './types';

export function canRegenerate(s: GridState): boolean {
  const h = s.hero;
  return h.alive && !(h.status?.burn || h.status?.poison) && !s.foes.some((f) =>
    f.alive && f.awake && dist(h.pos, f.pos) <= 8 && s.visible.has(idx(s.map, f.pos)));
}

const REGEN_EVERY = 6;

/** Six safe turns per HP; danger discards the bank, full health cannot stockpile it. */
export function regenerate(s: GridState, spent: number, safeAtStart = true): void {
  const h = s.hero;
  if (h.alive && spent > 0) {
    h.manaClock = (h.manaClock ?? 0) + spent;
    const mana = Math.floor((h.manaClock + 1e-9) / 1.5);
    h.charge = Math.min(h.maxCharge, h.charge + mana);
    h.manaClock -= mana * 1.5;
    if (h.charge >= h.maxCharge) h.manaClock = 0;
  }
  if (!safeAtStart || !canRegenerate(s)) {
    h.regenClock = 0;
    if (!h.alive || h.status?.burn || h.status?.poison || !hasPerk(h, 'regenPack') || h.hp >= h.maxHp) { h.regenCombat = 0; return; }
    if (spent <= 0) return;
    h.regenCombat = (h.regenCombat ?? 0) + spent;
    const gained = Math.min(h.maxHp - h.hp, Math.floor((h.regenCombat + 1e-9) / PERK_BALANCE.combatRegen));
    if (gained) {
      h.hp += gained; h.regenCombat -= gained * PERK_BALANCE.combatRegen;
      s.events.push({ t: h.nextAt, type: 'heal', src: h.id, dst: h.id, amount: gained, text: 'regen' });
    }
    if (h.hp >= h.maxHp) h.regenCombat = 0;
    return;
  }
  h.regenCombat = 0;
  if (spent <= 0) return;
  h.regenClock = (h.regenClock ?? 0) + spent;
  const gained = Math.min(h.maxHp - h.hp, Math.floor((h.regenClock + 1e-9) / REGEN_EVERY));
  if (gained > 0) {
    h.hp += gained;
    h.regenClock -= gained * REGEN_EVERY;
    s.events.push({ t: h.nextAt, type: 'heal', src: h.id, dst: h.id, amount: gained, text: 'regen' });
  }
  if (h.hp >= h.maxHp) h.regenClock = 0;
}

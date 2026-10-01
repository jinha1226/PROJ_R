import { heroSetup } from '../extract/heroSetup';
import type { WorldState } from './types';
import { heroUnit } from './worldState';

/** Re-derives the hero's stats after the loadout changed (gear, weight). */
export function refreshHero(w: WorldState): void {
  const u = heroUnit(w);
  const next = { ...heroSetup(w.hero.merc, w.hero.loadout), id: u.id, controlled: u.setup.controlled, spawn: u.setup.spawn };
  u.setup = next;
  u.maxHp = next.stats.maxHp;
  u.hp = Math.min(u.hp, u.maxHp);
}

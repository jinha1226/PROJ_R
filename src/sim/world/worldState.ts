import type { UnitState } from '../battle/types';
import type { Loadout } from '../extract/loadout';
import type { Region } from '../extract/regionTypes';
import type { Mercenary } from '../roster/types';
import type { WorldState } from './types';
import { createPartyWorld } from './party';

export const HERO_ID = 'hero';

export function unit(w: WorldState, id: string): UnitState {
  const u = w.b.units.find((x) => x.id === id);
  if (!u) throw new Error(`no unit ${id}`);
  return u;
}
export const heroUnit = (w: WorldState): UnitState => unit(w, w.heroId);

/** A one-member party (the old single-hero sortie, kept for tests and tools): worn gear stays on the member, the bag becomes the pack. */
export function createWorld(region: Region, hero: Mercenary, loadout: Loadout, seed: number): WorldState {
  return createPartyWorld(region, [{ merc: { ...hero, id: HERO_ID }, gear: loadout }], loadout.bag, loadout.pouch, seed, loadout.quick);
}

export function emitW(w: WorldState, type: string, data?: Record<string, unknown>): void {
  w.events.push({ tick: w.b.tick, type, data });
}

/** Switches a unit between world control (unaware) and the battle AI (alert). */
export function setAware(u: UnitState, aware: boolean): void {
  if (!!u.setup.controlled === !aware) return;
  u.setup = { ...u.setup, controlled: !aware };
  if (aware) u.decisionIn = 1;
  u.vel = { x: 0, y: 0 };
}

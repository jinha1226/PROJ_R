import type { UnitSetup } from '../../sim/battle/types';
import { Actor } from './actor';
import type { AssetLibrary } from './assets';

export function actorFromSetup(u: UnitSetup, lib: AssetLibrary): Actor {
  return new Actor({ id: u.id, model: u.model, gear: u.gear, color: u.color, tint: u.tint, scale: u.scale, team: u.team }, lib);
}

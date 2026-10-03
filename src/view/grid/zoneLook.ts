import type { HemisphereLight } from 'three';
import { zoneOf, type ZoneId } from '../../sim/grid/zones';

const LOOKS: Record<ZoneId, { color: string; intensity: number; density: number }> = {
  // dark, but never so dark the floor and foes cannot be read: the hero's own light and torches carry the scene
  cave: { color: '#6f8a8a', intensity: 0.4, density: 0.5 },
  crypt: { color: '#8a96b8', intensity: 0.46, density: 1 },
  ruins: { color: '#c8bfa0', intensity: 0.54, density: 1 },
};

/** Apply the zone's ambient light and return its torch density and light budget. */
export function applyZoneLook(hemi: HemisphereLight, floor: number, mobile: boolean): { density: number; lights: number } {
  const look = LOOKS[zoneOf(floor).id];
  hemi.color.set(look.color);
  hemi.intensity = look.intensity;
  return { density: look.density, lights: Math.round((mobile ? 3 : 6) * look.density) };
}

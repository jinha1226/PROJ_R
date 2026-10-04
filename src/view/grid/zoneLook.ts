import type { HemisphereLight } from 'three';
import { zoneOf, type ZoneId } from '../../sim/grid/zones';

/** What sets a zone apart at pixel size: ambient light, a tint over the stone, the colour of its fires, its floor litter. */
export interface ZoneLook { color: string; intensity: number; density: number; tint: string; torch: string; flame: string; decal: string }

const LOOKS: Record<ZoneId, ZoneLook> = {
  // dark, but never so dark the floor and foes cannot be read: the hero's own light and torches carry the scene
  cave: { color: '#6f8a8a', intensity: 0.4, density: 0.5, tint: '#b09a82', torch: '#ff9a40', flame: '#ffb347', decal: '#1c2a30' },
  crypt: { color: '#7d8ab8', intensity: 0.46, density: 1, tint: '#8a93b4', torch: '#7fa8ff', flame: '#b0ccff', decal: '#d8d2c0' },
  ruins: { color: '#a8b890', intensity: 0.54, density: 1, tint: '#a8aa84', torch: '#5fe8b0', flame: '#a8ffd8', decal: '#3e6a32' },
};

export const zoneLook = (floor: number): ZoneLook => LOOKS[zoneOf(Math.max(1, floor)).id];

/** Apply the zone's ambient light and return its look, torch density and light budget. */
export function applyZoneLook(hemi: HemisphereLight, floor: number, mobile: boolean): ZoneLook & { lights: number } {
  const look = zoneLook(floor);
  hemi.color.set(look.color);
  hemi.intensity = look.intensity;
  // the light count never changes between zones (three.js recompiles every material when it does); only torch models thin out
  return { ...look, lights: mobile ? 3 : 6 };
}

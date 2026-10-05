import type { HemisphereLight } from 'three';
import { zoneOf, type ZoneId } from '../../sim/grid/zones';

/** What sets a zone apart at pixel size: ambient light, a tint over the stone, the colour of its fires, its floor litter. */
export interface ZoneLook { color: string; intensity: number; density: number; tint: string; torch: string; flame: string; decal: string }

const LOOKS: Record<ZoneId, ZoneLook> = {
  // dark, but never so dark the floor and foes cannot be read: the hero's own light and torches carry the scene
  // the pack's own sandstone and grey floor show through; a zone only leans its stone and light a little
  cave: { color: '#c4ccd6', intensity: 0.9, density: 0.6, tint: '#f2ece2', torch: '#ffb66a', flame: '#ffc070', decal: '#3a3c3e' },
  crypt: { color: '#a8b4d8', intensity: 0.85, density: 1, tint: '#c4cce0', torch: '#8fb4ff', flame: '#c0d4ff', decal: '#d8d2c0' },
  ruins: { color: '#c0d0b0', intensity: 0.9, density: 1, tint: '#d4dec2', torch: '#7ff0c0', flame: '#b0ffe0', decal: '#3e6a32' },
};

export const zoneLook = (floor: number): ZoneLook => LOOKS[zoneOf(Math.max(1, floor)).id];

/** Apply the zone's ambient light and return its look, torch density and light budget. */
export function applyZoneLook(hemi: HemisphereLight, floor: number, mobile: boolean): ZoneLook & { lights: number } {
  const look = zoneLook(floor);
  hemi.color.set(look.color);
  // light from below too, so the sides of columns and props never sink to black
  hemi.groundColor.set('#4a4640');
  hemi.intensity = look.intensity;
  // the light count never changes between zones (three.js recompiles every material when it does); only torch models thin out
  return { ...look, lights: mobile ? 3 : 6 };
}

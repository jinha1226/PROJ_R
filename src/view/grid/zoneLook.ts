import type { HemisphereLight } from 'three';
import { zoneOf, type ZoneId } from '../../sim/grid/zones';

/** What sets a zone apart at pixel size: ambient light, a tint over the stone, the colour of its fires, its floor litter. */
export interface ZoneLook { color: string; intensity: number; density: number; tint: string; torch: string; flame: string; decal: string; accent: string }

const LOOKS: Record<ZoneId, ZoneLook> = {
  // dark, but never so dark the floor and foes cannot be read: the hero's own light and torches carry the scene
  // the pack's own sandstone and grey floor show through; a zone only leans its stone and light a little
  // dark between the lights, as in Jupiter Hell: warm torch pools and a zone's own accent glow carry the scene
  cave: { color: '#5a6478', intensity: 0.34, density: 1, tint: '#f2ece2', torch: '#ffa860', flame: '#ffb860', decal: '#3a3c3e', accent: '#3ab8ff' },
  crypt: { color: '#4a5880', intensity: 0.32, density: 1, tint: '#c4cce0', torch: '#ffa860', flame: '#ffb860', decal: '#d8d2c0', accent: '#5a8cff' },
  ruins: { color: '#4e6450', intensity: 0.34, density: 1, tint: '#d4dec2', torch: '#ffa860', flame: '#ffb860', decal: '#3e6a32', accent: '#3affa0' },
};

export const zoneLook = (floor: number): ZoneLook => LOOKS[zoneOf(Math.max(1, floor)).id];

/** Apply the zone's ambient light and return its look, torch density and light budget. */
export function applyZoneLook(hemi: HemisphereLight, floor: number, mobile: boolean): ZoneLook & { lights: number } {
  const look = zoneLook(floor);
  hemi.color.set(look.color);
  // light from below too, so the sides of columns and props never sink to black
  hemi.groundColor.set('#26221e');
  hemi.intensity = look.intensity;
  // the light count never changes between zones (three.js recompiles every material when it does); only torch models thin out
  return { ...look, lights: mobile ? 3 : 6 };
}

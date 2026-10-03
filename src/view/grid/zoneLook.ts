import type { HemisphereLight } from 'three';
import { zoneOf, type ZoneId } from '../../sim/grid/zones';

const LOOKS: Record<ZoneId, { color: string; intensity: number; density: number }> = {
  cave: { color: '#7f9a8a', intensity: 0.7, density: 0.5 },
  crypt: { color: '#aab0c8', intensity: 0.85, density: 1 },
  ruins: { color: '#d8cfae', intensity: 0.95, density: 1 },
};

/** Apply the zone's ambient light and return its torch density and light budget. */
export function applyZoneLook(hemi: HemisphereLight, floor: number, mobile: boolean): { density: number; lights: number } {
  const look = LOOKS[zoneOf(floor).id];
  hemi.color.set(look.color);
  hemi.intensity = look.intensity;
  return { density: look.density, lights: Math.round((mobile ? 3 : 6) * look.density) };
}

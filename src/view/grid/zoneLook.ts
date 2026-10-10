import type { DirectionalLight, HemisphereLight, PointLight, WebGLRenderer } from 'three';
import { zoneOf, type ZoneId } from '../../sim/grid/zones';

/** What sets a zone apart at pixel size: ambient light, a tint over the stone, the colour of its fires, its floor litter. */
export interface ZoneLook { color: string; intensity: number; density: number; tint: string; torch: string; flame: string; decal: string; accent?: string }

const LOOKS: Record<ZoneId, ZoneLook> = {
  // dark, but never so dark the floor and foes cannot be read: the hero's own light and torches carry the scene
  // the pack's own sandstone and grey floor show through; a zone only leans its stone and light a little
  // dark between the lights, as in Jupiter Hell: warm torch pools and a zone's own accent glow carry the scene
  // the first floors burn torches only: one warm light throughout
  cave: { color: '#5a6478', intensity: 0.34, density: 1, tint: '#f2ece2', torch: '#ffa860', flame: '#ffb860', decal: '#3a3c3e' },
  crypt: { color: '#4a5880', intensity: 0.32, density: 1, tint: '#c4cce0', torch: '#ffa860', flame: '#ffb860', decal: '#d8d2c0', accent: '#5a8cff' },
  ruins: { color: '#4e6450', intensity: 0.34, density: 1, tint: '#d4dec2', torch: '#ffa860', flame: '#ffb860', decal: '#3e6a32', accent: '#3affa0' },
};

export const zoneLook = (floor: number): ZoneLook => LOOKS[zoneOf(Math.max(1, floor)).id];

/**
 * `?dark`: the dungeon in the dark, to try beside the usual look (which stays the default). Cold shadow everywhere; the
 * clone's own light is warm, flickering and a few cells wide (no torch is drawn in its hand: 2026-10-10), wall torches are
 * few, and blows and shots light the room for a moment longer. Numbers to tune by eye (2026-10-10: the lights themselves
 * turned well down — torches, their glow, the clone's own light and the flashes hurt the eye against the dark).
 */
export const DARK = {
  on: typeof location !== 'undefined' && new URLSearchParams(location.search).has('dark'),
  ambient: 2.5, sky: '#3558a8', ground: '#0c1220', tint: '#b4bccc', walls: 0.35, reach: 5, power: 0.4, glow: 0.4,
  torch: { color: '#ffa860', intensity: 10, distance: 6.5 }, cast: 2.6, shade: 0.4, sun: 0.08, exposure: 1.0, flash: 0.35, linger: 1.3,
};

/**
 * `?bright`: the dungeon in even daylight (2026-10-10: the dim look with its pools of torchlight and its flashes tired the
 * eye). One high, soft light over everything and a sun for shape; no light is carried, torches barely glow, blows and
 * blasts light nothing up and the screen shakes less. What is out of sight is still dimmed by the terrain itself.
 */
export const BRIGHT = {
  on: typeof location !== 'undefined' && new URLSearchParams(location.search).has('bright'),
  ambient: 1.9, sky: '#f6f2ea', ground: '#9a9488', tint: '#ffffff', sun: 1.3, sunColor: '#fff2dc', power: 0.12, glow: 0.25, flash: 0, shake: 0.4, exposure: 0.95,
};
/** how much of a flash's light a look lets through */
export const flashGain = (): number => (DARK.on ? DARK.flash : BRIGHT.on ? BRIGHT.flash : 1);

/** A look's part outside the zone's own. Dark: the clone's warm light, the moon, the exposure and a shadow round the screen's edge. Bright: no carried light, a sun. */
export function relight(lamp: PointLight, sun: DirectionalLight, renderer: WebGLRenderer, el: HTMLElement): void {
  if (BRIGHT.on) { lamp.intensity = 0; sun.color.set(BRIGHT.sunColor); sun.intensity = BRIGHT.sun; renderer.toneMappingExposure = BRIGHT.exposure; return; }
  if (!DARK.on) return;
  lamp.color.set(DARK.torch.color); lamp.distance = DARK.torch.distance;
  sun.intensity = DARK.sun;
  renderer.toneMappingExposure = DARK.exposure;
  const edge = document.createElement('div');
  edge.className = 'grid-vignette';
  el.appendChild(edge);
}

/** Where the clone's light hangs: a little behind and above it (figures are rimmed, not burnt out) — in the dark, low at its side and flickering. */
export function carry(lamp: PointLight, x: number, z: number, t: number): void {
  if (!DARK.on) { lamp.position.set(x, 2.6, z - 1.2); return; }
  lamp.position.set(x + 0.35, 1.9, z - 0.5);
  lamp.intensity = DARK.torch.intensity * (1 + Math.sin(t * 9) * 0.07 + Math.sin(t * 17.3) * 0.05);
}

/** Apply the zone's ambient light and return its look, torch density and light budget. */
export function applyZoneLook(hemi: HemisphereLight, floor: number, mobile: boolean): ZoneLook & { lights: number; reach?: number; power?: number } {
  const look = zoneLook(floor);
  if (BRIGHT.on) {
    hemi.color.set(BRIGHT.sky); hemi.groundColor.set(BRIGHT.ground); hemi.intensity = BRIGHT.ambient;
    return { ...look, lights: mobile ? 3 : 6, tint: BRIGHT.tint, power: BRIGHT.power };
  }
  hemi.color.set(DARK.on ? DARK.sky : look.color);
  // light from below too, so the sides of columns and props never sink to black
  hemi.groundColor.set(DARK.on ? DARK.ground : '#26221e');
  hemi.intensity = look.intensity * (DARK.on ? DARK.ambient : 1);
  // the light count never changes between zones (three.js recompiles every material when it does); only torch models thin out
  return { ...look, lights: mobile ? 3 : 6, ...(DARK.on ? { tint: DARK.tint, density: look.density * DARK.walls, reach: DARK.reach, power: DARK.power } : {}) };
}

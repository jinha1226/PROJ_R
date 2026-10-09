import * as THREE from 'three';
import type { BodyShape } from './species';
import type { FigureMat } from './toon';

/**
 * A try-out of a chunkier, simpler figure for bigger dots (2026-10-09), switched in the address bar:
 * `?flat` draws every figure in one flat colour (a clone its class line's, a foe its body's; no light, no shade, no trim),
 * `?flat=2` flat too but each part in its own colour (skin, cloth, trim), and `?stub` gives it a stubby
 * build — a bigger head, shorter limbs, the whole body fattened by pushing its skin outward. `?stub=fat,head,limb` sets
 * the three by hand (metres of a full-size figure, then two scales). Without either, nothing changes.
 */
export interface FigTry { flat: 0 | 1 | 2; fat: number; head: number; limb: number }
const NONE: FigTry = { flat: 0, fat: 0, head: 1, limb: 1 };
let cached: FigTry | null = null;
export function figTry(): FigTry {
  if (cached) return cached;
  if (typeof location === 'undefined') return (cached = NONE);
  const q = new URLSearchParams(location.search), stub = q.get('stub');
  const [fat, head, limb] = stub === null ? [0, 1, 1] : [0.035, 1.35, 0.8].map((d, i) => { const n = Number(stub.split(',')[i]); return stub.split(',')[i] && Number.isFinite(n) ? n : d; });
  return (cached = { flat: !q.has('flat') ? 0 : q.get('flat') === '2' ? 2 : 1, fat: fat!, head: head!, limb: limb! });
}

const times = (a: number | [number, number, number] | undefined, k: number): number | [number, number, number] => (a === undefined ? k : Array.isArray(a) ? [a[0] * k, a[1] * k, a[2] * k] : a * k);

/** The stubby build laid over a look's own: the head bigger, arms and legs shorter from their roots (the hands kept their size, for what they hold). */
export function stubShape(shape: BodyShape | undefined, t: FigTry): BodyShape | undefined {
  if (t.head === 1 && t.limb === 1) return shape;
  const scale = { ...(shape?.scale ?? {}) };
  scale.Head = times(scale.Head, t.head);
  for (const b of ['thigh_l', 'thigh_r', 'upperarm_l', 'upperarm_r']) scale[b] = times(scale[b], t.limb);
  for (const b of ['hand_l', 'hand_r']) scale[b] = times(scale[b], 1 / t.limb);
  return { ...(shape ?? { hunch: 0 }), scale };
}

/** How far a figure sinks so its shortened legs still stand on the floor (measured in the rest pose). */
export function legDrop(model: THREE.Object3D, limb: number): number {
  model.updateMatrixWorld(true);
  const hip = model.getObjectByName('thigh_l'), foot = model.getObjectByName('foot_l');
  if (!hip || !foot || limb === 1) return 0;
  return (hip.getWorldPosition(new THREE.Vector3()).y - foot.getWorldPosition(new THREE.Vector3()).y) * (1 - limb);
}

/** Pushes a material's surface out along its normals by `thick` (the mesh's own units). */
export function fattenMat(m: THREE.Material, thick: number): void {
  // (a material several parts share is fattened once)
  if (m.userData.fat) return;
  m.userData.fat = thick;
  const before = m.onBeforeCompile, key = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    before.call(m, sh, r);
    sh.uniforms.uFat = { value: thick };
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'uniform float uFat;\nvoid main() {').replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize(normal) * uFat;');
  };
  m.customProgramCacheKey = () => `${key.call(m)}-fat`;
}

/** Fattens every skinned part of a figure by `worldThick` metres; each mesh remembers by how much (the dot look's mask is fattened to match). */
export function fatten(model: THREE.Object3D, worldThick: number): void {
  if (!worldThick) return;
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh || o.userData.outline) return;
    const s = m.getWorldScale(new THREE.Vector3()), thick = worldThick / Math.max(1e-6, (s.x + s.y + s.z) / 3);
    m.userData.fat = thick;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) fattenMat(mat, thick);
  });
}

/**
 * Flat colour: the material takes no light and no rim; what it shows is what the actor gives it to glow with — `one` for
 * the whole figure, or each part's own colour. (The dot look raises a figure's tones before its palette snap, which
 * washes a bright colour out to a pale one: the colour is darkened by as much first, so it lands where it was meant.)
 */
export function flatten(mats: FigureMat[], one?: THREE.ColorRepresentation): void {
  for (const m of mats) {
    const own = one === undefined ? m.color.clone() : new THREE.Color(one);
    m.userData.own = own.setRGB(own.r * own.r, own.g * own.g, own.b * own.b);
    m.color.set('#000000'); m.map = null; m.emissiveMap = null; m.emissiveIntensity = 1; m.onBeforeCompile = () => {}; m.customProgramCacheKey = () => 'flat-figure';
    if ('roughness' in m) { m.roughness = 1; m.metalness = 0; m.normalMap = null; m.roughnessMap = null; m.metalnessMap = null; }
  }
}

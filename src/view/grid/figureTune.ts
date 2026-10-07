import * as THREE from 'three';
import data from '../../data/figureTune.json';

/** a held thing's offset in the hand's frame: where (metres), how turned (degrees about x, y, z) and how big */
export interface HeldTune { pos: [number, number, number]; rot: [number, number, number]; scale: number }
/** a class's body: how tall and how broad against the base mannequin */
export interface BodyTune { height: number; girth: number }
export interface FigureTune { weapons: Record<string, HeldTune>; offhand: Record<string, HeldTune>; classes: Record<string, BodyTune> }

/**
 * Hand-tuned figure settings (`src/data/figureTune.json`, edited on `?demo=tune` and saved back into the repo): held
 * weapons' offsets per look (main and off hand) and each class's height and build. Live: the tune page edits it in place.
 */
export const TUNE: FigureTune = structuredClone(data) as unknown as FigureTune;
const IDENTITY: HeldTune = { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1 };
const DEG = Math.PI / 180;

export const heldTune = (kind: string, off = false): HeldTune => (off ? TUNE.offhand : TUNE.weapons)[kind] ?? IDENTITY;
export const bodyTune = (cls: string): BodyTune => TUNE.classes[cls] ?? { height: 1, girth: 1 };

/** The group a held thing hangs in, set to its tuned offset (identity for a look with no entry). */
export function tuneHolder(kind: string, off = false): THREE.Group {
  const t = heldTune(kind, off), g = new THREE.Group();
  g.position.set(...t.pos);
  g.rotation.set(t.rot[0] * DEG, t.rot[1] * DEG, t.rot[2] * DEG);
  g.scale.setScalar(t.scale);
  return g;
}

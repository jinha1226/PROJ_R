import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** one model of the pack: its geometry (standing on the ground, centred) and its materials */
export interface NaturePart { geo: THREE.BufferGeometry; mats: THREE.Material[] }

/** how tall (or wide, for low things) each kind stands, in cells */
const SIZE: Record<string, number> = { DeadTree: 2.6, TwistedTree: 2.5, Pine: 3.0, Tree: 2.8, RockMedium: 1.0, Bush: 0.8, GrassWispy: 0.4, TallGrass: 0.55, Fern: 0.5, Mushroom: 0.3, MushroomLaetiporus: 0.35, PebbleRound: 0.3 };

/** Quaternius' Stylized Nature MegaKit (a chosen 27 models in one file): blighted trees, pines, rocks, grass, ferns, mushrooms. */
export class NatureKit {
  private constructor(private readonly parts: Map<string, NaturePart>) {}

  static async load(baseUrl: string): Promise<NatureKit> {
    const g = await new GLTFLoader().loadAsync(`${baseUrl}assets/models/nature/nature.glb`);
    const parts = new Map<string, NaturePart>();
    g.scene.updateMatrixWorld(true);
    g.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const kind = o.name.replace(/_\d+$/, '');
      const geo = (o.geometry as THREE.BufferGeometry).clone().applyMatrix4(o.matrixWorld);
      geo.computeBoundingBox();
      const b = geo.boundingBox!, size = b.getSize(new THREE.Vector3());
      const low = kind.startsWith('Rock') || kind.startsWith('Pebble') || kind === 'Bush';
      const k = (SIZE[kind] ?? 1) / Math.max(1e-3, low ? Math.max(size.x, size.z) : size.y);
      // centred on its footprint, standing on the ground
      geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
      geo.scale(k, k, k);
      const mats = (Array.isArray(o.material) ? o.material : [o.material]) as THREE.Material[];
      parts.set(o.name, { geo, mats });
    });
    return new NatureKit(parts);
  }

  /** the variants of a kind (e.g. 'DeadTree' → DeadTree_1..5) */
  variants(kind: string): NaturePart[] { return [...this.parts.entries()].filter(([n]) => n.replace(/_\d+$/, '') === kind).map(([, p]) => p); }
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Theme } from '../../sim/run/types';
import { THEME_KITS } from './themeKit';

/** Loads the environment models a theme needs; clones are normalized by their bounding box. */
export class EnvLibrary {
  private readonly scenes = new Map<string, THREE.Group>();
  private readonly boxes = new Map<string, THREE.Box3>();

  static async load(baseUrl: string, theme: Theme): Promise<EnvLibrary> {
    const kit = THEME_KITS[theme];
    return EnvLibrary.loadRefs(baseUrl, [...kit.boundary.keys, kit.chest, ...(kit.floorTile ? [kit.floorTile.key] : []), ...Object.values(kit.props).flat(), 'graveyard/arch', 'graveyard/lantern', 'dungeon/torch']);
  }

  /** Loads an explicit set of env models (the extraction region mixes all themes). */
  static async loadRefs(baseUrl: string, list: string[]): Promise<EnvLibrary> {
    const lib = new EnvLibrary();
    const refs = new Set(list);
    const loader = new GLTFLoader();
    await Promise.all([...refs].map(async (ref) => {
      try {
        const g = await loader.loadAsync(`${baseUrl}assets/models/env/${ref}.glb`);
        g.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
        lib.scenes.set(ref, g.scene);
        lib.boxes.set(ref, new THREE.Box3().setFromObject(g.scene));
      } catch (cause) {
        throw new Error(`asset-load-failed: env/${ref} (${cause instanceof Error ? cause.message : String(cause)})`, { cause });
      }
    }));
    return lib;
  }

  /** The loaded model and its bounding box (for instancing). */
  source(ref: string): { scene: THREE.Group; box: THREE.Box3 } | undefined {
    const scene = this.scenes.get(ref);
    const box = this.boxes.get(ref);
    return scene && box ? { scene, box } : undefined;
  }

  has(ref: string): boolean {
    return this.scenes.has(ref);
  }

  /** Clone scaled so its footprint radius ≈ radius (or its width ≈ width when given). */
  clone(ref: string, opts: { radius?: number; width?: number; height?: number }): THREE.Object3D {
    const src = this.scenes.get(ref);
    const box = this.boxes.get(ref);
    if (!src || !box) return new THREE.Group();
    const obj = src.clone(true);
    const size = box.getSize(new THREE.Vector3());
    let s = 1;
    if (opts.width) s = opts.width / Math.max(0.01, size.x);
    else if (opts.radius) s = (opts.radius * 2.2) / Math.max(0.01, Math.max(size.x, size.z));
    else if (opts.height) s = opts.height / Math.max(0.01, size.y);
    obj.scale.setScalar(s);
    obj.position.y = -box.min.y * s;
    const holder = new THREE.Group();
    holder.add(obj);
    return holder;
  }
}

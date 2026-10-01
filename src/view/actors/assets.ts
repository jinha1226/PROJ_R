import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ModelId } from '../../data/types';
import type { AnimSet } from './animMap';
import { MODELS } from './modelManifest';

export interface AssetLibrary {
  character(model: ModelId): THREE.Group;
  prop(file: string): THREE.Group;
  clips(set: AnimSet): Map<string, THREE.AnimationClip>;
  /** Uniform scale that makes the model ~1.6m tall. */
  baseScale(model: ModelId): number;
}

const TARGET_HEIGHT = 1.6;
const PROP_FILES = [...new Set(Object.values(MODELS).flatMap((m) =>
  [...Object.values(m.weapons), ...Object.values(m.offhands)].filter((n) => n.startsWith('prop:')).map((n) => n.slice(5))))];

export async function loadAssets(baseUrl: string, onProgress?: (p: number) => void): Promise<AssetLibrary> {
  const loader = new GLTFLoader();
  const files = [
    ...Object.values(MODELS).map((m) => `models/characters/${m.file}.glb`),
    ...PROP_FILES.map((f) => `models/props/${f}.glb`),
    'models/anims-adventurer.glb',
    'models/anims-skeleton.glb',
  ];
  let done = 0;
  const loaded = new Map<string, { scene: THREE.Group; animations: THREE.AnimationClip[] }>();
  await Promise.all(files.map(async (f) => {
    try {
      const g = await loader.loadAsync(`${baseUrl}assets/${f}`);
      loaded.set(f, { scene: g.scene, animations: g.animations });
    } catch (cause) {
      throw new Error(`asset-load-failed: ${f} (${cause instanceof Error ? cause.message : String(cause)})`, { cause });
    }
    done++;
    onProgress?.(done / files.length);
  }));

  const get = (f: string) => {
    const g = loaded.get(f);
    if (!g) throw new Error(`asset-missing: ${f}`);
    return g;
  };
  const clipMaps: Record<AnimSet, Map<string, THREE.AnimationClip>> = {
    adventurer: new Map(get('models/anims-adventurer.glb').animations.map((c) => [c.name, c])),
    skeleton: new Map(get('models/anims-skeleton.glb').animations.map((c) => [c.name, c])),
  };
  const scales = new Map<ModelId, number>();
  for (const [id, m] of Object.entries(MODELS) as [ModelId, (typeof MODELS)[ModelId]][]) {
    const box = new THREE.Box3().setFromObject(get(`models/characters/${m.file}.glb`).scene);
    const h = box.max.y - box.min.y;
    scales.set(id, h > 0 ? TARGET_HEIGHT / h : 1);
  }
  return {
    character: (model) => cloneSkinned(get(`models/characters/${MODELS[model].file}.glb`).scene) as THREE.Group,
    prop: (file) => get(`models/props/${file}.glb`).scene.clone(true),
    clips: (set) => clipMaps[set],
    baseScale: (model) => scales.get(model) ?? 1,
  };
}

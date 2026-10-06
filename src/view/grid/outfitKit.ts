import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toonMat, type FigureMat } from './toon';

export type OutfitSet = 'Peasant' | 'Ranger';
export type OutfitExtra = 'hood' | 'pauldron';
/** Clothes worn over the mannequin: a base set, a colour laid over its texture, and pieces borrowed from the ranger. */
export interface OutfitLook { set: OutfitSet; tint: string; extra?: OutfitExtra[] }

const EXTRA: Record<OutfitExtra, string> = { hood: 'Male_Ranger_Head_Hood', pauldron: 'Male_Ranger_Acc_Pauldron' };

/** Whether a part (by mesh name) belongs on this outfit: the set's own pieces, minus the optional ones unless asked for. */
export function wearsPart(name: string, look: OutfitLook): boolean {
  const extras = look.extra ?? [];
  for (const [k, prefix] of Object.entries(EXTRA) as [OutfitExtra, string][]) if (name.startsWith(prefix)) return extras.includes(k);
  return name.startsWith(`Male_${look.set}_`);
}

/** The bare-skin pieces (forearms, hands) the outfits carry: drawn in the mannequin's colour so they read as its own. */
const isSkin = (m: THREE.Material): boolean => m.name.startsWith('MI_Regular');

/** Mannequin bones left showing under clothes: head and neck (the outfit brings its own arms and hands). */
const BARE = /^(Head|neck_01)$/;
const trimmed = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

/** The mannequin with only its bare parts kept (triangles whose corners all lean mostly on a bare bone); cached per geometry. */
export function bareParts(geo: THREE.BufferGeometry, boneNames: string[]): THREE.BufferGeometry {
  const hit = trimmed.get(geo);
  if (hit) return hit;
  const idx = geo.getIndex(), si = geo.getAttribute('skinIndex'), sw = geo.getAttribute('skinWeight');
  const bare = (v: number): boolean => {
    let best = 0;
    for (let i = 1; i < 4; i++) if (sw.getComponent(v, i) > sw.getComponent(v, best)) best = i;
    return BARE.test(boneNames[si.getComponent(v, best)] ?? '');
  };
  const count = idx ? idx.count : geo.getAttribute('position').count, keep: number[] = [];
  for (let t = 0; t < count; t += 3) {
    const tri = [0, 1, 2].map((k) => (idx ? idx.getX(t + k) : t + k));
    if (tri.every(bare)) keep.push(...tri);
  }
  const out = geo.clone();
  out.setIndex(keep);
  out.clearGroups();
  trimmed.set(geo, out);
  return out;
}

/** The Quaternius fantasy outfits, rebound onto any mannequin built on the same rig. */
export class OutfitKit {
  private constructor(private readonly scene: THREE.Group) {}

  static async load(baseUrl: string): Promise<OutfitKit> {
    const g = await new GLTFLoader().loadAsync(`${baseUrl}assets/models/outfits/outfits.glb`);
    g.scene.updateMatrixWorld(true);
    return new OutfitKit(g.scene);
  }

  /** Dresses `model` (its bones found by name) and returns the new materials so flashes and tints reach them. */
  dress(model: THREE.Object3D, look: OutfitLook, skin: string, rim: string, rimStrength: number): FigureMat[] {
    const bones = new Map<string, THREE.Bone>();
    model.traverse((o) => { if ((o as THREE.Bone).isBone) bones.set(o.name, o as THREE.Bone); });
    // the mannequin is bulkier than the clothes: everything they cover goes, or it shows through
    model.traverse((o) => {
      const sm = o as THREE.SkinnedMesh;
      if (sm.isSkinnedMesh) sm.geometry = bareParts(sm.geometry, sm.skeleton.bones.map((b) => b.name));
    });
    const mats = new Map<THREE.Material, FigureMat>();
    const parts: THREE.SkinnedMesh[] = [];
    this.scene.traverse((o) => {
      const sm = o as THREE.SkinnedMesh;
      if (!sm.isSkinnedMesh) return;
      // a part with two materials loads as a group of meshes: the group carries the part's name
      const named = sm.name.startsWith('Male_') ? sm : sm.parent;
      if (named && wearsPart(named.name, look)) parts.push(sm);
    });
    for (const sm of parts) {
      const src = sm.material as THREE.MeshStandardMaterial;
      let mat = mats.get(src);
      if (!mat) { mat = isSkin(src) ? toonMat(skin, rim, rimStrength) : toonMat(look.tint, rim, rimStrength, src.map ?? undefined); mats.set(src, mat); }
      const worn = new THREE.SkinnedMesh(sm.geometry, mat);
      // the second outfit's rig loads with suffixed names (spine_01_1): match them to the mannequin's plain ones
      const own = sm.skeleton.bones.map((b) => bones.get(b.name) ?? bones.get(b.name.replace(/_\d+$/, '')));
      if (own.some((b) => !b)) continue;
      worn.bind(new THREE.Skeleton(own as THREE.Bone[], sm.skeleton.boneInverses), sm.bindMatrix);
      worn.castShadow = true;
      worn.frustumCulled = false;
      model.add(worn);
    }
    return [...mats.values()];
  }
}

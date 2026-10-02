import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { WeaponLook } from './weaponMeshes';

/** Which pack model stands for each look, its length in metres, and where along it the hand grips. */
const MODEL: Partial<Record<WeaponLook, { name: string; length: number; grip: number; crosswise?: boolean }>> = {
  sword: { name: 'Sword', length: 0.85, grip: 0.1 },
  blade: { name: 'Sword_2', length: 0.6, grip: 0.1 },
  dagger: { name: 'Dagger', length: 0.36, grip: 0.18 },
  throwing: { name: 'Dagger_2', length: 0.3, grip: 0.18 },
  axe: { name: 'Axe', length: 0.8, grip: 0.08 },
  spear: { name: 'Spear', length: 1.6, grip: 0.3 },
  mace: { name: 'Hammer_Small', length: 0.7, grip: 0.08 },
  bow: { name: 'Bow_Wooden', length: 0.95, grip: 0.5, crosswise: true },
};

/** The Quaternius weapon pack: pack models for the weapon looks it covers (the rest stay block-built). */
export class WeaponKit {
  private constructor(private readonly src: Map<string, THREE.Object3D>) {}

  static async load(baseUrl: string): Promise<WeaponKit> {
    const g = await new GLTFLoader().loadAsync(`${baseUrl}assets/models/qpack/weapons.glb`);
    const map = new Map<string, THREE.Object3D>();
    for (const o of g.scene.children) map.set(o.name, o);
    return new WeaponKit(map);
  }

  /** A held copy (blade/shaft along +y from the grip), or null when the pack has no model for it. */
  make(kind: WeaponLook): THREE.Object3D | null {
    const m = MODEL[kind];
    const src = m && this.src.get(m.name);
    if (!m || !src) return null;
    const obj = src.clone(true);
    obj.position.set(0, 0, 0);
    obj.rotation.set(0, 0, 0);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const s = m.length / Math.max(0.001, size.y);
    obj.scale.setScalar(s);
    obj.position.set(-(box.min.x + size.x / 2) * s, -(box.min.y + size.y * m.grip) * s, -(box.min.z + size.z / 2) * s);
    obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
    const holder = new THREE.Group();
    holder.add(obj);
    if (!m.crosswise) holder.rotation.x = Math.PI / 2;
    return holder;
  }
}

let kit: WeaponKit | null = null;
/** Set once the pack has loaded; weapon looks use it from then on. */
export const setWeaponKit = (k: WeaponKit | null): void => { kit = k; };
export const weaponKit = (): WeaponKit | null => kit;

import * as THREE from 'three';
import type { WeaponGroup } from '../../sim/grid/items';
import { weaponKit } from './weaponKit';

/** What a figure can hold: the hero's weapon groups plus the skeletons' short blade. */
export type WeaponLook = WeaponGroup | 'pistol' | 'bow' | 'crossbow' | 'blade' | 'none';

const box = (w: number, h: number, d: number, mat: THREE.Material, y = 0, z = 0): THREE.Mesh => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(0, y, z);
  return m;
};

/** Block-built weapons, held along the hand bone (+y up the blade/shaft). */
export function weaponMesh(kind: WeaponLook): THREE.Object3D {
  if (kind === 'none') return new THREE.Group();
  const packed = weaponKit()?.make(kind);
  if (packed) return packed;
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#c8ccd4', metalness: 0.6, roughness: 0.35 });
  const gunmetal = new THREE.MeshStandardMaterial({ color: '#303b48', metalness: 0.8, roughness: 0.4 });
  const wood = new THREE.MeshStandardMaterial({ color: '#6a4a2a', roughness: 0.8 });
  switch (kind) {
    case 'sword': g.add(box(0.04, 0.75, 0.09, metal, 0.43), box(0.05, 0.14, 0.05, wood), box(0.05, 0.03, 0.22, metal, 0.08)); break;
    case 'blade': g.add(box(0.04, 0.5, 0.09, metal, 0.31), box(0.05, 0.14, 0.05, wood), box(0.05, 0.03, 0.18, metal, 0.08)); break;
    case 'dagger': g.add(box(0.03, 0.3, 0.07, metal, 0.2), box(0.04, 0.1, 0.04, wood), box(0.04, 0.02, 0.14, metal, 0.05)); break;
    case 'axe': g.add(box(0.05, 0.75, 0.05, wood, 0.3), box(0.05, 0.22, 0.24, metal, 0.6, 0.1)); break;
    case 'spear': g.add(box(0.04, 1.5, 0.04, wood, 0.45), box(0.05, 0.22, 0.08, metal, 1.3)); break;
    case 'mace': g.add(box(0.05, 0.55, 0.05, wood, 0.22), box(0.18, 0.18, 0.18, metal, 0.55)); break;
    case 'bow': g.add(box(0.04, 0.9, 0.04, wood, 0, 0.12), box(0.01, 0.88, 0.01, metal, 0, 0.02)); break;
    case 'crossbow': {
      const stock = box(0.05, 0.05, 0.42, wood, 0, 0.12);
      g.add(stock, box(0.4, 0.03, 0.04, metal, 0, 0.3));
      break;
    }
    case 'pistol': {
      const length = 0.3;
      g.add(box(0.09, 0.1, length, gunmetal, 0.06, length / 2 - 0.06), box(0.075, 0.19, 0.1, gunmetal, -0.06));
      break;
    }
  }
  // bows and crossbows are held crosswise; blades and shafts point forward
  if (!['bow', 'crossbow', 'pistol'].includes(kind)) g.rotation.x = Math.PI / 2;
  return g;
}

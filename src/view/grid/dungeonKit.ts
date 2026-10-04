import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type DungeonPiece =
  | 'Wall_Modular' | 'Floor_Modular' | 'Column' | 'Column2' | 'Arch_Door' | 'Barrel' | 'Chest' | 'Chest_Gold' | 'Torch' | 'Banner_wall'
  | 'Cobweb' | 'Cobweb2' | 'Skull' | 'Crate' | 'Stairs_Modular' | 'Trapdoor' | 'Trap_spikes' | 'Vase' | 'Bucket' | 'Brick' | 'Bag_Coins' | 'Sword_WallMount' | 'Coin_Pile';

/** One pack piece, re-centred: footprint centred on the origin, resting on y = 0. */
export interface Piece { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; size: THREE.Vector3 }

/** The Quaternius modular dungeon pack (walls, floors, columns, doors, props). */
export class DungeonKit {
  private readonly pieces = new Map<string, Piece>();

  private constructor(scene: THREE.Group) {
    scene.updateMatrixWorld(true);
    for (const o of scene.children) {
      // a piece with several materials loads as several meshes: merge them, one group per material
      const parts: THREE.Mesh[] = [];
      o.traverse((c) => { if ((c as THREE.Mesh).isMesh) parts.push(c as THREE.Mesh); });
      if (!parts.length) continue;
      const geos = parts.map((m) => {
        const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position!.count * 2), 2));
        return g.index ? g.toNonIndexed() : g;
      });
      const geometry = geos.length === 1 ? geos[0]! : mergeGeometries(geos, true);
      if (!geometry) continue;
      const material = parts.length === 1 ? parts[0]!.material : parts.map((m) => m.material as THREE.Material);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      const c = box.getCenter(new THREE.Vector3());
      geometry.translate(-c.x, -box.min.y, -c.z);
      this.pieces.set(o.name, { geometry, material, size: box.getSize(new THREE.Vector3()) });
    }
  }

  static async load(baseUrl: string): Promise<DungeonKit> {
    const g = await new GLTFLoader().loadAsync(`${baseUrl}assets/models/qpack/dungeon.glb`);
    return new DungeonKit(g.scene);
  }

  /** Tints every pack material (the stone of a zone); the pack's own colours are kept to tint from. */
  tint(color: string): void {
    const c = new THREE.Color(color);
    for (const p of this.pieces.values()) for (const m of [p.material].flat() as THREE.MeshStandardMaterial[]) {
      if (!m.color) continue;
      const base = (m.userData.base ??= m.color.clone()) as THREE.Color;
      m.color.copy(base).multiply(c);
    }
  }

  piece(name: DungeonPiece): Piece | undefined {
    return this.pieces.get(name);
  }

  /** A standalone copy scaled to a footprint width (or height), resting on the floor. */
  clone(name: DungeonPiece, fit: { width?: number; height?: number }): THREE.Object3D {
    const p = this.pieces.get(name);
    if (!p) return new THREE.Group();
    const mesh = new THREE.Mesh(p.geometry, p.material);
    const s = fit.width ? fit.width / Math.max(0.01, Math.max(p.size.x, p.size.z)) : (fit.height ?? 1) / Math.max(0.01, p.size.y);
    mesh.scale.setScalar(s);
    mesh.castShadow = mesh.receiveShadow = true;
    const holder = new THREE.Group();
    holder.add(mesh);
    return holder;
  }
}

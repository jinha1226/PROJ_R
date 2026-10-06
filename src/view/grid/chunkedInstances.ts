import * as THREE from 'three';

/** Cells per side of one chunk: a phone screen shows a few chunks of a 64-cell floor, the rest is skipped. */
export const CHUNK = 8;

/**
 * Many copies of one piece split into square chunks of the map, each its own InstancedMesh, so the camera culls the chunks
 * off screen (one InstancedMesh over a whole floor is drawn in full every frame). Addressed by the same global index as one mesh.
 */
export class ChunkedInstances extends THREE.Group {
  readonly meshes: THREE.InstancedMesh[] = [];
  private readonly where: [number, number][] = [];
  private readonly dirtyM = new Set<number>();
  private readonly dirtyC = new Set<number>();
  /** instances not drawn black (seen at least dimly), per chunk: a chunk with none is skipped */
  private readonly lit: Set<number>[] = [];

  /** `at` gives each instance's grid cell (x, y). */
  constructor(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], at: { x: number; y: number }[], opts: { cast?: boolean; receive?: boolean } = {}) {
    super();
    const keys = new Map<string, number[]>();
    at.forEach((c, k) => {
      const key = `${Math.floor(c.x / CHUNK)},${Math.floor(c.y / CHUNK)}`;
      keys.set(key, [...(keys.get(key) ?? []), k]);
    });
    for (const list of keys.values()) {
      const mesh = new THREE.InstancedMesh(geometry, material, list.length);
      mesh.castShadow = !!opts.cast;
      mesh.receiveShadow = !!opts.receive;
      list.forEach((k, local) => { this.where[k] = [this.meshes.length, local]; });
      this.meshes.push(mesh);
      this.lit.push(new Set(list.map((_, i) => i)));
      this.add(mesh);
    }
  }

  get total(): number { return this.where.length; }

  setMatrixAt(k: number, m: THREE.Matrix4): void {
    const [c, i] = this.where[k]!;
    this.meshes[c]!.setMatrixAt(i, m);
    this.dirtyM.add(c);
  }

  setColorAt(k: number, color: THREE.Color): void {
    const [c, i] = this.where[k]!;
    this.meshes[c]!.setColorAt(i, color);
    if (color.r + color.g + color.b > 0) this.lit[c]!.add(i); else this.lit[c]!.delete(i);
    this.dirtyC.add(c);
  }

  /** Uploads what changed; bounds follow the matrices so culling stays right. */
  commit(): void {
    for (const c of this.dirtyM) { const m = this.meshes[c]!; m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); m.computeBoundingBox(); }
    for (const c of this.dirtyC) { const m = this.meshes[c]!; m.instanceColor!.needsUpdate = true; m.visible = this.lit[c]!.size > 0; }
    this.dirtyM.clear();
    this.dirtyC.clear();
  }

  override dispose(): void {
    for (const m of this.meshes) m.dispose();
  }
}

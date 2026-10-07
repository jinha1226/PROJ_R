import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const LIFE = 0.3;
const EVERY = 0.04;
/** a copy is only left once the figure has moved this far from the last one (a figure standing still leaves none) */
const STEP = 0.35;
const OPACITY = 0.42;

interface Ghost { obj: THREE.Object3D; mat: THREE.MeshBasicMaterial; age: number }

/**
 * Afterimages: frozen, glowing copies of a figure's current pose that fade where it stood.
 * A trail drops one every few hundredths of a second while it runs (engraving moments, dashes).
 */
export class Afterimages {
  readonly root = new THREE.Group();
  private readonly ghosts: Ghost[] = [];
  private trail: { source: () => THREE.Object3D | undefined; left: number; next: number; color: string; last?: THREE.Vector3 } | null = null;

  /** One copy of the figure as it is now. Rings, bars and outline hulls are left out. */
  spawn(source: THREE.Object3D, color: string): void {
    const obj = cloneSkinned(source);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: OPACITY, blending: THREE.AdditiveBlending, depthWrite: false });
    const drop: THREE.Object3D[] = [];
    obj.traverse((o) => {
      if (o.userData.groundRing || o.userData.outline || (o as THREE.Sprite).isSprite) drop.push(o);
      else if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).material = mat; o.castShadow = false; o.receiveShadow = false; }
    });
    for (const o of drop) o.removeFromParent();
    obj.position.copy(source.getWorldPosition(new THREE.Vector3()));
    obj.quaternion.copy(source.getWorldQuaternion(new THREE.Quaternion()));
    this.root.add(obj);
    this.ghosts.push({ obj, mat, age: 0 });
  }

  /** Keep dropping copies of whatever `source` returns for `sec` seconds. */
  trailOf(source: () => THREE.Object3D | undefined, sec: number, color: string): void {
    if (this.trail) { this.trail.left = Math.max(this.trail.left, sec); return; }
    this.trail = { source, left: sec, next: 0, color };
  }

  /** `dt` in real seconds, so a trail stays dense while the game runs slow. */
  update(dt: number): void {
    if (this.trail) {
      this.trail.left -= dt;
      this.trail.next -= dt;
      if (this.trail.next <= 0) {
        const src = this.trail.source();
        const at = src?.getWorldPosition(new THREE.Vector3());
        if (src && at && (!this.trail.last || at.distanceTo(this.trail.last) >= STEP)) {
          // the first copy only marks where the move starts; copies appear once it is under way
          if (this.trail.last) this.spawn(src, this.trail.color);
          this.trail.last = at;
        }
        this.trail.next = EVERY;
      }
      if (this.trail.left <= 0) this.trail = null;
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i]!;
      g.age += dt;
      g.mat.opacity = OPACITY * Math.max(0, 1 - g.age / LIFE);
      if (g.age >= LIFE) { this.free(g); this.ghosts.splice(i, 1); }
    }
  }

  private free(g: Ghost): void {
    g.obj.removeFromParent();
    g.mat.dispose();
  }

  dispose(): void {
    for (const g of this.ghosts) this.free(g);
    this.ghosts.length = 0;
    this.trail = null;
    this.root.removeFromParent();
  }
}

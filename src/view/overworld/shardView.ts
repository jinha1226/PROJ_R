import * as THREE from 'three';
import type { WorldParty } from '../../sim/overworld/worldSim';

const MAX = 320;
/** how long a gathered shard takes to fly home, and how high over the core it lands */
const FLY = 0.38, HOME_Y = 1.5;

/**
 * The shards lying about the base (shards.ts): one small crystal per heap, bigger for a bigger heap, turning where it lies.
 * A heap that is gathered does not just vanish: its crystal flies to the core, so what was earned is seen coming in.
 */
export class ShardView {
  readonly root: THREE.InstancedMesh;
  private clock = 0;
  /** the heaps drawn last frame, by id (so a missing one is known to have been gathered) */
  private last = new Map<number, { x: number; y: number; s: number }>();
  private readonly flying: { x: number; y: number; s: number; t: number }[] = [];

  constructor() {
    // (a dark, saturated gold: the dot look's tone mapping washes a pale one out to white)
    this.root = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: '#c06a00' }), MAX);
    this.root.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.frustumCulled = false;
    this.root.count = 0;
  }

  update(p: WorldParty, dt: number): void {
    this.clock += dt;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const now = new Map<number, { x: number; y: number; s: number }>();
    let n = 0;
    for (const d of p.drops ?? []) {
      const s = 0.8 + Math.min(1.6, Math.log10(1 + d.n) * 0.7);
      now.set(d.id, { x: d.x, y: d.y, s });
      if (n >= MAX) continue;
      m.compose(v.set(d.x, 0.24 + Math.sin(this.clock * 3 + d.id) * 0.05, d.y), q.setFromAxisAngle(up, this.clock * 1.6 + d.id), sc.setScalar(s));
      this.root.setMatrixAt(n++, m);
    }
    for (const [id, k] of this.last) if (!now.has(id) && this.flying.length < 60) this.flying.push({ ...k, t: 0 });
    this.last = now;
    const hx = p.base.x + 0.5, hy = p.base.y + 0.5;
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i]!;
      f.t += dt / FLY;
      if (f.t >= 1) { this.flying.splice(i, 1); continue; }
      if (n >= MAX) continue;
      // a quick arc home, shrinking as it lands
      const e = f.t * f.t;
      m.compose(v.set(f.x + (hx - f.x) * e, 0.24 + (HOME_Y - 0.24) * f.t + Math.sin(f.t * Math.PI) * 0.9, f.y + (hy - f.y) * e), q.setFromAxisAngle(up, this.clock * 9), sc.setScalar(f.s * (1 - f.t * 0.6)));
      this.root.setMatrixAt(n++, m);
    }
    this.root.count = n;
    this.root.instanceMatrix.needsUpdate = true;
  }
}

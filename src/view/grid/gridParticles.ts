import * as THREE from 'three';

const DEBRIS = 96;
const SPARKS = 160;
const DROPS = 120;
const GRAVITY = 9;

interface Bit { alive: boolean; p: THREE.Vector3; v: THREE.Vector3; life: number; spin: number }

/** Bone chips that bounce, blood that sprays and spatters, sparks that fly. */
export class GridParticles {
  readonly root = new THREE.Group();
  private readonly chips: THREE.InstancedMesh;
  private readonly bits: Bit[] = [];
  private readonly sparkGeo = new THREE.BufferGeometry();
  private readonly sparks: { p: THREE.Vector3; v: THREE.Vector3; life: number; total: number; c: THREE.Color }[] = [];
  private readonly drops: THREE.InstancedMesh;
  private readonly blobs: Bit[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();

  constructor() {
    this.chips = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.04, 0.12), new THREE.MeshStandardMaterial({ color: '#e8e2d0', roughness: 0.7 }), DEBRIS);
    this.chips.count = 0;
    this.chips.frustumCulled = false;
    for (let i = 0; i < DEBRIS; i++) this.bits.push({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, spin: 0 });
    this.sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(SPARKS * 3), 3));
    this.sparkGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(SPARKS * 3), 3));
    const spark = new THREE.Points(this.sparkGeo, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    spark.frustumCulled = false;
    this.drops = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: '#9a0d0d' }), DROPS);
    this.drops.count = 0;
    this.drops.frustumCulled = false;
    for (let i = 0; i < DROPS; i++) this.blobs.push({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, spin: 0 });
    this.root.add(this.chips, spark, this.drops);
  }

  /** Bone chips bursting from a hit skeleton (more when it falls apart). */
  bones(at: THREE.Vector3, n: number, from?: THREE.Vector3): void {
    const away = from ? at.clone().sub(from).setY(0).normalize() : new THREE.Vector3();
    for (let k = 0; k < n; k++) {
      const b = this.bits.find((x) => !x.alive);
      if (!b) return;
      b.alive = true;
      b.life = 1.4 + Math.random() * 0.6;
      b.p.set(at.x, 0.9 + Math.random() * 0.4, at.z);
      b.v.set((Math.random() - 0.5) * 3 + away.x * 2.5, 2 + Math.random() * 2.5, (Math.random() - 0.5) * 3 + away.z * 2.5);
      b.spin = (Math.random() - 0.5) * 20;
    }
  }

  /** A spray of sparks (hit flash). */
  spray(at: THREE.Vector3, color: string, n = 10): void {
    const c = new THREE.Color(color);
    for (let k = 0; k < n && this.sparks.length < SPARKS; k++) {
      const total = 0.25 + Math.random() * 0.2;
      this.sparks.push({ p: new THREE.Vector3(at.x, 1.0, at.z), v: new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6), life: total, total, c });
    }
  }

  /** Blood sprayed away from the blow; drops spatter flat on the floor and fade. */
  blood(at: THREE.Vector3, n: number, from?: THREE.Vector3): void {
    const away = from ? at.clone().sub(from).setY(0).normalize() : new THREE.Vector3();
    for (let k = 0; k < n; k++) {
      const b = this.blobs.find((x) => !x.alive);
      if (!b) return;
      b.alive = true;
      b.life = 1.6 + Math.random() * 0.8;
      b.p.set(at.x, 0.8 + Math.random() * 0.5, at.z);
      b.v.set((Math.random() - 0.5) * 2.4 + away.x * 3, 1 + Math.random() * 2.2, (Math.random() - 0.5) * 2.4 + away.z * 3);
      b.spin = 0.6 + Math.random() * 0.9;
    }
  }

  update(dt: number, focus: THREE.Vector3): void {
    let n = 0;
    for (const b of this.bits) {
      if (!b.alive) continue;
      b.life -= dt;
      b.v.y -= GRAVITY * dt;
      b.p.addScaledVector(b.v, dt);
      if (b.p.y < 0.02) { b.p.y = 0.02; b.v.y *= -0.35; b.v.x *= 0.6; b.v.z *= 0.6; b.spin *= 0.6; }
      if (b.life <= 0) { b.alive = false; continue; }
      this.q.setFromEuler(new THREE.Euler(b.life * b.spin, b.life * b.spin * 0.7, 0));
      const s = Math.min(1, b.life * 2);
      this.chips.setMatrixAt(n++, this.m.compose(b.p, this.q, new THREE.Vector3(s, s, s)));
    }
    this.chips.count = n;
    this.chips.instanceMatrix.needsUpdate = true;
    const pos = this.sparkGeo.getAttribute('position') as THREE.BufferAttribute;
    const col = this.sparkGeo.getAttribute('color') as THREE.BufferAttribute;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]!;
      s.life -= dt;
      s.v.y -= GRAVITY * 0.6 * dt;
      s.p.addScaledVector(s.v, dt);
      if (s.life <= 0) this.sparks.splice(i, 1);
    }
    this.sparks.forEach((s, i) => { pos.setXYZ(i, s.p.x, s.p.y, s.p.z); const k = s.life / s.total; col.setXYZ(i, s.c.r * k, s.c.g * k, s.c.b * k); });
    this.sparkGeo.setDrawRange(0, this.sparks.length);
    pos.needsUpdate = col.needsUpdate = true;
    let d = 0;
    for (const b of this.blobs) {
      if (!b.alive) continue;
      b.life -= dt;
      if (b.p.y > 0.015) { b.v.y -= GRAVITY * dt; b.p.addScaledVector(b.v, dt); }
      if (b.p.y <= 0.015) { b.p.y = 0.015; b.v.set(0, 0, 0); }
      if (b.life <= 0) { b.alive = false; continue; }
      // in the air a drop; on the floor a flat spatter that shrinks away
      const k = Math.min(1, b.life);
      const flat = b.p.y <= 0.015;
      this.drops.setMatrixAt(d++, this.m.compose(b.p, this.q.identity(), flat ? new THREE.Vector3(b.spin * 2.2 * k, 0.15, b.spin * 2.2 * k) : new THREE.Vector3(1, 1, 1)));
    }
    this.drops.count = d;
    this.drops.instanceMatrix.needsUpdate = true;
    void focus;
  }

  dispose(): void {
    this.chips.geometry.dispose();
    this.sparkGeo.dispose();
    this.drops.geometry.dispose();
  }
}

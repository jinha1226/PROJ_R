import * as THREE from 'three';
import { Vfx } from '../fx/vfx';

const DEBRIS = 96;
const SPARKS = 240;
const FLAMES = 600;
const DROPS = 120;
const GRAVITY = 9;

interface Bit { alive: boolean; p: THREE.Vector3; v: THREE.Vector3; life: number; spin: number }

let atlas: THREE.Texture | null = null;
/** the effect atlas, loaded once and shared by every runtime */
const fxAtlas = (): THREE.Texture => {
  if (!atlas) { atlas = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}assets/fx-atlas.png`); atlas.colorSpace = THREE.SRGBColorSpace; }
  return atlas;
};

/** Bone chips that bounce, blood that sprays and spatters, sparks that fly; the textured effects (hits, blasts, heals) ride along. */
export class GridParticles {
  readonly root = new THREE.Group();
  readonly vfx = new Vfx(fxAtlas());
  private readonly chips: THREE.InstancedMesh;
  private readonly bits: Bit[] = [];
  private readonly sparkGeo = new THREE.BufferGeometry();
  private readonly sparks: { p: THREE.Vector3; v: THREE.Vector3; life: number; total: number; c: THREE.Color }[] = [];
  /** flames on the burning: big bright points of their own (a spark's size is lost against a torch-lit floor) */
  private readonly flameGeo = new THREE.BufferGeometry();
  private readonly flames: { p: THREE.Vector3; v: THREE.Vector3; life: number; total: number }[] = [];
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
    this.flameGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(FLAMES * 3), 3));
    this.flameGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(FLAMES * 3), 3));
    const flame = new THREE.Points(this.flameGeo, new THREE.PointsMaterial({ size: 0.34, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    flame.frustumCulled = false;
    this.root.add(this.chips, spark, flame, this.drops, this.vfx.root);
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

  /** Flames licking up a burning body: tongues born over its height that rise, white-hot at first, then yellow, orange and red as they die. */
  embers(at: THREE.Vector3, n = 3): void {
    for (let k = 0; k < n && this.flames.length < FLAMES; k++) {
      const total = 0.4 + Math.random() * 0.35;
      this.flames.push({ p: new THREE.Vector3(at.x + (Math.random() - 0.5) * 0.55, 0.25 + Math.random() * 1.3, at.z + (Math.random() - 0.5) * 0.55),
        v: new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.6 + Math.random() * 1.6, (Math.random() - 0.5) * 0.6), life: total, total });
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
    this.vfx.update(dt);
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
    const fp = this.flameGeo.getAttribute('position') as THREE.BufferAttribute, fc = this.flameGeo.getAttribute('color') as THREE.BufferAttribute;
    for (let i = this.flames.length - 1; i >= 0; i--) {
      const f = this.flames[i]!;
      f.life -= dt; f.v.y += 1.2 * dt; f.p.addScaledVector(f.v, dt);
      if (f.life <= 0) this.flames.splice(i, 1);
    }
    this.flames.forEach((f, i) => {
      // white-hot, then yellow, then orange, then a red that fades out
      const k = f.life / f.total, c = k > 0.75 ? [1, 0.96, 0.75] : k > 0.45 ? [1, 0.8, 0.22] : k > 0.2 ? [1, 0.42, 0.08] : [0.8 * (k / 0.2), 0.12 * (k / 0.2), 0.02];
      fp.setXYZ(i, f.p.x, f.p.y, f.p.z); fc.setXYZ(i, c[0]!, c[1]!, c[2]!);
    });
    this.flameGeo.setDrawRange(0, this.flames.length);
    fp.needsUpdate = fc.needsUpdate = true;
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
    this.flameGeo.dispose();
    this.drops.geometry.dispose();
    this.vfx.dispose();
  }
}

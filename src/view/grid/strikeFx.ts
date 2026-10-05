import * as THREE from 'three';

interface Item { obj: THREE.Object3D; mat: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial; life: number; total: number; grow: number; fade: boolean }
interface Limb { obj: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3; landed: boolean }

const GRAVITY = 14;

/**
 * Strike shapes: slash arcs of several kinds, a dash streak, a full blade-storm ring, a red execution cut,
 * a landing shockwave, a piercing beam, and severed limbs that tumble to the floor and stay.
 */
export class StrikeFx {
  readonly root = new THREE.Group();
  private readonly items: Item[] = [];
  private readonly limbs: Limb[] = [];

  private add(obj: THREE.Mesh, life: number, grow = 0, fade = true): THREE.Mesh {
    this.root.add(obj);
    this.items.push({ obj, mat: obj.material as THREE.MeshBasicMaterial, life, total: life, grow, fade });
    return obj;
  }

  private glow(color: string, opacity = 0.9): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  }

  /** A flat arc at chest height facing `facing` (radians on the ground plane). */
  arc(x: number, z: number, facing: number, o: { inner?: number; outer?: number; spread?: number; color?: string; life?: number; tilt?: number } = {}): void {
    const spread = o.spread ?? 1.8;
    const m = this.add(new THREE.Mesh(new THREE.RingGeometry(o.inner ?? 0.85, o.outer ?? 1.1, 28, 1, -spread / 2, spread), this.glow(o.color ?? '#ffffff')), o.life ?? 0.18, 0.4);
    m.rotation.set(-Math.PI / 2 + (o.tilt ?? 0), 0, -facing);
    m.position.set(x, 1.0, z);
  }

  /** Two crossed heavy arcs (a finisher, a fury blow). */
  cross(x: number, z: number, facing: number, color = '#ffe08a'): void {
    this.arc(x, z, facing, { inner: 0.7, outer: 1.25, spread: 2.2, color, life: 0.26, tilt: 0.5 });
    this.arc(x, z, facing, { inner: 0.7, outer: 1.25, spread: 2.2, color, life: 0.26, tilt: -0.5 });
  }

  /** A long straight streak from where a dash began to where it struck. */
  streak(from: THREE.Vector3, to: THREE.Vector3, color = '#bfffe8'): void {
    const len = Math.max(0.6, from.distanceTo(to) + 0.6);
    const m = this.add(new THREE.Mesh(new THREE.PlaneGeometry(len, 0.16), this.glow(color)), 0.2);
    m.rotation.set(-Math.PI / 2, 0, -Math.atan2(to.z - from.z, to.x - from.x));
    m.position.set((from.x + to.x) / 2, 0.95, (from.z + to.z) / 2);
  }

  /** A whole ring round a point (the blade storm, a spin), widening as it fades. */
  ring(x: number, z: number, color = '#9ff5ff', radius = 1.2, y = 1.0): void {
    const m = this.add(new THREE.Mesh(new THREE.RingGeometry(radius * 0.8, radius, 40), this.glow(color)), 0.24, 1.6);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
  }

  /** A tall red vertical cut over a foe (an execution, a cull). */
  cut(x: number, z: number, facing: number, color = '#ff3a3a'): void {
    const m = this.add(new THREE.Mesh(new THREE.PlaneGeometry(0.12, 2.4), this.glow(color, 1)), 0.22);
    m.rotation.set(0, -facing + Math.PI / 2, 0.35);
    m.position.set(x, 1.1, z);
  }

  /** A ground shockwave (a leap landing). */
  shock(x: number, z: number, color = '#ffd9a0'): void {
    this.ring(x, z, color, 1.6, 0.05);
  }

  /** A thick beam through `to` and on past it (a piercing round). */
  beam(from: THREE.Vector3, to: THREE.Vector3, color = '#fff0b0', past = 2.5): void {
    const dir = to.clone().sub(from).setY(0);
    const len = dir.length() + past;
    dir.normalize();
    const end = from.clone().addScaledVector(dir, len);
    const m = this.add(new THREE.Mesh(new THREE.PlaneGeometry(len, 0.22), this.glow(color, 1)), 0.16);
    m.rotation.set(-Math.PI / 2, 0, -Math.atan2(dir.z, dir.x));
    m.position.set((from.x + end.x) / 2, 1.05, (from.z + end.z) / 2);
  }

  /** A severed part: a chunk in the body's colour that tumbles away from the blow and lies where it lands. */
  limb(at: THREE.Vector3, away: THREE.Vector3, color: THREE.Color, kind: 'head' | 'arm', size: number): void {
    const geo = kind === 'head' ? new THREE.IcosahedronGeometry(0.14 * size, 0) : new THREE.CapsuleGeometry(0.06 * size, 0.42 * size, 2, 5);
    const obj = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    obj.position.copy(at);
    obj.castShadow = true;
    this.root.add(obj);
    const dir = away.clone().setY(0).normalize();
    this.limbs.push({ obj, vel: new THREE.Vector3(dir.x * 3.2, 4.2, dir.z * 3.2), spin: new THREE.Vector3(9, 4, 7), landed: false });
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]!;
      it.life -= dt;
      if (it.fade) it.mat.opacity = Math.max(0, it.life / it.total);
      it.obj.scale.multiplyScalar(1 + it.grow * dt);
      if (it.life <= 0) { it.obj.removeFromParent(); (it.obj as THREE.Mesh).geometry.dispose(); it.mat.dispose(); this.items.splice(i, 1); }
    }
    for (const l of this.limbs) {
      if (l.landed) continue;
      l.vel.y -= GRAVITY * dt;
      l.obj.position.addScaledVector(l.vel, dt);
      l.obj.rotation.x += l.spin.x * dt; l.obj.rotation.y += l.spin.y * dt; l.obj.rotation.z += l.spin.z * dt;
      if (l.obj.position.y <= 0.08) { l.obj.position.y = 0.08; l.landed = true; }
    }
  }

  dispose(): void {
    while (this.items.length) this.update(1e6);
    for (const l of this.limbs) { l.obj.removeFromParent(); l.obj.geometry.dispose(); (l.obj.material as THREE.Material).dispose(); }
    this.limbs.length = 0;
    this.root.removeFromParent();
  }
}

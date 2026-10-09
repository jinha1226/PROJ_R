import * as THREE from 'three';

/**
 * The energy dome over the base: a faint shell of light and a bright ring where it meets the ground. Its colour tells its
 * strength (cool blue whole, hot orange nearly gone); it flares where it is struck; when it gives, a ring of light races
 * outward (the wave that throws the horde back) and the dome is gone until it relights.
 */
export class DomeView {
  readonly root = new THREE.Group();
  private readonly shell: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly burst: THREE.Mesh;
  // dark, saturated sources: the dot look's tone mapping lifts them, and a pale one comes out white
  private readonly whole = new THREE.Color('#0a58d8');
  private readonly spent = new THREE.Color('#d01020');
  private r = 0;
  /** how far the view has swung down to the base's side (0 from above → 1 side-on) */
  side = 0;
  private flare = 0;
  private lastHp = -1;
  /** seconds since the dome broke (the wave running outward), or -1 */
  private wave = -1;
  private wasUp = true;
  /** the gun's shots still showing: a bright streak each, gone in a moment */
  private readonly bolts: { mesh: THREE.Mesh; life: number }[] = [];

  constructor() {
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#0a58d8', transparent: true, opacity: 0.03, depthWrite: false, side: THREE.FrontSide }));
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.972, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#0a58d8', transparent: true, opacity: 0.9, depthWrite: false }));
    this.ring.position.y = 0.06;
    this.burst = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#bff2ff', transparent: true, opacity: 0, depthWrite: false }));
    this.burst.position.y = 0.1; this.burst.visible = false;
    this.shell.renderOrder = 6; this.ring.renderOrder = 6; this.burst.renderOrder = 7;
    this.root.add(this.shell, this.ring, this.burst);
  }

  /** The dome's gun fires: a streak from a point to a point on the ground (`from` the dome's own middle: it leaves the core's top). */
  bolt(from: { x: number; y: number }, to: { x: number; y: number }, first: boolean): void {
    const a = new THREE.Vector3(from.x, first ? 2.3 : 0.5, from.y), b = new THREE.Vector3(to.x, 0.5, to.y);
    const mesh = this.bolts.length < 12 ? new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 1), new THREE.MeshBasicMaterial({ color: '#00a8e8', transparent: true, depthWrite: false })) : this.bolts.shift()!.mesh;
    mesh.position.copy(a).add(b).multiplyScalar(0.5); mesh.scale.set(1, 1, a.distanceTo(b)); mesh.lookAt(b);
    (mesh.material as THREE.MeshBasicMaterial).opacity = 1; mesh.renderOrder = 8;
    this.streaks.add(mesh); this.bolts.push({ mesh, life: 0.16 });
  }
  /** the gun's streaks live in the scene, not under the dome's own root (they are told in the ground's places) */
  readonly streaks = new THREE.Group();
  private fade(dt: number): void {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const k = this.bolts[i]!;
      k.life -= dt; (k.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, k.life / 0.16);
      if (k.life <= 0) { this.streaks.remove(k.mesh); k.mesh.geometry.dispose(); (k.mesh.material as THREE.Material).dispose(); this.bolts.splice(i, 1); }
    }
  }

  /** `hp` of `max`; `up`: the dome stands. */
  sync(centre: { x: number; y: number }, r: number, hp: number, max: number, up: boolean, dt: number): void {
    this.root.position.set(centre.x - 0.5, 0, centre.y - 0.5);
    this.fade(dt);
    if (r !== this.r) { this.r = r; this.shell.scale.setScalar(r); this.ring.scale.set(r, 1, r); }
    const broke = this.wasUp && !up;
    this.wasUp = up;
    if (broke) { this.wave = 0; this.burst.visible = true; }
    if (this.wave >= 0) {
      this.wave += dt;
      const k = this.wave / 0.9, s = r * (1 + k * 3.2);
      this.burst.scale.set(s, 1, s);
      (this.burst.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.95 * (1 - k));
      if (k >= 1) { this.wave = -1; this.burst.visible = false; }
    }
    this.shell.visible = this.ring.visible = up;
    if (!up) { this.lastHp = -1; return; }
    // struck: a flare that dies away
    if (this.lastHp >= 0 && hp < this.lastHp - 0.01) this.flare = Math.min(1, this.flare + 0.35);
    this.lastHp = hp;
    this.flare = Math.max(0, this.flare - dt * 2.5);
    const c = this.spent.clone().lerp(this.whole, Math.max(0, Math.min(1, hp / max)));
    (this.ring.material as THREE.MeshBasicMaterial).color.copy(c);
    (this.shell.material as THREE.MeshBasicMaterial).color.copy(c);
    // (seen from the side the shell is the dome's whole outline: it is drawn stronger there)
    (this.shell.material as THREE.MeshBasicMaterial).opacity = 0.03 + this.side * 0.14 + this.flare * 0.1;
  }
}

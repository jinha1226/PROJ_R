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

  constructor() {
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#0a58d8', transparent: true, opacity: 0.03, depthWrite: false, side: THREE.FrontSide }));
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.972, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#0a58d8', transparent: true, opacity: 0.9, depthWrite: false }));
    this.ring.position.y = 0.06;
    this.burst = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#bff2ff', transparent: true, opacity: 0, depthWrite: false }));
    this.burst.position.y = 0.1; this.burst.visible = false;
    this.shell.renderOrder = 6; this.ring.renderOrder = 6; this.burst.renderOrder = 7;
    this.root.add(this.shell, this.ring, this.burst);
  }

  /** `hp` of `max`; `up`: the dome stands. */
  sync(centre: { x: number; y: number }, r: number, hp: number, max: number, up: boolean, dt: number): void {
    this.root.position.set(centre.x - 0.5, 0, centre.y - 0.5);
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

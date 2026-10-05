import * as THREE from 'three';

const HOLD = 1.1;
const PULL = 1.7;
const CLOSE = 0.38;
const smooth = (x: number): number => x * x * (3 - 2 * x);

/**
 * A clone waking on the ship: the camera starts close on the pod while it flashes, then pulls back to the deck.
 * Until the first sortie a beam stands over the hatch so the way out is plain.
 */
export class ShipIntro {
  readonly root = new THREE.Group();
  private t = -1;
  private readonly flash = new THREE.PointLight('#b8ffd0', 0, 6, 1.6);
  private readonly beam?: THREE.Mesh;
  private readonly ring?: THREE.Mesh;
  private clock = 0;

  constructor(readonly pod: THREE.Vector3 | undefined, hatch: THREE.Vector3 | undefined, beacon: boolean) {
    if (pod) { this.flash.position.set(pod.x, 1.6, pod.z); this.root.add(this.flash); }
    if (!hatch || !beacon) return;
    const glow = (opacity: number) => new THREE.MeshBasicMaterial({ color: '#5dff8a', transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.42, 3, 12, 1, true), glow(0.22));
    this.beam.position.set(hatch.x, 1.5, hatch.z);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 24).rotateX(-Math.PI / 2), glow(0.7));
    this.ring.position.set(hatch.x, 0.03, hatch.z);
    this.root.add(this.beam, this.ring);
  }

  get active(): boolean { return this.t >= 0; }

  start(): void { this.t = 0; }

  /** the first sortie is under way: the beam has done its job */
  dropBeacon(): void {
    for (const m of [this.beam, this.ring]) { if (m) { this.root.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); } }
  }

  /** How far the camera has pulled back from the pod (0 → 1) and the zoom factor; null when no intro is playing. */
  update(dt: number): { k: number; zoom: number } | null {
    this.clock += dt;
    if (this.beam && this.ring) {
      const pulse = 0.5 + 0.5 * Math.sin(this.clock * 3);
      (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.14 * pulse;
      this.ring.scale.setScalar(1 + 0.35 * ((this.clock * 0.8) % 1));
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - ((this.clock * 0.8) % 1));
    }
    if (this.t < 0) return null;
    this.t += dt;
    // the pod lights up, flickers, then settles
    const f = this.t < 0.25 ? this.t / 0.25 : Math.max(0, 1 - (this.t - 0.25) / 1.4);
    this.flash.intensity = 14 * f * (this.t < 0.7 && Math.floor(this.t * 20) % 3 === 0 ? 0.4 : 1);
    const k = smooth(Math.min(1, Math.max(0, (this.t - HOLD) / PULL)));
    if (this.t >= HOLD + PULL) { this.t = -1; this.flash.intensity = 0; return null; }
    return { k, zoom: CLOSE + (1 - CLOSE) * k };
  }

  skip(): void { if (this.t >= 0) this.t = HOLD + PULL; }

  dispose(): void {
    this.dropBeacon();
    this.root.removeFromParent();
  }
}

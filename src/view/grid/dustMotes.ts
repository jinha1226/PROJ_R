import * as THREE from 'three';

const COUNT = 36;
const SPREAD = 2.2;

/** Specks drifting in the air around the hero, tinted by the zone: they catch the light and give the dark some depth. */
export class DustMotes {
  readonly points: THREE.Points;
  private readonly pos: Float32Array;
  private readonly seed: Float32Array;
  private readonly center = new THREE.Vector3();
  private t = 0;

  constructor(color: string) {
    this.pos = new Float32Array(COUNT * 3);
    this.seed = new Float32Array(COUNT * 3);
    // a fixed scatter (no Math.random in the view either: the same floor looks the same)
    for (let i = 0; i < COUNT * 3; i++) this.seed[i] = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.045, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.points.frustumCulled = false;
  }

  follow(at: THREE.Vector3): void {
    this.center.copy(at);
  }

  update(dt: number): void {
    this.t += dt;
    for (let i = 0; i < COUNT; i++) {
      const a = this.seed[i * 3]!, b = this.seed[i * 3 + 1]!, c = this.seed[i * 3 + 2]!;
      // each speck rises slowly and sways, wrapping inside a box around the hero
      const y = ((c * 2.4 + this.t * (0.05 + a * 0.08)) % 2.4) + 0.1;
      this.pos[i * 3] = this.center.x + (a - 0.5) * SPREAD * 2 + Math.sin(this.t * 0.4 + b * 6) * 0.3;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = this.center.z + (b - 0.5) * SPREAD * 2 + Math.cos(this.t * 0.3 + a * 6) * 0.3;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

import * as THREE from 'three';

/** how long a whirlwind's sweep lasts (seconds) and how many times the blade goes round in it */
const SWEEP_SEC = 0.5;
const TURNS = 2;

interface Sweep { group: THREE.Group; blade: THREE.Mesh; wake: THREE.Mesh; ring: THREE.Mesh; life: number }

const glow = (color: string, opacity: number) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });

/**
 * A whirlwind's sweep: a bright blade arc that spins round the warrior twice while it grows out to its reach,
 * a fainter wake trailing it, and a thin ring that rushes out to the edge as it ends.
 */
export class SweepFx {
  private readonly sweeps: Sweep[] = [];
  constructor(private readonly scene: THREE.Scene) {}

  play(at: THREE.Vector3, reach: number): void {
    const group = new THREE.Group();
    group.position.set(at.x, 0.55, at.z);
    const flat = (m: THREE.Mesh) => { m.rotation.x = -Math.PI / 2; return m; };
    const blade = flat(new THREE.Mesh(new THREE.RingGeometry(reach * 0.62, reach, 48, 1, 0, Math.PI * 0.45), glow('#f4fbff', 0.95)));
    const wake = flat(new THREE.Mesh(new THREE.RingGeometry(reach * 0.5, reach * 0.98, 48, 1, -Math.PI * 0.9, Math.PI * 0.9), glow('#8fd8ff', 0.35)));
    const ring = flat(new THREE.Mesh(new THREE.RingGeometry(reach * 0.96, reach, 72), glow('#cfeeff', 0.0)));
    ring.position.y = -0.5;
    group.add(blade, wake, ring);
    group.scale.setScalar(0.3);
    this.scene.add(group);
    this.sweeps.push({ group, blade, wake, ring, life: SWEEP_SEC });
  }

  update(dt: number): void {
    for (let i = this.sweeps.length - 1; i >= 0; i--) {
      const s = this.sweeps[i]!;
      s.life -= dt;
      const k = 1 - Math.max(0, s.life) / SWEEP_SEC;
      s.group.rotation.y = -k * Math.PI * 2 * TURNS;
      s.group.scale.setScalar(0.3 + 0.7 * Math.min(1, k / 0.55));
      const fade = k < 0.7 ? 1 : Math.max(0, (1 - k) / 0.3);
      (s.blade.material as THREE.MeshBasicMaterial).opacity = 0.95 * fade;
      (s.wake.material as THREE.MeshBasicMaterial).opacity = 0.35 * fade;
      // the edge ring flares as the blade reaches its full reach, then fades out
      (s.ring.material as THREE.MeshBasicMaterial).opacity = k < 0.5 ? 0 : 0.7 * Math.max(0, 1 - (k - 0.5) / 0.5);
      if (s.life <= 0) {
        this.scene.remove(s.group);
        for (const m of [s.blade, s.wake, s.ring]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
        this.sweeps.splice(i, 1);
      }
    }
  }

  dispose(): void { for (const s of this.sweeps) this.scene.remove(s.group); this.sweeps.length = 0; }
}

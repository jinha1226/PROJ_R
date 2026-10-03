import * as THREE from 'three';

interface Flash { light: THREE.PointLight; left: number; total: number; power: number }

/** A few pooled point lights for brief flashes (muzzle fire, blasts, spells) that light up the dark around them. */
export class FlashLights {
  private readonly pool: Flash[] = [];

  constructor(scene: THREE.Scene, count: number) {
    for (let i = 0; i < count; i++) {
      const light = new THREE.PointLight('#ffffff', 0, 7, 1.6);
      scene.add(light);
      this.pool.push({ light, left: 0, total: 1, power: 0 });
    }
  }

  /** Lights up `at` for `sec` (the weakest current flash gives up its light when all are busy). */
  flash(at: THREE.Vector3, color: string, power = 18, sec = 0.18, range = 7): void {
    const f = this.pool.reduce((a, b) => (a.left * a.power <= b.left * b.power ? a : b), this.pool[0]!);
    if (!f) return;
    f.light.color.set(color);
    f.light.distance = range;
    f.light.position.set(at.x, 1.2, at.z);
    f.left = f.total = sec;
    f.power = power;
  }

  update(dt: number): void {
    for (const f of this.pool) {
      if (f.left <= 0) { f.light.intensity = 0; continue; }
      f.left = Math.max(0, f.left - dt);
      f.light.intensity = f.power * (f.left / f.total);
    }
  }

  dispose(): void {
    for (const f of this.pool) f.light.parent?.remove(f.light);
  }
}

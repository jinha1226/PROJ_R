import * as THREE from 'three';
import type { Cell } from '../../sim/grid/types';

/** a place on the land that gives light while `on()` holds */
export interface LightSpot { at: Cell; y: number; color: string; power: number; range: number; flicker: number; on: () => boolean }

const POOL = 12;

/**
 * The land has dozens of lights (fires, totems, souls, wrecks…) but only a few real ones are lit at a time: the ones nearest the view
 * that the party has seen. A fixed pool keeps the shaders from rebuilding as lights come and go.
 */
export class WorldLights {
  readonly root = new THREE.Group();
  private readonly lights: THREE.PointLight[] = [];
  private readonly spots: LightSpot[] = [];
  private clock = 0;

  constructor() {
    for (let i = 0; i < POOL; i++) {
      const l = new THREE.PointLight('#ffffff', 0, 6, 1.7);
      this.lights.push(l);
      this.root.add(l);
    }
  }

  add(spot: LightSpot): void { this.spots.push(spot); }

  update(dt: number, center: THREE.Vector3, seen: (c: Cell) => boolean): void {
    this.clock += dt;
    const near = this.spots
      .filter((s) => s.on() && seen(s.at))
      .map((s) => ({ s, d: Math.hypot(s.at.x - center.x, s.at.y - center.z) }))
      .filter((x) => x.d < 26)
      .sort((a, b) => a.d - b.d);
    this.lights.forEach((l, i) => {
      const it = near[i];
      if (!it) { l.intensity = 0; return; }
      const s = it.s, k = s.at.x * 1.7 + s.at.y * 2.3;
      const flick = 1 + s.flicker * (Math.sin(this.clock * 13 + k) * 0.6 + Math.sin(this.clock * 7.1 + k * 0.5) * 0.4);
      l.color.set(s.color);
      l.distance = s.range;
      l.intensity = s.power * flick;
      l.position.set(s.at.x, s.y, s.at.y);
    });
  }
}

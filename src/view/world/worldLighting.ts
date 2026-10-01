import * as THREE from 'three';
import type { Phase } from '../../sim/world/clock';

const LOOK: Record<Phase, { sky: string; sun: string; sunI: number; hemi: number }> = {
  day: { sky: '#7a8f6a', sun: '#ffe8c0', sunI: 2.6, hemi: 1.4 },
  dusk: { sky: '#8a6a58', sun: '#ffb070', sunI: 1.9, hemi: 1.1 },
  night: { sky: '#232a3c', sun: '#9fb4ff', sunI: 0.8, hemi: 0.6 },
  storm: { sky: '#3a2440', sun: '#d090ff', sunI: 0.9, hemi: 0.55 },
};

/** Sun and sky that follow the hero (so shadows stay sharp nearby) and shift with the risk clock. */
export class WorldLighting {
  private readonly sun = new THREE.DirectionalLight('#ffe8c0', 2.6);
  private readonly hemi = new THREE.HemisphereLight('#fff6e6', '#4a4038', 1.4);

  constructor(private readonly scene: THREE.Scene, shadows: boolean) {
    this.sun.castShadow = shadows;
    this.sun.shadow.mapSize.set(2048, 2048);
    const c = this.sun.shadow.camera;
    c.left = -22; c.right = 22; c.top = 22; c.bottom = -22; c.near = 1; c.far = 60;
    this.sun.shadow.bias = -0.0005;
    scene.add(this.hemi, this.sun, this.sun.target);
    scene.fog = null;
  }

  update(x: number, z: number, phase: Phase): void {
    const l = LOOK[phase];
    this.sun.position.set(x - 8, 16, z + 6);
    this.sun.target.position.set(x, 0, z);
    this.sun.color.set(l.sun);
    this.sun.intensity = l.sunI;
    this.hemi.intensity = l.hemi;
    (this.scene.background as THREE.Color | null)?.set(l.sky);
  }
}

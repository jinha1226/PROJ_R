import * as THREE from 'three';

/** Translucent bubble around units that currently hold a shield. */
export class ShieldFx {
  private readonly bubbles = new Map<string, THREE.Mesh>();
  private readonly geo = new THREE.SphereGeometry(0.85, 20, 14);
  private readonly mat = new THREE.MeshBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.22, depthWrite: false });

  constructor(private readonly scene: THREE.Scene) {}

  set(id: string, on: boolean, x: number, z: number, scale = 1): void {
    let b = this.bubbles.get(id);
    if (on && !b) {
      b = new THREE.Mesh(this.geo, this.mat);
      this.scene.add(b);
      this.bubbles.set(id, b);
    }
    if (!b) return;
    b.visible = on;
    b.position.set(x, 0.85 * scale, z);
    b.scale.setScalar(scale);
  }

  dispose(): void {
    for (const b of this.bubbles.values()) this.scene.remove(b);
    this.bubbles.clear();
    this.geo.dispose();
    this.mat.dispose();
  }
}

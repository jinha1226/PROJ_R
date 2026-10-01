import * as THREE from 'three';

interface Transient {
  mesh: THREE.Mesh;
  life: number;
  total: number;
  grow: number;
}

/** Short-lived ground/air effects: slash arcs, bursts, heal glows. */
export class TransientFx {
  private readonly items: Transient[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  slash(x: number, z: number, facing: number, color = '#ffffff'): void {
    const geo = new THREE.RingGeometry(0.7, 1.2, 24, 1, -0.9, 1.8);
    const m = this.add(geo, color, 0.25, 0.3, 0.8);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -facing;
    m.position.set(x, 1.0, z);
  }

  burst(x: number, z: number, color: string, radius = 0.6, life = 0.4): void {
    const m = this.add(new THREE.RingGeometry(radius * 0.7, radius, 32), color, life, 1.8, 0.9);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.08, z);
  }

  glow(x: number, z: number, color: string): void {
    const m = this.add(new THREE.CylinderGeometry(0.5, 0.5, 2.2, 16, 1, true), color, 0.6, 0.2, 0.45);
    m.position.set(x, 1.1, z);
  }

  private add(geo: THREE.BufferGeometry, color: string, life: number, grow: number, opacity: number): THREE.Mesh {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    this.scene.add(mesh);
    this.items.push({ mesh, life, total: life, grow });
    return mesh;
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]!;
      it.life -= dt;
      const k = Math.max(0, it.life / it.total);
      const mat = it.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.min(mat.opacity, k);
      it.mesh.scale.multiplyScalar(1 + it.grow * dt);
      if (it.life <= 0) {
        this.scene.remove(it.mesh);
        it.mesh.geometry.dispose();
        mat.dispose();
        this.items.splice(i, 1);
      }
    }
  }

  dispose(): void {
    while (this.items.length) this.update(1e6);
  }
}

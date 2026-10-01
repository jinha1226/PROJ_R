import * as THREE from 'three';
import type { Snapshot } from '../../sim/battle/types';

const LOOK: Record<string, { color: string; size: number }> = {
  bolt: { color: '#b48cff', size: 0.18 },
  arrow: { color: '#d8c8a0', size: 0.06 },
  fireball: { color: '#ff8a2a', size: 0.28 },
  holy: { color: '#fff6c8', size: 0.2 },
  dark: { color: '#7a3aa8', size: 0.2 },
};

export class ProjectileFx {
  private readonly meshes = new Map<number, THREE.Mesh>();

  constructor(private readonly scene: THREE.Scene) {}

  sync(prev: Snapshot, curr: Snapshot, alpha: number): void {
    const before = new Map(prev.projectiles.map((p) => [p.id, p]));
    const seen = new Set<number>();
    for (const p of curr.projectiles) {
      seen.add(p.id);
      let m = this.meshes.get(p.id);
      if (!m) m = this.create(p.id, p.visual);
      const b = before.get(p.id) ?? p;
      const x = b.x + (p.x - b.x) * alpha;
      const z = b.y + (p.y - b.y) * alpha;
      if (p.visual === 'arrow') m.rotation.y = -Math.atan2(p.y - b.y, p.x - b.x);
      m.position.set(x, 1.0, z);
    }
    for (const [id, m] of this.meshes) {
      if (seen.has(id)) continue;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      this.scene.remove(m);
      this.meshes.delete(id);
    }
  }

  private create(id: number, visual: string): THREE.Mesh {
    const look = LOOK[visual] ?? LOOK.bolt!;
    const geo = visual === 'arrow' ? new THREE.BoxGeometry(0.7, look.size, look.size) : new THREE.SphereGeometry(look.size, 12, 8);
    const mat = new THREE.MeshBasicMaterial({ color: look.color });
    const m = new THREE.Mesh(geo, mat);
    this.scene.add(m);
    this.meshes.set(id, m);
    return m;
  }

  dispose(): void {
    this.sync({ tick: 0, units: [], telegraphs: [], projectiles: [] }, { tick: 0, units: [], telegraphs: [], projectiles: [] }, 0);
  }
}

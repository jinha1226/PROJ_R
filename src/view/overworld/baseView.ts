import * as THREE from 'three';
import type { Building } from '../../sim/base/buildings';

/**
 * The base's barricades on the land: a low plated block with a warning strip — low enough to shoot over,
 * chunky enough to read at the dot look's size. A broken one lies flat until the raid is over.
 */
export class BaseView {
  readonly root = new THREE.Group();
  private readonly shown = new Map<string, THREE.Object3D>();
  private readonly plate = new THREE.MeshStandardMaterial({ color: '#566270', roughness: 0.7, metalness: 0.25 });
  private readonly dark = new THREE.MeshStandardMaterial({ color: '#2a323c', roughness: 0.8, metalness: 0.2 });
  private readonly strip = new THREE.MeshBasicMaterial({ color: '#ffb02a' });

  /** Builds and drops figures so the scene matches the base's barricades. */
  sync(buildings: Building[]): void {
    const live = new Set(buildings.map((b) => b.id));
    for (const [id, o] of this.shown) if (!live.has(id)) { this.root.remove(o); this.shown.delete(id); }
    for (const b of buildings) if (!this.shown.has(b.id)) { const o = this.make(); o.position.set(b.at.x, 0, b.at.y); this.root.add(o); this.shown.set(b.id, o); }
    for (const b of buildings) { const o = this.shown.get(b.id); if (o) o.scale.y = b.broken ? 0.25 : 1; }
  }

  /** One barricade, standing on its cell's middle. */
  make(): THREE.Object3D {
    const g = new THREE.Group();
    const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y + h / 2, z);
      mesh.castShadow = mesh.receiveShadow = true;
      g.add(mesh);
    };
    // a dark foot, a plated block, a warning strip round its top: nothing thin (thin parts vanish at the dot look's size)
    box(0.94, 0.12, 0.94, this.dark);
    box(0.82, 0.3, 0.82, this.plate, 0, 0.12);
    box(0.86, 0.08, 0.86, this.strip, 0, 0.42);
    box(0.74, 0.1, 0.74, this.plate, 0, 0.5);
    return g;
  }

  dispose(): void {
    this.root.clear();
    this.shown.clear();
  }
}

import * as THREE from 'three';
import type { Region } from '../../sim/extract/regionTypes';
import type { Pile } from '../../sim/world/types';
import type { EnvLibrary } from '../explore/envAssets';

/** Containers, extraction rings, poison mist and dropped piles. */
export class WorldMarkers {
  readonly root = new THREE.Group();
  private readonly chests = new Map<string, THREE.Object3D>();
  private readonly rings = new Map<string, THREE.Mesh>();
  private readonly piles = new Map<string, THREE.Object3D>();
  private t = 0;

  constructor(private readonly region: Region, private readonly lib: EnvLibrary) {
    for (const c of region.containers) {
      const ref = c.kind === 'herb' ? 'forest/bush' : c.kind === 'bag' ? 'dungeon/barrel' : 'dungeon/chest';
      const m = lib.clone(ref, { radius: c.kind === 'relic' || c.kind === 'vault' ? 0.7 : 0.5 });
      m.position.set(c.pos.x, 0, c.pos.y);
      this.chests.set(c.id, m);
      this.root.add(m);
    }
    for (const e of region.extracts) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(e.radius - 0.25, e.radius, 48), new THREE.MeshBasicMaterial({ color: '#5fe08a', transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(e.pos.x, 0.06, e.pos.y);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 8), new THREE.MeshBasicMaterial({ color: '#5fe08a', transparent: true, opacity: 0.35 }));
      beam.position.y = 3;
      ring.add(beam);
      this.rings.set(e.id, ring);
      this.root.add(ring);
    }
    for (const z of region.hazards) {
      const fog = new THREE.Mesh(new THREE.CircleGeometry(z.radius, 40), new THREE.MeshBasicMaterial({ color: '#7fb04a', transparent: true, opacity: 0.32, depthWrite: false }));
      fog.rotation.x = -Math.PI / 2;
      fog.position.set(z.center.x, 0.08, z.center.y);
      this.root.add(fog);
    }
  }

  update(dt: number, opened: Record<string, { opened: boolean; items: unknown[] }>, closed: string[], piles: Pile[]): void {
    this.t += dt;
    for (const [id, m] of this.chests) {
      const o = opened[id];
      if (o?.opened && !m.userData.dim) {
        m.userData.dim = true;
        m.traverse((x) => { const mesh = x as THREE.Mesh; if (mesh.isMesh) { const mat = (mesh.material as THREE.MeshStandardMaterial).clone(); mat.color.multiplyScalar(0.45); mesh.material = mat; } });
      }
      m.visible = !(o?.opened && o.items.length === 0 && this.region.containers.find((c) => c.id === id)?.kind === 'herb');
    }
    for (const [id, ring] of this.rings) {
      const shut = closed.includes(id);
      (ring.material as THREE.MeshBasicMaterial).color.set(shut ? '#d04a3a' : '#5fe08a');
      ring.scale.setScalar(shut ? 1 : 1 + Math.sin(this.t * 3) * 0.04);
    }
    const live = new Set(piles.filter((p) => p.items.length).map((p) => p.id));
    for (const [id, m] of this.piles) if (!live.has(id)) { this.root.remove(m); this.piles.delete(id); }
    for (const p of piles) {
      if (!live.has(p.id) || this.piles.has(p.id)) continue;
      const m = this.lib.clone('dungeon/crates', { radius: 0.3 });
      m.position.set(p.pos.x, 0, p.pos.y);
      this.piles.set(p.id, m);
      this.root.add(m);
    }
  }
}

import * as THREE from 'three';

// A frozen figure stands in a block of ice: a pale shell round it (see-through), jagged shards at its feet and shoulders.
const SHELL = new THREE.MeshBasicMaterial({ color: '#6ab8ff', transparent: true, opacity: 0.17, depthWrite: false });
const SHARD = new THREE.MeshBasicMaterial({ color: '#e4f6ff' });
const FROST = new THREE.MeshBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.35, depthWrite: false });
const SHELL_GEO = new THREE.CylinderGeometry(0.24, 0.36, 1.2, 6).translate(0, 0.6, 0);
const SHARD_GEO = new THREE.ConeGeometry(0.08, 0.4, 4).translate(0, 0.2, 0);
const FROST_GEO = new THREE.CircleGeometry(0.46, 10).rotateX(-Math.PI / 2).translate(0, 0.03, 0);
/** where each shard stands: angle round the figure, how far out, how tall, how far it leans out */
const SHARDS: [number, number, number, number][] = [[0.4, 0.34, 1.2, 0.35], [1.9, 0.38, 0.8, 0.5], [3.0, 0.32, 1.5, 0.25], [4.3, 0.38, 0.9, 0.55], [5.4, 0.34, 1.1, 0.4]];

function block(): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(FROST_GEO, FROST), new THREE.Mesh(SHELL_GEO, SHELL));
  for (const [a, r, tall, lean] of SHARDS) {
    const m = new THREE.Mesh(SHARD_GEO, SHARD);
    m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    m.scale.set(1, tall, 1);
    // leaning away from the figure
    m.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean);
    g.add(m);
  }
  return g;
}

/** The ice round every frozen figure: raised when it freezes, gone when it thaws, falls or leaves. */
export class IceBlocks {
  readonly root = new THREE.Group();
  private readonly blocks = new Map<string, THREE.Group>();

  set(id: string, on: boolean): void {
    const b = this.blocks.get(id);
    if (on && !b) { const g = block(); g.rotation.y = (id.length * 1.7 + id.charCodeAt(id.length - 1)) % 6.28; this.blocks.set(id, g); this.root.add(g); }
    else if (!on && b) { this.root.remove(b); this.blocks.delete(id); }
  }

  /** Each block stands where its figure does (`at`: its place, undefined while unseen, null once it is dead or gone). */
  place(at: (id: string) => { x: number; z: number } | null | undefined): void {
    for (const [id, b] of this.blocks) {
      const p = at(id);
      if (p === null) { this.set(id, false); continue; }
      b.visible = !!p;
      if (p) b.position.set(p.x, 0, p.z);
    }
  }
}

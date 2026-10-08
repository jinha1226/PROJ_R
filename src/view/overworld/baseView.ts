import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BUILDINGS, type Building, type BuildingKind } from '../../sim/base/buildings';
import { loadStone, stoneMat } from '../grid/stoneMats';

/** The models a building kind is drawn with (Quaternius Ultimate Space Kit): radar tower, geodesic dome, large base. */
const MODEL: Partial<Record<BuildingKind, string>> = { watchtower: 'tower', infirmary: 'dome', forge: 'works' };

/** The base's buildings on the land: pack models for towers and halls, stone blocks for walls, stakes for palisades, a lit gate. */
export class BaseView {
  readonly root = new THREE.Group();
  private readonly shown = new Map<string, THREE.Object3D>();
  private models = new Map<string, THREE.Object3D>();
  private readonly wall: THREE.Material;
  private readonly wood = new THREE.MeshStandardMaterial({ color: '#7a5230', roughness: 0.9 });
  private readonly glow = new THREE.MeshBasicMaterial({ color: '#5ae0ff' });
  private readonly post = new THREE.MeshStandardMaterial({ color: '#5a6470', roughness: 0.6, metalness: 0.3 });

  constructor(base: string) {
    this.wall = stoneMat(loadStone(base, 'wall'), 2, 'wall');
    void new GLTFLoader().loadAsync(`${base}assets/models/scifi/base.glb`).then((g) => {
      for (const o of g.scene.children) this.models.set(o.name, o);
      // anything drawn before the models came is drawn again with them
      for (const [, o] of this.shown) this.root.remove(o);
      this.shown.clear();
    }).catch(() => undefined);
  }

  /** Builds and drops figures so the scene matches the base's buildings. */
  sync(buildings: Building[]): void {
    const live = new Set(buildings.map((b) => b.id));
    for (const [id, o] of this.shown) if (!live.has(id)) { this.root.remove(o); this.shown.delete(id); }
    for (const b of buildings) if (!this.shown.has(b.id)) { const o = this.make(b.kind); this.place(o, b); this.root.add(o); this.shown.set(b.id, o); }
    // a broken building lies low until it is repaired
    for (const b of buildings) { const o = this.shown.get(b.id); if (o) o.scale.y = b.broken ? 0.3 : 1; }
  }

  /** A building figure on its footprint (cells are 1 m; a 2×2 sits centred on its four cells). */
  private place(o: THREE.Object3D, b: Building): void {
    const half = (BUILDINGS[b.kind].size - 1) / 2;
    o.position.set(b.at.x + half, 0, b.at.y + half);
  }

  /** A free-standing figure of a kind, for the build preview too. */
  make(kind: BuildingKind): THREE.Object3D {
    const g = new THREE.Group(), size = BUILDINGS[kind].size;
    const src = MODEL[kind] && this.models.get(MODEL[kind]!);
    const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y + h / 2, z);
      mesh.castShadow = mesh.receiveShadow = true;
      g.add(mesh);
    };
    if (src) {
      const m = src.clone(true), bb = new THREE.Box3().setFromObject(m), s = bb.getSize(new THREE.Vector3());
      const k = (size * 0.92) / Math.max(s.x, s.z);
      m.scale.setScalar(k);
      m.position.set(-(bb.min.x + s.x / 2) * k, -bb.min.y * k, -(bb.min.z + s.z / 2) * k);
      m.traverse((c) => { const mesh = c as THREE.Mesh; if (mesh.isMesh) mesh.castShadow = mesh.receiveShadow = true; });
      g.add(m);
    } else if (kind === 'wall') box(1, 1.1, 1, this.wall);
    else if (kind === 'palisade') for (let i = 0; i < 4; i++) box(0.14, 0.55 + (i % 2) * 0.12, 0.14, this.wood, -0.33 + i * 0.22, 0, 0);
    else if (kind === 'shockMine') { box(0.56, 0.06, 0.56, this.post); box(0.18, 0.05, 0.18, this.glow, 0, 0.06); }
    else if (kind === 'gate') { box(0.16, 1.1, 0.16, this.post, -0.42); box(0.16, 1.1, 0.16, this.post, 0.42); box(0.7, 0.06, 0.06, this.glow, 0, 0.3); box(0.7, 0.06, 0.06, this.glow, 0, 0.7); }
    else box(size * 0.9, 0.8, size * 0.9, this.post);
    return g;
  }

  dispose(): void {
    this.root.clear();
    this.shown.clear();
  }
}

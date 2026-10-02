import * as THREE from 'three';
import { idx, type GridMap, type GridState } from '../../sim/grid/types';
import type { EnvLibrary } from '../explore/envAssets';
import { torchSpots, type WallFace } from './gridLayout';
import { CELL, toWorld, yawFor } from './gridTerrain';

const TORCH_Y = 1.05;
const LIGHT_RANGE = 6.5;

interface Torch { face: WallFace; model: THREE.Object3D; flame: THREE.Mesh; at: THREE.Vector3; cell: number; phase: number }

/** Wall torches: a model and a flickering flame each; only the few nearest seen torches get a real light (phones stay fast). */
export class GridTorches {
  readonly root = new THREE.Group();
  private readonly torches: Torch[] = [];
  private readonly lights: THREE.PointLight[] = [];
  private t = 0;

  constructor(m: GridMap, env: EnvLibrary, lightCount: number) {
    const flameGeo = new THREE.SphereGeometry(0.07, 8, 6);
    torchSpots(m).forEach((face, n) => {
      const base = toWorld(face.wall.x + face.dir.x * 0.5, face.wall.y + face.dir.y * 0.5);
      const model = env.clone('dungeon/torch', { height: 0.55 });
      model.position.set(base.x, TORCH_Y - 0.25, base.z);
      model.rotation.y = yawFor(face.dir);
      const flame = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
      const at = new THREE.Vector3(base.x + face.dir.x * 0.28 * CELL, TORCH_Y + 0.22, base.z + face.dir.y * 0.28 * CELL);
      flame.position.copy(at);
      model.visible = flame.visible = false;
      this.root.add(model, flame);
      this.torches.push({ face, model, flame, at, cell: idx(m, face.floor), phase: n * 1.7 });
    });
    for (let i = 0; i < lightCount; i++) {
      const l = new THREE.PointLight('#ff9a40', 0, LIGHT_RANGE, 1.8);
      this.lights.push(l);
      this.root.add(l);
    }
  }

  /** Shows torches the hero has seen; hands the lights to the nearest seen ones. */
  shade(s: GridState, hero: THREE.Vector3): void {
    for (const t of this.torches) t.model.visible = t.flame.visible = s.seen[t.cell] === 1;
    const near = this.torches.filter((t) => s.seen[t.cell] === 1).sort((a, b) => a.at.distanceToSquared(hero) - b.at.distanceToSquared(hero));
    this.lights.forEach((l, i) => {
      const t = near[i];
      l.userData.torch = t;
      if (t) l.position.copy(t.at).add(new THREE.Vector3(t.face.dir.x * 0.3, 0, t.face.dir.y * 0.3));
      else l.intensity = 0;
    });
  }

  update(dt: number): void {
    this.t += dt;
    for (const tr of this.torches) {
      if (!tr.flame.visible) continue;
      const f = 1 + Math.sin(this.t * 11 + tr.phase) * 0.12 + Math.sin(this.t * 23 + tr.phase * 2) * 0.08;
      tr.flame.scale.set(1, f * 1.4, 1);
    }
    for (const l of this.lights) {
      const t = l.userData.torch as Torch | undefined;
      if (!t) continue;
      l.intensity = 9 * (1 + Math.sin(this.t * 9 + t.phase) * 0.1 + Math.sin(this.t * 17 + t.phase) * 0.06);
    }
  }

  dispose(): void {
    this.root.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
  }
}

import * as THREE from 'three';
import { idx, type GridMap, type GridState } from '../../sim/grid/types';
import type { EnvLibrary } from '../explore/envAssets';
import { wallFaces, type WallFace } from './gridLayout';

/** Metres per grid cell. */
export const CELL = 1.0;
export const WALL_H = 1.5;
const PANEL_DEPTH = 0.25;
const CAP = new THREE.Color('#4a4038');
const SEEN = 0.42;

export const toWorld = (x: number, y: number): THREE.Vector3 => new THREE.Vector3(x * CELL, 0, y * CELL);
/** Yaw that turns a model's +z toward `dir` (grid y = world z). */
export const yawFor = (dir: { x: number; y: number }): number => Math.atan2(dir.x, dir.y);

/** The first mesh of an env model, to instance it (null when the model is missing). */
function meshOf(env: EnvLibrary, ref: string): { geo: THREE.BufferGeometry; mat: THREE.Material } | null {
  let found: THREE.Mesh | null = null;
  env.source(ref)?.scene.traverse((o) => { if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh; });
  const m = found as THREE.Mesh | null;
  return m ? { geo: m.geometry, mat: (m.material as THREE.Material).clone() } : null;
}

/** Crypt floor tiles and wall panels (KayKit), dark wall tops, pillars, doors, chests and exits — all shaded by what the hero has seen. */
export class GridTerrain {
  readonly root = new THREE.Group();
  private readonly floor: THREE.InstancedMesh;
  private readonly panels: THREE.InstancedMesh;
  private readonly caps: THREE.InstancedMesh;
  private readonly floorAt: [number, number][] = [];
  private readonly faces: WallFace[];
  private readonly capAt: [number, number][] = [];
  private readonly props = new Map<number, THREE.Object3D>();
  private readonly doors = new Map<number, THREE.Object3D>();
  private readonly chests = new Map<number, THREE.Object3D>();
  private readonly exits: THREE.Mesh[] = [];
  private readonly tmp = new THREE.Color();

  constructor(private readonly m: GridMap, env: EnvLibrary) {
    const floorKit = meshOf(env, 'dungeon/floor');
    const wallKit = meshOf(env, 'dungeon/wall');
    const floors = m.tiles.map((t, i) => [t, i] as const).filter(([t]) => t !== 'wall');
    this.faces = wallFaces(m);
    const capCells = [...new Set(this.faces.map((f) => idx(m, f.wall)))];
    this.floor = new THREE.InstancedMesh(floorKit?.geo ?? new THREE.BoxGeometry(4, 0.1, 4), floorKit?.mat ?? new THREE.MeshStandardMaterial({ color: '#4a4640' }), floors.length);
    this.panels = new THREE.InstancedMesh(wallKit?.geo ?? new THREE.BoxGeometry(4, 4, 1).translate(0, 2, 0), wallKit?.mat ?? new THREE.MeshStandardMaterial({ color: '#6b645a' }), this.faces.length);
    this.caps = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, 0.08, CELL), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }), capCells.length);
    this.floor.receiveShadow = true;
    this.panels.receiveShadow = true;
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const tileScale = new THREE.Vector3(CELL / 4, CELL / 4, CELL / 4);
    floors.forEach(([, i], k) => {
      const p = toWorld(i % m.w, Math.floor(i / m.w));
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((i * 7) % 4) * (Math.PI / 2));
      this.floor.setMatrixAt(k, mtx.compose(p.setY(-0.012), q, tileScale));
      this.floorAt.push([i, k]);
    });
    const panelScale = new THREE.Vector3(CELL / 4, WALL_H / 4, PANEL_DEPTH);
    this.faces.forEach((f, k) => {
      const p = toWorld(f.wall.x + f.dir.x * (0.5 - PANEL_DEPTH / 2), f.wall.y + f.dir.y * (0.5 - PANEL_DEPTH / 2));
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawFor(f.dir));
      this.panels.setMatrixAt(k, mtx.compose(p, q, panelScale));
    });
    capCells.forEach((i, k) => {
      const p = toWorld(i % m.w, Math.floor(i / m.w));
      this.caps.setMatrixAt(k, mtx.makeTranslation(p.x, WALL_H, p.z));
      this.capAt.push([i, k]);
    });
    for (const im of [this.floor, this.panels, this.caps]) for (let k = 0; k < im.count; k++) im.setColorAt(k, new THREE.Color(0, 0, 0));
    this.root.add(this.floor, this.panels, this.caps);
    this.addProps(env);
  }

  private addProps(env: EnvLibrary): void {
    const m = this.m;
    m.tiles.forEach((t, i) => {
      const p = toWorld(i % m.w, Math.floor(i / m.w));
      if (t === 'pillar') this.place(i, env.clone('dungeon/pillar', { width: CELL * 0.75 }), p, this.props);
      if (t === 'door') {
        const door = new THREE.Mesh(new THREE.BoxGeometry(CELL, WALL_H * 0.92, CELL * 0.18), new THREE.MeshStandardMaterial({ color: '#5a3c22', roughness: 0.8 }));
        door.rotation.y = m.tiles[i - 1] === 'wall' && m.tiles[i + 1] === 'wall' ? 0 : Math.PI / 2;
        door.position.y = WALL_H * 0.46;
        const hinge = new THREE.Group();
        hinge.add(door);
        this.place(i, hinge, p, this.doors);
      }
    });
    for (const c of m.chests) this.place(idx(m, c), env.clone('dungeon/chest', { width: CELL * 0.62 }), toWorld(c.x, c.y), this.chests);
    for (const e of m.exits) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(CELL * 0.42, 0.06, 8, 32), new THREE.MeshStandardMaterial({ color: '#5fe08a', emissive: '#2a9a50', emissiveIntensity: 1.4 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(toWorld(e.x, e.y)).setY(0.06);
      this.exits.push(ring);
      this.root.add(ring);
    }
  }

  private place(i: number, obj: THREE.Object3D, p: THREE.Vector3, into: Map<number, THREE.Object3D>): void {
    obj.position.x = p.x;
    obj.position.z = p.z;
    obj.visible = false;
    into.set(i, obj);
    this.root.add(obj);
  }

  /** Visible tiles in full light, remembered ones dim, unknown ones black; props follow. */
  shade(s: GridState): void {
    const level = (i: number) => (s.visible.has(i) ? 1 : s.seen[i] ? SEEN : 0);
    const white = (l: number) => this.tmp.setScalar(l);
    for (const [i, k] of this.floorAt) this.floor.setColorAt(k, white(level(i)));
    this.faces.forEach((f, k) => this.panels.setColorAt(k, white(level(idx(this.m, f.floor)))));
    for (const [i, k] of this.capAt) this.caps.setColorAt(k, this.tmp.copy(CAP).multiplyScalar(level(i) >= 1 ? 1 : level(i) > 0 ? 0.6 : 0));
    for (const im of [this.floor, this.panels, this.caps]) im.instanceColor!.needsUpdate = true;
    for (const map of [this.props, this.doors, this.chests]) for (const [i, o] of map) o.visible = level(i) > 0;
    s.map.exits.forEach((e, n) => {
      const ring = this.exits[n]!;
      ring.visible = level(idx(this.m, e)) > 0;
      const closed = s.closedExits.includes(n);
      const mat = ring.material as THREE.MeshStandardMaterial;
      mat.color.set(closed ? '#d04a3a' : '#5fe08a');
      mat.emissive.set(closed ? '#7a1a10' : '#2a9a50');
    });
  }

  openDoor(i: number): void {
    const d = this.doors.get(i)?.children[0];
    if (d) { d.rotation.y += Math.PI / 2.2; d.position.x += CELL * 0.35; }
  }

  openChest(i: number): void {
    const c = this.chests.get(i);
    if (c) { c.scale.multiplyScalar(0.8); c.position.y = -0.05; }
  }

  pulseExit(t: number): void {
    for (const r of this.exits) r.scale.setScalar(1 + Math.sin(t * 8) * 0.06);
  }

  dispose(): void {
    this.root.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
  }
}

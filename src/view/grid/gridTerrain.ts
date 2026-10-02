import * as THREE from 'three';
import { idx, type GridMap, type GridState } from '../../sim/grid/types';
import type { EnvLibrary } from '../explore/envAssets';

/** Metres per grid cell. */
export const CELL = 1.4;
const WALL_H = 2.2;
const FLOOR = new THREE.Color('#4a4640');
const FLOOR_B = new THREE.Color('#423e39');
const WALL = new THREE.Color('#6b645a');
const SEEN = 0.32;

export const toWorld = (x: number, y: number): THREE.Vector3 => new THREE.Vector3(x * CELL, 0, y * CELL);

/** Floor and walls as two instanced meshes (shaded by sight), plus pillars, doors, chests and exits. */
export class GridTerrain {
  readonly root = new THREE.Group();
  private readonly floor: THREE.InstancedMesh;
  private readonly walls: THREE.InstancedMesh;
  private readonly floorAt = new Map<number, number>();
  private readonly wallAt = new Map<number, number>();
  /** props that should only show where the hero has seen */
  private readonly props = new Map<number, THREE.Object3D>();
  private readonly doors = new Map<number, THREE.Object3D>();
  private readonly chests = new Map<number, THREE.Object3D>();
  private readonly exits: THREE.Mesh[] = [];
  private readonly tmp = new THREE.Color();

  constructor(private readonly m: GridMap, env: EnvLibrary) {
    const cells = m.tiles.map((t, i) => ({ t, i }));
    const floors = cells.filter((c) => c.t !== 'wall');
    // only walls touching a walkable tile are drawn (the rest is solid rock)
    const walls = cells.filter((c) => c.t === 'wall' && this.touchesFloor(c.i));
    this.floor = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, 0.1, CELL), new THREE.MeshStandardMaterial({ roughness: 0.95 }), floors.length);
    this.walls = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, WALL_H, CELL), new THREE.MeshStandardMaterial({ roughness: 0.9 }), walls.length);
    this.floor.receiveShadow = true;
    this.walls.castShadow = true;
    this.walls.receiveShadow = true;
    const mtx = new THREE.Matrix4();
    floors.forEach((c, k) => {
      const p = toWorld(c.i % m.w, Math.floor(c.i / m.w));
      this.floor.setMatrixAt(k, mtx.makeTranslation(p.x, -0.05, p.z));
      this.floor.setColorAt(k, new THREE.Color(0, 0, 0));
      this.floorAt.set(c.i, k);
    });
    walls.forEach((c, k) => {
      const p = toWorld(c.i % m.w, Math.floor(c.i / m.w));
      this.walls.setMatrixAt(k, mtx.makeTranslation(p.x, WALL_H / 2, p.z));
      this.walls.setColorAt(k, new THREE.Color(0, 0, 0));
      this.wallAt.set(c.i, k);
    });
    this.root.add(this.floor, this.walls);
    m.tiles.forEach((t, i) => {
      const p = toWorld(i % m.w, Math.floor(i / m.w));
      if (t === 'pillar') this.place(i, env.clone('dungeon/pillar', { width: CELL * 0.8 }), p, this.props);
      if (t === 'door') {
        const door = new THREE.Mesh(new THREE.BoxGeometry(CELL, WALL_H * 0.9, CELL * 0.25), new THREE.MeshStandardMaterial({ color: '#6a4a2a', roughness: 0.8 }));
        const horizontal = m.tiles[i - 1] === 'wall' && m.tiles[i + 1] === 'wall';
        door.rotation.y = horizontal ? 0 : Math.PI / 2;
        door.position.y = WALL_H * 0.45;
        this.place(i, door, p, this.doors);
      }
    });
    for (const c of m.chests) this.place(idx(m, c), env.clone('dungeon/chest', { width: CELL * 0.7 }), toWorld(c.x, c.y), this.chests);
    for (const e of m.exits) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(CELL * 0.42, 0.07, 8, 32), new THREE.MeshStandardMaterial({ color: '#5fe08a', emissive: '#2a9a50', emissiveIntensity: 1.2 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(toWorld(e.x, e.y)).setY(0.08);
      this.exits.push(ring);
      this.root.add(ring);
    }
  }

  private touchesFloor(i: number): boolean {
    const x = i % this.m.w;
    const y = Math.floor(i / this.m.w);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < this.m.w && ny < this.m.h && this.m.tiles[ny * this.m.w + nx] !== 'wall') return true;
    }
    return false;
  }

  private place(i: number, obj: THREE.Object3D, p: THREE.Vector3, into: Map<number, THREE.Object3D>): void {
    obj.position.x = p.x;
    obj.position.z = p.z;
    obj.visible = false;
    into.set(i, obj);
    this.root.add(obj);
  }

  /** Visible tiles at full light, remembered ones dim, unknown ones black; props follow. */
  shade(s: GridState): void {
    const level = (i: number) => (s.visible.has(i) ? 1 : s.seen[i] ? SEEN : 0);
    for (const [i, k] of this.floorAt) {
      const l = level(i);
      const base = (i + Math.floor(i / this.m.w)) % 2 ? FLOOR : FLOOR_B;
      this.floor.setColorAt(k, this.tmp.copy(base).multiplyScalar(l));
    }
    for (const [i, k] of this.wallAt) this.walls.setColorAt(k, this.tmp.copy(WALL).multiplyScalar(level(i)));
    this.floor.instanceColor!.needsUpdate = true;
    this.walls.instanceColor!.needsUpdate = true;
    for (const map of [this.props, this.doors, this.chests]) for (const [i, o] of map) o.visible = level(i) > 0;
    s.map.exits.forEach((e, n) => {
      const ring = this.exits[n]!;
      ring.visible = level(idx(this.m, e)) > 0;
      const closed = s.closedExits.includes(n);
      (ring.material as THREE.MeshStandardMaterial).color.set(closed ? '#d04a3a' : '#5fe08a');
      (ring.material as THREE.MeshStandardMaterial).emissive.set(closed ? '#7a1a10' : '#2a9a50');
    });
  }

  openDoor(i: number): void {
    const d = this.doors.get(i);
    if (d) d.rotation.y += Math.PI / 2.4;
  }

  openChest(i: number): void {
    const c = this.chests.get(i);
    if (c) c.scale.multiplyScalar(0.85);
  }

  /** The exit ring under the hero pulses while extracting. */
  pulseExit(t: number): void {
    for (const r of this.exits) r.scale.setScalar(1 + Math.sin(t * 8) * 0.06);
  }

  dispose(): void {
    this.root.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
  }
}

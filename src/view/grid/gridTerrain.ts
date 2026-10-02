import * as THREE from 'three';
import { idx, type GridMap, type GridState } from '../../sim/grid/types';
import type { DungeonKit, DungeonPiece } from './dungeonKit';
import { wallFaces, type WallFace } from './gridLayout';
import { addDecor, cornerColumns } from './gridDecor';

/** Metres per grid cell. */
export const CELL = 1.0;
export const WALL_H = 1.5;
const PANEL_DEPTH = 0.25;
const CAP = new THREE.Color('#5a5048');
const SEEN = 0.42;

export const toWorld = (x: number, y: number): THREE.Vector3 => new THREE.Vector3(x * CELL, 0, y * CELL);
/** Yaw that turns a model's +z toward `dir` (grid y = world z). */
export const yawFor = (dir: { x: number; y: number }): number => Math.atan2(dir.x, dir.y);

/** Floor, wall panels and columns from the Quaternius modular dungeon pack, dark wall tops, pillars, doors, chests and exits — all shaded by what the hero has seen. */
export class GridTerrain {
  readonly root = new THREE.Group();
  private readonly instanced: { mesh: THREE.InstancedMesh; cells: number[]; tint?: THREE.Color }[] = [];
  /** props shown only where the hero has seen (keyed by the cell that reveals them) */
  private readonly props: [number, THREE.Object3D][] = [];
  private readonly doors = new Map<number, THREE.Object3D>();
  private readonly chests = new Map<number, THREE.Object3D>();
  private readonly exits: THREE.Mesh[] = [];
  private readonly tmp = new THREE.Color();

  constructor(private readonly m: GridMap, private readonly kit: DungeonKit) {
    const faces = wallFaces(m);
    const floors = m.tiles.map((t, i) => [t, i] as const).filter(([t]) => t !== 'wall').map(([, i]) => i);
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    this.instance('Floor_Modular', floors, (i, p) => {
      const pc = kit.piece('Floor_Modular')!;
      q.setFromAxisAngle(up, ((i * 7) % 4) * (Math.PI / 2));
      return new THREE.Matrix4().compose(p.setY(-0.1), q, new THREE.Vector3(CELL / pc.size.x, 0.1 / pc.size.y, CELL / pc.size.z));
    });
    this.instanceFaces(faces);
    const capCells = [...new Set(faces.map((f) => idx(m, f.wall)))];
    const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, 0.06, CELL), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }), capCells.length);
    capCells.forEach((i, k) => { const p = toWorld(i % m.w, Math.floor(i / m.w)); caps.setMatrixAt(k, new THREE.Matrix4().makeTranslation(p.x, WALL_H, p.z)); caps.setColorAt(k, new THREE.Color(0, 0, 0)); });
    this.root.add(caps);
    this.instanced.push({ mesh: caps, cells: capCells, tint: CAP });
    for (const c of cornerColumns(m, faces)) {
      const col = kit.clone('Column', { height: WALL_H * 1.08 });
      col.position.set(c.at.x * CELL, 0, c.at.y * CELL);
      this.addProp(c.reveal, col);
    }
    this.addProps();
    for (const [cell, obj] of addDecor(m, faces, kit)) this.addProp(cell, obj);
  }

  /** One instanced mesh of a pack piece over many cells; matrices come from `place`. */
  private instance(name: DungeonPiece, cells: number[], place: (i: number, p: THREE.Vector3) => THREE.Matrix4): void {
    const pc = this.kit.piece(name);
    if (!pc || !cells.length) return;
    const mesh = new THREE.InstancedMesh(pc.geometry, pc.material, cells.length);
    mesh.receiveShadow = true;
    cells.forEach((i, k) => {
      mesh.setMatrixAt(k, place(i, toWorld(i % this.m.w, Math.floor(i / this.m.w))));
      mesh.setColorAt(k, new THREE.Color(0, 0, 0));
    });
    this.root.add(mesh);
    this.instanced.push({ mesh, cells });
  }

  /** Wall panels on every wall side facing a walkable cell, inside the wall cell, front at the boundary. */
  private instanceFaces(faces: WallFace[]): void {
    const pc = this.kit.piece('Wall_Modular');
    if (!pc) return;
    const mesh = new THREE.InstancedMesh(pc.geometry, pc.material, faces.length);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    const scale = new THREE.Vector3(CELL / pc.size.x, WALL_H / pc.size.y, PANEL_DEPTH / pc.size.z);
    const q = new THREE.Quaternion();
    faces.forEach((f, k) => {
      const p = toWorld(f.wall.x + f.dir.x * (0.5 - PANEL_DEPTH / 2), f.wall.y + f.dir.y * (0.5 - PANEL_DEPTH / 2));
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawFor(f.dir));
      mesh.setMatrixAt(k, new THREE.Matrix4().compose(p, q, scale));
      mesh.setColorAt(k, new THREE.Color(0, 0, 0));
    });
    this.root.add(mesh);
    this.instanced.push({ mesh, cells: faces.map((f) => idx(this.m, f.floor)) });
  }

  private addProp(cell: number, obj: THREE.Object3D): void {
    obj.visible = false;
    this.props.push([cell, obj]);
    this.root.add(obj);
  }

  private addProps(): void {
    const m = this.m;
    m.tiles.forEach((t, i) => {
      const p = toWorld(i % m.w, Math.floor(i / m.w));
      if (t === 'pillar') {
        const col = this.kit.clone('Column2', { height: WALL_H * 1.1 });
        col.position.copy(p);
        this.addProp(i, col);
      }
      if (t === 'door') {
        const door = this.kit.clone('Arch_Door', { width: CELL });
        door.scale.y *= 0.85;
        door.rotation.y = m.tiles[i - 1] === 'wall' && m.tiles[i + 1] === 'wall' ? 0 : Math.PI / 2;
        door.position.copy(p);
        this.doors.set(i, door);
        this.addProp(i, door);
      }
    });
    for (const c of m.chests) {
      const chest = this.kit.clone('Chest', { width: CELL * 0.62 });
      chest.position.copy(toWorld(c.x, c.y));
      this.chests.set(idx(m, c), chest);
      this.addProp(idx(m, c), chest);
    }
    for (const e of m.exits) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(CELL * 0.42, 0.06, 8, 32), new THREE.MeshStandardMaterial({ color: '#5fe08a', emissive: '#2a9a50', emissiveIntensity: 1.4 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(toWorld(e.x, e.y)).setY(0.06);
      this.exits.push(ring);
      this.root.add(ring);
    }
  }

  /** Visible tiles in full light, remembered ones dim, unknown ones black; props follow. */
  shade(s: GridState): void {
    const level = (i: number) => (s.visible.has(i) ? 1 : s.seen[i] ? SEEN : 0);
    for (const it of this.instanced) {
      it.cells.forEach((cell, k) => { const l = level(cell); it.mesh.setColorAt(k, it.tint ? this.tmp.copy(it.tint).multiplyScalar(l > 0 ? Math.max(0.6, l) : 0) : this.tmp.setScalar(l)); });
      it.mesh.instanceColor!.needsUpdate = true;
    }
    for (const [cell, o] of this.props) o.visible = level(cell) > 0;
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
    const d = this.doors.get(i);
    if (d) { d.rotation.y += Math.PI / 2.2; d.position.x += CELL * 0.3; }
  }

  openChest(i: number): void {
    const c = this.chests.get(i);
    if (c) { c.scale.multiplyScalar(0.85); c.position.y = -0.04; }
  }

  pulseExit(t: number): void {
    for (const r of this.exits) r.scale.setScalar(1 + Math.sin(t * 8) * 0.06);
  }

  dispose(): void {
    for (const it of this.instanced) it.mesh.dispose();
  }
}

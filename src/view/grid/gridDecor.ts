import * as THREE from 'three';
import { idx, same, tileAt, type Cell, type GridMap } from '../../sim/grid/types';
import type { DungeonKit, DungeonPiece } from './dungeonKit';
import { torchSpots, type WallFace } from './gridLayout';
import { CELL, WALL_H, toWorld, yawFor } from './gridTerrain';

const hash = (i: number): number => ((i * 2654435761) >>> 0) % 1000;
const DIAG: Cell[] = [{ x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }];
const INSET = 0.5 - 0.17;

/** Columns where wall panels meet: inside room corners and at the ends of wall runs. `reveal` is the floor cell whose sight shows them. */
export function cornerColumns(m: GridMap, faces: WallFace[]): { at: { x: number; y: number }; reveal: number }[] {
  const byWall = new Map<number, WallFace[]>();
  for (const f of faces) byWall.set(idx(m, f.wall), [...(byWall.get(idx(m, f.wall)) ?? []), f]);
  const out: { at: { x: number; y: number }; reveal: number }[] = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const c = { x, y };
    if (tileAt(m, c) !== 'wall') continue;
    const own = byWall.get(idx(m, c)) ?? [];
    for (const d of DIAG) {
      const floor = { x: x + d.x, y: y + d.y };
      if (tileAt(m, floor) !== 'floor') continue;
      const sideA = { x: x + d.x, y };
      const sideB = { x, y: y + d.y };
      const wallA = tileAt(m, sideA) === 'wall';
      const wallB = tileAt(m, sideB) === 'wall';
      // inner corner: this cell only touches the floor diagonally, both neighbours are walls
      const inner = wallA && wallB && own.length === 0;
      // outer corner: this cell has faces on both of those sides
      const outer = own.some((f) => f.dir.x === d.x && f.dir.y === 0) && own.some((f) => f.dir.y === d.y && f.dir.x === 0);
      if (inner || outer) out.push({ at: { x: x + d.x * INSET, y: y + d.y * INSET }, reveal: idx(m, floor) });
    }
  }
  return out;
}

const CLUTTER: DungeonPiece[] = ['Skull', 'Brick', 'Bucket', 'Vase', 'Bag_Coins', 'Skull', 'Bag_Standing'];

/** Columns breaking up long straight walls every third panel (where the run carries on both sides). */
export function runColumns(m: GridMap, faces: WallFace[]): { at: { x: number; y: number }; reveal: number }[] {
  const has = new Set(faces.map((f) => `${f.wall.x},${f.wall.y},${f.dir.x},${f.dir.y}`));
  const out: { at: { x: number; y: number }; reveal: number }[] = [];
  for (const f of faces) {
    const along = { x: Math.abs(f.dir.y), y: Math.abs(f.dir.x) };
    const pos = f.wall.x * along.x + f.wall.y * along.y;
    if (pos % 3 !== 0 || tileAt(m, f.floor) !== 'floor') continue;
    const next = `${f.wall.x + along.x},${f.wall.y + along.y},${f.dir.x},${f.dir.y}`;
    const prev = `${f.wall.x - along.x},${f.wall.y - along.y},${f.dir.x},${f.dir.y}`;
    if (!has.has(next) || !has.has(prev)) continue;
    out.push({ at: { x: f.wall.x + f.dir.x * INSET + along.x * 0.5, y: f.wall.y + f.dir.y * INSET + along.y * 0.5 }, reveal: idx(m, f.floor) });
  }
  return out;
}

/** Barrels and crates heaped in some inner corners, a small table and chair against some walls facing the view. */
function furnish(m: GridMap, faces: WallFace[], kit: DungeonKit, out: [number, THREE.Object3D][], skip: (c: Cell) => boolean): void {
  for (const c of cornerColumns(m, faces)) {
    const h = hash(c.reveal * 7 + 3);
    const floor = { x: c.reveal % m.w, y: Math.floor(c.reveal / m.w) };
    if (h % 5 !== 0 || skip(floor)) continue;
    const toward = { x: Math.sign(c.at.x - floor.x), y: Math.sign(c.at.y - floor.y) };
    const pieces: [DungeonPiece, number, number, number][] = h % 2 ? [['Barrel', 0.36, 0.2, 0.2], ['Crate', 0.4, -0.12, 0.24], ['Barrel2', 0.3, 0.24, -0.12]] : [['Crate', 0.42, 0.18, 0.18], ['Crate', 0.32, -0.16, 0.22], ['Barrel', 0.34, 0.22, -0.14]];
    for (const [name, w, a, b] of pieces) {
      const o = kit.clone(name, { width: w });
      const p = toWorld(floor.x + toward.x * a, floor.y + toward.y * b);
      o.position.set(p.x, 0, p.z);
      o.rotation.y = (h % 90) * (Math.PI / 180) + a;
      out.push([c.reveal, o]);
    }
  }
  faces.forEach((f, n) => {
    const h = hash(n * 13 + 5);
    if (f.dir.y !== 1 || h % 29 !== 0 || tileAt(m, f.floor) !== 'floor' || skip(f.floor)) return;
    const table = kit.clone('Table_Small', { width: 0.62 });
    const p = toWorld(f.floor.x, f.floor.y - 0.22);
    table.position.set(p.x, 0, p.z);
    const chair = kit.clone('Chair', { width: 0.34 });
    const q = toWorld(f.floor.x + 0.3, f.floor.y + 0.05);
    chair.position.set(q.x, 0, q.z);
    chair.rotation.y = Math.PI + 0.5;
    out.push([idx(m, f.floor), table], [idx(m, f.floor), chair]);
  });
}

/** Banners on some walls, cobwebs high in corners, a little clutter along the walls (decoration only, nothing blocks). */
export function addDecor(m: GridMap, faces: WallFace[], kit: DungeonKit): [number, THREE.Object3D][] {
  const out: [number, THREE.Object3D][] = [];
  const torches = torchSpots(m);
  faces.forEach((f, n) => {
    const reveal = idx(m, f.floor);
    const h = hash(n * 31 + reveal);
    if (tileAt(m, f.floor) !== 'floor' || torches.some((t) => same(t.floor, f.floor))) return;
    // banners hang mostly on the walls that face the view
    if (h % (f.dir.y === 1 ? 6 : 17) === 0) {
      const banner = kit.clone(h % 2 ? 'Banner_wall' : 'Sword_WallMount', { height: h % 2 ? WALL_H * 0.75 : 0.45 });
      const p = toWorld(f.wall.x + f.dir.x * 0.5, f.wall.y + f.dir.y * 0.5);
      banner.position.set(p.x + f.dir.x * 0.04, h % 2 ? 0.25 : 0.75, p.z + f.dir.y * 0.04);
      banner.rotation.y = yawFor(f.dir);
      out.push([reveal, banner]);
    } else if (h % 23 === 0) {
      const item = kit.clone(CLUTTER[h % CLUTTER.length]!, { width: 0.28 });
      const p = toWorld(f.floor.x - f.dir.x * 0.28, f.floor.y - f.dir.y * 0.28);
      item.position.set(p.x + ((h % 7) - 3) * 0.04, 0, p.z + ((h % 5) - 2) * 0.04);
      item.rotation.y = (h % 360) * (Math.PI / 180);
      if (!m.chests.some((c) => same(c, f.floor)) && !same(m.start, f.floor)) out.push([reveal, item]);
    }
  });
  furnish(m, faces, kit, out, (c) => m.chests.some((ch) => same(ch, c)) || same(m.start, c) || (!!m.stairs && same(m.stairs, c)));
  for (const c of cornerColumns(m, faces)) {
    if (hash(c.reveal) % 3 !== 0) continue;
    const web = kit.clone(hash(c.reveal) % 2 ? 'Cobweb' : 'Cobweb2', { width: 0.55 });
    web.position.set(c.at.x * CELL, WALL_H * 0.62, c.at.y * CELL);
    web.rotation.y = (hash(c.reveal) % 4) * (Math.PI / 2);
    out.push([c.reveal, web]);
  }
  return out;
}

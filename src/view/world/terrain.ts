import * as THREE from 'three';
import type { Obstacle } from '../../sim/battle/types';
import type { Region } from '../../sim/extract/regionTypes';
import type { EnvLibrary } from '../explore/envAssets';
import { instanceAll, type Placement } from './instancing';

const GROUND: Record<Region['layout'], string> = { cross: '#6f8a4a', river: '#6a8648', canyon: '#7a8150' };
const DECOR: Record<'water' | 'cliff' | 'road', { color: string; height: number }> = {
  water: { color: '#3f6f8f', height: 0.04 }, road: { color: '#a08a62', height: 0.02 }, cliff: { color: '#6b6258', height: 3.2 },
};
const WALL_H = 2.4;

/** Ground, roads, water, cliffs, walls (doors kept separate so they can open) and instanced props. */
export function buildTerrain(r: Region, lib: EnvLibrary, shadows: boolean): { root: THREE.Group; doors: Map<string, THREE.Object3D> } {
  const root = new THREE.Group();
  const b = r.bounds;
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(w + 40, h + 40), new THREE.MeshStandardMaterial({ color: GROUND[r.layout], roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((b.minX + b.maxX) / 2, 0, (b.minY + b.maxY) / 2);
  ground.receiveShadow = shadows;
  root.add(ground);

  for (const d of r.decor) {
    const look = DECOR[d.kind];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(d.half.x * 2, look.height, d.half.y * 2), new THREE.MeshStandardMaterial({ color: look.color, roughness: d.kind === 'water' ? 0.3 : 1 }));
    mesh.position.set(d.pos.x, look.height / 2, d.pos.y);
    mesh.castShadow = shadows && d.kind === 'cliff';
    mesh.receiveShadow = shadows;
    root.add(mesh);
  }

  const decorBoxes = new Set(r.decor.filter((d) => d.kind !== 'road').map((d) => `${d.pos.x},${d.pos.y}`));
  const doorOf = new Map(r.pois.filter((p) => p.door).map((p) => [`${p.door!.box.pos.x},${p.door!.box.pos.y}`, p.id]));
  const stone = new THREE.MeshStandardMaterial({ color: '#8a8378', roughness: 0.95 });
  const door = new THREE.MeshStandardMaterial({ color: '#6b4a2b', roughness: 0.8 });
  const doors = new Map<string, THREE.Object3D>();
  for (const o of r.obstacles) {
    if (o.kind !== 'box' || !o.half) continue;
    const key = `${o.pos.x},${o.pos.y}`;
    if (decorBoxes.has(key)) continue;
    const isDoor = doorOf.get(key);
    const mesh = wallMesh(o, isDoor ? door : stone, shadows);
    root.add(mesh);
    if (isDoor) doors.set(isDoor, mesh);
  }

  // a band of forest just outside the playable edge
  const border: (Placement & { ref: string })[] = [];
  for (let x = b.minX - 3; x <= b.maxX + 3; x += 4.5) for (const y of [b.minY - 3, b.maxY + 3]) border.push({ ref: 'forest/trees', pos: { x, y }, rot: x, scale: 1 });
  for (let y = b.minY; y <= b.maxY; y += 4.5) for (const x of [b.minX - 3, b.maxX + 3]) border.push({ ref: 'forest/treesB', pos: { x, y }, rot: y, scale: 1 });
  root.add(instanceAll(lib, [...r.props, ...border], shadows));
  return { root, doors };
}

function wallMesh(o: Obstacle, mat: THREE.Material, shadows: boolean): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(o.half!.x * 2, WALL_H, o.half!.y * 2), mat);
  m.position.set(o.pos.x, WALL_H / 2, o.pos.y);
  m.castShadow = shadows;
  m.receiveShadow = shadows;
  return m;
}

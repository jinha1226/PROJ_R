import * as THREE from 'three';
import { CELL, WALL_H } from './gridTerrain';
import type { DungeonKit } from './dungeonKit';

/** A chasm cell: a black drop with a faint glow far below and a broken stone lip round it. */
export function chasmMesh(): THREE.Object3D {
  const g = new THREE.Group();
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 0.96, CELL * 0.96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#010102' }));
  hole.position.y = 0.01;
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 0.7, CELL * 0.7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#3a1a5a', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  deep.position.y = 0.012;
  const lipMat = new THREE.MeshStandardMaterial({ color: '#4a4038', roughness: 1 });
  for (const [x, z, w, d] of [[0, -0.47, 1, 0.06], [0, 0.47, 1, 0.06], [-0.47, 0, 0.06, 1], [0.47, 0, 0.06, 1]] as const) {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(w * CELL, 0.06, d * CELL), lipMat);
    lip.position.set(x * CELL, 0.0, z * CELL);
    g.add(lip);
  }
  g.add(hole, deep);
  return g;
}

/** A sealed door: the arch with a glowing bar across it (a cutter burns it open). */
export function sealMesh(kit: DungeonKit, alongX: boolean): THREE.Object3D {
  const g = new THREE.Group();
  const arch = kit.clone('Arch_Door', { width: CELL });
  arch.scale.y *= 0.85;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.9, 0.12, 0.08), new THREE.MeshStandardMaterial({ color: '#ff7a2a', emissive: '#ff5a1a', emissiveIntensity: 1.6 }));
  bar.position.y = WALL_H * 0.42;
  const bar2 = bar.clone();
  bar2.position.y = WALL_H * 0.22;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.86, WALL_H * 0.7, 0.05), new THREE.MeshStandardMaterial({ color: '#2a2c30', metalness: 0.6, roughness: 0.5 }));
  plate.position.y = WALL_H * 0.35;
  g.add(arch, plate, bar, bar2);
  g.rotation.y = alongX ? 0 : Math.PI / 2;
  return g;
}

/** Floor materials: scrap metal, a soul crystal, an ancient cog, elite remains — each with its own colour. */
export const MATERIAL_HEX: Record<string, string> = { scrap: '#a8aeb6', soul: '#62d4ff', relic: '#e0b84a', remains: '#c8443a' };
export function materialMesh(mat: string): THREE.Object3D {
  const hex = MATERIAL_HEX[mat] ?? '#cccccc';
  const glow = mat === 'soul' || mat === 'remains';
  const m = new THREE.MeshStandardMaterial({ color: hex, emissive: glow ? hex : '#000000', emissiveIntensity: glow ? 0.9 : 0, metalness: mat === 'scrap' || mat === 'relic' ? 0.7 : 0.1, roughness: 0.4 });
  if (mat === 'soul') return new THREE.Mesh(new THREE.OctahedronGeometry(0.16).scale(1, 1.6, 1), m);
  if (mat === 'relic') return new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 6, 8), m);
  if (mat === 'remains') return new THREE.Mesh(new THREE.TetrahedronGeometry(0.17), m);
  const g = new THREE.Group();
  for (const [x, z, s] of [[-0.08, 0, 0.14], [0.08, 0.05, 0.11], [0, -0.08, 0.09]] as const) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.6, s), m);
    b.position.set(x, s * 0.3, z);
    b.rotation.y = x * 7;
    g.add(b);
  }
  return g;
}

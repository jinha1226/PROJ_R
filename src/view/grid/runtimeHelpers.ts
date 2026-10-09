import * as THREE from 'three';
import { WEAPONS } from '../../sim/grid/items';
import type { Cell, GEvent, GridMap } from '../../sim/grid/types';
import type { WeaponLook } from './weaponMeshes';
import { CELL } from './gridTerrain';

export const cellVec = (c: Cell): THREE.Vector3 => new THREE.Vector3(c.x * CELL, 0, c.y * CELL);

/** A gun's shot is shown as a short burst: how many rounds, how far apart (seconds), how far off the first's line the later ones land (cells). */
export const BURST = { rounds: 3, gap: 0.07, spread: 0.35 };

/** Older saves and foe events may only carry a shot label. */
export function shotGroup(e: GEvent): WeaponLook | undefined {
  if (e.group) return e.group;
  if (e.text === 'spell') return 'none';
  if (e.text === 'bow' || e.text === 'crossbow') return e.text;
  return e.text && Object.hasOwn(WEAPONS, e.text) ? e.text as WeaponLook : undefined;
}

export function cellAtScreen(el: HTMLElement, camera: THREE.Camera, map: GridMap, clientX: number, clientY: number): Cell | null {
  const r = el.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  if (!hit) return null;
  const c = { x: Math.round(hit.x / CELL), y: Math.round(hit.z / CELL) };
  return c.x >= 0 && c.y >= 0 && c.x < map.w && c.y < map.h ? c : null;
}

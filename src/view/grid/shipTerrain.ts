import * as THREE from 'three';
import type { GridMap } from '../../sim/grid/types';
import type { MetaState } from '../../sim/grid/meta';
import type { StationId } from '../../sim/grid/ship';
import { stationLit } from './stationLit';
import type { ShipKit } from './shipKit';

/** MegaKit modules sit on a 4 m grid; the deck's cells are 1 m. */
const K = 0.25;
/** walls a little taller than a flat quarter so the bays read from above */
const WALL_Y = 0.42;
const POWERED = '#bfe8ff';
const EMERGENCY = '#ff3a2a';
const SIDES: { dx: number; dz: number; rot: number }[] = [
  { dx: -1, dz: 0, rot: 0 }, { dx: 1, dz: 0, rot: Math.PI }, { dx: 0, dz: -1, rot: -Math.PI / 2 }, { dx: 0, dz: 1, rot: Math.PI / 2 },
];

/** The crashed ship's deck built from the Modular Sci-Fi MegaKit: plated floors, walls on every edge, door frames, pipe columns, station props; red emergency light until a station is powered. */
export class ShipTerrain {
  readonly root = new THREE.Group();
  private readonly lights = new Map<StationId, THREE.PointLight>();
  private readonly owned: THREE.Mesh[] = [];
  private readonly mats: THREE.Material[] = [];
  private core: THREE.Object3D | null = null;
  private coreRing: THREE.Object3D | null = null;
  private coreLight: THREE.PointLight | null = null;
  private t = 0;

  constructor(map: GridMap, private readonly kit: ShipKit, meta: MetaState) {
    const at = (x: number, z: number) => (x < 0 || z < 0 || x >= map.w || z >= map.h ? 'wall' : map.tiles[z * map.w + x]);
    const station = (x: number, z: number) => map.stations?.find((s) => s.pos.x === x && s.pos.y === z);
    const hall = (x: number, z: number) => (x >= 6 && x <= 14) || (z >= 5 && z <= 7);
    const put = (name: string, x: number, z: number, rot = 0, sy = K) => {
      const o = this.kit.module(name);
      o.scale.set(K, sy, K);
      o.position.set(x, 0, z);
      o.rotation.y = rot;
      this.root.add(o);
      return o;
    };
    map.tiles.forEach((t, i) => {
      if (t === 'wall') return;
      const x = i % map.w;
      const z = Math.floor(i / map.w);
      const st = station(x, z);
      put(st?.id === 'hatch' ? 'Platform_X' : st ? 'Platform_CenterPlate' : hall(x, z) ? 'Platform_Metal2' : 'Platform_DarkPlates', x, z);
      // a wall on every edge that meets the hull or a bulkhead; the outer hull gets the heavier panels
      for (const s of SIDES) {
        if (at(x + s.dx, z + s.dz) !== 'wall') continue;
        const outer = x + s.dx <= 0 || z + s.dz <= 0 || x + s.dx >= map.w - 1 || z + s.dz >= map.h - 1;
        put(outer ? ((x + z) % 3 ? 'WallAstra_Straight' : 'WallAstra_Straight_Divided') : 'WallBand_Straight', x, z, s.rot, WALL_Y);
      }
      // a doorway between two bulkheads gets a frame across it
      const wallX = at(x - 1, z) === 'wall' && at(x + 1, z) === 'wall';
      const wallZ = at(x, z - 1) === 'wall' && at(x, z + 1) === 'wall';
      if (wallX !== wallZ) put('Door_Frame_Square', x, z, wallX ? 0 : Math.PI / 2, WALL_Y * 0.62);
    });
    const prop = (name: string, x: number, z: number, height: number, width = 0.9, rot = 0, y = 0) => {
      const obj = this.kit.make(name, height, width);
      obj.position.set(x, y, z);
      obj.rotation.y = rot;
      this.root.add(obj);
    };
    const mod = (name: string, x: number, z: number, rot = 0, s = K) => { const o = put(name, x, z, rot, s); o.scale.set(s, s, s); };
    // crates on the cargo cells, pipe columns at the power hall's corners
    map.tiles.forEach((t, i) => {
      if (t !== 'pillar') return;
      const x = i % map.w;
      const z = Math.floor(i / map.w);
      if ((x + z) % 2) mod('Prop_Crate4', x, z, Math.PI / 5, 0.62);
      else { mod('Prop_Crate3', x - 0.12, z, 0, 0.5); mod('Prop_Barrel_Large', x + 0.28, z + 0.22, 0, 0.5); }
    });
    for (const [x, z] of [[6, 5], [14, 5], [6, 7], [14, 7]] as const) mod('Column_Pipes', x + (x === 6 ? -0.38 : 0.38), z + (z === 5 ? -0.38 : 0.38), 0, 0.3);
    for (const { id, pos: { x, y: z } } of map.stations ?? []) {
      if (id === 'pod') { prop('Prop_HealthPack_Tube', x, z - 0.05, 1.7, 0.8); mod('Prop_Cable_1', x + 0.4, z + 0.3, Math.PI / 2, 0.35); }
      if (id === 'armory') { prop('Prop_Locker', x - 0.22, z + 0.1, 1.35, 0.42); prop('Prop_Locker', x + 0.22, z + 0.1, 1.35, 0.42); mod('Prop_ItemHolder', x - 0.55, z - 0.15, Math.PI / 2, 0.45); }
      if (id === 'suitlab') { prop('Prop_Desk_L', x + 0.05, z - 0.05, 0.75, 0.9); mod('Prop_AccessPoint', x - 0.45, z + 0.25, Math.PI / 2, 0.55); }
      if (id === 'records') { prop('Prop_Shelves_WideTall', x - 0.5, z - 0.2, 1.4, 0.9); mod('Prop_Computer', x + 0.45, z - 0.22, 0, 0.55); }
      if (id === 'nav') { mod('Prop_Computer', x - 0.25, z - 0.25, 0, 0.6); prop('Prop_SatelliteDish', x + 0.25, z - 0.1, 1.2, 0.65); }
      if (id === 'core') this.buildCore(x, z);
      if (id !== 'hatch') mod('Prop_Light_Floor', x, z + 0.42, 0, 0.32);
      const light = new THREE.PointLight(EMERGENCY, 0, 4.5, 1.6);
      light.position.set(x, 2.2, z);
      this.root.add(light);
      this.lights.set(id, light);
    }
    this.power(meta);
  }

  /** The energy core: a glowing crystal on a plinth inside a slowly turning ring. */
  private buildCore(x: number, z: number): void {
    const mat = (o: THREE.MeshStandardMaterialParameters) => { const m = new THREE.MeshStandardMaterial(o); this.mats.push(m); return m; };
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 0.22, 8), mat({ color: '#2a3a46', metalness: 0.6, roughness: 0.4 }));
    base.position.set(x, 0.11, z);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), mat({ color: '#8af4ff', emissive: '#18d8ff', emissiveIntensity: 2.4 }));
    crystal.scale.set(1, 1.7, 1);
    crystal.position.set(x, 0.9, z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.03, 8, 40), mat({ color: '#3ae0ff', emissive: '#3ae0ff', emissiveIntensity: 1.4 }));
    ring.position.set(x, 0.9, z);
    ring.rotation.x = Math.PI / 2.4;
    this.root.add(base, crystal, ring);
    this.owned.push(base, crystal, ring);
    this.core = crystal;
    this.coreRing = ring;
    this.coreLight = new THREE.PointLight('#40e0ff', 10, 6, 1.4);
    this.coreLight.position.set(x, 1.4, z);
    this.root.add(this.coreLight);
  }

  /** Powered stations get white-blue light; the rest glow emergency red. */
  power(meta: MetaState): void {
    for (const [id, light] of this.lights) {
      const lit = stationLit(meta, id);
      light.color.set(lit ? POWERED : EMERGENCY);
      light.intensity = lit ? 8 : 2.4;
    }
  }

  /** The core breathes. */
  update(dt: number): void {
    this.t += dt;
    if (this.core) this.core.rotation.y += dt * 0.6;
    if (this.coreRing) this.coreRing.rotation.z += dt * 0.4;
    if (this.coreLight) this.coreLight.intensity = 9 + Math.sin(this.t * 2.2) * 2.5;
  }

  shade(): void { /* Ship visibility is permanent. */ }
  openDoor(): void { /* No ship doors. */ }
  openChest(): void { /* No ship chests. */ }
  pulseExit(): void { /* The hatch is a station. */ }

  dispose(): void {
    for (const mesh of this.owned) mesh.geometry.dispose();
    for (const m of this.mats) m.dispose();
    for (const light of this.lights.values()) light.dispose();
    this.coreLight?.dispose();
  }
}

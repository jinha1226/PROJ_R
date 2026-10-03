import * as THREE from 'three';
import type { GridMap } from '../../sim/grid/types';
import type { MetaState } from '../../sim/grid/meta';
import type { StationId } from '../../sim/grid/ship';
import { stationLit } from './stationLit';
import type { ShipKit } from './shipKit';

const WALL_H = 1.6;
const STRIP = '#3ae0ff';
const POWERED = '#bfe8ff';
const EMERGENCY = '#ff3a2a';

/** The crashed ship's deck: trimmed bulkheads with glowing strips, metal floor panels, station pads and props, red emergency light until a station is powered. */
export class ShipTerrain {
  readonly root = new THREE.Group();
  private readonly lights = new Map<StationId, THREE.PointLight>();
  private readonly pads = new Map<StationId, THREE.MeshStandardMaterial>();
  private readonly owned: THREE.Mesh[] = [];
  private readonly mats: THREE.Material[] = [];
  private core: THREE.Object3D | null = null;
  private coreRing: THREE.Object3D | null = null;
  private coreLight: THREE.PointLight | null = null;
  private t = 0;

  constructor(map: GridMap, private readonly kit: ShipKit, meta: MetaState) {
    const tex = (name: 'floor' | 'wall' | 'red', repeat = 1) => {
      const t = kit.textures[name].clone();
      t.repeat.set(repeat, repeat);
      t.needsUpdate = true;
      return t;
    };
    const mat = (o: THREE.MeshStandardMaterialParameters) => { const m = new THREE.MeshStandardMaterial(o); this.mats.push(m); return m; };
    const floorMat = mat({ map: tex('floor'), color: '#8aa0b0', roughness: 0.55, metalness: 0.4 });
    const wallMat = mat({ map: tex('wall'), color: '#c8d8e4', roughness: 0.55, metalness: 0.3 });
    // bulkhead tops catch little light from above: a faint self-glow keeps the bays readable
    const capMat = mat({ color: '#3e4e5c', emissive: '#16222e', emissiveIntensity: 1, roughness: 0.6, metalness: 0.3 });
    const hullMat = mat({ color: '#141c24', roughness: 0.9 });
    const stripMat = mat({ color: STRIP, emissive: STRIP, emissiveIntensity: 1.6 });
    const hazardMat = mat({ map: tex('red'), color: '#ffd0a0', roughness: 0.6 });
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, m: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      mesh.receiveShadow = true;
      this.root.add(mesh);
      this.owned.push(mesh);
      return mesh;
    };
    const at = (x: number, z: number) => map.tiles[z * map.w + x];
    const open = (x: number, z: number) => x >= 0 && z >= 0 && x < map.w && z < map.h && at(x, z) !== 'wall';
    map.tiles.forEach((t, i) => {
      const x = i % map.w;
      const z = Math.floor(i / map.w);
      if (t !== 'wall') { box(x, -0.08, z, 1, 0.16, 1, floorMat); return; }
      // only walls that face the deck are drawn tall; the rest stay a dark hull
      const faces = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => open(x + dx!, z + dz!));
      const tall = faces.length > 0 || [[1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dz]) => open(x + dx!, z + dz!));
      if (!tall) { box(x, 0.05, z, 1, 0.1, 1, hullMat); return; }
      box(x, WALL_H / 2, z, 1, WALL_H, 1, wallMat);
      box(x, WALL_H + 0.02, z, 1.01, 0.05, 1.01, capMat);
      for (const [dx, dz] of faces) box(x + dx! * 0.505, WALL_H - 0.12, z + dz! * 0.505, dz ? 0.86 : 0.03, 0.05, dx ? 0.86 : 0.03, stripMat);
    });
    const prop = (name: string, x: number, z: number, height: number, width = 0.9, rot = 0, y = 0) => {
      const obj = this.kit.make(name, height, width);
      obj.position.set(x, y, z);
      obj.rotation.y = rot;
      this.root.add(obj);
    };
    // crates and barrels on the pillar cells
    map.tiles.forEach((t, i) => {
      if (t !== 'pillar') return;
      const x = i % map.w;
      const z = Math.floor(i / map.w);
      if ((x + z) % 2) prop('Prop_Crate_Large', x, z, 0.8, 0.95, Math.PI / 2);
      else { prop('Prop_Crate', x - 0.15, z, 0.55, 0.55); prop('Prop_Barrel2_Closed', x + 0.25, z + 0.2, 0.6, 0.35); }
    });
    for (const { id, pos: { x, y: z } } of map.stations ?? []) {
      // a glowing pad marks every station cell (the hatch gets hazard stripes instead)
      if (id === 'hatch') {
        box(x, 0.01, z, 0.96, 0.02, 0.96, hazardMat);
        box(x + 0.42, WALL_H / 2, z - 0.48, 0.12, WALL_H, 0.12, wallMat);
        box(x + 0.42, WALL_H / 2, z + 0.48, 0.12, WALL_H, 0.12, wallMat);
        box(x + 0.42, WALL_H, z, 0.14, 0.14, 1.08, stripMat);
      } else {
        const pad = mat({ color: '#0e2a36', emissive: '#22c8ff', emissiveIntensity: 0.25, transparent: true, opacity: 0.85 });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.46, 32), pad);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0.015, z);
        this.root.add(ring);
        this.owned.push(ring);
        this.pads.set(id, pad);
      }
      if (id === 'pod') { prop('Prop_HealthPack_Tube', x, z - 0.05, 1.9, 0.85); prop('Prop_Chair', x + 0.4, z + 0.35, 0.65, 0.35, -Math.PI / 4); }
      if (id === 'armory') { prop('Prop_Locker', x - 0.22, z + 0.05, 1.5, 0.42); prop('Prop_Locker', x + 0.22, z + 0.05, 1.5, 0.42); prop('Prop_Ammo_Closed', x - 0.6, z - 0.1, 0.3, 0.35); }
      if (id === 'suitlab') { prop('Prop_Desk_L', x + 0.05, z - 0.05, 0.8, 0.95); prop('Prop_Chair', x + 0.35, z - 0.45, 0.6, 0.35, Math.PI); }
      if (id === 'records') { prop('Prop_Shelves_WideTall', x - 0.5, z - 0.2, 1.55, 0.95); prop('Prop_Shelves_ThinTall', x + 0.55, z - 0.2, 1.55, 0.6); }
      if (id === 'nav') { prop('Prop_Desk_Medium', x, z - 0.1, 0.6, 0.95); prop('Prop_SatelliteDish', x, z - 0.15, 1.3, 0.75, 0, 0.55); prop('Prop_Chair', x - 0.3, z + 0.4, 0.6, 0.35); }
      if (id === 'core') this.buildCore(x, z, mat);
      const light = new THREE.PointLight(EMERGENCY, 0, 4.5, 1.6);
      light.position.set(x, 2.4, z);
      this.root.add(light);
      this.lights.set(id, light);
    }
    this.power(meta);
  }

  /** The energy core: a glowing crystal on a plinth inside a slowly turning ring. */
  private buildCore(x: number, z: number, mat: (o: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial): void {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.25, 8), mat({ color: '#2a3a46', metalness: 0.6, roughness: 0.4 }));
    base.position.set(x, 0.12, z);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), mat({ color: '#8af4ff', emissive: '#18d8ff', emissiveIntensity: 2.4 }));
    crystal.scale.set(1, 1.7, 1);
    crystal.position.set(x, 0.95, z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 8, 40), mat({ color: STRIP, emissive: STRIP, emissiveIntensity: 1.4 }));
    ring.position.set(x, 0.95, z);
    ring.rotation.x = Math.PI / 2.4;
    this.root.add(base, crystal, ring);
    this.owned.push(base, crystal, ring);
    this.core = crystal;
    this.coreRing = ring;
    this.coreLight = new THREE.PointLight('#40e0ff', 10, 6, 1.4);
    this.coreLight.position.set(x, 1.4, z);
    this.root.add(this.coreLight);
  }

  /** Powered stations get white-blue light and a bright pad; the rest glow emergency red. */
  power(meta: MetaState): void {
    for (const [id, light] of this.lights) {
      const lit = stationLit(meta, id);
      light.color.set(lit ? POWERED : EMERGENCY);
      light.intensity = lit ? 8 : 2.2;
      const pad = this.pads.get(id);
      if (pad) pad.emissiveIntensity = lit ? 1.1 : 0.2;
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
    for (const m of this.mats) { (m as THREE.MeshStandardMaterial).map?.dispose(); m.dispose(); }
    for (const light of this.lights.values()) light.dispose();
    this.coreLight?.dispose();
  }
}

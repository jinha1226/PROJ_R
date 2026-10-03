import * as THREE from 'three';
import type { GridMap } from '../../sim/grid/types';
import type { MetaState } from '../../sim/grid/meta';
import { STATIONS, type StationId } from '../../sim/grid/ship';
import { stationLit } from './stationLit';
import type { ShipKit } from './shipKit';
export class ShipTerrain {
  readonly root = new THREE.Group();
  private readonly lights = new Map<StationId, THREE.PointLight>();
  private readonly owned: THREE.Mesh[] = [];
  private readonly labels: THREE.Sprite[] = [];
  constructor(map: GridMap, kit: ShipKit, meta: MetaState) {
    const material = (name: 'floor' | 'wall' | 'red') => new THREE.MeshStandardMaterial({ map: kit.textures[name], roughness: 0.7 });
    const floor = material('floor'), wall = material('wall'), red = material('red');
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z); mesh.receiveShadow = true; this.root.add(mesh); this.owned.push(mesh);
    };
    map.tiles.forEach((t, i) => {
      const x = i % map.w, z = Math.floor(i / map.w);
      if (t === 'wall') { box(x, 0.6, z, 1, 1.2, 1, wall); box(x, 0.95, z, 1.01, 0.08, 1.01, red); }
      else box(x, -0.08, z, 1, 0.16, 1, floor);
    });
    const prop = (name: string, x: number, z: number, height: number, width = 0.9, y = 0) => {
      const obj = kit.make(name, height, width); obj.position.set(x, y, z); this.root.add(obj);
    };
    for (const { id, pos: { x, y: z } } of map.stations ?? []) {
      if (id === 'pod') { prop('Prop_HealthPack_Tube', x - 0.05, z, 1.8, 0.9); prop('Prop_Chair', x + 0.3, z + 0.15, 0.65, 0.35); }
      if (id === 'armory') for (const offset of [-0.24, 0.24]) prop('Prop_Locker', x + offset, z, 1.5, 0.44);
      if (id === 'suitlab') prop('Prop_Desk_L', x, z, 0.8);
      if (id === 'records') prop('Prop_Shelves_WideTall', x, z, 1.5);
      if (id === 'nav') { prop('Prop_Desk_Medium', x, z, 0.6); prop('Prop_SatelliteDish', x, z, 2, 1, 0.6); }
      if (id === 'core' || id === 'hatch') {
        const mesh = new THREE.Mesh(id === 'core' ? new THREE.CylinderGeometry(0.24, 0.34, 1.7, 6) : new THREE.TorusGeometry(0.4, 0.07, 8, 32),
          id === 'core' ? new THREE.MeshStandardMaterial({ color: '#70eeff', emissive: '#00cfff', emissiveIntensity: 2 }) : red);
        mesh.position.set(x, id === 'core' ? 0.85 : 0.08, z);
        if (id === 'hatch') mesh.rotation.x = -Math.PI / 2;
        this.root.add(mesh); this.owned.push(mesh);
      }
      const light = new THREE.PointLight('#b7eaff', 0, 4, 1.5);
      light.position.set(x, 2.5, z); this.root.add(light); this.lights.set(id, light);
      this.label(STATIONS[id], x, z);
    }
    // Small wall-top dressing never blocks a traversable cell.
    prop('Prop_Crate', 0, 3, 0.45, 0.5, 1.2);
    prop('Prop_Barrel2_Closed', 14, 7, 0.55, 0.5, 1.2);
    this.power(meta);
  }
  private label(text: string, x: number, z: number): void {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#091722dd'; ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#d4f5ff'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text, 128, 42);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }));
    sprite.position.set(x, 2.3, z); sprite.scale.set(1.8, 0.45, 1); this.root.add(sprite); this.labels.push(sprite);
  }
  power(meta: MetaState): void { for (const [id, light] of this.lights) light.intensity = stationLit(meta, id) ? 9 : 0; }
  shade(): void { /* Ship visibility is permanent. */ }
  openDoor(): void { /* No ship doors. */ }
  openChest(): void { /* No ship chests. */ }
  pulseExit(): void { /* The hatch is a station. */ }
  dispose(): void {
    const materials = new Set<THREE.Material>();
    for (const mesh of this.owned) { mesh.geometry.dispose(); materials.add(mesh.material as THREE.Material); }
    for (const mat of materials) mat.dispose();
    for (const s of this.labels) { s.material.map?.dispose(); s.material.dispose(); }
    for (const light of this.lights.values()) light.dispose();
  }
}

import * as THREE from 'three';
import type { Cell, GridState } from '../../sim/grid/types';
import type { Camp, Ground } from '../../sim/overworld/worldGen';
import { WorldFog } from './worldFog';
import { campProps, crashedShip, instanced, jitter, rocks, ruinWalls, trees, type CampView } from './worldProps';

/** what the world view needs beyond the grid state */
export interface WorldLook { ground: Ground[]; camps: Camp[]; base: Cell; claimed: Uint8Array }

const COLOR: Record<Ground, string> = {
  grass: '#557a38', forest: '#36522a', tree: '#33502a', rock: '#5e5a54', water: '#1e3f5e', ford: '#4f7486',
  dirt: '#7a6244', ruin: '#6a6256', ruinWall: '#5a544c', ship: '#4a5040', camp: '#6e5636',
};

/** The open land of the world map: ground coloured by what grows there, trees, rocks, a river, old ruins, the crashed ship and the goblin camps; fog of war over what the party has not seen. */
export class WorldTerrain {
  readonly root = new THREE.Group();
  private readonly fog: WorldFog;
  private readonly sun = new THREE.DirectionalLight('#fff0d8', 1.5);
  private readonly camps: CampView[] = [];
  private readonly beacon: THREE.PointLight;
  private clock = 0;

  constructor(private readonly w: number, private readonly h: number, private readonly look: WorldLook) {
    this.fog = new WorldFog(w, h);
    this.root.add(this.groundMesh(), this.water());
    const by = (g: Ground[]) => { const out: Cell[] = []; look.ground.forEach((k, i) => { if (g.includes(k)) out.push({ x: i % w, y: Math.floor(i / w) }); }); return out; };
    this.root.add(trees(by(['tree']), this.fog), rocks(by(['rock']), this.fog), ruinWalls(by(['ruinWall']), this.fog), this.tufts(by(['grass', 'forest'])));
    const ship = crashedShip(look.base, this.fog);
    this.beacon = ship.beacon;
    this.root.add(ship.root);
    for (const c of look.camps) { const cp = campProps(c, this.fog); this.camps.push(cp.view); this.root.add(cp.root); }
    this.sun.position.set(-18, 30, 12);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 90 });
    this.sun.shadow.bias = -0.0008;
    this.root.add(this.sun, this.sun.target);
  }

  /** One sheet for the whole land; each corner takes the average colour of the cells round it, so kinds of ground blend at their edges. */
  private groundMesh(): THREE.Mesh {
    const { w, h } = this;
    const geo = new THREE.PlaneGeometry(w, h, w, h);
    geo.rotateX(-Math.PI / 2);
    geo.translate(w / 2 - 0.5, 0, h / 2 - 0.5);
    const pos = geo.attributes.position!, colors = new Float32Array(pos.count * 3);
    const cell = (x: number, y: number) => this.look.ground[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))]!;
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      // vertex at a cell corner: the four cells meeting there
      const vx = Math.round(pos.getX(i) + 0.5), vy = Math.round(pos.getZ(i) + 0.5);
      const around = [cell(vx - 1, vy - 1), cell(vx, vy - 1), cell(vx - 1, vy), cell(vx, vy)];
      let r = 0, g = 0, b = 0;
      for (const k of around) { tmp.set(COLOR[k]); r += tmp.r; g += tmp.g; b += tmp.b; }
      const n = 0.92 + jitter(vx, vy, 7) * 0.16;
      colors.set([(r / 4) * n, (g / 4) * n, (b / 4) * n], i * 3);
      if (around.every((k) => k === 'water')) pos.setY(i, -0.35);
      else if (around.some((k) => k === 'water')) pos.setY(i, -0.15);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.fog.apply(new THREE.MeshLambertMaterial({ vertexColors: true }), true));
    mesh.receiveShadow = true;
    return mesh;
  }

  /** A still sheet of water over the river bed. */
  private water(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(this.w, this.h);
    geo.rotateX(-Math.PI / 2);
    geo.translate(this.w / 2 - 0.5, -0.12, this.h / 2 - 0.5);
    return new THREE.Mesh(geo, this.fog.apply(new THREE.MeshLambertMaterial({ color: '#2f6a9a', transparent: true, opacity: 0.55 })));
  }

  /** Little tufts of grass so the open ground is not flat colour. */
  private tufts(cells: Cell[]): THREE.InstancedMesh {
    const items: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    for (const c of cells) {
      if (jitter(c.x, c.y, 30) > 0.35) continue;
      const s = 0.5 + jitter(c.x, c.y, 31) * 0.6;
      items.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(c.x + (jitter(c.x, c.y, 32) - 0.5) * 0.8, 0.12 * s, c.y + (jitter(c.x, c.y, 33) - 0.5) * 0.8), new THREE.Quaternion(), new THREE.Vector3(s, s, s)), c: new THREE.Color().setHSL(0.25, 0.45, 0.28 + jitter(c.x, c.y, 34) * 0.1) });
    }
    return instanced(new THREE.ConeGeometry(0.12, 0.3, 4), this.fog, items, false);
  }

  shade(s: GridState): void {
    this.fog.update(s.visible, s.seen, this.look.claimed);
    // a cleared camp: the fire is out and the banner taken down
    for (const v of this.camps) {
      v.fire.visible = !v.camp.cleared;
      v.flame.visible = !v.camp.cleared;
      v.flag.visible = !v.camp.cleared;
    }
  }

  /** The sun's shadow box follows the view; fires flicker; the ship's beacon pulses. */
  update(dt: number, center: THREE.Vector3): void {
    this.clock += dt;
    this.sun.position.set(center.x - 18, 30, center.z + 12);
    this.sun.target.position.set(center.x, 0, center.z);
    for (const v of this.camps) v.fire.intensity = 4.5 + Math.sin(this.clock * 13 + v.camp.id) * 0.8 + Math.sin(this.clock * 7.3) * 0.5;
    this.beacon.intensity = 4 + Math.sin(this.clock * 2.2) * 2.5;
  }

  syncTiles(): void { /* nothing opens or breaks on the world map yet */ }
  openDoor(): void { /* no doors */ }
  openChest(): void { /* no chests yet */ }
  pulseExit(): void { /* no exits */ }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); }
    });
    this.fog.dispose();
  }
}

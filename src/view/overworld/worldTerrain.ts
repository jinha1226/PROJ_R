import * as THREE from 'three';
import type { Cell, GridState } from '../../sim/grid/types';
import type { Camp, Ground, LandLight, Soul } from '../../sim/overworld/worldGen';
import { WorldFog } from './worldFog';
import { campProps, crashedShip, instanced, jitter, rocks, ruinWalls, trees, type CampView } from './worldProps';
import { coverProps } from './worldCover';
import { WorldLights } from './worldLights';
import { EmberCracks } from './emberCracks';

/** what the world view needs beyond the grid state */
export interface WorldLook { ground: Ground[]; camps: Camp[]; base: Cell; claimed: Uint8Array; souls: Soul[]; lights: LandLight[] }

const COLOR: Record<Ground, string> = {
  grass: '#4a6a32', forest: '#2e4624', tree: '#2c4424', rock: '#4e4a46', water: '#16324c', ford: '#3e5e6e',
  dirt: '#7a6244', ruin: '#6a6256', ruinWall: '#5a544c', ship: '#4a5040', camp: '#6e5636',
  boulder: '#557a38', log: '#3c5a2c', lowWall: '#5e5a4e', barricade: '#6e5636', wreck: '#2e2420', totem: '#5a3a2a', obelisk: '#2a1c22', brazier: '#6a6256',
};
/** the light each kind of land light gives */
const LAND_LIGHT: Record<LandLight['kind'], { color: string; power: number; range: number; y: number; flicker: number }> = {
  wreck: { color: '#ff8a3a', power: 10, range: 9, y: 1, flicker: 0.25 },
  brazier: { color: '#5aff9a', power: 9, range: 9, y: 1.1, flicker: 0.15 },
  obelisk: { color: '#ff2a48', power: 12, range: 11, y: 2.4, flicker: 0.08 },
};

/** The open land of the world map: ground coloured by what grows there, trees, rocks, a river, old ruins, the crashed ship and the goblin camps; fog of war over what the party has not seen. */
export class WorldTerrain {
  readonly root = new THREE.Group();
  private readonly fog: WorldFog;
  /** pale moonlight: the world under the demon army is dark, lit mostly by its fires */
  private readonly sun = new THREE.DirectionalLight('#9aaeff', 0.75);
  private readonly lights = new WorldLights();
  private readonly camps: CampView[] = [];
  /** soul stones on the ground: a floating crystal and its glow each */
  private readonly stones: { soul: Soul; root: THREE.Group; gem: THREE.Mesh }[] = [];
  private clock = 0;
  private seen?: Uint8Array;
  private readonly cracks: EmberCracks;

  constructor(private readonly w: number, private readonly h: number, private readonly look: WorldLook) {
    this.fog = new WorldFog(w, h);
    this.root.add(this.groundMesh(), this.water());
    const by = (g: Ground[]) => { const out: Cell[] = []; look.ground.forEach((k, i) => { if (g.includes(k)) out.push({ x: i % w, y: Math.floor(i / w) }); }); return out; };
    this.root.add(trees(by(['tree']), this.fog), rocks(by(['rock']), this.fog), ruinWalls(by(['ruinWall']), this.fog), this.tufts(by(['grass', 'forest'])));
    this.cracks = new EmberCracks(look, w, this.fog);
    this.root.add(crashedShip(look.base, this.fog), coverProps(look.ground, w, this.fog), this.lights.root, this.cracks.mesh);
    for (const c of look.camps) { const cp = campProps(c, this.fog); this.camps.push(cp.view); this.root.add(cp.root); }
    this.spots();
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

  /** Every light on the land, for the pool to pick from: the ship, camp fires and totems (until taken; then our beacon), wrecks, braziers, obelisks, souls. */
  private spots(): void {
    const L = this.lights, b = this.look.base;
    L.add({ at: { x: b.x - 3, y: b.y }, y: 2.4, color: '#5ae0ff', power: 7, range: 10, flicker: 0.05, on: () => true });
    L.add({ at: { x: b.x + 1, y: b.y + 2 }, y: 1.4, color: '#9fe8ff', power: 4, range: 7, flicker: 0, on: () => true });
    for (const c of this.look.camps) {
      L.add({ at: c.pos, y: 0.8, color: '#ff9040', power: 9, range: 9, flicker: 0.2, on: () => !c.cleared });
      L.add({ at: c.totem, y: 1.6, color: '#ff2a2a', power: 4, range: 5, flicker: 0.1, on: () => !c.cleared });
      L.add({ at: c.pos, y: 2.2, color: '#5ae0ff', power: 5, range: 8, flicker: 0.03, on: () => c.cleared });
    }
    for (const l of this.look.lights) L.add({ at: l.pos, ...LAND_LIGHT[l.kind], on: () => true });
  }

  /** A soul stone: a violet-white crystal turning above the grass, lighting the ground round it. */
  private stone(soul: Soul): void {
    const root = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: '#d8c8ff' }));
    gem.scale.set(1, 1.6, 1);
    root.add(gem);
    this.lights.add({ at: soul.pos, y: 0.7, color: '#b49aff', power: 3.5, range: 4.5, flicker: 0.05, on: () => !soul.taken });
    root.position.set(soul.pos.x, 0, soul.pos.y);
    this.root.add(root);
    this.stones.push({ soul, root, gem });
  }

  shade(s: GridState): void {
    this.fog.update(s.visible, s.seen, this.look.claimed);
    // souls dropped by fallen clones join the ones the land began with
    while (this.stones.length < this.look.souls.length) this.stone(this.look.souls[this.stones.length]!);
    for (const st of this.stones) st.root.visible = !st.soul.taken && s.seen[st.soul.pos.y * this.w + st.soul.pos.x] === 1;
    // a cleared camp: the fire is out and the banner taken down
    for (const v of this.camps) for (const m of [v.flame, v.flag, v.eye]) m.visible = !v.camp.cleared;
    this.seen = s.seen;
    this.cracks.shade();
  }

  /** The sun's shadow box follows the view; fires flicker; the ship's beacon pulses. */
  update(dt: number, center: THREE.Vector3): void {
    this.clock += dt;
    this.sun.position.set(center.x - 18, 30, center.z + 12);
    this.sun.target.position.set(center.x, 0, center.z);
    this.lights.update(dt, center, (c) => this.seen?.[c.y * this.w + c.x] === 1);
    for (const st of this.stones) { st.gem.position.y = 0.75 + Math.sin(this.clock * 2 + st.soul.id) * 0.12; st.gem.rotation.y = this.clock * 1.4 + st.soul.id; }
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

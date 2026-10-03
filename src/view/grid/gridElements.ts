import * as THREE from 'three';
import { idx, same, type GridState } from '../../sim/grid/types';
import type { DungeonKit } from './dungeonKit';
import { CELL, toWorld } from './gridTerrain';

const FLAME = new THREE.MeshBasicMaterial({ color: '#ff8a2a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
const CLOUD = new THREE.MeshBasicMaterial({ color: '#7ad04a', transparent: true, opacity: 0.32, depthWrite: false });
const MARK: Record<string, string> = { fire: '#ff4a2a', frost: '#5ab4ff', whirl: '#ff2a2a' };

/** Things on the floor that come and go: burning ground, poison clouds, marked spell areas, barrels and the stairs. */
export class GridElements {
  readonly root = new THREE.Group();
  private readonly tiles = new THREE.Group();
  private readonly marks = new THREE.Group();
  private readonly barrels = new Map<string, THREE.Object3D>();
  private stairs: THREE.Object3D | null = null;
  private tileKey = '';
  private markKey = '';
  private t = 0;

  constructor(private readonly kit: DungeonKit, s: GridState) {
    this.root.add(this.tiles, this.marks);
    for (const b of s.barrels) {
      const o = kit.clone('Barrel', { width: CELL * 0.6 });
      o.position.copy(toWorld(b.x, b.y));
      o.visible = false;
      this.barrels.set(`${b.x},${b.y}`, o);
      this.root.add(o);
    }
    const st = s.map.stairs;
    if (st) {
      const g = new THREE.Group();
      const pit = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 0.8, CELL * 0.8), new THREE.MeshBasicMaterial({ color: '#050404' }));
      pit.rotation.x = -Math.PI / 2;
      pit.position.y = 0.02;
      const ring = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.42, CELL * 0.5, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: '#ffb84a', transparent: true, opacity: 0.8 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      const steps = kit.clone('Stairs_Modular', { width: CELL * 0.7 });
      steps.position.y = -0.55;
      g.add(pit, steps, ring);
      g.position.copy(toWorld(st.x, st.y));
      g.visible = false;
      this.stairs = g;
      this.root.add(g);
    }
  }

  sync(s: GridState): void {
    for (const [k, o] of this.barrels) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      const there = s.barrels.some((b) => b.x === x && b.y === y);
      if (!there) { this.root.remove(o); this.barrels.delete(k); continue; }
      o.visible = s.seen[idx(s.map, { x, y })] === 1;
    }
    if (this.stairs && s.map.stairs) this.stairs.visible = s.seen[idx(s.map, s.map.stairs)] === 1;
    const tileKey = JSON.stringify(s.tiles.map((x) => [x.pos, x.kind]));
    if (tileKey !== this.tileKey) {
      this.tileKey = tileKey;
      this.tiles.clear();
      for (const x of s.tiles) {
        const g = new THREE.Group();
        if (x.kind === 'fire') {
          for (let i = 0; i < 3; i++) {
            const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 5), FLAME);
            f.position.set((i - 1) * 0.22, 0.2, ((i * 37) % 3 - 1) * 0.18);
            g.add(f);
          }
        } else {
          const c = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.95, 0.5, CELL * 0.95), CLOUD);
          c.position.y = 0.25;
          g.add(c);
        }
        g.position.copy(toWorld(x.pos.x, x.pos.y));
        g.userData.cell = idx(s.map, x.pos);
        this.tiles.add(g);
      }
    }
    for (const g of this.tiles.children) g.visible = s.visible.has(g.userData.cell as number);
    const markKey = JSON.stringify(s.telegraphs.map((x) => [x.cells, x.kind, x.el]));
    if (markKey !== this.markKey) {
      this.markKey = markKey;
      this.marks.clear();
      for (const tg of s.telegraphs) for (const c of tg.cells) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 0.92, CELL * 0.92), new THREE.MeshBasicMaterial({ color: MARK[tg.kind === 'whirl' ? 'whirl' : tg.el ?? 'fire'], transparent: true, opacity: 0.4, depthWrite: false }));
        m.rotation.x = -Math.PI / 2;
        m.position.copy(toWorld(c.x, c.y)).setY(0.04);
        m.userData.cell = idx(s.map, c);
        this.marks.add(m);
      }
    }
    for (const m of this.marks.children) m.visible = s.seen[m.userData.cell as number] === 1;
  }

  /** Is there a barrel at a grid cell (for tap-to-shoot)? */
  barrelAt(s: GridState, x: number, y: number): boolean {
    return s.barrels.some((b) => same(b, { x, y }));
  }

  update(dt: number): void {
    this.t += dt;
    let i = 0;
    for (const g of this.tiles.children) for (const f of g.children) f.scale.set(1, 1 + Math.sin(this.t * 12 + i++) * 0.25, 1);
    const pulse = 0.3 + (Math.sin(this.t * 8) + 1) * 0.15;
    for (const m of this.marks.children) ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = pulse;
    if (this.stairs) this.stairs.children[2]!.rotation.z = this.t * 0.6;
  }

  dispose(): void {
    this.tiles.clear();
    this.marks.clear();
  }
}

import * as THREE from 'three';
import { idx, same, type GridState } from '../../sim/grid/types';
import type { DungeonKit } from './dungeonKit';
import { CELL, toWorld } from './gridTerrain';

const FLAME = new THREE.MeshBasicMaterial({ color: '#ff8a2a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
const CLOUD = new THREE.MeshBasicMaterial({ color: '#7ad04a', transparent: true, opacity: 0.32, depthWrite: false });
const STEAM = new THREE.MeshBasicMaterial({ color: '#e8eef4', transparent: true, opacity: 0.55, depthWrite: false });
const TRAP_HEX: Record<string, string> = { alarm: '#ffd23a', poison: '#7ad04a', fire: '#ff6a2a', net: '#c8b090' };
const plate = (color: string): THREE.Object3D => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 0.6, CELL * 0.6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
};
const MARK: Record<string, string> = { fire: '#ff4a2a', frost: '#5ab4ff', whirl: '#ff2a2a' };

/** Things on the floor that come and go: burning ground, poison clouds, marked spell areas, barrels and the stairs. */
export class GridElements {
  readonly root = new THREE.Group();
  private readonly tiles = new THREE.Group();
  private readonly marks = new THREE.Group();
  private readonly aim = new THREE.Group();
  private readonly reach = new THREE.Group();
  /** the hovered walk: a dotted trail and a framed end cell */
  private readonly path = new THREE.Group();
  private readonly pathDot = new THREE.MeshBasicMaterial({ color: '#c8ffd8', transparent: true, opacity: 0.75, depthWrite: false });
  private readonly pathEnd = new THREE.MeshBasicMaterial({ color: '#5dff8a', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  private pathKey = '';
  private readonly barrels = new Map<string, THREE.Object3D>();
  private stairs: THREE.Object3D | null = null;
  private readonly traps = new THREE.Group();
  private trapKey = '';
  private tileKey = '';
  private markKey = '';
  private t = 0;

  constructor(private readonly kit: DungeonKit, s: GridState) {
    this.root.add(this.tiles, this.marks, this.aim, this.reach, this.traps, this.path);
    for (const b of s.barrels) {
      const o = kit.clone('Barrel', { width: CELL * 0.6 });
      o.position.copy(toWorld(b.x, b.y));
      o.visible = false;
      this.barrels.set(`${b.x},${b.y}`, o);
      this.root.add(o);
    }
    this.buildStairs(s);
  }

  private buildStairs(s: GridState): void {
    const st = s.map.stairs;
    if (st) {
      const g = new THREE.Group();
      const pit = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 0.8, CELL * 0.8), new THREE.MeshBasicMaterial({ color: '#050404' }));
      pit.rotation.x = -Math.PI / 2;
      pit.position.y = 0.02;
      const ring = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.42, CELL * 0.5, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: '#ffb84a', transparent: true, opacity: 0.8 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      const steps = this.kit.clone('Stairs_Modular', { width: CELL * 0.7 });
      steps.position.y = -0.55;
      g.add(pit, steps, ring);
      g.position.copy(toWorld(st.x, st.y));
      g.visible = false;
      this.stairs = g;
      this.root.add(g);
    }
  }

  sync(s: GridState): void {
    if (s.map.stairs && !this.stairs) this.buildStairs(s);
    for (const [k, o] of this.barrels) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      const there = s.barrels.some((b) => b.x === x && b.y === y);
      if (!there) { this.root.remove(o); this.barrels.delete(k); continue; }
      o.visible = s.seen[idx(s.map, { x, y })] === 1;
    }
    if (this.stairs && s.map.stairs) this.stairs.visible = s.seen[idx(s.map, s.map.stairs)] === 1;
    this.syncTraps(s);
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
          // steam is a tall white wall of vapour (it blocks sight); poison a low green cloud
          const steam = x.kind === 'steam';
          const c = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.95, steam ? 1.6 : 0.5, CELL * 0.95), steam ? STEAM : CLOUD);
          c.position.y = steam ? 0.8 : 0.25;
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

  /** Throw preview: the covered cells, green when it can land there, red when not; null clears it. */
  private aimKey = '';
  setAim(cells: { x: number; y: number }[] | null, ok: boolean): void {
    // the same marks again (most frames): nothing is rebuilt
    const key = cells?.length ? `${ok}${cells.map((c) => `${c.x},${c.y}`).join(';')}` : '';
    if (key === this.aimKey) return;
    this.aimKey = key;
    for (const o of this.aim.children) { (o as THREE.Mesh).geometry.dispose(); ((o as THREE.Mesh).material as THREE.Material).dispose(); }
    this.aim.clear();
    for (const c of cells ?? []) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 0.9, CELL * 0.9), new THREE.MeshBasicMaterial({ color: ok ? '#7ae08a' : '#e05a4a', transparent: true, opacity: 0.45, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.copy(toWorld(c.x, c.y)).setY(0.05);
      this.aim.add(m);
    }
  }

  private reachKey = '';
  /** A square drawn on the ground round a cell: how far something there reaches (null hides it). */
  setReach(c: { x: number; y: number } | null, r: number, color = '#5ae0ff'): void {
    const key = c ? `${c.x},${c.y},${r},${color}` : '';
    if (key === this.reachKey) return;
    this.reachKey = key;
    for (const o of this.reach.children) { (o as THREE.Mesh).geometry.dispose(); ((o as THREE.Mesh).material as THREE.Material).dispose(); }
    this.reach.clear();
    if (!c) return;
    const side = (2 * r + 1) * CELL, w = CELL * 0.14, at = toWorld(c.x, c.y);
    for (const [dx, dz, lx, lz] of [[0, -side / 2, side, w], [0, side / 2, side, w], [-side / 2, 0, w, side], [side / 2, 0, w, side]] as const) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(lx, lz).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
      m.position.set(at.x + dx, 0.07, at.z + dz); m.renderOrder = 5;
      this.reach.add(m);
    }
  }

  /** Shows where a click would walk: a small round dot on every step and a thin ring on the last cell (null hides it). A single step shows nothing: the clone is already on its way there. */
  setPath(cells: { x: number; y: number }[] | null): void {
    const key = cells ? cells.map((c) => `${c.x},${c.y}`).join(';') : '';
    if (key === this.pathKey) return;
    this.pathKey = key;
    for (const o of this.path.children) (o as THREE.Mesh).geometry.dispose();
    this.path.clear();
    if (!cells || cells.length < 2) return;
    cells.forEach((c, i) => {
      const last = i === cells.length - 1;
      const geo = last ? new THREE.RingGeometry(CELL * 0.2, CELL * 0.25, 24).rotateX(-Math.PI / 2) : new THREE.CircleGeometry(CELL * 0.045, 10).rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, last ? this.pathEnd : this.pathDot);
      m.position.copy(toWorld(c.x, c.y)).setY(0.06);
      m.renderOrder = 5;
      this.path.add(m);
    });
  }

  /** Is there a barrel at a grid cell (for tap-to-shoot)? */
  /** Traps once found: spikes and a trapdoor from the kit, the rest a coloured plate. */
  private syncTraps(s: GridState): void {
    const found = s.traps.filter((t) => t.found);
    const key = JSON.stringify(found.map((t) => [t.pos, t.kind]));
    if (key === this.trapKey) return;
    this.trapKey = key;
    this.traps.clear();
    for (const t of found) {
      const o = t.kind === 'spike' ? this.kit.clone('Trap_spikes', { width: CELL * 0.8 }) : t.kind === 'teleport' ? this.kit.clone('Trapdoor', { width: CELL * 0.8 }) : plate(TRAP_HEX[t.kind]!);
      o.position.copy(toWorld(t.pos.x, t.pos.y));
      o.position.y += 0.02;
      this.traps.add(o);
    }
  }

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

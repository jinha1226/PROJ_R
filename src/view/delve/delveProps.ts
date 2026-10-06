import * as THREE from 'three';
import type { Cell } from '../../sim/grid/types';
import type { DelveParty } from '../../sim/delve/delveSim';

const SOUL_LIGHTS = 3;

/**
 * What a dungeon floor holds beyond walls and chests: soul stones (violet; a hero's gold), the shrine (a pale flame until used),
 * gear lying on the floor (a glint), and the general's slam about to land (a red ring on the floor). Only what the party has seen shows.
 */
export class DelveProps {
  readonly root = new THREE.Group();
  private readonly souls = new Map<number, THREE.Group>();
  private readonly items: THREE.Mesh[] = [];
  private shrine?: { root: THREE.Group; flame: THREE.Mesh; light: THREE.PointLight };
  private readonly soulLights: THREE.PointLight[] = [];
  private readonly slams: { ring: THREE.Mesh; left: number }[] = [];
  private clock = 0;

  constructor(private readonly p: () => DelveParty) {
    for (let i = 0; i < SOUL_LIGHTS; i++) { const l = new THREE.PointLight('#b49aff', 0, 4.5, 1.8); this.soulLights.push(l); this.root.add(l); }
    const sh = p().shrine;
    if (sh) this.shrine = this.altar(sh.pos);
  }

  private altar(at: Cell): { root: THREE.Group; flame: THREE.Mesh; light: THREE.PointLight } {
    const root = new THREE.Group();
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.7, 8), new THREE.MeshLambertMaterial({ color: '#5a5650' }));
    stone.position.y = 0.35;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 8), new THREE.MeshBasicMaterial({ color: '#d8fff0' }));
    flame.position.y = 0.95;
    const light = new THREE.PointLight('#a8ffd8', 5, 6, 1.7);
    light.position.y = 1.2;
    root.add(stone, flame, light);
    root.position.set(at.x, 0, at.y);
    this.root.add(root);
    return { root, flame, light };
  }

  private crystal(gold: boolean): THREE.Group {
    const g = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), new THREE.MeshBasicMaterial({ color: gold ? '#ffe08a' : '#d8c8ff' }));
    gem.scale.set(1, 1.6, 1);
    g.add(gem);
    this.root.add(g);
    return g;
  }

  /** The general winds up: a red ring of its reach on the floor, fading as the blow nears. */
  slam(at: Cell, radius: number): void {
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2 + 1, radius * 2 + 1), new THREE.MeshBasicMaterial({ color: '#ff3020', transparent: true, opacity: 0.35, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(at.x, 0.03, at.y);
    this.root.add(ring);
    this.slams.push({ ring, left: 1.5 });
  }

  update(dt: number): void {
    const p = this.p(), seen = (c: Cell) => p.s.seen[c.y * p.s.map.w + c.x] === 1;
    this.clock += dt;
    // souls: one crystal each while untaken and seen; the nearest few lit
    let lit = 0;
    for (const s of p.souls) {
      let g = this.souls.get(s.id);
      if (!g) { g = this.crystal(!!s.hero); g.position.set(s.pos.x, 0, s.pos.y); this.souls.set(s.id, g); }
      g.visible = !s.taken && seen(s.pos);
      const gem = g.children[0]!;
      gem.position.y = 0.75 + Math.sin(this.clock * 2 + s.id) * 0.12;
      gem.rotation.y = this.clock * 1.4 + s.id;
      if (g.visible && lit < SOUL_LIGHTS) { const l = this.soulLights[lit++]!; l.intensity = 3.5; l.color.set(s.hero ? '#ffd27a' : '#b49aff'); l.position.set(s.pos.x, 0.8, s.pos.y); }
    }
    for (let i = lit; i < SOUL_LIGHTS; i++) this.soulLights[i]!.intensity = 0;
    // gear on the floor: a small golden glint per item
    while (this.items.length < p.floorItems.length) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.18), new THREE.MeshBasicMaterial({ color: '#ffd76a' }));
      this.root.add(m);
      this.items.push(m);
    }
    this.items.forEach((m, i) => {
      const it = p.floorItems[i];
      m.visible = !!it && seen(it.pos);
      if (!it) return;
      m.position.set(it.pos.x + ((i % 3) - 1) * 0.15, 0.08 + Math.abs(Math.sin(this.clock * 3 + i)) * 0.06, it.pos.y);
      m.rotation.y = this.clock + i;
    });
    if (this.shrine && p.shrine) {
      const on = !p.shrine.used;
      this.shrine.root.visible = seen(p.shrine.pos);
      this.shrine.flame.visible = on;
      this.shrine.light.intensity = on ? 4.5 + Math.sin(this.clock * 6) * 0.6 : 0;
    }
    for (let i = this.slams.length - 1; i >= 0; i--) {
      const s = this.slams[i]!;
      s.left -= dt;
      (s.ring.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.2 * Math.abs(Math.sin(this.clock * 10));
      if (s.left <= 0) { this.root.remove(s.ring); s.ring.geometry.dispose(); this.slams.splice(i, 1); }
    }
  }

  dispose(): void {
    this.root.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
  }
}

import * as THREE from 'three';
import {
  BatchedRenderer, Bezier, ConeEmitter, ConstantColor, ConstantValue, Gradient, IntervalValue, ParticleSystem, PiecewiseBezier,
  PointEmitter, RenderMode, ColorOverLife, SizeOverLife, SphereEmitter, ApplyForce, RotationOverLife, Vector3 as QVec3, Vector4,
} from 'three.quarks';

/** Tiles of `assets/fx-atlas.png` (Kenney Particle Pack, CC0), four by four. */
export const TILE = {
  glow: 0, ring: 1, star: 2, sparkle: 3, streak: 4, flame: 5, burst: 6, puff: 7,
  smokeRing: 8, scorch: 9, slash: 10, twirl: 11, magicStar: 12, rune: 13, bolt: 14, dirt: 15,
} as const;
type Tile = keyof typeof TILE;

/** One emitter of an effect: what it shows, how many, how they move, and the two colours it fades between. */
export interface Layer {
  tile: Tile;
  count: [number, number];
  life: [number, number];
  speed: [number, number];
  size: [number, number];
  colors: [string, string];
  /** 'up' sprays in a cone upward, 'out' in a sphere, 'none' stays put */
  spread?: 'up' | 'out' | 'none';
  radius?: number;
  /** flat on the floor (rings, runes) or stretched along its flight (sparks) */
  mode?: 'flat' | 'streak';
  /** size over life: 'grow' swells out, default shrinks away */
  grow?: boolean;
  /** smoke and dust are drawn over, light is added */
  solid?: boolean;
  /** pull per second (positive falls, negative rises) */
  gravity?: number;
  spin?: number;
  /** height above the floor it starts at */
  y?: number;
  /** takes the colour the caller passes (a hit's side, a trap's element) */
  tinted?: boolean;
}

export type VfxKind = 'hit' | 'crit' | 'blast' | 'frost' | 'shock' | 'heal' | 'shield' | 'magic' | 'smoke' | 'warn' | 'dust' | 'soul';

const L = (l: Layer): Layer => l;
/** Effects as layers: short, chunky and readable from above, like the low-poly figures they land on. */
export const PRESETS: Record<VfxKind, Layer[]> = {
  hit: [
    L({ tile: 'star', count: [1, 1], life: [0.12, 0.12], speed: [0, 0], size: [0.9, 1.1], colors: ['#e8d8b0', '#a07840'], spread: 'none', y: 1.0, grow: true }),
    L({ tile: 'sparkle', count: [5, 7], life: [0.16, 0.28], speed: [3, 5], size: [0.22, 0.32], colors: ['#ffe6a8', '#ff9a40'], spread: 'out', y: 1.0, gravity: 6, tinted: true }),
  ],
  crit: [
    L({ tile: 'star', count: [1, 1], life: [0.16, 0.16], speed: [0, 0], size: [1.6, 1.8], colors: ['#fff0c0', '#c08030'], spread: 'none', y: 1.0, grow: true }),
    L({ tile: 'sparkle', count: [10, 12], life: [0.2, 0.36], speed: [4, 7], size: [0.28, 0.4], colors: ['#fff0b0', '#ff7a30'], spread: 'out', y: 1.0, gravity: 6, tinted: true }),
    L({ tile: 'ring', count: [1, 1], life: [0.25, 0.25], speed: [0, 0], size: [0.9, 0.9], colors: ['#ffe6a8', '#ff9a40'], spread: 'none', mode: 'flat', y: 0.05, grow: true }),
  ],
  blast: [
    L({ tile: 'scorch', count: [1, 1], life: [0.28, 0.28], speed: [0, 0], size: [1.8, 2.0], colors: ['#fff0a0', '#ff5a1a'], spread: 'none', y: 0.7, grow: true }),
    L({ tile: 'burst', count: [8, 10], life: [0.35, 0.6], speed: [1.5, 3.5], size: [0.7, 1.1], colors: ['#ffd060', '#c8300a'], spread: 'out', radius: 0.3, y: 0.6, gravity: -2, spin: 3 }),
    L({ tile: 'puff', count: [5, 6], life: [0.8, 1.2], speed: [0.5, 1.2], size: [0.7, 1.0], colors: ['#6a5e54', '#3a3430'], spread: 'up', radius: 0.4, y: 0.4, solid: true, grow: true, gravity: -1.2, spin: 1 }),
    L({ tile: 'ring', count: [1, 1], life: [0.35, 0.35], speed: [0, 0], size: [1.2, 1.2], colors: ['#ffb040', '#ff4a10'], spread: 'none', mode: 'flat', y: 0.05, grow: true }),
  ],
  frost: [
    L({ tile: 'glow', count: [1, 1], life: [0.3, 0.3], speed: [0, 0], size: [1.3, 1.5], colors: ['#5aa8e0', '#1a4a80'], spread: 'none', y: 0.8 }),
    L({ tile: 'sparkle', count: [10, 12], life: [0.4, 0.7], speed: [1.5, 3], size: [0.3, 0.45], colors: ['#ffffff', '#7ac8ff'], spread: 'out', y: 0.8, gravity: 3, spin: 4 }),
    L({ tile: 'ring', count: [1, 1], life: [0.4, 0.4], speed: [0, 0], size: [1.0, 1.0], colors: ['#bfe8ff', '#3a8aff'], spread: 'none', mode: 'flat', y: 0.05, grow: true }),
  ],
  shock: [
    L({ tile: 'bolt', count: [3, 4], life: [0.1, 0.18], speed: [0, 0.4], size: [1.0, 1.4], colors: ['#ffffff', '#ffe85a'], spread: 'out', radius: 0.35, y: 0.9, spin: 0 }),
    L({ tile: 'glow', count: [1, 1], life: [0.2, 0.2], speed: [0, 0], size: [1.3, 1.3], colors: ['#c8b040', '#806010'], spread: 'none', y: 0.9 }),
  ],
  heal: [
    L({ tile: 'sparkle', count: [8, 10], life: [0.7, 1.0], speed: [0.6, 1.3], size: [0.25, 0.4], colors: ['#e8ffd8', '#5ad06a'], spread: 'up', radius: 0.35, y: 0.3, gravity: -0.8 }),
    L({ tile: 'ring', count: [1, 1], life: [0.5, 0.5], speed: [0, 0], size: [1.0, 1.0], colors: ['#b8ffb0', '#3aa04a'], spread: 'none', mode: 'flat', y: 0.05, grow: true }),
  ],
  shield: [
    L({ tile: 'rune', count: [1, 1], life: [0.7, 0.7], speed: [0, 0], size: [1.5, 1.5], colors: ['#c8f0ff', '#3ab0ff'], spread: 'none', mode: 'flat', y: 0.06, spin: 2 }),
    L({ tile: 'glow', count: [1, 1], life: [0.35, 0.35], speed: [0, 0], size: [1.3, 1.3], colors: ['#3a8ac0', '#103050'], spread: 'none', y: 0.9 }),
  ],
  magic: [
    L({ tile: 'magicStar', count: [1, 1], life: [0.3, 0.3], speed: [0, 0], size: [1.2, 1.3], colors: ['#f0e0ff', '#a070ff'], spread: 'none', y: 0.9, spin: 3, tinted: true }),
    L({ tile: 'sparkle', count: [8, 10], life: [0.4, 0.7], speed: [1, 2.2], size: [0.2, 0.35], colors: ['#ffffff', '#b48aff'], spread: 'out', y: 0.9, gravity: -1, tinted: true }),
  ],
  smoke: [
    L({ tile: 'puff', count: [6, 8], life: [0.9, 1.4], speed: [0.4, 1.0], size: [0.8, 1.2], colors: ['#e8eef4', '#a8b0b8'], spread: 'up', radius: 0.5, y: 0.3, solid: true, grow: true, gravity: -0.8, spin: 0.8, tinted: true }),
  ],
  warn: [
    L({ tile: 'ring', count: [1, 1], life: [0.45, 0.45], speed: [0, 0], size: [1.0, 1.0], colors: ['#ff6a4a', '#ff2a10'], spread: 'none', mode: 'flat', y: 0.05, grow: true, tinted: true }),
  ],
  // a soul settling into a body: a gold rune underfoot, sparks spiralling up round it, a warm glow at the heart
  soul: [
    L({ tile: 'rune', count: [1, 1], life: [1.2, 1.2], speed: [0, 0], size: [1.4, 1.4], colors: ['#ffe8a0', '#c08030'], spread: 'none', mode: 'flat', y: 0.06, spin: 2.5, grow: true }),
    L({ tile: 'sparkle', count: [16, 20], life: [0.8, 1.2], speed: [0.8, 1.6], size: [0.22, 0.36], colors: ['#fff0b0', '#b48aff'], spread: 'up', radius: 0.55, y: 0.1, gravity: -1.4, spin: 3 }),
    L({ tile: 'glow', count: [1, 1], life: [0.9, 0.9], speed: [0, 0], size: [1.5, 1.7], colors: ['#c8a040', '#402a10'], spread: 'none', y: 0.9 }),
  ],
  dust: [
    L({ tile: 'puff', count: [3, 4], life: [0.4, 0.6], speed: [0.4, 0.9], size: [0.35, 0.55], colors: ['#b8a890', '#8a7a68'], spread: 'up', radius: 0.2, y: 0.1, solid: true, grow: true, spin: 1, tinted: true }),
  ],
};

/** How many of one effect can play at once before the oldest is reused. */
const POOL = 4;
const v3 = (hex: string): QVec3 => { const c = new THREE.Color(hex); return new QVec3(c.r, c.g, c.b); };

/** Particle effects drawn in one batch (three.quarks): fire one by kind at a floor position, optionally recoloured. */
export class Vfx {
  readonly root = new THREE.Group();
  private readonly batch = new BatchedRenderer();
  private readonly pools = new Map<VfxKind, { systems: ParticleSystem[]; layers: Layer[] }[]>();
  private readonly next = new Map<VfxKind, number>();
  private readonly mats: THREE.Material[] = [];

  constructor(atlas: THREE.Texture) {
    this.root.add(this.batch);
    const glow = new THREE.MeshBasicMaterial({ map: atlas, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const solid = new THREE.MeshBasicMaterial({ map: atlas, transparent: true, blending: THREE.NormalBlending, depthWrite: false });
    this.mats.push(glow, solid);
    for (const kind of Object.keys(PRESETS) as VfxKind[]) {
      const pool = [];
      for (let i = 0; i < POOL; i++) {
        const layers = PRESETS[kind];
        pool.push({ layers, systems: layers.map((l) => this.system(l, l.solid ? solid : glow)) });
      }
      this.pools.set(kind, pool);
    }
  }

  static async load(baseUrl: string): Promise<Vfx> {
    const tex = await new THREE.TextureLoader().loadAsync(`${baseUrl}assets/fx-atlas.png`);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new Vfx(tex);
  }

  private system(l: Layer, material: THREE.Material): ParticleSystem {
    const shape = l.spread === 'up' ? new ConeEmitter({ radius: l.radius ?? 0.1, angle: 0.5 })
      : l.spread === 'out' ? new SphereEmitter({ radius: l.radius ?? 0.1 }) : new PointEmitter();
    const ps = new ParticleSystem({
      duration: 0.1, looping: false, worldSpace: true, autoDestroy: false,
      startLife: new IntervalValue(l.life[0], l.life[1]),
      startSpeed: new IntervalValue(l.speed[0], l.speed[1]),
      startSize: new IntervalValue(l.size[0], l.size[1]),
      startRotation: new IntervalValue(0, Math.PI * 2),
      startColor: new ConstantColor(new Vector4(1, 1, 1, 1)),
      emissionOverTime: new ConstantValue(0),
      emissionBursts: [{ time: 0, count: new IntervalValue(l.count[0], l.count[1] + 0.99), cycle: 1, interval: 0.01, probability: 1 }],
      shape, material,
      renderMode: l.mode === 'flat' ? RenderMode.HorizontalBillBoard : l.mode === 'streak' ? RenderMode.StretchedBillBoard : RenderMode.BillBoard,
      rendererEmitterSettings: l.mode === 'streak' ? { speedFactor: 0.12, lengthFactor: 1 } : undefined,
      uTileCount: 4, vTileCount: 4, startTileIndex: new ConstantValue(TILE[l.tile]),
    });
    this.colorize(ps, l.colors);
    ps.addBehavior(new SizeOverLife(new PiecewiseBezier([[l.grow ? new Bezier(0.6, 1.4, 1.9, 2.2) : new Bezier(1, 0.9, 0.5, 0), 0]])));
    if (l.gravity) ps.addBehavior(new ApplyForce(new QVec3(0, -1, 0), new ConstantValue(l.gravity)));
    if (l.spin) ps.addBehavior(new RotationOverLife(new IntervalValue(-l.spin, l.spin)));
    ps.emitter.rotation.x = l.spread === 'up' ? -Math.PI / 2 : 0;
    this.batch.addSystem(ps);
    this.root.add(ps.emitter);
    ps.pause();
    return ps;
  }

  /** Sets the colour a layer fades through (alpha always fades out). */
  private colorize(ps: ParticleSystem, [a, b]: [string, string]): void {
    const g = new Gradient([[v3(a), 0], [v3(b), 1]], [[1, 0], [0, 1]]);
    const has = ps.behaviors.find((bh): bh is ColorOverLife => bh instanceof ColorOverLife);
    if (has) has.color = g; else ps.addBehavior(new ColorOverLife(g));
  }

  /** Plays an effect at a floor point; `tint` recolours the layers that take one (the second colour darkened from it). */
  fire(kind: VfxKind, at: THREE.Vector3, tint?: string): void {
    const pool = this.pools.get(kind)!;
    const i = this.next.get(kind) ?? 0;
    this.next.set(kind, (i + 1) % POOL);
    const fx = pool[i]!;
    fx.systems.forEach((ps, k) => {
      const l = fx.layers[k]!;
      if (l.tinted) this.colorize(ps, tint ? [tint, '#' + new THREE.Color(tint).multiplyScalar(0.6).getHexString()] : l.colors);
      ps.emitter.position.set(at.x, l.y ?? 0, at.z);
      // the burst is born from the emitter's world matrix on the next update, before the frame refreshes it: refresh it now
      ps.emitter.updateMatrixWorld(true);
      ps.restart();
    });
  }

  update(dt: number): void {
    this.batch.update(dt);
  }

  dispose(): void {
    for (const pool of this.pools.values()) for (const fx of pool) for (const ps of fx.systems) { this.batch.deleteSystem(ps); ps.dispose(); }
    for (const m of this.mats) m.dispose();
  }
}

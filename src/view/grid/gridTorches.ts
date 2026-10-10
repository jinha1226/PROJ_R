import * as THREE from 'three';
import { idx, type GridMap, type GridState } from '../../sim/grid/types';
import type { DungeonKit } from './dungeonKit';
import { torchSpots, type WallFace } from './gridLayout';
import { CELL, toWorld, yawFor } from './gridTerrain';
import { BRIGHT, DARK } from './zoneLook';

const TORCH_Y = 1.05;
const LIGHT_RANGE = 7.5;
/** every third torch burns in the zone's accent colour (a brazier, a crystal) */
const ACCENT_EVERY = 3;

interface Torch { face: WallFace; model: THREE.Object3D; flame: THREE.Mesh; at: THREE.Vector3; cell: number; phase: number; color: string; power: number }

/** Wall torches: a model and a flickering flame each; only the few nearest seen torches get a real light (phones stay fast). */
let halo: THREE.SpriteMaterial | null = null;
/** A shared radial glow for torch flames (white: each zone tints its copy). */
function haloMaterial(): THREE.SpriteMaterial {
  if (halo) return halo;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  halo = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  return halo;
}

export class GridTorches {
  readonly root = new THREE.Group();
  private readonly torches: Torch[] = [];
  private readonly lights: THREE.PointLight[] = [];
  private t = 0;

  constructor(m: GridMap, kit: DungeonKit, lightCount: number, density = 1, look: { torch: string; flame: string; accent?: string; reach?: number; power?: number } = { torch: '#ff9a40', flame: '#ffb347' }) {
    const haloMat = haloMaterial().clone();
    haloMat.color.set(look.flame);
    const accentHalo = haloMaterial().clone();
    accentHalo.color.set(look.accent ?? look.flame);
    // in the dark a full glow is a white blot: it is turned down with the lights
    if (DARK.on || BRIGHT.on) haloMat.opacity = accentHalo.opacity = DARK.on ? DARK.glow : BRIGHT.glow;
    const flameGeo = new THREE.SphereGeometry(0.07, 8, 6);
    const spots = torchSpots(m);
    spots.filter((_, i) => Math.floor((i + 1) * density) > Math.floor(i * density)).forEach((face, n) => {
      const base = toWorld(face.wall.x + face.dir.x * 0.5, face.wall.y + face.dir.y * 0.5);
      const model = kit.clone('Torch', { height: 0.5 });
      model.position.set(base.x, TORCH_Y - 0.25, base.z);
      model.rotation.y = yawFor(face.dir);
      const accent = !!look.accent && n % ACCENT_EVERY === ACCENT_EVERY - 1;
      const flame = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: accent ? look.accent : look.flame, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
      const at = new THREE.Vector3(base.x + face.dir.x * 0.28 * CELL, TORCH_Y + 0.22, base.z + face.dir.y * 0.28 * CELL);
      flame.position.copy(at);
      // a soft additive halo stands in for bloom (cheap on phones)
      const halo = new THREE.Sprite(accent ? accentHalo : haloMat);
      halo.scale.setScalar(accent ? 1.5 : 1.2);
      flame.add(halo);
      model.visible = flame.visible = false;
      this.root.add(model, flame);
      this.torches.push({ face, model, flame, at, cell: idx(m, face.floor), phase: n * 1.7, color: accent ? look.accent! : look.torch, power: (accent ? 9 : 12) * (look.power ?? 1) });
    });
    for (let i = 0; i < lightCount; i++) {
      const l = new THREE.PointLight(look.torch, 0, look.reach ?? LIGHT_RANGE, look.reach ? 2 : 1.8);
      this.lights.push(l);
      this.root.add(l);
    }
  }

  /** Torches the hero has seen stand where they are; only those in sight now burn and cast light (no glow through walls from another room). */
  shade(s: GridState, hero: THREE.Vector3): void {
    for (const t of this.torches) { t.model.visible = s.seen[t.cell] === 1; t.flame.visible = s.visible.has(t.cell); }
    const near = this.torches.filter((t) => s.visible.has(t.cell)).sort((a, b) => a.at.distanceToSquared(hero) - b.at.distanceToSquared(hero));
    this.lights.forEach((l, i) => {
      const t = near[i];
      l.userData.torch = t;
      // the light sits back against the wall and a little up, so a figure standing right below a torch is lit, not burnt out
      if (t) { l.position.copy(t.at).add(new THREE.Vector3(-t.face.dir.x * 0.2, 0.45, -t.face.dir.y * 0.2)); l.color.set(t.color); }
      else l.intensity = 0;
    });
  }

  update(dt: number): void {
    this.t += dt;
    for (const tr of this.torches) {
      if (!tr.flame.visible) continue;
      const f = 1 + Math.sin(this.t * 11 + tr.phase) * 0.12 + Math.sin(this.t * 23 + tr.phase * 2) * 0.08;
      tr.flame.scale.set(1, f * 1.4, 1);
    }
    for (const l of this.lights) {
      const t = l.userData.torch as Torch | undefined;
      if (!t) continue;
      l.intensity = t.power * (1 + Math.sin(this.t * 9 + t.phase) * 0.1 + Math.sin(this.t * 17 + t.phase) * 0.06);
    }
  }

  dispose(): void {
    this.root.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
  }
}

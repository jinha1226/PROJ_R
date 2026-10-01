import * as THREE from 'three';
import type { AnimKey, GearVisual, ModelId } from '../../data/types';
import { ANIM_CLIPS, LOOPING, type AnimSet } from './animMap';
import type { AssetLibrary } from './assets';
import { MODELS, propsFor, visibleMeshes } from './modelManifest';

export interface ActorSpec {
  id: string;
  model: ModelId;
  gear: GearVisual;
  color: string;
  tint?: string;
  scale?: number;
  team: 'ally' | 'enemy';
}

const nodeVisible = (obj: THREE.Object3D, keep: Set<string>, stop: THREE.Object3D): boolean => {
  for (let o: THREE.Object3D | null = obj; o && o !== stop; o = o.parent) if (keep.has(o.name)) return true;
  return false;
};

export class Actor {
  readonly root = new THREE.Group();
  private readonly model: THREE.Group;
  private readonly mixer: THREE.AnimationMixer;
  private readonly set: AnimSet;
  private readonly materials: THREE.MeshStandardMaterial[] = [];
  private readonly ring: THREE.Mesh;
  private loopKey: AnimKey = 'idle';
  private current: THREE.AnimationAction | null = null;
  private busy = false;
  private state: 'alive' | 'downed' | 'dead' = 'alive';
  private flashLeft = 0;
  private flashTotal = 1;

  constructor(readonly spec: ActorSpec, private readonly lib: AssetLibrary) {
    this.set = MODELS[spec.model].animSet;
    this.model = lib.character(spec.model);
    this.model.scale.setScalar(lib.baseScale(spec.model) * (spec.scale ?? 1));
    this.applyGear(spec.gear);
    this.prepareMaterials(spec.tint);
    this.root.add(this.model);
    this.ring = this.makeRing(spec.team === 'ally' ? spec.color : '#d0533f', spec.scale ?? 1);
    this.root.add(this.ring);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.mixer.addEventListener('finished', () => this.onFinished());
    this.play('idle');
  }

  private applyGear(gear: GearVisual): void {
    const keep = visibleMeshes(this.spec.model, gear);
    this.model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.visible = nodeVisible(o, keep, this.model);
    });
    for (const p of propsFor(this.spec.model, gear)) this.model.getObjectByName(p.slot)?.add(this.lib.prop(p.file));
  }

  private prepareMaterials(tint?: string): void {
    this.model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      if (tint) mat.color.lerp(new THREE.Color(tint), 0.45);
      mesh.material = mat;
      this.materials.push(mat);
    });
  }

  private makeRing(color: string, scale: number): THREE.Mesh {
    const geo = new THREE.RingGeometry(0.42 * scale, 0.56 * scale, 40);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    return ring;
  }

  play(key: AnimKey, opts: { once?: boolean; fade?: number; speed?: number } = {}): void {
    const clip = this.lib.clips(this.set).get(ANIM_CLIPS[this.set][key]);
    if (!clip) return;
    const action = this.mixer.clipAction(clip);
    const once = opts.once ?? !LOOPING.has(key);
    action.reset();
    action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = once;
    action.timeScale = opts.speed ?? 1;
    if (this.current && this.current !== action) action.crossFadeFrom(this.current, opts.fade ?? 0.12, false);
    action.play();
    this.current = action;
    this.busy = once;
    if (!once) this.loopKey = key;
  }

  private onFinished(): void {
    this.busy = false;
    if (this.state === 'alive') this.play(this.loopKey, { fade: 0.18 });
    else if (this.state === 'downed') this.play('downed', { fade: 0.2 });
  }

  setLocomotion(speed: number): void {
    if (this.busy || this.state !== 'alive') return;
    const key: AnimKey = speed > 0.3 ? 'run' : 'idle';
    if (key !== this.loopKey) this.play(key, { fade: 0.15 });
  }

  flash(color: number, ms: number): void {
    for (const m of this.materials) m.emissive.setHex(color);
    this.flashLeft = this.flashTotal = ms / 1000;
  }

  setDowned(on: boolean): void {
    if (this.state === 'dead') return;
    this.state = on ? 'downed' : 'alive';
    if (on) this.play('death', { once: true });
    else this.play('standUp', { once: true });
    (this.ring.material as THREE.MeshBasicMaterial).opacity = on ? 0.35 : 0.85;
  }

  setDead(): void {
    this.state = 'dead';
    this.play('death', { once: true });
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.12;
  }

  get isBusy(): boolean {
    return this.busy;
  }

  update(dt: number): void {
    this.mixer.update(dt);
    if (this.flashLeft > 0) {
      this.flashLeft = Math.max(0, this.flashLeft - dt);
      const k = this.flashLeft / this.flashTotal;
      for (const m of this.materials) m.emissiveIntensity = k * 1.2;
    }
  }

  dispose(): void {
    this.mixer.stopAllAction();
    for (const m of this.materials) m.dispose();
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
  }
}

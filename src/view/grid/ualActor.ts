import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const HEIGHT = 1.6;
/** the mannequin is slim: widen it a little so figures read at a distance */
const BULK = 1.25;
export type UalAnim = 'idle' | 'run' | 'swing' | 'jab' | 'shoot' | 'reload' | 'hit' | 'death' | 'interact';
export interface UalLook { body: string; trim: string; scale: number; weapon: 'sword' | 'crossbow' | 'blade' | 'axe'; shield?: boolean; idle: 'Sword_Idle' | 'Idle_Loop' | 'Pistol_Idle_Loop' }

const CLIP: Record<Exclude<UalAnim, 'idle' | 'hit'>, string> = {
  run: 'Jog_Fwd_Loop', swing: 'Sword_Attack', jab: 'Punch_Jab', shoot: 'Pistol_Shoot', reload: 'Pistol_Reload', death: 'Death01', interact: 'Interact',
};

/** The Quaternius mannequin and its animation clips, loaded once. */
export class UalLibrary {
  private constructor(private readonly scene: THREE.Group, readonly clips: Map<string, THREE.AnimationClip>, readonly scale: number) {}

  static async load(baseUrl: string): Promise<UalLibrary> {
    const g = await new GLTFLoader().loadAsync(`${baseUrl}assets/models/ual/ual.glb`);
    const size = new THREE.Box3().setFromObject(g.scene).getSize(new THREE.Vector3());
    return new UalLibrary(g.scene, new Map(g.animations.map((a) => [a.name, a])), HEIGHT / Math.max(0.01, size.y));
  }

  spawn(): THREE.Object3D {
    return cloneSkinned(this.scene);
  }
}

const bone = (root: THREE.Object3D, name: string): THREE.Object3D | undefined => {
  let hit: THREE.Object3D | undefined;
  root.traverse((o) => { if (!hit && o.name.replace(/\./g, '') === name.replace(/\./g, '')) hit = o; });
  return hit;
};

function weaponMesh(kind: UalLook['weapon']): THREE.Object3D {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#c8ccd4', metalness: 0.6, roughness: 0.35 });
  const wood = new THREE.MeshStandardMaterial({ color: '#6a4a2a', roughness: 0.8 });
  if (kind === 'crossbow') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.42), wood).translateZ(0.12));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.04), metal).translateZ(0.3));
  } else {
    const long = kind === 'sword' ? 0.75 : kind === 'axe' ? 0.6 : 0.5;
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, long, 0.09), metal).translateY(long / 2 + 0.06));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.05), wood));
    if (kind === 'axe') g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.2), metal).translateY(long).translateZ(0.08));
    else g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.22), metal).translateY(0.08));
  }
  return g;
}

/** One animated mannequin: tinted per kind, a block weapon in hand, Quaternius clips for every action. */
export class UalActor {
  readonly root = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly mats: THREE.MeshStandardMaterial[] = [];
  private current: THREE.AnimationAction | null = null;
  private loop: 'idle' | 'run' = 'idle';
  private busy = false;
  private dead = false;
  private flashLeft = 0;
  private flashTotal = 1;
  private flashColor = new THREE.Color();

  constructor(private readonly lib: UalLibrary, private readonly look: UalLook) {
    const model = lib.spawn();
    const k = lib.scale * look.scale;
    model.scale.set(k * BULK, k, k * BULK);
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      const src = Array.isArray(m.material) ? m.material : [m.material];
      const tinted = src.map((mat, i) => {
        const c = (mat as THREE.MeshStandardMaterial).clone();
        c.color.set(i === 0 ? look.body : look.trim);
        this.mats.push(c);
        return c;
      });
      m.material = Array.isArray(m.material) ? tinted : tinted[0]!;
    });
    const w = weaponMesh(look.weapon);
    w.rotation.set(Math.PI / 2, 0, 0);
    bone(model, 'DEF-hand.R')?.add(w);
    if (look.shield) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.32), new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 0.8 }));
      bone(model, 'DEF-forearm.L')?.add(s.translateY(0.15).translateX(-0.05));
    }
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    this.mixer.addEventListener('finished', () => { this.busy = false; if (!this.dead) this.start(this.loop === 'run' ? CLIP.run : this.look.idle, true, 1, 0.12); });
    this.start(look.idle, true, 1, 0);
  }

  private start(name: string, loop: boolean, speed: number, fade: number): void {
    const clip = this.lib.clips.get(name);
    if (!clip) return;
    const a = this.mixer.clipAction(clip);
    a.reset();
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = !loop;
    a.timeScale = speed;
    if (this.current && this.current !== a) a.crossFadeFrom(this.current, fade, false);
    a.play();
    this.current = a;
  }

  play(anim: UalAnim, speed = 1.4): void {
    if (this.dead) return;
    const name = anim === 'hit' ? (Math.random() < 0.5 ? 'Hit_Chest' : 'Hit_Head') : anim === 'idle' ? this.look.idle : CLIP[anim];
    const loop = anim === 'idle' || anim === 'run';
    this.busy = !loop;
    this.start(name, loop, speed, 0.06);
  }

  setLocomotion(running: boolean): void {
    const want = running ? 'run' : 'idle';
    if (this.dead || want === this.loop) return;
    this.loop = want;
    if (!this.busy) this.start(running ? CLIP.run : this.look.idle, true, running ? 1.5 : 1, 0.12);
  }

  flash(color: number, ms: number): void {
    this.flashColor.set(color);
    this.flashLeft = this.flashTotal = ms / 1000;
  }

  setDead(): void {
    if (this.dead) return;
    this.dead = true;
    this.start(CLIP.death, false, 1.3, 0.05);
  }

  update(dt: number): void {
    this.mixer.update(dt);
    if (this.flashLeft > 0) this.flashLeft = Math.max(0, this.flashLeft - dt);
    const k = this.flashLeft / this.flashTotal;
    for (const m of this.mats) m.emissive.copy(this.flashColor).multiplyScalar(k * 0.9);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    for (const m of this.mats) m.dispose();
  }
}

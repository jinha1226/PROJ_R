import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { weaponMesh, type WeaponLook } from './weaponMeshes';

const HEIGHT = 1.6;
/** the mannequin is slim: widen it a little so figures read at a distance */
const BULK = 1.25;
export type UalAnim = 'idle' | 'run' | 'swing' | 'jab' | 'shoot' | 'reload' | 'hit' | 'death' | 'interact';
export interface UalLook { body: string; trim: string; scale: number; weapon: WeaponLook; shield?: boolean; idle: 'Sword_Idle' | 'Idle_Loop' | 'Pistol_Idle_Loop' }

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

/** One animated mannequin: tinted per kind, a block weapon in hand, Quaternius clips for every action. */
export class UalActor {
  readonly root = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly mats: THREE.MeshStandardMaterial[] = [];
  private current: THREE.AnimationAction | null = null;
  private loop: 'idle' | 'run' = 'idle';
  private busy = false;
  private busyKind: UalAnim | null = null;
  private dead = false;
  private flashLeft = 0;
  private flashTotal = 1;
  private flashColor = new THREE.Color();
  private hand: THREE.Object3D | undefined;
  private held: THREE.Object3D | null = null;
  private heldKind: WeaponLook | null = null;

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
    this.hand = bone(model, 'DEF-hand.R');
    this.setWeapon(look.weapon);
    if (look.shield) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.32), new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 0.8 }));
      bone(model, 'DEF-forearm.L')?.add(s.translateY(0.15).translateX(-0.05));
    }
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    // only the action now playing may hand back to the loop (an interrupted one finishing late must not cut the new one)
    this.mixer.addEventListener('finished', (e) => {
      if ((e as unknown as { action: THREE.AnimationAction }).action !== this.current) return;
      this.busy = false;
      this.busyKind = null;
      if (!this.dead) this.start(this.loop === 'run' ? CLIP.run : this.look.idle, true, 1, 0.12);
    });
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

  /** Puts a different block weapon in the right hand. */
  setWeapon(kind: WeaponLook): void {
    if (kind === this.heldKind || !this.hand) return;
    if (this.held) this.hand.remove(this.held);
    this.held = weaponMesh(kind);
    this.heldKind = kind;
    this.hand.add(this.held);
  }

  play(anim: UalAnim, speed = 1.4): void {
    if (this.dead) return;
    // a flinch never cuts off a swing or a shot already under way (the flash still shows the hit)
    if (anim === 'hit' && this.busyKind && this.busyKind !== 'hit') return;
    const name = anim === 'hit' ? (Math.random() < 0.5 ? 'Hit_Chest' : 'Hit_Head') : anim === 'idle' ? this.look.idle : CLIP[anim];
    const loop = anim === 'idle' || anim === 'run';
    this.busy = !loop;
    this.busyKind = loop ? null : anim;
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

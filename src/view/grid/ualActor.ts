import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { weaponMesh, type WeaponLook } from './weaponMeshes';
import { buildBlockBody, type BlockLook } from './blockBody';

const HEIGHT = 1.6;
/** the mannequin is slim: widen it a little so figures read at a distance */
const BULK = 1.25;
export type UalAnim = 'idle' | 'run' | 'swing' | 'jab' | 'bash' | 'scratch' | 'shoot' | 'shootBow' | 'cast' | 'throw' | 'reload' | 'hit' | 'knockback' | 'death' | 'interact' | 'drink';
export type UalIdle = 'Sword_Idle' | 'Idle_Loop' | 'Pistol_Idle_Loop' | 'Spell_Simple_Idle_Loop' | 'Zombie_Idle_Loop';
export interface UalLook { body: string; trim: string; scale: number; weapon: WeaponLook; shield?: boolean; idle: UalIdle; run?: string; block?: BlockLook }

const CLIP: Record<Exclude<UalAnim, 'idle' | 'hit' | 'swing'>, string> = {
  run: 'Jog_Fwd_Loop', jab: 'Punch_Jab', scratch: 'Zombie_Scratch', bash: 'Melee_Hook', shoot: 'Pistol_Shoot', shootBow: 'Bow_Shoot', cast: 'Spell_Simple_Shoot', throw: 'OverhandThrow',
  reload: 'Pistol_Reload', knockback: 'Hit_Knockback', death: 'Death01', interact: 'Chest_Open', drink: 'Consume',
};
/** melee swings rotate through these so a fight does not repeat one motion */
const SWINGS = ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Sword_Attack'];

/** The Quaternius mannequin and its animation clips, loaded once. */
export class UalLibrary {
  private constructor(private readonly scene: THREE.Group, readonly clips: Map<string, THREE.AnimationClip>, readonly scale: number) {}

  static async load(baseUrl: string): Promise<UalLibrary> {
    const g = await new GLTFLoader().loadAsync(`${baseUrl}assets/models/ual/ual.glb`);
    const size = new THREE.Box3().setFromObject(g.scene).getSize(new THREE.Vector3());
    // some clips carry root motion (a swing lunges 0.8 m forward): figures stay on their cell, so the root never travels
    for (const a of g.animations) a.tracks = a.tracks.filter((t) => t.name !== 'root.position');
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
  private swing = 0;
  private idleClip: string;
  private busy = false;
  private busyKind: UalAnim | null = null;
  private dead = false;
  private flashLeft = 0;
  private flashTotal = 1;
  private flashColor = new THREE.Color();
  private hand: THREE.Object3D | undefined;
  private offHand: THREE.Object3D | undefined;
  private held: THREE.Object3D | null = null;
  private heldKind: WeaponLook | null = null;

  constructor(private readonly lib: UalLibrary, private readonly look: UalLook) {
    this.idleClip = look.idle;
    const model = lib.spawn();
    const k = lib.scale * look.scale;
    // a block body is built on the bones in the rest pose; the slim mannequin is widened instead
    if (look.block) { model.scale.setScalar(k); this.mats.push(...buildBlockBody(model, look.block)); }
    else model.scale.set(k * BULK, k, k * BULK);
    if (!look.block) model.traverse((o) => {
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
    this.hand = bone(model, 'hand_r');
    this.offHand = bone(model, 'hand_l');
    this.setWeapon(look.weapon);
    if (look.shield) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.32), new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 0.8 }));
      bone(model, 'lowerarm_l')?.add(s.translateY(0.15).translateX(-0.05));
    }
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    // only the action now playing may hand back to the loop (an interrupted one finishing late must not cut the new one)
    this.mixer.addEventListener('finished', (e) => {
      if ((e as unknown as { action: THREE.AnimationAction }).action !== this.current) return;
      this.busy = false;
      this.busyKind = null;
      if (!this.dead) this.start(this.loop === 'run' ? this.runClip : this.idleClip, true, 1, 0.12);
    });
    this.start(this.idleClip, true, 1, 0);
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

  private get runClip(): string {
    return this.look.run ?? CLIP.run;
  }

  /** Puts a different weapon in the right hand (and, with `idle`, the stance that goes with it). */
  setWeapon(kind: WeaponLook, idle?: UalIdle): void {
    if (idle && idle !== this.idleClip) {
      this.idleClip = idle;
      if (!this.busy && this.loop === 'idle' && !this.dead) this.start(idle, true, 1, 0.15);
    }
    if (kind === this.heldKind || !this.hand) return;
    this.held?.parent?.remove(this.held);
    this.held = weaponMesh(kind);
    this.heldKind = kind;
    // a bow is held in the left hand (the right one draws the string)
    if (kind === 'bow' && this.offHand) { this.held.rotation.set(0, 0, Math.PI / 2); this.offHand.add(this.held); }
    else this.hand.add(this.held);
  }

  play(anim: UalAnim, speed = 1.4): void {
    if (this.dead) return;
    // a flinch never cuts off a swing or a shot already under way (the flash still shows the hit)
    if ((anim === 'hit' || anim === 'knockback') && this.busyKind && this.busyKind !== 'hit' && this.busyKind !== 'knockback') return;
    const name = anim === 'hit' ? (Math.random() < 0.5 ? 'Hit_Chest' : 'Hit_Head')
      : anim === 'swing' ? SWINGS[this.swing++ % SWINGS.length]!
      : anim === 'idle' ? this.idleClip : anim === 'run' ? this.runClip : CLIP[anim];
    const loop = anim === 'idle' || anim === 'run';
    this.busy = !loop;
    this.busyKind = loop ? null : anim;
    this.start(name, loop, speed, 0.06);
  }

  setLocomotion(running: boolean): void {
    const want = running ? 'run' : 'idle';
    if (this.dead || want === this.loop) return;
    this.loop = want;
    if (!this.busy) this.start(running ? this.runClip : this.idleClip, true, running ? 1.5 : 1, 0.12);
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

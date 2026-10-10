import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { weaponMesh, type WeaponLook } from './weaponMeshes';
import { weaponKit } from './weaponKit';
import { tuneHolder } from './figureTune';
import { buildBlockBody, type BlockLook } from './blockBody';
import { buildSuitArmor, lightSuit } from './suitArmor';
import { addOutlines, figureLit, figureMat, type FigureMat } from './toon';
import { addShades } from './floorShades';
import { shapeBones, type BodyShape, type Species } from './species';
import { buildSpeciesParts } from './speciesParts';
import { OutfitKit, type OutfitLook } from './outfitKit';
import { squatClip } from './squatClip';
import { fatten, figTry, flatten, legDrop, stubShape } from './stubFigure';

const HEIGHT = 1.6;
/** the mannequin is slim: widen it a little so figures read at a distance */
const BULK = 1.25;
export type UalAnim = 'idle' | 'run' | 'mine' | 'roll' | 'swing' | 'jab' | 'bash' | 'scratch' | 'weaveL' | 'weaveR' | 'parry' | 'dash' | 'leapUp' | 'leapLand' | 'finisher' | 'shove' | 'shoot' | 'shootBow' | 'cast' | 'throw' | 'reload' | 'hit' | 'knockback' | 'death' | 'interact' | 'drink' | 'pickup';
export type UalIdle = 'Sword_Idle' | 'Idle_Loop' | 'Pistol_Idle_Loop' | 'Spell_Simple_Idle_Loop' | 'Zombie_Idle_Loop';
export interface UalLook { body: string; trim: string; scale: number; weapon: WeaponLook; shield?: boolean; idle: UalIdle; run?: string;
  /** run with the whole jog (arms swinging) instead of legs under a held stance */
  fullRun?: boolean; block?: BlockLook; outfit?: OutfitLook;
  /** the dot look's outline colour (a party class line's colour) */
  ring?: string;
  /** a light of its own, whatever lights the room (a raised skeleton stays bone white under torchlight) */
  glow?: string;
  /** a weapon in the left hand too (twin daggers) */
  off?: WeaponLook; suit?: boolean; armor?: boolean; shape?: BodyShape; species?: Species;
  /** hand-tuned height and breadth against the base mannequin (`figureTune.json`) */
  height?: number; girth?: number }

const CLIP: Record<Exclude<UalAnim, 'idle' | 'hit' | 'swing'>, string> = {
  run: 'Jog_Fwd_Loop', mine: 'Interact', roll: 'Roll', jab: 'Punch_Jab', scratch: 'Zombie_Scratch', weaveL: 'Weave_L', weaveR: 'Weave_R', parry: 'Sword_Block',
  dash: 'Sword_Dash_RM', leapUp: 'NinjaJump_Start', leapLand: 'NinjaJump_Land', finisher: 'Sword_Regular_C', shove: 'Shield_OneShot', bash: 'Melee_Hook', shoot: 'Pistol_Shoot', shootBow: 'Bow_Shoot', cast: 'Spell_Simple_Shoot', throw: 'OverhandThrow',
  reload: 'Pistol_Reload', knockback: 'Hit_Knockback', death: 'Death01', interact: 'Chest_Open', drink: 'Consume', pickup: 'Squat_Pickup',
};
/** the walk on the base ground plays this much quicker: the figures cover cells at the errand pace */
const WALK_PACE = 2;
/** Which loop moves a figure: the base ground walks (the whole walk), elsewhere the jog — legs only under the held stance unless the look runs whole. */
export function gait(look: Pick<UalLook, 'run' | 'fullRun'>, walking: boolean): { clip: string; whole: boolean } {
  return walking ? { clip: 'Walk_Loop', whole: true } : { clip: look.run ?? CLIP.run, whole: !!look.fullRun };
}
/** bones the legs-only half of a run drives (the rest follows the held stance) */
const LEG_BONES = /^(root|pelvis|thigh_[lr]|calf_[lr]|foot_[lr]|ball_[lr]|ball_leaf_[lr])$/;
/**
 * One-off moves that are the arms' and trunk's alone. A figure on the move plays them over the jog's legs (a shot, a
 * reload, a flinch on the run) instead of holding the pose with its whole body while it is carried along the floor.
 */
const ARMS = new Set<UalAnim>(['shoot', 'shootBow', 'cast', 'throw', 'reload', 'hit', 'swing', 'jab', 'bash', 'scratch', 'shove', 'parry', 'drink', 'interact']);
/** a clip's legs alone, or everything but its legs (made on first use, kept with the library's clips) */
function half(clips: Map<string, THREE.AnimationClip>, name: string, legs: boolean): THREE.AnimationClip | undefined {
  const key = `${name}__${legs ? 'legs' : 'upper'}`, hit = clips.get(key), whole = clips.get(name);
  if (hit || !whole) return hit;
  const made = new THREE.AnimationClip(key, whole.duration, whole.tracks.filter((t) => LEG_BONES.test(t.name.slice(0, t.name.lastIndexOf('.'))) === legs));
  clips.set(key, made);
  return made;
}
/** melee swings rotate through these so a fight does not repeat one motion */
const SWINGS = ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Sword_Attack'];

/** The Quaternius mannequin and its animation clips, loaded once. */
export class UalLibrary {
  private constructor(private readonly scene: THREE.Group, readonly clips: Map<string, THREE.AnimationClip>, readonly scale: number, readonly outfits?: OutfitKit) {}

  static async load(baseUrl: string): Promise<UalLibrary> {
    // clothes are optional: without them figures stay bare mannequins
    const [g, outfits] = await Promise.all([new GLTFLoader().loadAsync(`${baseUrl}assets/models/ual/ual.glb`), OutfitKit.load(baseUrl).catch(() => undefined)]);
    const size = new THREE.Box3().setFromObject(g.scene).getSize(new THREE.Vector3());
    // some clips carry root motion (a swing lunges 0.8 m forward): figures stay on their cell, so the root never travels
    for (const a of g.animations) for (const t of a.tracks) {
      if (t.name !== 'root.position') continue;
      // keep the height (jumps), drop the travel (x, z): the figure's cell decides where it stands
      const v = t.values;
      for (let i = 0; i < v.length; i += 3) { v[i] = 0; v[i + 2] = 0; }
    }
    const clips = new Map(g.animations.map((a) => [a.name, a]));
    // picking up: squat down from standing and back up (no pick-up clip in the pack)
    const stand = clips.get('Idle_Loop'), crouch = clips.get('Crouch_Idle_Loop');
    if (stand && crouch) clips.set('Squat_Pickup', squatClip(stand, crouch));
    // running keeps the weapon up: legs from the jog, everything above the hips from the stance the figure holds
    const isLeg = (t: THREE.KeyframeTrack) => LEG_BONES.test(t.name.slice(0, t.name.lastIndexOf('.')));
    const jog = clips.get(CLIP.run);
    if (jog) clips.set(`${CLIP.run}__legs`, new THREE.AnimationClip(`${CLIP.run}__legs`, jog.duration, jog.tracks.filter(isLeg)));
    for (const idle of ['Sword_Idle', 'Idle_Loop', 'Pistol_Idle_Loop', 'Spell_Simple_Idle_Loop']) {
      const c = clips.get(idle);
      if (c) clips.set(`${idle}__upper`, new THREE.AnimationClip(`${idle}__upper`, c.duration, c.tracks.filter((t) => !isLeg(t))));
    }
    return new UalLibrary(g.scene, clips, HEIGHT / Math.max(0.01, size.y), outfits);
  }

  spawn(): THREE.Object3D {
    return cloneSkinned(this.scene);
  }
}

const grips = new Map<string, THREE.Quaternion>();
/**
 * The hand turn that stands a held thing upright (its +y to the sky, facing ahead) in a given pose — measured once on a
 * spare mannequin at a point of the clip: the bow a third into the shot (arm raised, drawing), a caster's stick in the spell stance.
 */
function uprightGrip(lib: UalLibrary, clipName: string, handName: string, at: number, turn = new THREE.Quaternion()): THREE.Quaternion {
  const key = `${clipName}|${handName}|${turn.toArray().join(',')}`, hit = grips.get(key);
  if (hit) return hit;
  const model = lib.spawn(), clip = lib.clips.get(clipName), hand = bone(model, handName);
  let q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
  if (clip && hand) {
    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(clip).play();
    mixer.setTime(clip.duration * at);
    model.updateMatrixWorld(true);
    q = hand.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(model.getWorldQuaternion(new THREE.Quaternion())).multiply(turn);
    mixer.stopAllAction();
  }
  grips.set(key, q);
  return q;
}
/**
 * The bow lies flat across the front of the body: limbs to the left and right (a level line seen from the front or the side),
 * the arc ahead and the string toward the archer. The pack bow is long along y with its arc toward +x, so it is turned
 * y → body x, x → body forward (z), z → up. Measured at rest and a third into the shot, so it follows the hand either way.
 */
const BOW_FLAT = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)));
/** Carried (not drawn): level along the way the body faces, the string on top and the arc below — seen from the side, a flat bow with its string up. */
const BOW_CARRY = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)));
/** the pack bow turned half round its own z (the arc and string the other way about), as the player asked */
const BOW_FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
const bowGrip = (lib: UalLibrary, drawn: boolean) => (drawn ? uprightGrip(lib, CLIP.shootBow, 'hand_l', 0.35, BOW_FLAT.clone().multiply(BOW_FLIP)) : uprightGrip(lib, 'Idle_Loop', 'hand_l', 0.3, BOW_CARRY.clone().multiply(BOW_FLIP)));
const CASTER = new Set<WeaponLook>(['staff', 'wand', 'symbol']);

const bone = (root: THREE.Object3D, name: string): THREE.Object3D | undefined => {
  let hit: THREE.Object3D | undefined;
  root.traverse((o) => { if (!hit && o.name.replace(/\./g, '') === name.replace(/\./g, '')) hit = o; });
  return hit;
};

/** One animated mannequin: tinted per kind, a block weapon in hand, Quaternius clips for every action. */
/** one-off moves played this much faster (the party screens set it; the grid game keeps 1) */
let actionPace = 1;
export const setActionPace = (k: number): void => { actionPace = k; };
/** the moves that are blows, and how much quicker a blow that follows another under way plays */
const ATTACKS = new Set<UalAnim>(['swing', 'jab', 'bash', 'scratch', 'shoot', 'shootBow', 'cast', 'throw', 'finisher', 'dash']);
const FOLLOW_UP = 1.6;

export class UalActor {
  readonly root = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly mats: FigureMat[] = [];
  private current: THREE.AnimationAction | null = null;
  /** the upper-body stance layered over a legs-only run */
  private upper: THREE.AnimationAction | null = null;
  private loop: 'idle' | 'run' = 'idle';
  private walking = false;
  private swing = 0;
  private idleClip: string;
  private busy = false;
  private busyKind: UalAnim | null = null;
  /** a one-off move playing in the arms and trunk alone, over the legs' loop */
  private shot: THREE.AnimationAction | null = null;
  private dead = false;
  private flashLeft = 0;
  private flashTotal = 1;
  private flashColor = new THREE.Color();
  private readonly tint = new THREE.Color(0, 0, 0);
  private readonly glow = new THREE.Color(0, 0, 0);
  private hand: THREE.Object3D | undefined;
  private offHand: THREE.Object3D | undefined;
  private held: THREE.Object3D | null = null;
  private heldKind: WeaponLook | null = null;
  private lamps: THREE.MeshStandardMaterial[] = [];
  private off: THREE.Object3D | null = null;
  /** where the off hand is in the world (a thing carried there follows it) */
  offHandAt(out: THREE.Vector3): THREE.Vector3 | undefined { return this.offHand?.getWorldPosition(out); }
  private offKind: WeaponLook = 'none';
  private shaped: [THREE.Object3D, THREE.Vector3][] = [];
  private hunch: [THREE.Object3D, THREE.Quaternion] | null = null;
  private readonly hunched = new THREE.Quaternion(0, 0, 0, 0);

  constructor(private readonly lib: UalLibrary, private readonly look: UalLook) {
    this.idleClip = look.idle;
    const model = lib.spawn();
    const k = lib.scale * look.scale, h = look.height ?? 1, g = look.girth ?? 1;
    // a block body is built on the bones in the rest pose; the slim mannequin is widened instead
    if (look.block) { model.scale.set(k * g, k * h, k * g); this.mats.push(...buildBlockBody(model, look.block)); }
    else model.scale.set(k * BULK * g, k * h, k * BULK * g);
    if (!look.block) model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      const src = Array.isArray(m.material) ? m.material : [m.material];
      const tinted = src.map((mat, i) => {
        void mat;
        // banded light and a cool rim for the agent, a warm rim for the dungeon's folk
        const c = figureMat(i === 0 ? look.body : look.trim, look.suit ? '#9fd8ff' : '#ffcf9a', look.suit ? 0.6 : 0.4);
        this.mats.push(c);
        return c;
      });
      m.material = Array.isArray(m.material) ? tinted : tinted[0]!;
    });
    // the agent's armour plates (`armor: false` leaves the bare suit)
    if (look.suit && look.armor !== false) { const parts = buildSuitArmor(model); this.mats.push(...parts.mats); this.lamps = parts.lights; }
    if (look.species) this.mats.push(...buildSpeciesParts(model, look.species, look.body));
    if (look.outfit && lib.outfits) this.mats.push(...lib.outfits.dress(model, look.outfit, look.body, '#ffcf9a', 0.4));
    // (the try-out builds: one flat colour, a stubby body)
    const fig = look.block ? null : figTry(), shape = fig ? stubShape(look.shape, fig) : look.shape;
    if (fig?.flat) flatten(this.mats, fig.flat === 1 ? look.ring ?? look.body : undefined);
    if (fig) { model.position.y -= legDrop(model, fig.limb); fatten(model, fig.fat); }
    if (shape) {
      const { bones, spine } = shapeBones(model, shape);
      this.shaped = bones;
      // hunch about the body's side-to-side axis, expressed in the spine's own frame at rest
      const rel = spine ? spine.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(model.getWorldQuaternion(new THREE.Quaternion())) : null;
      if (spine && rel && shape.hunch) this.hunch = [spine, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0).applyQuaternion(rel), shape.hunch)];
    }
    // a dark one-pixel shell keeps the figure apart from the floor once pixelated
    // lit figures carry only a hairline outline (the toon look keeps the heavy one)
    if (!look.block) addOutlines(model, (figureLit() ? 0.012 : 0.03) + (fig?.fat ?? 0));
    if (!look.block) addShades(model);
    this.hand = bone(model, 'hand_r');
    this.offHand = bone(model, 'hand_l');
    this.setWeapon(look.weapon);
    if (look.glow) this.glow.set(look.glow);
    if (look.off) this.setOffhand(look.off);
    if (look.shield) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.32), new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 0.8 }));
      bone(model, 'lowerarm_l')?.add(s.translateY(0.15).translateX(-0.05));
    }
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    // only the action now playing may hand back to the loop (an interrupted one finishing late must not cut the new one)
    this.mixer.addEventListener('finished', (e) => {
      const done = (e as unknown as { action: THREE.AnimationAction }).action;
      if (done !== this.current && done !== this.shot) return;
      this.shot = null;
      this.busy = false;
      this.busyKind = null;
      this.bowDrawn(false);
      if (!this.dead) this.loopOn(this.loop === 'run', this.loop === 'run' ? 1.5 : 1, 0.12);
    });
    this.start(this.idleClip, true, 1, 0);
  }

  private start(name: string, loop: boolean, speed: number, fade: number): void {
    const clip = this.lib.clips.get(name);
    if (!clip) return;
    const a = this.mixer.clipAction(clip);
    // (a loop already going keeps its stride)
    if (loop && this.current === a && a.isRunning()) { a.timeScale = speed; return; }
    a.reset();
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = !loop;
    a.timeScale = speed;
    if (this.current && this.current !== a) a.crossFadeFrom(this.current, fade, false);
    a.play();
    this.current = a;
  }

  /** Idle, or a run: a legs-only jog under the held stance when both halves exist (and the look keeps a stance), else the whole jog. */
  private loopOn(running: boolean, speed: number, fade: number): void {
    const g = gait(this.look, this.walking);
    const legs = `${g.clip}__legs`;
    const up = this.lib.clips.get(`${this.idleClip}__upper`);
    if (!running || !up || !this.lib.clips.has(legs) || g.whole) {
      this.dropUpper(fade);
      this.start(running ? g.clip : this.idleClip, true, running ? (this.walking ? WALK_PACE : speed) : 1, fade);
      return;
    }
    this.start(legs, true, speed, fade);
    const a = this.mixer.clipAction(up);
    if (this.upper !== a) { this.upper?.fadeOut(fade); a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.fadeIn(fade); a.play(); }
    this.upper = a;
  }

  private dropUpper(fade: number): void {
    this.upper?.fadeOut(fade);
    this.upper = null;
  }

  /** Walking on the base ground instead of jogging (see `gait`). */
  setWalking(on: boolean): void {
    if (on === this.walking) return;
    this.walking = on;
    if (this.loop === 'run' && !this.busy && !this.dead) this.loopOn(true, 1.5, 0.15);
  }

  /** Puts a different weapon in the right hand (and, with `idle`, the stance that goes with it). */
  setWeapon(kind: WeaponLook, idle?: UalIdle): void {
    if (idle && idle !== this.idleClip) {
      this.idleClip = idle;
      if (!this.busy && !this.dead) this.loopOn(this.loop === 'run', 1.5, 0.15);
    }
    if (kind === this.heldKind || !this.hand) return;
    // the held thing hangs in a holder carrying its hand-tuned offset (figureTune.json)
    this.held?.parent?.parent?.remove(this.held.parent);
    this.held = weaponMesh(kind);
    this.heldKind = kind;
    const holder = tuneHolder(kind);
    holder.add(this.held);
    // a bow is held in the left hand (the right one draws the string), standing upright in front when drawn
    if (kind === 'bow' && this.offHand) { this.held.quaternion.copy(bowGrip(this.lib, false)); this.offHand.add(holder); }
    else {
      // a caster's stick stands upright in the spell stance instead of lying along the forearm
      if (CASTER.has(kind)) this.held.quaternion.copy(uprightGrip(this.lib, 'Spell_Simple_Idle_Loop', 'hand_r', 0.3));
      this.hand.add(holder);
    }
  }

  /** The weapon of the other hand, shown in the left hand ('none' clears it). */
  setOffhand(kind: WeaponLook): void {
    if (kind === this.offKind || !this.offHand) return;
    this.off?.parent?.parent?.remove(this.off.parent);
    this.offKind = kind;
    this.off = kind === 'none' ? null : weaponKit()?.makeOff(kind) ?? null;
    if (this.off) { const holder = tuneHolder(kind, true); holder.add(this.off); this.offHand.add(holder); }
  }

  /** The one-off action now playing (null while idling or running). */
  get busyWith(): UalAnim | null {
    return this.busyKind;
  }

  play(anim: UalAnim, speed = 1.4): void {
    if (this.dead) return;
    // the party screens quicken one-off moves; a blow that follows one still under way (a chain's extra strike) comes quicker still
    const attack = ATTACKS.has(anim);
    if (anim !== 'idle' && anim !== 'run') speed *= actionPace * (attack && this.busyKind && ATTACKS.has(this.busyKind) ? FOLLOW_UP : 1);
    // a flinch never cuts off a swing or a shot already under way (the flash still shows the hit)
    if ((anim === 'hit' || anim === 'knockback') && this.busyKind && this.busyKind !== 'hit' && this.busyKind !== 'knockback') return;
    const name = anim === 'hit' ? (Math.random() < 0.5 ? 'Hit_Chest' : 'Hit_Head')
      : anim === 'swing' ? SWINGS[this.swing++ % SWINGS.length]!
      : anim === 'idle' ? this.idleClip : anim === 'run' ? gait(this.look, this.walking).clip : CLIP[anim];
    const loop = anim === 'idle' || anim === 'run';
    this.busy = !loop;
    this.busyKind = loop ? null : anim;
    if (loop) { this.shot = null; this.loopOn(anim === 'run', speed, 0.06); return; }
    if (this.loop === 'run' && ARMS.has(anim) && this.overLegs(name, speed, 0)) { this.bowDrawn(anim === 'shootBow'); return; }
    this.shot = null;
    this.dropUpper(0.06);
    this.bowDrawn(anim === 'shootBow');
    this.start(name, loop, speed, 0.06);
  }

  /** Turns a held bow to the drawn grip for a shot, back to the resting one after. */
  private bowDrawn(on: boolean): void {
    if (this.heldKind === 'bow' && this.held) this.held.quaternion.copy(bowGrip(this.lib, on));
  }

  /**
   * A one-off move in the arms and trunk alone, from `at` seconds in, the legs' loop going on under it (the jog's, or the
   * stance's once the figure has stopped). False when the clips are not there.
   */
  private overLegs(name: string, speed: number, at: number, legsOf = gait(this.look, this.walking).clip): boolean {
    const legs = half(this.lib.clips, legsOf, true), arms = half(this.lib.clips, name, false);
    if (!legs || !arms) return false;
    this.start(legs.name, true, legsOf === this.idleClip ? 1 : this.walking ? WALK_PACE : 1.5, 0.08);
    const a = this.mixer.clipAction(arms);
    if (this.upper && this.upper !== a) this.upper.fadeOut(0.06);
    a.reset(); a.time = at; a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = speed; a.fadeIn(0.06); a.play();
    this.upper = this.shot = a;
    return true;
  }

  setLocomotion(running: boolean): void {
    const want = running ? 'run' : 'idle';
    if (this.dead || want === this.loop) return;
    this.loop = want;
    if (!this.busy) { this.loopOn(running, 1.5, 0.12); return; }
    // setting off or stopping in the middle of a shot, a reload or a flinch: the legs change, the arms go on
    const cur = this.shot ?? this.current, name = cur?.getClip().name.replace(/__upper$/, '');
    if (cur && name && this.busyKind && ARMS.has(this.busyKind)) this.overLegs(name, cur.timeScale, cur.time, running ? undefined : this.idleClip);
  }

  flash(color: number, ms: number): void {
    this.flashColor.set(color);
    this.flashLeft = this.flashTotal = ms / 1000;
  }

  /** The suit's engraving lamps: one lit per filled slot. */
  setSuitLights(filled: number): void {
    lightSuit(this.lamps, filled);
  }

  /** See-through while invisible. */
  setGhost(on: boolean): void {
    for (const m of this.mats) {
      if (m.transparent === on) continue;
      m.transparent = on;
      m.opacity = on ? 0.3 : 1;
      m.depthWrite = !on;
      m.needsUpdate = true;
    }
  }

  /** A steady glow for a status (frozen blue, poisoned green, burning orange); null clears it. */
  setTint(color: string | null, strength = 0.45): void {
    this.tint.set(color ?? '#000000');
    if (color) this.tint.multiplyScalar(strength);
  }

  private iced = false;
  /** Frozen solid: the figure holds whatever pose it was caught in until it thaws. */
  setIced(on: boolean): void { this.iced = on; }

  setDead(): void {
    if (this.dead) return;
    this.dead = true;
    // a body on its back reads like a raised-arms pose from above: darken it so the dead read as dead
    for (const m of this.mats) (m.userData.own as THREE.Color | undefined)?.multiplyScalar(0.3);
    for (const m of this.mats) m.color.multiplyScalar(0.6); // dimmed, not blacked out: a body that still reads on a dark floor
    this.dropUpper(0.05);
    // at the clip's own pace: a heavy fall, not a quick flop
    this.start(CLIP.death, false, 1, 0.05);
  }

  private dusty = false;
  /** The body goes to dust (0 → 1): its surface thins out in grains until nothing is left; its outline and shadow go at once. */
  crumble(k: number): void {
    if (!this.dusty) { this.dusty = true; for (const m of this.mats) { m.alphaHash = true; m.needsUpdate = true; } this.root.traverse((o) => { if (o.userData.outline) o.visible = false; }); }
    for (const m of this.mats) m.opacity = 1 - k;
  }

  /** Cuts a part off at a bone (it and everything below it shrink away); returns where it was and the body colour, or null. */
  sever(boneName: string): { at: THREE.Vector3; color: THREE.Color; size: number } | null {
    const b = this.root.getObjectByName(boneName);
    if (!b || this.shaped.some(([s]) => s === b && s.scale.x < 0.01)) return null;
    const at = b.getWorldPosition(new THREE.Vector3());
    this.shaped = this.shaped.filter(([s]) => s !== b);
    this.shaped.push([b, new THREE.Vector3(1e-4, 1e-4, 1e-4)]);
    return { at, color: new THREE.Color(this.look.body).multiplyScalar(0.35), size: this.look.scale };
  }

  update(dt: number): void {
    this.mixer.update(this.iced && !this.dead ? 0 : dt);
    // the species build rides on top of whatever the clip set this frame
    for (const [b, k] of this.shaped) b.scale.copy(k);
    // only on a fresh pose: a frame where no clip touched the spine must not stack another hunch
    if (this.hunch && !this.hunch[0].quaternion.equals(this.hunched)) this.hunched.copy(this.hunch[0].quaternion.multiply(this.hunch[1]));
    if (this.flashLeft > 0) this.flashLeft = Math.max(0, this.flashLeft - dt);
    const k = this.flashLeft / this.flashTotal;
    // a state's tint shows over the figure's own glow
    const base = this.tint.r + this.tint.g + this.tint.b > 0 ? this.tint : this.glow;
    // (a flat figure's part glows with its own colour: see stubFigure.ts)
    const tinted = base === this.tint;
    for (const m of this.mats) m.emissive.copy(tinted ? base : (m.userData.own as THREE.Color | undefined) ?? base).lerp(this.flashColor, k * 0.9);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    for (const m of this.mats) m.dispose();
  }
}

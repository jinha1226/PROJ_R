import { HpBars } from './hpBars';
import * as THREE from 'three';
import type { Ent, GridState } from '../../sim/grid/types';
import { UalActor, type UalAnim, type UalLibrary, type UalLook } from './ualActor';
import type { WeaponLook } from './weaponMeshes';
import { stanceFor } from './heroLook';
import { foeLook, speciesOf } from './species';
import { glide, turnToward } from './chase';
import { CELL } from './gridTerrain';

/** a two-cell leap takes as long as the glide over two cells */
const LEAP_SEC = 0.28;
const LEAP_HEIGHT = 0.9;

/** Every kind is the same mannequin: colour, size and the weapon tell them apart. */
const LOOK: Record<Ent['kind'], UalLook> = {
  hero: { body: '#1d2630', trim: '#2c3946', scale: 1, weapon: 'sword', idle: 'Sword_Idle', suit: true },
  minion: { body: '#d8d2c0', trim: '#7a7262', scale: 0.92, weapon: 'blade', idle: 'Idle_Loop' },
  archer: { body: '#9fb08a', trim: '#4a5a3a', scale: 0.95, weapon: 'crossbow', idle: 'Idle_Loop' },
  brute: { body: '#8a3a32', trim: '#2a2420', scale: 1.22, weapon: 'axe', shield: true, idle: 'Sword_Idle' },
  ghoul: { body: '#6a8a4a', trim: '#3a2a1a', scale: 0.95, weapon: 'none', idle: 'Zombie_Idle_Loop', run: 'Zombie_Walk_Fwd_Loop' },
  mage: { body: '#5a3a7a', trim: '#2a1a3a', scale: 0.95, weapon: 'staff', idle: 'Spell_Simple_Idle_Loop' },
  champion: { body: '#3a3a44', trim: '#d8b040', scale: 1.45, weapon: 'sword', shield: true, idle: 'Sword_Idle' },
};
const LUNGE = 0.3;

/** The coloured ring under each figure (gold hero and elites, red ordinary foes). */
function ring(color: string, scale: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.32 * scale, 0.4 * scale, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  m.userData.ring = true;
  return m;
}
const LUNGE_SEC = 0.12;
const SHOVE = 0.15;

interface View {
  actor: UalActor;
  bar: THREE.Group;
  /** visual position (metres) chasing the logical cell */
  x: number;
  z: number;
  tx: number;
  tz: number;
  facing: number;
  /** drawn yaw, easing toward `facing` */
  yaw: number;
  /** keeps the run cycle going briefly between steps so a held walk never flickers to idle */
  runHold: number;
  /** a short offset (lunge toward a target, recoil, shove), decaying over `offT` */
  ox: number;
  oz: number;
  offT: number;
  /** time left in a leap (the figure arcs up and lands when it runs out) */
  air: number;
  dead: boolean;
}

/** One model per entity: chases its cell, faces where it goes, lunges, recoils and flinches on cue. */
export class GridActors {
  private readonly bars = new HpBars();
  readonly root = new THREE.Group();
  private readonly views = new Map<string, View>();
  private readonly kinds = new Map<string, Ent['kind']>();

  constructor(private readonly lib: UalLibrary) {}

  /** Creates models for entities that do not have one yet (reinforcements appear mid-run). */
  sync(s: GridState): void {
    for (const e of [s.hero, ...s.foes]) {
      const existing = this.views.get(e.id);
      if (existing) { this.bars.update(existing.bar, e.kind === 'hero' ? { ...e, alive: false } : e); continue; }
      this.kinds.set(e.id, e.kind);
      const base = e.kind === 'hero' ? LOOK.hero : foeLook(LOOK[e.kind], e.kind, speciesOf(s.run.floor));
      const look = { ...base, scale: base.scale * (e.elite ? 1.12 : 1) };
      const actor = new UalActor(this.lib, look);
      actor.root.add(ring(e.kind === 'hero' || e.elite ? '#e0a64a' : '#d0533f', look.scale));
      const bar = this.bars.create(2.35 * look.scale);
      actor.root.add(bar);
      this.bars.update(bar, e.kind === 'hero' ? { ...e, alive: false } : e);
      const x = e.pos.x * CELL;
      const z = e.pos.y * CELL;
      actor.root.position.set(x, 0, z);
      this.root.add(actor.root);
      this.views.set(e.id, { actor, bar, x, z, tx: x, tz: z, facing: Math.PI / 2, yaw: Math.PI / 2, runHold: 0, ox: 0, oz: 0, offT: 0, air: 0, dead: !e.alive });
      if (!e.alive) actor.setDead();
    }
  }

  private v(id: string | undefined): View | undefined {
    return id ? this.views.get(id) : undefined;
  }

  pos(id: string): THREE.Vector3 | undefined {
    const v = this.views.get(id);
    return v ? new THREE.Vector3(v.x + v.ox, 0, v.z + v.oz) : undefined;
  }

  moveTo(id: string | undefined, cx: number, cy: number): void {
    const v = this.v(id);
    if (!v) return;
    v.tx = cx * CELL;
    v.tz = cy * CELL;
    v.facing = Math.atan2(v.tz - v.z, v.tx - v.x);
  }

  face(id: string | undefined, toward: THREE.Vector3): void {
    const v = this.v(id);
    if (v) v.facing = Math.atan2(toward.z - v.z, toward.x - v.x);
  }

  private nudge(v: View, toward: THREE.Vector3, amount: number): void {
    const dx = toward.x - v.x;
    const dz = toward.z - v.z;
    const l = Math.hypot(dx, dz) || 1;
    v.ox = (dx / l) * amount * CELL;
    v.oz = (dz / l) * amount * CELL;
    v.offT = LUNGE_SEC;
  }

  /** Melee: step into the target and back, swinging (a dash's own slash is not cut off). */
  lunge(id: string | undefined, at: THREE.Vector3, anim?: UalAnim): void {
    const v = this.v(id);
    if (!v) return;
    this.handFor(id, false);
    this.face(id, at);
    this.nudge(v, at, LUNGE);
    if (v.actor.busyWith !== 'dash') v.actor.play(anim ?? this.meleeAnim(id!), anim === 'finisher' ? 1.5 : 1.7);
  }

  /** Roll: a tumble to the next cell. */
  roll(id: string | undefined, cx: number, cy: number): void {
    this.moveTo(id, cx, cy);
    this.v(id)?.actor.play('roll', 2.4);
  }

  /** Dash: a slashing lunge one cell forward. */
  dash(id: string | undefined, cx: number, cy: number): void {
    this.moveTo(id, cx, cy);
    this.v(id)?.actor.play('dash', 2.2);
  }

  /** Leap: up, two cells through the air, down on the landing cell. */
  leap(id: string | undefined, cx: number, cy: number): void {
    const v = this.v(id);
    if (!v) return;
    this.moveTo(id, cx, cy);
    v.air = LEAP_SEC;
    v.actor.play('leapUp', 2);
  }

  /** Ranged: aim, fire, kick back a little. */
  /** Fires: the motion follows the weapon (gun shot, bow draw, crossbow, staff spell). */
  shoot(id: string | undefined, at: THREE.Vector3, group?: string): void {
    const v = this.v(id);
    if (!v) return;
    this.handFor(id, true);
    this.face(id, at);
    // a spin shot snaps round to each target instead of turning
    if (group === 'spin') v.yaw = v.facing;
    this.nudge(v, at, -0.1);
    const anim: UalAnim = group === 'bow' ? 'shootBow' : group === 'staff' ? 'cast' : 'shoot';
    v.actor.play(anim, anim === 'shootBow' ? 2.2 : 1.7);
  }

  setGhost(id: string, on: boolean): void {
    this.v(id)?.actor.setGhost(on);
  }

  /** Jumps straight to a cell (a teleport): no glide across the map. */
  snap(id: string | undefined, cx: number, cy: number): void {
    const v = this.v(id);
    if (!v) return;
    v.x = v.tx = cx * CELL;
    v.z = v.tz = cy * CELL;
  }

  /** Status glow from the sim: frozen, poisoned, burning. */
  setStatus(id: string, st: { burn: number; freeze: number; poison: number } | undefined): void {
    const v = this.views.get(id);
    if (!v || v.dead) return;
    v.actor.setTint(!st ? null : st.freeze > 0 ? '#5ab4ff' : st.burn > 0 ? '#ff7a2a' : st.poison > 0 ? '#7ad04a' : null);
  }

  /** Just the white flash (the knock-back motion carries the rest). */
  flashOnly(id: string | undefined): void {
    this.v(id)?.actor.flash(0xffffff, 110);
  }

  /** Took a hit: flash, flinch and get shoved away from the attacker. */
  hurt(id: string | undefined, from: THREE.Vector3 | undefined): void {
    const v = this.v(id);
    if (!v || v.dead) return;
    v.actor.flash(0xffffff, 110);
    v.actor.play('hit', 1.8);
    if (from) this.nudge(v, from, -SHOVE);
  }

  /** Shows the weapon group a figure is holding. */
  setWeapon(id: string, kind: WeaponLook, off: WeaponLook = 'none'): void {
    if (id === 'hero') { this.heroWeapon = kind; this.heroOff = off; }
    this.v(id)?.actor.setWeapon(kind, stanceFor(kind));
    this.v(id)?.actor.setOffhand(off);
  }

  /** The hero brings the right weapon to the main hand for the move (gun to shoot, blade to strike), the other goes to the left. */
  private handFor(id: string | undefined, ranged: boolean): void {
    const isGun = (k: WeaponLook | null) => k === 'pistol' || k === 'shotgun' || k === 'rifle';
    if (!this.autoHands || id !== 'hero' || !this.heroWeapon || this.heroOff === 'none' || isGun(this.heroWeapon) === ranged || isGun(this.heroOff) !== ranged) return;
    this.setWeapon('hero', this.heroOff, this.heroWeapon);
  }

  private heroOff: WeaponLook = 'none';
  /** scripted scenes swap hands per move; the game shows the sim's own hand */
  autoHands = false;

  /** Lamps on the hero's suit for its filled engraving slots. */
  setSuitLights(id: string, filled: number): void {
    this.v(id)?.actor.setSuitLights(filled);
  }

  /** A one-off action (reload, opening a chest). */
  anim(id: string | undefined, a: UalAnim): void {
    this.v(id)?.actor.play(a, 1.6);
  }

  /** Which close-quarters motion: skeleton blades and bare hands jab, ranged weapons in hand bash, the rest swing. */
  private meleeAnim(id: string): UalAnim {
    const w = this.heroWeapon && id === 'hero' ? this.heroWeapon : LOOK[this.kindOf(id)].weapon;
    if (this.kindOf(id) === 'ghoul') return 'scratch';
    if (w === 'blade' || w === 'none') return 'jab';
    if (w === 'bow' || w === 'crossbow' || w === 'staff' || w === 'pistol' || w === 'shotgun' || w === 'rifle') return 'bash';
    return 'swing';
  }

  private heroWeapon: WeaponLook | null = null;

  /** Hard hits throw the figure back instead of a flinch. */
  knock(id: string | undefined): void {
    this.v(id)?.actor.play('knockback', 1.6);
  }

  private kindOf(id: string): Ent['kind'] {
    return this.kinds.get(id) ?? 'minion';
  }

  die(id: string | undefined): void {
    const v = this.v(id);
    if (!v || v.dead) return;
    v.dead = true;
    v.actor.setDead();
    // the ring under a figure marks it as a living threat: the fallen lose it
    for (const c of v.actor.root.children) if (c.userData.ring) c.visible = false;
  }

  /** Foes are shown only on tiles the hero can see (the dead stay where they fell once seen). */
  setVisible(id: string, on: boolean): void {
    const v = this.views.get(id);
    if (v) v.actor.root.visible = on;
  }

  /** frozen: hit-stop — models hold their pose for a moment. */
  update(dt: number, frozen: boolean): void {
    for (const v of this.views.values()) {
      const step = frozen ? 0 : dt;
      const px = v.x;
      const pz = v.z;
      const g = glide({ x: v.x / CELL, z: v.z / CELL }, { x: v.tx / CELL, z: v.tz / CELL }, step);
      v.x = g.x * CELL;
      v.z = g.z * CELL;
      const moved = Math.hypot(v.x - px, v.z - pz);
      v.runHold = moved > 1e-4 ? 0.16 : Math.max(0, v.runHold - step);
      v.yaw = turnToward(v.yaw, v.facing, step);
      if (v.offT > 0) {
        v.offT -= step;
        const k = Math.max(0, v.offT / LUNGE_SEC);
        v.actor.root.position.set(v.x + v.ox * k, 0, v.z + v.oz * k);
      } else v.actor.root.position.set(v.x, 0, v.z);
      if (v.air > 0) {
        v.air = Math.max(0, v.air - step);
        v.actor.root.position.y = Math.sin((1 - v.air / LEAP_SEC) * Math.PI) * LEAP_HEIGHT;
        if (v.air === 0) v.actor.play('leapLand', 2);
      }
      v.actor.root.rotation.y = Math.PI / 2 - v.yaw;
      if (!v.dead) v.actor.setLocomotion(v.runHold > 0);
      v.actor.update(step);
    }
  }

  dispose(): void {
    for (const v of this.views.values()) v.actor.dispose();
    this.bars.dispose();
    this.views.clear();
    this.root.clear();
  }
}

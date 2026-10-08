import { handSwap } from './handSwap';
import type { WeaponGroup } from '../../sim/grid/items';
import { HpBars } from './hpBars';
import * as THREE from 'three';
import type { Ent, GridState } from '../../sim/grid/types';
import { UalActor, type UalAnim, type UalLibrary, type UalLook } from './ualActor';
import type { WeaponLook } from './weaponMeshes';
import { stanceFor } from './heroLook';
import { markFigure, RING } from './pixelPass';
import { ABSORB_SEC, LEAVE_AT, LEAP_HEIGHT, LEAP_SEC, LOOK, LUNGE, LUNGE_SEC, POP_SEC, ring, SHOVE, SINK_AT, SINK_SEC, SOUL_GOLD, BODY_LIFT, DEAD_OUTLINE, SPIN_SEC, type View } from './gridActorBits';
import { foeLook, speciesOf } from './species';
import { glide, turnToward } from './chase';
import { CELL } from './gridTerrain';

/** figure size against the cell (1 = a person fills a cell); scripted views may change it */
let FIGURE_SCALE = 1;
export const setFigureScale = (k: number): void => { FIGURE_SCALE = k; };

/** Looks set by id (party heroes drawn as heroes, with their own colours and weapons; their health bars show). */
export const LOOK_BY_ID = new Map<string, UalLook>();

/** One model per entity: chases its cell, faces where it goes, lunges, recoils and flinches on cue. */

/** within this many cells of the camera a figure is built even before its cell is seen; beyond this many it stops animating */
const NEAR_BUILD = 14, FAR_ANIM = 18;

/** Whether a figure is built now: clones always; others on a seen cell or within NEAR_BUILD cells of the camera. */
export function buildsNow(e: { id: string; kind: string; pos: { x: number; y: number } }, seen: Uint8Array | undefined, w: number, focus: { x: number; y: number } | null): boolean {
  if (e.kind === 'hero' || LOOK_BY_ID.has(e.id) || seen?.[e.pos.y * w + e.pos.x]) return true;
  return !!focus && Math.max(Math.abs(e.pos.x - focus.x), Math.abs(e.pos.y - focus.y)) <= NEAR_BUILD;
}

export class GridActors {
  private readonly bars = new HpBars();
  readonly root = new THREE.Group();
  private readonly views = new Map<string, View>();
  private readonly kinds = new Map<string, Ent['kind']>();
  private lastState: GridState | null = null;
  private readonly absorbing = new Map<string, number>();
  private readonly popIn = new Map<string, number>();

  /** walking pace in cells per second (a live game slows it to match how often its units step) */
  walkSpeed?: number;
  /** figures walk instead of jogging (the base ground) */
  walk = false;
  /** the cell the camera looks at: figures are built near it or on seen cells, and far ones stop animating */
  focus: { x: number; y: number } | null = null;
  private resync = 0;

  constructor(private readonly lib: UalLibrary) {}

  /** Creates models for entities that do not have one yet (reinforcements appear mid-run). */
  sync(s: GridState): void {
    this.lastState = s;
    // a figure whose entity is gone from the floor (a summon that fell, or whose time ran out) falls and sinks away:
    // it used to stand there for good
    if (this.views.size) {
      const here = new Set<string>([s.hero.id]); for (const e of s.foes) here.add(e.id);
      for (const [id, v] of this.views) if (!here.has(id) && !v.leaving) { v.leaving = true; if (!v.dead) { v.dead = true; v.actor.setDead(); } v.deadFor ??= 0; }
    }
    for (const e of [s.hero, ...s.foes]) {
      // a raid's fodder are drawn as one instanced horde (SwarmView), never as figures
      if (e.swarm) continue;
      const existing = this.views.get(e.id);
      const hideBar = e.kind === 'hero' && !LOOK_BY_ID.has(e.id);
      if (existing) { this.bars.update(existing.bar, hideBar ? { ...e, alive: false } : e); continue; }
      // a horde floor: a figure is built once its cell has been seen or it is near the camera (clones always)
      if (!buildsNow(e, s.seen, s.map.w, this.focus)) continue;
      this.kinds.set(e.id, e.kind);
      const byId = LOOK_BY_ID.get(e.id);
      const base = byId ?? (e.kind === 'hero' ? LOOK.hero : foeLook(LOOK[e.kind], e.kind, speciesOf(s.run.floor)));
      const look = { ...base, scale: base.scale * (e.elite ? 1.12 : 1) * FIGURE_SCALE };
      const actor = new UalActor(this.lib, look);
      // before the ring and bar go on: only the body gets the dot look's side outline
      markFigure(actor.root, look.ring ?? (e.kind === 'hero' || byId ? RING.shell : RING.foe));
      actor.root.add(ring(e.kind === 'hero' || e.elite || byId ? '#e0a64a' : '#d0533f', look.scale));
      const bar = this.bars.create(2.35 * look.scale);
      actor.root.add(bar);
      this.bars.update(bar, hideBar ? { ...e, alive: false } : e);
      const x = e.pos.x * CELL;
      const z = e.pos.y * CELL;
      actor.root.position.set(x, 0, z);
      this.root.add(actor.root);
      this.views.set(e.id, { actor, bar, x, z, tx: x, tz: z, facing: Math.PI / 2, yaw: Math.PI / 2, runHold: 0, ox: 0, oz: 0, offT: 0, air: 0, dead: !e.alive });
      // just reborn with a soul: the gold fades out of it as it grows to full size
      if (this.popIn.has(e.id)) { actor.flash(SOUL_GOLD, 800); actor.root.scale.setScalar(0.7); }
      if (!e.alive) actor.setDead();
    }
  }

  private v(id: string | undefined): View | undefined {
    return id ? this.views.get(id) : undefined;
  }

  /** Cuts a head or an arm off a figure (it must still be standing in the scene). */
  sever(id: string | undefined, part: 'head' | 'armL' | 'armR'): { at: THREE.Vector3; color: THREE.Color; size: number } | null {
    const v = this.v(id);
    return v ? v.actor.sever(part === 'head' ? 'Head' : part === 'armL' ? 'upperarm_l' : 'upperarm_r') : null;
  }

  /** A body knocked a little way from the blow that killed it (it lies there). */
  fling(id: string | undefined, from: THREE.Vector3, dist: number): void {
    const v = this.v(id);
    if (!v) return;
    const dx = v.x - from.x, dz = v.z - from.z, len = Math.hypot(dx, dz) || 1;
    v.x += (dx / len) * dist; v.z += (dz / len) * dist;
    v.tx = v.x; v.tz = v.z;
  }

  /** The figure's scene object (for afterimages). */
  figure(id: string | undefined): THREE.Object3D | undefined {
    const v = this.v(id);
    return v && !v.dead ? v.actor.root : undefined;
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

  /** A clone working a vein: turns to the rock and reaches down to gather from it. */
  mine(id: string, rock: THREE.Vector3): void {
    const v = this.v(id);
    if (!v || v.dead) return;
    v.facing = Math.atan2(rock.z - v.z, rock.x - v.x);
    v.actor.play('mine', 1.1);
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
  lunge(id: string | undefined, at: THREE.Vector3, anim?: UalAnim, group?: WeaponGroup): void {
    const v = this.v(id);
    if (!v) return;
    this.handFor(id, group);
    this.face(id, at);
    this.nudge(v, at, LUNGE);
    if (v.actor.busyWith !== 'dash') v.actor.play(anim ?? this.meleeAnim(id!), anim === 'finisher' ? 1.5 : 1.7);
  }

  /** Roll: a tumble to the next cell (the figure turns into the roll). */
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
  /** Fires: the motion follows the weapon (gun shot, bow draw, crossbow). */
  shoot(id: string | undefined, at: THREE.Vector3, group?: WeaponLook, spin = false): void {
    const v = this.v(id);
    if (!v) return;
    this.handFor(id, group);
    // mid-roll, mid-dash or in the air the move carries on: the shot is only its flash and tracer
    const moving = v.actor.busyWith;
    if (moving === 'roll' || moving === 'dash' || moving === 'leapUp' || v.air > 0) return;
    this.face(id, at);
    // a spin shot snaps round to each target instead of turning
    if (spin) v.yaw = v.facing;
    this.nudge(v, at, -0.1);
    const anim: UalAnim = group === 'bow' ? 'shootBow' : group === 'none' ? 'cast' : 'shoot';
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

  /** Just the flash (the knock-back motion carries the rest): red on a clone, none on a foe (it bleeds instead). */
  flashOnly(id: string | undefined): void {
    if (this.isAlly(id)) this.v(id)?.actor.flash(0xff3a2a, 90);
  }

  /** The whirlwind: a swing while the whole body turns round twice. */
  spin(id: string | undefined): void {
    const v = this.v(id);
    if (!v || v.dead) return;
    v.spin = SPIN_SEC;
    v.actor.play('swing', 2.2);
  }

  /** One of the party (the hero or a clone), not a foe. */
  isAlly(id: string | undefined): boolean {
    return !!id && (id === 'hero' || LOOK_BY_ID.has(id));
  }

  /** Took a hit: flinch and get shoved away from the attacker (a clone also flashes red; a foe just bleeds). */
  hurt(id: string | undefined, from: THREE.Vector3 | undefined): void {
    const v = this.v(id);
    if (!v || v.dead) return;
    this.flashOnly(id);
    v.actor.play('hit', 1.8);
    if (from) this.nudge(v, from, -SHOVE);
  }

  /** Shows the weapon group a figure is holding. */
  setWeapon(id: string, kind: WeaponLook, off: WeaponLook = 'none'): void {
    if (id === 'hero') { this.heroWeapon = kind; this.heroOff = off; }
    this.v(id)?.actor.setWeapon(kind, stanceFor(kind));
    this.v(id)?.actor.setOffhand(off);
  }

  private handFor(id: string | undefined, group?: WeaponLook): void {
    if (id !== 'hero' || !this.heroWeapon) return;
    const swap = handSwap(this.heroWeapon, this.heroOff, group);
    if (swap) this.setWeapon('hero', ...swap);
  }

  private heroOff: WeaponLook = 'none';

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
    const w = this.heroWeapon && id === 'hero' ? this.heroWeapon : (LOOK_BY_ID.get(id) ?? LOOK[this.kindOf(id)]).weapon;
    if (this.kindOf(id) === 'ghoul') return 'scratch';
    if (w === 'blade' || w === 'none') return 'jab';
    if (w === 'bow' || w === 'crossbow' || w === 'pistol') return 'bash';
    return 'swing';
  }

  private heroWeapon: WeaponLook | null = null;

  /** Hard hits throw the figure back instead of a flinch. */
  knock(id: string | undefined, from?: THREE.Vector3): void {
    const v = this.v(id);
    if (!v || v.dead) return;
    this.flashOnly(id);
    v.actor.play('knockback', 1.6);
    if (from) this.nudge(v, from, -SHOVE * 1.8);
  }

  private kindOf(id: string): Ent['kind'] {
    return this.kinds.get(id) ?? 'minion';
  }

  /** Falls: pushed back from the killer as it goes down, then (a foe) sinks into the floor and is gone, its blood left behind. */
  die(id: string | undefined, from?: THREE.Vector3): void {
    const v = this.v(id);
    if (!v || v.dead) return;
    v.dead = true;
    v.deadFor = 0;
    v.actor.setDead();
    if (from) this.nudge(v, from, -SHOVE * 2.4);
    if (this.isAlly(id)) return;
    // a foe goes down where it stands (no toss into the air: a hop made a death read as light), and a pool of blood spreads where it lies
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.3, 14), new THREE.MeshBasicMaterial({ color: '#4a0808', transparent: true, opacity: 0.75, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.02 - BODY_LIFT; pool.scale.setScalar(0.01); pool.userData.pool = true;
    v.actor.root.add(pool);
    // the ring under a figure marks it as a living threat: the fallen lose it
    for (const c of v.actor.root.children) if (c.userData.groundRing) c.visible = false;
    // the dot look's outline goes dark on a body, so the fallen don't read as foes still standing
    v.actor.root.traverse((o) => { if (typeof o.userData.ring === 'string') o.userData.ring = DEAD_OUTLINE; });
  }

  /** Foes are shown only on tiles the hero can see (the dead stay where they fell once seen). */
  setVisible(id: string, on: boolean): void {
    const v = this.views.get(id);
    if (v && !v.gone) v.actor.root.visible = on;
  }

  /** frozen: hit-stop — models hold their pose for a moment. */
  update(dt: number, frozen: boolean): void {
    for (const [id, left] of this.absorbing) {
      if (left - dt > 0) { this.absorbing.set(id, left - dt); continue; }
      this.absorbing.delete(id);
      this.rebuild(id);
      this.popIn.set(id, POP_SEC);
      if (this.lastState) this.sync(this.lastState);
    }
    for (const [id, left] of this.popIn) {
      const v = this.views.get(id), t = Math.max(0, left - dt);
      if (v) v.actor.root.scale.setScalar(1 - 0.3 * (t / POP_SEC) ** 2);
      if (t <= 0) this.popIn.delete(id); else this.popIn.set(id, t);
    }
    // newly seen cells get their figures a few times a second
    this.resync -= dt;
    if (this.resync <= 0 && this.lastState) { this.resync = 0.25; this.sync(this.lastState); }
    const left: string[] = [];
    for (const [vid, v] of this.views) {
      const step = frozen ? 0 : dt;
      const far = !!this.focus && Math.max(Math.abs(v.x / CELL - this.focus.x), Math.abs(v.z / CELL - this.focus.y)) > FAR_ANIM;
      const px = v.x;
      const pz = v.z;
      const g = glide({ x: v.x / CELL, z: v.z / CELL }, { x: v.tx / CELL, z: v.tz / CELL }, step, this.walkSpeed);
      v.x = g.x * CELL;
      v.z = g.z * CELL;
      const moved = Math.hypot(v.x - px, v.z - pz);
      v.runHold = moved > 1e-4 ? 0.16 : Math.max(0, v.runHold - step);
      if (v.spin && v.spin > 0) { v.spin = Math.max(0, v.spin - step); v.yaw = v.facing - (1 - v.spin / SPIN_SEC) * Math.PI * 4; }
      else v.yaw = turnToward(v.yaw, v.facing, step);
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
      // a body lying flat sits a little above the floor tiles (flat on the ground it would sink inside them and vanish)
      if (v.dead && v.air <= 0) v.actor.root.position.y = Math.max(v.actor.root.position.y, BODY_LIFT);
      if (v.deadFor !== undefined && !v.gone && (v.leaving || !this.isAlly(vid))) {
        v.deadFor += step;
        for (const c of v.actor.root.children) if (c.userData.pool) c.scale.setScalar(Math.min(1, 0.01 + v.deadFor / 0.5));
        // a figure that has left the floor (a summon) does not lie about as long as a foe's body
        const k = Math.min(1, Math.max(0, (v.deadFor - (v.leaving ? LEAVE_AT : SINK_AT)) / SINK_SEC));
        if (k > 0) v.actor.root.position.y = BODY_LIFT - 0.8 * k;
        if (k >= 1) { v.gone = true; v.actor.root.visible = false; if (v.leaving) left.push(vid); }
      }
      v.actor.root.rotation.y = Math.PI / 2 - v.yaw;
      if (!v.dead) { v.actor.setWalking(this.walk); v.actor.setLocomotion(v.runHold > 0); }
      // far from the camera a figure keeps its place but stops animating (and a far body is not drawn)
      if (far) { if (v.dead) v.actor.root.visible = false; continue; }
      if (v.dead && !v.gone) v.actor.root.visible = true;
      v.actor.update(step);
    }
    for (const id of left) this.rebuild(id);
  }

  /** A clone taking a soul: it lights up gold and casts for a moment, then stands up in its new look (see `update`). */
  absorb(id: string): void {
    const v = this.views.get(id);
    if (!v) { this.rebuild(id); return; }
    v.actor.setTint('#ffd76a');
    v.actor.flash(SOUL_GOLD, ABSORB_SEC * 1000);
    v.actor.play('cast', 0.8);
    this.absorbing.set(id, ABSORB_SEC);
  }

  /** Drops a figure so the next sync builds it again from its (new) look. */
  rebuild(id: string): void {
    const v = this.views.get(id);
    if (!v) return;
    this.root.remove(v.actor.root);
    v.actor.dispose();
    this.views.delete(id);
  }

  dispose(): void {
    for (const v of this.views.values()) v.actor.dispose();
    this.bars.dispose();
    this.views.clear();
    this.root.clear();
  }
}
